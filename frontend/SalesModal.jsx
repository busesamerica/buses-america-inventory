// SalesModal.jsx - Record Sales with Client & Payment Information
// Tracks sales, deposits, payments, and client details

const SalesModal = ({ bus, onClose, onSave, currentExchangeRate }) => {
  const [activeTab, setActiveTab] = React.useState('client-info');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Initialize form data
  const [formData, setFormData] = React.useState({
    // Client Information
    client_name: bus.client_name || '',
    client_company: bus.client_company || '',
    client_location: bus.client_location || '',
    client_contact: bus.client_contact || '',
    client_email: bus.client_email || '',
    client_use_case: bus.client_use_case || '',
    
    // Sale Information
    sale_date: bus.sale_date || new Date().toISOString().split('T')[0],
    sale_price: bus.sale_price || '',
    sale_currency: bus.sale_currency || 'USD',
    deposit_amount: bus.deposit_amount || '',
    deposit_date: bus.deposit_date || new Date().toISOString().split('T')[0],
    payment_status: bus.payment_status || 'Deposit Paid'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBlurAmount = (fieldName) => (e) => {
    if (e.target.value) {
      const formatted = parseFloat(e.target.value).toFixed(2);
      setFormData({ ...formData, [fieldName]: formatted });
    }
  };

  // Calculate balance due
  const salePrice = parseFloat(formData.sale_price) || 0;
  const depositAmount = parseFloat(formData.deposit_amount) || 0;
  const balanceDue = salePrice - depositAmount;

  // Calculate profit if costs are available
  const purchasePrice = parseFloat(bus.purchase_price_usd) || 0;
  const totalCosts = purchasePrice; // Could be enhanced with total costs from cost_items
  const profit = salePrice - totalCosts;

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount && amount !== 0) return currency === 'USD' ? '$0.00' : 'MXN $0.00';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return currency === 'USD' ? `$${formatted}` : `MXN $${formatted}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.client_name) {
      setError('Client name is required');
      setActiveTab('client-info');
      return;
    }
    
    if (!formData.sale_price || !formData.deposit_amount) {
      setError('Sale price and deposit amount are required');
      setActiveTab('sale-payment');
      return;
    }

    if (depositAmount > salePrice) {
      setError('Deposit cannot be greater than sale price');
      setActiveTab('sale-payment');
      return;
    }
    
    setError('');
    setSaving(true);
    
    try {
      // Parse amounts
      const salePriceValue = parseFloat(formData.sale_price);
      const depositAmountValue = parseFloat(formData.deposit_amount);
      const balanceDueValue = salePriceValue - depositAmountValue;

      // Determine sale price in USD and MXN based on currency
      let salePriceUSD = null;
      let salePriceMXN = null;
      const exchangeRate = currentExchangeRate || 17.50;

      if (formData.sale_currency === 'USD') {
        salePriceUSD = salePriceValue;
        salePriceMXN = salePriceValue * exchangeRate;
      } else if (formData.sale_currency === 'MXN') {
        salePriceMXN = salePriceValue;
        salePriceUSD = salePriceValue / exchangeRate;
      } else if (formData.sale_currency === 'Mixed') {
        // For mixed, we'll store the value as-is and let user specify later
        salePriceUSD = salePriceValue;
        salePriceMXN = salePriceValue;
      }

      await onSave({
        ...formData,
        sale_price: salePriceValue,
        deposit_amount: depositAmountValue,
        balance_due: balanceDueValue,
        sale_price_usd: salePriceUSD,
        sale_price_mxn: salePriceMXN,
        is_sold: true,
        deposit_currency: formData.sale_currency,
        balance_currency: formData.sale_currency
      });
    } catch (err) {
      setError(err.message || 'Failed to record sale');
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
        maxWidth: '800px',
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
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
              💵 Record Sale
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
            onClick={() => setActiveTab('client-info')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'client-info' ? 'white' : 'transparent',
              borderBottom: activeTab === 'client-info' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'client-info' ? '700' : '500',
              color: activeTab === 'client-info' ? '#3b82f6' : '#6b7280',
              fontSize: '0.875rem'
            }}
          >
            👤 Client Info
          </button>
          <button
            onClick={() => setActiveTab('sale-payment')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'sale-payment' ? 'white' : 'transparent',
              borderBottom: activeTab === 'sale-payment' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'sale-payment' ? '700' : '500',
              color: activeTab === 'sale-payment' ? '#3b82f6' : '#6b7280',
              fontSize: '0.875rem'
            }}
          >
            💰 Sale & Payment
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'summary' ? 'white' : 'transparent',
              borderBottom: activeTab === 'summary' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'summary' ? '700' : '500',
              color: activeTab === 'summary' ? '#3b82f6' : '#6b7280',
              fontSize: '0.875rem'
            }}
          >
            📊 Summary
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
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

          {/* Client Info Tab */}
          {activeTab === 'client-info' && (
            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Client Name *
                </label>
                <input
                  type="text"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  placeholder="Juan Pérez"
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
                  Company Name
                </label>
                <input
                  type="text"
                  name="client_company"
                  value={formData.client_company}
                  onChange={handleChange}
                  placeholder="Transportes ABC S.A. de C.V."
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
                  Location (City/State, Mexico)
                </label>
                <input
                  type="text"
                  name="client_location"
                  value={formData.client_location}
                  onChange={handleChange}
                  placeholder="Monterrey, Nuevo León"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="client_contact"
                    value={formData.client_contact}
                    onChange={handleChange}
                    placeholder="+52 81 1234 5678"
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
                    Email
                  </label>
                  <input
                    type="email"
                    name="client_email"
                    value={formData.client_email}
                    onChange={handleChange}
                    placeholder="cliente@ejemplo.com"
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
                  Use Case (What will they use the bus for?)
                </label>
                <textarea
                  name="client_use_case"
                  value={formData.client_use_case}
                  onChange={handleChange}
                  placeholder="School transportation, Employee shuttle, Tourism, etc."
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          )}

          {/* Sale & Payment Tab */}
          {activeTab === 'sale-payment' && (
            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Sale Date *
                </label>
                <input
                  type="date"
                  name="sale_date"
                  value={formData.sale_date}
                  onChange={handleChange}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Currency *
                  </label>
                  <select
                    name="sale_currency"
                    value={formData.sale_currency}
                    onChange={handleChange}
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
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Sale Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="sale_price"
                    value={formData.sale_price}
                    onChange={handleNumberChange}
                    onBlur={handleBlurAmount('sale_price')}
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

              {formData.sale_currency !== 'USD' && (
                <div style={{
                  padding: '0.75rem',
                  background: '#fef3c7',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#92400e'
                }}>
                  <strong>Exchange Rate:</strong> 1 USD = {currentExchangeRate || 17.50} MXN
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Deposit Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="deposit_amount"
                  value={formData.deposit_amount}
                  onChange={handleNumberChange}
                  onBlur={handleBlurAmount('deposit_amount')}
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

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Deposit Date *
                </label>
                <input
                  type="date"
                  name="deposit_date"
                  value={formData.deposit_date}
                  onChange={handleChange}
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

              <div style={{
                padding: '1rem',
                background: '#f0fdf4',
                borderRadius: '0.5rem',
                border: '1px solid #86efac'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600' }}>Balance Due:</span>
                  <span style={{ fontWeight: '700', fontSize: '1.25rem', color: balanceDue > 0 ? '#dc2626' : '#10b981' }}>
                    {formatCurrency(balanceDue, formData.sale_currency)}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Sale Price - Deposit = Balance
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  Payment Status
                </label>
                <select
                  name="payment_status"
                  value={formData.payment_status}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  <option value="Pending Deposit">Pending Deposit</option>
                  <option value="Deposit Paid">Deposit Paid</option>
                  <option value="Paid in Full">Paid in Full</option>
                </select>
              </div>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
              {/* Client Summary */}
              <div style={{
                padding: '1.5rem',
                background: 'white',
                borderRadius: '0.75rem',
                border: '2px solid #3b82f6'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#1e40af' }}>
                  👤 Client Information
                </h3>
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <div><strong>Name:</strong> {formData.client_name || 'Not provided'}</div>
                  {formData.client_company && <div><strong>Company:</strong> {formData.client_company}</div>}
                  {formData.client_location && <div><strong>Location:</strong> {formData.client_location}</div>}
                  {formData.client_contact && <div><strong>Phone:</strong> {formData.client_contact}</div>}
                  {formData.client_email && <div><strong>Email:</strong> {formData.client_email}</div>}
                </div>
              </div>

              {/* Sale Summary */}
              <div style={{
                padding: '1.5rem',
                background: 'white',
                borderRadius: '0.75rem',
                border: '2px solid #10b981'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#047857' }}>
                  💰 Sale & Payment
                </h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span>Sale Date:</span>
                    <span style={{ fontWeight: '600' }}>{formData.sale_date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span>Sale Price:</span>
                    <span style={{ fontWeight: '700', color: '#047857' }}>{formatCurrency(salePrice, formData.sale_currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span>Deposit:</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(depositAmount, formData.sale_currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', fontSize: '1.125rem' }}>
                    <span style={{ fontWeight: '700' }}>Balance Due:</span>
                    <span style={{ fontWeight: '900', color: balanceDue > 0 ? '#dc2626' : '#10b981' }}>
                      {formatCurrency(balanceDue, formData.sale_currency)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                    <span>Payment Status:</span>
                    <span style={{ 
                      fontWeight: '600',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.375rem',
                      background: formData.payment_status === 'Paid in Full' ? '#d1fae5' : '#fef3c7',
                      color: formData.payment_status === 'Paid in Full' ? '#065f46' : '#92400e'
                    }}>
                      {formData.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profit Preview (if purchase price available) */}
              {purchasePrice > 0 && salePrice > 0 && (
                <div style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderRadius: '0.75rem',
                  border: '2px solid #86efac'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#166534' }}>
                    📈 Estimated Profit
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Purchase Price:</span>
                      <span>{formatCurrency(purchasePrice, 'USD')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sale Price:</span>
                      <span>{formatCurrency(salePrice, formData.sale_currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '2px solid #10b981', fontSize: '1.125rem' }}>
                      <span style={{ fontWeight: '700' }}>Gross Profit:</span>
                      <span style={{ fontWeight: '900', color: profit >= 0 ? '#10b981' : '#dc2626' }}>
                        {formatCurrency(Math.abs(profit), formData.sale_currency)} {profit < 0 ? '(Loss)' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', fontStyle: 'italic' }}>
                    * Does not include additional costs. View cost breakdown for detailed profitability.
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f9fafb'
        }}>
          <button
            type="button"
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              background: saving ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '700',
              fontSize: '0.875rem'
            }}
          >
            {saving ? '💾 Recording Sale...' : '✅ Record Sale'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Export for standalone use
window.SalesModal = SalesModal;
