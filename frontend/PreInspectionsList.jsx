

const PreInspectionsList = ({ onViewReport, onCreateInventory }) => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, approved, rejected, conditional, purchased
  const [searchVIN, setSearchVIN] = useState('');

  useEffect(() => {
    loadInspections();
  }, [filter]);

  const loadInspections = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${window.API_URL}/api/pre-inspections`;
      
      const params = new URLSearchParams();
      if (filter === 'approved') params.append('recommendation', 'Approve');
      if (filter === 'rejected') params.append('recommendation', 'Reject');
      if (filter === 'conditional') params.append('recommendation', 'Conditional');
      if (filter === 'purchased') params.append('purchased', 'true');
      if (filter === 'not-purchased') params.append('purchased', 'false');
      
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInspections(data);
      }
    } catch (error) {
      console.error('Error loading inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getBadgeStyle = (recommendation) => {
    const styles = {
      'Approve': { background: '#10b981', color: 'white', icon: '✅' },
      'Reject': { background: '#ef4444', color: 'white', icon: '❌' },
      'Conditional': { background: '#f59e0b', color: 'white', icon: '⚠️' }
    };
    return styles[recommendation] || { background: '#6b7280', color: 'white', icon: '❓' };
  };

  const filteredInspections = inspections.filter(insp => {
    if (!searchVIN) return true;
    return insp.vin.toLowerCase().includes(searchVIN.toLowerCase()) ||
           (insp.make && insp.make.toLowerCase().includes(searchVIN.toLowerCase())) ||
           (insp.model && insp.model.toLowerCase().includes(searchVIN.toLowerCase()));
  });

  const stats = {
    total: inspections.length,
    approved: inspections.filter(i => i.recommendation === 'Approve' && !i.purchased).length,
    rejected: inspections.filter(i => i.recommendation === 'Reject').length,
    purchased: inspections.filter(i => i.purchased).length
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <div style={{ fontSize: '1.25rem', color: '#6b7280' }}>Loading inspections...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
          🔍 Pre-Purchase Inspections
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          Manage all vehicle inspections before purchase
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Inspections</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{stats.total}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Ready to Buy</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{stats.approved}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Rejected</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{stats.rejected}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Purchased</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{stats.purchased}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ 
        background: 'white', 
        padding: '1.5rem', 
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <input
              type="text"
              placeholder="🔍 Search by VIN, make, or model..."
              value={searchVIN}
              onChange={(e) => setSearchVIN(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { value: 'all', label: 'All', icon: '📋' },
              { value: 'approved', label: 'Approved', icon: '✅' },
              { value: 'rejected', label: 'Rejected', icon: '❌' },
              { value: 'conditional', label: 'Conditional', icon: '⚠️' },
              { value: 'purchased', label: 'Purchased', icon: '🛒' }
            ].map(btn => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value)}
                style={{
                  padding: '0.75rem 1rem',
                  background: filter === btn.value ? '#FFD700' : 'white',
                  color: filter === btn.value ? '#1a1a1a' : '#6b7280',
                  border: '2px solid',
                  borderColor: filter === btn.value ? '#FFD700' : '#e5e7eb',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inspections List */}
      {filteredInspections.length === 0 ? (
        <div style={{
          background: 'white',
          padding: '4rem',
          borderRadius: '0.75rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
            No inspections found
          </div>
          <div style={{ color: '#6b7280' }}>
            {searchVIN ? 'Try a different search term' : 'Start by creating a new pre-inspection'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredInspections.map(inspection => {
            const badgeStyle = getBadgeStyle(inspection.recommendation);
            
            return (
              <div
                key={inspection.inspection_id}
                style={{
                  background: 'white',
                  borderRadius: '0.75rem',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  padding: '1.5rem',
                  border: '2px solid #e5e7eb',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#FFD700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'center' }}>
                  {/* Main Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '2rem', alignItems: 'center' }}>
                    {/* Vehicle Info */}
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.25rem' }}>
                        {inspection.year} {inspection.make} {inspection.model}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', fontFamily: 'monospace' }}>
                        VIN: {inspection.vin}
                      </div>
                      {inspection.odometer && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          📊 {inspection.odometer.toLocaleString()} miles
                        </div>
                      )}
                    </div>

                    {/* Inspection Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Inspected
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          {formatDate(inspection.inspection_date)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Inspector
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          {inspection.inspector_name || 'N/A'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Overall Rating
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          {inspection.overall_rating || 'N/A'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Repair Estimate
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          {formatCurrency(inspection.estimated_repair_cost_usd)}
                        </div>
                      </div>
                    </div>

                    {/* Location & Seller */}
                    {(inspection.inspection_location || inspection.seller_asking_price) && (
                      <div>
                        {inspection.inspection_location && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                            📍 {inspection.inspection_location}
                          </div>
                        )}
                        {inspection.seller_asking_price && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            💰 Asking: {formatCurrency(inspection.seller_asking_price)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recommendation Badge */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        fontWeight: '700',
                        fontSize: '1rem',
                        whiteSpace: 'nowrap',
                        ...badgeStyle
                      }}>
                        {badgeStyle.icon} {inspection.recommendation}
                      </div>

                      {inspection.purchased && (
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          ✓ Purchased
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReport(inspection);
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}
                    >
                      📄 View Report
                    </button>

                    {inspection.recommendation === 'Approve' && !inspection.purchased && onCreateInventory && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateInventory(inspection);
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.875rem'
                        }}
                      >
                        ➕ Create Inventory
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

window.PreInspectionsList = PreInspectionsList;
