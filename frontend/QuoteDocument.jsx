// QuoteDocument.jsx - Cotización para el cliente (documento imprimible)
//
// Layout follows the Buses America quote template: black letterhead with the
// company contact block, a COTIZACIÓN # / FECHA / VÁLIDA HASTA strip, a
// CLIENTE | DATOS DEL AUTOBÚS split, the price breakdown, and NOTAS Y
// CONDICIONES opposite ELABORADO POR over a black footer bar.
//
// Single-unit quotes get the full spec panel. Quotes carrying two or more units
// swap that panel for a UNIDADES table, since a spec panel per unit would not
// fit the page.
//
// Everything that is a screen control (status badge, buttons) is marked
// .no-print so it never reaches the PDF.

// Edit these to change what appears in the letterhead and under ELABORADO POR.
const BA_COMPANY = {
  name: 'Buses',
  nameAccent: 'America',
  tagline: 'Venta y Comercialización de Autobuses',
  address: 'José María Cantú #414 Doctores, Reynosa, Tamps.',
  phone: '+52 899 270 2339',
  email: 'contacto@busesamerica.com',
  website: 'www.busesamerica.com',
  slogan: 'Juntos Movemos América'
};

const QuoteDocument = ({ quote, onClose, currentUser }) => {
  if (!quote) return null;

  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        /* Every size in this document is expressed in rem, so shrinking the root
           font size scales the whole layout uniformly. A printed page is narrower
           than the 850px on-screen width, which makes the content taller; this
           brings a single-unit quote back onto one sheet without touching the
           on-screen design. */
        html { font-size: 14px; }

        /* Tighten the vertical rhythm for paper. A one-unit quote then lands on a
           single sheet at readable type sizes; longer quotes break between blocks
           rather than through them. */
        .q-band    { padding-top: 0.7rem !important; padding-bottom: 0.7rem !important; }
        .q-sec     { padding-top: 0.45rem !important; padding-bottom: 0.45rem !important; }
        .q-field   { margin-bottom: 0.4rem !important; }
        .q-rule    { margin-top: 0.35rem !important; margin-bottom: 0.35rem !important; }
        .q-legal   { padding-bottom: 0.3rem !important; padding-top: 0.2rem !important; }

        /* The footer bar is the last element; on its own it would orphan onto a
           second sheet for a quote that otherwise fits. Keep it with the block
           above it. */
        .q-foot    { break-before: avoid; page-break-before: avoid; }
        .q-seclbl  { margin-bottom: 0.5rem !important; }
        .q-tbl td  { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
        .q-tbl th  { padding-bottom: 0.45rem !important; }

        /* The document is portaled to <body>, so the whole application can simply
           be removed from the printed page. Hiding it with visibility:hidden
           instead would leave its layout behind and push the quote down the sheet. */
        body > *:not(#quote-print-root) { display: none !important; }

        /* On screen the document sits in a fixed, scrolling overlay. A fixed
           ancestor is viewport-sized, so anything below the fold would be cut off
           the printed page — a multi-page quote would lose its terms and footer.
           Unwind the overlay so the document flows into as many pages as it needs. */
        #quote-print-root {
          position: static !important;
          display: block !important;
          overflow: visible !important;
          padding: 0 !important;
          background: none !important;
          inset: auto !important;
        }
        .quote-print-page {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
        }
        #quote-document {
          position: static !important;
          width: 100%;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        /* Chrome leaves "Background graphics" unchecked by default, which would
           print the black letterhead and footer as white-on-white. Forcing exact
           colour adjustment makes them print without the user changing anything. */
        #quote-document, #quote-document * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print { display: none !important; }
        .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        @page { size: letter; margin: 9mm; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ---------------------------------------------------------------- helpers
  const money = (amount) => {
    const value = Number(amount || 0);
    const formatted = new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
    return `${value < 0 ? '−' : ''}$${formatted}`;
  };

  const fmtDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
    });
  };

  const number = (value) =>
    value == null ? null : new Intl.NumberFormat('es-MX').format(Number(value));

  const lines = quote.line_items || [];
  const units = lines.filter((l) => l.line_type === 'bus');
  const singleUnit = units.length === 1 ? units[0] : null;

  const engineOf = (unit) =>
    [unit.engine_type, unit.engine_make, unit.engine_model].filter(Boolean).join(' ') || null;

  // ------------------------------------------------------------ type styles
  const microLabel = {
    fontSize: '0.62rem',
    fontWeight: '700',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#9ca3af'
  };
  const sectionLabel = { ...microLabel, color: '#4b5563', marginBottom: '1rem' };
  const fieldLabel = { fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.1rem' };
  const fieldValue = { fontSize: '0.9rem', color: '#111827', lineHeight: '1.35' };
  const placeholder = { ...fieldValue, color: '#c4c4c4', fontStyle: 'italic' };
  const hairline = { border: 0, borderTop: '1px solid #e8e8e8', margin: '1.5rem 0' };

  // A labelled field. Empty values render as a grey italic hint, the way the
  // template shows "RFC / Tax ID" when no RFC has been captured.
  const Field = ({ label, value, hint }) => (
    <div className="q-field" style={{ marginBottom: '0.85rem' }}>
      <div style={fieldLabel}>{label}</div>
      <div style={value ? fieldValue : placeholder}>{value || hint || '—'}</div>
    </div>
  );

  const statusColors = {
    Draft: '#6b7280', Sent: '#2563eb', Accepted: '#059669',
    Rejected: '#dc2626', Expired: '#b45309', Cancelled: '#374151'
  };

  const notes = [
    quote.payment_terms && ['Condiciones de pago', quote.payment_terms],
    quote.delivery_terms && ['Entrega', quote.delivery_terms],
    quote.warranty_terms && ['Garantía', quote.warranty_terms],
    quote.notes && ['Notas', quote.notes]
  ].filter(Boolean);

  // Whoever issued the quote, captured on the quote itself so a reprint still
  // shows them. Falls back to the signed-in user for quotes made before this
  // was stored.
  const preparedBy = quote.prepared_by_name || currentUser?.full_name || quote.created_by || null;
  const preparedPhone = quote.prepared_by_phone || BA_COMPANY.phone;
  const preparedEmail = quote.prepared_by_email || BA_COMPANY.email;

  return ReactDOM.createPortal(
    <div
      id="quote-print-root"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto', zIndex: 1000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="quote-print-page" style={{ width: '100%', maxWidth: '850px' }}>
        {/* Screen-only toolbar */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '0.75rem', marginBottom: '1rem'
        }}>
          <span style={{
            padding: '0.3rem 0.85rem', borderRadius: '999px', fontSize: '0.7rem',
            fontWeight: '700', letterSpacing: '0.08em',
            background: statusColors[quote.status] || '#6b7280', color: 'white'
          }}>
            {String(quote.status).toUpperCase()}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '0.7rem 1.4rem', background: '#FFD700', color: '#1a1a1a',
                border: 'none', borderRadius: '0.4rem', fontWeight: '700', cursor: 'pointer'
              }}
            >
              🖨️ Imprimir / Guardar PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.7rem 1.4rem', background: 'rgba(255,255,255,0.15)', color: 'white',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.4rem',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div
          id="quote-document"
          style={{ background: 'white', fontFamily: 'inherit', color: '#111827' }}
        >
          {/* ============ LETTERHEAD ============ */}
          <div className="q-band" style={{
            background: '#111111', padding: '1.5rem 2.25rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem'
          }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <img
                src={window.LOGO_PATH || './logo.png'}
                alt="Buses America"
                style={{ width: '54px', height: '54px', objectFit: 'contain' }}
              />
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', lineHeight: '1.1' }}>
                  <span style={{ color: 'white' }}>{BA_COMPANY.name}</span>
                  <span style={{ color: '#FFD700' }}>{BA_COMPANY.nameAccent}</span>
                </div>
                <div style={{ color: '#FFD700', fontSize: '0.78rem', fontWeight: '600', marginTop: '0.25rem' }}>
                  {BA_COMPANY.slogan}
                </div>
                <div style={{ color: '#a3a3a3', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                  {BA_COMPANY.tagline}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: '#8a8a8a', fontSize: '0.72rem', lineHeight: '1.85' }}>
              <div>{BA_COMPANY.address}</div>
              <div>{BA_COMPANY.phone}</div>
              <div>{BA_COMPANY.email}</div>
            </div>
          </div>

          <div style={{ padding: '1.5rem 2.25rem 0' }}>
            {/* ============ META STRIP ============ */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              gap: '2rem', paddingBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.85rem' }}>
                <span style={microLabel}>Cotización #</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '700', letterSpacing: '-0.01em' }}>
                  {quote.quote_number}
                  {quote.revision > 1 && (
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: '500' }}>
                      {' '}rev. {quote.revision}
                    </span>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '2.5rem', textAlign: 'center' }}>
                <div>
                  <div style={microLabel}>Fecha</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{fmtDate(quote.quote_date)}</div>
                </div>
                <div>
                  <div style={microLabel}>Válida hasta</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{fmtDate(quote.valid_until)}</div>
                </div>
              </div>
            </div>
            <hr className="q-rule" style={{ ...hairline, margin: 0 }} />

            {/* ============ CLIENTE | DATOS DEL AUTOBÚS ============ */}
            <div
              className="avoid-break q-sec"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1px 1.15fr',
                gap: '2.25rem',
                padding: '1.75rem 0'
              }}
            >
              <div>
                <div className="q-seclbl" style={sectionLabel}>Cliente</div>
                <Field label="Nombre" value={quote.client_name} hint="Nombre del cliente" />
                <Field label="Empresa" value={quote.client_company} hint="Empresa" />
                <Field label="RFC" value={quote.client_tax_id} hint="RFC" />
                <Field
                  label="Dirección"
                  value={quote.billing_address || quote.client_location}
                  hint="Calle y número, Ciudad, Estado, C.P."
                />
                <Field label="Teléfono" value={quote.client_phone} hint="Teléfono" />
                <Field label="Correo" value={quote.client_email} hint="Correo electrónico" />
                {quote.client_contact && <Field label="Atención" value={quote.client_contact} />}
              </div>

              <div style={{ background: '#ececec' }} />

              <div>
                {singleUnit ? (
                  <React.Fragment>
                    <div className="q-seclbl" style={sectionLabel}>Datos del autobús</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.5rem' }}>
                      <Field label="Marca" value={singleUnit.make} hint="Marca" />
                      <Field label="Modelo" value={singleUnit.model} hint="Modelo" />
                      <Field label="Año" value={singleUnit.unit_year} hint="Año" />
                      <Field label="Color" value={singleUnit.exterior_color} hint="Color" />
                      <Field label="Kilómetros" value={number(singleUnit.odometer)} hint="N/D" />
                      <Field label="Pasajeros" value={singleUnit.passenger_capacity} hint="N/D" />
                      <Field label="Motor" value={engineOf(singleUnit)} hint="Motor" />
                      <Field label="Transmisión" value={singleUnit.transmission} hint="Transmisión" />
                    </div>
                    <Field label="No. de serie / VIN" value={singleUnit.vin} hint="N/D" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.5rem' }}>
                      <Field label="Condición" value={singleUnit.condition} hint="Condición" />
                      <Field label="Tipo de unidad" value={singleUnit.body_style} hint="Tipo" />
                    </div>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <div className="q-seclbl" style={sectionLabel}>Resumen</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.5rem' }}>
                      <Field label="Unidades cotizadas" value={units.length || null} hint="—" />
                      <Field label="Moneda" value={quote.currency} />
                      {quote.exchange_rate && (
                        <Field
                          label="Tipo de cambio"
                          value={`1 USD = ${Number(quote.exchange_rate).toFixed(4)} MXN`}
                        />
                      )}
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>

            {/* ============ UNIDADES (multi-unit only) ============ */}
            {units.length > 1 && (
              <div className="avoid-break" style={{ paddingBottom: '1.5rem' }}>
                <hr className="q-rule" style={{ ...hairline, margin: '0 0 1.25rem' }} />
                <div className="q-seclbl" style={sectionLabel}>Unidades</div>
                <table className="q-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...microLabel, textAlign: 'left', padding: '0 0 0.6rem' }}>Unidad</th>
                      <th style={{ ...microLabel, textAlign: 'left', padding: '0 0 0.6rem' }}>Especificaciones</th>
                      <th style={{ ...microLabel, textAlign: 'right', padding: '0 0 0.6rem' }}>Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => (
                      <tr key={unit.line_id} style={{ borderTop: '1px solid #efefef' }}>
                        <td style={{ padding: '0.75rem 0', verticalAlign: 'top', width: '38%' }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: '600' }}>
                            {[unit.unit_year, unit.make, unit.model].filter(Boolean).join(' ')}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                            {unit.vin ? `VIN ${unit.vin}` : 'VIN N/D'}
                          </div>
                        </td>
                        <td style={{
                          padding: '0.75rem 1rem 0.75rem 0', verticalAlign: 'top',
                          fontSize: '0.78rem', color: '#4b5563', lineHeight: '1.6'
                        }}>
                          {[
                            unit.body_style,
                            unit.passenger_capacity ? `${unit.passenger_capacity} pasajeros` : null,
                            unit.odometer != null ? `${number(unit.odometer)} km` : null,
                            engineOf(unit),
                            unit.transmission,
                            unit.exterior_color
                          ].filter(Boolean).join(' · ')}
                        </td>
                        <td style={{
                          padding: '0.75rem 0', textAlign: 'right', verticalAlign: 'top',
                          fontSize: '0.88rem', fontWeight: '700', whiteSpace: 'nowrap'
                        }}>
                          {money(unit.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <hr className="q-rule" style={{ ...hairline, margin: '0' }} />

            {/* ============ DESGLOSE DE PRECIO ============ */}
            <div className="avoid-break" style={{ padding: '1.5rem 0 0' }}>
              <div className="q-seclbl" style={sectionLabel}>Desglose de precio</div>
              <table className="q-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...microLabel, textAlign: 'left', padding: '0 0 0.7rem' }}>Descripción</th>
                    <th style={{ ...microLabel, textAlign: 'right', padding: '0 0 0.7rem', width: '70px' }}>Cant.</th>
                    <th style={{ ...microLabel, textAlign: 'right', padding: '0 0 0.7rem', width: '130px' }}>P. Unitario</th>
                    <th style={{ ...microLabel, textAlign: 'right', padding: '0 0 0.7rem', width: '130px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.line_id} style={{ borderTop: '1px solid #efefef' }}>
                      <td style={{ padding: '0.8rem 1rem 0.8rem 0', fontSize: '0.85rem' }}>
                        {line.description}
                        {line.notes && (
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                            {line.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.8rem 0', textAlign: 'right', fontSize: '0.85rem' }}>
                        {Number(line.quantity)}
                      </td>
                      <td style={{ padding: '0.8rem 0', textAlign: 'right', fontSize: '0.85rem', color: '#4b5563' }}>
                        {money(line.unit_price)}
                      </td>
                      <td style={{
                        padding: '0.8rem 0', textAlign: 'right',
                        fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap'
                      }}>
                        {money(line.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ============ TOTALES ============ */}
            <hr className="q-rule" style={{ ...hairline, margin: '1.25rem 0 0' }} />
            <div className="avoid-break q-sec" style={{ display: 'flex', justifyContent: 'flex-end', padding: '1.25rem 0' }}>
              <div style={{ width: '320px', maxWidth: '100%' }}>
                {[
                  ['Subtotal', money(quote.subtotal)],
                  Number(quote.discount_amount) ? ['Descuento', `− ${money(quote.discount_amount)}`] : null,
                  Number(quote.tax_amount) ? [`IVA (${Number(quote.tax_rate)}%)`, money(quote.tax_amount)] : null
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '0.3rem 0', fontSize: '0.85rem', color: '#4b5563'
                  }}>
                    <span>{label}</span><span>{value}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginTop: '0.7rem', paddingTop: '0.8rem', borderTop: '2px solid #111111'
                }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700' }}>Total {quote.currency}</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: '700' }}>{money(quote.total_amount)}</span>
                </div>
                {quote.deposit_required != null && Number(quote.deposit_required) > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: '0.5rem', fontSize: '0.8rem', color: '#4b5563'
                  }}>
                    <span>
                      Anticipo para apartar
                      {quote.deposit_percent ? ` (${Number(quote.deposit_percent)}%)` : ''}
                    </span>
                    <span style={{ fontWeight: '700' }}>{money(quote.deposit_required)}</span>
                  </div>
                )}
              </div>
            </div>

            <hr className="q-rule" style={{ ...hairline, margin: 0 }} />

            {/* ============ NOTAS | ELABORADO POR ============ */}
            <div className="avoid-break q-sec" style={{
              display: 'grid', gridTemplateColumns: '1.7fr 1fr',
              gap: '2.5rem', padding: '1.5rem 0'
            }}>
              <div>
                <div className="q-seclbl" style={sectionLabel}>Notas y condiciones</div>
                {notes.length === 0 ? (
                  <div style={placeholder}>Sin condiciones adicionales.</div>
                ) : (
                  notes.map(([label, text]) => (
                    <div
                      key={label}
                      style={{
                        fontSize: '0.8rem', color: '#374151',
                        lineHeight: '1.4', marginBottom: '0.3rem', whiteSpace: 'pre-wrap'
                      }}
                    >
                      <span style={{ fontWeight: '600', color: '#111827' }}>{label}: </span>
                      {text}
                    </div>
                  ))
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...microLabel, marginBottom: '0.7rem' }}>Elaborado por</div>
                <div style={{ fontSize: '0.92rem', fontWeight: '600' }}>{preparedBy || '—'}</div>
                <div style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '0.35rem', lineHeight: '1.55' }}>
                  {preparedPhone && <div>{preparedPhone}</div>}
                  {preparedEmail && <div>{preparedEmail}</div>}
                </div>
              </div>
            </div>

            <div className="q-legal" style={{
              fontSize: '0.66rem', color: '#b0b0b0', lineHeight: '1.7',
              textAlign: 'center', paddingBottom: '1.5rem'
            }}>
              Cotización vigente hasta el {fmtDate(quote.valid_until)}, sujeta a disponibilidad
              de la unidad al momento de su aceptación. Precios expresados en {quote.currency}.
            </div>
          </div>

          {/* ============ FOOTER BAR ============ */}
          <div className="q-band q-foot" style={{
            background: '#111111', padding: '0.85rem 2.25rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ color: '#8a8a8a', fontSize: '0.7rem' }}>
              {BA_COMPANY.name}{BA_COMPANY.nameAccent} · {BA_COMPANY.tagline}
            </span>
            <span style={{ color: '#8a8a8a', fontSize: '0.7rem' }}>{BA_COMPANY.website}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
