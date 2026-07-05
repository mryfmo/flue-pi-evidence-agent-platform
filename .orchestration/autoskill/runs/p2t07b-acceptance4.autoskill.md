autoskill: infrastructure_only

- pinned_commit: `94c47ca488d4ba4117d20272e66d49b9877e68cf`
- provider_mode: `codex`
- input_manifest: `.orchestration/autoskill/inputs/p2t07a-dryinput.manifest.json`
- output_dir: `.orchestration/autoskill/outputs/p2t07b-acceptance4/`
- redaction_passed: true
- promotion_allowed: false
- decisions: discard=0 improve=0 merge=0 create=0 version_update=0
- generated_candidates:
  - `.orchestration/skills/candidates/SKILL.md`
