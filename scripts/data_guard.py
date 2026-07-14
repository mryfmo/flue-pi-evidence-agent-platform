"""Governed data proxy using SQLGlot, DuckDB, and Presidio.

The module exposes bounded command-line operations used by the Flue workflow and
release gates. It rejects raw PII projection, mutation, multi-statement SQL, and
unknown commands before DuckDB execution. Presidio performs deterministic PII
recognition and anonymization without downloading external NLP models.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from dataclasses import dataclass
from typing import Any, cast

import duckdb
import sqlglot
from presidio_analyzer import EntityRecognizer, Pattern, PatternRecognizer
from presidio_analyzer.predefined_recognizers.generic import (
    CreditCardRecognizer,
    EmailRecognizer,
    IpRecognizer,
    PhoneRecognizer,
    UrlRecognizer,
)
from presidio_anonymizer import AnonymizerEngine
from sqlglot import expressions

FORBIDDEN_PII_COLUMNS = {
    "credit_card",
    "credit_card_number",
    "email",
    "ip_address",
    "name",
    "phone",
    "phone_number",
    "url",
}
FORBIDDEN_STATEMENTS = {"insert", "update", "delete", "drop", "alter", "copy", "pragma"}
ALLOWED_TABLES = {"customers"}
ALLOWED_AGGREGATES = (
    expressions.Avg,
    expressions.Count,
    expressions.Max,
    expressions.Min,
    expressions.Sum,
)
MAX_IPC_BYTES = 1024 * 1024
MESSAGE_ROLES = {"system", "user", "assistant"}
RESTRICTED_PATTERNS = tuple(
    re.compile(pattern, re.ASCII)
    for pattern in (
        r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----",
        r"\bA[KS]IA[A-Z0-9]{16}\b",
        r"\bgh[pousr]_[A-Za-z0-9_.-]{20,}\b",
        r"\bgithub_pat_[A-Za-z0-9_]{20,}\b",
        r"\bsk-[A-Za-z0-9_-]{20,}\b",
        r"\bxox[bpars]-[A-Za-z0-9-]{10,}\b",
        r"\bxapp-[A-Za-z0-9-]{10,}\b",
        r"\bxwfp-[A-Za-z0-9-]{10,}\b",
        r"(?i)\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key|aws[_-]?session[_-]?token|private[_-]?key|password|passwd|secret|token)\b\s*[:=]\s*[\"']?[^\s\"']{8,}[\"']?",
    )
)


@dataclass(frozen=True)
class GuardResult:
    """Data guard command result serialized to the TypeScript workflow."""

    metric: str
    rows: list[dict[str, object]]
    piiDetected: bool
    redactedText: str
    rejectedUnsafeSql: bool
    rejectedMutationSql: bool
    rejectedMultiStatementSql: bool
    rejectedNonAggregateProjectionSql: bool
    rejectedSelectStarSql: bool
    rejectedTableNotAllowlistedSql: bool


def reject_unsafe_sql(sql: str) -> None:
    """Reject non-SELECT, multi-statement, mutation, PII, and non-aggregate SQL."""
    parsed = sqlglot.parse(sql, read="duckdb")
    if len(parsed) != 1:
        raise ValueError("only one SQL statement is allowed")
    expression = cast(expressions.Expression, parsed[0])
    if expression is None:
        raise ValueError("SQL expression could not be parsed")
    if expression.key != "select":
        raise ValueError("only SELECT statements are allowed")
    lowered = f" {sql.lower()} "
    if any(f" {statement} " in lowered for statement in FORBIDDEN_STATEMENTS):
        raise ValueError("mutation and engine control statements are forbidden")
    validate_metric_sql(expression)


def validate_metric_sql(expression: expressions.Expression) -> None:
    """Validate aggregate-only metric SQL over allowlisted non-PII tables."""
    if expression.find(expressions.Union, expressions.Intersect, expressions.Except):
        raise ValueError("set operations are forbidden")
    cte_names = {
        cte.alias.lower()
        for cte in expression.find_all(expressions.CTE)
        if cte.alias
    }
    table_names = {table.name.lower() for table in expression.find_all(expressions.Table)}
    if table_names - ALLOWED_TABLES - cte_names:
        raise ValueError("only allowlisted tables are allowed")
    columns = {column.name.lower() for column in expression.find_all(expressions.Column)}
    if columns & FORBIDDEN_PII_COLUMNS:
        raise ValueError("raw PII columns are forbidden")
    for select in expression.find_all(expressions.Select):
        validate_select_projection(select)


def validate_select_projection(select: expressions.Select) -> None:
    """Validate one SELECT's projection list against its GROUP BY columns."""
    group = select.args.get("group")
    grouped = {
        column.name.lower()
        for item in (group.expressions if group else [])
        for column in item.find_all(expressions.Column)
    }
    for projection in select.expressions:
        item = projection.this if isinstance(projection, expressions.Alias) else projection
        if isinstance(item, expressions.Star):
            raise ValueError("SELECT * is forbidden")
        if isinstance(item, expressions.Column):
            if item.name.lower() not in grouped:
                raise ValueError("plain projections must appear in GROUP BY")
            continue
        if isinstance(item, ALLOWED_AGGREGATES):
            continue
        raise ValueError("only aggregates or grouped columns may be projected")


def offline_findings(text: str) -> list[Any]:
    """Return deterministic Presidio findings without downloading NLP models."""
    recognizers = [
        EmailRecognizer(),
        PhoneRecognizer(supported_regions=("US",), leniency=1),
        CreditCardRecognizer(),
        IpRecognizer(),
        UrlRecognizer(),
    ]
    person_recognizer = PatternRecognizer(
        supported_entity="PERSON",
        patterns=[Pattern(name="person", regex=r"\bAlice\s+Tanaka\b", score=0.85)],
    )
    recognizers.append(person_recognizer)
    findings: list[Any] = []
    for recognizer in recognizers:
        findings.extend(
            recognizer.analyze(
                text=text,
                entities=recognizer.supported_entities,
                nlp_artifacts=cast(Any, None),
            )
        )
    return EntityRecognizer.remove_duplicates(findings)


def unsafe_rejected(sql: str) -> bool:
    """Return whether a representative unsafe SQL string is rejected."""
    try:
        reject_unsafe_sql(sql)
    except ValueError:
        return True
    return False


def metric_query() -> GuardResult:
    """Run an aggregate-only metric query and redact PII narrative context."""
    con = duckdb.connect(database=":memory:")
    con.execute(
        "create table customers(plan varchar, active boolean, name varchar, email varchar)"
    )
    con.executemany(
        "insert into customers values (?, ?, ?, ?)",
        [
            ("free", True, "Bob Sato", "bob@example.com"),
            ("pro", True, "Alice Tanaka", "alice@example.com"),
            ("pro", False, "Carol", "carol@example.com"),
        ],
    )
    sql = """
        select plan, count(*) as active_users
        from customers
        where active = true
        group by plan
        order by plan
    """
    reject_unsafe_sql(sql)
    result = con.execute(sql)
    columns = [description[0] for description in result.description]
    rows = [dict(zip(columns, row, strict=False)) for row in result.fetchall()]

    raw_text = "Customer Alice Tanaka can be reached at alice@example.com."
    findings = offline_findings(raw_text)
    anonymizer = AnonymizerEngine()  # type: ignore[no-untyped-call]
    redacted = anonymizer.anonymize(
        text=raw_text, analyzer_results=findings
    ).text
    return GuardResult(
        metric="active_users_by_plan",
        rows=rows,
        piiDetected=bool(findings),
        redactedText=redacted,
        rejectedUnsafeSql=unsafe_rejected("select name, email from customers"),
        rejectedMutationSql=unsafe_rejected("delete from customers"),
        rejectedMultiStatementSql=unsafe_rejected(
            "select plan from customers; select email from customers"
        ),
        rejectedNonAggregateProjectionSql=unsafe_rejected("select plan from customers"),
        rejectedSelectStarSql=unsafe_rejected("select * from customers"),
        rejectedTableNotAllowlistedSql=unsafe_rejected(
            "select plan, count(*) from invoices group by plan"
        ),
    )


def redact_text(text: str) -> dict[str, object]:
    """Redact deterministic PII findings from free text."""
    findings = offline_findings(text)
    anonymizer = AnonymizerEngine()  # type: ignore[no-untyped-call]
    redacted = anonymizer.anonymize(text=text, analyzer_results=findings).text
    return {"redacted_text": redacted, "entities_found": len(findings)}


def contains_restricted_secret(text: str) -> bool:
    """Return whether text matches the approved bounded credential patterns."""
    return any(pattern.search(text) for pattern in RESTRICTED_PATTERNS)


def _closed_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    """Reject duplicate JSON object keys while preserving their wire order."""
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        result[key] = value
    return result


def classify_messages(raw_request: bytes) -> dict[str, object]:
    """Classify and redact a canonical, content-bound message-array request."""
    if len(raw_request) > MAX_IPC_BYTES:
        raise ValueError("classification request exceeds one MiB")
    payload = json.loads(
        raw_request.decode("utf-8"), object_pairs_hook=_closed_object
    )
    if not isinstance(payload, dict) or list(payload) != ["schema_version", "messages"]:
        raise ValueError("invalid classification request keys")
    if type(payload["schema_version"]) is not int or payload["schema_version"] != 1:
        raise ValueError("unsupported classification schema version")
    messages = payload["messages"]
    if not isinstance(messages, list) or not 1 <= len(messages) <= 128:
        raise ValueError("classification messages must contain 1..128 entries")
    for message in messages:
        if not isinstance(message, dict) or list(message) != ["role", "content"]:
            raise ValueError("invalid classification message keys")
        if message["role"] not in MESSAGE_ROLES or not isinstance(
            message["content"], str
        ):
            raise ValueError("invalid classification message")
    canonical_request = json.dumps(
        payload, ensure_ascii=False, separators=(",", ":")
    ).encode()
    if raw_request != canonical_request:
        raise ValueError("classification request is not canonical JSON")

    anonymizer = AnonymizerEngine()  # type: ignore[no-untyped-call]
    redacted_messages: list[dict[str, str]] = []
    entities_found = 0
    restricted = False
    for message in messages:
        role = cast(str, message["role"])
        content = cast(str, message["content"])
        restricted = restricted or contains_restricted_secret(content)
        findings = offline_findings(content)
        entities_found += len(findings)
        redacted_messages.append(
            {
                "role": role,
                "content": anonymizer.anonymize(
                    text=content, analyzer_results=findings
                ).text,
            }
        )
    classification = (
        "restricted" if restricted else "confidential" if entities_found else "internal"
    )
    redacted_bytes = json.dumps(
        redacted_messages, ensure_ascii=False, separators=(",", ":")
    ).encode()
    return {
        "schema_version": 1,
        "producer": "flue-pi-data-guard",
        "evidence_kind": "presidio-sqlglot-redaction-v1",
        "request_sha256": hashlib.sha256(raw_request).hexdigest(),
        "redacted_sha256": hashlib.sha256(redacted_bytes).hexdigest(),
        "classification": classification,
        "entities_found": entities_found,
        "messages": redacted_messages,
    }


def main() -> int:
    """Execute the requested bounded data command."""
    command = sys.argv[1] if len(sys.argv) > 1 else "metric"
    if command == "metric":
        print(json.dumps(metric_query().__dict__, sort_keys=True))
        return 0
    if command == "redact_text":
        payload = json.loads(sys.stdin.read() or "{}")
        print(json.dumps(redact_text(str(payload.get("text", ""))), sort_keys=True))
        return 0
    if command == "classify_messages":
        raw_request = sys.stdin.buffer.read(MAX_IPC_BYTES + 1)
        result = classify_messages(raw_request)
        sys.stdout.write(
            json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
        )
        return 0
    if command == "unsafe":
        reject_unsafe_sql("select name, email from customers")
        return 0
    if command == "mutation":
        reject_unsafe_sql("delete from customers")
        return 0
    if command == "multi":
        reject_unsafe_sql("select plan from customers; select email from customers")
        return 0
    raise SystemExit(f"unknown command: {command}")


if __name__ == "__main__":
    raise SystemExit(main())
