// TransactionJournal.jsx - Full audit view of all accounting entries
// Shows every transaction with expandable line details

const TransactionJournal = ({ isOpen, onClose }) => {
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState(null);
  const [filters, setFilters] = React.useState({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reference_type: ''
  });

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    if (isOpen) loadTransactions();
  }, [isOpen]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams({ limit: '500' });
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.reference_type) params.append('reference_type', filters.reference_type);

      const response = await fetch(`${API_URL}/accounting/transactions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount || parseFloat(amount) === 0) return '—';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(parseFloat(amount)));
    const prefix = currency === 'MXN' ? 'MX$' : '$';
    return `${prefix}${formatted}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTypeBadge = (type) => {
    const styles = {
      sale: { bg: '#d1fae5', color: '#065f46', label: 'Sale' },
      cogs: { bg: '#fef3c7', color: '#92400e', label: 'COGS' },
      purchase: { bg: '#dbeafe', color: '#1e40af', label: 'Purchase' },
      cost: { bg: '#e0e7ff', color: '#3730a3', label: 'Cost' },
      payment: { bg: '#d1fae5', color: '#065f46', label: 'Payment' },
      distribution: { bg: '#fae8ff', color: '#86198f', label: 'Distribution' },
      distribution_payout: { bg: '#fce7f3', color: '#9d174d', label: 'Payout' },
      deposit: { bg: '#cffafe', color: '#155e75', label: 'Deposit' },
      expense: { bg: '#fee2e2', color: '#991b1b', label: 'Expense' },
      transfer: { bg: '#e0e7ff', color: '#3730a3', label: 'Transfer' },
      exchange: { bg: '#fef3c7', color: '#92400e', label: 'Exchange' }
    };
    const s = styles[type] || { bg: '#f3f4f6', color: '#374151', label: type || 'Manual' };
    return (
      <span style={{
        padding: '0.2rem 0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.7rem',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: s.bg,
        color: s.color
      }}>
        {s.label}
      </span>
    );
  };

  // Totals
  const totalDebits = { USD: 0, MXN: 0 };
  const totalCredits = { USD: 0, MXN: 0 };
  transactions.forEach(t => {
    const lines = (t.lines || []).filter(l => l != null);
    lines.forEach(l => {
      const cur = l.currency || 'USD';
      totalDebits[cur] = (totalDebits[cur] || 0) + parseFloat(l.debit_amount || 0);
      totalCredits[cur] = (totalCredits[cur] || 0) + parseFloat(l.credit_amount || 0);
    });
  });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem',
        maxWidth: '1100px', width: '100%',
        maxHeight: '95vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
            📒 Transaction Journal
          </h2>
          <button onClick={onClose} style={{
            padding: '0.5rem', background: 'transparent',
            border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280'
          }}>✕</button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end',
          flexShrink: 0, background: '#f9fafb'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>From</label>
            <input type="date" value={filters.start_date}
              onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>To</label>
            <input type="date" value={filters.end_date}
              onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Type</label>
            <select value={filters.reference_type}
              onChange={(e) => setFilters({...filters, reference_type: e.target.value})}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
            >
              <option value="">All Types</option>
              <option value="sale">Sales</option>
              <option value="cogs">COGS</option>
              <option value="purchase">Purchases</option>
              <option value="cost">Costs</option>
              <option value="payment">Payments</option>
              <option value="distribution">Distributions</option>
              <option value="distribution_payout">Payouts</option>
              <option value="exchange">Exchanges</option>
              <option value="deposit">Deposits</option>
              <option value="expense">Expenses</option>
              <option value="transfer">Transfers</option>
            </select>
          </div>
          <button onClick={loadTransactions}
            style={{
              padding: '0.5rem 1rem', background: '#F59E0B', color: 'white',
              border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem',
              fontWeight: '600', cursor: 'pointer'
            }}
          >
            Apply
          </button>
          <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#374151', fontWeight: '600' }}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Transaction List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📒</div>
              No transactions found for this period
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Description</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Currency</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>By</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const isExpanded = expandedId === t.transaction_id;
                  const lines = (t.lines || []).filter(l => l != null);
                  return (
                    <React.Fragment key={t.transaction_id}>
                      {/* Transaction header row */}
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : t.transaction_id)}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: isExpanded ? '#eff6ff' : 'white'
                        }}
                        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'white'; }}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#6b7280' }}>
                          #{t.transaction_id}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#374151', whiteSpace: 'nowrap' }}>
                          {formatDate(t.transaction_date)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {getTypeBadge(t.reference_type)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#111827', fontWeight: '500', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isExpanded ? '▼' : '▶'} {t.description}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                          {t.currency}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                          {t.created_by}
                        </td>
                      </tr>

                      {/* Expanded lines */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" style={{ padding: '0', background: '#f8fafc', borderBottom: '2px solid #3b82f6' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#eef2ff' }}>
                                  <th style={{ padding: '0.5rem 1rem', paddingLeft: '3rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</th>
                                  <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code</th>
                                  <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Debit</th>
                                  <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit</th>
                                  <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Currency</th>
                                  <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((line, idx) => (
                                  <tr key={line.line_id || idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.5rem 1rem', paddingLeft: '3rem', color: '#111827', fontWeight: '500' }}>
                                      {line.account_name}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                      {line.account_code}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: parseFloat(line.debit_amount) > 0 ? '#059669' : '#d1d5db', fontWeight: parseFloat(line.debit_amount) > 0 ? '600' : '400' }}>
                                      {formatCurrency(line.debit_amount, line.currency)}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: parseFloat(line.credit_amount) > 0 ? '#dc2626' : '#d1d5db', fontWeight: parseFloat(line.credit_amount) > 0 ? '600' : '400' }}>
                                      {formatCurrency(line.credit_amount, line.currency)}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                      {line.currency}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', color: '#9ca3af', fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {line.notes || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer totals */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '2px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, fontSize: '0.875rem'
        }}>
          <div style={{ color: '#6b7280' }}>
            Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <span style={{ color: '#6b7280' }}>USD Debits: </span>
              <span style={{ fontWeight: '600', color: '#059669' }}>${totalDebits.USD?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span style={{ color: '#6b7280', margin: '0 0.5rem' }}>|</span>
              <span style={{ color: '#6b7280' }}>Credits: </span>
              <span style={{ fontWeight: '600', color: '#dc2626' }}>${totalCredits.USD?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>MXN Debits: </span>
              <span style={{ fontWeight: '600', color: '#059669' }}>MX${totalDebits.MXN?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span style={{ color: '#6b7280', margin: '0 0.5rem' }}>|</span>
              <span style={{ color: '#6b7280' }}>Credits: </span>
              <span style={{ fontWeight: '600', color: '#dc2626' }}>MX${totalCredits.MXN?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.TransactionJournal = TransactionJournal;
