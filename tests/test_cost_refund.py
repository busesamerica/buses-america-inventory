#!/usr/bin/env python3
"""
End-to-end exercise of vendor refunds against bus costs:

    export DATABASE_URL=postgres://.../buses_test
    uvicorn backend_api_FINAL:app --port 8099 &
    API=http://127.0.0.1:8099 TOKEN=<session token> python tests/test_cost_refund.py

Needs a USD bank account (tests/dev_fixtures.sql). Sells a unit, so re-run
the reset steps (see tests/README.md) between runs.
"""

import os
import sys
import json
import datetime
import urllib.request
import urllib.error

API = os.getenv("API", "http://127.0.0.1:8099")
TOKEN = os.getenv("TOKEN", "TEST-TOKEN-123")
TODAY = datetime.date.today().isoformat()

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


def balance(account_id):
    status, stmt = call("GET", f"/api/accounting/accounts/{account_id}/statement")
    return float(stmt["closing_balance"])


def total_cost(inventory_id):
    status, summary = call("GET", f"/api/inventory/{inventory_id}/costs/summary")
    return summary["additional_costs"]


print("=" * 62)
print("Vendor refunds against bus costs - end to end")
print("=" * 62)

status, accounts = call("GET", "/api/accounting/accounts")
bank = next(a for a in accounts if a["currency"] == "USD" and a.get("account_subtype") == "Bank")
inventory_acct = next(a for a in accounts if a["account_code"] == "1200")

status, units = call("GET", "/api/inventory")
unit = next(u for u in units if u["stock_number"] == "BA-104")
inv_id = unit["inventory_id"]

# Post the purchase to the ledger so the unit can be sold later.
status, res = call("POST", f"/api/inventory/{inv_id}/record-purchase-payment", {
    "payment_account_id": bank["account_id"], "payment_date": TODAY, "payment_status": "paid",
})
check("purchase payment recorded", status == 200, f"({status}) {res}")

status, cost = call("POST", f"/api/inventory/{inv_id}/costs", {
    "cost_category": "Regulatory", "description": "Sales tax (charged in error)",
    "amount": 1000, "currency": "USD", "vendor": "Test Vendor",
    "date_incurred": TODAY, "payment_account_id": bank["account_id"], "payment_status": "paid",
})
check("cost added", status == 200, f"({status}) {cost}")
cost_id = cost["cost_id"]
base_cost = total_cost(inv_id)
bank_before = balance(bank["account_id"])
inv_before = balance(inventory_acct["account_id"])

refund_url = f"/api/inventory/{inv_id}/costs/{cost_id}/refund"
body = {"amount": 400, "refund_date": TODAY, "deposit_account_id": bank["account_id"], "reference": "CM-1"}

# --- validation ---------------------------------------------------------
status, err = call("POST", refund_url, {**body, "amount": 0})
check("zero refund rejected", status == 400, f"({status}) {err}")
status, err = call("POST", refund_url, {**body, "amount": 1500})
check("over-refund rejected", status == 400, f"({status}) {err}")
status, err = call("POST", refund_url, {k: v for k, v in body.items() if k != "deposit_account_id"})
check("missing deposit account rejected", status == 400, f"({status}) {err}")
mxn = next((a for a in accounts if a["currency"] == "MXN" and a.get("account_subtype") == "Bank"), None)
if mxn:
    status, err = call("POST", refund_url, {**body, "deposit_account_id": mxn["account_id"]})
    check("currency mismatch rejected", status == 400, f"({status}) {err}")

# --- partial refund -----------------------------------------------------
status, refund = call("POST", refund_url, body)
check("partial refund recorded", status == 200, f"({status}) {refund}")
check("refund row is negative and linked",
      float(refund["amount"]) == -400 and refund["refund_of_cost_id"] == cost_id, refund)
check("cost total reduced by refund", abs(total_cost(inv_id) - (base_cost - 400)) < 0.01,
      f"{total_cost(inv_id)} vs {base_cost - 400}")
check("bank balance up by refund", abs(balance(bank["account_id"]) - (bank_before + 400)) < 0.01)
check("Bus Inventory down by refund", abs(balance(inventory_acct["account_id"]) - (inv_before - 400)) < 0.01)

status, err = call("POST", refund_url, {**body, "amount": 700})
check("cumulative over-refund rejected", status == 400, f"({status}) {err}")

# --- edit/delete guards -------------------------------------------------
status, err = call("PATCH", f"/api/inventory/{inv_id}/costs/{refund['cost_id']}", {"amount": -100})
check("refund row can't be edited", status == 400, f"({status}) {err}")
status, err = call("DELETE", f"/api/inventory/{inv_id}/costs/{cost_id}")
check("cost with refund can't be deleted", status == 400, f"({status}) {err}")
status, err = call("POST", f"/api/inventory/{inv_id}/costs/{refund['cost_id']}/refund", body)
check("a refund can't be refunded", status == 400, f"({status}) {err}")

# --- deleting the refund restores everything ---------------------------
status, res = call("DELETE", f"/api/inventory/{inv_id}/costs/{refund['cost_id']}")
check("refund deleted", status == 200, f"({status}) {res}")
check("cost restored", abs(total_cost(inv_id) - base_cost) < 0.01)
check("bank restored", abs(balance(bank["account_id"]) - bank_before) < 0.01)
check("Bus Inventory restored", abs(balance(inventory_acct["account_id"]) - inv_before) < 0.01)

# --- COGS nets the refund on sale --------------------------------------
status, refund = call("POST", refund_url, {**body, "amount": 1000})
check("full refund recorded", status == 200, f"({status}) {refund}")
status, err = call("POST", refund_url, {**body, "amount": 0.01})
check("nothing left to refund", status == 400, f"({status}) {err}")
status, sale = call("POST", "/api/sales/record", {
    "inventory_id": inv_id, "sale_price": 40000, "sale_currency": "USD", "sale_date": TODAY,
})
check("unit sold", status == 200, f"({status}) {sale}")
status, sold = call("GET", f"/api/inventory/{inv_id}")
check("net additional cost is zero after full refund",
      abs(total_cost(inv_id)) < 0.01, total_cost(inv_id))
status, stmt = call("GET", f"/api/accounting/accounts/{inventory_acct['account_id']}/statement")
cogs = next(a for a in accounts if a.get("account_subtype") == "Cost of Goods")
status, cogs_stmt = call("GET", f"/api/accounting/accounts/{cogs['account_id']}/statement")
check("COGS equals purchase price only", abs(float(cogs_stmt["total_debit"]) - 23500) < 0.01,
      cogs_stmt["total_debit"])

print()
print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
