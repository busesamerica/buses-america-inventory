// CostManagementModal.jsx - Complete Cost Tracking for Inventory Units
// Handles both USD (US Operations) and MXN (Mexico Operations) costs

const CostManagementModal = ({ bus, onClose, onSave, currentExchangeRate }) => {
  const [activeTab, setActiveTab] = React.useState('us-costs');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Initialize form data with existing values
  const [formData, setFormData] = React.useState({
    // USD Costs (US Operations)
    transport_to_stock_cost_usd: bus.transport_to_stock_cost_usd || 0,
    initial_reconditioning_cost_usd: bus.initial_reconditioning_cost_usd || 0,
    other_acquisition_costs_usd: bus.other_acquisition_costs_usd || 0,
    
    // MXN Costs (Mexico Operations)
    import_cost_mxn: bus.import_cost_mxn || 0,
    customs_cost_mxn: bus.customs_cost_mxn || 0,
    regulatory_cost_mxn: bus.regulatory_cost_mxn || 0,
    other_import_costs_mxn: bus.other_import_costs_mxn || 0,
    transport_to_client_cost_mxn: bus.transport_to_client_cost_mxn || 0,
    
    // Preventive Maintenance (can be USD or MXN)
    preventive_maintenance_cost: bus.preventive_maintenance_cost || 0,
    preventive_maintenance_currency: bus.preventive_maintenance_currency || 'USD',
    
    // Notes
    transport_to_stock_notes: bus.transport_to_stock_notes || '',
    import_notes: bus.import_notes || '',
    preventive_maintenance_notes: bus.preventive_maintenance_notes || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    // Allow empty string or valid numbers
    const numValue = value === '' ? 0 : parseFloat(value) || 0;
    setFormData({ ...formData, [name]: numValue });
  };

  // Calculate totals
  const purchasePrice = parseFloat(bus.purchase_price_usd) || 0;
  
  const usCostsTotal = 
    parseFloat(formData.transport_to_stock_cost_usd) +
    parseFloat(formData.initial_reconditioning_cost_usd) +
    parseFloat(formData.other_acquisition_costs_usd);
  
  const totalCostInUSStock = purchasePrice + usCostsTotal;
  
  const mxCostsTotal = 
    parseFloat(formData.import_cost_mxn) +
    parseFloat(formData.customs_cost_mxn) +
    parseFloat(formData.regulatory_cost_mxn) +
    parseFloat(formData.other_import_costs_mxn) +
    parseFloat(formData.transport_to_client_cost_mxn);
  
  // Add preventive maintenance to appropriate currency
  const prevMaintCost = parseFloat(formData.preventive_maintenance_cost) || 0;
  const prevMaintCurrency = formData.preventive_maintenance_currency;
  
  const hasMXNCosts = mxCostsTotal > 0 || (prevMaintCost > 0 && prevMaintCurrency === 'MXN');
  
  // Calculate grand total
  let grandTotal = 0;
  let grandTotalCurrency = 'USD';
  
  if (hasMXNCosts) {
    // Convert everything to MXN
    const exchangeRate = currentExchangeRate || 17.50;
    const usdToMxn = totalCostInUSStock * exchangeRate;
    const prevMaintMxn = prevMaintCurrency === 'MXN' ? prevMaintCost : prevMaintCost * exchangeRate;
    grandTotal = usdToMxn + mxCostsTotal + prevMaintMxn;
    grandTotalCurrency = 'MXN';
  } else {
    // Only USD costs
    const prevMaintUsd = prevMaintCurrency === 'USD' ? prevMaintCost : 0;
    grandTotal = totalCostInUSStock + prevMaintUsd;
    grandTotalCurrency = 'USD';
  }

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
    setError('');
    setSaving(true);

    try {
      await onSave({
        ...formData,
        // Convert to numbers
        transport_to_stock_cost_usd: parseFloat(formData.transport_to_stock_cost_usd) || 0,
        initial_reconditioning_cost_usd: parseFloat(formData.initial_reconditioning_cost_usd) || 0,
        other_acquisition_costs_usd: parseFloat(formData.other_acquisition_costs_usd) || 0,
        import_cost_mxn: parseFloat(formData.import_cost_mxn) || 0,
        customs_cost_mxn: parseFloat(formData.customs_cost_mxn) || 0,
        regulatory_cost_mxn: parseFloat(formData.regulatory_cost_mxn) || 0,
        other_import_costs_mxn: parseFloat(formData.other_import_costs_mxn) || 0,
        transport_to_client_cost_mxn: parseFloat(formData.transport_to_client_cost_mxn) || 0,
        preventive_maintenance_cost: parseFloat(formData.preventive_maintenance_cost) || 0
      });
    } catch (err) {
      setError(err.message || 'Failed to save costs');
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
            onClick={() => setActiveTab('us-costs')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'us-costs' ? 'white' : 'transparent',
              borderBottom: activeTab === 'us-costs' ? '2px solid #10b981' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'us-costs' ? '700' : '500',
              color: activeTab === 'us-costs' ? '#10b981' : '#6b7280',
              fontSize: '0.875rem'
            }}
          >
            🇺🇸 US Costs (USD)
          </button>
          <button
            onClick={() => setActiveTab('mx-costs')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'mx-costs' ? 'white' : 'transparent',
              borderBottom: activeTab === 'mx-costs' ? '2px solid #10b981' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'mx-costs' ? '700' : '500',
              color: activeTab === 'mx-costs' ? '#10b981' : '#6b7280',
              fontSize: '0.875rem'
            }}
          >
            🇲🇽 Mexico Costs (MXN)
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

          {/* US Costs Tab */}
          {activeTab === 'us-costs' && (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div style={{
                padding: '1rem',
                background: '#f0fdf4',
                borderRadius: '0.5rem',
                border: '1px solid #86efac'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Purchase Price</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                  {formatCurrency(purchasePrice, 'USD')}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Already recorded at purchase
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Transport to US Stock (USD)
                </label>
                <input
                  type="number"
                  name="transport_to_stock_cost_usd"
                  value={formData.transport_to_stock_cost_usd}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
                <textarea
                  name="transport_to_stock_notes"
                  value={formData.transport_to_stock_notes}
                  onChange={handleChange}
                  placeholder="Notes (optional)"
                  rows="2"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Initial Reconditioning (USD)
                </label>
                <input
                  type="number"
                  name="initial_reconditioning_cost_usd"
                  value={formData.initial_reconditioning_cost_usd}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Repairs, cleaning, prep work before sale
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Other Acquisition Costs (USD)
                </label>
                <input
                  type="number"
                  name="other_acquisition_costs_usd"
                  value={formData.other_acquisition_costs_usd}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Title, registration, fees, etc.
                </div>
              </div>

              <div style={{
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '500' }}>Total Cost in US Stock:</span>
                  <span style={{ fontWeight: '700', fontSize: '1.25rem', color: '#10b981' }}>
                    {formatCurrency(totalCostInUSStock, 'USD')}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Purchase + Transport + Reconditioning + Other
                </div>
              </div>
            </div>
          )}

          {/* Mexico Costs Tab */}
          {activeTab === 'mx-costs' && (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div style={{
                padding: '1rem',
                background: '#fef3c7',
                borderRadius: '0.5rem',
                border: '1px solid #fcd34d'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>ℹ️ Mexico Operations</div>
                <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
                  All costs in this section are in Mexican Pesos (MXN)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Import Costs (MXN)
                </label>
                <input
                  type="number"
                  name="import_cost_mxn"
                  value={formData.import_cost_mxn}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Customs Costs (MXN)
                </label>
                <input
                  type="number"
                  name="customs_cost_mxn"
                  value={formData.customs_cost_mxn}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Regulatory Costs (MXN)
                </label>
                <input
                  type="number"
                  name="regulatory_cost_mxn"
                  value={formData.regulatory_cost_mxn}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Other Import Costs (MXN)
                </label>
                <input
                  type="number"
                  name="other_import_costs_mxn"
                  value={formData.other_import_costs_mxn}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Transport to Client (MXN)
                </label>
                <input
                  type="number"
                  name="transport_to_client_cost_mxn"
                  value={formData.transport_to_client_cost_mxn}
                  onChange={handleNumberChange}
                  step="0.01"
                  min="0"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Preventive Maintenance
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                  <select
                    name="preventive_maintenance_currency"
                    value={formData.preventive_maintenance_currency}
                    onChange={handleChange}
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="USD">USD</option>
                    <option value="MXN">MXN</option>
                  </select>
                  <input
                    type="number"
                    name="preventive_maintenance_cost"
                    value={formData.preventive_maintenance_cost}
                    onChange={handleNumberChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <textarea
                  name="preventive_maintenance_notes"
                  value={formData.preventive_maintenance_notes}
                  onChange={handleChange}
                  placeholder="Notes (optional)"
                  rows="2"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <textarea
                name="import_notes"
                value={formData.import_notes}
                onChange={handleChange}
                placeholder="General import/Mexico operations notes (optional)"
                rows="3"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  resize: 'vertical'
                }}
              />

              <div style={{
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '500' }}>Total Mexico Costs:</span>
                  <span style={{ fontWeight: '700', fontSize: '1.25rem', color: '#10b981' }}>
                    {formatCurrency(mxCostsTotal, 'MXN')}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Import + Customs + Regulatory + Other + Transport
                </div>
              </div>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                borderRadius: '0.75rem',
                border: '2px solid #86efac'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '600', marginBottom: '0.5rem' }}>
                  GRAND TOTAL
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981', marginBottom: '0.5rem' }}>
                  {formatCurrency(grandTotal, grandTotalCurrency)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                  {hasMXNCosts ? '(All costs converted to MXN)' : '(USD costs only)'}
                </div>
              </div>

              <div style={{
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '1.125rem' }}>Cost Breakdown</div>
                
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Purchase Price:</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(purchasePrice, 'USD')}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Transport to Stock:</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(formData.transport_to_stock_cost_usd, 'USD')}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Initial Reconditioning:</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(formData.initial_reconditioning_cost_usd, 'USD')}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Other Acquisition:</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(formData.other_acquisition_costs_usd, 'USD')}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid #10b981', paddingTop: '0.5rem' }}>
                    <span style={{ fontWeight: '600' }}>US Operations Total:</span>
                    <span style={{ fontWeight: '700', color: '#10b981' }}>{formatCurrency(totalCostInUSStock, 'USD')}</span>
                  </div>

                  {hasMXNCosts && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', marginTop: '1rem' }}>
                        <span style={{ color: '#6b7280' }}>Import Costs:</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(formData.import_cost_mxn, 'MXN')}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#6b7280' }}>Customs Costs:</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(formData.customs_cost_mxn, 'MXN')}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#6b7280' }}>Regulatory Costs:</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(formData.regulatory_cost_mxn, 'MXN')}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#6b7280' }}>Other Import:</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(formData.other_import_costs_mxn, 'MXN')}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#6b7280' }}>Transport to Client:</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(formData.transport_to_client_cost_mxn, 'MXN')}</span>
                      </div>
                      
                      {prevMaintCost > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ color: '#6b7280' }}>Preventive Maintenance:</span>
                          <span style={{ fontWeight: '600' }}>{formatCurrency(prevMaintCost, prevMaintCurrency)}</span>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid #10b981', paddingTop: '0.5rem' }}>
                        <span style={{ fontWeight: '600' }}>Mexico Operations Total:</span>
                        <span style={{ fontWeight: '700', color: '#10b981' }}>{formatCurrency(mxCostsTotal + (prevMaintCurrency === 'MXN' ? prevMaintCost : 0), 'MXN')}</span>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: '#fef3c7',
                        borderRadius: '0.5rem',
                        marginTop: '0.5rem'
                      }}>
                        <span style={{ fontSize: '0.875rem', color: '#92400e' }}>Exchange Rate Used:</span>
                        <span style={{ fontWeight: '600', color: '#92400e' }}>1 USD = {currentExchangeRate || 17.50} MXN</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
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
              background: saving ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '700',
              fontSize: '0.875rem'
            }}
          >
            {saving ? '💾 Saving...' : '✅ Save Costs'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Export for standalone use
window.CostManagementModal = CostManagementModal;
