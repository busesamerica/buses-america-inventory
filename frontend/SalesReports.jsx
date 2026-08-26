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
  const [appliedFilters, setAppliedFilters] = React.useState({
    start_date: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    currency: 'ALL'
  });

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  // /api/reports/sales-analytics recomputes profit per sale with a DB call
  // per row, so its latency varies with how many sales fall in the
  // selected range. Without this guard, applying a new date filter before
  // the previous request finished could let the older, slower response
  // land last and silently overwrite the newer one - looking exactly like
  // the date filter "not doing anything". requestIdRef lets an in-flight
  // request recognize it's been superseded and drop its own response.
  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    loadAnalytics();
  }, [appliedFilters]);

  const loadAnalytics = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams({
        start_date: appliedFilters.start_date,
        end_date: appliedFilters.end_date,
        ...(appliedFilters.currency !== 'ALL' && { currency: appliedFilters.currency })
      });

      const response = await fetch(`${API_URL}/reports/sales-analytics?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (requestId !== requestIdRef.current) return; // a newer filter change superseded this request

      if (response.ok) {
        const data = await response.json();
        if (requestId !== requestIdRef.current) return;
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <div style={{ fontSize: '1rem' }}>Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#dc2626' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <div style={{ fontSize: '1rem' }}>Failed to load analytics</div>
      </div>
    );
  }

  const { overview, client_analytics, financial_analysis, trends } = analytics;

  return (
    <div style={{ background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
          📊 Sales Reports & Analytics
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          Comprehensive insights into your sales performance
        </p>
      </div>

      {/* Filters */}
      <div style={{
        padding: '1.5rem',
        background: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem',
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

        <button
          onClick={() => setAppliedFilters(filters)}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
          }}
        >
          🔍 Apply Filters
        </button>
      </div>

      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Sales */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Total Sales</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>{overview.total_sales}</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>
            {overview.unique_clients} unique clients
          </div>
        </div>

        {/* Revenue USD */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Revenue (USD)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(overview.revenue_usd, 'USD')}</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>
            Profit: {formatCurrency(overview.total_profit_usd, 'USD')}
          </div>
        </div>

        {/* Revenue MXN */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Revenue (MXN)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(overview.revenue_mxn, 'MXN')}</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>
            Profit: {formatCurrency(overview.total_profit_mxn, 'MXN')}
          </div>
        </div>

        {/* Profit Margin */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Avg Profit Margin</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>{overview.avg_profit_margin.toFixed(1)}%</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>
            Across all sales
          </div>
        </div>

        {/* Pending Balance */}
        <div style={{
          padding: '1rem',
          background: (overview.pending_balance_usd > 0 || overview.pending_balance_mxn > 0)
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Pending Balance</div>
          {/* USD and MXN balances are separate amounts, not one number - a
              USD sale's balance_due and an MXN sale's balance_due can't be
              added together without a conversion neither figure applies. */}
          <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {overview.pending_balance_usd > 0 && formatCurrency(overview.pending_balance_usd, 'USD')}
            {overview.pending_balance_usd > 0 && overview.pending_balance_mxn > 0 && ' + '}
            {overview.pending_balance_mxn > 0 && formatCurrency(overview.pending_balance_mxn, 'MXN')}
            {overview.pending_balance_usd === 0 && overview.pending_balance_mxn === 0 && formatCurrency(0, 'USD')}
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>
            Outstanding payments
          </div>
        </div>
      </div>

      {/* Monthly Trends - the backend already computed this (trends.monthly:
          sales_count/revenue_usd/revenue_mxn per month) but nothing ever
          rendered it, despite this file's own header comment promising
          "charts and metrics".
          One bar per month, sized by revenue_consolidated_usd - USD and
          MXN sales folded into a single USD-equivalent figure using each
          sale's own sale-date exchange rate (computed backend-side, next
          to the same historical-rate machinery calculate_total_costs
          already uses). That keeps every month's column the same shape
          regardless of currency mix.
          Every month in the selected range gets a column (including
          zero-sale months), which can be a year's worth or more. A grid
          with auto-fit lets columns shrink and wrap to new rows to fit the
          browser width instead of forcing one long horizontally-scrolling
          strip, and only the month + a compact revenue figure are always
          visible - the sale count and full USD/MXN breakdown move to the
          bar's tooltip so a wide range doesn't force wide columns. */}
      {trends?.monthly?.length > 0 && (
        <div style={{
          padding: '1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
            📈 Monthly Trends
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#9ca3af' }}>
            Revenue shown as consolidated USD equivalent (USD + MXN converted at each sale's exchange rate)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))', gap: '0.5rem 0.25rem' }}>
            {(() => {
              const maxRevenue = Math.max(1, ...trends.monthly.map(m => m.revenue_consolidated_usd || 0));
              const formatCompactUSD = (amount) => {
                const abs = Math.abs(amount);
                if (abs >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
                if (abs >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
                return formatCurrency(amount, 'USD');
              };
              return trends.monthly.map((m, idx) => {
                const barHeight = m.revenue_consolidated_usd > 0 ? Math.max(6, (m.revenue_consolidated_usd / maxRevenue) * 90) : 2;
                const monthStr = String(m.month).split('T')[0];
                const monthLabel = new Date(monthStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                const breakdown = [
                  m.revenue_usd > 0 && formatCurrency(m.revenue_usd, 'USD'),
                  m.revenue_mxn > 0 && formatCurrency(m.revenue_mxn, 'MXN')
                ].filter(Boolean).join(' + ');
                const tooltip = `${monthLabel}: ${m.sales_count} ${m.sales_count === 1 ? 'sale' : 'sales'}${breakdown ? ' - ' + breakdown : ''}`;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={tooltip}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '90px' }}>
                      <div
                        style={{
                          width: '18px',
                          height: `${barHeight}px`,
                          background: m.revenue_consolidated_usd > 0
                            ? 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)'
                            : '#e5e7eb',
                          borderRadius: '3px 3px 0 0'
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.4rem', fontWeight: '600' }}>
                      {monthLabel}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#111827', fontWeight: '700' }}>
                      {formatCompactUSD(m.revenue_consolidated_usd || 0)}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Payment Status Breakdown */}
        <div style={{
          padding: '1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
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
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
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
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
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
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
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
