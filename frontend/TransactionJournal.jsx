// TransactionJournal.jsx - Full audit view of all accounting entries

const TransactionJournal = ({ isOpen, onClose }) => {
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
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
    setError('');
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
        // Normalize: ensure lines is always an array of objects
        const normalized = (data || []).map(t => {
          let lines = t.lines;
          if (typeof lines === 'string') {
            try { lines = JSON.parse(lines); } catch (e) { lines = []; }
          }
          if (!Array.isArray(lines)) lines = [];
          lines = lines.filter(l => l != null && typeof l === 'object');
          return { ...t, lines };
        });
        setTransactions(normalized);
      } else {
        setError('Failed to load transactions');
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Error loading transactions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const safeFloat = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  const formatCurrency = (amount, currency) => {
    const n = safeFloat(amount);
    if (n === 0) return '\u2014';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(n));
    const prefix = currency === 'MXN' ? 'MX$' : '$';
    return prefix + formatted;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '\u2014';
    try {
      // Handle both "2026-01-31" and "2026-01-31T00:00:00" formats
      const str = String(dateStr).split('T')[0];
      const parts = str.split('-');
      if (parts.length !== 3) return String(dateStr);
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return String(dateStr);
    }
  };

  const typeStyles = {
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

  const getTypeBadge = (type) => {
    const s = typeStyles[type] || { bg: '#f3f4f6', color: '#374151', label: type || 'Manual' };
    return React.createElement('span', {
      style: {
        padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.7rem',
        fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em',
        background: s.bg, color: s.color
      }
    }, s.label);
  };

  if (!isOpen) return null;

  // Calculate totals safely
  const totalDebits = { USD: 0, MXN: 0 };
  const totalCredits = { USD: 0, MXN: 0 };
  try {
    transactions.forEach(t => {
      (t.lines || []).forEach(l => {
        const cur = (l && l.currency) || 'USD';
        totalDebits[cur] = (totalDebits[cur] || 0) + safeFloat(l && l.debit_amount);
        totalCredits[cur] = (totalCredits[cur] || 0) + safeFloat(l && l.credit_amount);
      });
    });
  } catch (e) {
    console.error('Error calculating totals:', e);
  }

  return (
    React.createElement('div', {
      style: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem'
      }
    },
      React.createElement('div', {
        style: {
          background: 'white', borderRadius: '0.75rem',
          maxWidth: '1100px', width: '100%',
          maxHeight: '95vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
        }
      },
        // Header
        React.createElement('div', {
          style: {
            padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
          }
        },
          React.createElement('h2', { style: { margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' } }, '\uD83D\uDCD2 Transaction Journal'),
          React.createElement('button', {
            onClick: onClose,
            style: { padding: '0.5rem', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }
          }, '\u2715')
        ),

        // Filters
        React.createElement('div', {
          style: {
            padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb',
            display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end',
            flexShrink: 0, background: '#f9fafb'
          }
        },
          React.createElement('div', null,
            React.createElement('label', { style: { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' } }, 'From'),
            React.createElement('input', {
              type: 'date', value: filters.start_date,
              onChange: (e) => setFilters({...filters, start_date: e.target.value}),
              style: { padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { style: { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' } }, 'To'),
            React.createElement('input', {
              type: 'date', value: filters.end_date,
              onChange: (e) => setFilters({...filters, end_date: e.target.value}),
              style: { padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { style: { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' } }, 'Type'),
            React.createElement('select', {
              value: filters.reference_type,
              onChange: (e) => setFilters({...filters, reference_type: e.target.value}),
              style: { padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }
            },
              React.createElement('option', { value: '' }, 'All Types'),
              React.createElement('option', { value: 'sale' }, 'Sales'),
              React.createElement('option', { value: 'cogs' }, 'COGS'),
              React.createElement('option', { value: 'purchase' }, 'Purchases'),
              React.createElement('option', { value: 'cost' }, 'Costs'),
              React.createElement('option', { value: 'payment' }, 'Payments'),
              React.createElement('option', { value: 'distribution' }, 'Distributions'),
              React.createElement('option', { value: 'distribution_payout' }, 'Payouts'),
              React.createElement('option', { value: 'exchange' }, 'Exchanges'),
              React.createElement('option', { value: 'deposit' }, 'Deposits'),
              React.createElement('option', { value: 'expense' }, 'Expenses'),
              React.createElement('option', { value: 'transfer' }, 'Transfers')
            )
          ),
          React.createElement('button', {
            onClick: loadTransactions,
            style: {
              padding: '0.5rem 1rem', background: '#F59E0B', color: 'white',
              border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem',
              fontWeight: '600', cursor: 'pointer'
            }
          }, 'Apply'),
          React.createElement('div', {
            style: { marginLeft: 'auto', fontSize: '0.875rem', color: '#374151', fontWeight: '600' }
          }, transactions.length + ' transaction' + (transactions.length !== 1 ? 's' : ''))
        ),

        // Content
        React.createElement('div', { style: { flex: 1, overflow: 'auto' } },
          loading
            ? React.createElement('div', { style: { padding: '3rem', textAlign: 'center', color: '#6b7280' } }, 'Loading transactions...')
            : error
              ? React.createElement('div', { style: { padding: '2rem', textAlign: 'center', color: '#991b1b' } }, error)
              : transactions.length === 0
                ? React.createElement('div', { style: { padding: '3rem', textAlign: 'center', color: '#6b7280' } }, 'No transactions found for this period')
                : React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' } },
                    React.createElement('thead', null,
                      React.createElement('tr', { style: { background: '#f9fafb', borderBottom: '2px solid #e5e7eb' } },
                        React.createElement('th', { style: { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' } }, 'ID'),
                        React.createElement('th', { style: { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' } }, 'Date'),
                        React.createElement('th', { style: { padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: '600', color: '#374151' } }, 'Type'),
                        React.createElement('th', { style: { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' } }, 'Description'),
                        React.createElement('th', { style: { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' } }, 'Cur'),
                        React.createElement('th', { style: { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' } }, 'By')
                      )
                    ),
                    React.createElement('tbody', null,
                      transactions.map(function(t) {
                        var isExpanded = expandedId === t.transaction_id;
                        var lines = t.lines || [];
                        var rows = [];

                        // Header row
                        rows.push(
                          React.createElement('tr', {
                            key: 'h-' + t.transaction_id,
                            onClick: function() { setExpandedId(isExpanded ? null : t.transaction_id); },
                            style: {
                              borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                              cursor: 'pointer',
                              background: isExpanded ? '#eff6ff' : 'white'
                            }
                          },
                            React.createElement('td', { style: { padding: '0.75rem 1rem', fontWeight: '600', color: '#6b7280' } }, '#' + t.transaction_id),
                            React.createElement('td', { style: { padding: '0.75rem 1rem', color: '#374151', whiteSpace: 'nowrap' } }, formatDate(t.transaction_date)),
                            React.createElement('td', { style: { padding: '0.75rem 0.5rem' } }, getTypeBadge(t.reference_type)),
                            React.createElement('td', { style: { padding: '0.75rem 1rem', color: '#111827', fontWeight: '500', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, (isExpanded ? '\u25BC ' : '\u25B6 ') + (t.description || '')),
                            React.createElement('td', { style: { padding: '0.75rem 1rem', color: '#6b7280' } }, t.currency || ''),
                            React.createElement('td', { style: { padding: '0.75rem 1rem', color: '#6b7280' } }, t.created_by || '')
                          )
                        );

                        // Expanded detail rows
                        if (isExpanded && lines.length > 0) {
                          var lineRows = lines.map(function(line, idx) {
                            var debit = safeFloat(line.debit_amount);
                            var credit = safeFloat(line.credit_amount);
                            return React.createElement('tr', {
                              key: 'l-' + (line.line_id || idx),
                              style: { borderBottom: '1px solid #e5e7eb' }
                            },
                              React.createElement('td', { style: { padding: '0.5rem 1rem', paddingLeft: '3rem', color: '#111827', fontWeight: '500' } }, line.account_name || ''),
                              React.createElement('td', { style: { padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.8rem' } }, line.account_code || ''),
                              React.createElement('td', { style: { padding: '0.5rem 1rem', textAlign: 'right', color: debit > 0 ? '#059669' : '#d1d5db', fontWeight: debit > 0 ? '600' : '400' } }, formatCurrency(line.debit_amount, line.currency)),
                              React.createElement('td', { style: { padding: '0.5rem 1rem', textAlign: 'right', color: credit > 0 ? '#dc2626' : '#d1d5db', fontWeight: credit > 0 ? '600' : '400' } }, formatCurrency(line.credit_amount, line.currency)),
                              React.createElement('td', { style: { padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.8rem' } }, line.currency || ''),
                              React.createElement('td', { style: { padding: '0.5rem 1rem', color: '#9ca3af', fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, line.notes || '\u2014')
                            );
                          });

                          rows.push(
                            React.createElement('tr', { key: 'e-' + t.transaction_id },
                              React.createElement('td', { colSpan: 6, style: { padding: 0, background: '#f8fafc', borderBottom: '2px solid #3b82f6' } },
                                React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
                                  React.createElement('thead', null,
                                    React.createElement('tr', { style: { background: '#eef2ff' } },
                                      React.createElement('th', { style: { padding: '0.5rem 1rem', paddingLeft: '3rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase' } }, 'Account'),
                                      React.createElement('th', { style: { padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase' } }, 'Code'),
                                      React.createElement('th', { style: { padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase' } }, 'Debit'),
                                      React.createElement('th', { style: { padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase' } }, 'Credit'),
                                      React.createElement('th', { style: { padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase' } }, 'Cur'),
                                      React.createElement('th', { style: { padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#4338ca', textTransform: 'uppercase' } }, 'Notes')
                                    )
                                  ),
                                  React.createElement('tbody', null, lineRows)
                                )
                              )
                            )
                          );
                        }

                        return rows;
                      }).flat()
                    )
                  )
        ),

        // Footer
        React.createElement('div', {
          style: {
            padding: '1rem 1.5rem', borderTop: '2px solid #e5e7eb', background: '#f9fafb',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0, fontSize: '0.875rem'
          }
        },
          React.createElement('div', { style: { color: '#6b7280' } }, 'Showing ' + transactions.length + ' transaction' + (transactions.length !== 1 ? 's' : '')),
          React.createElement('div', { style: { display: 'flex', gap: '2rem' } },
            React.createElement('div', null,
              'USD  D: $' + totalDebits.USD.toLocaleString('en-US', { minimumFractionDigits: 2 }) +
              '  |  C: $' + totalCredits.USD.toLocaleString('en-US', { minimumFractionDigits: 2 })
            ),
            React.createElement('div', null,
              'MXN  D: MX$' + totalDebits.MXN.toLocaleString('en-US', { minimumFractionDigits: 2 }) +
              '  |  C: MX$' + totalCredits.MXN.toLocaleString('en-US', { minimumFractionDigits: 2 })
            )
          )
        )
      )
    )
  );
};

window.TransactionJournal = TransactionJournal;
