#!/usr/bin/env python3
"""
End-to-end exercise of the quoting endpoints against a running API.

    export DATABASE_URL=postgres://.../buses_test
    uvicorn backend_api_FINAL:app --port 8099 &
    API=http://127.0.0.1:8099 TOKEN=<session token> python tests/test_quotes.py

See tests/dev_fixtures.sql for the local database setup this assumes.
"""

import os
import sys
import json
import urllib.request
import urllib.error

API = os.getenv("API", "http://127.0.0.1:8099")
TOKEN = os.getenv("TOKEN", "TEST-TOKEN-123")

passed, failed = 0, 0


def call(method, path, body=None):
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(body, default=str).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "null")


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name} {detail}")


print("=" * 62)
print("Quoting module - end to end")
print("=" * 62)

# --- inventory available for quoting -------------------------------------
status, units = call("GET", "/api/quotes/inventory/available")
check("available units listed", status == 200 and len(units) >= 3, f"({status})")
by_stock = {u["stock_number"]: u for u in units}

status, clients = call("GET", "/api/clients")
client_id = clients[0]["client_id"] if clients else None

# --- create ---------------------------------------------------------------
status, quote = call("POST", "/api/quotes", {
    "client_id": client_id,
    "validity_days": 30,
    "currency": "USD",
    "tax_rate": 0,
    "deposit_percent": 30,
    "line_items": [
        {"line_type": "bus", "inventory_id": by_stock["BA-101"]["inventory_id"]},
        {"line_type": "bus", "inventory_id": by_stock["BA-102"]["inventory_id"], "unit_price": 35000},
        {"line_type": "charge", "description": "Transport to Monterrey", "unit_price": 2800},
        {"line_type": "charge", "description": "Import & customs (broker)", "unit_price": 4200},
    ],
})
check("quote created", status == 200, f"({status}) {quote}")
if status != 200:
    sys.exit(1)

quote_id = quote["quote_id"]
check("quote number assigned", quote["quote_number"].startswith("COT-"), quote["quote_number"])
check("client snapshot copied from client record",
      quote["client_company"] == "Transportes del Norte S.A. de C.V.", quote["client_company"])
check("unit price defaulted to asking price",
      float(quote["line_items"][0]["unit_price"]) == 32500.0, quote["line_items"][0]["unit_price"])
check("explicit unit price respected",
      float(quote["line_items"][1]["unit_price"]) == 35000.0)
# 32500 + 35000 + 2800 + 4200
check("subtotal computed server-side", float(quote["subtotal"]) == 74500.0, quote["subtotal"])
check("total equals subtotal with no tax/discount", float(quote["total_amount"]) == 74500.0)
check("deposit derived from percent", float(quote["deposit_required"]) == 22350.0, quote["deposit_required"])
check("valid_until derived from validity_days", bool(quote["valid_until"]))
check("starts as Draft", quote["status"] == "Draft")
check("prepared-by defaults to the signed-in user",
      quote["prepared_by_name"] == "Test Admin", quote.get("prepared_by_name"))
check("unit specs snapshotted onto the line",
      quote["line_items"][0].get("transmission") is not None
      and quote["line_items"][0].get("condition") is not None,
      {k: quote["line_items"][0].get(k) for k in ("exterior_color", "engine_make", "transmission", "condition")})

# --- per-seller "Elaborado por" -------------------------------------------
status, seller_quote = call("POST", "/api/quotes", {
    "client_name": "Seller Override Test",
    "prepared_by_name": "Jorge Treviño",
    "prepared_by_phone": "+52 899 291 1739",
    "prepared_by_email": "jtrevino@busesamerica.com",
    "line_items": [{"line_type": "charge", "description": "Consultoría", "unit_price": 100}],
})
check("explicit seller details override the signed-in user",
      status == 200 and seller_quote["prepared_by_name"] == "Jorge Treviño"
      and seller_quote["prepared_by_phone"] == "+52 899 291 1739",
      f"({status})")
status, seller_copy = call("POST", f"/api/quotes/{seller_quote['quote_id']}/duplicate")
check("a duplicated quote keeps its seller",
      seller_copy["prepared_by_name"] == "Jorge Treviño", seller_copy.get("prepared_by_name"))
call("DELETE", f"/api/quotes/{seller_copy['quote_id']}")
call("DELETE", f"/api/quotes/{seller_quote['quote_id']}")

# --- validation -----------------------------------------------------------
status, err = call("POST", "/api/quotes", {
    "client_name": "Test", "line_items": [{"line_type": "bus"}]
})
check("bus line without inventory_id rejected", status == 400, f"({status})")

status, err = call("POST", "/api/quotes", {
    "client_name": "Test",
    "line_items": [
        {"line_type": "bus", "inventory_id": by_stock["BA-101"]["inventory_id"]},
        {"line_type": "bus", "inventory_id": by_stock["BA-101"]["inventory_id"]},
    ],
})
check("duplicate unit on one quote rejected", status == 400, f"({status})")

status, err = call("POST", "/api/quotes", {"line_items": []})
check("missing client name rejected", status == 400, f"({status})")

status, err = call("POST", "/api/quotes", {
    "client_name": "Test", "currency": "EUR", "line_items": []
})
check("unsupported currency rejected", status == 400, f"({status})")

# --- update with tax and discount ----------------------------------------
status, updated = call("PUT", f"/api/quotes/{quote_id}", {
    "discount_amount": 1500,
    "tax_rate": 16,
})
check("update accepted", status == 200, f"({status}) {updated}")
# (74500 - 1500) * 0.16 = 11680 ; total 84680
check("tax computed on discounted subtotal",
      float(updated["tax_amount"]) == 11680.0, updated["tax_amount"])
check("total includes tax and discount",
      float(updated["total_amount"]) == 84680.0, updated["total_amount"])
check("deposit recalculated on new total",
      float(updated["deposit_required"]) == 25404.0, updated["deposit_required"])

# --- status transitions ---------------------------------------------------
status, sent = call("POST", f"/api/quotes/{quote_id}/status", {"status": "Sent"})
check("marked sent", status == 200 and sent["status"] == "Sent", f"({status})")
check("sent_at stamped", bool(sent["sent_at"]))

status, err = call("POST", f"/api/quotes/{quote_id}/status", {"status": "Accepted"})
check("cannot 'Accept' via the status endpoint", status == 400, f"({status})")

status, err = call("POST", f"/api/quotes/{quote_id}/status", {"status": "Banana"})
check("unknown status rejected", status == 400, f"({status})")

# --- a competing quote on the same unit ----------------------------------
status, competing = call("POST", "/api/quotes", {
    "client_name": "Autobuses del Golfo",
    "currency": "USD",
    "line_items": [{"line_type": "bus", "inventory_id": by_stock["BA-101"]["inventory_id"]}],
})
check("competing quote created", status == 200, f"({status})")
competing_id = competing["quote_id"]
call("POST", f"/api/quotes/{competing_id}/status", {"status": "Sent"})

status, avail = call("GET", "/api/quotes/inventory/available")
ba101 = next(u for u in avail if u["stock_number"] == "BA-101")
check("unit flagged as being on 2 open quotes", ba101["open_quote_count"] == 2, ba101["open_quote_count"])

# --- accept & convert -----------------------------------------------------
status, accepted = call("POST", f"/api/quotes/{quote_id}/accept", {
    "sale_date": "2026-08-24", "charge_allocation": "prorate"
})
check("quote accepted", status == 200, f"({status}) {accepted}")
if status == 200:
    check("status is Accepted", accepted["status"] == "Accepted")
    sales = accepted["sales"]
    check("one sale per bus line", len(sales) == 2, len(sales))
    total_recorded = round(sum(float(s["sale_price"]) for s in sales), 2)
    check("recorded revenue equals the quote total",
          total_recorded == 84680.0, total_recorded)
    check("profit computed per sale", all("gross_profit" in s for s in sales))
    superseded = accepted["superseded_quotes"]
    check("competing quote auto-cancelled",
          any(s["quote_id"] == competing_id for s in superseded), superseded)

    status, comp_after = call("GET", f"/api/quotes/{competing_id}")
    check("competing quote now Cancelled", comp_after["status"] == "Cancelled", comp_after["status"])
    check("competing quote points at the winner",
          comp_after["superseded_by"] == quote_id)

# --- post-acceptance guards ----------------------------------------------
status, err = call("POST", f"/api/quotes/{quote_id}/accept", {})
check("cannot accept twice", status == 400, f"({status})")

status, err = call("PUT", f"/api/quotes/{quote_id}", {"notes": "late edit"})
check("accepted quote is not editable", status == 400, f"({status})")

status, err = call("DELETE", f"/api/quotes/{quote_id}")
check("accepted quote cannot be deleted", status == 400, f"({status})")

status, avail = call("GET", "/api/quotes/inventory/available")
stocks = [u["stock_number"] for u in avail]
check("sold units drop out of available inventory",
      "BA-101" not in stocks and "BA-102" not in stocks, stocks)

# --- quoting an already-sold unit ----------------------------------------
status, resold = call("POST", "/api/quotes", {
    "client_name": "Someone Else",
    "line_items": [{"line_type": "bus", "inventory_id": by_stock["BA-101"]["inventory_id"]}],
})
check("quoting a sold unit warns rather than blocks",
      status == 200 and resold["warnings"], resold.get("warnings"))
status, err = call("POST", f"/api/quotes/{resold['quote_id']}/accept", {})
check("but it cannot be converted", status == 400, f"({status})")
call("DELETE", f"/api/quotes/{resold['quote_id']}")

# --- duplicate ------------------------------------------------------------
status, copy = call("POST", f"/api/quotes/{quote_id}/duplicate")
check("accepted quote can be duplicated into a new draft",
      status == 200 and copy["status"] == "Draft", f"({status})")
check("copy has its own number", copy["quote_number"] != quote["quote_number"])
check("copy carries the line items", len(copy["line_items"]) == 4, len(copy["line_items"]))
check("copy increments the revision", copy["revision"] == 2, copy["revision"])
call("DELETE", f"/api/quotes/{copy['quote_id']}")

# --- allocation: 'none' ---------------------------------------------------
status, plain = call("POST", "/api/quotes", {
    "client_name": "Charge Allocation Test",
    "currency": "USD",
    "line_items": [
        {"line_type": "bus", "inventory_id": by_stock["BA-103"]["inventory_id"], "unit_price": 30000},
        {"line_type": "charge", "description": "Delivery", "unit_price": 5000},
    ],
})
status, plain_accepted = call("POST", f"/api/quotes/{plain['quote_id']}/accept", {
    "charge_allocation": "none"
})
check("allocation 'none' records unit price only",
      status == 200 and float(plain_accepted["sales"][0]["sale_price"]) == 30000.0,
      plain_accepted.get("sales"))

# --- stats & listing ------------------------------------------------------
status, stats = call("GET", "/api/quotes/stats/summary")
check("stats endpoint responds", status == 200, f"({status})")
check("accepted quotes counted", stats["accepted_count"] >= 2, stats["accepted_count"])
check("win rate computed", stats["win_rate"] is not None, stats["win_rate"])

status, listing = call("GET", "/api/quotes?status=Accepted")
check("status filter works",
      status == 200 and all(q["status"] == "Accepted" for q in listing), f"({status})")

status, listing = call("GET", "/api/quotes?search=Transportes")
check("search filter works", status == 200 and len(listing) >= 1, f"({status})")

print("=" * 62)
print(f"{passed} passed, {failed} failed")
print("=" * 62)
sys.exit(1 if failed else 0)
