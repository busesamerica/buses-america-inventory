# Local testing

`test_quotes.py` exercises the quoting endpoints against a real Postgres and a running
API — create/update/validation, status transitions, expiry, acceptance and conversion
to sales, charge allocation, supersession, and the guards on accepted quotes.

## Setup

The production database contains tables (`clients`, `users`, accounting) that were
created outside this repository, so `bus_inventory_schema_FINAL.sql` alone is not
enough to run the API locally. `dev_fixtures.sql` reconstructs the minimum needed;
it is **for local testing only** and is not the production schema.

Note that `bus_inventory_schema_FINAL.sql` as committed cannot be applied to a modern
Postgres: the `days_in_inventory` and `days_in_warranty` generated columns use
`CURRENT_DATE`, which is not immutable, so `CREATE TABLE inventory` fails. Replace
those two columns with plain `INTEGER` columns locally to load it.

```bash
createdb buses_test
psql buses_test -f bus_inventory_schema_FINAL.sql     # see note above
psql buses_test -f tests/dev_fixtures.sql
psql buses_test -f tests/seed_dev_data.sql

export DATABASE_URL=postgres://localhost/buses_test
python migrate_quotes.py
uvicorn backend_api_FINAL:app --port 8099 &

python tests/test_quotes.py
```

The seed creates the session token `TEST-TOKEN-123`, which the test uses to
authenticate. Re-run the reset steps between runs — the suite sells inventory.
