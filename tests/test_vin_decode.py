#!/usr/bin/env python3
"""
End-to-end exercise of the VIN decode endpoint against a running API.

    export DATABASE_URL=postgres://.../buses_test
    uvicorn backend_api_FINAL:app --port 8099 &
    API=http://127.0.0.1:8099 TOKEN=<session token> python tests/test_vin_decode.py

Unlike every other test in this directory, this one needs outbound internet
access - GET /api/vin-decode/{vin} calls NHTSA's real vPIC API
(vpic.nhtsa.dot.gov), there being no mocking infrastructure in this project
to stand in for it.

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


def call(method, path):
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}"},
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
print("VIN decode - end to end")
print("=" * 62)

# --- a real, decodable VIN -------------------------------------------------
# 1FDXE45S6XHA98058: a 1999 Ford school-bus-chassis VIN, chosen because it's
# a well-known example VIN that vPIC has always decoded cleanly.
status, body = call("GET", "/api/vin-decode/1FDXE45S6XHA98058")
check("decode request succeeds", status == 200, f"({status}) {body}")
if status == 200:
    decoded = body.get("decoded", {})
    check("year decoded", decoded.get("year") == 1999, decoded.get("year"))
    check("make decoded", (decoded.get("make") or "").upper() == "FORD", decoded.get("make"))
    check("source reported", body.get("source") == "NHTSA vPIC", body.get("source"))

# --- malformed VIN ----------------------------------------------------------
status, body = call("GET", "/api/vin-decode/TOOSHORT")
check("malformed VIN rejected with 400", status == 400, f"({status}) {body}")

print("=" * 62)
print(f"{passed} passed, {failed} failed")
print("=" * 62)
sys.exit(1 if failed else 0)
