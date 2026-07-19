// IncomeStatementReport.jsx - Income Statement (Profit & Loss) Report

const IncomeStatementReport = ({ isOpen, onClose }) => {
  const [loading, setLoading] = React.useState(false);
  const [reportData, setReportData] = React.useState(null);
  const [filters, setFilters] = React.useState({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // January 1 of current year
    end_date: new Date().toISOString().split('T')[0], // Today
    currency: 'BOTH'
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
      const response = await fetch(`${API_URL}/accounting/reports/income-statement?${params}`, {
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
      currency: currency
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
            📊 Income Statement
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                Start Date
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
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
                End Date
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
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
                <option value="BOTH">Both</option>
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
              Click "Run Report" to generate the income statement
            </div>
          ) : (
            <>
              {/* Report Header */}
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                  BUSES AMERICA
                </h3>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#374151' }}>
                  Income Statement
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {formatDate(reportData.start_date)} - {formatDate(reportData.end_date)}
                </div>
              </div>

              {/* Revenue Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ 
                  fontSize: '1rem', 
                  fontWeight: '700', 
                  color: '#059669',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase'
                }}>
                  REVENUE
                </div>
                {reportData.revenue.accounts.map((account, idx) => (
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
                        ? `${formatCurrency(account.amount_usd, 'USD')} / ${formatCurrency(account.amount_mxn, 'MXN')}`
                        : formatCurrency(reportData.currency === 'MXN' ? account.amount_mxn : account.amount_usd, reportData.currency)
                      }
                    </span>
                  </div>
                ))}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderTop: '1px solid #e5e7eb',
                  fontWeight: '700'
                }}>
                  <span>Total Revenue</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.revenue.total_usd, 'USD')} / ${formatCurrency(reportData.revenue.total_mxn, 'MXN')}`
                      : formatCurrency(reportData.revenue.total, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* COGS Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ 
                  fontSize: '1rem', 
                  fontWeight: '700', 
                  color: '#dc2626',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase'
                }}>
                  COST OF GOODS SOLD
                </div>
                {reportData.cogs.accounts.map((account, idx) => (
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
                        ? `${formatCurrency(account.amount_usd, 'USD')} / ${formatCurrency(account.amount_mxn, 'MXN')}`
                        : formatCurrency(reportData.currency === 'MXN' ? account.amount_mxn : account.amount_usd, reportData.currency)
                      }
                    </span>
                  </div>
                ))}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderTop: '1px solid #e5e7eb',
                  fontWeight: '700'
                }}>
                  <span>Total COGS</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.cogs.total_usd, 'USD')} / ${formatCurrency(reportData.cogs.total_mxn, 'MXN')}`
                      : formatCurrency(reportData.cogs.total, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* Gross Profit */}
              <div style={{ 
                marginBottom: '2rem',
                padding: '1rem',
                background: '#f0fdf4',
                borderRadius: '0.5rem'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '1.125rem',
                  fontWeight: '700',
                  color: '#166534'
                }}>
                  <span>GROSS PROFIT</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.gross_profit_usd, 'USD')} / ${formatCurrency(reportData.gross_profit_mxn, 'MXN')}`
                      : formatCurrency(reportData.gross_profit, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* Operating Expenses Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ 
                  fontSize: '1rem', 
                  fontWeight: '700', 
                  color: '#dc2626',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase'
                }}>
                  OPERATING EXPENSES
                </div>
                {reportData.operating_expenses.accounts.map((account, idx) => (
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
                        ? `${formatCurrency(account.amount_usd, 'USD')} / ${formatCurrency(account.amount_mxn, 'MXN')}`
                        : formatCurrency(reportData.currency === 'MXN' ? account.amount_mxn : account.amount_usd, reportData.currency)
                      }
                    </span>
                  </div>
                ))}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderTop: '1px solid #e5e7eb',
                  fontWeight: '700'
                }}>
                  <span>Total Operating Expenses</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.operating_expenses.total_usd, 'USD')} / ${formatCurrency(reportData.operating_expenses.total_mxn, 'MXN')}`
                      : formatCurrency(reportData.operating_expenses.total, reportData.currency)
                    }
                  </span>
                </div>
              </div>

              {/* Net Income */}
              <div style={{ 
                padding: '1.5rem',
                background: reportData.currency === 'BOTH' 
                  ? (reportData.net_income_usd >= 0 && reportData.net_income_mxn >= 0 ? '#f0fdf4' : '#fee2e2')
                  : (reportData.net_income >= 0 ? '#f0fdf4' : '#fee2e2'),
                borderRadius: '0.5rem',
                border: reportData.currency === 'BOTH'
                  ? (reportData.net_income_usd >= 0 && reportData.net_income_mxn >= 0 ? '2px solid #10b981' : '2px solid #ef4444')
                  : (reportData.net_income >= 0 ? '2px solid #10b981' : '2px solid #ef4444')
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: reportData.currency === 'BOTH'
                    ? (reportData.net_income_usd >= 0 && reportData.net_income_mxn >= 0 ? '#166534' : '#991b1b')
                    : (reportData.net_income >= 0 ? '#166534' : '#991b1b')
                }}>
                  <span>NET INCOME</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {reportData.currency === 'BOTH'
                      ? `${formatCurrency(reportData.net_income_usd, 'USD')} / ${formatCurrency(reportData.net_income_mxn, 'MXN')}`
                      : formatCurrency(reportData.net_income, reportData.currency)
                    }
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

window.IncomeStatementReport = IncomeStatementReport;
