#!/usr/bin/env python3
"""
End-to-end exercise of the FX handling around customer payments and period close:

  * a USD sale paid partly in MXN clears AR-USD (not AR-MXN), at the payment-date
    rate, and the rate / converted amount are stored on the payment
  * balance_due doesn't drift when other payments are added or deleted
  * period close refuses to run without a recent exchange rate and reports the
    rate date and combined net income when it does

    export DATABASE_URL=postgres://.../buses_test
    uvicorn backend_api_FINAL:app --port 8099 &
    API=http://127.0.0.1:8099 TOKEN=<session token> python tests/test_fx_payments.py

See tests/dev_fixtures.sql / tests/seed_dev_data.sql for the local database
setup this assumes. Sells a unit (BA-105) and closes a January 2000 period, so
re-run the reset steps (see tests/README.md) between runs.
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


def unit(inv_id):
    status, row = call("GET", f"/api/inventory/{inv_id}")
    return row


print("=" * 62)
print("FX: cross-currency customer payments and period close")
print("=" * 62)

status, accounts = call("GET", "/api/accounting/accounts")
usd_bank = next(a for a in accounts if a["currency"] == "USD" and a.get("account_subtype") == "Bank")
mxn_bank = next(a for a in accounts if a["currency"] == "MXN" and a.get("account_subtype") == "Bank")
ar_usd = next(a for a in accounts if a["currency"] == "USD" and a.get("account_subtype") == "AR")
ar_mxn = next(a for a in accounts if a["currency"] == "MXN" and a.get("account_subtype") == "AR")

status, rates = call("GET", "/api/exchange-rates?limit=1")
rate = float(rates[0]["rate"])
print(f"  (current USD->MXN rate: {rate})")

status, units = call("GET", "/api/inventory")
bus = next(u for u in units if u["stock_number"] == "BA-105")
inv_id = bus["inventory_id"]

status, res = call("POST", f"/api/inventory/{inv_id}/record-purchase-payment", {
    "payment_account_id": usd_bank["account_id"], "payment_date": TODAY, "payment_status": "paid",
})
check("purchase payment recorded", status == 200, f"({status}) {res}")

ar_usd_before = balance(ar_usd["account_id"])
ar_mxn_before = balance(ar_mxn["account_id"])

status, sale = call("POST", "/api/sales/record", {
    "inventory_id": inv_id, "sale_price": 10000, "sale_currency": "USD", "sale_date": TODAY,
})
check("USD sale recorded", status == 200, f"({status}) {sale}")
check("AR-USD up by the sale price", abs(balance(ar_usd["account_id"]) - (ar_usd_before + 10000)) < 0.01)

# --- USD sale paid in MXN ---------------------------------------------------
mxn_paid = 85000.0
mxn_as_usd = round(mxn_paid / rate, 2)
status, pay_mxn = call("POST", f"/api/inventory/{inv_id}/payments", {
    "payment_amount": mxn_paid, "payment_currency": "MXN", "payment_date": TODAY,
    "payment_method": "Transfer", "payment_type": "Deposit",
    "payment_account_id": mxn_bank["account_id"],
})
check("MXN payment on a USD sale recorded", status == 200, f"({status}) {pay_mxn}")
check("payment stores the rate used", abs(float(pay_mxn["payment_exchange_rate"]) - rate) < 1e-6, pay_mxn)
check("payment stores its sale-currency value", abs(float(pay_mxn["converted_amount"]) - mxn_as_usd) < 0.01, pay_mxn)
check("AR-USD cleared by the converted amount",
      abs(balance(ar_usd["account_id"]) - (ar_usd_before + 10000 - mxn_as_usd)) < 0.01,
      f"{balance(ar_usd['account_id'])} vs {ar_usd_before + 10000 - mxn_as_usd}")
check("AR-MXN untouched (no negative peso receivable)",
      abs(balance(ar_mxn["account_id"]) - ar_mxn_before) < 0.01,
      f"{balance(ar_mxn['account_id'])} vs {ar_mxn_before}")
check("MXN bank received the pesos", balance(mxn_bank["account_id"]) >= mxn_paid - 0.01)
check("balance_due is sale price minus converted payment",
      abs(float(unit(inv_id)["balance_due"]) - (10000 - mxn_as_usd)) < 0.01, unit(inv_id)["balance_due"])

# --- a second, same-currency payment, then delete it: no drift --------------
status, pay_usd = call("POST", f"/api/inventory/{inv_id}/payments", {
    "payment_amount": 1000, "payment_currency": "USD", "payment_date": TODAY,
    "payment_method": "Transfer", "payment_type": "Deposit",
    "payment_account_id": usd_bank["account_id"],
})
check("USD payment recorded", status == 200, f"({status}) {pay_usd}")
check("same-currency payment has no rate", pay_usd["payment_exchange_rate"] is None, pay_usd)
check("balance_due reflects both payments",
      abs(float(unit(inv_id)["balance_due"]) - (10000 - mxn_as_usd - 1000)) < 0.01)

status, listing = call("GET", f"/api/inventory/{inv_id}/payments")
by_id = {p["payment_id"]: p for p in listing["payments"]}
check("listing shows the stored conversion",
      abs(by_id[pay_mxn["payment_id"]]["converted_amount"] - mxn_as_usd) < 0.01
      and abs(by_id[pay_mxn["payment_id"]]["conversion_rate"] - rate) < 1e-6, by_id[pay_mxn["payment_id"]])

status, res = call("DELETE", f"/api/inventory/{inv_id}/payments/{pay_usd['payment_id']}")
check("USD payment deleted", status == 200, f"({status}) {res}")
check("balance_due back to the MXN-only figure (no drift)",
      abs(float(unit(inv_id)["balance_due"]) - (10000 - mxn_as_usd)) < 0.01, unit(inv_id)["balance_due"])

# --- period close needs a recent rate ---------------------------------------
# January 2000 has no rate on file, so the only available rate is a much later one.
if not any(a.get("account_subtype") == "Retained Earnings" for a in accounts):
    status, res = call("POST", "/api/accounting/accounts", {
        "account_code": "3100", "account_name": "Retained Earnings",
        "account_type": "Equity", "account_subtype": "Retained Earnings", "currency": "USD",
    })
    check("Retained Earnings account created for the test", status in (200, 201), f"({status}) {res}")

# Activity inside the period, so the income statement has something to lose when it's closed.
sales_usd = next(a for a in accounts if a["currency"] == "USD" and a.get("account_subtype") == "Sales")
status, res = call("POST", "/api/accounting/transactions", {
    "transaction_date": "2000-01-15", "description": "FX test sale", "reference_type": "manual", "currency": "USD",
    "lines": [
        {"account_id": ar_usd["account_id"], "debit_amount": 500, "credit_amount": 0, "currency": "USD"},
        {"account_id": sales_usd["account_id"], "debit_amount": 0, "credit_amount": 500, "currency": "USD"},
    ],
})
check("January 2000 revenue posted", status in (200, 201), f"({status}) {res}")

period = {"period_start": "2000-01-01", "period_end": "2000-01-31"}
status, err = call("POST", "/api/accounting/period-close", period)
check("close refused without a recent rate", status == 400 and "exchange rate" in str(err.get("detail", "")).lower(),
      f"({status}) {err}")

status, res = call("POST", "/api/exchange-rates", {
    "from_currency": "USD", "to_currency": "MXN", "rate": 18, "effective_date": "2000-01-20",
})
check("old rate added", status == 200, f"({status}) {res}")
status, err = call("POST", "/api/accounting/period-close", period)
check("close refused when the rate is older than 7 days", status == 400, f"({status}) {err}")

status, res = call("POST", "/api/exchange-rates", {
    "from_currency": "USD", "to_currency": "MXN", "rate": 20, "effective_date": "2000-01-30",
})
check("fresh rate added", status == 200, f"({status}) {res}")
status, closed = call("POST", "/api/accounting/period-close", period)
check("close succeeds with a rate dated within 7 days", status == 200, f"({status}) {closed}")
if status == 200:
    check("close reports the rate and its date",
          closed["exchange_rate"] == 20 and str(closed["rate_date"]) == "2000-01-30", closed)
    check("close reports combined net income",
          "combined_usd" in closed["net_income"] and "combined_mxn" in closed["net_income"], closed)
    check("close no longer books or reports FX gain/loss",
          "fx_gain_loss" not in closed and float(closed["closing"]["fx_gain_loss"]) == 0
          and closed["closing"]["revaluation_transaction_id"] is None, closed)

    # --- the income statement must not be wiped out by the closing entry ------
    status, inc = call("GET", "/api/accounting/reports/income-statement"
                              "?start_date=2000-01-01&end_date=2000-01-31&currency=USD")
    check("income statement still shows closed-period revenue",
          status == 200 and abs(float(inc["revenue"]["total"]) - 500) < 0.01, f"({status}) {inc}")
    check("income statement net income matches the close",
          status == 200 and abs(float(inc["net_income"]) - 500) < 0.01, f"({status}) {inc}")

print()
print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
