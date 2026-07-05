# Remediator Rejection Buffer

Rejected candidates are recorded here to prevent resubmitting the same failed instruction changes.

Record format:

```yaml
candidate_version: string
cycle: number
rejected_at: ISO8601
reason: string
evidence: path
anti_resubmission_key: string
```

The buffer is empty initially.
