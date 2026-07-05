"""Python OSS data guard tests for SQLGlot, DuckDB, and Presidio."""
from __future__ import annotations

import pytest
import sqlglot

from scripts.data_guard import metric_query, reject_unsafe_sql


def test_metric_query_redacts_pii_and_rejects_unsafe_classes() -> None:
    """Aggregate query runs while PII and unsafe SQL classes are rejected."""
    result = metric_query()
    assert result.metric == "active_users_by_plan"
    assert result.piiDetected is True
    assert "alice@example.com" not in result.redactedText
    assert result.rejectedUnsafeSql is True
    assert result.rejectedMutationSql is True
    assert result.rejectedMultiStatementSql is True


@pytest.mark.parametrize(
    "sql",
    [
        "select name, email from customers",
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
        data_guard.sys.argv = ["data_guard.py", "unknown"]
        with pytest.raises(SystemExit):
            data_guard.main()
    finally:
        data_guard.sys.argv = old_argv
