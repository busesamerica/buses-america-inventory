# Local testing

`test_quotes.py` exercises the quoting endpoints against a real Postgres and a running
API — create/update/validation, status transitions, expiry, acceptance and conversion
to sales, charge allocation, supersession, and the guards on accepted quotes.

`test_vin_decode.py` exercises `GET /api/vin-decode/{vin}` — the endpoint the
Add New Bus and Pre-Purchase Inspection forms call to auto-fill year/make/
model/engine/etc. from a VIN. Unlike every other test here, it needs
outbound internet access: it calls NHTSA's real, free vPIC API
(`vpic.nhtsa.dot.gov`), since there's no mocking infrastructure in this
project to stand in for it.

## Setup

`bus_inventory_schema_FINAL.sql` + `migrations/` (applied by `migrate.py`)
are now enough on their own to reproduce production's schema locally --
`clients`, `users`, and the accounting tables used to exist only in production
with nothing in this repo to recreate them; `migrations/000_core_tables.sql`
now captures the real versions of all of them. `dev_fixtures.sql` is just
local seed data now (a minimal chart of accounts), not a schema
reconstruction.

```bash
createdb buses_test
psql buses_test -f bus_inventory_schema_FINAL.sql

export DATABASE_URL=postgres://localhost/buses_test
python migrate.py    # applies migrations/, including 000_core_tables.sql

psql buses_test -f tests/dev_fixtures.sql
psql buses_test -f tests/seed_dev_data.sql

uvicorn backend_api_FINAL:app --port 8099 &

python tests/test_quotes.py
python tests/test_vin_decode.py
```

The seed creates the session token `TEST-TOKEN-123`, which the test uses to
authenticate. Re-run the reset steps between runs — the suite sells inventory.
