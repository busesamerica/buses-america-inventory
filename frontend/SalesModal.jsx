// SalesModal.jsx v3 - Complete Payment Tracking System
// With proper total cost calculation from cost_items

const SalesModal = ({ bus, onClose, onSave, currentExchangeRate }) => {
  const [activeTab, setActiveTab] = React.useState('client-info');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [payments, setPayments] = React.useState([]);
  const [costs, setCosts] = React.useState([]);
  const [loadingPayments, setLoadingPayments] = React.useState(true);
  const [loadingCosts, setLoadingCosts] = React.useState(true);
  const [showAddPayment, setShowAddPayment] = React.useState(false);

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  // Client & Sale form data
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
    sale_currency: bus.sale_currency || 'USD'
  });

  // New payment form data
  const [newPayment, setNewPayment] = React.useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Wire Transfer',
    payment_type: 'Deposit',
    reference_number: '',
    payment_notes: ''
  });

  // Load payments and costs
  React.useEffect(() => {
    if (bus.is_sold) {
      loadPayments();
    } else {
      setLoadingPayments(false);
    }
    loadCosts();
  }, []);

  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadCosts = async () => {
    setLoadingCosts(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/costs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCosts(data);
      }
    } catch (err) {
      console.error('Error loading costs:', err);
    } finally {
      setLoadingCosts(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!newPayment.payment_amount) {
      setError('Payment amount is required');
      return;
    }

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newPayment,
          payment_amount: parseFloat(newPayment.payment_amount).toFixed(2),
          payment_currency: formData.sale_currency
        })
      });

      if (!response.ok) throw new Error('Failed to add payment');

      // Reset form
      setNewPayment({
        payment_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Wire Transfer',
        payment_type: 'Partial Payment',
        reference_number: '',
        payment_notes: ''
      });

      await loadPayments();
      setShowAddPayment(false);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to add payment');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Delete this payment?')) return;

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete payment');

      await loadPayments();
      alert('Payment deleted successfully');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBlurAmount = (e) => {
    if (e.target.value) {
      const formatted = parseFloat(e.target.value).toFixed(2);
      setFormData({ ...formData, sale_price: formatted });
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

  // Calculate total costs INCLUDING cost_items
  const purchasePrice = parseFloat(bus.purchase_price_usd) || 0;
  const usdCosts = costs
    .filter(c => c.currency === 'USD')
    .reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const mxnCosts = costs
    .filter(c => c.currency === 'MXN')
    .reduce((sum, c) => sum + parseFloat(c.amount), 0);

  const totalCostUSD = purchasePrice + usdCosts;
  const exchangeRate = currentExchangeRate || 17.50;
  
  // Calculate total cost in sale currency
  let costForProfit = totalCostUSD;
  if (formData.sale_currency === 'MXN') {
    costForProfit = (totalCostUSD * exchangeRate) + mxnCosts;
  }

  // Calculate payments
  const salePrice = parseFloat(formData.sale_price) || 0;
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.payment_amount), 0);
  const balanceDue = salePrice - totalPaid;
  const profit = salePrice - costForProfit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.client_name) {
      setError('Client name is required');
      setActiveTab('client-info');
      return;
    }
    
    if (!formData.sale_price) {
      setError('Sale price is required');
      setActiveTab('sale-payment');
      return;
    }
    
    setError('');
    setSaving(true);
    
    try {
      const salePriceValue = parseFloat(formData.sale_price);
      
      // Determine sale price in USD and MXN
      let salePriceUSD = null;
      let salePriceMXN = null;

      if (formData.sale_currency === 'USD') {
        salePriceUSD = salePriceValue;
        salePriceMXN = salePriceValue * exchangeRate;
      } else if (formData.sale_currency === 'MXN') {
        salePriceMXN = salePriceValue;
        salePriceUSD = salePriceValue / exchangeRate;
      }

      await onSave({
        ...formData,
        sale_price: salePriceValue,
        balance_due: balanceDue,
        sale_price_usd: salePriceUSD,
        sale_price_mxn: salePriceMXN,
        is_sold: true,
        payment_status: balanceDue <= 0 ? 'Paid in Full' : (totalPaid > 0 ? 'Partial Payment' : 'Pending Deposit')
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
        maxWidth: '900px',
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
              💵 {bus.is_sold ? 'Manage Sale' : 'Record Sale'}
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
            👤 Client
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
            💰 Sale & Payments
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
            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
              {/* Sale Information */}
              <div style={{
                padding: '1.5rem',
                background: '#f9fafb',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700' }}>
                  Sale Information
                </h3>

                <div style={{ display: 'grid', gap: '1rem' }}>
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
                        onBlur={handleBlurAmount}
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

                  {formData.sale_currency === 'MXN' && (
                    <div style={{
                      padding: '0.75rem',
                      background: '#fef3c7',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      color: '#92400e'
                    }}>
                      <strong>Exchange Rate:</strong> 1 USD = {exchangeRate} MXN
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Tracking */}
              <div style={{
                padding: '1.5rem',
                background: 'white',
                borderRadius: '0.75rem',
                border: '2px solid #10b981'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#047857' }}>
                    💳 Payment Tracking
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddPayment(!showAddPayment)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.875rem'
                    }}
                  >
                    {showAddPayment ? '✕ Cancel' : '➕ Add Payment'}
                  </button>
                </div>

                {/* Add Payment Form */}
                {showAddPayment && (
                  <div style={{
                    padding: '1rem',
                    background: '#f0fdf4',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                    border: '1px solid #86efac'
                  }}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                            Amount *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newPayment.payment_amount}
                            onChange={(e) => setNewPayment({ ...newPayment, payment_amount: e.target.value })}
                            onBlur={(e) => {
                              if (e.target.value) {
                                const formatted = parseFloat(e.target.value).toFixed(2);
                                setNewPayment({ ...newPayment, payment_amount: formatted });
                              }
                            }}
                            placeholder="0.00"
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
                            Currency *
                          </label>
                          <select
                            value={newPayment.payment_currency}
                            onChange={(e) => setNewPayment({ ...newPayment, payment_currency: e.target.value })}
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
                          {newPayment.payment_currency !== formData.sale_currency && (
                            <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>
                              💱 Will convert to {formData.sale_currency}
                            </div>
                          )}
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                            Date *
                          </label>
                          <input
                            type="date"
                            value={newPayment.payment_date}
                            onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
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

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                            Payment Type
                          </label>
                          <select
                            value={newPayment.payment_type}
                            onChange={(e) => setNewPayment({ ...newPayment, payment_type: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.5rem',
                              fontSize: '1rem'
                            }}
                          >
                            <option value="Deposit">Deposit</option>
                            <option value="Partial Payment">Partial Payment</option>
                            <option value="Final Payment">Final Payment</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                            Payment Method
                          </label>
                          <select
                            value={newPayment.payment_method}
                            onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.5rem',
                              fontSize: '1rem'
                            }}
                          >
                            <option value="Wire Transfer">Wire Transfer</option>
                            <option value="Cash">Cash</option>
                            <option value="Check">Check</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                          Reference # (Optional)
                        </label>
                        <input
                          type="text"
                          value={newPayment.reference_number}
                          onChange={(e) => setNewPayment({ ...newPayment, reference_number: e.target.value })}
                          placeholder="Check #, Wire confirmation, etc."
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
                          Notes (Optional)
                        </label>
                        <textarea
                          value={newPayment.payment_notes}
                          onChange={(e) => setNewPayment({ ...newPayment, payment_notes: e.target.value })}
                          placeholder="Payment details..."
                          rows="2"
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

                      <button
                        type="button"
                        onClick={handleAddPayment}
                        style={{
                          padding: '0.75rem',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '1rem'
                        }}
                      >
                        ✅ Add Payment
                      </button>
                    </div>
                  </div>
                )}

                {/* Payment List */}
                {loadingPayments ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    Loading payments...
                  </div>
                ) : payments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#f9fafb', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💳</div>
                    <div>No payments recorded yet</div>
                    <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Click "Add Payment" to record a payment</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {payments.map((payment) => (
                      <div key={payment.payment_id} style={{
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: '700', fontSize: '1.125rem', color: '#10b981' }}>
                              {formatCurrency(payment.payment_amount, payment.payment_currency)}
                            </span>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              background: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}>
                              {payment.payment_type}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {formatDate(payment.payment_date)} • {payment.payment_method}
                            {payment.reference_number && <span> • Ref: {payment.reference_number}</span>}
                          </div>
                          {payment.payment_notes && (
                            <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem', fontStyle: 'italic' }}>
                              {payment.payment_notes}
                            </div>
                          )}
                          {/* Show conversion if different currency */}
                          {payment.payment_currency !== formData.sale_currency && payment.converted_amount && (
                            <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.5rem', fontWeight: '600', background: '#d1fae5', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                              💱 {formatCurrency(payment.payment_amount, payment.payment_currency)} → {formatCurrency(payment.converted_amount, formData.sale_currency)} 
                              {payment.conversion_rate && <span style={{ opacity: 0.8 }}> (@ {payment.conversion_rate.toFixed(2)})</span>}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                          {payment.payment_currency !== formData.sale_currency && payment.converted_amount && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>
                              = {formatCurrency(payment.converted_amount, formData.sale_currency)}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(payment.payment_id)}
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
                )}

                {/* Balance Summary */}
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderRadius: '0.5rem',
                  border: '2px solid #10b981'
                }}>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sale Price:</span>
                      <span style={{ fontWeight: '600' }}>{formatCurrency(salePrice, formData.sale_currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Paid ({payments.length} payment{payments.length !== 1 ? 's' : ''}):</span>
                      <span style={{ fontWeight: '700', color: '#10b981' }}>{formatCurrency(totalPaid, formData.sale_currency)}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '0.75rem',
                      borderTop: '2px solid #10b981',
                      fontSize: '1.125rem'
                    }}>
                      <span style={{ fontWeight: '700' }}>Balance Due:</span>
                      <span style={{ fontWeight: '900', color: balanceDue > 0 ? '#dc2626' : '#10b981' }}>
                        {formatCurrency(balanceDue, formData.sale_currency)}
                      </span>
                    </div>
                  </div>
                </div>
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

              {/* Sale & Payment Summary */}
              <div style={{
                padding: '1.5rem',
                background: 'white',
                borderRadius: '0.75rem',
                border: '2px solid #10b981'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#047857' }}>
                  💰 Sale & Payment Summary
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

                  {payments.length > 0 && (
                    <>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginTop: '0.5rem' }}>
                        Payments Received:
                      </div>
                      {[...payments].reverse().map((payment) => (
                        <div key={payment.payment_id}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingBottom: '0.5rem',
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '0.875rem'
                          }}>
                            <span>{formatDate(payment.payment_date)} - {payment.payment_type}</span>
                            <span style={{ fontWeight: '600', color: '#10b981' }}>
                              {formatCurrency(payment.payment_amount, payment.payment_currency)}
                            </span>
                          </div>
                          {payment.payment_currency !== formData.sale_currency && payment.converted_amount && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#059669', 
                              paddingLeft: '0.5rem',
                              marginTop: '0.25rem',
                              marginBottom: '0.5rem'
                            }}>
                              💱 Converts to {formatCurrency(payment.converted_amount, formData.sale_currency)}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    marginTop: '0.5rem'
                  }}>
                    <span style={{ fontWeight: '600' }}>Total Paid:</span>
                    <span style={{ fontWeight: '700', color: '#10b981', fontSize: '1.125rem' }}>
                      {formatCurrency(totalPaid, formData.sale_currency)}
                    </span>
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
                      background: balanceDue <= 0 ? '#d1fae5' : (totalPaid > 0 ? '#fef3c7' : '#fee2e2'),
                      color: balanceDue <= 0 ? '#065f46' : (totalPaid > 0 ? '#92400e' : '#991b1b')
                    }}>
                      {balanceDue <= 0 ? 'Paid in Full' : (totalPaid > 0 ? 'Partial Payment' : 'Pending Deposit')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profit Analysis */}
              {salePrice > 0 && costForProfit > 0 && (
                <div style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderRadius: '0.75rem',
                  border: '2px solid #86efac'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#166534' }}>
                    📈 Profit Analysis
                  </h3>
                  {formData.sale_currency === 'MXN' && (usdCosts > 0 || purchasePrice > 0) && (
                    <div style={{
                      padding: '0.5rem 0.75rem',
                      background: '#fef3c7',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      color: '#92400e',
                      marginBottom: '1rem',
                      fontWeight: '600'
                    }}>
                      💱 Exchange Rate: 1 USD = {exchangeRate} MXN
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Purchase Price (USD):</span>
                      <span>{formatCurrency(purchasePrice, 'USD')}</span>
                    </div>
                    {usdCosts > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Additional Costs (USD):</span>
                        <span>{formatCurrency(usdCosts, 'USD')}</span>
                      </div>
                    )}
                    {mxnCosts > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Additional Costs (MXN):</span>
                        <span>{formatCurrency(mxnCosts, 'MXN')}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #86efac' }}>
                      <span style={{ fontWeight: '600' }}>Total Costs ({formData.sale_currency}):</span>
                      <span style={{ fontWeight: '700' }}>{formatCurrency(costForProfit, formData.sale_currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <span>Sale Price:</span>
                      <span style={{ fontWeight: '600' }}>{formatCurrency(salePrice, formData.sale_currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '2px solid #10b981', fontSize: '1.125rem' }}>
                      <span style={{ fontWeight: '700' }}>Net Profit:</span>
                      <span style={{ fontWeight: '900', color: profit >= 0 ? '#10b981' : '#dc2626' }}>
                        {formatCurrency(Math.abs(profit), formData.sale_currency)} {profit < 0 ? '(Loss)' : ''}
                      </span>
                    </div>
                    {profit > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#166534' }}>
                        <span>Profit Margin:</span>
                        <span style={{ fontWeight: '600' }}>{((profit / salePrice) * 100).toFixed(1)}%</span>
                      </div>
                    )}
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
            {saving ? '💾 Saving...' : '✅ Save Sale'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Export for standalone use
window.SalesModal = SalesModal;
