// QuoteDocument.jsx - Client-facing printable quote
// Print (or "Save as PDF") produces the document alone; the app chrome is hidden.

const QuoteDocument = ({ quote, onClose }) => {
  if (!quote) return null;

  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #quote-document, #quote-document * { visibility: visible; }
        #quote-document {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        .no-print { display: none !important; }
        @page { margin: 12mm; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const fmt = (amount) => {
    const value = Number(amount || 0);
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return quote.currency === 'MXN' ? `MXN $${formatted}` : `USD $${formatted}`;
  };

  const fmtDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  };

  const statusColors = {
    Draft: { bg: '#6b7280', fg: 'white' },
    Sent: { bg: '#2563eb', fg: 'white' },
    Accepted: { bg: '#059669', fg: 'white' },
    Rejected: { bg: '#dc2626', fg: 'white' },
    Expired: { bg: '#b45309', fg: 'white' },
    Cancelled: { bg: '#374151', fg: 'white' }
  };
  const badge = statusColors[quote.status] || statusColors.Draft;

  const lines = quote.line_items || [];
  const units = lines.filter((l) => l.line_type === 'bus');
  const charges = lines.filter((l) => l.line_type !== 'bus');

  const cell = { padding: '0.7rem 0.6rem', fontSize: '0.85rem', verticalAlign: 'top' };
  const headCell = {
    padding: '0.6rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#1a1a1a', borderBottom: '2px solid #FFD700', textAlign: 'left'
  };
  const termBlock = { marginBottom: '0.9rem' };
  const termLabel = {
    fontSize: '0.7rem', fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem'
  };
  const termText = { fontSize: '0.85rem', color: '#1a1a1a', lineHeight: '1.5', whiteSpace: 'pre-wrap' };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto', zIndex: 1000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: '100%', maxWidth: '900px' }}>
        {/* Toolbar (never printed) */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1rem'
        }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '0.7rem 1.4rem', background: '#FFD700', color: '#1a1a1a',
              border: 'none', borderRadius: '0.4rem', fontWeight: '700', cursor: 'pointer'
            }}
          >
            🖨️ Print / Save as PDF
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.7rem 1.4rem', background: 'rgba(255,255,255,0.15)', color: 'white',
              border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.4rem', fontWeight: '600', cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

        <div id="quote-document" style={{ background: 'white', borderRadius: '0.5rem', overflow: 'hidden' }}>
          {/* Letterhead */}
          <div style={{ background: '#1a1a1a', padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <img
                src={window.LOGO_PATH || './logo.png'}
                alt="Buses America"
                style={{ width: '58px', height: '58px', objectFit: 'contain' }}
              />
              <div>
                <div style={{ color: 'white', fontSize: '1.4rem', fontWeight: '700', letterSpacing: '0.02em' }}>
                  BUSES AMERICA
                </div>
                <div style={{ color: '#FFD700', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  Juntos Movemos América · 30 Years of Excellence
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginTop: '0.3rem' }}>
                  www.busesamerica.com
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#FFD700', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.12em' }}>
                QUOTATION / COTIZACIÓN
              </div>
              <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: '700', marginTop: '0.2rem' }}>
                {quote.quote_number}
              </div>
              <div style={{
                display: 'inline-block', marginTop: '0.5rem', padding: '0.25rem 0.75rem',
                borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700',
                background: badge.bg, color: badge.fg, letterSpacing: '0.05em'
              }}>
                {String(quote.status).toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ padding: '2rem' }}>
            {/* Parties + dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <div style={termLabel}>Prepared for</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1a1a1a' }}>
                  {quote.client_company || quote.client_name}
                </div>
                {quote.client_company && quote.client_name && (
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>{quote.client_name}</div>
                )}
                {quote.client_contact && (
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>Attn: {quote.client_contact}</div>
                )}
                <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.4rem', lineHeight: '1.55' }}>
                  {quote.billing_address && <div style={{ whiteSpace: 'pre-wrap' }}>{quote.billing_address}</div>}
                  {quote.client_location && <div>{quote.client_location}</div>}
                  {quote.client_email && <div>{quote.client_email}</div>}
                  {quote.client_phone && <div>{quote.client_phone}</div>}
                  {quote.client_tax_id && <div>Tax ID / RFC: {quote.client_tax_id}</div>}
                </div>
              </div>

              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.4rem', padding: '1rem' }}>
                {[
                  ['Quote date', fmtDate(quote.quote_date)],
                  ['Valid until', fmtDate(quote.valid_until)],
                  ['Currency', quote.currency],
                  quote.exchange_rate ? ['Reference rate', `1 USD = ${Number(quote.exchange_rate).toFixed(4)} MXN`] : null,
                  quote.created_by ? ['Prepared by', quote.created_by] : null
                ].filter(Boolean).map(([name, value]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0' }}>
                    <span style={{ color: '#6b7280' }}>{name}</span>
                    <span style={{ color: '#1a1a1a', fontWeight: '600', textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Units */}
            {units.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ ...termLabel, marginBottom: '0.5rem' }}>Vehicles</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={headCell}>Unit</th>
                      <th style={headCell}>Specifications</th>
                      <th style={{ ...headCell, textAlign: 'right' }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((line) => (
                      <tr key={line.line_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={cell}>
                          <div style={{ fontWeight: '700', color: '#1a1a1a' }}>{line.description}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                            {line.vin ? `VIN ${line.vin}` : ''}
                          </div>
                          {line.notes && (
                            <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '0.35rem', fontStyle: 'italic' }}>
                              {line.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ ...cell, color: '#374151', fontSize: '0.8rem' }}>
                          {[
                            line.body_style,
                            line.passenger_capacity ? `${line.passenger_capacity} passengers` : null,
                            line.odometer != null ? `${Number(line.odometer).toLocaleString('en-US')} mi` : null
                          ].filter(Boolean).map((spec, i) => (
                            <div key={i}>{spec}</div>
                          ))}
                        </td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {fmt(line.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Charges */}
            {charges.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ ...termLabel, marginBottom: '0.5rem' }}>Additional charges</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={headCell}>Description</th>
                      <th style={{ ...headCell, textAlign: 'right', width: '80px' }}>Qty</th>
                      <th style={{ ...headCell, textAlign: 'right', width: '130px' }}>Unit</th>
                      <th style={{ ...headCell, textAlign: 'right', width: '130px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((line) => (
                      <tr key={line.line_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={cell}>
                          <div style={{ color: '#1a1a1a' }}>{line.description}</div>
                          {line.notes && (
                            <div style={{ fontSize: '0.78rem', color: '#6b7280', fontStyle: 'italic', marginTop: '0.2rem' }}>
                              {line.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>{Number(line.quantity)}</td>
                        <td style={{ ...cell, textAlign: 'right' }}>{fmt(line.unit_price)}</td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {fmt(line.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
              <div style={{ width: '340px', maxWidth: '100%' }}>
                {[
                  ['Subtotal', fmt(quote.subtotal)],
                  Number(quote.discount_amount) ? ['Discount', `− ${fmt(quote.discount_amount)}`] : null,
                  Number(quote.tax_amount) ? [`Tax (${Number(quote.tax_rate)}%)`, fmt(quote.tax_amount)] : null
                ].filter(Boolean).map(([name, value]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.88rem', color: '#374151' }}>
                    <span>{name}</span><span>{value}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem',
                  background: '#1a1a1a', color: '#FFD700', padding: '0.8rem 1rem',
                  borderRadius: '0.4rem', fontSize: '1.1rem', fontWeight: '700'
                }}>
                  <span>TOTAL</span><span>{fmt(quote.total_amount)}</span>
                </div>
                {quote.deposit_required != null && Number(quote.deposit_required) > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem',
                    padding: '0.5rem 1rem', border: '1px dashed #d1d5db', borderRadius: '0.4rem',
                    fontSize: '0.85rem', color: '#374151'
                  }}>
                    <span>
                      Deposit to reserve
                      {quote.deposit_percent ? ` (${Number(quote.deposit_percent)}%)` : ''}
                    </span>
                    <span style={{ fontWeight: '700' }}>{fmt(quote.deposit_required)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Terms */}
            <div style={{ borderTop: '2px solid #FFD700', paddingTop: '1.25rem' }}>
              {quote.payment_terms && (
                <div style={termBlock}>
                  <div style={termLabel}>Payment terms</div>
                  <div style={termText}>{quote.payment_terms}</div>
                </div>
              )}
              {quote.delivery_terms && (
                <div style={termBlock}>
                  <div style={termLabel}>Delivery</div>
                  <div style={termText}>{quote.delivery_terms}</div>
                </div>
              )}
              {quote.warranty_terms && (
                <div style={termBlock}>
                  <div style={termLabel}>Warranty</div>
                  <div style={termText}>{quote.warranty_terms}</div>
                </div>
              )}
              {quote.notes && (
                <div style={termBlock}>
                  <div style={termLabel}>Notes</div>
                  <div style={termText}>{quote.notes}</div>
                </div>
              )}
            </div>

            {/* Acceptance block */}
            <div style={{
              marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb'
            }}>
              <div>
                <div style={{ borderBottom: '1px solid #9ca3af', height: '2.5rem' }}></div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.35rem' }}>
                  Client signature / Firma del cliente
                </div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #9ca3af', height: '2.5rem' }}></div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.35rem' }}>
                  Date / Fecha
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.75rem', fontSize: '0.7rem', color: '#9ca3af', lineHeight: '1.6', textAlign: 'center' }}>
              This quotation is valid until {fmtDate(quote.valid_until)} and is subject to unit availability at the
              time of acceptance. All prices are stated in {quote.currency}.
              <div style={{ marginTop: '0.35rem', color: '#FFD700', fontWeight: '700' }}>
                ¡Juntos Movemos América! 🚌
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
