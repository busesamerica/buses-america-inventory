// TransactionEntryModal.jsx - Simplified transaction entry for Buses America
// Handles: Deposits, Expenses, Transfers

const TransactionEntryModal = ({ isOpen, onClose, onComplete }) => {
  const isMobile = useIsMobile();
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
    vendor: '',
    depositedBy: ''
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
      vendor: '',
      depositedBy: ''
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
        if (!formData.depositedBy) {
          setError('Please select who made the deposit');
          return;
        }
        // Match on the specific partner, not just "Capital Contributions" -
        // a bare substring match grabbed whichever of Erick's/Omar's capital
        // accounts happened to come first, crediting every deposit to the
        // same partner regardless of who actually put the money in.
        const capitalAccount = accounts.find(a => a.account_name.includes('Capital Contributions') && a.account_name.includes(formData.depositedBy));
        if (!capitalAccount) {
          setError(`No Capital Contributions account found for ${formData.depositedBy}`);
          return;
        }
        desc = `Deposit - ${formData.description}`;
        lines = [
          { account_id: parseInt(formData.bankAccount), debit_amount: parseFloat(formData.amount), credit_amount: 0, currency: formData.currency },
          { account_id: capitalAccount.account_id, debit_amount: 0, credit_amount: parseFloat(formData.amount), currency: formData.currency, notes: `Capital contribution — ${formData.depositedBy}` }
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

      if (!response.ok) {
        // The backend's 400s (currency mismatch, period locked, debits !=
        // credits) carry a specific, actionable `detail` - swallowing it
        // into one generic message was hiding exactly why the request
        // failed, forcing a trip to the server logs to find out.
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to record transaction');
      }

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
  // Deposit/Expense(paid)/Transfer all send a single formData.currency for
  // the Bank/Cash line, which the backend still validates against that
  // account's own currency (see get_cash_position). Rather than have the
  // user pick a currency first and then filter accounts down to it (easy to
  // forget to switch, leading to a USD amount posted against an MXN account
  // or vice versa), the account picked drives the currency - see
  // handleBankAccountChange. Expense category accounts aren't
  // currency-checked by the backend (every report buckets them by the
  // line's own currency, not the account's currency tag), so the Expense
  // Category dropdown intentionally lists every Expense account regardless
  // of currency. Only Exchange is meant to cross currencies for bank
  // accounts, so it keeps the full list and reads currency off both ends.
  // Transfer's "To" account is still filtered - transfers move money within
  // one currency, and "From" has already fixed what that currency is.
  const sameCurrencyBankAccounts = bankAccounts.filter(a => a.currency === formData.currency);

  // Selecting a bank/cash account sets the transaction's currency to match
  // it, instead of the other way around - this is the one thing driving
  // formData.currency for Deposit/Expense(paid)/Transfer's "From" account,
  // so the two can never disagree.
  const handleBankAccountChange = (accountId, field = 'bankAccount') => {
    const selected = bankAccounts.find(a => a.account_id === parseInt(accountId));
    setFormData({
      ...formData,
      [field]: accountId,
      currency: selected ? selected.currency : formData.currency,
      // A new "From" account may have changed the currency out from under
      // a previously-picked "To" account - drop it rather than leave a
      // now-wrong-currency account selected.
      ...(field === 'fromAccount' ? { toAccount: '' } : {})
    });
  };

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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.5rem' }}>
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

              {transactionType === 'deposit' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Deposited By *</label>
                  <select value={formData.depositedBy} onChange={(e) => setFormData({...formData, depositedBy: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select who made the deposit...</option>
                    <option value="Erick">Erick</option>
                    <option value="Omar">Omar</option>
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Credits that partner's Capital Contributions account
                  </div>
                </div>
              )}

              {(transactionType === 'deposit' || (transactionType === 'expense' && formData.paymentStatus === 'paid')) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>{transactionType === 'deposit' ? 'Deposit To' : 'Paid From'} *</label>
                  <select value={formData.bankAccount} onChange={(e) => handleBankAccountChange(e.target.value)} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select account...</option>
                    {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name} ({a.currency})</option>)}
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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required placeholder="0.00" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Currency *</label>
                  {transactionType === 'expense' && formData.paymentStatus === 'on_credit' ? (
                    // No bank account in this branch (money's going to AP,
                    // not out of an account yet), so there's nothing to
                    // derive currency from - keep it a manual choice.
                    <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                      <option value="USD">USD</option>
                      <option value="MXN">MXN</option>
                    </select>
                  ) : (
                    // Set by the account selected above - can't drift from it.
                    <div style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: formData.bankAccount ? '1rem' : '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: '#f9fafb', color: formData.bankAccount ? '#111827' : '#9ca3af' }}>
                      {formData.bankAccount ? formData.currency : 'Select an account first'}
                    </div>
                  )}
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>From *</label>
                  <select value={formData.fromAccount} onChange={(e) => handleBankAccountChange(e.target.value, 'fromAccount')} required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">Select account...</option>
                    {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name} ({a.currency})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>To *</label>
                  <select value={formData.toAccount} onChange={(e) => setFormData({...formData, toAccount: e.target.value})} required disabled={!formData.fromAccount} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    <option value="">{formData.fromAccount ? `Select ${formData.currency} account...` : 'Select a From account first'}</option>
                    {sameCurrencyBankAccounts.filter(a => a.account_id !== parseInt(formData.fromAccount)).map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Transfers move money within the same currency. To convert USD ↔ MXN, use Exchange instead.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required placeholder="0.00" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Currency *</label>
                  {/* Set by the "From" account selected above - can't drift from it. */}
                  <div style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem', background: '#f9fafb', color: formData.fromAccount ? '#111827' : '#9ca3af' }}>
                    {formData.fromAccount ? formData.currency : 'Select a From account first'}
                  </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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
