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

`View` opens a branded, printable quote — use the browser's *Save as PDF* to send it
to a client.

### Database migration

The quoting tables are created by `migrations/001_quotes.sql`, applied on deploy via
`migrate_quotes.py` (wired into `render.yaml`). It is idempotent. To apply it by hand:

    DATABASE_URL=postgres://... python migrate_quotes.py

An admin can also POST to `/admin/migrate-quotes`.
