const { useState, useEffect } = React;

const InventoryManagement = () => {
  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  
  // State
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBusForm, setShowBusForm] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedBusForCosts, setSelectedBusForCosts] = useState(null);
  const [showPurchasePaymentModal, setShowPurchasePaymentModal] = useState(false);
  const [selectedBusForPayment, setSelectedBusForPayment] = useState(null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  // Load data
  useEffect(() => {
    loadData();
    loadPaymentAccounts();
  }, []);

  const loadData = async () => {
    try {
      const [invData, suppData] = await Promise.all([
        fetch(`${API_URL}/inventory`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/suppliers`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
        }).then(r => r.json())
      ]);
      setInventory(invData);
      setSuppliers(suppData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/accounting/accounts`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
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
      console.error('Failed to load payment accounts:', err);
    }
  };

  const handleSaveBus = async (busData) => {
    try {
      const method = editingBus ? 'PATCH' : 'POST';
      const url = editingBus 
        ? `${API_URL}/inventory/${editingBus.inventory_id}`
        : `${API_URL}/inventory`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('session_token')}`
        },
        body: JSON.stringify(busData)
      });

      if (!response.ok) throw new Error('Failed to save bus');

      const savedBus = await response.json();

      // Auto-create purchase payment for NEW buses (not edits)
      if (!editingBus && busData.payment_account_id) {
        try {
          await fetch(`${API_URL}/inventory/${savedBus.inventory_id}/record-purchase-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('session_token')}`
            },
            body: JSON.stringify({
              payment_account_id: busData.payment_account_id,
              payment_date: busData.purchase_date
            })
          });
          alert('✅ Bus saved and purchase payment recorded in accounting!');
        } catch (err) {
          console.error('Failed to record purchase payment:', err);
          alert('✅ Bus saved, but purchase payment failed. You can record it manually.');
        }
      } else {
        alert(editingBus ? '✅ Bus updated successfully!' : '✅ Bus saved successfully!');
      }

      setShowBusForm(false);
      setEditingBus(null);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteBus = async (bus) => {
    if (!confirm(`Delete ${bus.stock_number}?`)) return;
    try {
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
      });
      if (!response.ok) throw new Error('Failed to delete');
      alert('✅ Bus deleted');
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filter inventory
  const filteredInventory = inventory.filter(bus => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      bus.stock_number?.toLowerCase().includes(searchLower) ||
      bus.vin?.toLowerCase().includes(searchLower) ||
      bus.make?.toLowerCase().includes(searchLower) ||
      bus.model?.toLowerCase().includes(searchLower) ||
      bus.year?.toString().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <div>Loading inventory...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px' }}>
      {/* Search & Add Button */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search by stock#, VIN, make, model, year..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '300px', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem' }}
          />
          <button 
            onClick={() => setShowBusForm(true)} 
            style={{ padding: '0.75rem 1.5rem', background: '#FFD700', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ➕ Add New Bus
          </button>
        </div>
      </div>

      {/* Inventory List */}
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          All Buses ({filteredInventory.length})
        </h3>
        
        {filteredInventory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</div>
            <div>{search ? 'No buses match your search' : 'No inventory yet'}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredInventory.map((bus) => (
              <div key={bus.inventory_id} style={{ padding: '1.25rem', border: '1px solid #ddd', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                      {bus.year} {bus.make} {bus.model}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                      <div>📋 Stock: <strong>{bus.stock_number}</strong></div>
                      <div>🔖 VIN: <strong>{bus.vin}</strong></div>
                      <div>👥 Capacity: <strong>{bus.passenger_capacity || 'N/A'}</strong></div>
                      <div>📍 Location: <strong>{bus.current_location}</strong></div>
                      <div>📅 Purchased: <strong>{formatDate(bus.purchase_date)}</strong></div>
                      <div>📊 Status: <strong style={{ color: bus.status === 'Available' ? '#28a745' : '#666' }}>{bus.status}</strong></div>
                      {bus.supplier_id && (
                        <div>🏢 Supplier: <strong>{suppliers.find(s => s.supplier_id === bus.supplier_id)?.company_name || 'Unknown'}</strong></div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#28a745', marginBottom: '0.5rem' }}>
                      {formatCurrency(bus.purchase_price_usd)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => { setEditingBus(bus); setShowBusForm(true); }} 
                        style={{ padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => { setSelectedBusForCosts(bus); setShowCostModal(true); }} 
                        style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '600' }}
                      >
                        💰 Costs
                      </button>
                      <button 
                        onClick={() => { setSelectedBusForPayment(bus); setShowPurchasePaymentModal(true); }} 
                        style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '600' }}
                      >
                        💳 Purchase Payment
                      </button>
                      {user.role === 'admin' && (
                        <button 
                          onClick={() => handleDeleteBus(bus)} 
                          style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer' }}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showBusForm && (
        <BusForm
          bus={editingBus}
          suppliers={suppliers}
          paymentAccounts={paymentAccounts}
          onSave={handleSaveBus}
          onCancel={() => { setShowBusForm(false); setEditingBus(null); }}
        />
      )}

      {showCostModal && selectedBusForCosts && (
        <CostManagementModal
          bus={selectedBusForCosts}
          onClose={() => { setShowCostModal(false); setSelectedBusForCosts(null); }}
        />
      )}

      {showPurchasePaymentModal && selectedBusForPayment && (
        <RecordPurchasePaymentModal
          bus={selectedBusForPayment}
          paymentAccounts={paymentAccounts}
          onClose={() => { setShowPurchasePaymentModal(false); setSelectedBusForPayment(null); }}
          onSuccess={(result) => {
            alert(`✅ ${result.message}`);
            setShowPurchasePaymentModal(false);
            setSelectedBusForPayment(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

// ==================== BUS FORM ====================
function BusForm({ bus, suppliers, paymentAccounts, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    stock_number: '',
    vin: '',
    year: new Date().getFullYear(),
    make: '',
    model: '',
    passenger_capacity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price_usd: '',
    current_location: 'United States',
    status: 'Available',
    condition: 'Good',
    payment_account_id: '',
    supplier_id: ''
  });

  const [loadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bus) {
      setFormData({
        ...bus,
        purchase_price_usd: bus.purchase_price_usd || '',
        passenger_capacity: bus.passenger_capacity || '',
        purchase_date: bus.purchase_date ? bus.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
        payment_account_id: bus.payment_account_id || ''
      });
    }
  }, [bus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Only require payment_account_id for NEW buses (not edits)
    if (!bus && !formData.payment_account_id) {
      alert('Please select a payment account');
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        ...formData,
        year: parseInt(formData.year),
        passenger_capacity: formData.passenger_capacity ? parseInt(formData.passenger_capacity) : null,
        purchase_price_usd: Math.round(parseFloat(formData.purchase_price_usd) * 100) / 100
      };
      await onSave(data);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };

    // Auto-generate stock number from VIN
    if (name === 'vin' && value.length >= 6) {
      const last6 = value.slice(-6).toUpperCase();
      updated.stock_number = `BA-${last6}`;
    }

    setFormData(updated);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '8px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ margin: 0 }}>{bus ? 'Edit Bus' : 'Add New Bus'}</h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Stock Number & VIN */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Stock Number *</label>
                <input name="stock_number" value={formData.stock_number} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>VIN *</label>
                <input name="vin" value={formData.vin} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Year, Make, Model */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Year *</label>
                <input name="year" type="number" value={formData.year} onChange={handleChange} required min="1990" max="2030" style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Make *</label>
                <input name="make" value={formData.make} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Model *</label>
                <input name="model" value={formData.model} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Capacity & Purchase Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Capacity</label>
                <input name="passenger_capacity" type="number" value={formData.passenger_capacity} onChange={handleChange} min="1" max="99" style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Purchase Date *</label>
                <input name="purchase_date" type="date" value={formData.purchase_date} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Price & Paid From */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Price (USD) *</label>
                <input name="purchase_price_usd" type="number" step="0.01" value={formData.purchase_price_usd} onChange={handleChange} required min="0" style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              {!bus && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                    Paid From * <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '400' }}>(for new buses)</span>
                  </label>
                  <select
                    name="payment_account_id"
                    value={formData.payment_account_id}
                    onChange={handleChange}
                    required={!bus}
                    disabled={loadingAccounts}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">{loadingAccounts ? 'Loading...' : 'Select account'}</option>
                    {paymentAccounts.map(account => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.account_name} ({account.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Supplier */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                Supplier
              </label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">Select supplier (optional)</option>
                {suppliers.map(supplier => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location, Status, Condition */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Location *</label>
                <select name="current_location" value={formData.current_location} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="United States">United States</option>
                  <option value="Mexico">Mexico</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Status *</label>
                <select name="status" value={formData.status} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="Available">Available</option>
                  <option value="Sold">Sold</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Condition</label>
                <select name="condition" value={formData.condition || 'Good'} onChange={handleChange} style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.75rem', background: saving ? '#ccc' : '#FFD700', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : (bus ? '💾 Update Bus' : '💾 Save Bus')}
            </button>
            <button type="button" onClick={onCancel} style={{ flex: 1, padding: '0.75rem', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== RECORD PURCHASE PAYMENT MODAL ====================
function RecordPurchasePaymentModal({ bus, paymentAccounts, onClose, onSuccess }) {
  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  
  const [selectedAccount, setSelectedAccount] = useState('');
  const [paymentDate, setPaymentDate] = useState(bus.purchase_date || new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1.5rem', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
          💳 Record Purchase Payment
        </h2>

        <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '0.375rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Bus</div>
          <div style={{ fontWeight: '600' }}>{bus.stock_number}</div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>Purchase Price</div>
          <div style={{ fontWeight: '600' }}>${parseFloat(bus.purchase_price_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '0.375rem', color: '#991b1b', marginBottom: '1rem', fontSize: '0.875rem' }}>
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
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
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
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: '0.375rem', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '0.5rem 1rem', background: saving ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
            >
              {saving ? '⏳ Recording...' : '💳 Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
