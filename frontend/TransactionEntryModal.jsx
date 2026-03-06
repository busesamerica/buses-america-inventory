// TransactionEntryModal.jsx - Simplified transaction entry for Buses America
// Handles: Deposits, Expenses, Transfers

const TransactionEntryModal = ({ isOpen, onClose, onComplete }) => {
  const [transactionType, setTransactionType] = React.useState('deposit');
  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'USD',
    bankAccount: '',
    expenseAccount: '',
    description: '',
    reference: '',
    fromAccount: '',
    toAccount: ''
  });
  
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    if (isOpen) {
      loadAccounts();
      resetForm();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setAccounts(await response.json());
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      currency: 'USD',
      bankAccount: '',
      expenseAccount: '',
      description: '',
      reference: '',
      fromAccount: '',
      toAccount: ''
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (transactionType === 'transfer' && formData.fromAccount === formData.toAccount) {
      setError('Cannot transfer to the same account');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('session_token');
      let lines = [];
      let desc = '';
      
      if (transactionType === 'deposit') {
        const capitalAccount = accounts.find(a => a.account_name.includes('Capital Contributions'));
        desc = `Deposit - ${formData.description}`;
        lines = [
          { account_id: parseInt(formData.bankAccount), debit_amount: parseFloat(formData.amount), credit_amount: 0, currency: formData.currency },
          { account_id: capitalAccount?.account_id, debit_amount: 0, credit_amount: parseFloat(formData.amount), currency: formData.currency }
        ];
      } else if (transactionType === 'expense') {
        desc = `Expense - ${formData.description}`;
        lines = [
          { account_id: parseInt(formData.expenseAccount), debit_amount: parseFloat(formData.amount), credit_amount: 0, currency: formData.currency },
          { account_id: parseInt(formData.bankAccount), debit_amount: 0, credit_amount: parseFloat(formData.amount), currency: formData.currency }
        ];
      } else {
        desc = `Transfer - ${formData.description || 'Between accounts'}`;
        lines = [
          { account_id: parseInt(formData.toAccount), debit_amount: parseFloat(formData.amount), credit_amount: 0, currency: formData.currency },
          { account_id: parseInt(formData.fromAccount), debit_amount: 0, credit_amount: parseFloat(formData.amount), currency: formData.currency }
        ];
      }

      const response = await fetch(`${API_URL}/accounting/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          transaction_date: formData.date,
          description: desc,
          reference_type: transactionType,
          currency: formData.currency,
          notes: formData.reference,
          lines
        })
      });

      if (!response.ok) throw new Error('Failed to record transaction');

      alert('✅ Transaction recorded successfully!');
      onComplete && onComplete();
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    setTransactionType('deposit');
    onClose();
  };

  if (!isOpen) return null;

  const bankAccounts = accounts.filter(a => a.account_type === 'Asset' && (a.account_subtype === 'Bank' || a.account_subtype === 'Cash'));
  const expenseAccounts = accounts.filter(a => a.account_type === 'Expense');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '0.75rem', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>📝 Record Transaction</h2>
          <button onClick={handleClose} style={{ padding: '0.5rem', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#991b1b', marginBottom: '1rem' }}>{error}</div>}

          {/* Type Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Transaction Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[{value: 'deposit', label: '💵 Deposit', color: '#10b981'}, {value: 'expense', label: '💸 Expense', color: '#ef4444'}, {value: 'transfer', label: '🔄 Transfer', color: '#3b82f6'}].map(type => (
                <button key={type.value} type="button" onClick={() => setTransactionType(type.value)} style={{ padding: '0.75rem', background: transactionType === type.value ? type.color : 'white', color: transactionType === type.value ? 'white' : '#374151', border: `2px solid ${type.color}`, borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>{type.label}</button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Date *</label>
            <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
          </div>

          {(transactionType === 'deposit' || transactionType === 'expense') && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>{transactionType === 'deposit' ? 'Deposit To' : 'Pay From'} *</label>
                <select value={formData.bankAccount} onChange={(e) => setFormData({...formData, bankAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                  <option value="">Select account...</option>
                  {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
                </select>
              </div>

              {transactionType === 'expense' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Expense Category *</label>
                  <select value={formData.expenseAccount} onChange={(e) => setFormData({...formData, expenseAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select category...</option>
                    {expenseAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required placeholder="0.00" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Currency *</label>
                  <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="USD">USD</option>
                    <option value="MXN">MXN</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Description *</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required placeholder={transactionType === 'deposit' ? 'Owner deposit, etc.' : 'Fuel, marketing, etc.'} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Reference (Optional)</label>
                <input type="text" value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} placeholder="Receipt #, check #" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
              </div>
            </>
          )}

          {transactionType === 'transfer' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>From *</label>
                  <select value={formData.fromAccount} onChange={(e) => setFormData({...formData, fromAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select...</option>
                    {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>To *</label>
                  <select value={formData.toAccount} onChange={(e) => setFormData({...formData, toAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select...</option>
                    {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required placeholder="0.00" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Currency *</label>
                  <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="USD">USD</option>
                    <option value="MXN">MXN</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Description (Optional)</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Reason for transfer" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" onClick={handleClose} disabled={loading} style={{ padding: '0.75rem 1.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ padding: '0.75rem 1.5rem', background: loading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Recording...' : '✅ Record Transaction'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

window.TransactionEntryModal = TransactionEntryModal;
