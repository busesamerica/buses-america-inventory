"""
Dashboard briefing text, composed from data the app already computes -
no external API, no cost, nothing to configure.

Picks the single most useful thing to flag today rather than reciting
every number, ranked by real business stakes (highest first):

  1. The highest-value quote expiring within a week - direct revenue on
     a hard deadline; losing a sale outranks everything else here.
  2. A unit whose warranty ends within a week - customer-facing cost/
     relationship risk if a claim gets missed.
  3. A unit sitting notably longer than average - tied-up capital and a
     pricing-review candidate, but not time-boxed like the two above.
  4. Nothing urgent: falls back to a one-line pipeline/cash status so
     the card is never empty, just calmer on a calm day.

Only the winning tier's data is used; there's no partial-credit blending
of tiers into one sentence, so the message stays a single clear headline.
"""


def _fmt_money(amount, currency="USD"):
    if amount is None:
        return "—"
    prefix = "$" if currency == "USD" else "MXN $"
    return f"{prefix}{amount:,.2f}"


def _plural(n, word):
    return word if n == 1 else f"{word}s"


def build_briefing(context: dict) -> str:
    inv = context.get("inventory", {})
    quotes = context.get("quotes", {})
    cash = context.get("cash", {})
    expiring_quotes = quotes.get("expiring_soon") or []
    expiring_warranties = context.get("warranty_expiring_soon") or []
    stalest = context.get("stalest_units") or []

    # float(): Postgres's AVG() of an integer column comes back through
    # asyncpg as a Decimal, and Decimal * a float literal raises TypeError -
    # Decimal only mixes with int, not float. Every other number here is
    # already a plain float (get_dashboard() etc. cast explicitly); this is
    # the one value that wasn't.
    avg_days = inv.get("avg_days_in_inventory")
    avg_days = float(avg_days) if avg_days is not None else None

    # 1. Highest-value quote expiring soon.
    if expiring_quotes:
        top_quote = max(expiring_quotes, key=lambda q: float(q["total_amount"]))
        return (
            f"Follow up on quote {top_quote['quote_number']} for {top_quote['client_name']} "
            f"({_fmt_money(top_quote['total_amount'], top_quote['currency'])}) - "
            f"it expires {top_quote['valid_until']}."
        )

    # 2. Warranty ending soon (earliest first, already the query's own order).
    if expiring_warranties:
        w = expiring_warranties[0]
        return (
            f"Warranty on {w['stock_number']} ({w['year']} {w['make']} {w['model']}) "
            f"ends {w['warranty_end_date']} - last chance to catch any claims."
        )

    # 3. A unit meaningfully slower than average (not just nominally above it).
    if stalest and avg_days:
        top = stalest[0]
        days = top["days_in_inventory"]
        if days >= avg_days * 1.5:
            return (
                f"Unit {top['stock_number']} ({top['year']} {top['make']} {top['model']}) has been "
                f"in inventory {days} days - {days / avg_days:.1f}x the {avg_days:.0f}-day average - "
                f"worth a price review."
            )

    # 4. Nothing urgent - a calm one-line status instead of silence.
    open_count = quotes.get("open_count", 0)
    if open_count:
        win_rate = quotes.get("win_rate")
        win_text = f", {win_rate}% win rate" if win_rate is not None else ""
        return (
            f"Nothing urgent today. {open_count} open {_plural(open_count, 'quote')} worth "
            f"{_fmt_money(quotes.get('open_value_usd'))} + {_fmt_money(quotes.get('open_value_mxn'), 'MXN')}"
            f"{win_text}, cash on hand {_fmt_money(cash.get('usd'))} + {_fmt_money(cash.get('mxn'), 'MXN')}."
        )

    available = inv.get("available_for_sale", 0)
    return (
        f"Nothing urgent today. {available} {_plural(available, 'unit')} available to sell, "
        f"cash on hand {_fmt_money(cash.get('usd'))} + {_fmt_money(cash.get('mxn'), 'MXN')}."
    )
