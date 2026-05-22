// AccountingDashboard.jsx - Main Accounting Module
// Cash Position, Profit Distribution, and Transaction Management

const AccountingDashboard = () => {
  const [loading, setLoading] = React.useState(true);
  const [cashPosition, setCashPosition] = React.useState(null);
  const [accounts, setAccounts] = React.useState([]);
  const [selectedBusForDistribution, setSelectedBusForDistribution] = React.useState(null);
  const [showDistributionModal, setShowDistributionModal] = React.useState(false);
  const [showTransactionForm, setShowTransactionForm] = React.useState(false);
  const [showDistributionHistory, setShowDistributionHistory] = React.useState(false);
  const [showIncomeStatement, setShowIncomeStatement] = React.useState(false);
  const [showBalanceSheet, setShowBalanceSheet] = React.useState(false);
  const [showPeriodClosing, setShowPeriodClosing] = React.useState(false);

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCashPosition(),
        loadAccounts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCashPosition = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/cash-position`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCashPosition(data);
      }
    } catch (error) {
      console.error('Error loading cash position:', error);
    }
  };

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
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount && amount !== 0) return currency === 'USD' ? '$0.00' : 'MXN $0.00';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    const prefix = currency === 'USD' ? '$' : 'MXN $';
    return amount < 0 ? `(${prefix}${formatted})` : `${prefix}${formatted}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</div>
        <div style={{ fontSize: '1.25rem' }}>Loading accounting data...</div>
      </div>
    );
  }

  const usdAccounts = cashPosition?.accounts?.filter(a => a.currency === 'USD') || [];
  const mxnAccounts = cashPosition?.accounts?.filter(a => a.currency === 'MXN') || [];

  return (
    <div style={{ background: '#f9fafb' }}>
      {/* Cash Position Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Cash (USD) */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          borderLeft: '4px solid #10b981'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            💵 Total USD
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
            {formatCurrency(cashPosition?.totals?.usd || 0, 'USD')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            {usdAccounts.length} account{usdAccounts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Total Cash (MXN) */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          borderLeft: '4px solid #8b5cf6'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            💵 Total MXN
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
            {formatCurrency(cashPosition?.totals?.mxn || 0, 'MXN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            {mxnAccounts.length} account{mxnAccounts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* USD Equivalent */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          borderLeft: '4px solid #3b82f6'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            💰 Total Value (USD)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
            {formatCurrency(cashPosition?.totals?.usd_equivalent || 0, 'USD')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            Rate: 1 USD = {cashPosition?.exchange_rate?.toFixed(2) || '17.50'} MXN
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* USD Accounts */}
        <div style={{
          padding: '1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🇺🇸 USD Accounts
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {usdAccounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                No USD accounts
              </div>
            ) : (
              usdAccounts.map((account) => (
                <div key={account.account_id} style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '0.5rem',
                  borderLeft: '4px solid #10b981'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                        {account.account_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {account.account_subtype} • {account.account_code}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                      {formatCurrency(account.balance, 'USD')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MXN Accounts */}
        <div style={{
          padding: '1.5rem',
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🇲🇽 MXN Accounts
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {mxnAccounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                No MXN accounts
              </div>
            ) : (
              mxnAccounts.map((account) => (
                <div key={account.account_id} style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '0.5rem',
                  borderLeft: '4px solid #8b5cf6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                        {account.account_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {account.account_subtype} • {account.account_code}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#8b5cf6' }}>
                      {formatCurrency(account.balance, 'MXN')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        padding: '1.5rem',
        background: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
          ⚡ Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowTransactionForm(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
            }}
          >
            📝 Record Transaction
          </button>
          <button
            onClick={() => setShowDistributionModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
            }}
          >
            💸 Distribute Profit
          </button>
          <button
            onClick={() => setShowDistributionHistory(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'
            }}
          >
            📊 Distribution History
          </button>
          <button
            onClick={() => setShowIncomeStatement(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
            }}
          >
            📈 Income Statement
          </button>
          <button
            onClick={() => setShowBalanceSheet(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(6, 182, 212, 0.3)'
            }}
          >
            📊 Balance Sheet
          </button>
          <button
            onClick={() => setShowPeriodClosing(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
            }}
          >
            🔒 Close Period
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Modals */}
      <ProfitDistributionModal
        isOpen={showDistributionModal}
        onClose={() => setShowDistributionModal(false)}
        onComplete={() => {
          loadCashPosition();
          alert('✅ Profit distribution recorded successfully!');
        }}
      />

      <TransactionEntryModal
        isOpen={showTransactionForm}
        onClose={() => setShowTransactionForm(false)}
        onComplete={() => {
          loadCashPosition();
          loadAccounts();
        }}
      />

      <DistributionHistoryModal
        isOpen={showDistributionHistory}
        onClose={() => setShowDistributionHistory(false)}
      />

      <IncomeStatementReport
        isOpen={showIncomeStatement}
        onClose={() => setShowIncomeStatement(false)}
      />

      <BalanceSheetReport
        isOpen={showBalanceSheet}
        onClose={() => setShowBalanceSheet(false)}
      />

      <PeriodClosingModal
        isOpen={showPeriodClosing}
        onClose={() => setShowPeriodClosing(false)}
        onComplete={() => {
          loadCashPosition();
          loadAccounts();
        }}
      />
    </div>
  );
};

// Export for standalone use
window.AccountingDashboard = AccountingDashboard;
