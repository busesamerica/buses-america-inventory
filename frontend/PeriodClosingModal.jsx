// PeriodClosingModal.jsx - Close Accounting Period

const PeriodClosingModal = ({ isOpen, onClose, onComplete }) => {
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState(1); // 1: Setup, 2: Preview, 3: Confirm
  const [netIncome, setNetIncome] = React.useState(null);
  const [periodData, setPeriodData] = React.useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    period_name: ''
  });

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    if (isOpen) {
      // Auto-generate period name
      const date = new Date(periodData.end_date);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      setPeriodData({...periodData, period_name: monthYear});
      setStep(1);
      setNetIncome(null);
    }
  }, [isOpen]);

  const handleFieldChange = (field, value) => {
    setPeriodData({...periodData, [field]: value});
  };

  const loadNetIncome = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams({
        start_date: periodData.start_date,
        end_date: periodData.end_date,
        currency: 'BOTH'
      });
      
      const response = await fetch(`${API_URL}/accounting/reports/income-statement?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNetIncome(data);
        setStep(2);
      } else {
        alert('Error loading income statement. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error loading income statement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const executePeriodClose = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/close-period`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(periodData)
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        onComplete();
        onClose();
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.detail || 'Failed to close period'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error closing period. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'MXN' ? 'MXN' : 'USD'
    }).format(amount);
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
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '0.75rem',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
            🔒 Close Accounting Period
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

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Step 1: Setup */}
          {step === 1 && (
            <>
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #3b82f6' }}>
                <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
                  ℹ️ About Period Closing
                </div>
                <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                  Closing a period will:
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    <li>Calculate Net Income for the period</li>
                    <li>Transfer Net Income to Retained Earnings</li>
                    <li>Zero out all Revenue and Expense accounts</li>
                    <li>Create a permanent closing entry</li>
                  </ul>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Period Name
                </label>
                <input
                  type="text"
                  value={periodData.period_name}
                  onChange={(e) => handleFieldChange('period_name', e.target.value)}
                  placeholder="e.g., March 2026"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Period Start Date
                  </label>
                  <input
                    type="date"
                    value={periodData.start_date}
                    onChange={(e) => handleFieldChange('start_date', e.target.value)}
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
                    Period End Date
                  </label>
                  <input
                    type="date"
                    value={periodData.end_date}
                    onChange={(e) => handleFieldChange('end_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <button
                onClick={loadNetIncome}
                disabled={loading || !periodData.period_name}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: loading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: loading || !periodData.period_name ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Calculating...' : 'Next: Preview Net Income →'}
              </button>
            </>
          )}

          {/* Step 2: Preview */}
          {step === 2 && netIncome && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
                  Period: {periodData.period_name}
                </h3>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                  {new Date(periodData.start_date).toLocaleDateString()} - {new Date(periodData.end_date).toLocaleDateString()}
                </div>

                <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Net Income for Period
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: netIncome.net_income_usd >= 0 ? '#059669' : '#dc2626' }}>
                    {formatCurrency(netIncome.net_income_usd, 'USD')}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: netIncome.net_income_mxn >= 0 ? '#059669' : '#dc2626', marginTop: '0.25rem' }}>
                    {formatCurrency(netIncome.net_income_mxn, 'MXN')}
                  </div>
                </div>

                <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #f59e0b', marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.5rem' }}>
                    ⚠️ Warning
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
                    This action cannot be undone. Once closed, the period will be locked and all revenue/expense accounts will be zeroed.
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button
                  onClick={() => setStep(1)}
                  disabled={loading}
                  style={{
                    padding: '0.75rem',
                    background: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={executePeriodClose}
                  disabled={loading}
                  style={{
                    padding: '0.75rem',
                    background: loading ? '#9ca3af' : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Closing...' : '🔒 Close Period'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

window.PeriodClosingModal = PeriodClosingModal;
