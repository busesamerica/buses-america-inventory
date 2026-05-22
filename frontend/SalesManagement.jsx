// SalesManagement.jsx - Unified Sales Management System
// Industry-standard ERP-style workflow: Record sales → Track payments → Analyze performance

const SalesManagement = () => {
  const [activeTab, setActiveTab] = React.useState('record'); // record, manage, analytics
  const [loading, setLoading] = React.useState(false);
  const [inventory, setInventory] = React.useState([]);
  const [soldBuses, setSoldBuses] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [accounts, setAccounts] = React.useState([]);
  const [selectedSale, setSelectedSale] = React.useState(null);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = React.useState(false);

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      
      // Load unsold inventory for record sale form
      const invResponse = await fetch(`${API_URL}/inventory?is_sold=false`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (invResponse.ok) {
        setInventory(await invResponse.json());
      }

      // Load sold buses for manage tab
      const soldResponse = await fetch(`${API_URL}/inventory?is_sold=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (soldResponse.ok) {
        setSoldBuses(await soldResponse.json());
      }

      // Load clients
      const clientsResponse = await fetch(`${API_URL}/clients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (clientsResponse.ok) {
        setClients(await clientsResponse.json());
      }

      // Load bank accounts for payment recording
      const accountsResponse = await fetch(`${API_URL}/accounting/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (accountsResponse.ok) {
        const allAccounts = await accountsResponse.json();
        // Filter for cash/bank accounts only
        setAccounts(allAccounts.filter(a => 
          a.account_type === 'Asset' && 
          (a.account_subtype === 'Bank' || a.account_subtype === 'Cash')
        ));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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

  return (
    <div style={{ background: '#f9fafb' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <button
          onClick={() => setActiveTab('record')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'record' ? 'white' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'record' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'record' ? '#3b82f6' : '#6b7280',
            fontWeight: activeTab === 'record' ? '700' : '500',
            cursor: 'pointer',
            fontSize: '0.875rem',
            marginBottom: '-2px'
          }}
        >
          ➕ Record Sale
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'manage' ? 'white' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'manage' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'manage' ? '#3b82f6' : '#6b7280',
            fontWeight: activeTab === 'manage' ? '700' : '500',
            cursor: 'pointer',
            fontSize: '0.875rem',
            marginBottom: '-2px'
          }}
        >
          💰 Manage Sales
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'analytics' ? 'white' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'analytics' ? '#3b82f6' : '#6b7280',
            fontWeight: activeTab === 'analytics' ? '700' : '500',
            cursor: 'pointer',
            fontSize: '0.875rem',
            marginBottom: '-2px'
          }}
        >
          📊 Analytics
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'record' && (
        <RecordSaleForm 
          inventory={inventory}
          clients={clients}
          onSaleRecorded={loadData}
        />
      )}

      {activeTab === 'manage' && (
        <ManageSales
          soldBuses={soldBuses}
          accounts={accounts}
          onPaymentRecorded={loadData}
          onViewDetails={(bus) => {
            setSelectedSale(bus);
            setShowSaleDetailsModal(true);
          }}
        />
      )}

      {activeTab === 'analytics' && (
        <SalesReports />
      )}

      {/* Sale Details Modal */}
      {showSaleDetailsModal && selectedSale && (
        <SaleDetailsModal
          bus={selectedSale}
          onClose={() => {
            setShowSaleDetailsModal(false);
            setSelectedSale(null);
          }}
          onPaymentAdded={loadData}
          accounts={accounts}
        />
      )}
    </div>
  );
};

// ============= RECORD SALE FORM =============
const RecordSaleForm = ({ inventory, clients, onSaleRecorded }) => {
  const [formData, setFormData] = React.useState({
    inventory_id: '',
    sale_price: '',
    sale_currency: 'USD',
    sale_date: new Date().toISOString().split('T')[0],
    client_id: '',
    sale_notes: ''
  });
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/sales/record`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          sale_price: parseFloat(formData.sale_price),
          client_id: formData.client_id || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setFormData({
          inventory_id: '',
          sale_price: '',
          sale_currency: 'USD',
          sale_date: new Date().toISOString().split('T')[0],
          client_id: '',
          sale_notes: ''
        });
        onSaleRecorded();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to record sale'}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
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

  if (inventory.length === 0) {
    return (
      <div style={{
        padding: '3rem',
        background: 'white',
        borderRadius: '0.75rem',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</div>
        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem' }}>
          No Available Inventory
        </div>
        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
          All buses are currently sold. Add new inventory to record sales.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.5rem',
      background: 'white',
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
        Record New Sale
      </h3>

      {result && (
        <div style={{
          padding: '1rem',
          background: '#d1fae5',
          border: '1px solid #10b981',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ fontWeight: '700', color: '#065f46', marginBottom: '0.5rem' }}>
            ✅ Sale Recorded Successfully!
          </div>
          <div style={{ fontSize: '0.875rem', color: '#065f46' }}>
            <div><strong>{result.stock_number}</strong> sold for <strong>{formatCurrency(result.sale_price, result.currency)}</strong></div>
            <div>Gross Profit: <strong>{formatCurrency(result.gross_profit, result.currency)}</strong> ({result.gross_profit_margin}%)</div>
            <div>Reference: <strong>{result.reference_number}</strong></div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
              Select Bus <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              required
              value={formData.inventory_id}
              onChange={(e) => setFormData({ ...formData, inventory_id: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            >
              <option value="">-- Select a bus --</option>
              {inventory.map(bus => (
                <option key={bus.inventory_id} value={bus.inventory_id}>
                  {bus.stock_number} - {bus.year} {bus.make} {bus.model} ({bus.current_location})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
              Sale Price <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.sale_price}
              onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
              placeholder="50000"
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
              Currency <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              required
              value={formData.sale_currency}
              onChange={(e) => setFormData({ ...formData, sale_currency: e.target.value })}
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
              Sale Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              required
              value={formData.sale_date}
              onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
              Client (Optional)
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            >
              <option value="">-- Select client (optional) --</option>
              {clients.map(client => (
                <option key={client.client_id} value={client.client_id}>
                  {client.client_name} {client.client_company ? `- ${client.client_company}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
              Notes (Optional)
            </label>
            <textarea
              value={formData.sale_notes}
              onChange={(e) => setFormData({ ...formData, sale_notes: e.target.value })}
              rows="3"
              placeholder="Additional sale information..."
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

        <div style={{
          padding: '1rem',
          background: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
            ℹ️ What happens when you record this sale:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#1e40af' }}>
            <li>Bus will be marked as SOLD in inventory</li>
            <li>Revenue entry created in accounting (Credit: Revenue, Debit: AR)</li>
            <li>COGS entry created (calculated from all costs)</li>
            <li>Accounts Receivable created for full sale amount</li>
            <li>Ready to record payments in "Manage Sales" tab</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: saving ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.3)'
          }}
        >
          {saving ? '⏳ Recording Sale...' : '💰 Record Sale'}
        </button>
      </form>
    </div>
  );
};

// ============= MANAGE SALES (LIST WITH PAYMENTS) =============
const ManageSales = ({ soldBuses, accounts, onPaymentRecorded, onViewDetails }) => {
  const [selectedBus, setSelectedBus] = React.useState(null);
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);

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

  if (soldBuses.length === 0) {
    return (
      <div style={{
        padding: '3rem',
        background: 'white',
        borderRadius: '0.75rem',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem' }}>
          No Sales Recorded Yet
        </div>
        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
          Record your first sale in the "Record Sale" tab.
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{
        padding: '1.5rem',
        background: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
          Sold Buses ({soldBuses.length})
        </h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {soldBuses.map(bus => (
            <div
              key={bus.inventory_id}
              style={{
                padding: '1.25rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                background: '#f9fafb'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '1.125rem', marginBottom: '0.5rem', color: '#111827' }}>
                    {bus.year} {bus.make} {bus.model}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    <div>📋 Stock: <strong>{bus.stock_number}</strong></div>
                    <div>📅 Sold: <strong>{formatDate(bus.sale_date)}</strong></div>
                    <div>💰 Price: <strong style={{ color: '#10b981' }}>{formatCurrency(bus.sale_price, bus.sale_currency)}</strong></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  <button
                    onClick={() => onViewDetails(bus)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📊 Details
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBus(bus);
                      setShowPaymentForm(true);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    💵 Add Payment
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedBus && (
        <PaymentFormModal
          bus={selectedBus}
          accounts={accounts}
          onClose={() => {
            setShowPaymentForm(false);
            setSelectedBus(null);
          }}
          onPaymentRecorded={() => {
            setShowPaymentForm(false);
            setSelectedBus(null);
            onPaymentRecorded();
          }}
        />
      )}
    </>
  );
};

// ============= PAYMENT FORM MODAL =============
const PaymentFormModal = ({ bus, accounts, onClose, onPaymentRecorded }) => {
  const [formData, setFormData] = React.useState({
    payment_amount: '',
    payment_currency: bus.sale_currency || 'USD',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Wire Transfer',
    payment_type: 'Payment',
    payment_account_id: '',
    payment_notes: ''
  });
  const [saving, setSaving] = React.useState(false);

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/sales/${bus.inventory_id}/payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          payment_amount: parseFloat(formData.payment_amount)
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.message}`);
        onPaymentRecorded();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to record payment'}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
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
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '0.75rem',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
            💵 Record Payment
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        {/* Bus Info */}
        <div style={{
          padding: '1rem 1.5rem',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ fontWeight: '600', color: '#111827' }}>
            {bus.stock_number} - {bus.year} {bus.make} {bus.model}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Sale Currency: {bus.sale_currency}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Payment Amount <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                placeholder="10000"
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Bank Account (Receiving Payment) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                required
                value={formData.payment_account_id}
                onChange={(e) => setFormData({ ...formData, payment_account_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              >
                <option value="">-- Select bank account --</option>
                {accounts.map(account => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                  Payment Date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                  Payment Type
                </label>
                <select
                  value={formData.payment_type}
                  onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  <option value="Deposit">Deposit</option>
                  <option value="Payment">Payment</option>
                  <option value="Partial Payment">Partial Payment</option>
                  <option value="Final Payment">Final Payment</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
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

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Notes (Optional)
              </label>
              <textarea
                value={formData.payment_notes}
                onChange={(e) => setFormData({ ...formData, payment_notes: e.target.value })}
                rows="2"
                placeholder="Payment reference or notes..."
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

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: saving ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '700',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Recording...' : '💰 Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============= SALE DETAILS MODAL =============
const SaleDetailsModal = ({ bus, onClose, onPaymentAdded, accounts }) => {
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState(null);
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);
  const [showImportButton, setShowImportButton] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/sales/${bus.inventory_id}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
        
        // Check if there are payments without accounting entries
        if (data.payments && data.payments.length > 0 && !data.sale_recorded_in_accounting) {
          setShowImportButton(true);
        }
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportPayments = async () => {
    if (!confirm('Import existing payments into accounting? This will create accounting entries for all payments.')) {
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/sales/${bus.inventory_id}/import-payments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.message}`);
        loadSummary();
        onPaymentAdded();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to import payments'}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setImporting(false);
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

  if (loading) {
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
        zIndex: 1000
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '0.75rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <div>Loading sale details...</div>
        </div>
      </div>
    );
  }

  if (!summary || !summary.sale || !summary.sale.is_sold) {
  return null;
}

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
        borderRadius: '0.75rem',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10
        }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
            📊 Sale Details - {summary.stock_number}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Financial Summary */}
          <div style={{
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
              Financial Summary
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Sale Price</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                  {formatCurrency(summary.sale_price, summary.currency)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>COGS</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#6b7280' }}>
                  {formatCurrency(summary.cogs, summary.currency)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Gross Profit</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: summary.gross_profit >= 0 ? '#10b981' : '#dc2626' }}>
                  {formatCurrency(summary.gross_profit, summary.currency)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Profit Margin</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: summary.gross_profit_margin >= 10 ? '#10b981' : '#f59e0b' }}>
                  {summary.gross_profit_margin.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div style={{
            padding: '1.5rem',
            background: summary.payment_status === 'Paid in Full' ? '#d1fae5' : '#fef3c7',
            border: `1px solid ${summary.payment_status === 'Paid in Full' ? '#10b981' : '#f59e0b'}`,
            borderRadius: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
                Payment Status
              </h4>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: '700',
                background: summary.payment_status === 'Paid in Full' ? '#065f46' : '#92400e',
                color: 'white'
              }}>
                {summary.payment_status}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Total Paid</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
                  {formatCurrency(summary.total_payments_received, summary.currency)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>AR Balance</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', color: summary.ar_balance > 0 ? '#dc2626' : '#10b981' }}>
                  {formatCurrency(summary.ar_balance, summary.currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Import Button (if needed) */}
          {showImportButton && (
            <div style={{
              padding: '1rem',
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.5rem' }}>
                ⚠️ Payments Not in Accounting
              </div>
              <div style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '1rem' }}>
                This sale has {summary.payment_count} payment(s) that haven't been recorded in the accounting system yet.
              </div>
              <button
                onClick={handleImportPayments}
                disabled={importing}
                style={{
                  padding: '0.5rem 1rem',
                  background: importing ? '#9ca3af' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: importing ? 'not-allowed' : 'pointer'
                }}
              >
                {importing ? '⏳ Importing...' : '📥 Import Payments to Accounting'}
              </button>
            </div>
          )}

          {/* Payment History */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
                Payment History ({summary.payment_count})
              </h4>
              {summary.ar_balance > 0 && (
                <button
                  onClick={() => setShowPaymentForm(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Add Payment
                </button>
              )}
            </div>

            {summary.payments.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                color: '#6b7280'
              }}>
                No payments recorded yet
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {summary.payments.map(payment => (
                  <div
                    key={payment.payment_id}
                    style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827' }}>
                          {formatDate(payment.payment_date)} - {payment.payment_type}
                        </div>
                        {payment.payment_method && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            Method: {payment.payment_method}
                          </div>
                        )}
                        {payment.reference_number && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            Ref: {payment.reference_number}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#10b981' }}>
                        {formatCurrency(payment.payment_amount, payment.payment_currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client Info */}
          {summary.client && (
            <div style={{
              padding: '1rem',
              background: '#eff6ff',
              border: '1px solid #3b82f6',
              borderRadius: '0.5rem',
              marginTop: '1.5rem'
            }}>
              <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
                👤 Client Information
              </div>
              <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                <div>{summary.client.client_name}</div>
                {summary.client.client_email && <div>📧 {summary.client.client_email}</div>}
                {summary.client.client_phone && <div>📱 {summary.client.client_phone}</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form Modal (nested) */}
      {showPaymentForm && (
        <PaymentFormModal
          bus={bus}
          accounts={accounts}
          onClose={() => setShowPaymentForm(false)}
          onPaymentRecorded={() => {
            setShowPaymentForm(false);
            loadSummary();
            onPaymentAdded();
          }}
        />
      )}
    </div>
  );
};

// Export for standalone use
window.SalesManagement = SalesManagement;
