

const CreateInventoryModal = ({ inspection, suppliers, onClose, onSave }) => {
  const [formData, setFormData] = useState({
  stock_number: inspection.vin ? `BA-${inspection.vin.slice(-6).toUpperCase()}` : '',
    purchase_price_usd: '',
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    current_location: 'United States'
  });

  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
  company_name: inspection.seller_name || '',
  contact_person: '',
  email: '',
  phone: inspection.seller_contact || '',
  supplier_type: 'School District'  // Changed default to School District
});
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  
  if (!formData.stock_number || !formData.purchase_price_usd) {
    setError('Please fill in all required fields');
    return;
  }
  
  setSaving(true);
  try {
    let supplierIdToUse = formData.supplier_id;
    
    // Create new supplier if needed
    if (formData.supplier_id === 'CREATE_NEW' || formData.supplier_id === 'FROM_INSPECTION') {
      if (!newSupplier.company_name) {
        setError('Supplier company name is required');
        setSaving(false);
        return;
      }
      
      // Check if supplier already exists
      const existingSupplier = suppliers.find(s => 
        s.company_name.toLowerCase() === newSupplier.company_name.toLowerCase()
      );
      
      if (existingSupplier) {
        supplierIdToUse = existingSupplier.supplier_id;
      } else {
        // Create the supplier only if it doesn't exist
        const createdSupplier = await fetch(`${API_URL}/suppliers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('session_token')}`
          },
          body: JSON.stringify(newSupplier)
        });
        
        if (!createdSupplier.ok) {
          throw new Error('Failed to create supplier');
        }
        
        const supplierData = await createdSupplier.json();
        supplierIdToUse = supplierData.supplier_id;
      }
    }
    
    // Now create inventory with the supplier ID
    await onSave({
      ...formData,
      supplier_id: parseInt(supplierIdToUse),
      purchase_price_usd: parseFloat(formData.purchase_price_usd)
    });
  } catch (err) {
    setError(err.message || 'Failed to create inventory');
    setSaving(false);
  }
};

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  // Calculate estimated profit
  const estimatedProfit = formData.purchase_price_usd && inspection.seller_asking_price
    ? parseFloat(inspection.seller_asking_price) - parseFloat(formData.purchase_price_usd) - parseFloat(inspection.estimated_repair_cost_usd || 0)
    : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                ✅ Create Inventory from Inspection
              </h2>
              <div style={{ fontSize: '1.25rem', opacity: 0.9 }}>
                {inspection.year} {inspection.make} {inspection.model}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.25rem' }}>
                VIN: {inspection.vin}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                fontSize: '1.5rem',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '700'
              }}
            >
              ✕
            </button>
          </div>

          {/* Info Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '0.5rem'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>Overall Rating</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginTop: '0.25rem' }}>
                {inspection.overall_rating}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>Repair Estimate</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginTop: '0.25rem' }}>
                {formatCurrency(inspection.estimated_repair_cost_usd)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>Seller Asking</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginTop: '0.25rem' }}>
                {formatCurrency(inspection.seller_asking_price)}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {/* Pre-filled Info Banner */}
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #10b981',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#065f46' }}>
                  Pre-filled from Inspection
                </div>
                <div style={{ fontSize: '0.875rem', color: '#059669' }}>
                  These fields will be automatically populated
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.875rem', color: '#047857' }}>
              <div>✓ VIN, Year, Make, Model</div>
              <div>✓ Engine & Transmission</div>
              <div>✓ Passenger Capacity</div>
              <div>✓ Exterior & Interior Colors</div>
              <div>✓ Odometer Reading</div>
              <div>✓ Title Status</div>
              <div>✓ Condition Assessment</div>
              <div>✓ Inspection Summary</div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Stock Number */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  fontSize: '0.875rem'
                }}>
                  Stock Number * (Your Internal ID)
                </label>
                <input
                  type="text"
                  name="stock_number"
                  value={formData.stock_number}
                  onChange={handleChange}
                  required
                  placeholder="BA002"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                />
              </div>

              {/* Purchase Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    fontSize: '0.875rem'
                  }}>
                    Purchase Price (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="purchase_price_usd"
                    value={formData.purchase_price_usd}
                    onChange={handleChange}
                    required
                    placeholder="15000"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: '500'
                    }}
                  />
                  {inspection.seller_asking_price && formData.purchase_price_usd && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      marginTop: '0.25rem',
                      color: parseFloat(formData.purchase_price_usd) < parseFloat(inspection.seller_asking_price) ? '#059669' : '#dc2626'
                    }}>
                      {parseFloat(formData.purchase_price_usd) < parseFloat(inspection.seller_asking_price) 
                        ? `✓ ${formatCurrency(parseFloat(inspection.seller_asking_price) - parseFloat(formData.purchase_price_usd))} below asking`
                        : `⚠ ${formatCurrency(parseFloat(formData.purchase_price_usd) - parseFloat(inspection.seller_asking_price))} above asking`
                      }
                    </div>
                  )}
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    fontSize: '0.875rem'
                  }}>
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    name="purchase_date"
                    value={formData.purchase_date}
                    onChange={handleChange}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              {/* Supplier */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  fontSize: '0.875rem'
                }}>
                  Supplier *
                </label>
                <div>
                  <select
                    name="supplier_id"
                    value={formData.supplier_id}
                    onChange={(e) => {
                      if (e.target.value === 'CREATE_NEW') {
                        setShowNewSupplier(true);
                      } else {
                        handleChange(e);
                      }
                    }}
                    style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}
                  >
                    <option value="">Select supplier...</option>
                    {inspection.seller_name && (
                      <option value="FROM_INSPECTION">
                        📝 {inspection.seller_name} (from inspection)
                      </option>
                    )}
                    <option value="CREATE_NEW">➕ Create New Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.company_name}
                      </option>
                    ))}
                  </select>
                  
                  {showNewSupplier && (
                    <div style={{marginTop:'1rem',padding:'1rem',background:'#f9fafb',borderRadius:'6px',border:'1px solid #e5e7eb'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.75rem'}}>
                        <strong>New Supplier</strong>
                        <button type="button" onClick={() => setShowNewSupplier(false)} style={{background:'none',border:'none',cursor:'pointer'}}>✕</button>
                      </div>
                      <div style={{display:'grid',gap:'0.75rem'}}>
                        <input
                          type="text"
                          placeholder="Company Name *"
                          value={newSupplier.company_name}
                          onChange={(e) => setNewSupplier({...newSupplier, company_name: e.target.value})}
                          style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}
                        />
                        <input
                          type="text"
                          placeholder="Contact Person"
                          value={newSupplier.contact_person}
                          onChange={(e) => setNewSupplier({...newSupplier, contact_person: e.target.value})}
                          style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}
                        />
                        <select
                        value={newSupplier.supplier_type}
                        onChange={(e) => setNewSupplier({...newSupplier, supplier_type: e.target.value})}
                        style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}
                      >
                        <option value="School District">School District</option>
                        <option value="Public School">Public School</option>
                        <option value="City Government">City Government</option>
                        <option value="County Government">County Government</option>
                        <option value="State Government">State Government</option>
                        <option value="Dealer">Dealer</option>
                        <option value="Auction">Auction</option>
                        <option value="Private Seller">Private Seller</option>
                        <option value="Manufacturer">Manufacturer</option>
                      </select>
                        <input
                          type="email"
                          placeholder="Email"
                          value={newSupplier.email}
                          onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                          style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}
                        />
                        <input
                          type="tel"
                          placeholder="Phone"
                          value={newSupplier.phone}
                          onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                          style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {inspection.seller_name && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Inspected at: {inspection.seller_name}
                  </div>
                )}
              </div>

              {/* Current Location */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  fontSize: '0.875rem'
                }}>
                  Current Location *
                </label>
                <select
                  name="current_location"
                  value={formData.current_location}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  <option value="United States">United States</option>
                  <option value="Mexico">Mexico</option>
                  <option value="In Transit">In Transit</option>
                </select>
              </div>

              {/* Profit Estimate */}
              {estimatedProfit !== null && (
                <div style={{
                  background: estimatedProfit > 0 ? '#f0fdf4' : '#fef2f2',
                  border: `2px solid ${estimatedProfit > 0 ? '#10b981' : '#ef4444'}`,
                  borderRadius: '0.75rem',
                  padding: '1.5rem'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Estimated Profit Margin
                  </div>
                  <div style={{ 
                    fontSize: '2rem', 
                    fontWeight: '700',
                    color: estimatedProfit > 0 ? '#065f46' : '#7f1d1d'
                  }}>
                    {formatCurrency(estimatedProfit)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    (Asking: {formatCurrency(inspection.seller_asking_price)} - 
                    Purchase: {formatCurrency(formData.purchase_price_usd)} - 
                    Repairs: {formatCurrency(inspection.estimated_repair_cost_usd)})
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div style={{
                  background: '#fee2e2',
                  border: '2px solid #ef4444',
                  color: '#7f1d1d',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem'
                }}>
                  {error}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '2px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#374151',
              border: '2px solid #e5e7eb',
              borderRadius: '0.5rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
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
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            {saving ? '💾 Creating Inventory...' : '✅ Create Inventory'}
          </button>
        </div>
      </div>
    </div>
  );
};

window.CreateInventoryModal = CreateInventoryModal;
