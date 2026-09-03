// Buses America - shared VIN decode helper
//
// Both registration entry points (BusForm in InventoryManagement.jsx and
// PreInspectionForm.jsx) need to call GET /api/vin-decode/{vin} the same
// way - same auth header, same error handling. This is that one place,
// following the same "load before any component script" convention as
// utils.js (formatCurrency/formatDate/etc).

// Returns { ok: true, decoded, warning } on success, or
// { ok: false, error } - the caller shows `error` inline near the VIN field
// rather than throwing, since a VIN that can't be decoded should never
// block filling in the form manually.
async function decodeVin(vin, apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/vin-decode/${encodeURIComponent(vin)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.detail || 'Could not decode this VIN' };
    }
    return { ok: true, decoded: data.decoded || {}, warning: data.warning || null };
  } catch (err) {
    return { ok: false, error: 'Could not reach the VIN decode service' };
  }
}
