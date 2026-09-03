#!/usr/bin/env python3
"""
End-to-end exercise of the "no more costs once Delivered" guard against a
running API:

    export DATABASE_URL=postgres://.../buses_test
    uvicorn backend_api_FINAL:app --port 8099 &
    API=http://127.0.0.1:8099 TOKEN=<session token> python tests/test_cost_guard.py

See tests/dev_fixtures.sql / tests/seed_dev_data.sql for the local database
setup this assumes. Sells and delivers inventory, so re-run the reset steps
(see tests/README.md) between runs.
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


def sell(stock_number, sale_price):
    status, units = call("GET", "/api/inventory")
    unit = next(u for u in units if u["stock_number"] == stock_number)
    status, sale = call("POST", "/api/sales/record", {
        "inventory_id": unit["inventory_id"],
        "sale_price": sale_price,
        "sale_currency": "USD",
        "sale_date": TODAY,
    })
    check(f"{stock_number} sold", status == 200, f"({status}) {sale}")
    return unit["inventory_id"]


def pay(inventory_id, amount, usd_account_id):
    status, payment = call("POST", f"/api/inventory/{inventory_id}/payments", {
        "payment_amount": amount,
        "payment_currency": "USD",
        "payment_date": TODAY,
        "payment_method": "Wire Transfer",
        "payment_type": "Payment",
        "payment_account_id": usd_account_id,
    })
    check(f"payment of {amount} recorded", status == 200, f"({status}) {payment}")


def get_unit(inventory_id):
    status, unit = call("GET", f"/api/inventory/{inventory_id}")
    return unit


print("=" * 62)
print("Cost guard on Delivered units - end to end")
print("=" * 62)

status, accounts = call("GET", "/api/accounting/accounts")
usd_account = next(a for a in accounts if a["currency"] == "USD")
usd_account_id = usd_account["account_id"]

# --- deliver() requires sold + fully paid ---------------------------------
partial_id = sell("BA-102", 30000)

status, err = call("POST", f"/api/inventory/{partial_id}/deliver", {})
check("cannot deliver before any payment", status == 400, f"({status}) {err}")

pay(partial_id, 15000, usd_account_id)
status, err = call("POST", f"/api/inventory/{partial_id}/deliver", {})
check("cannot deliver on a partial payment", status == 400, f"({status}) {err}")

status, unsold = call("GET", "/api/inventory")
unsold_unit = next(u for u in unsold if u["stock_number"] == "BA-103")
status, err = call("POST", f"/api/inventory/{unsold_unit['inventory_id']}/deliver", {})
check("cannot deliver a unit that hasn't been sold", status == 400, f"({status}) {err}")

# --- deliver() succeeds once fully paid, and is one-way -------------------
inventory_id = sell("BA-101", 30000)
pay(inventory_id, 30000, usd_account_id)

unit = get_unit(inventory_id)
check("payment status is Paid in Full", unit["payment_status"] == "Paid in Full", unit["payment_status"])

status, delivered = call("POST", f"/api/inventory/{inventory_id}/deliver", {})
check("delivery recorded", status == 200 and delivered["status"] == "Delivered", f"({status}) {delivered}")
check("delivery_date auto-populated", bool(delivered.get("delivery_date")), delivered.get("delivery_date"))

status, err = call("POST", f"/api/inventory/{inventory_id}/deliver", {})
check("cannot mark as delivered twice", status == 400, f"({status}) {err}")

# --- costs are blocked on the now-delivered unit ---------------------------
status, err = call("POST", f"/api/inventory/{inventory_id}/costs", {
    "cost_category": "Other",
    "description": "Should be rejected",
    "amount": 100,
    "currency": "USD",
    "vendor": "N/A",
    "date_incurred": TODAY,
    "payment_status": "paid",
    "payment_account_id": usd_account_id,
})
check("adding a cost to a delivered unit is rejected", status == 400, f"({status}) {err}")
check("rejection explains why", "delivered" in (err.get("detail") or "").lower(), err)

status, existing_costs = call("GET", f"/api/inventory/{inventory_id}/costs")
if existing_costs:
    cost_id = existing_costs[0]["cost_id"]
    status, err = call("PATCH", f"/api/inventory/{inventory_id}/costs/{cost_id}", {"amount": 999})
    check("editing an existing cost on a delivered unit is rejected", status == 400, f"({status}) {err}")

    status, err = call("DELETE", f"/api/inventory/{inventory_id}/costs/{cost_id}")
    check("deleting an existing cost on a delivered unit is rejected", status == 400, f"({status}) {err}")
else:
    print("  (no pre-existing cost_items on this unit to test PATCH/DELETE against - skipped)")

# --- regression: a non-delivered unit still accepts costs normally --------
status, units = call("GET", "/api/inventory")
regular_unit = next(u for u in units if u["stock_number"] == "BA-104")
status, cost = call("POST", f"/api/inventory/{regular_unit['inventory_id']}/costs", {
    "cost_category": "Other",
    "description": "Still allowed on a non-delivered unit",
    "amount": 50,
    "currency": "USD",
    "vendor": "N/A",
    "date_incurred": TODAY,
    "payment_status": "paid",
    "payment_account_id": usd_account_id,
})
check("adding a cost to a non-delivered unit still works", status == 200, f"({status}) {cost}")

print("=" * 62)
print(f"{passed} passed, {failed} failed")
print("=" * 62)
sys.exit(1 if failed else 0)
