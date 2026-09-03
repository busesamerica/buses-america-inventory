// CostManagementModal.jsx - Flexible Cost Tracking System
// Uses cost_items table for unlimited cost entries

const CostManagementModal = ({ bus, onClose, onSave, currentExchangeRate }) => {
  // Once a unit is Delivered, backend rejects new/changed cost entries
  // (see check_unit_not_delivered in backend_api_FINAL.py) - mirror that
  // here so the form doesn't even let you try, with a clear reason
  // instead of a network error. Starts straight on the list/history tab
  // for a delivered unit, since Add Cost isn't usable.
  const isDelivered = bus.status === 'Delivered';
  const [activeTab, setActiveTab] = React.useState(isDelivered ? 'cost-list' : 'add-cost');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [costs, setCosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [bankAccounts, setBankAccounts] = React.useState([]);
  const [exchangeRate, setExchangeRate] = React.useState(currentExchangeRate || 17.50);
  
  // Form for adding new cost
  const [newCost, setNewCost] = React.useState({
    cost_category: 'Transport to Stock',
    description: '',
    amount: '',
    currency: 'USD',
    vendor: '',
    invoice_number: '',
    date_incurred: new Date().toISOString().split('T')[0],
    payment_account_id: '',
    payment_status: 'paid'
  });

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  // Load existing costs
  React.useEffect(() => {
    loadCosts();
    loadBankAccounts();
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/exchange-rates/current`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.rate) {
          setExchangeRate(parseFloat(data.rate));
        }
      }
    } catch (error) {
      console.error('Error loading exchange rate:', error);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Filter to bank and cash accounts only
        const filtered = data.filter(a => 
          a.account_type === 'Asset' && 
          (a.account_subtype === 'Bank' || a.account_subtype === 'Cash')
        );
        setBankAccounts(filtered);
      }
    } catch (err) {
      console.error('Error loading bank accounts:', err);
    }
  };

  const loadCosts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/costs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCosts(data);
      }
    } catch (err) {
      console.error('Error loading costs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Selecting a "Paid From" account sets the cost's currency to match it,
  // instead of the other way around - picking currency first and then
  // filtering accounts down to it is easy to forget to switch, and can end
  // up recording a USD cost against an MXN account (or vice versa).
  const handlePaymentAccountChange = (accountId) => {
    const selected = bankAccounts.find(a => a.account_id === parseInt(accountId));
    setNewCost({
      ...newCost,
      payment_account_id: accountId,
      currency: selected ? selected.currency : newCost.currency
    });
  };

  const handleAddCost = async (e) => {
    e.preventDefault();
    if (isDelivered) {
      // Defense-in-depth - the Add Cost tab is hidden for delivered
      // units, but guard the submit itself too in case bus.status went
      // stale (e.g. delivered by someone else after this modal loaded).
      setError('This unit has already been delivered — new costs can\'t be added to it.');
      return;
    }
    if (!newCost.description || !newCost.amount) {
      setError('Description and amount are required');
      return;
    }
    if (!newCost.vendor || !newCost.vendor.trim()) {
      setError('Vendor is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      // Parse amount and ensure 2 decimal places
      const amountValue = parseFloat(newCost.amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setError('Please enter a valid amount');
        setSaving(false);
        return;
      }
      const formattedAmount = Math.round(amountValue * 100) / 100;
      
      // Verify amount matches what user entered
      if (Math.abs(formattedAmount - amountValue) > 0.01) {
        console.warn('Amount mismatch — entered:', newCost.amount, 'parsed:', amountValue, 'formatted:', formattedAmount);
      }
      
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/costs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newCost,
          amount: formattedAmount
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail || 'Failed to add cost');
      }

      // Reset form
      setNewCost({
        cost_category: 'Transport to Stock',
        description: '',
        amount: '',
        currency: 'USD',
        vendor: '',
        invoice_number: '',
        date_incurred: new Date().toISOString().split('T')[0],
        payment_account_id: '',
        payment_status: 'paid'
      });

      // Reload costs
      await loadCosts();
      setActiveTab('cost-list');
      alert('✅ Cost added successfully!');
    } catch (err) {
      setError(err.message || 'Failed to add cost');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCost = async (costId) => {
    if (!window.confirm('Delete this cost entry? This will also reverse its accounting entry.')) return;
    
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/costs/${costId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete cost');
      }

      await loadCosts();
      alert('✅ Cost deleted and accounting entry reversed');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Calculate totals
  const purchasePrice = parseFloat(bus.purchase_price_usd) || 0;
  
  const usdCosts = costs
    .filter(c => c.currency === 'USD')
    .reduce((sum, c) => sum + parseFloat(c.amount), 0);
  
  const mxnCosts = costs
    .filter(c => c.currency === 'MXN')
    .reduce((sum, c) => sum + parseFloat(c.amount), 0);
  
  const totalUSD = purchasePrice + usdCosts;
  
  // Grand total logic: if ANY MXN costs, convert everything to MXN
  const hasMXNCosts = mxnCosts > 0;
  let grandTotal = 0;
  let grandTotalCurrency = 'USD';
  
  if (hasMXNCosts) {
    const grandExchangeRate = exchangeRate || 17.50;
    grandTotal = (totalUSD * grandExchangeRate) + mxnCosts;
    grandTotalCurrency = 'MXN';
  } else {
    grandTotal = totalUSD;
    grandTotalCurrency = 'USD';
  }

  // Group costs by category
  const costsByCategory = costs.reduce((acc, cost) => {
    if (!acc[cost.cost_category]) {
      acc[cost.cost_category] = [];
    }
    acc[cost.cost_category].push(cost);
    return acc;
  }, {});

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
        borderRadius: '12px',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
              💰 Cost Management
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
              {bus.stock_number} - {bus.year} {bus.make} {bus.model}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              fontSize: '1.5rem',
              cursor: 'pointer',
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {isDelivered && (
          <div style={{
            padding: '0.75rem 1.5rem',
            background: '#fef3c7',
            color: '#92400e',
            fontSize: '0.8rem',
            borderBottom: '1px solid #fde68a'
          }}>
            ⚠️ <strong>{bus.stock_number}</strong> has already been delivered
            {bus.client_name ? ` to ${bus.client_name}` : ''}
            {bus.delivery_date ? ` on ${formatDate(bus.delivery_date)}` : ''} — new costs can't
            be added to it. Double-check you meant this unit before doing anything else here.
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <button
            onClick={() => !isDelivered && setActiveTab('add-cost')}
            disabled={isDelivered}
            title={isDelivered ? 'This unit has already been delivered - new costs can\'t be added' : undefined}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'add-cost' ? 'white' : 'transparent',
              borderBottom: activeTab === 'add-cost' ? '2px solid #10b981' : '2px solid transparent',
              cursor: isDelivered ? 'not-allowed' : 'pointer',
              fontWeight: activeTab === 'add-cost' ? '700' : '500',
              color: isDelivered ? '#d1d5db' : (activeTab === 'add-cost' ? '#10b981' : '#6b7280'),
              fontSize: '0.875rem'
            }}
          >
            ➕ Add Cost
          </button>
          <button
            onClick={() => setActiveTab('cost-list')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'cost-list' ? 'white' : 'transparent',
              borderBottom: activeTab === 'cost-list' ? '2px solid #10b981' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'cost-list' ? '700' : '500',
              color: activeTab === 'cost-list' ? '#10b981' : '#6b7280',
              fontSize: '0.875rem'
            }}
          >
            📋 Cost List ({costs.length})
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'summary' ? 'white' : 'transparent',
              borderBottom: activeTab === 'summary' ? '2px solid #10b981' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'summary' ? '700' : '500',
              color: activeTab === 'summary' ? '#10b981' : '#6b7280',
              fontSize: '0.875rem'
            }}
          >
            📊 Summary
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          {/* Add Cost Tab */}
          {activeTab === 'add-cost' && isDelivered && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
              <div>This unit has already been delivered, so new costs can't be added to it.</div>
            </div>
          )}
          {activeTab === 'add-cost' && !isDelivered && (
            <form onSubmit={handleAddCost} style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Category *
                </label>
                <select
                  value={newCost.cost_category}
                  onChange={(e) => setNewCost({ ...newCost, cost_category: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  <option value="Purchase">Purchase</option>
                  <option value="Transport to Stock">Transport to Stock</option>
                  <option value="Initial Reconditioning">Initial Reconditioning</option>
                  <option value="Other Acquisition">Other Acquisition</option>
                  <option value="Import">Import</option>
                  <option value="Customs">Customs</option>
                  <option value="Regulatory">Regulatory</option>
                  <option value="Preventive Maintenance">Preventive Maintenance</option>
                  <option value="Transport to Client">Transport to Client</option>
                  <option value="Repair">Repair</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Description *
                </label>
                <input
                  type="text"
                  value={newCost.description}
                  onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                  placeholder="e.g., Towing from auction to warehouse"
                  required
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
                  Payment Status *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setNewCost({ ...newCost, payment_status: 'paid', payment_account_id: '' })}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      border: newCost.payment_status === 'paid' ? '2px solid #059669' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: newCost.payment_status === 'paid' ? '#d1fae5' : 'white',
                      color: newCost.payment_status === 'paid' ? '#065f46' : '#374151',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    💵 Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCost({ ...newCost, payment_status: 'on_credit', payment_account_id: '' })}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      border: newCost.payment_status === 'on_credit' ? '2px solid #d97706' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: newCost.payment_status === 'on_credit' ? '#fef3c7' : 'white',
                      color: newCost.payment_status === 'on_credit' ? '#92400e' : '#374151',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    📋 On Credit
                  </button>
                </div>

                {newCost.payment_status === 'paid' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                      Paid From *
                    </label>
                    <select
                      value={newCost.payment_account_id}
                      onChange={(e) => handlePaymentAccountChange(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    >
                      <option value="">Select account...</option>
                      {bankAccounts.map(account => (
                        <option key={account.account_id} value={account.account_id}>
                          {account.account_name} ({account.currency})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Sets the cost's currency to match the account you paid from.
                    </div>
                  </div>
                )}

                {newCost.payment_status === 'on_credit' && (
                  <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                    This cost will be recorded as Accounts Payable. You can pay it later from the Accounting module.
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Currency *
                  </label>
                  {newCost.payment_status === 'on_credit' ? (
                    // No bank account in this branch (it's going to AP, not
                    // out of an account), so there's nothing to derive
                    // currency from - keep it a manual choice.
                    <select
                      value={newCost.currency}
                      onChange={(e) => setNewCost({ ...newCost, currency: e.target.value })}
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
                    </select>
                  ) : (
                    // Set by the "Paid From" account selected above - can't drift from it.
                    <div style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: newCost.payment_account_id ? '1rem' : '0.75rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      background: '#f9fafb',
                      color: newCost.payment_account_id ? '#111827' : '#9ca3af'
                    }}>
                      {newCost.payment_account_id ? newCost.currency : 'Select an account first'}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCost.amount}
                    onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })}
                    onBlur={(e) => {
                      // Format to 2 decimals when user leaves the field
                      if (e.target.value) {
                        const formatted = parseFloat(e.target.value).toFixed(2);
                        setNewCost({ ...newCost, amount: formatted });
                      }
                    }}
                    placeholder="0.00"
                    required
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

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={newCost.date_incurred}
                  onChange={(e) => setNewCost({ ...newCost, date_incurred: e.target.value })}
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
                  Vendor *
                </label>
                <input
                  type="text"
                  value={newCost.vendor}
                  onChange={(e) => setNewCost({ ...newCost, vendor: e.target.value })}
                  placeholder="Vendor name"
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
                  Invoice # (Optional)
                </label>
                <input
                  type="text"
                  value={newCost.invoice_number}
                  onChange={(e) => setNewCost({ ...newCost, invoice_number: e.target.value })}
                  placeholder="INV-12345"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{ ...buttonStyle('green', 'md', saving), padding: '1rem' }}
              >
                {saving ? '💾 Adding Cost...' : '✅ Add Cost'}
              </button>
            </form>
          )}

          {/* Cost List Tab */}
          {activeTab === 'cost-list' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  Loading costs...
                </div>
              ) : costs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
                  <div>No additional costs yet</div>
                  <button
                    onClick={() => setActiveTab('add-cost')}
                    style={{ ...buttonStyle('green', 'md'), marginTop: '1rem' }}
                  >
                    ➕ Add First Cost
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {Object.entries(costsByCategory).map(([category, categoryCosts]) => (
                    <div key={category} style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '0.75rem 1rem',
                        background: '#f9fafb',
                        fontWeight: '600',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        {category} ({categoryCosts.length})
                      </div>
                      {categoryCosts.map((cost) => (
                        <div key={cost.cost_id} style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'start'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                              {cost.description}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {cost.vendor && <span>Vendor: {cost.vendor} • </span>}
                              {cost.invoice_number && <span>Invoice: {cost.invoice_number} • </span>}
                              {formatDate(cost.date_incurred)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              fontWeight: '700',
                              fontSize: '1.125rem',
                              color: '#10b981',
                              textAlign: 'right'
                            }}>
                              {formatCurrency(cost.amount, cost.currency)}
                            </div>
                            <button
                              onClick={() => handleDeleteCost(cost.cost_id)}
                              style={{ ...buttonStyle('redSoft', 'md'), padding: '0.5rem' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
              
              {/* USD COSTS SECTION */}
              <div style={{
                padding: '1.5rem',
                background: 'white',
                borderRadius: '0.75rem',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #3b82f6'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>🇺🇸</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1e40af' }}>
                    US Costs (USD)
                  </h3>
                </div>
                
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280' }}>Purchase Price:</span>
                    <span style={{ fontWeight: '700', color: '#1e40af' }}>{formatCurrency(purchasePrice, 'USD')}</span>
                  </div>

                  {costs.filter(c => c.currency === 'USD').length > 0 ? (
                    <>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>
                        Additional USD Costs:
                      </div>
                      {Object.entries(costsByCategory).map(([category, categoryCosts]) => {
                        const categoryUSD = categoryCosts.filter(c => c.currency === 'USD');
                        if (categoryUSD.length === 0) return null;
                        const categoryTotal = categoryUSD.reduce((sum, c) => sum + parseFloat(c.amount), 0);
                        
                        return (
                          <div key={category} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', fontSize: '0.875rem' }}>
                            <span style={{ color: '#6b7280' }}>{category}:</span>
                            <span style={{ fontWeight: '600', color: '#1e40af' }}>{formatCurrency(categoryTotal, 'USD')}</span>
                          </div>
                        );
                      })}
                    </>
                  ) : null}

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    paddingTop: '0.75rem',
                    marginTop: '0.5rem',
                    borderTop: '2px solid #3b82f6',
                    fontSize: '1.125rem'
                  }}>
                    <span style={{ fontWeight: '700', color: '#1e3a8a' }}>Total US Costs:</span>
                    <span style={{ fontWeight: '900', color: '#1e40af' }}>{formatCurrency(totalUSD, 'USD')}</span>
                  </div>

                  {hasMXNCosts && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#fef3c7',
                      borderRadius: '0.5rem',
                      marginTop: '0.75rem',
                      fontSize: '0.875rem'
                    }}>
                      <span style={{ color: '#92400e', fontWeight: '600' }}>Exchange Rate Used:</span>
                      <span style={{ fontWeight: '700', color: '#92400e' }}>1 USD = {exchangeRate || 17.50} MXN</span>
                    </div>
                  )}
                </div>
              </div>

              {/* MXN COSTS SECTION */}
              {hasMXNCosts && (
                <div style={{
                  padding: '1.5rem',
                  background: 'white',
                  borderRadius: '0.75rem',
                  border: '2px solid #10b981'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '2px solid #10b981'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>🇲🇽</span>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#047857' }}>
                      Mexico Costs (MXN)
                    </h3>
                  </div>
                  
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {Object.entries(costsByCategory).map(([category, categoryCosts]) => {
                      const categoryMXN = categoryCosts.filter(c => c.currency === 'MXN');
                      if (categoryMXN.length === 0) return null;
                      const categoryTotal = categoryMXN.reduce((sum, c) => sum + parseFloat(c.amount), 0);
                      
                      return (
                        <div key={category} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', fontSize: '0.875rem' }}>
                          <span style={{ color: '#6b7280' }}>{category}:</span>
                          <span style={{ fontWeight: '600', color: '#047857' }}>{formatCurrency(categoryTotal, 'MXN')}</span>
                        </div>
                      );
                    })}

                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      paddingTop: '0.75rem',
                      marginTop: '0.5rem',
                      borderTop: '2px solid #10b981',
                      fontSize: '1.125rem'
                    }}>
                      <span style={{ fontWeight: '700', color: '#065f46' }}>Total Mexico Costs:</span>
                      <span style={{ fontWeight: '900', color: '#10b981' }}>{formatCurrency(mxnCosts, 'MXN')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* GRAND TOTAL - Clean and Clear */}
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                borderRadius: '0.75rem',
                border: '2px solid #10b981'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#166534' }}>
                    GRAND TOTAL:
                  </span>
                  <span style={{ fontSize: '2rem', fontWeight: '900', color: '#10b981' }}>
                    {formatCurrency(grandTotal, grandTotalCurrency)}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.5rem', textAlign: 'right' }}>
                  {hasMXNCosts ? 'All costs converted to MXN' : 'USD costs only'}
                </div>
              </div>

              {costs.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
                  <div>No additional costs yet. Purchase price only.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f9fafb'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {costs.length} cost {costs.length === 1 ? 'entry' : 'entries'}
          </div>
          <button
            onClick={onClose}
            style={buttonStyle('outline', 'md')}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Export for standalone use
window.CostManagementModal = CostManagementModal;
