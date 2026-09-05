// DistributionHistoryModal.jsx - View all profit distributions

const DistributionHistoryModal = ({ isOpen, onClose }) => {
  const isMobile = useIsMobile();
  const [distributions, setDistributions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    if (isOpen) {
      loadDistributions();
    }
  }, [isOpen]);

  const loadDistributions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/profit-distributions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDistributions(data);
      }
    } catch (error) {
      console.error('Error loading distributions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
            📊 Distribution History
          </h2>
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Loading distributions...
            </div>
          ) : distributions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No distributions recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {distributions.map((dist) => (
                <div
                  key={dist.distribution_id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '1.25rem',
                    background: '#f9fafb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        {formatDate(dist.distribution_date)}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                        {formatCurrency(dist.total_profit, dist.currency)}
                      </div>
                      {dist.stock_number && (
                        <div style={{ fontSize: '0.875rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                          Bus: {dist.stock_number}
                        </div>
                      )}
                    </div>
                    {dist.reference_number && (
                      <div style={{
                        padding: '0.5rem 1rem',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        fontFamily: 'monospace'
                      }}>
                        {dist.reference_number}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                      padding: '1rem',
                      background: 'white',
                      borderRadius: '0.375rem',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        ERICK ({dist.erick_percentage}%)
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#059669' }}>
                        {formatCurrency(dist.erick_amount, dist.currency)}
                      </div>
                    </div>

                    <div style={{
                      padding: '1rem',
                      background: 'white',
                      borderRadius: '0.375rem',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        OMAR ({dist.omar_percentage}%)
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#7c3aed' }}>
                        {formatCurrency(dist.omar_amount, dist.currency)}
                      </div>
                    </div>
                  </div>

                  {dist.notes && (
                    <div style={{
                      padding: '0.75rem',
                      background: '#fff7ed',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: '#78350f',
                      borderLeft: '3px solid #f59e0b'
                    }}>
                      <strong>Note:</strong> {dist.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - distributions can be a mix of USD-sale and MXN-sale
            payouts, so summing erick_amount/omar_amount across all of them
            and labeling the total with distributions[0].currency would add
            raw USD and MXN numbers together and tag the result with
            whichever currency happened to come first. Split by currency
            instead, same as every other cross-currency total in this app. */}
        {distributions.length > 0 && (() => {
          const sumByCurrency = (field) => distributions.reduce((totals, d) => {
            const cur = d.currency || 'USD';
            totals[cur] = (totals[cur] || 0) + parseFloat(d[field] || 0);
            return totals;
          }, {});
          const erickTotals = sumByCurrency('erick_amount');
          const omarTotals = sumByCurrency('omar_amount');
          const renderTotals = (totals) => Object.keys(totals).length === 0
            ? formatCurrency(0, 'USD')
            : Object.entries(totals).map(([cur, amt]) => formatCurrency(amt, cur)).join(' + ');

          return (
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb',
              position: 'sticky',
              bottom: 0
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr 1fr', gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    NUMBER OF DISTRIBUTIONS
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                    {distributions.length}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    ERICK TOTAL
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#059669' }}>
                    {renderTotals(erickTotals)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    OMAR TOTAL
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#7c3aed' }}>
                    {renderTotals(omarTotals)}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

window.DistributionHistoryModal = DistributionHistoryModal;
