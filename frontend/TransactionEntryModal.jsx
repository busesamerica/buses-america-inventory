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
    toAccount: '',
    fromAmount: '',
    toAmount: '',
    exchangeRate: '',
    paymentStatus: 'paid',
    vendor: ''
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
      toAccount: '',
      fromAmount: '',
      toAmount: '',
      exchangeRate: '',
      paymentStatus: 'paid',
      vendor: ''
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
    if (transactionType === 'exchange') {
      if (!formData.fromAccount || !formData.toAccount) {
        setError('Please select both accounts');
        return;
      }
      if (!formData.fromAmount || !formData.toAmount) {
        setError('Please enter both amounts');
        return;
      }
      if (formData.fromAccount === formData.toAccount) {
        setError('Cannot exchange to the same account');
        return;
      }
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
        if (formData.paymentStatus === 'on_credit') {
          if (!formData.vendor || !formData.vendor.trim()) {
            setError('Vendor is required for expenses on credit');
            return;
          }
          // Find AP account for this currency
          const apAccount = accounts.find(a => a.account_subtype === 'AP' && a.currency === formData.currency);
          if (!apAccount) {
            setError('No Accounts Payable account found for ' + formData.currency);
            return;
          }
          desc = `Expense (Credit) - ${formData.description}`;
          lines = [
            { account_id: parseInt(formData.expenseAccount), debit_amount: parseFloat(formData.amount), credit_amount: 0, currency: formData.currency, notes: formData.description },
            { account_id: apAccount.account_id, debit_amount: 0, credit_amount: parseFloat(formData.amount), currency: formData.currency, notes: `AP — ${formData.vendor} — ${formData.description}` }
          ];
        } else {
          if (!formData.bankAccount) {
            setError('Please select a payment account');
            return;
          }
          desc = `Expense - ${formData.description}`;
          lines = [
            { account_id: parseInt(formData.expenseAccount), debit_amount: parseFloat(formData.amount), credit_amount: 0, currency: formData.currency },
            { account_id: parseInt(formData.bankAccount), debit_amount: 0, credit_amount: parseFloat(formData.amount), currency: formData.currency }
          ];
        }
      } else if (transactionType === 'exchange') {
        // Currency exchange: MXN leaves one account, USD enters another (or vice versa)
        const fromAccount = accounts.find(a => a.account_id === parseInt(formData.fromAccount));
        const toAccount = accounts.find(a => a.account_id === parseInt(formData.toAccount));
        const fromCurrency = fromAccount?.currency || 'MXN';
        const toCurrency = toAccount?.currency || 'USD';
        desc = `Exchange - ${formData.description || `${fromCurrency} to ${toCurrency}`} @ ${formData.exchangeRate}`;
        lines = [
          { account_id: parseInt(formData.toAccount), debit_amount: parseFloat(formData.toAmount), credit_amount: 0, currency: toCurrency },
          { account_id: parseInt(formData.fromAccount), debit_amount: 0, credit_amount: parseFloat(formData.fromAmount), currency: fromCurrency }
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
  // Deposit/Expense/Transfer all send a single formData.currency for every
  // line in the transaction, so the account(s) picked for them must be in
  // that same currency - the backend now rejects a mismatch, but filtering
  // here keeps the accounts that would fail from being offered at all.
  // Only Exchange is meant to cross currencies, so it keeps the full list.
  const sameCurrencyBankAccounts = bankAccounts.filter(a => a.currency === formData.currency);

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[{value: 'deposit', label: '💵 Deposit', color: '#10b981'}, {value: 'expense', label: '💸 Expense', color: '#ef4444'}, {value: 'transfer', label: '🔄 Transfer', color: '#3b82f6'}, {value: 'exchange', label: '💱 Exchange', color: '#8b5cf6'}].map(type => (
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
              {transactionType === 'expense' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Payment Status *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setFormData({...formData, paymentStatus: 'paid', vendor: ''})}
                      style={{ flex: 1, padding: '0.6rem', border: formData.paymentStatus === 'paid' ? '2px solid #059669' : '1px solid #d1d5db', borderRadius: '0.5rem', background: formData.paymentStatus === 'paid' ? '#d1fae5' : 'white', color: formData.paymentStatus === 'paid' ? '#065f46' : '#374151', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                      💵 Paid
                    </button>
                    <button type="button" onClick={() => setFormData({...formData, paymentStatus: 'on_credit', bankAccount: ''})}
                      style={{ flex: 1, padding: '0.6rem', border: formData.paymentStatus === 'on_credit' ? '2px solid #d97706' : '1px solid #d1d5db', borderRadius: '0.5rem', background: formData.paymentStatus === 'on_credit' ? '#fef3c7' : 'white', color: formData.paymentStatus === 'on_credit' ? '#92400e' : '#374151', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                      📋 On Credit
                    </button>
                  </div>
                </div>
              )}

              {(transactionType === 'deposit' || (transactionType === 'expense' && formData.paymentStatus === 'paid')) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>{transactionType === 'deposit' ? 'Deposit To' : 'Paid From'} *</label>
                  <select value={formData.bankAccount} onChange={(e) => setFormData({...formData, bankAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select {formData.currency} account...</option>
                    {sameCurrencyBankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name} ({a.currency})</option>)}
                  </select>
                </div>
              )}

              {transactionType === 'expense' && formData.paymentStatus === 'on_credit' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Vendor *</label>
                  <input type="text" value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                    placeholder="Who do you owe?" required
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Will be tracked in Accounts Payable
                  </div>
                </div>
              )}

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
                  <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, bankAccount: '', fromAccount: '', toAccount: ''})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
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
                    <option value="">Select {formData.currency} account...</option>
                    {sameCurrencyBankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>To *</label>
                  <select value={formData.toAccount} onChange={(e) => setFormData({...formData, toAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select {formData.currency} account...</option>
                    {sameCurrencyBankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Transfers move money within the same currency. To convert USD ↔ MXN, use Exchange instead.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required placeholder="0.00" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Currency *</label>
                  <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, bankAccount: '', fromAccount: '', toAccount: ''})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
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

          {transactionType === 'exchange' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>From Account *</label>
                  <select value={formData.fromAccount} onChange={(e) => setFormData({...formData, fromAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select...</option>
                    {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name} ({a.currency})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>To Account *</label>
                  <select value={formData.toAccount} onChange={(e) => setFormData({...formData, toAccount: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select...</option>
                    {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name} ({a.currency})</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Amount Sent *</label>
                  <input type="number" step="0.01" value={formData.fromAmount} onChange={(e) => {
                    const fromAmt = e.target.value;
                    const rate = formData.exchangeRate;
                    const fromAcct = accounts.find(a => a.account_id === parseInt(formData.fromAccount));
                    const toAcct = accounts.find(a => a.account_id === parseInt(formData.toAccount));
                    let toAmt = formData.toAmount;
                    if (fromAmt && rate) {
                      if (fromAcct?.currency === 'MXN' && toAcct?.currency === 'USD') {
                        toAmt = (parseFloat(fromAmt) / parseFloat(rate)).toFixed(2);
                      } else if (fromAcct?.currency === 'USD' && toAcct?.currency === 'MXN') {
                        toAmt = (parseFloat(fromAmt) * parseFloat(rate)).toFixed(2);
                      }
                    }
                    setFormData({...formData, fromAmount: fromAmt, toAmount: toAmt});
                  }} required placeholder="0.00" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                  {formData.fromAccount && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {accounts.find(a => a.account_id === parseInt(formData.fromAccount))?.currency || ''}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Amount Received *</label>
                  <input type="number" step="0.01" value={formData.toAmount} onChange={(e) => setFormData({...formData, toAmount: e.target.value})} required placeholder="0.00" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                  {formData.toAccount && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {accounts.find(a => a.account_id === parseInt(formData.toAccount))?.currency || ''}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Exchange Rate (USD/MXN) *</label>
                <input type="number" step="0.0001" value={formData.exchangeRate} onChange={(e) => {
                  const rate = e.target.value;
                  const fromAmt = formData.fromAmount;
                  const fromAcct = accounts.find(a => a.account_id === parseInt(formData.fromAccount));
                  const toAcct = accounts.find(a => a.account_id === parseInt(formData.toAccount));
                  let toAmt = formData.toAmount;
                  if (fromAmt && rate) {
                    if (fromAcct?.currency === 'MXN' && toAcct?.currency === 'USD') {
                      toAmt = (parseFloat(fromAmt) / parseFloat(rate)).toFixed(2);
                    } else if (fromAcct?.currency === 'USD' && toAcct?.currency === 'MXN') {
                      toAmt = (parseFloat(fromAmt) * parseFloat(rate)).toFixed(2);
                    }
                  }
                  setFormData({...formData, exchangeRate: rate, toAmount: toAmt});
                }} required placeholder="17.50" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  e.g. 1 USD = 17.50 MXN
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Description (Optional)</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Currency exchange details" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" onClick={handleClose} disabled={loading} style={{ ...buttonStyle('outline', 'md'), opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>Cancel</button>
            <button type="submit" disabled={loading} style={buttonStyle('blue', 'md', loading)}>{loading ? 'Recording...' : '✅ Record Transaction'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

window.TransactionEntryModal = TransactionEntryModal;
