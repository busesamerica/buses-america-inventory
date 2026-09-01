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
  const [showTransactionJournal, setShowTransactionJournal] = React.useState(false);
  const [showExchangeRate, setShowExchangeRate] = React.useState(false);
  const [showAPManagement, setShowAPManagement] = React.useState(false);
  const [expandedVendor, setExpandedVendor] = React.useState(null);
  const [apData, setApData] = React.useState(null);
  const [apPaymentForm, setApPaymentForm] = React.useState({ vendor: '', payment_amount: '', payment_currency: 'USD', payment_date: new Date().toISOString().split('T')[0], payment_account_id: '', notes: '' });
  const [apSaving, setApSaving] = React.useState(false);
  const [newRate, setNewRate] = React.useState('');
  const [rateDate, setRateDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [rateSaving, setRateSaving] = React.useState(false);
  const [rateHistory, setRateHistory] = React.useState([]);

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

  const loadRateHistory = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/exchange-rates?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRateHistory(data);
      }
    } catch (error) {
      console.error('Error loading rate history:', error);
    }
  };

  const saveExchangeRate = async () => {
    if (!newRate || parseFloat(newRate) <= 0) {
      alert('Please enter a valid exchange rate');
      return;
    }
    setRateSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/exchange-rates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_currency: 'USD',
          to_currency: 'MXN',
          rate: parseFloat(newRate),
          effective_date: rateDate
        })
      });
      if (response.ok) {
        alert('✅ Exchange rate updated successfully');
        setNewRate('');
        loadCashPosition();
        loadRateHistory();
      } else {
        const err = await response.json();
        alert('Error: ' + (err.detail || 'Failed to save rate'));
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setRateSaving(false);
    }
  };

  const loadAPData = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/ap-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setApData(data);
      }
    } catch (error) {
      console.error('Error loading AP data:', error);
    }
  };

  const recordAPPayment = async () => {
    if (!apPaymentForm.vendor || !apPaymentForm.payment_amount || !apPaymentForm.payment_account_id) {
      alert('Please fill in vendor, amount, and payment account');
      return;
    }
    setApSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/ap-payment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...apPaymentForm,
          payment_amount: parseFloat(apPaymentForm.payment_amount),
          payment_account_id: parseInt(apPaymentForm.payment_account_id)
        })
      });
      if (response.ok) {
        const data = await response.json();
        alert('✅ ' + data.message);
        setApPaymentForm({ vendor: '', payment_amount: '', payment_currency: 'USD', payment_date: new Date().toISOString().split('T')[0], payment_account_id: '', notes: '' });
        loadAPData();
        loadCashPosition();
      } else {
        const err = await response.json();
        alert('Error: ' + (err.detail || 'Failed to record payment'));
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setApSaving(false);
    }
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
      {/* No module-intro header here - the app shell's top bar already
          shows "Accounting Dashboard" as the page title (see
          App_COMPLETE.jsx); repeating it in a second, same-weight heading
          just to relabel this screen was pure duplication.
          InventoryManagement/ClientManagement/QuoteManagement never had
          one - this now matches them instead of being the odd one out. */}

      {/* Cash Position Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Cash (USD) */}
        <div style={statCardStyle('green')}>
          <div style={STAT_CARD_LABEL_STYLE}>💵 Cash (USD)</div>
          <div style={statCardValueStyle(formatCurrency(cashPosition?.totals?.usd || 0, 'USD'), true)}>
            {formatCurrency(cashPosition?.totals?.usd || 0, 'USD')}
          </div>
          <div style={STAT_CARD_SUBTEXT_STYLE}>
            {usdAccounts.length} account{usdAccounts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Total Cash (MXN) */}
        <div style={statCardStyle('purple')}>
          <div style={STAT_CARD_LABEL_STYLE}>💵 Cash (MXN)</div>
          <div style={statCardValueStyle(formatCurrency(cashPosition?.totals?.mxn || 0, 'MXN'), true)}>
            {formatCurrency(cashPosition?.totals?.mxn || 0, 'MXN')}
          </div>
          <div style={STAT_CARD_SUBTEXT_STYLE}>
            {mxnAccounts.length} account{mxnAccounts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* USD Equivalent */}
        <div style={statCardStyle('blue')}>
          <div style={STAT_CARD_LABEL_STYLE}>💰 Consolidated Cash Position</div>
          <div style={statCardValueStyle(formatCurrency(cashPosition?.totals?.usd_equivalent || 0, 'USD'), true)}>
            {formatCurrency(cashPosition?.totals?.usd_equivalent || 0, 'USD')}
          </div>
          <div style={STAT_CARD_SUBTEXT_STYLE}>
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
        {/* Flat solid colors, no gradients - matching QuoteManagement's
            button system (buttonStyle() in utils.js). Nine differently
            colored gradients in one row (one per button, no shared
            reasoning) is exactly the "various buttons with different
            colors and forms" this consolidates - but grouping every
            non-primary action into one or two generic buckets (gray, then
            dark+gray) read as "these buttons lost their color" instead,
            since most of the row still needs to be told apart at a
            glance. So each button keeps its own distinct color again,
            picked from the shared BUTTON_COLORS palette instead of a
            one-off gradient: blue/green for the two data-entry actions,
            purple/cyan/indigo/orange for the four reports, dark/gray for
            the two account settings actions, red for the one genuinely
            irreversible action, outline for Refresh. */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowTransactionForm(true)} style={buttonStyle('blue', 'md')}>
            📝 Record Transaction
          </button>
          <button onClick={() => setShowDistributionModal(true)} style={buttonStyle('green', 'md')}>
            💸 Distribute Profit
          </button>
          <button onClick={() => setShowDistributionHistory(true)} style={buttonStyle('purple', 'md')}>
            📊 Distribution History
          </button>
          <button onClick={() => setShowIncomeStatement(true)} style={buttonStyle('cyan', 'md')}>
            📈 Income Statement
          </button>
          <button onClick={() => setShowBalanceSheet(true)} style={buttonStyle('indigo', 'md')}>
            📊 Balance Sheet
          </button>
          <button onClick={() => setShowTransactionJournal(true)} style={buttonStyle('orange', 'md')}>
            📒 Transaction Journal
          </button>
          <button onClick={() => { setShowExchangeRate(true); loadRateHistory(); }} style={buttonStyle('dark', 'md')}>
            💱 Exchange Rate
          </button>
          <button onClick={() => { setShowAPManagement(true); loadAPData(); }} style={buttonStyle('gray', 'md')}>
            📋 Accounts Payable
          </button>
          <button onClick={() => setShowPeriodClosing(true)} style={buttonStyle('red', 'md')}>
            🔒 Close Period
          </button>
          <button onClick={() => window.location.reload()} style={buttonStyle('outline', 'md')}>
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

      <TransactionJournal
        isOpen={showTransactionJournal}
        onClose={() => setShowTransactionJournal(false)}
      />

      {/* Exchange Rate Modal */}
      {showExchangeRate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '0.75rem',
            maxWidth: '500px', width: '100%', maxHeight: '90vh',
            overflow: 'auto', boxShadow: '0 20px 25px rgba(0,0,0,0.15)'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>
                💱 Exchange Rate Management
              </h2>
              <button onClick={() => setShowExchangeRate(false)} style={{
                background: 'transparent', border: 'none', fontSize: '1.25rem',
                cursor: 'pointer', color: '#6b7280'
              }}>✕</button>
            </div>

            {/* Current Rate */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Current Rate
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>
                1 USD = {cashPosition?.exchange_rate?.toFixed(4) || '—'} MXN
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Used for all cross-currency calculations
              </div>
            </div>

            {/* Update Rate Form */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>
                Set New Rate
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Rate (1 USD = ? MXN)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    placeholder="17.5000"
                    style={{
                      width: '100%', padding: '0.6rem', border: '1px solid #d1d5db',
                      borderRadius: '0.375rem', fontSize: '0.9rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={rateDate}
                    onChange={(e) => setRateDate(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem', border: '1px solid #d1d5db',
                      borderRadius: '0.375rem', fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>
              <button
                onClick={saveExchangeRate}
                disabled={rateSaving || !newRate}
                style={{ ...buttonStyle('primary', 'md', rateSaving || !newRate), width: '100%', padding: '0.6rem' }}
              >
                {rateSaving ? 'Saving...' : 'Update Exchange Rate'}
              </button>
            </div>

            {/* Rate History */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                Rate History
              </div>
              {rateHistory.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No rate history available</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0', color: '#6b7280', fontWeight: '600' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0', color: '#6b7280', fontWeight: '600' }}>Pair</th>
                      <th style={{ textAlign: 'right', padding: '0.4rem 0', color: '#6b7280', fontWeight: '600' }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateHistory.map((r, idx) => (
                      <tr key={r.rate_id || idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.4rem 0', color: '#374151' }}>
                          {r.effective_date ? new Date(r.effective_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '0.4rem 0', color: '#6b7280' }}>
                          {r.from_currency}/{r.to_currency}
                        </td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: '600', color: '#111827', fontFamily: 'monospace' }}>
                          {parseFloat(r.rate).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AP Management Modal */}
      {showAPManagement && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '0.75rem',
            maxWidth: '700px', width: '100%', maxHeight: '90vh',
            overflow: 'auto', boxShadow: '0 20px 25px rgba(0,0,0,0.15)'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>
                📋 Accounts Payable
              </h2>
              <button onClick={() => setShowAPManagement(false)} style={{
                background: 'transparent', border: 'none', fontSize: '1.25rem',
                cursor: 'pointer', color: '#6b7280'
              }}>✕</button>
            </div>

            {/* Outstanding Payables */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>
                Outstanding Payables
              </div>
              {!apData || (apData.payables && apData.payables.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                  No outstanding payables
                </div>
              ) : (
                <div>
                  {(apData.payables || []).map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                      {/* Vendor header row — clickable */}
                      <div
                        onClick={() => setExpandedVendor(expandedVendor === item.vendor + item.currency ? null : item.vendor + item.currency)}
                        style={{
                          padding: '0.75rem 1rem',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          cursor: 'pointer', background: expandedVendor === item.vendor + item.currency ? '#fef2f2' : '#f9fafb'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{expandedVendor === item.vendor + item.currency ? '▼' : '▶'}</span>
                          <span style={{ fontWeight: '600', color: '#111827' }}>{item.vendor}</span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({item.currency})</span>
                        </div>
                        <span style={{ fontWeight: '700', color: '#dc2626' }}>
                          {item.balance != null
                            ? (item.currency === 'MXN' ? 'MX$' : '$') + parseFloat(item.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })
                            : '⚠ missing'
                          }
                        </span>
                      </div>

                      {/* Detail lines — expanded */}
                      {expandedVendor === item.vendor + item.currency && item.details && (
                        <div style={{ borderTop: '1px solid #e5e7eb' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ background: '#fef2f2' }}>
                                <th style={{ padding: '0.4rem 1rem', textAlign: 'left', color: '#991b1b', fontWeight: '600', fontSize: '0.65rem', textTransform: 'uppercase' }}>Date</th>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: '#991b1b', fontWeight: '600', fontSize: '0.65rem', textTransform: 'uppercase' }}>Description</th>
                                <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: '#991b1b', fontWeight: '600', fontSize: '0.65rem', textTransform: 'uppercase' }}>Charge</th>
                                <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: '#991b1b', fontWeight: '600', fontSize: '0.65rem', textTransform: 'uppercase' }}>Payment</th>
                                <th style={{ padding: '0.4rem 1rem', textAlign: 'right', color: '#991b1b', fontWeight: '600', fontSize: '0.65rem', textTransform: 'uppercase' }}>Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                let runningBalance = 0;
                                return item.details.map((d, dIdx) => {
                                  runningBalance += (d.charge || 0) - (d.payment || 0);
                                  const cur = d.currency === 'MXN' ? 'MX$' : '$';
                                  return (
                                    <tr key={dIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                      <td style={{ padding: '0.4rem 1rem', color: '#374151', whiteSpace: 'nowrap' }}>
                                        {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                      </td>
                                      <td style={{ padding: '0.4rem 0.5rem', color: '#374151', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {d.description}
                                      </td>
                                      <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: d.charge > 0 ? '#dc2626' : '#d1d5db', fontWeight: d.charge > 0 ? '600' : '400' }}>
                                        {d.charge > 0 ? cur + d.charge.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                      </td>
                                      <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: d.payment > 0 ? '#059669' : '#d1d5db', fontWeight: d.payment > 0 ? '600' : '400' }}>
                                        {d.payment > 0 ? cur + d.payment.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                      </td>
                                      <td style={{ padding: '0.4rem 1rem', textAlign: 'right', fontWeight: '600', color: runningBalance > 0 ? '#991b1b' : '#059669' }}>
                                        {cur}{runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}

                  {apData.totals && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fef2f2', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: '600', color: '#991b1b' }}>Total Owed:</span>
                      <div>
                        {apData.totals.USD ? <span style={{ fontWeight: '600', color: '#991b1b', marginRight: '1rem' }}>${parseFloat(apData.totals.USD).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span> : null}
                        {apData.totals.MXN ? <span style={{ fontWeight: '600', color: '#991b1b' }}>MX${parseFloat(apData.totals.MXN).toLocaleString('en-US', { minimumFractionDigits: 2 })} MXN</span> : null}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Record AP Payment */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>
                Record Payment
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Vendor *</label>
                  {apData && apData.payables && apData.payables.length > 0 ? (
                    <select
                      value={apPaymentForm.vendor}
                      onChange={(e) => {
                        const selected = apData.payables.find(p => p.vendor === e.target.value);
                        const currency = selected ? selected.currency : apPaymentForm.payment_currency;
                        setApPaymentForm({
                          ...apPaymentForm,
                          vendor: e.target.value,
                          payment_currency: currency,
                          // the vendor's currency can differ from whatever was
                          // previously picked below - drop it rather than
                          // leave a now-wrong-currency account selected
                          payment_account_id: currency === apPaymentForm.payment_currency ? apPaymentForm.payment_account_id : ''
                        });
                      }}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.85rem' }}
                    >
                      <option value="">Select vendor...</option>
                      {[...new Set(apData.payables.map(p => p.vendor))].map((v, idx) => (
                        <option key={idx} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={apPaymentForm.vendor} onChange={(e) => setApPaymentForm({ ...apPaymentForm, vendor: e.target.value })}
                      placeholder="Vendor name" style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.85rem' }} />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Amount *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" step="0.01" value={apPaymentForm.payment_amount}
                      onChange={(e) => setApPaymentForm({ ...apPaymentForm, payment_amount: e.target.value })}
                      placeholder="0.00" style={{ flex: 1, padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.85rem' }} />
                    <select value={apPaymentForm.payment_currency}
                      onChange={(e) => setApPaymentForm({ ...apPaymentForm, payment_currency: e.target.value, payment_account_id: '' })}
                      style={{ width: '80px', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                      <option value="USD">USD</option>
                      <option value="MXN">MXN</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Payment Date *</label>
                  <input type="date" value={apPaymentForm.payment_date}
                    onChange={(e) => setApPaymentForm({ ...apPaymentForm, payment_date: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.85rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Pay From *</label>
                  {/* Only offer accounts matching the payment's currency - a
                      USD vendor bill paid "from" an MXN account would credit
                      that account's balance by the raw USD number with no
                      conversion (the backend now rejects the mismatch too). */}
                  <select value={apPaymentForm.payment_account_id}
                    onChange={(e) => setApPaymentForm({ ...apPaymentForm, payment_account_id: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                    <option value="">Select {apPaymentForm.payment_currency} account...</option>
                    {accounts.filter(a => ['Bank', 'Cash'].includes(a.account_subtype) && a.is_active && a.currency === apPaymentForm.payment_currency).map(a => (
                      <option key={a.account_id} value={a.account_id}>{a.account_name} ({a.currency})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Notes (Optional)</label>
                <input type="text" value={apPaymentForm.notes}
                  onChange={(e) => setApPaymentForm({ ...apPaymentForm, notes: e.target.value })}
                  placeholder="Payment reference or notes"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.85rem' }} />
              </div>
              <button
                onClick={recordAPPayment}
                disabled={apSaving || !apPaymentForm.vendor || !apPaymentForm.payment_amount || !apPaymentForm.payment_account_id}
                style={{
                  ...buttonStyle('red', 'md', apSaving || !apPaymentForm.vendor || !apPaymentForm.payment_amount || !apPaymentForm.payment_account_id),
                  width: '100%', padding: '0.6rem'
                }}
              >
                {apSaving ? 'Processing...' : 'Record AP Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export for standalone use
window.AccountingDashboard = AccountingDashboard;
