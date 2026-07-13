# FORMAT-POLICY-CONFORMANCE learning

Reusable observation: `git diff --ignore-all-space --exit-code` may still report a pure blank-line deletion. For an EOF-only controlled normalization, combine the exact diff and EOF-byte inspection with equal staged/working hashes after removing whitespace. This proves that no semantic token changed without rewriting or reparsing the policy.

Disposition: recorded for task review only; no rule or skill promotion requested.
