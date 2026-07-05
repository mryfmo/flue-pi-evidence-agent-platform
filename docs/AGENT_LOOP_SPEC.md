# Agent Loop Specification

The agent loop is not a free-form autonomous loop. It is a gated sequence with explicit contracts.

1. Localize hypotheses from source evidence.
2. Record hypotheses in the ledger.
3. Ask OPA for a policy decision before side effects.
4. Generate multiple patch candidates per hypothesis.
5. Apply selected candidates.
6. Run verification.
7. Rescan source.
8. Run data guard.
9. Close only if all closure requirements are satisfied.
10. Ask Flue/Pi to summarize verified evidence.

The LLM path is restricted to summarization in this implementation. Tool execution is performed by typed tools controlled by the workflow, OPA, and verifiers.
