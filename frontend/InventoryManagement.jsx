const { useState, useEffect } = React;

const InventoryManagement = () => {
  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [showBusForm, setShowBusForm] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedBusForCosts, setSelectedBusForCosts] = useState(null);
  const [showPurchasePaymentModal, setShowPurchasePaymentModal] = useState(false);
  const [selectedBusForPayment, setSelectedBusForPayment] = useState(null);
  const [showInspectionReport, setShowInspectionReport] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  useEffect(() => {
    loadData();
    loadPaymentAccounts();
  }, []);

  const loadData = async () => {
    try {
      const [invData, suppData, inspData] = await Promise.all([
        fetch(`${API_URL}/inventory`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/suppliers`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/pre-inspections`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
        }).then(r => r.json())
      ]);
      setInventory(invData);
      setSuppliers(suppData);
      setInspections(inspData);
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

      if (!editingBus && (busData.payment_account_id || busData.payment_status === 'on_credit')) {
        try {
          await fetch(`${API_URL}/inventory/${savedBus.inventory_id}/record-purchase-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('session_token')}`
            },
            body: JSON.stringify({
              payment_account_id: busData.payment_account_id ? parseInt(busData.payment_account_id) : null,
              payment_date: busData.purchase_date,
              payment_status: busData.payment_status || 'paid',
              payable_to: busData.payable_to || null
            })
          });
          alert(busData.payment_status === 'on_credit' 
            ? '✅ Bus saved! Purchase recorded as Accounts Payable.' 
            : '✅ Bus saved and purchase payment recorded!');
        } catch (err) {
          alert('✅ Bus saved, but payment recording failed. Record manually.');
        }
      } else {
        alert(editingBus ? '✅ Bus updated!' : '✅ Bus saved!');
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

  const toggleRow = (inventoryId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(inventoryId)) {
      newExpanded.delete(inventoryId);
    } else {
      newExpanded.add(inventoryId);
    }
    setExpandedRows(newExpanded);
  };

  const getInspectionForBus = (bus) => {
    return inspections.find(insp => insp.vin === bus.vin);
  };

  const handleViewInspection = (bus) => {
    const inspection = getInspectionForBus(bus);
    if (inspection) {
      setSelectedInspection(inspection);
      setShowInspectionReport(true);
    }
  };

  const filteredInventory = inventory.filter(bus => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      bus.stock_number?.toLowerCase().includes(searchLower) ||
      bus.vin?.toLowerCase().includes(searchLower) ||
      bus.make?.toLowerCase().includes(searchLower) ||
      bus.model?.toLowerCase().includes(searchLower) ||
      bus.year?.toString().includes(searchLower) ||
      bus.engine_make?.toLowerCase().includes(searchLower)
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
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search by stock#, VIN, make, model, engine..."
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

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0 }}>All Buses ({filteredInventory.length})</h3>
        </div>

        {filteredInventory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</div>
            <div>{search ? 'No buses match your search' : 'No inventory yet'}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#6b7280', width: '40px' }}></th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#6b7280' }}>Stock #</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#6b7280' }}>Vehicle</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#6b7280' }}>Engine</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#6b7280' }}>Capacity</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', fontSize: '0.875rem', color: '#6b7280' }}>Price</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', fontSize: '0.875rem', color: '#6b7280', width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((bus) => {
                  const isExpanded = expandedRows.has(bus.inventory_id);
                  const inspection = getInspectionForBus(bus);
                  const supplier = suppliers.find(s => s.supplier_id === bus.supplier_id);

                  return (
                    <React.Fragment key={bus.inventory_id}>
                      <tr style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => toggleRow(bus.inventory_id)}>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '1.25rem', color: '#6b7280', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                            ▶
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>
                          {bus.stock_number}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: '600' }}>{bus.year} {bus.make} {bus.model}</div>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                          {bus.engine_make || bus.engine_model ? `${bus.engine_make || ''} ${bus.engine_model || ''}`.trim() : 'N/A'}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                          {bus.passenger_capacity ? `${bus.passenger_capacity} passengers` : 'N/A'}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                          {bus.asking_price ? `${formatCurrency(bus.asking_price)} ${bus.asking_currency || 'USD'}` : '-'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const menu = e.currentTarget.nextElementSibling;
                                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                              }}
                              style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem', color: '#6b7280' }}
                            >
                              ⋮
                            </button>
                            <div style={{ display: 'none', position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '150px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBus(bus);
                                  setShowBusForm(true);
                                  e.currentTarget.parentElement.style.display = 'none';
                                }}
                                style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBusForCosts(bus);
                                  setShowCostModal(true);
                                  e.currentTarget.parentElement.style.display = 'none';
                                }}
                                style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              >
                                💰 Costs
                              </button>
                              {!bus.has_purchase_payment && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBusForPayment(bus);
                                  setShowPurchasePaymentModal(true);
                                  e.currentTarget.parentElement.style.display = 'none';
                                }}
                                style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              >
                                💳 Purchase Payment
                              </button>
                              )}
                              {inspection && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewInspection(bus);
                                    e.currentTarget.parentElement.style.display = 'none';
                                  }}
                                  style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                                >
                                  🔍 View Inspection
                                </button>
                              )}
                              {user.role === 'admin' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteBus(bus);
                                    e.currentTarget.parentElement.style.display = 'none';
                                  }}
                                  style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', color: '#dc3545', borderTop: '1px solid #e5e7eb' }}
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                          <td colSpan="7" style={{ padding: '1.5rem 2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>VIN</div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{bus.vin}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Location</div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{bus.current_location}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Status</div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: bus.status === 'Available' ? '#10b981' : '#6b7280' }}>{bus.status}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Purchase Date</div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{formatDate(bus.purchase_date)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Purchase Price</div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#ef4444' }}>{formatCurrency(bus.purchase_price_usd)} USD</div>
                              </div>
                              {bus.asking_price && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Asking Price (Sale)</div>
                                  <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#10b981' }}>{formatCurrency(bus.asking_price)} {bus.asking_currency || 'USD'}</div>
                                </div>
                              )}
                              {supplier && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Supplier</div>
                                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{supplier.company_name}</div>
                                </div>
                              )}
                              {inspection && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Inspection</div>
                                  <div 
                                    onClick={() => handleViewInspection(bus)}
                                    style={{ fontWeight: '600', fontSize: '0.9rem', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                                  >
                                    {formatDate(inspection.inspection_date)} - {inspection.overall_condition || 'Completed'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {showInspectionReport && selectedInspection && (
        <PreInspectionReport
          inspection={selectedInspection}
          onClose={() => { setShowInspectionReport(false); setSelectedInspection(null); }}
        />
      )}
    </div>
  );
};

function BusForm({ bus, suppliers, paymentAccounts, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    stock_number: '',
    vin: '',
    year: new Date().getFullYear(),
    make: '',
    model: '',
    passenger_capacity: '',
    engine_make: '',
    engine_model: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price_usd: '',
    asking_price: '',
    asking_currency: 'USD',
    current_location: 'United States',
    status: 'Available',
    condition: 'Good',
    payment_account_id: '',
    payment_status: 'paid',
    payable_to: '',
    supplier_id: ''
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bus) {
      setFormData({
        ...bus,
        purchase_price_usd: bus.purchase_price_usd || '',
        passenger_capacity: bus.passenger_capacity || '',
        engine_make: bus.engine_make || '',
        engine_model: bus.engine_model || '',
        asking_price: bus.asking_price || '',
        asking_currency: bus.asking_currency || 'USD',
        purchase_date: bus.purchase_date ? bus.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
        payment_account_id: bus.payment_account_id || '',
        supplier_id: bus.supplier_id || ''
      });
    }
  }, [bus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all required fields
    if (!formData.stock_number || !formData.stock_number.trim()) {
      alert('Please enter a stock number');
      return;
    }
    if (!formData.year || isNaN(parseInt(formData.year))) {
      alert('Please enter a valid year');
      return;
    }
    if (!formData.make || !formData.make.trim()) {
      alert('Please enter the make');
      return;
    }
    if (!formData.model || !formData.model.trim()) {
      alert('Please enter the model');
      return;
    }
    if (!formData.purchase_price_usd || isNaN(parseFloat(formData.purchase_price_usd))) {
      alert('Please enter a valid purchase price');
      return;
    }
    if (!bus && formData.payment_status === 'paid' && !formData.payment_account_id) {
      alert('Please select a payment account');
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        ...formData,
        year: parseInt(formData.year),
        passenger_capacity: formData.passenger_capacity ? parseInt(formData.passenger_capacity) : null,
        purchase_price_usd: Math.round(parseFloat(formData.purchase_price_usd) * 100) / 100,
        asking_price: formData.asking_price ? Math.round(parseFloat(formData.asking_price) * 100) / 100 : null,
        asking_currency: formData.asking_currency || 'USD',
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        engine_make: formData.engine_make || null,
        engine_model: formData.engine_model || null,
        payment_account_id: formData.payment_account_id ? parseInt(formData.payment_account_id) : null
      };
      console.log('Submitting inventory data:', JSON.stringify(data, null, 2));
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Engine Make</label>
                <input name="engine_make" value={formData.engine_make} onChange={handleChange} style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Engine Model</label>
                <input name="engine_model" value={formData.engine_model} onChange={handleChange} style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Purchase Price (USD) *</label>
                <input name="purchase_price_usd" type="number" step="0.01" value={formData.purchase_price_usd} onChange={handleChange} required min="0" style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              {!bus && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                    Payment Status *
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_status: 'paid', payment_account_id: '' })}
                      style={{
                        flex: 1, padding: '0.5rem',
                        border: formData.payment_status === 'paid' ? '2px solid #059669' : '1px solid #ddd',
                        borderRadius: '4px',
                        background: formData.payment_status === 'paid' ? '#d1fae5' : 'white',
                        color: formData.payment_status === 'paid' ? '#065f46' : '#374151',
                        fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer'
                      }}
                    >
                      💵 Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_status: 'on_credit', payment_account_id: '' })}
                      style={{
                        flex: 1, padding: '0.5rem',
                        border: formData.payment_status === 'on_credit' ? '2px solid #d97706' : '1px solid #ddd',
                        borderRadius: '4px',
                        background: formData.payment_status === 'on_credit' ? '#fef3c7' : 'white',
                        color: formData.payment_status === 'on_credit' ? '#92400e' : '#374151',
                        fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer'
                      }}
                    >
                      📋 On Credit
                    </button>
                  </div>
                  {formData.payment_status === 'paid' && (
                    <select
                      name="payment_account_id"
                      value={formData.payment_account_id}
                      onChange={handleChange}
                      required
                      style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value="">Select account</option>
                      {paymentAccounts.map(account => (
                        <option key={account.account_id} value={account.account_id}>
                          {account.account_name} ({account.currency})
                        </option>
                      ))}
                    </select>
                  )}
                  {formData.payment_status === 'on_credit' && (
                    <div>
                      <div style={{ padding: '0.6rem', background: '#fef3c7', borderRadius: '4px', fontSize: '0.8rem', color: '#92400e', marginBottom: '0.75rem' }}>
                        Purchase will be recorded as Accounts Payable. Pay later from the Accounting module.
                      </div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                        Payable To *
                      </label>
                      <input
                        type="text"
                        value={formData.payable_to}
                        onChange={(e) => setFormData({ ...formData, payable_to: e.target.value })}
                        placeholder="Who do you owe? (e.g. auction house, dealer)"
                        required
                        style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        May be different from the supplier
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Supplier</label>
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

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                  Asking Price (Sale Price) <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '400' }}>(optional)</span>
                </label>
                <input 
                  name="asking_price" 
                  type="number" 
                  step="0.01" 
                  value={formData.asking_price} 
                  onChange={handleChange} 
                  min="0" 
                  placeholder="Enter selling price"
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Currency</label>
                <select
                  name="asking_currency"
                  value={formData.asking_currency}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
            </div>

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

function RecordPurchasePaymentModal({ bus, paymentAccounts, onClose, onSuccess }) {
  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  
  const [selectedAccount, setSelectedAccount] = useState('');
  const [paymentDate, setPaymentDate] = useState(bus.purchase_date || new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [payableTo, setPayableTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (paymentStatus === 'paid' && !selectedAccount) {
      setError('Please select a payment account');
      return;
    }
    if (paymentStatus === 'on_credit' && !payableTo.trim()) {
      setError('Please enter who this is payable to');
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
          payment_account_id: paymentStatus === 'paid' ? parseInt(selectedAccount) : null,
          payment_date: paymentDate,
          payment_status: paymentStatus,
          payable_to: paymentStatus === 'on_credit' ? payableTo : null
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
          {/* Payment Status Toggle */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
              Payment Status <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setPaymentStatus('paid'); setSelectedAccount(''); }}
                style={{
                  flex: 1, padding: '0.6rem',
                  border: paymentStatus === 'paid' ? '2px solid #059669' : '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  background: paymentStatus === 'paid' ? '#d1fae5' : 'white',
                  color: paymentStatus === 'paid' ? '#065f46' : '#374151',
                  fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                💵 Paid
              </button>
              <button
                type="button"
                onClick={() => { setPaymentStatus('on_credit'); setSelectedAccount(''); }}
                style={{
                  flex: 1, padding: '0.6rem',
                  border: paymentStatus === 'on_credit' ? '2px solid #d97706' : '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  background: paymentStatus === 'on_credit' ? '#fef3c7' : 'white',
                  color: paymentStatus === 'on_credit' ? '#92400e' : '#374151',
                  fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                📋 On Credit
              </button>
            </div>
          </div>

          {paymentStatus === 'paid' && (
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
                Which bank/cash account was used?
              </div>
            </div>
          )}

          {paymentStatus === 'on_credit' && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#92400e', marginBottom: '0.75rem' }}>
                Purchase will be recorded as Accounts Payable. You can pay it later from the Accounting module.
              </div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                Payable To <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={payableTo}
                onChange={(e) => setPayableTo(e.target.value)}
                placeholder="Who do you owe? (e.g. auction house, dealer)"
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
              />
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                May be different from the supplier
              </div>
            </div>
          )}

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

window.InventoryManagement = InventoryManagement;
