const { useState, useEffect } = React;

const InventoryManagement = () => {
  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all'); // 'available' | 'sold' | 'all'
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
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const actionMenuRef = React.useRef(null);

  // Close the open row menu on any click outside it - a re-click on its own
  // toggle button is left to that button's own handler (which already knows
  // how to open/close/switch), so it isn't fought over by two setState calls
  // racing on the same click.
  useEffect(() => {
    if (openActionMenuId === null) return;
    const handleClickOutside = (e) => {
      if (e.target.closest('[data-action-menu-toggle]')) return;
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openActionMenuId]);

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
        // Filter for USD bank/cash accounts only - purchase_price_usd is
        // always USD, and record-purchase-payment records the raw number
        // against whichever account is picked with no currency conversion,
        // so an MXN account here would silently misrecord the payment at
        // face value instead of its peso equivalent.
        const paymentAccs = accounts.filter(acc =>
          acc.account_type === 'Asset' &&
          (acc.account_subtype === 'Bank' || acc.account_subtype === 'Cash') &&
          acc.currency === 'USD'
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save bus');
      }
      const savedBus = await response.json();

      if (!editingBus && (busData.payment_account_id || busData.payment_status === 'on_credit')) {
        try {
          const paymentResponse = await fetch(`${API_URL}/inventory/${savedBus.inventory_id}/record-purchase-payment`, {
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
          // Was always treated as success even on a 4xx/5xx (fetch only
          // rejects on a network failure, not an HTTP error status) - a
          // rejected payment (e.g. the currency-mismatch guard) used to
          // still show "recorded!" while nothing was actually recorded.
          if (!paymentResponse.ok) {
            const errorData = await paymentResponse.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Payment recording failed');
          }
          alert(busData.payment_status === 'on_credit'
            ? '✅ Bus saved! Purchase recorded as Accounts Payable.'
            : '✅ Bus saved and purchase payment recorded!');
        } catch (err) {
          alert(`✅ Bus saved, but payment recording failed: ${err.message}. Record it manually via the Purchase Payment button.`);
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
    // Delete is a soft delete (is_deleted = TRUE) - it hides the unit from
    // every inventory view, but any sale, cost, or payment already recorded
    // against it stays in the accounting records, now referencing a unit
    // nothing in Inventory/Sales shows any more. Warn before that happens
    // instead of silently letting it.
    const warning = bus.is_sold || bus.has_purchase_payment
      ? `${bus.stock_number} has recorded ${[bus.is_sold && 'sale', bus.has_purchase_payment && 'payment'].filter(Boolean).join('/')} history. ` +
        `Deleting it will hide it from Inventory and Sales, but that accounting history stays on the books. Delete anyway?`
      : `Delete ${bus.stock_number}?`;
    if (!confirm(warning)) return;
    try {
      const response = await fetch(`${API_URL}/inventory/${bus.inventory_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete');
      }
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
    // pre_inspection_id is the real FK set when a unit is created via
    // "Create Inventory" from an approved inspection - authoritative when
    // present. Fall back to a VIN match (case-insensitive: VINs typed
    // before the uppercase-on-entry fix, or entered directly via the API,
    // may not match casing exactly even though they're the same VIN) for
    // units added directly rather than from an inspection, which never get
    // that FK set even if a matching inspection exists.
    if (bus.pre_inspection_id) {
      const linked = inspections.find(insp => insp.inspection_id === bus.pre_inspection_id);
      if (linked) return linked;
    }
    return inspections.find(insp => insp.vin?.toUpperCase() === bus.vin?.toUpperCase());
  };

  const handleViewInspection = (bus) => {
    const inspection = getInspectionForBus(bus);
    if (inspection) {
      setSelectedInspection(inspection);
      setShowInspectionReport(true);
    }
  };

  const matchesStatusTab = (bus) => {
    if (statusTab === 'available') return !bus.is_sold;
    if (statusTab === 'sold') return !!bus.is_sold;
    return true; // 'all'
  };

  const matchesSearch = (bus) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      bus.stock_number?.toLowerCase().includes(searchLower) ||
      bus.vin?.toLowerCase().includes(searchLower) ||
      bus.make?.toLowerCase().includes(searchLower) ||
      bus.model?.toLowerCase().includes(searchLower) ||
      bus.year?.toString().includes(searchLower) ||
      bus.engine_make?.toLowerCase().includes(searchLower) ||
      bus.engine_model?.toLowerCase().includes(searchLower)
    );
  };

  const filteredInventory = inventory.filter(bus => matchesStatusTab(bus) && matchesSearch(bus));

  const statusTabCounts = {
    available: inventory.filter(bus => !bus.is_sold).length,
    sold: inventory.filter(bus => bus.is_sold).length,
    all: inventory.length
  };

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
        <div style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.3rem', background: '#f3f4f6', borderRadius: '10px', marginBottom: '1rem' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'available', label: 'Available' },
            { id: 'sold', label: 'Sold' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              style={{
                padding: '0.6rem 1.25rem',
                border: 'none',
                background: statusTab === tab.id ? '#FFD700' : 'transparent',
                color: '#1a1a1a',
                fontWeight: statusTab === tab.id ? '700' : '600',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                boxShadow: statusTab === tab.id ? '0 2px 5px rgba(0,0,0,0.15)' : 'none',
                transition: 'background 0.15s, box-shadow 0.15s'
              }}
            >
              {tab.label} ({statusTabCounts[tab.id]})
            </button>
          ))}
        </div>
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
            style={{ ...buttonStyle('primary', 'md'), whiteSpace: 'nowrap' }}
          >
            ➕ Add New Bus
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0 }}>
            {statusTab === 'available' ? 'Available Buses' : statusTab === 'sold' ? 'Sold Buses' : 'All Buses'} ({filteredInventory.length})
          </h3>
        </div>

        {filteredInventory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</div>
            <div>
              {search
                ? 'No buses match your search'
                : statusTab === 'available' ? 'No available buses' : statusTab === 'sold' ? 'No sold buses' : 'No inventory yet'}
            </div>
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
                          <div style={{ position: 'relative', display: 'inline-block' }} ref={openActionMenuId === bus.inventory_id ? actionMenuRef : undefined}>
                            <button
                              data-action-menu-toggle
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === bus.inventory_id ? null : bus.inventory_id);
                              }}
                              style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem', color: '#6b7280' }}
                            >
                              ⋮
                            </button>
                            {openActionMenuId === bus.inventory_id && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '150px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBus(bus);
                                  setShowBusForm(true);
                                  setOpenActionMenuId(null);
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
                                  setOpenActionMenuId(null);
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
                                  setOpenActionMenuId(null);
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
                                    setOpenActionMenuId(null);
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
                                    setOpenActionMenuId(null);
                                  }}
                                  style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', color: '#dc3545', borderTop: '1px solid #e5e7eb' }}
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                            )}
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
                                {/* is_sold, not the status text - 'Available' hasn't been a real
                                    status value since the status vocabulary was fixed, so this
                                    used to always render gray regardless of the unit's actual
                                    status. */}
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: bus.is_sold ? '#6b7280' : '#10b981' }}>{bus.status}</div>
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
  const API_URL = `${window.API_BASE_URL || 'https://buses-america.onrender.com'}/api`;
  const [formData, setFormData] = useState({
    stock_number: '',
    vin: '',
    // Left blank rather than defaulting to the current year - a real-looking
    // value here reads as "already set" (to the user and, before the
    // touched-fields fix below existed, to Decode VIN too), when it was
    // never actually chosen. An empty year forces a real one, typed or
    // decoded, same as every other required field on this form.
    year: '',
    make: '',
    model: '',
    passenger_capacity: '',
    engine_make: '',
    engine_model: '',
    engine_type: '',
    transmission: '',
    fuel_type: '',
    body_style: '',
    gvwr: '',
    length_feet: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price_usd: '',
    asking_price: '',
    asking_currency: 'USD',
    current_location: 'US Stock',
    status: 'Purchased - In Transit to Stock',
    condition: 'Good',
    payment_account_id: '',
    payment_status: 'paid',
    payable_to: '',
    supplier_id: ''
  });

  const [saving, setSaving] = useState(false);
  // 'idle' | 'loading' | 'done' | 'error' - drives the inline status line
  // next to the Decode VIN button. vinDecodeMessage holds the text to show
  // for 'done' (what got filled in) and 'error' (why it didn't).
  const [vinDecodeState, setVinDecodeState] = useState('idle');
  const [vinDecodeMessage, setVinDecodeMessage] = useState('');
  // Fields the user has actually edited (or, in edit mode, that already
  // carry a saved value) - handleDecodeVin only fills fields NOT in this
  // set. This has to be touch-tracking rather than a "is it blank" check:
  // `year` defaults to the current year (not blank) so a decoded VIN from
  // a different year would otherwise never be able to correct it.
  const [touchedFields, setTouchedFields] = useState(() => new Set());

  useEffect(() => {
    if (bus) {
      setFormData({
        ...bus,
        purchase_price_usd: bus.purchase_price_usd || '',
        passenger_capacity: bus.passenger_capacity || '',
        engine_make: bus.engine_make || '',
        engine_model: bus.engine_model || '',
        engine_type: bus.engine_type || '',
        transmission: bus.transmission || '',
        fuel_type: bus.fuel_type || '',
        body_style: bus.body_style || '',
        gvwr: bus.gvwr || '',
        length_feet: bus.length_feet || '',
        asking_price: bus.asking_price || '',
        asking_currency: bus.asking_currency || 'USD',
        purchase_date: bus.purchase_date ? bus.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
        payment_account_id: bus.payment_account_id || '',
        supplier_id: bus.supplier_id || ''
      });
      // Editing an existing unit - protect whatever it already has a real
      // value for (Decode VIN shouldn't overwrite it), but leave any field
      // that's genuinely blank on this record open to being filled in, same
      // as before - e.g. an older bus that's missing gvwr can still have it
      // filled by decoding its VIN while editing.
      const filledKeys = Object.keys(bus).filter(
        k => bus[k] !== null && bus[k] !== undefined && bus[k] !== ''
      );
      setTouchedFields(new Set(filledKeys));
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
        engine_type: formData.engine_type || null,
        transmission: formData.transmission || null,
        fuel_type: formData.fuel_type || null,
        body_style: formData.body_style || null,
        gvwr: formData.gvwr ? parseInt(formData.gvwr) : null,
        length_feet: formData.length_feet ? parseFloat(formData.length_feet) : null,
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
    // Uppercase VIN as entered - getInspectionForBus matches inventory to
    // its pre-inspection record by exact VIN string, so a casing mismatch
    // between the two would silently hide that link.
    const updated = { ...formData, [name]: name === 'vin' ? value.toUpperCase() : value };

    // Only auto-derive on creation - `bus` is set when editing an existing
    // unit, and correcting a VIN typo there shouldn't silently overwrite an
    // already-established stock number that other records (quotes, cost
    // item notes, sale history) may already reference by value.
    if (!bus && name === 'vin' && value.length >= 6) {
      const last6 = value.slice(-6).toUpperCase();
      updated.stock_number = `BA-${last6}`;
    }

    setFormData(updated);
    setTouchedFields(prev => new Set(prev).add(name));
  };

  // Fills in only the fields the user hasn't touched - a decoded VIN should
  // never silently overwrite something the user already typed or corrected,
  // the same non-destructive principle handleChange already applies to the
  // VIN -> stock_number auto-derivation above. This checks touchedFields
  // rather than "is the field blank", because some fields (year) start out
  // with a real, non-blank default that isn't real data either.
  const handleDecodeVin = async () => {
    setVinDecodeState('loading');
    setVinDecodeMessage('');
    const result = await decodeVin(formData.vin, API_URL);
    if (!result.ok) {
      setVinDecodeState('error');
      setVinDecodeMessage(result.error);
      return;
    }
    const filledFields = [];
    const updated = { ...formData };
    Object.entries(result.decoded).forEach(([field, value]) => {
      if (field in updated && !touchedFields.has(field)) {
        updated[field] = value;
        filledFields.push(field);
      }
    });
    setFormData(updated);
    setVinDecodeState('done');
    setVinDecodeMessage(
      filledFields.length > 0
        ? `Auto-filled from VIN: ${filledFields.join(', ')}`
        : (result.warning || 'Nothing new to fill in from this VIN')
    );
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
            {/* VIN before Stock Number - stock_number is auto-derived from the
                VIN's last 6 characters (handleChange above), so the field it's
                derived from belongs first. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>VIN *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input name="vin" value={formData.vin} onChange={handleChange} required style={{ flex: 1, padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                  <button
                    type="button"
                    onClick={handleDecodeVin}
                    disabled={formData.vin.trim().length !== 17 || vinDecodeState === 'loading'}
                    style={buttonStyle('outline', 'sm', formData.vin.trim().length !== 17 || vinDecodeState === 'loading')}
                    title="Look up year/make/model/engine from this VIN"
                  >
                    {vinDecodeState === 'loading' ? '⏳' : '🔍'} Decode
                  </button>
                </div>
                {vinDecodeMessage && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', color: vinDecodeState === 'error' ? '#dc2626' : '#059669' }}>
                    {vinDecodeMessage}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Stock Number *</label>
                <input name="stock_number" value={formData.stock_number} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
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

            {/* Vehicle specs - typically left blank and filled by Decode VIN above, but
                editable like every other field so a wrong or missing decode can be corrected. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Engine Type</label>
                <input name="engine_type" value={formData.engine_type} onChange={handleChange} placeholder="Diesel, Gasoline, CNG..." style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Transmission</label>
                <input name="transmission" value={formData.transmission} onChange={handleChange} style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Fuel Type</label>
                <input name="fuel_type" value={formData.fuel_type} onChange={handleChange} style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Body Style</label>
                <input name="body_style" value={formData.body_style} onChange={handleChange} placeholder="School Bus, Transit Bus, Shuttle..." style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>GVWR (lbs)</label>
                <input name="gvwr" type="number" value={formData.gvwr} onChange={handleChange} min="0" style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Length (ft)</label>
                <input name="length_feet" type="number" step="0.1" value={formData.length_feet} onChange={handleChange} min="0" style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }} />
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
                  <option value="US Stock">US Stock</option>
                  <option value="Mexico Stock">Mexico Stock</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Client">Client</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Status *</label>
                {/* Selecting "Sold" or anything from "Sold - Pending Import" onward marks
                    the unit sold server-side (is_sold), same as recording a sale through
                    Sales Management - see update_inventory in backend_api_FINAL.py. "Sold"
                    is the generic milestone for a unit that's sold but hasn't started (or
                    won't go through) the import pipeline yet. */}
                <select name="status" value={formData.status} onChange={handleChange} required style={{ width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="Purchased - In Transit to Stock">Purchased - In Transit to Stock</option>
                  <option value="In Stock (US)">In Stock (US)</option>
                  <option value="Sold">Sold</option>
                  <option value="Sold - Pending Import">Sold - Pending Import</option>
                  <option value="Import/Customs Processing">Import/Customs Processing</option>
                  <option value="In Stock (Mexico)">In Stock (Mexico)</option>
                  <option value="In Preventive Maintenance">In Preventive Maintenance</option>
                  <option value="Ready for Delivery">Ready for Delivery</option>
                  <option value="In Transit to Client">In Transit to Client</option>
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
            <button type="submit" disabled={saving} style={{ ...buttonStyle('primary', 'md', saving), flex: 1 }}>
              {saving ? 'Saving...' : (bus ? '💾 Update Bus' : '💾 Save Bus')}
            </button>
            <button type="button" onClick={onCancel} style={{ ...buttonStyle('outline', 'md'), flex: 1 }}>
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
              style={buttonStyle('outline', 'md', saving)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={buttonStyle('green', 'md', saving)}
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
