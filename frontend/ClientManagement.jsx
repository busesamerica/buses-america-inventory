// ClientManagement.jsx - Professional Client Database Module
// Full CRUD with analytics, search, and purchase history

const ClientManagement = () => {
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState(null);
  const [includeAnalytics, setIncludeAnalytics] = React.useState(true);
  
  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    loadClients();
  }, [includeAnalytics]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/clients?include_analytics=${includeAnalytics}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setClients(await response.json());
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.tax_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ background: '#f9fafb' }}>
      {/* Action Bar */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search clients by name, company, location, or tax ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: '1 1 300px',
            padding: '0.75rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem'
          }}
        />

        {/* Toggle Analytics */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          color: '#374151',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={includeAnalytics}
            onChange={(e) => setIncludeAnalytics(e.target.checked)}
          />
          Show Analytics
        </label>

        {/* Create Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#F59E0B',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          + New Client
        </button>
      </div>

      {/* Stats Cards (if analytics enabled) */}
      {includeAnalytics && clients.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: '0.75rem',
            color: 'white',
            boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Clients</div>
            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{clients.length}</div>
          </div>
          
          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '0.75rem',
            color: 'white',
            boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Active Buyers</div>
            <div style={{ fontSize: '2rem', fontWeight: '800' }}>
              {clients.filter(c => c.total_purchases > 0).length}
            </div>
          </div>
          
          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '0.75rem',
            color: 'white',
            boxShadow: '0 4px 6px rgba(245, 158, 11, 0.3)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Purchases</div>
            <div style={{ fontSize: '2rem', fontWeight: '800' }}>
              {clients.reduce((sum, c) => sum + (c.total_purchases || 0), 0)}
            </div>
          </div>
        </div>
      )}

      {/* Client List */}
      <div style={{
        background: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <div>Loading clients...</div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              {searchTerm ? 'No clients found' : 'No clients yet'}
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {searchTerm ? 'Try a different search term' : 'Create your first client to get started'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Client</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Contact</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Location</th>
                  {includeAnalytics && (
                    <>
                      <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Purchases</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Total Spent</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Reliability</th>
                    </>
                  )}
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client, idx) => (
                  <tr
                    key={client.client_id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: idx % 2 === 0 ? 'white' : '#f9fafb',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setSelectedClient(client);
                      setShowDetailModal(true);
                    }}
                  >
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                        {client.client_name}
                      </div>
                      {client.client_company && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {client.client_company}
                        </div>
                      )}
                      {client.tax_id && (
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                          RFC: {client.tax_id}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {client.contact_person && (
                        <div>{client.contact_person}</div>
                      )}
                      {client.client_phone && (
                        <div>📱 {client.client_phone}</div>
                      )}
                      {client.client_email && (
                        <div>📧 {client.client_email}</div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {client.client_location}
                    </td>
                    {includeAnalytics && (
                      <>
                        <td style={{ padding: '1rem', textAlign: 'center', fontSize: '1.125rem', fontWeight: '700', color: '#3b82f6' }}>
                          {client.total_purchases || 0}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem' }}>
                          {client.total_spent_usd > 0 && (
                            <div style={{ color: '#10b981', fontWeight: '600' }}>
                              {formatCurrency(client.total_spent_usd, 'USD')}
                            </div>
                          )}
                          {client.total_spent_mxn > 0 && (
                            <div style={{ color: '#8b5cf6', fontWeight: '600' }}>
                              {formatCurrency(client.total_spent_mxn, 'MXN')}
                            </div>
                          )}
                          {!client.total_spent_usd && !client.total_spent_mxn && (
                            <div style={{ color: '#9ca3af' }}>—</div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            background: client.payment_reliability === 'Excellent' ? '#d1fae5' :
                                       client.payment_reliability === 'Good' ? '#dbeafe' :
                                       client.payment_reliability === 'Fair' ? '#fef3c7' :
                                       client.payment_reliability === 'Poor' ? '#fee2e2' : '#f3f4f6',
                            color: client.payment_reliability === 'Excellent' ? '#065f46' :
                                  client.payment_reliability === 'Good' ? '#1e40af' :
                                  client.payment_reliability === 'Fair' ? '#92400e' :
                                  client.payment_reliability === 'Poor' ? '#991b1b' : '#6b7280'
                          }}>
                            {client.payment_reliability || 'Not Rated'}
                          </span>
                        </td>
                      </>
                    )}
                    <td style={{ padding: '1rem' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setShowEditModal(true);
                          }}
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ClientFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false);
            loadClients();
          }}
        />
      )}

      {showEditModal && selectedClient && (
        <ClientFormModal
          client={selectedClient}
          onClose={() => {
            setShowEditModal(false);
            setSelectedClient(null);
          }}
          onSave={() => {
            setShowEditModal(false);
            setSelectedClient(null);
            loadClients();
          }}
        />
      )}

      {showDetailModal && selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedClient(null);
          }}
          onEdit={() => {
            setShowDetailModal(false);
            setShowEditModal(true);
          }}
        />
      )}
    </div>
  );
};

// Export
window.ClientManagement = ClientManagement;
