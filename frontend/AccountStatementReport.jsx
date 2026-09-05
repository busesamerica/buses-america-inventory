// AccountStatementReport.jsx - Account Statement / Ledger (per-account transaction audit)
//
// Shows every transaction line posted to one account, in date order, with a
// running balance - the standard bank-statement shape (opening balance ->
// dated entries -> closing balance). Complements TransactionJournal.jsx
// (all accounts, no running balance) and the aggregate-only
// BalanceSheetReport/IncomeStatementReport (totals with no transaction-level
// drill-down) - this is the one place to audit a single account's activity.
//
// Always ordered by date, no column sorting - a running balance only stays
// meaningful in date order (the backend enforces the same ordering).

const AccountStatementReport = ({ isOpen, initialAccountId, onClose }) => {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = React.useState([]);
  const [selectedAccountId, setSelectedAccountId] = React.useState('');
  const [filters, setFilters] = React.useState({ start_date: '', end_date: '' });
  const [statement, setStatement] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    if (!isOpen) return;
    loadAccounts();
    if (initialAccountId) {
      setSelectedAccountId(String(initialAccountId));
      setFilters({ start_date: '', end_date: '' });
      loadStatement(initialAccountId, '', '', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialAccountId]);

  const loadAccounts = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const loadStatement = async (accountId, startDate, endDate, currency) => {
    if (!accountId) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (currency) params.append('currency', currency);
      const response = await fetch(`${API_URL}/accounting/accounts/${accountId}/statement?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStatement(data);
      } else {
        const err = await response.json().catch(() => ({}));
        setError(err.detail || 'Failed to load account statement');
        setStatement(null);
      }
    } catch (err) {
      setError(err.message);
      setStatement(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = (accountId) => {
    setSelectedAccountId(accountId);
    setFilters({ start_date: '', end_date: '' });
    setStatement(null);
    if (accountId) loadStatement(accountId, '', '', '');
  };

  const handleRunReport = () => {
    loadStatement(selectedAccountId, filters.start_date, filters.end_date, '');
  };

  const handlePickCurrency = (chosenCurrency) => {
    loadStatement(selectedAccountId, filters.start_date, filters.end_date, chosenCurrency);
  };

  if (!isOpen) return null;

  // Once a statement has resolved, its own `currency` field is the one
  // source of truth for what its numbers are denominated in - never fall
  // back to the account row's `currency` (which can be a non-currency
  // sentinel like 'BOTH' for accounts with mixed-currency activity, e.g.
  // equity/distribution accounts with no USD/MXN split).
  const currency = statement?.currency || 'USD';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem',
        maxWidth: '900px', width: '100%', maxHeight: '90vh',
        overflow: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'white', zIndex: 10
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
            🧾 Account Statement
          </h2>
          <button onClick={onClose} style={{
            padding: '0.5rem', background: 'transparent', border: 'none',
            fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280'
          }}>✕</button>
        </div>

        {/* Filters */}
        <div style={{ padding: '1.5rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {/* Filter toolbar is app UI, not part of the printed statement -
              on a phone the account picker was squeezed to a few pixels wide
              and the date/Generate controls fell off the modal. */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}
              >
                <option value="">Select an account...</option>
                {accounts.map(a => {
                  // Label from what this account's transaction_lines actually
                  // contain (currencies_used), not the nominal a.currency
                  // column - the two can disagree (e.g. an equity/distribution
                  // account created as 'USD' that has since had MXN activity
                  // posted to it too, with nothing to reconcile a.currency
                  // afterward). Falls back to a.currency only when there's no
                  // activity yet to go on, matching how the statement endpoint
                  // itself resolves a currency in that case.
                  const used = a.currencies_used || [];
                  const currencyLabel = used.length === 1 ? used[0]
                    : used.length > 1 ? 'multi-currency'
                    : (a.currency === 'USD' || a.currency === 'MXN' ? a.currency : 'multi-currency');
                  return (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_code} — {a.account_name} ({currencyLabel}){a.is_active ? '' : ' [inactive]'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                From
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                To
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}
              />
            </div>
            <button
              onClick={handleRunReport}
              disabled={loading || !selectedAccountId}
              style={{ ...buttonStyle('blue', 'md', loading || !selectedAccountId), whiteSpace: 'nowrap' }}
            >
              {loading ? 'Loading...' : '🔄 Run Report'}
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div style={{ padding: '2rem' }}>
          {!selectedAccountId ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Select an account to see its transaction history.
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Loading statement...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#991b1b' }}>
              {error}
            </div>
          ) : !statement ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Click "Run Report" to generate the statement.
            </div>
          ) : statement.currency_choice_required ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                {statement.account.account_name}
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                {statement.account.account_code}
                {statement.account.account_subtype ? ` · ${statement.account.account_subtype}` : ''}
              </div>
              <div style={{ color: '#374151', marginBottom: '1rem' }}>
                This account has activity in more than one currency. A statement can only show one
                currency's transactions at a time — pick one:
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                {statement.available_currencies.map(c => (
                  <button key={c} onClick={() => handlePickCurrency(c)} style={buttonStyle('blue', 'md')}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Report Header */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                  {statement.account.account_name}
                </h3>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {statement.account.account_code} · {statement.account.account_type}
                  {statement.account.account_subtype ? ` (${statement.account.account_subtype})` : ''} · {statement.currency}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                  {filters.start_date ? `From ${formatDate(filters.start_date)}` : 'Full history'}
                  {filters.end_date ? ` through ${formatDate(filters.end_date)}` : ''}
                </div>
              </div>

              {statement.entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  No transactions in this period.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #111827' }}>
                      <th style={{ padding: '0.5rem 0.5rem 0.5rem 0', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Debit</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit</th>
                      <th style={{ padding: '0.5rem 0 0.5rem 0.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <td colSpan={4} style={{ padding: '0.5rem', fontWeight: '600', color: '#374151' }}>Opening Balance</td>
                      <td style={{ padding: '0.5rem 0 0.5rem 0.5rem', textAlign: 'right', fontWeight: '600', fontFamily: 'monospace', color: '#374151' }}>
                        {formatCurrency(statement.opening_balance, currency)}
                      </td>
                    </tr>
                    {statement.entries.map((entry, idx) => (
                      <tr key={entry.transaction_id + '-' + idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', color: '#374151', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          {formatDate(entry.transaction_date)}
                        </td>
                        <td style={{ padding: '0.5rem', color: '#111827', verticalAlign: 'top' }}>
                          <div>{entry.description}</div>
                          {entry.reference_number ? (
                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                              {entry.reference_type ? `${entry.reference_type} · ` : ''}{entry.reference_number}
                            </div>
                          ) : entry.reference_type ? (
                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.1rem' }}>{entry.reference_type}</div>
                          ) : null}
                          {entry.notes ? (
                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.1rem', fontStyle: 'italic' }}>{entry.notes}</div>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', color: entry.debit_amount > 0 ? '#111827' : '#d1d5db', verticalAlign: 'top' }}>
                          {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount, entry.currency) : '—'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', color: entry.credit_amount > 0 ? '#111827' : '#d1d5db', verticalAlign: 'top' }}>
                          {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount, entry.currency) : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0 0.5rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: '#374151', verticalAlign: 'top' }}>
                          {formatCurrency(entry.running_balance, currency)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #111827' }}>
                      <td colSpan={4} style={{ padding: '0.6rem 0.5rem 0.6rem 0', fontWeight: '700', color: '#111827' }}>Closing Balance</td>
                      <td style={{ padding: '0.6rem 0 0.6rem 0.5rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: '#111827' }}>
                        {formatCurrency(statement.closing_balance, currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {statement.entries.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                  <span>Total Debits: <strong style={{ color: '#111827' }}>{formatCurrency(statement.total_debit, currency)}</strong></span>
                  <span>Total Credits: <strong style={{ color: '#111827' }}>{formatCurrency(statement.total_credit, currency)}</strong></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

window.AccountStatementReport = AccountStatementReport;
