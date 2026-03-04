// SalesReports.jsx - Sales Analytics Dashboard
// Comprehensive reporting with charts and metrics

const SalesReports = () => {
  const [loading, setLoading] = React.useState(true);
  const [analytics, setAnalytics] = React.useState(null);
  const [filters, setFilters] = React.useState({
    start_date: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    currency: 'ALL'
  });

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    loadAnalytics();
  }, [filters]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        ...(filters.currency !== 'ALL' && { currency: filters.currency })
      });

      const response = await fetch(`${API_URL}/reports/sales-analytics?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount && amount !== 0) return currency === 'USD' ? '$0.00' : 'MXN $0.00';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return currency === 'USD' ? `$${formatted}` : `MXN $${formatted}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <div style={{ fontSize: '1.25rem' }}>Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#dc2626' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <div style={{ fontSize: '1.25rem' }}>Failed to load analytics</div>
      </div>
    );
  }

  const { overview, client_analytics, financial_analysis, trends } = analytics;

  return (
    <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '800', color: '#111827' }}>
          📊 Sales Reports & Analytics
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
          Comprehensive insights into your sales performance
        </p>
      </div>

      {/* Filters */}
      <div style={{
        padding: '1.5rem',
        background: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'end'
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
            Start Date
          </label>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem'
            }}
          />
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
            End Date
          </label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem'
            }}
          />
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
            Currency
          </label>
          <select
            value={filters.currency}
            onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <option value="ALL">All Currencies</option>
            <option value="USD">USD Only</option>
            <option value="MXN">MXN Only</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Total Sales */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Sales</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>{overview.total_sales}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>
            {overview.unique_clients} unique clients
          </div>
        </div>

        {/* Revenue USD */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Revenue (USD)</div>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>{formatCurrency(overview.revenue_usd, 'USD')}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Profit: {formatCurrency(overview.total_profit_usd, 'USD')}
          </div>
        </div>

        {/* Revenue MXN */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Revenue (MXN)</div>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>{formatCurrency(overview.revenue_mxn, 'MXN')}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Profit: {formatCurrency(overview.total_profit_mxn, 'MXN')}
          </div>
        </div>

        {/* Profit Margin */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Avg Profit Margin</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>{overview.avg_profit_margin.toFixed(1)}%</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Across all sales
          </div>
        </div>

        {/* Pending Balance */}
        <div style={{
          padding: '1.5rem',
          background: overview.pending_balance > 0 
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Pending Balance</div>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>
            {formatCurrency(overview.pending_balance, filters.currency !== 'ALL' ? filters.currency : 'USD')}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Outstanding payments
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Payment Status Breakdown */}
        <div style={{
          padding: '1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
            💳 Payment Status
          </h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              background: '#d1fae5',
              borderRadius: '0.5rem'
            }}>
              <span style={{ fontWeight: '600', color: '#065f46' }}>Paid in Full</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#065f46' }}>
                {overview.payment_status_breakdown.paid_in_full}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              background: '#fef3c7',
              borderRadius: '0.5rem'
            }}>
              <span style={{ fontWeight: '600', color: '#92400e' }}>Partial Payment</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#92400e' }}>
                {overview.payment_status_breakdown.partial_payment}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              background: '#fee2e2',
              borderRadius: '0.5rem'
            }}>
              <span style={{ fontWeight: '600', color: '#991b1b' }}>Pending Deposit</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#991b1b' }}>
                {overview.payment_status_breakdown.pending_deposit}
              </span>
            </div>
          </div>
        </div>

        {/* Top Clients */}
        <div style={{
          padding: '1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
            👥 Top Clients
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {client_analytics.top_clients.slice(0, 5).map((client, idx) => (
              <div key={idx} style={{
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                  {client.client_name}
                  {client.client_company && <span style={{ color: '#6b7280', fontWeight: '400' }}> • {client.client_company}</span>}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {client.total_purchases} purchase{client.total_purchases !== 1 ? 's' : ''} • {client.client_location || 'Location N/A'}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981', marginTop: '0.25rem' }}>
                  {client.total_spent_usd > 0 && formatCurrency(client.total_spent_usd, 'USD')}
                  {client.total_spent_usd > 0 && client.total_spent_mxn > 0 && ' + '}
                  {client.total_spent_mxn > 0 && formatCurrency(client.total_spent_mxn, 'MXN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Use Case Breakdown */}
      <div style={{
        padding: '1.5rem',
        background: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
          🚌 Sales by Use Case
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {client_analytics.use_case_breakdown.map((useCase, idx) => (
            <div key={idx} style={{
              padding: '1rem',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '0.5rem',
              border: '1px solid #bae6fd'
            }}>
              <div style={{ fontWeight: '700', color: '#0c4a6e', marginBottom: '0.5rem' }}>
                {useCase.use_case || 'Not Specified'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#075985' }}>
                {useCase.count} sale{useCase.count !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Sales Table */}
      <div style={{
        padding: '1.5rem',
        background: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
          📋 Detailed Sales Report
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Vehicle</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Client</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Sale Price</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Total Cost</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Profit</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Margin</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {financial_analysis.detailed_sales.map((sale, idx) => (
                <tr key={sale.inventory_id} style={{
                  borderBottom: '1px solid #e5e7eb',
                  background: idx % 2 === 0 ? 'white' : '#f9fafb'
                }}>
                  <td style={{ padding: '0.75rem' }}>{formatDate(sale.sale_date)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{sale.stock_number}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sale.vehicle}</div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: '500', color: '#111827' }}>{sale.client_name}</div>
                    {sale.client_company && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sale.client_company}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                    {formatCurrency(sale.sale_price, sale.sale_currency)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>
                    {formatCurrency(sale.total_cost, sale.sale_currency)}
                  </td>
                  <td style={{
                    padding: '0.75rem',
                    textAlign: 'right',
                    fontWeight: '700',
                    color: sale.profit >= 0 ? '#10b981' : '#dc2626'
                  }}>
                    {formatCurrency(sale.profit, sale.sale_currency)}
                  </td>
                  <td style={{
                    padding: '0.75rem',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: sale.profit_margin >= 10 ? '#10b981' : (sale.profit_margin >= 5 ? '#f59e0b' : '#dc2626')
                  }}>
                    {sale.profit_margin.toFixed(1)}%
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: sale.payment_status === 'Paid in Full' ? '#d1fae5' : 
                                  sale.payment_status === 'Partial Payment' ? '#fef3c7' : '#fee2e2',
                      color: sale.payment_status === 'Paid in Full' ? '#065f46' : 
                             sale.payment_status === 'Partial Payment' ? '#92400e' : '#991b1b'
                    }}>
                      {sale.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Export for standalone use
window.SalesReports = SalesReports;
