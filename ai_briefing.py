"""
Dashboard briefing via the Anthropic Messages API.

Same shape as vin_decoder.py: one focused module wrapping a single external
API call via httpx (already a dependency - no SDK added), imported by the
main backend file. Used by GET/POST /api/reports/dashboard-briefing to turn
the numbers the Dashboard already computes (inventory, quotes, cash, plus a
few "needs attention soon" queries) into a short plain-English paragraph,
instead of the business owner having to read six stat cards and connect the
dots themselves.

No API key configured, or the API call failing, is an expected, common
state (a fresh deployment before ANTHROPIC_API_KEY is set in Render) - both
raise BriefingUnavailable so the caller can degrade to "not configured yet"
instead of a 500 that breaks the whole Dashboard.
"""

import os
import httpx

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
# Fast/cheap model - this is a short data summary over numbers the app
# already computed, not a reasoning task.
MODEL = "claude-haiku-4-5-20251001"


class BriefingUnavailable(Exception):
    """Raised when a briefing can't be generated right now (no API key, or
    the Anthropic API errored/timed out). Callers should fall back to the
    last cached briefing, or a plain "not available" message - never let
    this turn into a 500 on the Dashboard."""


def _fmt_money(amount, currency="USD"):
    if amount is None:
        return "—"
    prefix = "$" if currency == "USD" else "MXN $"
    return f"{prefix}{amount:,.2f}"


def _build_prompt(context: dict) -> str:
    inv = context.get("inventory", {})
    quotes = context.get("quotes", {})
    cash = context.get("cash", {})
    expiring_quotes = quotes.get("expiring_soon") or []
    expiring_warranties = context.get("warranty_expiring_soon") or []
    stalest = context.get("stalest_units") or []

    lines = [
        f"Date: {context.get('date')}",
        "",
        "INVENTORY",
        f"- US stock: {inv.get('us_inventory', 0)} units, Mexico stock: {inv.get('mexico_inventory', 0)} units",
        f"- Available to sell: {inv.get('available_for_sale', 0)}, sold pending delivery: {inv.get('sold_pending_delivery', 0)}, delivered: {inv.get('delivered', 0)}",
        f"- Under active warranty: {inv.get('under_warranty', 0)}",
        f"- Average days in inventory (units not yet delivered): "
        + (f"{inv['avg_days_in_inventory']:.0f}" if inv.get('avg_days_in_inventory') is not None else "unknown"),
        f"- Total inventory value: {_fmt_money(inv.get('total_inventory_value_usd'))}",
        "",
        "QUOTES",
        f"- Open quotes: {quotes.get('open_count', 0)}, open value: {_fmt_money(quotes.get('open_value_usd'))} + {_fmt_money(quotes.get('open_value_mxn'), 'MXN')}",
        f"- Win rate: " + (f"{quotes['win_rate']}%" if quotes.get('win_rate') is not None else "not enough data yet"),
    ]

    if expiring_quotes:
        lines.append("- Quotes expiring within 7 days:")
        for q in expiring_quotes:
            lines.append(
                f"  - {q['quote_number']} for {q['client_name']}: "
                f"{_fmt_money(q['total_amount'], q['currency'])}, valid until {q['valid_until']}"
            )
    else:
        lines.append("- No quotes expiring within 7 days.")

    lines += ["", "CASH POSITION"]
    lines.append(
        f"- USD accounts: {_fmt_money(cash.get('usd'))}, MXN accounts: {_fmt_money(cash.get('mxn'), 'MXN')}, "
        f"USD equivalent total: {_fmt_money(cash.get('usd_equivalent'))}"
    )

    lines += ["", "WARRANTY EXPIRING WITHIN 7 DAYS"]
    if expiring_warranties:
        for w in expiring_warranties:
            lines.append(f"- {w['stock_number']} ({w['year']} {w['make']} {w['model']}): expires {w['warranty_end_date']}")
    else:
        lines.append("- None.")

    lines += ["", "UNITS THAT HAVE BEEN IN INVENTORY THE LONGEST (not yet delivered)"]
    if stalest:
        for u in stalest:
            lines.append(f"- {u['stock_number']} ({u['year']} {u['make']} {u['model']}): {u['days_in_inventory']} days, status {u['status']}")
    else:
        lines.append("- None.")

    data_block = "\n".join(lines)

    return (
        "You are writing a short daily briefing for the owner of a small bus "
        "dealership/import-export business, based on the data below. Write "
        "3-5 plain sentences (one short paragraph, no headers, no markdown, "
        "no bullet points) highlighting what actually needs attention today - "
        "expiring quotes or warranties, unusually slow-moving units, notable "
        "cash or pipeline numbers. Skip anything unremarkable rather than "
        "restating every number. Be direct and specific (use the real "
        "numbers/stock numbers/client names given), not generic.\n\n"
        f"{data_block}"
    )


async def generate_briefing(context: dict) -> str:
    """Call the Anthropic Messages API and return the briefing text."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise BriefingUnavailable("ANTHROPIC_API_KEY is not configured")

    prompt = _build_prompt(context)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 400,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.TimeoutException, httpx.HTTPError) as e:
        raise BriefingUnavailable(f"Anthropic API call failed: {e}") from e

    content = payload.get("content") or []
    text = "".join(block.get("text", "") for block in content if block.get("type") == "text").strip()
    if not text:
        raise BriefingUnavailable("Anthropic API returned an empty response")
    return text
