"""Governed data proxy using SQLGlot, DuckDB, and Presidio.

The module exposes bounded command-line operations used by the Flue workflow and
release gates. It rejects raw PII projection, mutation, multi-statement SQL, and
unknown commands before DuckDB execution. Presidio performs deterministic PII
recognition and anonymization without downloading external NLP models.
"""
from __future__ import annotations

import json
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
