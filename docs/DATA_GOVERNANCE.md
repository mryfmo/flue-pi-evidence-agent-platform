# Data Governance

The data path is aggregate-only and governed by SQLGlot, DuckDB, and Presidio.

Controls:
- SQLGlot parses and validates exactly one SELECT statement.
- DML, DDL, engine control statements, multi-statement SQL, and raw PII columns are rejected.
- DuckDB executes only the accepted aggregate query.
- Presidio recognizes and anonymizes deterministic PII examples.
- The returned data result includes booleans proving unsafe classes were rejected.

Offline PII coverage:
- `EMAIL_ADDRESS`, `PHONE_NUMBER`, `CREDIT_CARD`, `IP_ADDRESS`, and `URL` use Presidio built-in pattern/checksum recognizers without NLP model downloads.
- `PERSON` remains a deterministic custom recognizer for the local evidence fixture.
- Credit card detection uses Luhn validation, so invalid 16-digit order numbers are not flagged.
- Raw projections of related columns such as `phone`, `credit_card`, `ip_address`, and `url` are rejected before DuckDB execution.
