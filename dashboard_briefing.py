"""
Dashboard briefing text, composed from data the app already computes -
no external API, no cost, nothing to configure.

Takes the same context dict GET/POST /api/reports/dashboard-briefing
assembles (inventory/quote/cash numbers plus a few "needs attention soon"
queries) and turns it into a short paragraph with plain conditional
templates: each sentence only appears if it actually has something to say
(no quotes expiring this week -> no sentence about it), so the result reads
as a short briefing rather than a fixed six-line report.
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

    sentences = []

    # Inventory snapshot - always present, this is the one sentence that's
    # never conditional.
    available = inv.get("available_for_sale", 0)
    sentences.append(
        f"You have {available} {_plural(available, 'unit')} available to sell "
        f"({inv.get('us_inventory', 0)} in the US, {inv.get('mexico_inventory', 0)} in Mexico), "
        f"worth {_fmt_money(inv.get('total_inventory_value_usd'))} in total."
    )

    # Slow mover - only worth a sentence if the single stalest unit is
    # meaningfully above average, not just nominally above it.
    avg_days = inv.get("avg_days_in_inventory")
    if stalest and avg_days:
        top = stalest[0]
        days = top["days_in_inventory"]
        if days >= avg_days * 1.5:
            sentences.append(
                f"Unit {top['stock_number']} ({top['year']} {top['make']} {top['model']}) has been "
                f"in inventory {days} days - {days / avg_days:.1f}x the {avg_days:.0f}-day average - "
                f"worth a look."
            )

    # Quotes expiring within a week
    if expiring_quotes:
        n = len(expiring_quotes)
        names = ", ".join(q["client_name"] for q in expiring_quotes[:3])
        more = f" and {n - 3} more" if n > 3 else ""
        sentences.append(
            f"{n} {_plural(n, 'quote')} expire{'s' if n == 1 else ''} within a week ({names}{more})."
        )

    # Warranty coverage expiring within a week
    if expiring_warranties:
        n = len(expiring_warranties)
        stock_numbers = ", ".join(w["stock_number"] for w in expiring_warranties[:3])
        sentences.append(
            f"Warranty coverage ends within a week on {n} {_plural(n, 'unit')} ({stock_numbers})."
        )

    # Quote pipeline
    open_count = quotes.get("open_count", 0)
    if open_count:
        win_rate = quotes.get("win_rate")
        win_text = f", {win_rate}% win rate" if win_rate is not None else ""
        sentences.append(
            f"{open_count} open {_plural(open_count, 'quote')} worth "
            f"{_fmt_money(quotes.get('open_value_usd'))} + {_fmt_money(quotes.get('open_value_mxn'), 'MXN')}"
            f"{win_text}."
        )

    # Cash position - always present, closes out the briefing.
    sentences.append(
        f"Cash on hand: {_fmt_money(cash.get('usd'))} + {_fmt_money(cash.get('mxn'), 'MXN')} "
        f"({_fmt_money(cash.get('usd_equivalent'))} USD equivalent)."
    )

    return " ".join(sentences)
