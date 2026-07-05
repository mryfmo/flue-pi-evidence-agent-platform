# AutoSkill Input Contract

## Sources

`build_inputs.py` reads these orchestration evidence sources, in deterministic path order:

- `.orchestration/agmsg/history.jsonl`
- `.orchestration/reports/*.md`
- `.orchestration/acceptance/*.md`

## Redaction

Each file is redacted by calling the existing platform command:

```bash
.venv/bin/python scripts/data_guard.py redact_text
```

The pipeline fails closed if that subprocess exits non-zero. It does not implement a second PII detector.

## Outputs

For `--run-id <run-id>`, outputs are:

- `.orchestration/autoskill/inputs/<run-id>.manifest.json`
- redacted file copies under `.orchestration/autoskill/inputs/<run-id>/`

## Manifest Schema

```json
{
  "run_id": "string",
  "source_groups": ["agmsg_history", "reports", "acceptance"],
  "inputs": [
    {
      "source_path": "repo-relative source path",
      "redacted_path": "repo-relative redacted output path",
      "sha256_before": "hex sha256 of original UTF-8 text",
      "sha256_after": "hex sha256 of redacted UTF-8 text",
      "entities_found": 0,
      "redaction_passed": true
    }
  ]
}
```

Only redacted copies are valid AutoSkill extraction inputs.
