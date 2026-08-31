// ClientModals.jsx - Form and Detail Modals for Client Management

// ============= CLIENT FORM MODAL (Create/Edit) =============
const ClientFormModal = ({ client, onClose, onSave }) => {
  const [formData, setFormData] = React.useState({
    client_name: client?.client_name || '',
    client_company: client?.client_company || '',
    client_location: client?.client_location || '',
    client_use_case: client?.client_use_case || '',
    client_phone: client?.client_phone || '',
    client_email: client?.client_email || '',
    billing_address: client?.billing_address || '',
    tax_id: client?.tax_id || '',
    contact_person: client?.contact_person || '',
    notes: client?.notes || '',
    credit_terms: client?.credit_terms || '',
    payment_reliability: client?.payment_reliability || 'Not Rated',
    preferred_payment_method: client?.preferred_payment_method || ''
  });
  const [saving, setSaving] = React.useState(false);
  
  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const token = localStorage.getItem('session_token');
      const url = client 
        ? `${API_URL}/clients/${client.client_id}`
        : `${API_URL}/clients`;
      
      const response = await fetch(url, {
        method: client ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Client ${client ? 'updated' : 'created'} successfully!`);
        onSave(data);
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to save client'}`);
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
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '0.75rem',
        maxWidth: '800px',
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
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
            {client ? '✏️ Edit Client' : '➕ New Client'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            
            {/* Basic Information */}
            <div>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                Basic Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Client Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="Juan Pérez"
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
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.client_company}
                    onChange={(e) => setFormData({ ...formData, client_company: e.target.value })}
                    placeholder="Transportes del Norte S.A."
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
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="María González (CFO)"
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
                    Tax ID (RFC)
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value.toUpperCase() })}
                    placeholder="ABC123456XYZ"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Use Case
                  </label>
                  <select
                    value={formData.client_use_case}
                    onChange={(e) => setFormData({ ...formData, client_use_case: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">-- Select use case --</option>
                    <option value="Transporte de Personal">Transporte de Personal</option>
                    <option value="Transporte Escolar">Transporte Escolar</option>
                    <option value="Turismo">Turismo</option>
                    <option value="Servicio Público">Servicio Público</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                Contact Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    placeholder="+52 899 123 4567"
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
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    placeholder="contacto@empresa.com"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.client_location}
                    onChange={(e) => setFormData({ ...formData, client_location: e.target.value })}
                    placeholder="Reynosa, Tamaulipas, Mexico"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Billing Address
                  </label>
                  <textarea
                    value={formData.billing_address}
                    onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                    placeholder="Calle Principal #123, Col. Centro, CP 88000, Reynosa, Tamps."
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
              </div>
            </div>

            {/* Business Terms */}
            <div>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                Business Terms
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Payment Reliability
                  </label>
                  <select
                    value={formData.payment_reliability}
                    onChange={(e) => setFormData({ ...formData, payment_reliability: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="Not Rated">Not Rated</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Preferred Payment Method
                  </label>
                  <select
                    value={formData.preferred_payment_method}
                    onChange={(e) => setFormData({ ...formData, preferred_payment_method: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">-- Select method --</option>
                    <option value="Wire Transfer">Wire Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Check">Check</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Credit Terms
                  </label>
                  <input
                    type="text"
                    value={formData.credit_terms}
                    onChange={(e) => setFormData({ ...formData, credit_terms: e.target.value })}
                    placeholder="Net 30 days, 50% deposit required"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this client..."
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
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
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
                fontSize: '1rem',
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
                fontSize: '1rem',
                fontWeight: '700',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.3)'
              }}
            >
              {saving ? '⏳ Saving...' : client ? '💾 Update Client' : '➕ Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============= CLIENT DETAIL MODAL =============
const ClientDetailModal = ({ client, onClose, onEdit }) => {
  const [details, setDetails] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  
  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/clients/${client.client_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setDetails(await response.json());
      }
    } catch (error) {
      console.error('Error loading client details:', error);
    } finally {
      setLoading(false);
    }
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
          <div>Loading client details...</div>
        </div>
      </div>
    );
  }

  if (!details) return null;

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
        maxWidth: '900px',
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
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
              {details.client.client_name}
            </h3>
            {details.client.client_company && (
              <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
                {details.client.client_company}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={onEdit}
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
              ✏️ Edit
            </button>
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
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Analytics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              borderRadius: '0.75rem',
              color: 'white'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Purchases</div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{details.analytics.total_purchases}</div>
            </div>
            
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '0.75rem',
              color: 'white'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Spent (USD)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(details.analytics.total_spent_usd, 'USD')}</div>
            </div>
            
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '0.75rem',
              color: 'white'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Spent (MXN)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(details.analytics.total_spent_mxn, 'MXN')}</div>
            </div>
          </div>

          {/* Client Information */}
          <div style={{
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
              Client Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              {details.client.contact_person && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Contact Person</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{details.client.contact_person}</div>
                </div>
              )}
              {details.client.tax_id && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Tax ID (RFC)</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{details.client.tax_id}</div>
                </div>
              )}
              {details.client.client_phone && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Phone</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{details.client.client_phone}</div>
                </div>
              )}
              {details.client.client_email && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Email</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{details.client.client_email}</div>
                </div>
              )}
              {details.client.client_location && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Location</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{details.client.client_location}</div>
                </div>
              )}
              {details.client.billing_address && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Billing Address</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{details.client.billing_address}</div>
                </div>
              )}
              {details.client.payment_reliability && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Payment Reliability</div>
                  <div>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: details.client.payment_reliability === 'Excellent' ? '#d1fae5' :
                                 details.client.payment_reliability === 'Good' ? '#dbeafe' :
                                 details.client.payment_reliability === 'Fair' ? '#fef3c7' :
                                 details.client.payment_reliability === 'Poor' ? '#fee2e2' : '#f3f4f6',
                      color: details.client.payment_reliability === 'Excellent' ? '#065f46' :
                            details.client.payment_reliability === 'Good' ? '#1e40af' :
                            details.client.payment_reliability === 'Fair' ? '#92400e' :
                            details.client.payment_reliability === 'Poor' ? '#991b1b' : '#6b7280'
                    }}>
                      {details.client.payment_reliability}
                    </span>
                  </div>
                </div>
              )}
              {details.analytics.favorite_bus_type && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Favorite Bus Type</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{details.analytics.favorite_bus_type}</div>
                </div>
              )}
            </div>
          </div>

          {/* Purchase History */}
          <div>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
              Purchase History ({details.purchase_history.length})
            </h4>
            {details.purchase_history.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                color: '#6b7280'
              }}>
                No purchases yet
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {details.purchase_history.map(purchase => (
                  <div
                    key={purchase.inventory_id}
                    style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                          {purchase.year} {purchase.make} {purchase.model}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          Stock: {purchase.stock_number} • {formatDate(purchase.sale_date)}
                        </div>
                        {purchase.body_style && (
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                            {purchase.body_style}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#10b981' }}>
                          {formatCurrency(purchase.sale_price, purchase.sale_currency)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {purchase.payment_status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Export
window.ClientFormModal = ClientFormModal;
window.ClientDetailModal = ClientDetailModal;
