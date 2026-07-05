"""Python OSS data guard tests for SQLGlot, DuckDB, and Presidio."""
from __future__ import annotations

import pytest
import sqlglot

from scripts.data_guard import (
    metric_query,
    offline_findings,
    redact_text,
    reject_unsafe_sql,
)


def detected_entities(text: str) -> set[str]:
    """Return entity types detected by the offline analyzer."""
    return {finding.entity_type for finding in offline_findings(text)}


def test_metric_query_redacts_pii_and_rejects_unsafe_classes() -> None:
    """Aggregate query runs while PII and unsafe SQL classes are rejected."""
    result = metric_query()
    assert result.metric == "active_users_by_plan"
    assert result.piiDetected is True
    assert "alice@example.com" not in result.redactedText
    assert result.rejectedUnsafeSql is True
    assert result.rejectedMutationSql is True
    assert result.rejectedMultiStatementSql is True


def test_redact_text_returns_offline_deterministic_redaction() -> None:
    """Free text redaction removes deterministic PII examples."""
    result = redact_text("Customer Alice Tanaka uses alice@example.com.")
    assert result["entities_found"] >= 2
    assert "alice@example.com" not in result["redacted_text"]
    assert "Alice Tanaka" not in result["redacted_text"]


@pytest.mark.parametrize(
    ("text", "entity"),
    [
        ("Contact jane.doe+test@example.com for access.", "EMAIL_ADDRESS"),
        ("Call support at +1 415-555-2671 before deploy.", "PHONE_NUMBER"),
        ("Use test card 4111 1111 1111 1111 for the dry run.", "CREDIT_CARD"),
        ("The source IP is 192.168.1.10.", "IP_ADDRESS"),
        ("Open https://example.com/login for the callback.", "URL"),
    ],
)
def test_offline_builtin_entities_are_detected(text: str, entity: str) -> None:
    """Offline recognizers detect built-in pattern/checksum entities."""
    assert entity in detected_entities(text)


@pytest.mark.parametrize(
    ("text", "entity"),
    [
        ("Contact jane dot doe at example dot com for access.", "EMAIL_ADDRESS"),
        ("Build 2024-07-05 passed in 12.3 seconds.", "PHONE_NUMBER"),
        ("Order number 4111 1111 1111 1112 is not a card.", "CREDIT_CARD"),
        ("Version 1.2.3 is deployed.", "IP_ADDRESS"),
        ("The callback path is /users/profile.", "URL"),
    ],
)
def test_offline_builtin_entities_avoid_guarded_false_positives(
    text: str, entity: str
) -> None:
    """Offline recognizers keep common non-PII tokens out of findings."""
    assert entity not in detected_entities(text)


def test_redact_text_covers_builtin_entities() -> None:
    """Free text redaction removes built-in deterministic PII entities."""
    result = redact_text(
        "Email jane.doe@example.com, call +1 415-555-2671, "
        "card 4111 1111 1111 1111, IP 192.168.1.10, "
        "URL https://example.com/login."
    )
    assert result["entities_found"] >= 5
    redacted = str(result["redacted_text"])
    assert "jane.doe@example.com" not in redacted
    assert "+1 415-555-2671" not in redacted
    assert "4111 1111 1111 1111" not in redacted
    assert "192.168.1.10" not in redacted
    assert "https://example.com/login" not in redacted


@pytest.mark.parametrize(
    "sql",
    [
        "select name, email from customers",
        "select phone, credit_card from customers",
        "select ip_address, url from customers",
        "delete from customers",
        "select plan from customers; select email from customers",
    ],
)
def test_reject_unsafe_sql(sql: str) -> None:
    """Unsafe SQL is rejected before DuckDB execution."""
    with pytest.raises(ValueError):
        reject_unsafe_sql(sql)


def test_accepts_safe_aggregate_sql_and_parser_failure() -> None:
    """Safe aggregate SQL passes while unparsable SQL fails closed."""
    reject_unsafe_sql(
        "select plan, count(*) as active_users from customers group by plan"
    )
    with pytest.raises(sqlglot.errors.ParseError):
        reject_unsafe_sql("select from")


def test_main_command_dispatch(capsys: pytest.CaptureFixture[str]) -> None:
    """CLI dispatch emits JSON for metric and rejects unknown commands."""
    from scripts import data_guard

    old_argv = data_guard.sys.argv[:]
    try:
        data_guard.sys.argv = ["data_guard.py", "metric"]
        assert data_guard.main() == 0
        assert "active_users_by_plan" in capsys.readouterr().out
        data_guard.sys.argv = ["data_guard.py", "redact_text"]
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(
            data_guard.sys,
            "stdin",
            type("Input", (), {"read": lambda self: '{"text":"alice@example.com"}'})(),
        )
        try:
            assert data_guard.main() == 0
            assert "alice@example.com" not in capsys.readouterr().out
        finally:
            monkeypatch.undo()
        data_guard.sys.argv = ["data_guard.py", "unknown"]
        with pytest.raises(SystemExit):
            data_guard.main()
    finally:
        data_guard.sys.argv = old_argv
