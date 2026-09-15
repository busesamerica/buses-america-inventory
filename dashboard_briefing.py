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

Copy follows Ogilvy's rules for a one-line headline, not just a data
dump: lead with the concrete number (the stake, not the mechanism), use
plain active verbs, cut every word that isn't pulling weight, and end
on a specific next action rather than a vague adjective ("worth a
look"). "In 3 days" reads more urgent than "2026-09-19", so every date
is converted to that phrasing before it hits a sentence.
"""

from datetime import date as _date, datetime as _datetime


def _fmt_money(amount, currency="USD"):
    if amount is None:
        return "—"
    prefix = "$" if currency == "USD" else "MXN $"
    # Whole dollars, not cents - a headline number should be clean and
    # quotable ("$27,000"), not "$27,000.00". Precise figures already
    # live in Quotes/Accounting; this is the attention-grabber, not the
    # ledger.
    return f"{prefix}{amount:,.0f}"


def _plural(n, word):
    return word if n == 1 else f"{word}s"


def _as_date(value):
    """Coerce a Postgres DATE (asyncpg hands back date/datetime) or an
    ISO string into a plain date, defensively - whichever it is."""
    if isinstance(value, _datetime):
        return value.date()
    if isinstance(value, _date):
        return value
    try:
        return _date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _when(value):
    """'today' / 'tomorrow' / 'in N days' - reads as a deadline, not a
    date stamp you have to do math on."""
    d = _as_date(value)
    if d is None:
        return f"on {value}"
    days = (d - _date.today()).days
    if days <= 0:
        return "today"
    if days == 1:
        return "tomorrow"
    return f"in {days} days"


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

    # 1. Highest-value quote expiring soon: lead with the money at stake.
    if expiring_quotes:
        top_quote = max(expiring_quotes, key=lambda q: float(q["total_amount"]))
        amount = _fmt_money(top_quote["total_amount"], top_quote["currency"])
        return (
            f"{amount} on the line: {top_quote['client_name']}'s quote expires "
            f"{_when(top_quote['valid_until'])}. Follow up before it's gone."
        )

    # 2. Warranty ending soon (earliest first, already the query's own order).
    if expiring_warranties:
        w = expiring_warranties[0]
        return (
            f"{w['year']} {w['make']} {w['model']} ({w['stock_number']}): warranty closes "
            f"{_when(w['warranty_end_date'])}. Catch any claims before it does."
        )

    # 3. A unit meaningfully slower than average (not just nominally above it).
    if stalest and avg_days:
        top = stalest[0]
        days = top["days_in_inventory"]
        if days >= avg_days * 1.5:
            times = days / avg_days
            return (
                f"{top['stock_number']} has sat {days} days - {times:.1f}x your average. "
                f"Cut the price and move it."
            )

    # 4. Nothing urgent - still a headline, not a status report.
    open_count = quotes.get("open_count", 0)
    if open_count:
        return (
            f"All clear today: {_fmt_money(quotes.get('open_value_usd'))} + "
            f"{_fmt_money(quotes.get('open_value_mxn'), 'MXN')} in {open_count} open "
            f"{_plural(open_count, 'quote')}, {_fmt_money(cash.get('usd'))} cash on hand."
        )

    available = inv.get("available_for_sale", 0)
    return (
        f"All clear today: {available} {_plural(available, 'unit')} ready to sell, "
        f"{_fmt_money(cash.get('usd'))} cash on hand."
    )
