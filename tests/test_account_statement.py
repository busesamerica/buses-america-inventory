#!/usr/bin/env python3
"""
End-to-end exercise of the account statement (ledger) endpoint against a
running API:

    export DATABASE_URL=postgres://.../buses_test
    uvicorn backend_api_FINAL:app --port 8099 &
    API=http://127.0.0.1:8099 TOKEN=<session token> python tests/test_account_statement.py

Creates its own throwaway journal entries (via POST /api/accounting/transactions)
against the seeded AR (USD) and Sales (USD) accounts rather than mutating any
other test's data, so it's safe to re-run against the same dev DB. Verifies:
  - entries come back in ascending date order
  - the running balance is internally consistent (recomputed from opening
    balance + each entry's debit/credit matches what the API returned)
  - the last entry's running balance equals closing_balance
  - closing_balance - opening_balance equals total_debit - total_credit,
    direction-adjusted for the account's type
  - start_date correctly folds earlier activity into opening_balance instead
    of dropping it
  - an unknown account_id 404s
  - both debit-increases (Asset) and credit-increases (Income) directions
    are exercised
  - an account with activity in more than one currency (e.g. an equity/
    distribution account with no USD/MXN split) returns a currency-choice
    response instead of silently summing USD and MXN together, and each
    currency's statement only reflects that currency's entries once chosen

See tests/dev_fixtures.sql / tests/seed_dev_data.sql for the local database
setup this assumes.
"""

import os
import sys
import time
import json
import datetime
import urllib.request
import urllib.error

API = os.getenv("API", "http://127.0.0.1:8099")
TOKEN = os.getenv("TOKEN", "TEST-TOKEN-123")
TODAY = datetime.date.today()

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


def post_entry(entry_date, ar_id, sales_id, amount, desc, currency="USD"):
    """Debit AR / Credit Sales — a simple, always-balanced two-line entry.

    create_transaction's debit=credit check is purely numeric (currency-
    blind, see backend_api_FINAL.py), so a single `currency` applied to both
    lines balances fine regardless of what currency either account itself
    is nominally in — this is exactly how a same-account_id, mixed-currency
    history (e.g. distribution accounts) can accumulate in the first place.
    """
    status, txn = call("POST", "/api/accounting/transactions", {
        "transaction_date": entry_date.isoformat(),
        "description": desc,
        "reference_type": "deposit",
        "currency": currency,
        "lines": [
            {"account_id": ar_id, "debit_amount": amount, "credit_amount": 0, "currency": currency},
            {"account_id": sales_id, "debit_amount": 0, "credit_amount": amount, "currency": currency},
        ],
    })
    check(f"posted '{desc}'", status == 200, f"({status}) {txn}")
    return status == 200


print("=" * 62)
print("Account statement (ledger) - end to end")
print("=" * 62)

status, accounts = call("GET", "/api/accounting/accounts")
ar_account = next(a for a in accounts if a["currency"] == "USD" and a["account_subtype"] == "AR")
sales_account = next(a for a in accounts if a["currency"] == "USD" and a["account_subtype"] == "Sales")
ar_id = ar_account["account_id"]
sales_id = sales_account["account_id"]

# --- 404 on an unknown account --------------------------------------------
status, err = call("GET", "/api/accounting/accounts/999999/statement")
check("unknown account_id returns 404", status == 404, f"({status}) {err}")

# --- seed two dated entries -------------------------------------------------
older_date = TODAY - datetime.timedelta(days=20)
newer_date = TODAY - datetime.timedelta(days=5)
post_entry(older_date, ar_id, sales_id, 1000, "test_account_statement — entry 1")
post_entry(newer_date, ar_id, sales_id, 500, "test_account_statement — entry 2")

# --- full-history statement on AR (Asset — debit increases) ----------------
status, ar_statement = call("GET", f"/api/accounting/accounts/{ar_id}/statement")
check("AR statement fetched", status == 200, f"({status}) {ar_statement}")

check(
    "AR statement resolves a single currency (backward-compat: single-currency account)",
    ar_statement.get("currency_choice_required") is False and ar_statement.get("currency") == "USD",
    (ar_statement.get("currency_choice_required"), ar_statement.get("currency")),
)

entries = ar_statement.get("entries", [])
check("AR has at least our 2 entries", len(entries) >= 2, len(entries))

dates = [e["transaction_date"] for e in entries]
check("entries are in ascending date order", dates == sorted(dates), dates)

# Recompute the running balance from the API's own opening_balance + each
# entry's debit/credit (Asset: debit increases) and confirm it matches what
# the API returned for every row — the strongest check that the running
# balance math is internally consistent, without hardcoding an absolute
# expected total that would break if other tests' postings exist in the DB.
running = float(ar_statement["opening_balance"])
mismatch = None
for e in entries:
    running += float(e["debit_amount"]) - float(e["credit_amount"])
    if abs(running - float(e["running_balance"])) > 0.01:
        mismatch = (e, running)
        break
check("running balance is internally consistent (AR, debit-increases)", mismatch is None, mismatch)

check(
    "last entry's running balance equals closing_balance",
    abs(float(entries[-1]["running_balance"]) - float(ar_statement["closing_balance"])) < 0.01,
    (entries[-1]["running_balance"], ar_statement["closing_balance"]),
)

expected_delta = float(ar_statement["total_debit"]) - float(ar_statement["total_credit"])
actual_delta = float(ar_statement["closing_balance"]) - float(ar_statement["opening_balance"])
check(
    "closing - opening equals total_debit - total_credit (Asset direction)",
    abs(expected_delta - actual_delta) < 0.01,
    (expected_delta, actual_delta),
)

# --- start_date folds earlier activity into opening_balance ----------------
split_date = newer_date.isoformat()
status, partial = call("GET", f"/api/accounting/accounts/{ar_id}/statement?start_date={split_date}")
check("partial statement fetched", status == 200, f"({status}) {partial}")

partial_dates = [e["transaction_date"] for e in partial["entries"]]
check(
    "partial statement excludes entries before start_date",
    all(d >= split_date for d in partial_dates),
    partial_dates,
)
check(
    "our 'entry 2' (on the split date) is still included",
    any("entry 2" in (e.get("description") or "") for e in partial["entries"]),
    partial_dates,
)
check(
    "our 'entry 1' (before the split date) is excluded from entries",
    all("entry 1" not in (e.get("description") or "") for e in partial["entries"]),
    partial_dates,
)

# Opening balance for the partial statement should equal the running balance
# right before the split date in the full-history statement.
running_before_split = float(ar_statement["opening_balance"])
for e in entries:
    if e["transaction_date"] >= split_date:
        break
    running_before_split += float(e["debit_amount"]) - float(e["credit_amount"])
check(
    "opening_balance with start_date matches full-history balance just before it",
    abs(running_before_split - float(partial["opening_balance"])) < 0.01,
    (running_before_split, partial["opening_balance"]),
)

# --- Sales (Income — credit increases) direction ----------------------------
status, sales_statement = call("GET", f"/api/accounting/accounts/{sales_id}/statement")
check("Sales statement fetched", status == 200, f"({status}) {sales_statement}")
check(
    "Sales statement resolves a single currency (backward-compat: single-currency account)",
    sales_statement.get("currency_choice_required") is False and sales_statement.get("currency") == "USD",
    (sales_statement.get("currency_choice_required"), sales_statement.get("currency")),
)

sales_entries = sales_statement.get("entries", [])
running = float(sales_statement["opening_balance"])
mismatch = None
for e in sales_entries:
    running += float(e["credit_amount"]) - float(e["debit_amount"])
    if abs(running - float(e["running_balance"])) > 0.01:
        mismatch = (e, running)
        break
check("running balance is internally consistent (Sales, credit-increases)", mismatch is None, mismatch)

# --- multi-currency account: 'BOTH'-style equity/distribution accounts -----
# Reproduces the bug directly rather than depending on production-only data
# (account codes 3100/3200/3201 only exist in production, not in this
# repo's fixtures): create a fresh account and post one entry in USD and
# one in MXN against the SAME account_id, exactly how record_profit_
# distribution accumulates mixed-currency history on a single equity
# account with no USD/MXN split.
status, multi_account = call("POST", "/api/accounting/accounts", {
    "account_code": f"TM{int(time.time())}",  # accounts.account_code is VARCHAR(20)
    "account_name": "Test Multi-Currency Equity Account",
    "account_type": "Equity",
    "account_subtype": "Distribution",
    "currency": "BOTH",
})
check("multi-currency test account created", status == 200, f"({status}) {multi_account}")
multi_id = multi_account["account_id"]

post_entry(older_date, ar_id, multi_id, 100, "test_account_statement — multi USD", currency="USD")
post_entry(newer_date, ar_id, multi_id, 2000, "test_account_statement — multi MXN", currency="MXN")

# No currency specified and more than one is present -> must ask, not guess.
status, ambiguous = call("GET", f"/api/accounting/accounts/{multi_id}/statement")
check("multi-currency statement fetched", status == 200, f"({status}) {ambiguous}")
check(
    "ambiguous multi-currency statement requires a currency choice",
    ambiguous.get("currency_choice_required") is True,
    ambiguous,
)
check(
    "ambiguous statement lists both currencies available",
    set(ambiguous.get("available_currencies") or []) == {"USD", "MXN"},
    ambiguous.get("available_currencies"),
)
check(
    "ambiguous statement returns no entries and no computed balance (never a mixed total)",
    ambiguous.get("entries") == [] and ambiguous.get("opening_balance") is None,
    ambiguous,
)

# Resolving to USD only reflects the USD entry.
status, multi_usd = call("GET", f"/api/accounting/accounts/{multi_id}/statement?currency=USD")
check("USD-scoped multi-currency statement fetched", status == 200, f"({status}) {multi_usd}")
check(
    "USD-scoped statement resolves to USD and is not ambiguous",
    multi_usd.get("currency_choice_required") is False and multi_usd.get("currency") == "USD",
    (multi_usd.get("currency_choice_required"), multi_usd.get("currency")),
)
check(
    "USD-scoped statement only contains the USD entry",
    len(multi_usd["entries"]) == 1 and multi_usd["entries"][0]["currency"] == "USD",
    multi_usd["entries"],
)

# Resolving to MXN only reflects the MXN entry.
status, multi_mxn = call("GET", f"/api/accounting/accounts/{multi_id}/statement?currency=MXN")
check("MXN-scoped multi-currency statement fetched", status == 200, f"({status}) {multi_mxn}")
check(
    "MXN-scoped statement only contains the MXN entry",
    len(multi_mxn["entries"]) == 1 and multi_mxn["entries"][0]["currency"] == "MXN",
    multi_mxn["entries"],
)

# Each currency's running balance is internally consistent on its own -
# this is the direct proof the fix stops summing USD and MXN together: a
# 100 USD entry and a 2000 MXN entry must NOT combine into one number.
check(
    "USD closing balance reflects only the 100 USD entry, not the MXN one too",
    abs(float(multi_usd["closing_balance"]) - 100) < 0.01,
    multi_usd["closing_balance"],
)
check(
    "MXN closing balance reflects only the 2000 MXN entry, not the USD one too",
    abs(float(multi_mxn["closing_balance"]) - 2000) < 0.01,
    multi_mxn["closing_balance"],
)

print("=" * 62)
print(f"{passed} passed, {failed} failed")
print("=" * 62)
sys.exit(1 if failed else 0)
