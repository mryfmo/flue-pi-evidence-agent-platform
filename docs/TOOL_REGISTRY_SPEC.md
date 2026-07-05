# Tool Registry Specification

Allowed side-effecting tools are represented in Rego and TypeScript contracts:
- `apply_patch`
- `verify_workspace`
- `metric_query`
- `rescan_workspace`

Denied tool classes:
- `shell`
- `raw_sql`
- unknown tools
- cross-tenant tools
- guest user tools

The Flue agent itself exposes only `explain_hypothesis`, which is non-side-effecting.
