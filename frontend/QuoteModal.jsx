// QuoteModal.jsx - Create / edit a quote
// Header details + line items (inventory units and ad-hoc charges).
// Totals mirror the server-side calculation so the user sees them live,
// but the server is always the source of truth on save.

const QuoteModal = ({ quote, clients, currentUser, onClose, onSaved }) => {
  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';
  const isEdit = !!(quote && quote.quote_id);

  const today = new Date().toISOString().split('T')[0];
  const inDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Each seller quotes under their own name and number. Remember what this
  // browser used last so it only has to be typed once, but store the value on
  // the quote itself so a reprint always shows whoever issued it.
  const remembered = (key) => {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  };

  const [form, setForm] = React.useState({
    client_id: quote?.client_id || '',
    client_name: quote?.client_name || '',
    client_company: quote?.client_company || '',
    client_contact: quote?.client_contact || '',
    client_email: quote?.client_email || '',
    client_phone: quote?.client_phone || '',
    client_location: quote?.client_location || '',
    client_tax_id: quote?.client_tax_id || '',
    billing_address: quote?.billing_address || '',
    quote_date: quote?.quote_date ? quote.quote_date.split('T')[0] : today,
    valid_until: quote?.valid_until ? quote.valid_until.split('T')[0] : inDays(30),
    currency: quote?.currency || 'USD',
    discount_amount: quote?.discount_amount != null ? String(quote.discount_amount) : '0',
    tax_rate: quote?.tax_rate != null ? String(quote.tax_rate) : '0',
    deposit_percent: quote?.deposit_percent != null ? String(quote.deposit_percent) : '30',
    payment_terms: quote?.payment_terms || 'Deposit on acceptance, balance due before delivery.',
    delivery_terms: quote?.delivery_terms || '',
    warranty_terms: quote?.warranty_terms || '60-day warranty on engine and transmission from delivery date.',
    notes: quote?.notes || '',
    internal_notes: quote?.internal_notes || '',
    prepared_by_name: quote?.prepared_by_name || currentUser?.full_name || '',
    prepared_by_phone: quote?.prepared_by_phone || remembered('quote_seller_phone'),
    prepared_by_email: quote?.prepared_by_email || currentUser?.email || remembered('quote_seller_email')
  });

  const [lines, setLines] = React.useState(
    (quote?.line_items || []).map((li) => ({
      key: `existing-${li.line_id}`,
      line_type: li.line_type,
      inventory_id: li.inventory_id || '',
      description: li.description || '',
      quantity: String(li.quantity ?? 1),
      unit_price: String(li.unit_price ?? 0),
      notes: li.notes || ''
    }))
  );

  const [availableUnits, setAvailableUnits] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [unitPickerOpen, setUnitPickerOpen] = React.useState(false);
  const [unitSearch, setUnitSearch] = React.useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('session_token')}`
  });

  React.useEffect(() => {
    loadAvailableUnits();
  }, []);

  const loadAvailableUnits = async () => {
    try {
      const res = await fetch(`${API_URL}/quotes/inventory/available`, { headers: authHeaders() });
      if (res.ok) setAvailableUnits(await res.json());
    } catch (e) {
      console.error('Error loading available units:', e);
    }
  };

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const onClientChange = (value) => {
    if (!value) {
      setForm((prev) => ({ ...prev, client_id: '' }));
      return;
    }
    const client = (clients || []).find((c) => String(c.client_id) === String(value));
    setForm((prev) => ({
      ...prev,
      client_id: value,
      client_name: client?.client_name || prev.client_name,
      client_company: client?.client_company || '',
      client_contact: client?.contact_person || '',
      client_email: client?.client_email || '',
      client_phone: client?.client_phone || '',
      client_location: client?.client_location || '',
      client_tax_id: client?.tax_id || '',
      billing_address: client?.billing_address || ''
    }));
  };

  const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const addUnitLine = (unit) => {
    if (lines.some((l) => l.line_type === 'bus' && String(l.inventory_id) === String(unit.inventory_id))) {
      setError(`${unit.stock_number} is already on this quote.`);
      return;
    }
    setError(null);
    setLines((prev) => [
      ...prev,
      {
        key: `unit-${unit.inventory_id}-${Date.now()}`,
        line_type: 'bus',
        inventory_id: unit.inventory_id,
        description: `${unit.year || ''} ${unit.make || ''} ${unit.model || ''}`.trim() + ` — Stock ${unit.stock_number}`,
        quantity: '1',
        unit_price: unit.asking_price != null ? String(unit.asking_price) : '0',
        notes: ''
      }
    ]);
    setUnitPickerOpen(false);
    setUnitSearch('');
  };

  const addChargeLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: `charge-${Date.now()}`,
        line_type: 'charge',
        inventory_id: '',
        description: '',
        quantity: '1',
        unit_price: '0',
        notes: ''
      }
    ]);
  };

  const updateLine = (key, field, value) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  // --- Live totals (same arithmetic the server does) ---
  const subtotal = lines.reduce((sum, l) => sum + num(l.quantity) * num(l.unit_price), 0);
  const discount = num(form.discount_amount);
  const taxable = subtotal - discount;
  const tax = taxable * (num(form.tax_rate) / 100);
  const total = taxable + tax;
  const deposit = total * (num(form.deposit_percent) / 100);

  const fmt = (amount) => formatCurrency(amount, form.currency);

  const handleSave = async () => {
    setError(null);

    if (!form.client_name.trim()) {
      setError('A client name is required.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one line item.');
      return;
    }
    const badCharge = lines.find((l) => l.line_type === 'charge' && !l.description.trim());
    if (badCharge) {
      setError('Every charge line needs a description.');
      return;
    }

    const payload = {
      ...form,
      client_id: form.client_id ? parseInt(form.client_id, 10) : null,
      discount_amount: num(form.discount_amount),
      tax_rate: num(form.tax_rate),
      deposit_percent: num(form.deposit_percent),
      line_items: lines.map((l) => ({
        line_type: l.line_type,
        inventory_id: l.line_type === 'bus' ? parseInt(l.inventory_id, 10) : null,
        description: l.description,
        quantity: num(l.quantity) || 1,
        unit_price: num(l.unit_price),
        notes: l.notes || null
      }))
    };

    try {
      if (form.prepared_by_phone) localStorage.setItem('quote_seller_phone', form.prepared_by_phone);
      if (form.prepared_by_email) localStorage.setItem('quote_seller_email', form.prepared_by_email);
    } catch (e) { /* private browsing — the values still save on the quote */ }

    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `${API_URL}/quotes/${quote.quote_id}` : `${API_URL}/quotes`,
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Could not save the quote.');
        return;
      }
      onSaved(data);
    } catch (e) {
      setError(`Could not reach the server: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredUnits = availableUnits.filter((u) => {
    if (!unitSearch) return true;
    const s = unitSearch.toLowerCase();
    return (
      u.stock_number?.toLowerCase().includes(s) ||
      u.vin?.toLowerCase().includes(s) ||
      u.make?.toLowerCase().includes(s) ||
      u.model?.toLowerCase().includes(s) ||
      String(u.year || '').includes(s)
    );
  });

  const input = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.4rem',
    fontSize: '0.875rem'
  };
  const label = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '0.3rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  };
  const card = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.6rem',
    padding: '1.25rem',
    marginBottom: '1.25rem'
  };
  const sectionTitle = {
    margin: '0 0 1rem 0',
    fontSize: '1rem',
    fontWeight: '700',
    color: '#1a1a1a'
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto', zIndex: 1000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#f9fafb', borderRadius: '0.75rem', width: '100%', maxWidth: '1100px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          background: '#1a1a1a', padding: '1.25rem 1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ color: '#FFD700', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em' }}>
              BUSES AMERICA
            </div>
            <h2 style={{ margin: '0.25rem 0 0 0', color: 'white', fontSize: '1.35rem' }}>
              {isEdit ? `Edit ${quote.quote_number}` : 'New Quote'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', fontSize: '1.25rem', width: '2.5rem', height: '2.5rem',
              borderRadius: '0.4rem', cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1.5rem', maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }}>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
              padding: '0.75rem 1rem', borderRadius: '0.4rem', marginBottom: '1.25rem', fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          {/* CLIENT */}
          <div style={card}>
            <h3 style={sectionTitle}>👥 Client</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
              <div>
                <label style={label}>Existing client</label>
                <select style={input} value={form.client_id} onChange={(e) => onClientChange(e.target.value)}>
                  <option value="">— New / one-off client —</option>
                  {(clients || []).map((c) => (
                    <option key={c.client_id} value={c.client_id}>
                      {c.client_name}{c.client_company ? ` (${c.client_company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Client name *</label>
                <input style={input} value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} />
              </div>
              <div>
                <label style={label}>Company</label>
                <input style={input} value={form.client_company} onChange={(e) => setField('client_company', e.target.value)} />
              </div>
              <div>
                <label style={label}>Contact person</label>
                <input style={input} value={form.client_contact} onChange={(e) => setField('client_contact', e.target.value)} />
              </div>
              <div>
                <label style={label}>Email</label>
                <input style={input} value={form.client_email} onChange={(e) => setField('client_email', e.target.value)} />
              </div>
              <div>
                <label style={label}>Phone</label>
                <input style={input} value={form.client_phone} onChange={(e) => setField('client_phone', e.target.value)} />
              </div>
              <div>
                <label style={label}>Destination / location</label>
                <input style={input} value={form.client_location} onChange={(e) => setField('client_location', e.target.value)} />
              </div>
              <div>
                <label style={label}>Tax ID / RFC</label>
                <input style={input} value={form.client_tax_id} onChange={(e) => setField('client_tax_id', e.target.value)} />
              </div>
            </div>
          </div>

          {/* QUOTE DETAILS */}
          <div style={card}>
            <h3 style={sectionTitle}>📄 Quote details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem' }}>
              <div>
                <label style={label}>Quote date</label>
                <input type="date" style={input} value={form.quote_date} onChange={(e) => setField('quote_date', e.target.value)} />
              </div>
              <div>
                <label style={label}>Valid until</label>
                <input type="date" style={input} value={form.valid_until} onChange={(e) => setField('valid_until', e.target.value)} />
              </div>
              <div>
                <label style={label}>Currency</label>
                <select style={input} value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
              <div>
                <label style={label}>Deposit % (internal)</label>
                <input type="number" step="0.1" style={input} value={form.deposit_percent} onChange={(e) => setField('deposit_percent', e.target.value)} />
              </div>
            </div>
          </div>

          {/* LINE ITEMS */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ ...sectionTitle, margin: 0 }}>🚌 Line items</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setUnitPickerOpen(!unitPickerOpen)}
                  style={{ ...buttonStyle('primary', 'sm'), padding: '0.5rem 1rem' }}
                >
                  ➕ Add unit
                </button>
                <button
                  onClick={addChargeLine}
                  style={{ ...buttonStyle('dark', 'sm'), padding: '0.5rem 1rem' }}
                >
                  ➕ Add charge
                </button>
              </div>
            </div>

            {unitPickerOpen && (
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: '0.5rem', marginBottom: '1rem',
                background: '#fafafa', maxHeight: '300px', overflowY: 'auto'
              }}>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', background: 'white' }}>
                  <input
                    autoFocus
                    placeholder="🔍 Search available units by stock, VIN, make, model, year…"
                    style={input}
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                  />
                </div>
                {filteredUnits.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                    No unsold units match that search.
                  </div>
                ) : (
                  filteredUnits.map((u) => (
                    <div
                      key={u.inventory_id}
                      onClick={() => addUnitLine(u)}
                      style={{
                        padding: '0.75rem 1rem', borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                          {u.year} {u.make} {u.model}
                          {u.open_quote_count > 0 && (
                            <span style={{
                              marginLeft: '0.5rem', fontSize: '0.7rem', background: '#fef3c7',
                              color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: '700'
                            }}>
                              on {u.open_quote_count} open quote{u.open_quote_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                          Stock {u.stock_number} · VIN {u.vin} · {u.status}
                        </div>
                      </div>
                      <div style={{ fontWeight: '700', color: '#059669', fontSize: '0.9rem' }}>
                        {u.asking_price != null
                          ? `${u.asking_currency === 'MXN' ? 'MXN $' : '$'}${Number(u.asking_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : 'no asking price'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {lines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', fontSize: '0.9rem' }}>
                No line items yet. Add a unit from inventory, or a charge such as transport or import.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '0.6rem', textAlign: 'left', width: '80px' }}>Type</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right', width: '90px' }}>Qty</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right', width: '140px' }}>Unit price</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right', width: '140px' }}>Total</th>
                      <th style={{ padding: '0.6rem', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: '700', padding: '0.2rem 0.5rem', borderRadius: '999px',
                            background: l.line_type === 'bus' ? '#fef9c3' : '#e0e7ff',
                            color: l.line_type === 'bus' ? '#854d0e' : '#3730a3'
                          }}>
                            {l.line_type === 'bus' ? 'UNIT' : 'CHARGE'}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            style={{ ...input, padding: '0.45rem 0.6rem' }}
                            value={l.description}
                            placeholder={l.line_type === 'charge' ? 'e.g. Transport to Monterrey' : ''}
                            onChange={(e) => updateLine(l.key, 'description', e.target.value)}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number" step="0.01"
                            disabled={l.line_type === 'bus'}
                            style={{ ...input, padding: '0.45rem 0.6rem', textAlign: 'right', background: l.line_type === 'bus' ? '#f3f4f6' : 'white' }}
                            value={l.quantity}
                            onChange={(e) => updateLine(l.key, 'quantity', e.target.value)}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number" step="0.01"
                            style={{ ...input, padding: '0.45rem 0.6rem', textAlign: 'right' }}
                            value={l.unit_price}
                            onChange={(e) => updateLine(l.key, 'unit_price', e.target.value)}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>
                          {fmt(num(l.quantity) * num(l.unit_price))}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={() => removeLine(l.key)}
                            title="Remove line"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#dc2626' }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TOTALS */}
          <div style={card}>
            <h3 style={sectionTitle}>💰 Totals</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={label}>Discount amount</label>
                <input type="number" step="0.01" style={input} value={form.discount_amount} onChange={(e) => setField('discount_amount', e.target.value)} />
              </div>
              <div>
                <label style={label}>Tax rate (%)</label>
                <input type="number" step="0.001" style={input} value={form.tax_rate} onChange={(e) => setField('tax_rate', e.target.value)} />
              </div>
            </div>
            <div style={{ background: '#1a1a1a', borderRadius: '0.5rem', padding: '1.25rem', color: 'white' }}>
              {[
                ['Subtotal', fmt(subtotal)],
                ['Discount', discount ? `− ${fmt(discount)}` : fmt(0)],
                [`Tax (${num(form.tax_rate)}%)`, fmt(tax)]
              ].map(([name, value]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.9rem', color: '#d1d5db' }}>
                  <span>{name}</span><span>{value}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem',
                borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: '1.25rem', fontWeight: '700', color: '#FFD700'
              }}>
                <span>Total</span><span>{fmt(total)}</span>
              </div>
              {num(form.deposit_percent) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: '#9ca3af' }}>
                  <span>Deposit due on acceptance ({num(form.deposit_percent)}%)</span>
                  <span>{fmt(deposit)}</span>
                </div>
              )}
            </div>
          </div>

          {/* PREPARED BY */}
          <div style={card}>
            <h3 style={sectionTitle}>✍️ Elaborado por</h3>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              Printed at the bottom of the client quote. Defaults to you; change it when
              quoting on behalf of another seller.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem' }}>
              <div>
                <label style={label}>Name</label>
                <input style={input} value={form.prepared_by_name} onChange={(e) => setField('prepared_by_name', e.target.value)} />
              </div>
              <div>
                <label style={label}>Phone</label>
                <input style={input} placeholder="+52 899 000 0000" value={form.prepared_by_phone} onChange={(e) => setField('prepared_by_phone', e.target.value)} />
              </div>
              <div>
                <label style={label}>Email</label>
                <input style={input} value={form.prepared_by_email} onChange={(e) => setField('prepared_by_email', e.target.value)} />
              </div>
            </div>
          </div>

          {/* TERMS */}
          <div style={card}>
            <h3 style={sectionTitle}>📋 Terms &amp; notes</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={label}>Payment terms</label>
                <textarea rows="2" style={{ ...input, fontFamily: 'inherit' }} value={form.payment_terms} onChange={(e) => setField('payment_terms', e.target.value)} />
              </div>
              <div>
                <label style={label}>Delivery terms</label>
                <textarea rows="2" style={{ ...input, fontFamily: 'inherit' }} value={form.delivery_terms} onChange={(e) => setField('delivery_terms', e.target.value)} />
              </div>
              <div>
                <label style={label}>Warranty terms</label>
                <textarea rows="2" style={{ ...input, fontFamily: 'inherit' }} value={form.warranty_terms} onChange={(e) => setField('warranty_terms', e.target.value)} />
              </div>
              <div>
                <label style={label}>Notes to the client (printed on the quote)</label>
                <textarea rows="3" style={{ ...input, fontFamily: 'inherit' }} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
              </div>
              <div>
                <label style={label}>Internal notes (never printed)</label>
                <textarea rows="2" style={{ ...input, fontFamily: 'inherit', background: '#fffbeb' }} value={form.internal_notes} onChange={(e) => setField('internal_notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', background: 'white', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {lines.filter((l) => l.line_type === 'bus').length} unit(s) · total <strong>{fmt(total)}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={buttonStyle('outline', 'md')}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ ...buttonStyle('primary', 'md', saving), padding: '0.7rem 1.75rem' }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
