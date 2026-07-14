"""Python OSS data guard tests for SQLGlot, DuckDB, and Presidio."""
from __future__ import annotations

import hashlib
import json

import pytest
import sqlglot

from scripts.data_guard import (
    classify_messages,
    contains_restricted_secret,
    metric_query,
    offline_findings,
    redact_text,
    reject_unsafe_sql,
)


def classification_request(messages: list[dict[str, str]]) -> bytes:
    """Return the canonical IPC request bytes used by the gateway."""
    return json.dumps(
        {"schema_version": 1, "messages": messages},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()


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
    assert result.rejectedNonAggregateProjectionSql is True
    assert result.rejectedSelectStarSql is True
    assert result.rejectedTableNotAllowlistedSql is True


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
    reject_unsafe_sql(
        "select plan, active, count(*) as users, max(plan) as max_plan "
        "from customers group by plan, active order by plan"
    )
    with pytest.raises(sqlglot.errors.ParseError):
        reject_unsafe_sql("select from")


@pytest.mark.parametrize(
    "sql",
    [
        "select plan from customers",
        "select * from customers",
        "select plan, count(*) from customers where email = 'a@example.com' group by plan",
        "select plan, count(*) from customers where id in "
        "(select id from customers where email = 'a@example.com') group by plan",
        "select plan, count(*) from customers group by plan "
        "union select plan, count(*) from customers group by plan",
        "select plan, count(*) from invoices group by plan",
        "select plan, count(*) from customers group by plan having max(email) is not null",
    ],
)
def test_rejects_non_aggregate_or_out_of_policy_sql(sql: str) -> None:
    """Structural validator rejects unsafe metric-query shapes."""
    with pytest.raises(ValueError):
        reject_unsafe_sql(sql)


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


@pytest.mark.parametrize(
    ("valid", "short", "lookalike"),
    [
        (
            "-----BEGIN ENCRYPTED PRIVATE KEY-----",
            "-----BEGIN ENCRYPTED PRIVATE KEY----",
            "-----BEGIN ENCRYPTED PUBLIC KEY-----",
        ),
        ("AKIA1234567890ABCDEF", "AKIA1234567890ABCDE", "AOIA1234567890ABCDEF"),
        ("ghp_12345678901234567890", "ghp_1234567890123456789", "ghx_12345678901234567890"),
        (
            "github_pat_12345678901234567890",
            "github_pat_1234567890123456789",
            "github_pot_12345678901234567890",
        ),
        ("sk-12345678901234567890", "sk-1234567890123456789", "sx-12345678901234567890"),
        ("xoxb-1234567890", "xoxb-123456789", "xoxo-1234567890"),
        ("xapp-1234567890", "xapp-123456789", "xapps-1234567890"),
        ("xwfp-1234567890", "xwfp-123456789", "xwfx-1234567890"),
        ("api_key=12345678", "api_key=1234567", "api_keq=12345678"),
    ],
)
def test_restricted_patterns_have_exact_boundaries(
    valid: str, short: str, lookalike: str
) -> None:
    """Each approved family matches its lower bound and no close look-alike."""
    assert contains_restricted_secret(valid)
    assert contains_restricted_secret(f"({valid}),")
    assert not contains_restricted_secret(short)
    assert not contains_restricted_secret(lookalike)


def test_classify_messages_binds_raw_and_redacted_payloads() -> None:
    """The guard classifies raw messages and binds both exact byte sequences."""
    messages = [
        {"role": "system", "content": "Use verified evidence only."},
        {"role": "user", "content": "Contact alice@example.com"},
    ]
    request = classification_request(messages)

    result = classify_messages(request)

    assert list(result) == [
        "schema_version",
        "producer",
        "evidence_kind",
        "request_sha256",
        "redacted_sha256",
        "classification",
        "entities_found",
        "messages",
    ]
    assert result["classification"] == "confidential"
    assert result["request_sha256"] == hashlib.sha256(request).hexdigest()
    redacted_bytes = json.dumps(
        result["messages"], ensure_ascii=False, separators=(",", ":")
    ).encode()
    assert result["redacted_sha256"] == hashlib.sha256(redacted_bytes).hexdigest()
    assert [message["role"] for message in result["messages"]] == ["system", "user"]
    assert "alice@example.com" not in str(result["messages"])


@pytest.mark.parametrize(
    ("contents", "expected"),
    [
        (["Summarize the verified evidence."], "internal"),
        (["Contact alice@example.com"], "confidential"),
        (["api_key=12345678secret"], "restricted"),
        (
            ["ordinary internal text", "alice@example.com", "sk-12345678901234567890"],
            "restricted",
        ),
    ],
)
def test_classify_messages_aggregates_maximum_raw_sensitivity(
    contents: list[str], expected: str
) -> None:
    """Restricted wins over Presidio and the guard never emits public."""
    messages = [
        {"role": "user", "content": content}
        for content in contents
    ]
    assert classify_messages(classification_request(messages))["classification"] == expected


@pytest.mark.parametrize(
    "raw",
    [
        b'{"schema_version":1,"schema_version":1,"messages":[]}',
        b'{"schema_version":1,"messages":[],"extra":true}',
        b'{"schema_version":1}',
        b'{"messages":[],"schema_version":1}',
        b'{"schema_version":2,"messages":[]}',
        b'{"schema_version":1,"messages":[]}',
        b'{"schema_version":1,"messages":[{"role":"user","content":"x","extra":1}]}',
        b'{"schema_version":1,"messages":[{"role":"user","role":"system","content":"x"}]}',
        b'{"schema_version":1,"messages":[{"content":"x","role":"user"}]}',
        b'{"schema_version":1,"messages":[{"role":"tool","content":"x"}]}',
        b'{"schema_version":1,"messages":[{"role":"user","content":1}]}',
        b'\xff',
    ],
)
def test_classify_messages_rejects_noncanonical_or_malformed_requests(raw: bytes) -> None:
    """Every malformed request shape fails closed before classification."""
    with pytest.raises((TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError)):
        classify_messages(raw)


def test_classify_messages_enforces_count_and_byte_bounds() -> None:
    """The guard enforces the 1..128 message and one MiB IPC limits."""
    too_many = [{"role": "user", "content": "x"}] * 129
    with pytest.raises(ValueError):
        classify_messages(classification_request(too_many))
    oversized = classification_request(
        [{"role": "user", "content": "x" * (1024 * 1024)}]
    )
    with pytest.raises(ValueError):
        classify_messages(oversized)
