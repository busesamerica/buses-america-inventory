"""
VIN decoding via NHTSA's free vPIC API.

Used by the /api/vin-decode/{vin} endpoint to pre-fill year/make/model/
engine/etc. when a unit is being registered (Add New Bus form and the
Pre-Purchase Inspection form both call this through that endpoint). No API
key is required - vPIC is a free public NHTSA service.

Docs: https://vpic.nhtsa.dot.gov/api/
"""

import re
import httpx

VPIC_BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended"

# vPIC uses these as placeholder values for "no data" instead of omitting
# the key or using null - both show up throughout Results[0], so every
# mapped field is filtered through this before being handed back.
_EMPTY_VALUES = {"", "not applicable", "n/a", "na"}


def _clean(value):
    """Normalize a vPIC field into a real value or None (never "" / "Not Applicable")."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in _EMPTY_VALUES:
        return None
    return text


def _parse_gvwr(raw):
    """
    vPIC's GVWR field is a descriptive range like "Class 4: 14,001 - 16,000 lb",
    not a bare number. Pull the last (upper-bound) integer out of it - if the
    string doesn't look like that, there's nothing safe to guess, so return
    None rather than saving a wrong weight.
    """
    text = _clean(raw)
    if text is None:
        return None
    numbers = re.findall(r"[\d,]+", text)
    if not numbers:
        return None
    try:
        return int(numbers[-1].replace(",", ""))
    except ValueError:
        return None


def _parse_length_feet(raw):
    """vPIC's BusLength is in inches; the inventory schema stores length_feet."""
    text = _clean(raw)
    if text is None:
        return None
    match = re.search(r"[\d.]+", text)
    if not match:
        return None
    try:
        inches = float(match.group())
        return round(inches / 12, 2)
    except ValueError:
        return None


def _derive_engine_type(fuel_type_primary):
    """
    Best-effort normalization of vPIC's free-text FuelTypePrimary into the
    short set of values ('Diesel'/'Gasoline'/'CNG') this app's engine_type
    field expects. Falls back to None (leave it blank) rather than guessing
    wrong for anything unrecognized (hybrid, electric, propane, etc).
    """
    text = _clean(fuel_type_primary)
    if text is None:
        return None
    lowered = text.lower()
    if "diesel" in lowered:
        return "Diesel"
    if "gasoline" in lowered or "petrol" in lowered:
        return "Gasoline"
    if "compressed natural gas" in lowered or lowered == "cng" or "cng" in lowered:
        return "CNG"
    if "electric" in lowered:
        return "Electric"
    return None


def _derive_body_style(bus_type, body_class, vehicle_type):
    """
    Best-effort mapping to this app's body_style values ('School Bus',
    'Transit Bus', 'Shuttle'). vPIC's BusType is the most reliable signal
    when present; BodyClass/VehicleType are a fallback for VINs vPIC didn't
    classify as BusType. Returns None (leave the field blank) rather than a
    guess when nothing matches - a wrong body_style is worse than a blank one.
    """
    for candidate in (bus_type, body_class, vehicle_type):
        text = _clean(candidate)
        if text is None:
            continue
        lowered = text.lower()
        if "school" in lowered:
            return "School Bus"
        if "transit" in lowered:
            return "Transit Bus"
        if "shuttle" in lowered:
            return "Shuttle"
    return None


def _is_valid_vin_format(vin):
    """17 alphanumeric characters, excluding I/O/Q per the VIN standard (ISO 3779)."""
    return bool(re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", vin.upper()))


async def decode_vin(vin: str) -> dict:
    """
    Decode a VIN via NHTSA vPIC and map the result onto this app's
    inventory field names.

    Raises ValueError for a malformed VIN (caller turns that into a 400 -
    no network call wasted on something that can't be a real VIN). Never
    raises just because vPIC couldn't identify the vehicle or flagged a
    check-digit mismatch - those come back as a partial/empty `decoded`
    dict plus a note, so the caller can fall back to manual entry instead
    of erroring out the whole form.
    """
    vin = (vin or "").strip().upper()
    if not _is_valid_vin_format(vin):
        raise ValueError("VIN must be 17 characters (letters and digits, excluding I/O/Q)")

    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(f"{VPIC_BASE_URL}/{vin}", params={"format": "json"})
        response.raise_for_status()
        payload = response.json()

    results = payload.get("Results") or []
    result = results[0] if results else {}

    decoded = {
        "year": None,
        "make": _clean(result.get("Make")),
        "model": _clean(result.get("Model")),
        "engine_make": _clean(result.get("EngineManufacturer")),
        "engine_model": _clean(result.get("EngineModel")),
        "fuel_type": _clean(result.get("FuelTypePrimary")),
        "engine_type": _derive_engine_type(result.get("FuelTypePrimary")),
        "transmission": _clean(result.get("TransmissionStyle")),
        "body_style": _derive_body_style(
            result.get("BusType"), result.get("BodyClass"), result.get("VehicleType")
        ),
        "gvwr": _parse_gvwr(result.get("GVWR")),
        "length_feet": _parse_length_feet(result.get("BusLength")),
    }

    year_text = _clean(result.get("ModelYear"))
    if year_text is not None:
        try:
            decoded["year"] = int(year_text)
        except ValueError:
            decoded["year"] = None

    # Drop unmapped (None) fields - the caller only wants what it can use.
    decoded = {k: v for k, v in decoded.items() if v is not None}

    error_text = _clean(result.get("ErrorText"))
    error_code = _clean(result.get("ErrorCode"))
    # ErrorCode "0" means "decoded cleanly" - vPIC still returns it as text "0".
    warning = None
    if error_code and error_code != "0":
        warning = error_text or "NHTSA could not fully decode this VIN"

    return {
        "vin": vin,
        "decoded": decoded,
        "warning": warning,
        "source": "NHTSA vPIC",
    }
