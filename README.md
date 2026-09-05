# Buses America - Business Management System

Complete business management system for Buses America's cross-border bus sales
operations - inventory, sales, clients, quotes, and accounting.

## Features
- Multi-currency support (USD/MXN)
- VIN auto-decode (year/make/model/engine/etc. via NHTSA vPIC) on registration
- Pre-purchase inspections
- Work plan tracking
- Warranty management
- Photo uploads
- Real-time dashboard
- Complete API endpoints
- Client quoting with conversion to sales

## Tech Stack
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL
- **Hosting:** Render.com (FREE)

## Brand Colors
- Yellow: #FFD700
- Black: #1a1a1a, #000000
- White: #FFFFFF

## Deployment
Automatically deploys to Render.com via GitHub.

## Company
Buses America
30 Years of Excellence
"Juntos Movemos América"

www.busesamerica.com

## Quoting

Quotes live under **Quotes** in the sidebar. A quote is a header (client, currency,
validity, terms) plus line items: units drawn from inventory, and ad-hoc charges such
as transport, import/customs or discounts (a negative amount).

Lifecycle: `Draft -> Sent -> Accepted | Rejected | Expired | Cancelled`.
Sent quotes past their valid-until date are marked Expired automatically.

Accepting a quote records a real sale for every unit on it (through the same
`/api/sales/record` path used by Sales Management, so revenue and COGS postings are
identical), links those units back to the quote, and cancels any other open quote
holding the same units. Charges, tax and discount are spread across the units by
default so recorded revenue equals the quote total; choosing "unit prices only" at
acceptance records each unit at its line price instead.

`View` opens the client-facing **Cotización** — a Spanish document on Buses America
letterhead, laid out to match the company quote template: contact block, `COTIZACIÓN #
/ FECHA / VÁLIDA HASTA` strip, a `CLIENTE` / `DATOS DEL AUTOBÚS` split, the price
breakdown, `NOTAS Y CONDICIONES` opposite `ELABORADO POR`, and a signature block. Use
the browser's *Save as PDF* to send it to a client.

A quote carrying a single unit shows the full spec panel (marca, modelo, año, color,
kilómetros, pasajeros, motor, transmisión, VIN, condición). Two or more units swap that
panel for a `UNIDADES` table, since a spec panel per unit would not fit the page. Those
specs are snapshotted onto the quote line when it is created, so reprinting an old quote
shows the unit as it was described then, not as inventory describes it now.

Company letterhead and footer details live in the `BA_COMPANY` object at the top of
`frontend/QuoteDocument.jsx`. The `ELABORADO POR` block is per quote instead — each
seller's name, phone and email are set in the quote editor, default to whoever is signed
in, and are stored on the quote so a reprint always shows who issued it.

## Security

- Every `/api/*` and `/admin/*` endpoint except `POST /api/auth/login` and the
  public exchange-rate lookups now requires a valid session token
  (`Authorization: Bearer <session_token>`, obtained from `/api/auth/login`).
  Some write endpoints require the `manager` or `admin` role specifically —
  see `require_manager_or_admin` / `require_admin` in `backend_api_FINAL.py`.
- CORS is restricted to the origins listed in the `ALLOWED_ORIGINS` env var
  (comma-separated). It defaults to `localhost` only if unset — set it to
  your real frontend URL(s) in production instead of leaving it unset.
- `/api/auth/login` throttles repeated failures per username+IP (5 attempts /
  15 minutes) to slow down credential-stuffing and brute-force attempts.
- Photo uploads are limited to `.jpg/.jpeg/.png/.gif/.webp`, capped at 10MB,
  and stored under a server-generated filename — the client-supplied filename
  is never used to build the on-disk path, which prevents path traversal.
- Password hashes use PBKDF2-HMAC-SHA256 with a per-hash iteration count
  embedded in the stored value, so the work factor can be raised again later
  without invalidating existing users' passwords.

### Database migration

Everything in `migrations/` is applied in filename order by `migrate.py` (not just the
quoting module -- it now also covers users, clients and the accounting tables via
`000_core_tables.sql`), which runs on each deploy via `render.yaml`. All of it is
idempotent. To apply by hand:

    DATABASE_URL=postgres://... python migrate.py

An admin can also POST to `/admin/migrate`.
