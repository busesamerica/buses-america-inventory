# Buses America - Inventory Management System

Complete inventory management system for Buses America's cross-border bus sales operations.

## Features
- Multi-currency support (USD/MXN)
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

### Database migration

Everything in `migrations/` is applied in filename order by `migrate.py` (not just the
quoting module -- despite the `/admin/migrate-quotes` name below, it now also covers
users, clients and the accounting tables via `000_core_tables.sql`), which runs on each
deploy via `render.yaml`. All of it is idempotent. To apply by hand:

    DATABASE_URL=postgres://... python migrate.py

An admin can also POST to `/admin/migrate-quotes`.
