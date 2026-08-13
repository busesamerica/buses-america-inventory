// CostManagementModal.jsx - Flexible Cost Tracking System
// Uses cost_items table for unlimited cost entries

const CostManagementModal = ({ bus, onClose, onSave, currentExchangeRate }) => {
  const [activeTab, setActiveTab] = React.useState('add-cost');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [costs, setCosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [bankAccounts, setBankAccounts] = React.useState([]);
  
  // Form for adding new cost
  const [newCost, setNewCost] = React.useState({
    cost_category: 'Transport to Stock',
    description: '',
    amount: '',
    currency: 'USD',
    vendor: '',
    invoice_number: '',
    date_incurred: new Date().toISOString().split('T')[0],
    payment_account_id: ''
  });

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  // Load existing costs
  React.useEffect(() => {
    loadCosts();
    loadBankAccounts();
  }, []);

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

  const handleAddCost = async (e) => {
    e.preventDefault();
    if (!newCost.description || !newCost.amount) {
      setError('Description and amount are required');
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
        throw new Error('Failed to add cost');
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
        payment_account_id: ''
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
    if (!window.confirm('Delete this cost entry?')) return;
    
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
      alert('Cost deleted successfully');
    } catch (err) {
      alert('Error: ' + err.message);
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
    const exchangeRate = currentExchangeRate || 17.50;
    grandTotal = (totalUSD * exchangeRate) + mxnCosts;
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

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <button
            onClick={() => setActiveTab('add-cost')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'add-cost' ? 'white' : 'transparent',
              borderBottom: activeTab === 'add-cost' ? '2px solid #10b981' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'add-cost' ? '700' : '500',
              color: activeTab === 'add-cost' ? '#10b981' : '#6b7280',
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
          {activeTab === 'add-cost' && (
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Currency *
                  </label>
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
                  Paid From *
                </label>
                <select
                  value={newCost.payment_account_id}
                  onChange={(e) => setNewCost({ ...newCost, payment_account_id: e.target.value })}
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
                      {account.account_name}
                    </option>
                  ))}
                </select>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#6b7280', 
                  marginTop: '0.25rem' 
                }}>
                  Which bank/cash account did you pay this from?
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Vendor (Optional)
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
                style={{
                  padding: '1rem',
                  background: saving ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}
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
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem 1.5rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
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
                              style={{
                                padding: '0.5rem',
                                background: '#fee2e2',
                                color: '#dc2626',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                fontSize: '0.875rem'
                              }}
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
                      <span style={{ fontWeight: '700', color: '#92400e' }}>1 USD = {currentExchangeRate || 17.50} MXN</span>
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
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.875rem'
            }}
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
