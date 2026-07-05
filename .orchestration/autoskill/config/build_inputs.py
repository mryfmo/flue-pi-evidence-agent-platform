#!/usr/bin/env python3
"""Build redacted AutoSkill input bundles from orchestration evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
INPUT_ROOT = REPO_ROOT / ".orchestration" / "autoskill" / "inputs"


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def source_paths() -> list[Path]:
    sources = [REPO_ROOT / ".orchestration" / "agmsg" / "history.jsonl"]
    for folder in ("reports", "acceptance"):
        sources.extend(sorted((REPO_ROOT / ".orchestration" / folder).glob("*.md")))
    return [path for path in sources if path.is_file()]


def redact(text: str) -> dict[str, object]:
    child = subprocess.run(
        [str(REPO_ROOT / ".venv" / "bin" / "python"), "scripts/data_guard.py", "redact_text"],
        cwd=REPO_ROOT,
        input=json.dumps({"text": text}),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if child.returncode != 0:
        raise SystemExit(child.stderr.strip() or f"redaction failed: exit {child.returncode}")
    return json.loads(child.stdout)


def build(run_id: str) -> dict[str, object]:
    if not run_id.strip():
        raise SystemExit("--run-id is required")
    run_dir = INPUT_ROOT / run_id
    manifest_path = INPUT_ROOT / f"{run_id}.manifest.json"
    if run_dir.exists():
        shutil.rmtree(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)

    inputs = []
    for source in source_paths():
        relative = source.relative_to(REPO_ROOT)
        original = source.read_text(encoding="utf-8")
        result = redact(original)
        redacted = str(result.get("redacted_text", ""))
        output = run_dir / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(redacted, encoding="utf-8")
        inputs.append(
            {
                "source_path": str(relative),
                "redacted_path": str(output.relative_to(REPO_ROOT)),
                "sha256_before": sha256_text(original),
                "sha256_after": sha256_text(redacted),
                "entities_found": int(result.get("entities_found", 0)),
                "redaction_passed": True,
            }
        )

    manifest = {
        "run_id": run_id,
        "source_groups": ["agmsg_history", "reports", "acceptance"],
        "inputs": inputs,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.run_id), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
