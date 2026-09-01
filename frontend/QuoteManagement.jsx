// QuoteManagement.jsx - Quotes list, lifecycle actions, and conversion to sales.

const QuoteManagement = () => {
  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  const [quotes, setQuotes] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('open');
  const [error, setError] = React.useState(null);
  const [banner, setBanner] = React.useState(null);

  const [editingQuote, setEditingQuote] = React.useState(null);   // quote object or 'new'
  const [viewingQuote, setViewingQuote] = React.useState(null);
  const [acceptTarget, setAcceptTarget] = React.useState(null);

  // Used for "Elaborado por" on the printed quote.
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch (e) { return null; }
  })();

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('session_token')}`
  });

  const STATUS_FILTERS = [
    { id: 'open', label: 'Open', query: 'Draft,Sent' },
    { id: 'all', label: 'All', query: '' },
    { id: 'Draft', label: 'Draft', query: 'Draft' },
    { id: 'Sent', label: 'Sent', query: 'Sent' },
    { id: 'Accepted', label: 'Accepted', query: 'Accepted' },
    { id: 'Rejected', label: 'Rejected', query: 'Rejected' },
    { id: 'Expired', label: 'Expired', query: 'Expired' },
    { id: 'Cancelled', label: 'Cancelled', query: 'Cancelled' }
  ];

  const STATUS_STYLES = {
    Draft: { bg: '#f3f4f6', fg: '#374151' },
    Sent: { bg: '#dbeafe', fg: '#1e40af' },
    Accepted: { bg: '#d1fae5', fg: '#065f46' },
    Rejected: { bg: '#fee2e2', fg: '#991b1b' },
    Expired: { bg: '#fef3c7', fg: '#92400e' },
    Cancelled: { bg: '#e5e7eb', fg: '#4b5563' }
  };

  React.useEffect(() => { loadAll(); }, [statusFilter]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadQuotes(), loadStats(), loadClients()]);
    setLoading(false);
  };

  const loadQuotes = async () => {
    try {
      const filter = STATUS_FILTERS.find((f) => f.id === statusFilter);
      const qs = filter && filter.query ? `?status=${encodeURIComponent(filter.query)}` : '';
      const res = await fetch(`${API_URL}/quotes${qs}`, { headers: authHeaders() });
      if (res.ok) {
        setQuotes(await res.json());
        setError(null);
      } else if (res.status === 404 || res.status === 500) {
        setError('Could not load quotes. If this is the first time using quoting, run the database migration (POST /admin/migrate as an admin).');
      }
    } catch (e) {
      setError(`Could not reach the server: ${e.message}`);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/quotes/stats/summary`, { headers: authHeaders() });
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error('Error loading quote stats:', e);
    }
  };

  const loadClients = async () => {
    try {
      const res = await fetch(`${API_URL}/clients`, { headers: authHeaders() });
      if (res.ok) setClients(await res.json());
    } catch (e) {
      console.error('Error loading clients:', e);
    }
  };

  const openQuote = async (quoteId, then) => {
    const res = await fetch(`${API_URL}/quotes/${quoteId}`, { headers: authHeaders() });
    if (res.ok) then(await res.json());
    else setError('Could not load that quote.');
  };

  const changeStatus = async (quote, status, reason) => {
    const res = await fetch(`${API_URL}/quotes/${quote.quote_id}/status`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ status, reason: reason || null })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || 'Could not change the quote status.');
      return;
    }
    setBanner(`${quote.quote_number} marked ${status}.`);
    loadAll();
  };

  const duplicateQuote = async (quote) => {
    const res = await fetch(`${API_URL}/quotes/${quote.quote_id}/duplicate`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || 'Could not duplicate the quote.');
      return;
    }
    setBanner(`Created ${data.quote_number} as a copy of ${quote.quote_number}.`);
    setEditingQuote(data);
    loadAll();
  };

  const deleteQuote = async (quote) => {
    const res = await fetch(`${API_URL}/quotes/${quote.quote_id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || 'Could not delete the quote.');
      return;
    }
    setBanner(`${quote.quote_number} deleted.`);
    loadAll();
  };

  const daysLeft = (quote) => {
    if (!quote.valid_until || !['Draft', 'Sent'].includes(quote.status)) return null;
    const diff = Math.ceil((new Date(quote.valid_until) - new Date()) / 86400000);
    return diff;
  };

  const filtered = quotes.filter((q) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      q.quote_number?.toLowerCase().includes(s) ||
      q.client_name?.toLowerCase().includes(s) ||
      q.client_company?.toLowerCase().includes(s)
    );
  });

  const btn = (bg, fg) => ({
    padding: '0.35rem 0.7rem', background: bg, color: fg, border: 'none',
    borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600'
  });

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
          gap: '1rem', marginBottom: '1.5rem'
        }}>
          {[
            { label: '📬 Open quotes', value: stats.open_count, sub: 'draft + sent', color: 'blue' },
            { label: '💵 Open value (USD)', value: formatCurrency(stats.open_value_usd, 'USD'), sub: 'quoted, not yet decided', color: 'green' },
            { label: '💵 Open value (MXN)', value: formatCurrency(stats.open_value_mxn, 'MXN'), sub: 'quoted, not yet decided', color: 'purple' },
            {
              label: '🏆 Win rate',
              value: stats.win_rate == null ? '—' : `${stats.win_rate}%`,
              sub: `${stats.accepted_count} accepted`,
              color: 'orange'
            }
          ].map((s) => (
            <div key={s.label} style={statCardStyle(s.color)}>
              <div style={STAT_CARD_LABEL_STYLE}>{s.label}</div>
              <div style={STAT_CARD_VALUE_STYLE}>{s.value}</div>
              <div style={STAT_CARD_SUBTEXT_STYLE}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Search by quote number, client, or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 300px', padding: '0.75rem 1rem', border: '1px solid #d1d5db',
            borderRadius: '0.5rem', fontSize: '0.875rem'
          }}
        />
        <button
          onClick={() => setEditingQuote('new')}
          style={{
            padding: '0.75rem 1.5rem', background: '#FFD700', color: '#1a1a1a',
            border: 'none', borderRadius: '0.5rem', fontWeight: '700', cursor: 'pointer'
          }}
        >
          ➕ New Quote
        </button>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            style={{
              padding: '0.45rem 0.9rem',
              background: statusFilter === f.id ? '#1a1a1a' : 'white',
              color: statusFilter === f.id ? '#FFD700' : '#374151',
              border: '1px solid ' + (statusFilter === f.id ? '#1a1a1a' : '#d1d5db'),
              borderRadius: '999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
            }}
          >
            {f.label}
            {stats && f.id !== 'all' && f.id !== 'open' && stats.by_status[f.id] && (
              <span style={{ opacity: 0.7 }}> · {stats.by_status[f.id].count}</span>
            )}
          </button>
        ))}
      </div>

      {banner && (
        <div style={{
          background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46',
          padding: '0.75rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem',
          display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem'
        }}>
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}>×</button>
        </div>
      )}

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          padding: '0.75rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem',
          display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem'
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>×</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading quotes…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
            <div>No quotes here yet.</div>
            <button
              onClick={() => setEditingQuote('new')}
              style={{ ...btn('#FFD700', '#1a1a1a'), marginTop: '1rem', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
            >
              Create the first quote
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {['Quote', 'Client', 'Units', 'Total', 'Dates', 'Status', ''].map((h) => (
                    <th key={h} style={{
                      padding: '0.75rem', textAlign: h === 'Total' ? 'right' : 'left',
                      fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280'
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => {
                  const style = STATUS_STYLES[q.status] || STATUS_STYLES.Draft;
                  const remaining = daysLeft(q);
                  return (
                    <tr key={q.quote_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem', fontWeight: '700', color: '#1a1a1a' }}>
                        {q.quote_number}
                        {q.revision > 1 && (
                          <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: '500' }}> rev {q.revision}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: '600' }}>{q.client_name}</div>
                        {q.client_company && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{q.client_company}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#374151' }}>{q.unit_count || 0}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        {formatCurrency(q.total_amount, q.currency)}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        <div>Issued {formatDate(q.quote_date)}</div>
                        <div>
                          Valid to {formatDate(q.valid_until)}
                          {remaining != null && (
                            <span style={{ color: remaining < 0 ? '#dc2626' : remaining <= 5 ? '#b45309' : '#6b7280', fontWeight: '600' }}>
                              {' '}({remaining < 0 ? 'past due' : `${remaining}d`})
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          background: style.bg, color: style.fg, padding: '0.25rem 0.65rem',
                          borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700'
                        }}>
                          {q.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button onClick={() => openQuote(q.quote_id, setViewingQuote)} style={btn('#1a1a1a', 'white')}>
                            View
                          </button>
                          {['Draft', 'Sent', 'Expired'].includes(q.status) && (
                            <button onClick={() => openQuote(q.quote_id, setEditingQuote)} style={btn('#e5e7eb', '#374151')}>
                              Edit
                            </button>
                          )}
                          {q.status === 'Draft' && (
                            <button onClick={() => changeStatus(q, 'Sent')} style={btn('#2563eb', 'white')}>
                              Mark sent
                            </button>
                          )}
                          {['Draft', 'Sent', 'Expired'].includes(q.status) && (q.unit_count || 0) > 0 && (
                            <button onClick={() => openQuote(q.quote_id, setAcceptTarget)} style={btn('#059669', 'white')}>
                              Accept →
                            </button>
                          )}
                          {['Draft', 'Sent', 'Expired'].includes(q.status) && (
                            <button
                              onClick={() => {
                                const reason = window.prompt(`Why is ${q.quote_number} being rejected? (optional)`);
                                if (reason !== null) changeStatus(q, 'Rejected', reason);
                              }}
                              style={btn('#fee2e2', '#991b1b')}
                            >
                              Reject
                            </button>
                          )}
                          <button onClick={() => duplicateQuote(q)} style={btn('#f3f4f6', '#374151')}>
                            Copy
                          </button>
                          {q.status !== 'Accepted' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete ${q.quote_number}? This hides it from the list.`)) deleteQuote(q);
                              }}
                              style={btn('#f3f4f6', '#991b1b')}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingQuote && (
        <QuoteModal
          quote={editingQuote === 'new' ? null : editingQuote}
          clients={clients}
          currentUser={currentUser}
          onClose={() => setEditingQuote(null)}
          onSaved={(saved) => {
            setEditingQuote(null);
            setBanner(
              `${saved.quote_number} saved.` +
              (saved.warnings && saved.warnings.length ? ` ⚠️ ${saved.warnings.join(' ')}` : '')
            );
            loadAll();
          }}
        />
      )}

      {viewingQuote && (
        <QuoteDocument quote={viewingQuote} currentUser={currentUser} onClose={() => setViewingQuote(null)} />
      )}

      {acceptTarget && (
        <AcceptQuoteModal
          quote={acceptTarget}
          onClose={() => setAcceptTarget(null)}
          onAccepted={(result) => {
            setAcceptTarget(null);
            const superseded = result.superseded_quotes || [];
            setBanner(
              `${result.quote_number} accepted — ${(result.sales || []).length} sale(s) recorded.` +
              (superseded.length
                ? ` ${superseded.map((s) => s.quote_number).join(', ')} auto-cancelled (units no longer available).`
                : '')
            );
            loadAll();
          }}
          onError={setError}
        />
      )}
    </div>
  );
};


// ---------------------------------------------------------------------------
// Accept / convert-to-sale confirmation
// ---------------------------------------------------------------------------
const AcceptQuoteModal = ({ quote, onClose, onAccepted, onError }) => {
  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  const [saleDate, setSaleDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [allocation, setAllocation] = React.useState('prorate');
  const [submitting, setSubmitting] = React.useState(false);
  const [localError, setLocalError] = React.useState(null);

  const units = (quote.line_items || []).filter((l) => l.line_type === 'bus');
  const busSubtotal = units.reduce((sum, l) => sum + Number(l.line_total || 0), 0);
  const total = Number(quote.total_amount || 0);
  const extras = total - busSubtotal;

  const fmt = (amount) => formatCurrency(amount, quote.currency);

  // Mirrors the server's allocation so the preview matches what gets recorded.
  const previewPrice = (line, index) => {
    if (allocation !== 'prorate' || busSubtotal <= 0) return Number(line.line_total || 0);
    if (index === units.length - 1) {
      const others = units.slice(0, -1).reduce(
        (sum, l, i) => sum + previewPrice(l, i), 0
      );
      return total - others;
    }
    return Math.round((Number(line.line_total) + extras * (Number(line.line_total) / busSubtotal)) * 100) / 100;
  };

  const submit = async () => {
    setSubmitting(true);
    setLocalError(null);
    try {
      const res = await fetch(`${API_URL}/quotes/${quote.quote_id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('session_token')}`
        },
        body: JSON.stringify({ sale_date: saleDate, charge_allocation: allocation })
      });
      const data = await res.json();
      if (!res.ok) {
        setLocalError(data.detail || 'Could not accept this quote.');
        return;
      }
      onAccepted(data);
    } catch (e) {
      setLocalError(`Could not reach the server: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const input = {
    width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
    borderRadius: '0.4rem', fontSize: '0.875rem'
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1100
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '640px', overflow: 'hidden' }}>
        <div style={{ background: '#1a1a1a', padding: '1.25rem 1.5rem' }}>
          <div style={{ color: '#FFD700', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.08em' }}>
            ACCEPT QUOTE
          </div>
          <h3 style={{ margin: '0.25rem 0 0 0', color: 'white', fontSize: '1.2rem' }}>
            {quote.quote_number} — {quote.client_company || quote.client_name}
          </h3>
        </div>

        <div style={{ padding: '1.5rem', maxHeight: '65vh', overflowY: 'auto' }}>
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.4rem',
            padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#78350f', marginBottom: '1.25rem'
          }}>
            This records a sale for each unit below — marking them sold and posting revenue and COGS
            entries. Any other open quote holding these units is cancelled automatically.
          </div>

          {localError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
              padding: '0.75rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.85rem'
            }}>
              {localError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.3rem' }}>
                SALE DATE
              </label>
              <input type="date" style={input} value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.3rem' }}>
                CHARGES, TAX &amp; DISCOUNT
              </label>
              <select style={input} value={allocation} onChange={(e) => setAllocation(e.target.value)}>
                <option value="prorate">Spread across units (revenue = quote total)</option>
                <option value="none">Unit prices only (charges excluded)</option>
              </select>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.72rem', color: '#6b7280' }}>UNIT</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.72rem', color: '#6b7280' }}>QUOTED</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.72rem', color: '#6b7280' }}>RECORDED AS</th>
              </tr>
            </thead>
            <tbody>
              {units.map((line, i) => (
                <tr key={line.line_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <div style={{ fontWeight: '600' }}>{line.stock_number}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{line.description}</div>
                    {line.is_sold && (
                      <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: '700' }}>already sold</div>
                    )}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#6b7280' }}>
                    {fmt(line.line_total)}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>
                    {fmt(previewPrice(line, i))}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '0.7rem 0.5rem', fontWeight: '700' }}>Total revenue recorded</td>
                <td></td>
                <td style={{ padding: '0.7rem 0.5rem', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                  {fmt(units.reduce((sum, l, i) => sum + previewPrice(l, i), 0))}
                </td>
              </tr>
            </tbody>
          </table>

          {allocation === 'none' && Math.abs(extras) > 0.005 && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#b45309' }}>
              {fmt(extras)} of charges, tax and discount will not be recorded as revenue.
            </div>
          )}
        </div>

        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.7rem 1.4rem', background: 'white', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: '600'
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            style={{
              padding: '0.7rem 1.6rem', background: submitting ? '#9ca3af' : '#059669', color: 'white',
              border: 'none', borderRadius: '0.4rem', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: '700'
            }}
          >
            {submitting ? 'Recording…' : `Accept & record ${units.length} sale(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};
