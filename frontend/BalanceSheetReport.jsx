// BalanceSheetReport.jsx - Balance Sheet Financial Report

const BalanceSheetReport = ({ isOpen, onClose }) => {
  const [loading, setLoading] = React.useState(false);
  const [reportData, setReportData] = React.useState(null);
  const [filters, setFilters] = React.useState({
    as_of_date: new Date().toISOString().split('T')[0], // Today
    currency: 'USD'
  });

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_URL}/accounting/reports/balance-sheet?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = filters.currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'MXN' ? 'MXN' : 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const handleRunReport = () => {
    loadReport();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '0.75rem',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
            📊 Balance Sheet
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '1.5rem',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                As of Date
              </label>
              <input
                type="date"
                value={filters.as_of_date}
                onChange={(e) => handleFilterChange('as_of_date', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                Currency
              </label>
              <select
                value={filters.currency}
                onChange={(e) => handleFilterChange('currency', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              >
                <option value="USD">USD</option>
                <option value="MXN">MXN</option>
              </select>
            </div>

            <button
              onClick={handleRunReport}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? 'Loading...' : '🔄 Run Report'}
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div style={{ padding: '2rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Generating report...
            </div>
          ) : !reportData ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Click "Run Report" to generate the balance sheet
            </div>
          ) : (
            <>
              {/* Report Header */}
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                  BUSES AMERICA
                </h3>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#374151' }}>
                  Balance Sheet
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  As of {formatDate(reportData.as_of_date)}
                </div>
              </div>

              {/* ASSETS Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '700', 
                  color: '#059669',
                  marginBottom: '1rem',
                  borderBottom: '2px solid #059669',
                  paddingBottom: '0.5rem'
                }}>
                  ASSETS
                </div>

                {/* Current Assets */}
                {reportData.assets.current.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#374151', marginLeft: '1rem', marginBottom: '0.5rem' }}>
                      Current Assets
                    </div>
                    {reportData.assets.current.map((account, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '0.5rem 0',
                        paddingLeft: '2rem',
                        fontSize: '0.875rem'
                      }}>
                        <span>{account.name}</span>
                        <span style={{ fontFamily: 'monospace' }}>
                          {reportData.currency === 'BOTH'
                            ? `${formatCurrency(account.balance_usd, 'USD')} / ${formatCurrency(account.balance_mxn, 'MXN')}`
                            : formatCurrency(reportData.currency === 'MXN' ? account.balance_mxn : account.balance_usd, reportData.currency)
                          }
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {/* Non-Current Assets */}
                {reportData.assets.non_current.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#374151', marginLeft: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
                      Non-Current Assets
                    </div>
                    {reportData.assets.non_current.map((account, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '0.5rem 0',
                        paddingLeft: '2rem',
                        fontSize: '0.875rem'
                      }}>
                        <span>{account.name}</span>
                        <span style={{ fontFamily: 'monospace' }}>
                          {reportData.currency === 'BOTH'
                            ? `${formatCurrency(account.balance_usd, 'USD')} / ${formatCurrency(account.balance_mxn, 'MXN')}`
                            : formatCurrency(reportData.currency === 'MXN' ? account.balance_mxn : account.balance_usd, reportData.currency)
                          }
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {/* Total Assets */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  marginTop: '0.5rem',
                  borderTop: '2px solid #059669',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}>
                  <span>TOTAL ASSETS</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.assets.total_usd, 'USD')} / ${formatCurrency(reportData.assets.total_mxn, 'MXN')}`
                      : formatCurrency(reportData.assets.total, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* LIABILITIES Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '700', 
                  color: '#dc2626',
                  marginBottom: '1rem',
                  borderBottom: '2px solid #dc2626',
                  paddingBottom: '0.5rem'
                }}>
                  LIABILITIES
                </div>

                {/* Current Liabilities */}
                {reportData.liabilities.current.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#374151', marginLeft: '1rem', marginBottom: '0.5rem' }}>
                      Current Liabilities
                    </div>
                    {reportData.liabilities.current.map((account, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '0.5rem 0',
                        paddingLeft: '2rem',
                        fontSize: '0.875rem'
                      }}>
                        <span>{account.name}</span>
                        <span style={{ fontFamily: 'monospace' }}>
                          {reportData.currency === 'BOTH'
                            ? `${formatCurrency(account.balance_usd, 'USD')} / ${formatCurrency(account.balance_mxn, 'MXN')}`
                            : formatCurrency(reportData.currency === 'MXN' ? account.balance_mxn : account.balance_usd, reportData.currency)
                          }
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {reportData.liabilities.current.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>
                    No liabilities recorded
                  </div>
                )}

                {/* Total Liabilities */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  marginTop: '0.5rem',
                  borderTop: '2px solid #dc2626',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}>
                  <span>TOTAL LIABILITIES</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.liabilities.total_usd, 'USD')} / ${formatCurrency(reportData.liabilities.total_mxn, 'MXN')}`
                      : formatCurrency(reportData.liabilities.total, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* EQUITY Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '700', 
                  color: '#7c3aed',
                  marginBottom: '1rem',
                  borderBottom: '2px solid #7c3aed',
                  paddingBottom: '0.5rem'
                }}>
                  EQUITY
                </div>

                {reportData.equity.accounts.map((account, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    paddingLeft: '1rem',
                    fontSize: '0.875rem'
                  }}>
                    <span>{account.name}</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {reportData.currency === 'BOTH'
                        ? `${formatCurrency(account.balance_usd, 'USD')} / ${formatCurrency(account.balance_mxn, 'MXN')}`
                        : formatCurrency(reportData.currency === 'MXN' ? account.balance_mxn : account.balance_usd, reportData.currency)
                      }
                    </span>
                  </div>
                ))}

                {/* Total Equity */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  marginTop: '0.5rem',
                  borderTop: '2px solid #7c3aed',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}>
                  <span>TOTAL EQUITY</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.equity.total_usd, 'USD')} / ${formatCurrency(reportData.equity.total_mxn, 'MXN')}`
                      : formatCurrency(reportData.equity.total, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* Total Liabilities + Equity */}
              <div style={{ 
                padding: '1rem',
                background: '#f3f4f6',
                borderRadius: '0.5rem',
                marginBottom: '1rem'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '1.125rem',
                  fontWeight: '700',
                  color: '#374151'
                }}>
                  <span>TOTAL LIABILITIES + EQUITY</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.total_liabilities_equity_usd, 'USD')} / ${formatCurrency(reportData.total_liabilities_equity_mxn, 'MXN')}`
                      : formatCurrency(reportData.total_liabilities_equity, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* Balance Check */}
              <div style={{ 
                padding: '1rem',
                background: reportData.is_balanced ? '#f0fdf4' : '#fee2e2',
                borderRadius: '0.5rem',
                border: `2px solid ${reportData.is_balanced ? '#10b981' : '#ef4444'}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: reportData.is_balanced ? '#166534' : '#991b1b'
                }}>
                  {reportData.is_balanced ? (
                    <>
                      <span>✅</span>
                      <span>BALANCED</span>
                    </>
                  ) : (
                    <>
                      <span>⚠️</span>
                      <span>OUT OF BALANCE</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: '400' }}>
                        (Difference: {reportData.currency === 'BOTH'
                          ? `${formatCurrency(reportData.balance_difference_usd, 'USD')} / ${formatCurrency(reportData.balance_difference_mxn, 'MXN')}`
                          : formatCurrency(reportData.balance_difference, reportData.currency)
                        })
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

window.BalanceSheetReport = BalanceSheetReport;
