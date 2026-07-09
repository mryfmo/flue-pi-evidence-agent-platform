import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  callProductionGateway,
  type ProductionGatewayRequest,
} from '../../src/lib/productionGateway.ts';
import type { RoutingPolicyDocument } from '../../src/lib/router.ts';

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

async function startMockProvider(responseText = 'redacted summary') {
  const requests: unknown[] = [];
  const server = createServer(async (req, res) => {
    requests.push(await readJson(req));
    res.writeHead(200, {
      'content-type': 'application/json',
      'x-litellm-response-cost': '0.0012',
    });
    res.end(
      JSON.stringify({
        id: 'chatcmpl-contract',
        choices: [{ message: { content: responseText } }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function policy(baseUrlEnv = 'MOCK_BASE_URL'): RoutingPolicyDocument {
  return {
    version: 'contract-test',
    defaults: {
      fallback_chain: [
        { provider: 'mock', model_id: 'mock-model' },
        {
          provider: 'local',
          model_id: 'fixbot',
          mode: 'deterministic-fallback',
        },
      ],
    },
    routes: [
      {
        id: 'contract-route',
        match: {
          tenant: 'acme',
          data_classification: 'internal',
          task_kind: 'verified_evidence_summary',
          cost_budget: 'standard',
          latency_target: 'interactive',
        },
        provider: 'mock',
        model_id: 'mock-model',
        fallback_chain: [
          {
            provider: 'local',
            model_id: 'fixbot',
            mode: 'deterministic-fallback',
          },
        ],
      },
    ],
    providers: {
      mock: {
        type: 'openai_compatible',
        base_url_env: baseUrlEnv,
        api_key_env: 'MOCK_API_KEY',
      },
      local: { type: 'local_gateway' },
    },
  };
}

async function writePolicy(doc: RoutingPolicyDocument): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'llm-contract-'));
  const path = join(dir, 'routing.json');
  await writeFile(path, JSON.stringify(doc), 'utf8');
  return path;
}

async function baseRequest(
  routingPolicyPath?: string,
): Promise<ProductionGatewayRequest> {
  const dir = await mkdtemp(join(tmpdir(), 'llm-contract-audit-'));
  return {
    tenant: 'acme',
    user: 'engineer',
    data_classification: 'internal',
    task_kind: 'verified_evidence_summary',
    cost_budget: 'standard',
    latency_target: 'interactive',
    messages: [
      {
        role: 'user',
        content: 'Summarize verified evidence for alice@example.com.',
      },
    ],
    audit_id: 'audit-contract',
    trace_id: 'trace-contract',
    audit_log_path: join(dir, 'audit.jsonl'),
    ...(routingPolicyPath ? { routing_policy_path: routingPolicyPath } : {}),
  };
}

function prodRequest(): Promise<ProductionGatewayRequest> {
  return baseRequest();
}

describe('llm_contract production gateway', () => {
  it('returns content and response contract fields on the happy path', async () => {
    const mock = await startMockProvider('contract ok');
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', 'test-key');
    const request = await baseRequest(await writePolicy(policy()));

    const result = await callProductionGateway(request);

    expect(result).toMatchObject({
      ok: true,
      provider: 'mock',
      model_id: 'mock-model',
      content: 'contract ok',
      usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      routing_decision: { route_id: 'contract-route' },
    });
    expect(mock.requests).toHaveLength(1);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('redacts outbound prompts before dispatch', async () => {
    const mock = await startMockProvider();
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', 'test-key');

    await callProductionGateway(await baseRequest(await writePolicy(policy())));

    expect(JSON.stringify(mock.requests)).not.toContain('alice@example.com');
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('writes audit metadata without raw prompt or response content', async () => {
    const mock = await startMockProvider('summary with no pii');
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', 'test-key');
    const request = await baseRequest(await writePolicy(policy()));

    await callProductionGateway(request);
    const audit = await readFile(request.audit_log_path, 'utf8');

    expect(audit).toContain('audit-contract');
    expect(audit).toContain('trace-contract');
    expect(audit).toContain('request_digest');
    expect(audit).toContain('response_digest');
    expect(audit).not.toContain('alice@example.com');
    expect(audit).not.toContain('summary with no pii');
    expect(audit).not.toContain('test-key');
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('keeps the LLM path summarization-only with no tool dispatch payload', async () => {
    const mock = await startMockProvider();
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', 'test-key');

    await callProductionGateway(await baseRequest(await writePolicy(policy())));

    expect(JSON.stringify(mock.requests)).not.toContain('"tools"');
    expect(JSON.stringify(mock.requests)).not.toContain('apply_patch');
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('fails closed before dispatch when the api key is missing', async () => {
    const mock = await startMockProvider();
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', '');

    const result = await callProductionGateway(
      await baseRequest(await writePolicy(policy())),
    );

    expect(result).toMatchObject({ ok: false });
    expect(mock.requests).toHaveLength(0);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('fails closed before dispatch on OPA deny', async () => {
    const mock = await startMockProvider();
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', 'test-key');
    const request = {
      ...(await baseRequest(await writePolicy(policy()))),
      tenant: 'other',
    };

    const result = await callProductionGateway(request);

    expect(result).toMatchObject({ ok: false });
    expect(mock.requests).toHaveLength(0);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('fails closed before dispatch when routing config is missing', async () => {
    const mock = await startMockProvider();
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', 'test-key');
    const request = await baseRequest('/definitely/missing/routing.json');

    const result = await callProductionGateway(request);

    expect(result).toMatchObject({ ok: false });
    expect(mock.requests).toHaveLength(0);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('falls back from an unreachable provider to the next provider', async () => {
    const mock = await startMockProvider('fallback ok');
    vi.stubEnv('BAD_BASE_URL', 'http://127.0.0.1:9/v1');
    vi.stubEnv('MOCK_BASE_URL', mock.baseUrl);
    vi.stubEnv('MOCK_API_KEY', 'test-key');
    vi.stubEnv('BAD_API_KEY', 'bad-key');
    const doc = policy('BAD_BASE_URL');
    doc.providers.secondary = {
      type: 'openai_compatible',
      base_url_env: 'MOCK_BASE_URL',
      api_key_env: 'MOCK_API_KEY',
    };
    const [route] = doc.routes;
    if (!route) throw new Error('missing route');
    route.fallback_chain = [{ provider: 'secondary', model_id: 'mock-model' }];

    const result = await callProductionGateway(
      await baseRequest(await writePolicy(doc)),
    );

    expect(result).toMatchObject({
      ok: true,
      provider: 'secondary',
      fallback_index: 1,
      content: 'fallback ok',
    });
    expect(mock.requests).toHaveLength(1);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('uses routing.prod.json for PI_PROVIDER=prod and sends correlation metadata', async () => {
    const mock = await startMockProvider('prod ok');
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');
    const request = {
      ...(await prodRequest()),
      task_id: 'task-123',
      agent_profile: 'profile-main',
    };

    const result = await callProductionGateway(request);

    expect(result).toMatchObject({
      ok: true,
      provider: 'litellm',
      model_id: 'worker-main',
      content: 'prod ok',
      estimated_cost: 0.0012,
      routing_decision: {
        route_id: 'acme-internal-summary-main',
        routing_policy_version: '2026-07-08.p8-prod',
      },
    });
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0]).toMatchObject({
      model: 'worker-main',
      metadata: {
        task_id: 'task-123',
        agent_profile: 'profile-main',
        tenant: 'acme',
        data_class: 'internal',
      },
    });
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('fails prod provider outages as llm_unavailable without deterministic fallback', async () => {
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', 'http://127.0.0.1:9/v1');
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

    const result = await callProductionGateway(await prodRequest());

    expect(result).toMatchObject({
      ok: false,
      reason: 'llm_unavailable',
      routing_decision: { route_id: 'acme-internal-summary-main' },
    });
    vi.unstubAllEnvs();
  });

  it('denies restricted data on the prod external provider path before dispatch', async () => {
    const mock = await startMockProvider();
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

    const result = await callProductionGateway({
      ...(await prodRequest()),
      data_classification: 'restricted',
    });

    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringContaining('restricted_external_provider'),
    });
    expect(mock.requests).toHaveLength(0);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('denies confidential prod external provider paths without approval before dispatch', async () => {
    const mock = await startMockProvider();
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

    const result = await callProductionGateway({
      ...(await prodRequest()),
      data_classification: 'confidential',
    });

    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringContaining('confidential_requires_approval'),
      routing_decision: { route_id: 'acme-confidential-summary-heavy' },
    });
    expect(mock.requests).toHaveLength(0);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('dispatches confidential prod external provider paths with approval', async () => {
    const mock = await startMockProvider('approved confidential ok');
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

    const result = await callProductionGateway({
      ...(await prodRequest()),
      data_classification: 'confidential',
      approval_ref: 'approval-123',
    });

    expect(result).toMatchObject({
      ok: true,
      provider: 'litellm',
      model_id: 'worker-heavy',
      content: 'approved confidential ok',
      routing_decision: {
        route_id: 'acme-confidential-summary-heavy',
        approval_ref: 'approval-123',
      },
    });
    expect(mock.requests).toHaveLength(1);
    await mock.close();
    vi.unstubAllEnvs();
  });

  it('keeps the default local provider path deterministic when PI_PROVIDER is local', async () => {
    vi.stubEnv('PI_PROVIDER', 'local');

    const result = await callProductionGateway(await prodRequest());

    expect(result).toMatchObject({
      ok: true,
      provider: 'local',
      model_id: 'fixbot',
      content: 'deterministic-fallback',
      routing_decision: { route_id: 'acme-internal-summary-fast' },
    });
    vi.unstubAllEnvs();
  });

  it('keeps routing.prod.json free of direct provider references and local fallback', () => {
    const prodPolicyText = readFileSync('policy/routing.prod.json', 'utf8');
    const prodPolicy = JSON.parse(prodPolicyText)
      .routing_prod as RoutingPolicyDocument;

    expect(prodPolicyText).not.toMatch(/openai|anthropic|vllm/i);
    expect(JSON.stringify(prodPolicy.routes)).not.toContain(
      'deterministic-fallback',
    );
    expect(prodPolicy.providers).toHaveProperty('litellm');
    expect(Object.keys(prodPolicy.providers).sort()).toEqual([
      'litellm',
      'local',
    ]);
  });
});
