// ProfitDistributionModal.jsx - Calculate and record profit distributions

const ProfitDistributionModal = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = React.useState(1); // 1: Select Bus, 2: Review & Confirm
  const [soldBuses, setSoldBuses] = React.useState([]);
  const [selectedBus, setSelectedBus] = React.useState(null);
  const [calculation, setCalculation] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [distributionDate, setDistributionDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState('');
  const [accounts, setAccounts] = React.useState([]);
  const [erickPaymentAccountId, setErickPaymentAccountId] = React.useState('');
  const [omarPaymentAccountId, setOmarPaymentAccountId] = React.useState('');

  const API_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : 'https://buses-america.onrender.com/api';

  React.useEffect(() => {
    if (isOpen) {
      loadSoldBuses();
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.filter(a => ['Bank', 'Cash'].includes(a.account_subtype) && a.is_active));
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadSoldBuses = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const [invResponse, distResponse] = await Promise.all([
        fetch(`${API_URL}/inventory`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/accounting/profit-distributions`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (invResponse.ok) {
        const data = await invResponse.json();
        const distributions = distResponse.ok ? await distResponse.json() : [];
        const distributedIds = new Set(distributions.map(d => d.inventory_id));
        const sold = data.filter(bus => bus.is_sold === true && !distributedIds.has(bus.inventory_id));
        setSoldBuses(sold);
      }
    } catch (error) {
      console.error('Error loading sold buses:', error);
    }
  };

  const calculateProfit = async (inventoryId) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/profit-distribution/calculate?inventory_id=${inventoryId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to calculate profit');

      const data = await response.json();
      setCalculation(data);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to calculate profit');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBus = (bus) => {
    setSelectedBus(bus);
    calculateProfit(bus.inventory_id);
  };

  const recordDistribution = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/accounting/profit-distribution`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          distribution_date: distributionDate,
          inventory_id: selectedBus.inventory_id,
          total_profit: calculation.profit,
          currency: calculation.currency,
          erick_percentage: 60,
          omar_percentage: 40,
          notes: notes,
          erick_payment_account_id: erickPaymentAccountId ? parseInt(erickPaymentAccountId) : null,
          omar_payment_account_id: omarPaymentAccountId ? parseInt(omarPaymentAccountId) : null
        })
      });

      if (!response.ok) throw new Error('Failed to record distribution');

      // Success!
      onComplete && onComplete();
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to record distribution');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedBus(null);
    setCalculation(null);
    setNotes('');
    setError('');
    setErickPaymentAccountId('');
    setOmarPaymentAccountId('');
    onClose();
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount && amount !== 0) return currency === 'USD' ? '$0.00' : 'MXN $0.00';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    const prefix = currency === 'USD' ? '$' : 'MXN $';
    return amount < 0 ? `(${prefix}${formatted})` : `${prefix}${formatted}`;
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
        maxWidth: step === 1 ? '800px' : '600px',
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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
            💸 Profit Distribution
          </h2>
          <button
            onClick={handleClose}
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

        {/* Error Message */}
        {error && (
          <div style={{
            margin: '1rem 1.5rem',
            padding: '1rem',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#991b1b'
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Select Bus */}
        {step === 1 && (
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
              Select a Sold Bus
            </h3>
            
            {soldBuses.length === 0 ? (
              <div style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</div>
                <div>No sold buses found</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {soldBuses.map((bus) => (
                  <div
                    key={bus.inventory_id}
                    onClick={() => !loading && handleSelectBus(bus)}
                    style={{
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      cursor: loading ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: loading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.borderColor = '#3b82f6')}
                    onMouseLeave={(e) => !loading && (e.currentTarget.style.borderColor = '#e5e7eb')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1.125rem', color: '#111827' }}>
                          {bus.stock_number}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {bus.year} {bus.make} {bus.model}
                        </div>
                        {bus.client_name && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            👤 {bus.client_name}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                          {formatCurrency(bus.sale_price, bus.sale_currency)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {bus.payment_status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review & Confirm */}
        {step === 2 && calculation && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontWeight: '700', fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                {calculation.stock_number}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {selectedBus?.year} {selectedBus?.make} {selectedBus?.model}
              </div>
            </div>

            {/* Profit Calculation */}
            <div style={{
              padding: '1.5rem',
              background: 'white',
              border: '2px solid #3b82f6',
              borderRadius: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#1e40af' }}>
                📊 Profit Calculation
              </h4>
              
              <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sale Price:</span>
                  <span style={{ fontWeight: '600' }}>
                    {formatCurrency(calculation.sale_price, calculation.currency)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Costs:</span>
                  <span style={{ fontWeight: '600', color: '#dc2626' }}>
                    {formatCurrency(calculation.total_cost, calculation.currency)}
                  </span>
                </div>
                <div style={{
                  paddingTop: '0.75rem',
                  marginTop: '0.75rem',
                  borderTop: '2px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontWeight: '700' }}>Net Profit:</span>
                  <span style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: calculation.profit >= 0 ? '#10b981' : '#dc2626'
                  }}>
                    {formatCurrency(calculation.profit, calculation.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Distribution */}
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '2px solid #86efac',
              borderRadius: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#047857' }}>
                💰 Distribution (60% / 40%)
              </h4>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  background: 'white',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#111827' }}>Erick (60%)</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Partner Distribution</div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                    {formatCurrency(calculation.distributions.erick.amount, calculation.currency)}
                  </div>
                </div>

                <div style={{
                  padding: '1rem',
                  background: 'white',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#111827' }}>Omar (40%)</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Partner Distribution</div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                    {formatCurrency(calculation.distributions.omar.amount, calculation.currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* Payout Accounts */}
            <div style={{
              padding: '1.5rem',
              background: '#f9fafb',
              borderRadius: '0.75rem',
              marginBottom: '1.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#374151' }}>
                🏦 Payout Accounts
              </h4>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Pay Erick from: *
                  </label>
                  <select
                    value={erickPaymentAccountId}
                    onChange={(e) => setErickPaymentAccountId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">-- Select account --</option>
                    {accounts.map(a => (
                      <option key={a.account_id} value={a.account_id}>
                        {a.account_name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    Pay Omar from: *
                  </label>
                  <select
                    value={omarPaymentAccountId}
                    onChange={(e) => setOmarPaymentAccountId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">-- Select account --</option>
                    {accounts.map(a => (
                      <option key={a.account_id} value={a.account_id}>
                        {a.account_name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Distribution Details */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                Distribution Date
              </label>
              <input
                type="date"
                value={distributionDate}
                onChange={(e) => setDistributionDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this distribution..."
                rows="3"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep(1)}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
              >
                ← Back
              </button>
              <button
                onClick={recordDistribution}
                disabled={loading || calculation.profit <= 0 || !erickPaymentAccountId || !omarPaymentAccountId}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (calculation.profit <= 0 || !erickPaymentAccountId || !omarPaymentAccountId) ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: (loading || calculation.profit <= 0 || !erickPaymentAccountId || !omarPaymentAccountId) ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
              >
                {loading ? 'Recording...' : '✅ Record Distribution'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Export for use
window.ProfitDistributionModal = ProfitDistributionModal;
