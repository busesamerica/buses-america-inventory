const RecordPurchasePaymentModal = ({ bus, onClose, onSuccess }) => {
  const [paymentAccounts, setPaymentAccounts] = React.useState([]);
  const [selectedAccount, setSelectedAccount] = React.useState('');
  const [paymentDate, setPaymentDate] = React.useState(bus.purchase_date || new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  
  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  
  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch(`${API_URL}/accounting/accounts`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('session_token')}`
          }
        });
        
        if (response.ok) {
          const accounts = await response.json();
          const paymentAccs = accounts.filter(acc => 
            acc.account_type === 'Asset' && 
            (acc.account_name.includes('Bank') || acc.account_name.includes('Cash'))
          );
          setPaymentAccounts(paymentAccs);
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    };
    
    fetchAccounts();
  }, []);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedAccount) {
      setError('Please select a payment account');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/record-purchase-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('session_token')}`
        },
        body: JSON.stringify({
          payment_account_id: parseInt(selectedAccount),
          payment_date: paymentDate
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to record payment');
      }
      
      const result = await response.json();
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
          💰 Record Purchase Payment
        </h2>
        
        <div style={{ 
          padding: '1rem', 
          background: '#f3f4f6', 
          borderRadius: '0.375rem', 
          marginBottom: '1.5rem' 
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Bus</div>
          <div style={{ fontWeight: '600' }}>{bus.stock_number}</div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>Purchase Price</div>
          <div style={{ fontWeight: '600' }}>${parseFloat(bus.purchase_price_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</div>
        </div>
        
        {error && (
          <div style={{
            padding: '0.75rem',
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '0.375rem',
            color: '#991b1b',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
              Paid From <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            >
              <option value="">Select payment account</option>
              {paymentAccounts.map(account => (
                <option key={account.account_id} value={account.account_id}>
                  {account.account_name} ({account.currency})
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Which bank/cash account was used to pay for this bus?
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                background: saving ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem'
              }}
            >
              {saving ? '⏳ Recording...' : '💰 Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
