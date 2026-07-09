"""LiteLLM audit forwarder tests."""

from __future__ import annotations

import json

from config.litellm.platform_audit_forwarder import write_metadata_event


def test_writes_metadata_only_event(tmp_path) -> None:
    path = tmp_path / "events.jsonl"
    write_metadata_event(
        {
            "status": "success",
            "model": "worker-main",
            "usage": {
                "prompt_tokens": 4,
                "completion_tokens": 2,
                "total_tokens": 6,
            },
            "cost": 0.01,
            "latency_ms": 123,
            "metadata": {
                "task_id": "T1",
                "agent_profile": "main",
                "tenant": "acme",
                "data_class": "internal",
                "extra": "ignored",
            },
            "messages": [{"role": "user", "content": "secret prompt"}],
            "api_key": "secret-key",
        },
        str(path),
    )

    event = json.loads(path.read_text(encoding="utf8"))
    assert event == {
        "status": "success",
        "model": "worker-main",
        "input_tokens": 4,
        "output_tokens": 2,
        "total_tokens": 6,
        "cost": 0.01,
        "latency_ms": 123,
        "metadata": {
            "task_id": "T1",
            "agent_profile": "main",
            "tenant": "acme",
            "data_class": "internal",
        },
    }
    assert "secret" not in path.read_text(encoding="utf8")


def test_missing_metadata_is_nonfatal(tmp_path) -> None:
    path = tmp_path / "events.jsonl"
    write_metadata_event({"status": "failure"}, str(path))

    event = json.loads(path.read_text(encoding="utf8"))
    assert event["status"] == "failure"
    assert event["metadata"] == {}
