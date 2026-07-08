import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { appendAudit } from './audit.ts';
import { redactText } from './dataProxy.ts';
import {
  authorizeRoute,
  type RouteDecision,
  type RouteTarget,
  type RoutingInput,
  type RoutingPolicyDocument,
  selectRoute,
} from './router.ts';

type Role = 'system' | 'user' | 'assistant';

export interface GatewayMessage {
  role: Role;
  content: string;
}

export interface ProductionGatewayRequest extends RoutingInput {
  user: string;
  messages: GatewayMessage[];
  audit_id: string;
  trace_id: string;
  audit_log_path: string;
  routing_policy_path?: string;
  task_id?: string;
  agent_profile?: string;
}

export interface ProductionGatewaySuccess {
  ok: true;
  provider: string;
  model_id: string;
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
  estimated_cost: number;
  fallback_index: number;
  routing_decision: RouteDecision;
}

export interface ProductionGatewayFailure {
  ok: false;
  reason: string;
  routing_decision?: RouteDecision;
}

export type ProductionGatewayResult =
  | ProductionGatewaySuccess
  | ProductionGatewayFailure;

interface OpenAiCompatibleResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  estimated_cost?: number;
}

const defaultPolicyPath = 'policy/routing.json';
const prodPolicyPath = 'policy/routing.prod.json';

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function defaultRoutingPolicyPath(): string {
  return process.env.PI_PROVIDER === 'prod'
    ? prodPolicyPath
    : defaultPolicyPath;
}

async function loadRoutingPolicy(path = defaultRoutingPolicyPath()) {
  const document = JSON.parse(await readFile(path, 'utf8')) as
    | RoutingPolicyDocument
    | { routing_prod: RoutingPolicyDocument };
  return 'routing_prod' in document ? document.routing_prod : document;
}

function providerSecret(
  policy: RoutingPolicyDocument,
  providerName: string,
): {
  baseUrl: string | undefined;
  apiKey: string | undefined;
  type: string | undefined;
} {
  const provider = policy.providers[providerName];
  return {
    type: provider?.type,
    baseUrl: provider?.base_url_env
      ? process.env[provider.base_url_env]
      : undefined,
    apiKey: provider?.api_key_env
      ? process.env[provider.api_key_env]
      : undefined,
  };
}

function attempts(decision: RouteDecision): RouteTarget[] {
  const first: RouteTarget = {
    provider: decision.provider,
    model_id: decision.model_id,
  };
  if (decision.mode) first.mode = decision.mode;
  return [first, ...decision.fallback_chain];
}

function routingInput(request: ProductionGatewayRequest): RoutingInput {
  return {
    tenant: request.tenant,
    data_classification: request.data_classification,
    task_kind: request.task_kind,
    cost_budget: request.cost_budget,
    latency_target: request.latency_target,
  };
}

async function dispatchOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: GatewayMessage[],
  metadata: Record<string, string | undefined>,
): Promise<OpenAiCompatibleResponse> {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: false, metadata }),
      signal: AbortSignal.timeout(2000),
    },
  );
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const body = (await response.json()) as OpenAiCompatibleResponse;
  const cost =
    response.headers.get('x-litellm-response-cost') ??
    response.headers.get('x-litellm-cost');
  if (cost) body.estimated_cost = Number(cost);
  return body;
}

function normalizeUsage(response: OpenAiCompatibleResponse) {
  return {
    input_tokens: response.usage?.prompt_tokens ?? 0,
    output_tokens: response.usage?.completion_tokens ?? 0,
    total_tokens: response.usage?.total_tokens ?? 0,
  };
}

function recordGatewaySpan(
  decision: RouteDecision,
  request: ProductionGatewayRequest,
  target: RouteTarget,
  fallbackIndex: number,
  latencyMs: number,
  usage: ProductionGatewaySuccess['usage'],
  estimatedCost: number,
): void {
  const span = trace
    .getTracer('flue-pi-evidence-platform')
    .startSpan('gateway.call', {
      attributes: {
        'gateway.provider': target.provider,
        'gateway.model_id': target.model_id,
        'gateway.routing_policy_version': decision.routing_policy_version,
        'gateway.route_id': decision.route_id,
        'gateway.fallback_index': fallbackIndex,
        'gateway.latency_ms': latencyMs,
        'gateway.input_tokens': usage.input_tokens,
        'gateway.output_tokens': usage.output_tokens,
        'gateway.estimated_cost': estimatedCost,
        'gateway.data_classification': request.data_classification,
        'gateway.task_kind': request.task_kind,
        'gateway.task_id': request.task_id ?? '',
        'gateway.agent_profile': request.agent_profile ?? '',
      },
    });
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

async function auditGatewayCall(
  path: string,
  request: ProductionGatewayRequest,
  decision: RouteDecision,
  provider: string,
  modelId: string,
  fallbackIndex: number,
  latencyMs: number,
  usage: ProductionGatewaySuccess['usage'],
  estimatedCost: number,
  redactedMessages: GatewayMessage[],
  responseContent: string,
): Promise<void> {
  await appendAudit(path, {
    type: 'llm_gateway_call',
    audit_id: request.audit_id,
    trace_id: request.trace_id,
    provider,
    model_id: modelId,
    route_id: decision.route_id,
    routing_policy_version: decision.routing_policy_version,
    fallback_index: fallbackIndex,
    latency_ms: latencyMs,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    estimated_cost: estimatedCost,
    task_id: request.task_id,
    agent_profile: request.agent_profile,
    request_digest: digest(redactedMessages),
    response_digest: digest(responseContent),
  });
}

export async function callProductionGateway(
  request: ProductionGatewayRequest,
): Promise<ProductionGatewayResult> {
  try {
    const policy = await loadRoutingPolicy(request.routing_policy_path);
    const decision = selectRoute(routingInput(request), policy);
    const redactedMessages = await Promise.all(
      request.messages.map(async (message) => ({
        ...message,
        content: (await redactText(message.content)).redacted_text,
      })),
    );
    const authorization = await authorizeRoute(decision, policy);
    if (!authorization.allow) {
      return {
        ok: false,
        reason: authorization.reasons.join(','),
        routing_decision: decision,
      };
    }

    for (const [fallbackIndex, target] of attempts(decision).entries()) {
      const start = Date.now();
      if (
        target.provider === 'local' ||
        target.mode === 'deterministic-fallback'
      ) {
        const content = 'deterministic-fallback';
        const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        const latencyMs = Date.now() - start;
        recordGatewaySpan(
          decision,
          request,
          target,
          fallbackIndex,
          latencyMs,
          usage,
          0,
        );
        await auditGatewayCall(
          request.audit_log_path,
          request,
          decision,
          target.provider,
          target.model_id,
          fallbackIndex,
          latencyMs,
          usage,
          0,
          redactedMessages,
          content,
        );
        return {
          ok: true,
          provider: target.provider,
          model_id: target.model_id,
          content,
          usage,
          latency_ms: latencyMs,
          estimated_cost: 0,
          fallback_index: fallbackIndex,
          routing_decision: decision,
        };
      }

      const secret = providerSecret(policy, target.provider);
      if (!['openai_compatible', 'litellm_proxy'].includes(secret.type ?? '')) {
        continue;
      }
      if (!secret.baseUrl || !secret.apiKey) {
        return {
          ok: false,
          reason: 'provider_env_unavailable',
          routing_decision: decision,
        };
      }
      try {
        const response = await dispatchOpenAiCompatible(
          secret.baseUrl,
          secret.apiKey,
          target.model_id,
          redactedMessages,
          {
            task_id: request.task_id,
            agent_profile: request.agent_profile,
            tenant: request.tenant,
            data_class: request.data_classification,
          },
        );
        const content = response.choices?.[0]?.message?.content ?? '';
        const usage = normalizeUsage(response);
        const estimatedCost = response.estimated_cost ?? 0;
        const latencyMs = Date.now() - start;
        recordGatewaySpan(
          decision,
          request,
          target,
          fallbackIndex,
          latencyMs,
          usage,
          estimatedCost,
        );
        await auditGatewayCall(
          request.audit_log_path,
          request,
          decision,
          target.provider,
          target.model_id,
          fallbackIndex,
          latencyMs,
          usage,
          estimatedCost,
          redactedMessages,
          content,
        );
        return {
          ok: true,
          provider: target.provider,
          model_id: target.model_id,
          content,
          usage,
          latency_ms: latencyMs,
          estimated_cost: estimatedCost,
          fallback_index: fallbackIndex,
          routing_decision: decision,
        };
      } catch {}
    }
    return {
      ok: false,
      reason: 'llm_unavailable',
      routing_decision: decision,
    };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}
