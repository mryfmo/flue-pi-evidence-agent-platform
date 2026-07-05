import { evaluatePolicy } from './opa.ts';
import type { PolicyDecision } from './types.ts';

export interface RoutingInput {
  tenant: string;
  data_classification: string;
  task_kind: string;
  cost_budget: string;
  latency_target: string;
}

export interface RouteTarget {
  provider: string;
  model_id: string;
  mode?: string;
}

export interface RoutingRoute extends RouteTarget {
  id: string;
  match: RoutingInput;
  fallback_chain: RouteTarget[];
}

export interface RoutingProvider {
  type: string;
  api_key_env?: string;
  base_url_env?: string;
}

export interface RoutingPolicyDocument {
  version: string;
  defaults: {
    fallback_chain: RouteTarget[];
  };
  routes: RoutingRoute[];
  providers: Record<string, RoutingProvider>;
}

export interface RouteDecision extends RoutingInput, RouteTarget {
  route_id: string;
  routing_policy_version: string;
  fallback_chain: RouteTarget[];
}

export function selectRoute(
  input: RoutingInput,
  policy: RoutingPolicyDocument,
): RouteDecision {
  const route = policy.routes.find((candidate) =>
    (Object.keys(input) as Array<keyof RoutingInput>).every(
      (key) => candidate.match[key] === input[key],
    ),
  );
  const target = route ?? policy.defaults.fallback_chain[0];
  if (!target)
    throw new Error('routing policy default fallback_chain is empty');
  const decision: RouteDecision = {
    ...input,
    route_id: route?.id ?? 'default',
    routing_policy_version: policy.version,
    provider: target.provider,
    model_id: target.model_id,
    fallback_chain: route?.fallback_chain ?? policy.defaults.fallback_chain,
  };
  if (target.mode) decision.mode = target.mode;
  return decision;
}

export function authorizeRoute(
  decision: RouteDecision,
  policy: RoutingPolicyDocument,
): Promise<PolicyDecision> {
  return evaluatePolicy(
    { decision, policy },
    'policy/routing.rego',
    'data.eap.routing',
  );
}
