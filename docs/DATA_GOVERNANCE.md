# Data Governance

The data path is aggregate-only and governed by SQLGlot, DuckDB, and Presidio.

Controls:
- SQLGlot parses and validates exactly one SELECT statement.
- DML, DDL, engine control statements, multi-statement SQL, and raw PII columns are rejected.
- DuckDB executes only the accepted aggregate query.
- Presidio recognizes and anonymizes deterministic PII examples.
- The returned data result includes booleans proving unsafe classes were rejected.
