"""Metadata-only LiteLLM callback for platform audit events."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

try:
    from litellm.integrations.custom_logger import CustomLogger
except Exception:  # pragma: no cover - litellm is intentionally optional here.

    class CustomLogger:  # type: ignore[no-redef]
        """Fallback base for repository tests without LiteLLM installed."""


DEFAULT_AUDIT_PATH = "artifacts/audit/llm_gateway_events.jsonl"
METADATA_KEYS = ("task_id", "agent_profile", "tenant", "data_class")


class PlatformAuditForwarder(CustomLogger):
    """Forward LiteLLM audit metadata without request or result bodies."""

    async def async_log_success_event(
        self,
        kwargs: dict[str, Any],
        result: Any,
        start_time: Any,
        end_time: Any,
    ) -> None:
        write_metadata_event(_event("success", kwargs, result, start_time, end_time))

    async def async_log_failure_event(
        self,
        kwargs: dict[str, Any],
        result: Any,
        start_time: Any,
        end_time: Any,
    ) -> None:
        write_metadata_event(_event("failure", kwargs, result, start_time, end_time))


def write_metadata_event(event: dict[str, Any], path: str | None = None) -> None:
    output_path = Path(path or os.environ.get("LITELLM_AUDIT_FORWARD_PATH", DEFAULT_AUDIT_PATH))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a", encoding="utf8") as handle:
        handle.write(json.dumps(_metadata_only(event), sort_keys=True) + "\n")


def _event(
    status: str,
    kwargs: dict[str, Any],
    result: Any,
    start_time: Any,
    end_time: Any,
) -> dict[str, Any]:
    return {
        "status": status,
        "model": kwargs.get("model"),
        "usage": _pick_mapping(_pick(result, "usage")) or _pick_mapping(kwargs.get("usage")),
        "cost": kwargs.get("cost") or kwargs.get("response_cost"),
        "latency_ms": _latency_ms(start_time, end_time),
        "metadata": _pick_mapping(kwargs.get("metadata")),
    }


def _metadata_only(event: dict[str, Any]) -> dict[str, Any]:
    usage = _pick_mapping(event.get("usage")) or {}
    metadata = _pick_mapping(event.get("metadata")) or {}
    return {
        "status": event.get("status"),
        "model": event.get("model"),
        "input_tokens": usage.get("prompt_tokens") or usage.get("input_tokens"),
        "output_tokens": usage.get("completion_tokens") or usage.get("output_tokens"),
        "total_tokens": usage.get("total_tokens"),
        "cost": event.get("cost"),
        "latency_ms": event.get("latency_ms"),
        "metadata": {key: metadata.get(key) for key in METADATA_KEYS if metadata.get(key)},
    }


def _pick(value: Any, key: str) -> Any:
    if isinstance(value, dict):
        return value.get(key)
    return getattr(value, key, None)


def _pick_mapping(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _latency_ms(start_time: Any, end_time: Any) -> int | None:
    try:
        return int((end_time - start_time).total_seconds() * 1000)
    except Exception:
        return None


platform_audit_forwarder = PlatformAuditForwarder()
