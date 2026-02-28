const PreInspectionReport = ({ inspection, onClose, onCreateInventory }) => {
  if (!inspection) return null;

  // Print styles
React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          size: auto;
          margin: 15mm;
        }
        body {
          margin: 0;
        }
        .modal-backdrop {
          position: static !important;
          background: white !important;
          padding: 0 !important;
        }
        #inspection-report {
          position: static !important;
          max-height: none !important;
          max-width: 100% !important;
          overflow: visible !important;
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        #inspection-content {
          max-height: none !important;
          overflow: visible !important;
          flex: none !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getBadgeStyle = (rating) => {
    const styles = {
      'Excellent': { background: '#10b981', color: 'white' },
      'Good': { background: '#3b82f6', color: 'white' },
      'Fair': { background: '#f59e0b', color: 'white' },
      'Poor': { background: '#ef4444', color: 'white' },
      'Failed': { background: '#7f1d1d', color: 'white' }
    };
    return styles[rating] || { background: '#6b7280', color: 'white' };
  };

  const getRecommendationStyle = (recommendation) => {
    const styles = {
      'Approve': { background: '#10b981', color: 'white', icon: '✅' },
      'Reject': { background: '#ef4444', color: 'white', icon: '❌' },
      'Conditional': { background: '#f59e0b', color: 'white', icon: '⚠️' }
    };
    return styles[recommendation] || { background: '#6b7280', color: 'white', icon: '❓' };
  };

  const StatusIcon = ({ value }) => {
    if (value === true) return <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>;
    if (value === false) return <span style={{ color: '#ef4444', fontSize: '1.2rem' }}>✗</span>;
    return <span style={{ color: '#9ca3af' }}>—</span>;
  };

  const Section = ({ title, icon, children }) => (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ 
        fontSize: '1.25rem', 
        fontWeight: '700', 
        color: '#1f2937', 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '3px solid #FFD700',
        paddingBottom: '0.5rem'
      }}>
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );

  const InfoRow = ({ label, value, highlight }) => (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '200px 1fr', 
      gap: '1rem',
      padding: '0.75rem',
      background: highlight ? '#fef3c7' : 'transparent',
      borderRadius: '0.375rem',
      marginBottom: '0.5rem'
    }}>
      <div style={{ fontWeight: '600', color: '#6b7280' }}>{label}:</div>
      <div style={{ fontWeight: highlight ? '700' : '400', color: '#1f2937' }}>{value || '—'}</div>
    </div>
  );

  const InspectionItem = ({ label, condition, boolValue, notes }) => (
    <div style={{ 
      background: '#f9fafb', 
      padding: '1rem', 
      borderRadius: '0.5rem', 
      marginBottom: '1rem',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: '600', color: '#374151' }}>{label}</div>
        {condition && (
          <span style={{ 
            padding: '0.25rem 0.75rem', 
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            ...getBadgeStyle(condition)
          }}>
            {condition}
          </span>
        )}
        {boolValue !== undefined && boolValue !== null && (
          <StatusIcon value={boolValue} />
        )}
      </div>
      {notes && (
        <div style={{ 
          fontSize: '0.875rem', 
          color: '#6b7280',
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #e5e7eb',
          fontStyle: 'italic'
        }}>
          {notes}
        </div>
      )}
    </div>
  );

  const recommendationStyle = getRecommendationStyle(inspection.recommendation);

  return (
    <div className="modal-backdrop" style={{
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
      padding: '1rem',
      overflowY: 'auto'
    }}>
      <div id="inspection-report" style={{
        background: 'white',
        borderRadius: '1rem',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        margin: '2rem auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          borderRadius: '1rem 1rem 0 0',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#FFD700', fontWeight: '700' }}>
                  🔍 Pre-Purchase Inspection Report
                </h2>
                <span style={{ 
                  padding: '0.5rem 1rem', 
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '700',
                  ...recommendationStyle
                }}>
                  {recommendationStyle.icon} {inspection.recommendation}
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#FFD700' }}>
                {inspection.year} {inspection.make} {inspection.model}
              </div>
              <div style={{ fontSize: '1rem', color: '#d1d5db', marginTop: '0.5rem' }}>
                VIN: {inspection.vin}
              </div>
            </div>
            <div className="no-print" style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => window.print()}
                style={{
                  background: '#FFD700',
                  border: 'none',
                  color: '#1a1a1a',
                  fontSize: '0.9rem',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '700',
                  whiteSpace: 'nowrap'
                }}
              >
                🖨️ Print
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  fontSize: '1.5rem',
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '1rem',
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '0.5rem'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#d1d5db', textTransform: 'uppercase' }}>Inspection Date</div>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginTop: '0.25rem' }}>
                {formatDate(inspection.inspection_date)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#d1d5db', textTransform: 'uppercase' }}>Inspector</div>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginTop: '0.25rem' }}>
                {inspection.inspector_name || 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#d1d5db', textTransform: 'uppercase' }}>Overall Rating</div>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginTop: '0.25rem' }}>
                {inspection.overall_rating || 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#d1d5db', textTransform: 'uppercase' }}>Repair Estimate</div>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginTop: '0.25rem' }}>
                {formatCurrency(inspection.estimated_repair_cost_usd)}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div id="inspection-content" style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          
          {/* Basic Information */}
          <Section title="Vehicle Information" icon="🚌">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              <InfoRow label="Year/Make/Model" value={`${inspection.year} ${inspection.make} ${inspection.model}`} highlight />
              <InfoRow label="VIN" value={inspection.vin} highlight />
              <InfoRow label="Odometer" value={inspection.odometer ? `${inspection.odometer.toLocaleString()} ${inspection.odometer_unit || 'miles'}` : 'N/A'} />
              <InfoRow label="Passenger Capacity" value={inspection.passenger_capacity} />
              <InfoRow label="Engine" value={inspection.engine_make && inspection.engine_model ? `${inspection.engine_make} ${inspection.engine_model}` : 'N/A'} />
              <InfoRow label="Transmission" value={inspection.transmission} />
              <InfoRow label="Fuel Type" value={inspection.fuel_type} />
              <InfoRow label="GVWR" value={inspection.gvwr ? `${inspection.gvwr.toLocaleString()} lbs` : 'N/A'} />
              <InfoRow label="Exterior Color" value={inspection.exterior_color} />
              <InfoRow label="Interior Color" value={inspection.interior_color} />
              <InfoRow label="Title Status" value={inspection.title_status} />
            </div>
          </Section>

          {/* Seller Information */}
          {(inspection.inspection_location || inspection.seller_name) && (
            <Section title="Seller & Location" icon="📍">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <InfoRow label="Location" value={inspection.inspection_location} />
                <InfoRow label="Seller" value={inspection.seller_name} />
                <InfoRow label="Asking Price" value={formatCurrency(inspection.seller_asking_price)} highlight />
                <InfoRow label="Contact" value={inspection.seller_contact} />
              </div>
            </Section>
          )}

          {/* Engine */}
          <Section title="Engine Inspection" icon="🔧">
            <InspectionItem 
              label="Engine Condition"
              condition={inspection.engine_condition}
              notes={inspection.engine_notes}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Engine Starts</span>
                  <StatusIcon value={inspection.engine_starts} />
                </div>
              </div>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Oil: {inspection.engine_oil_condition || 'N/A'}</span>
                </div>
              </div>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Coolant: {inspection.engine_coolant_condition || 'N/A'}</span>
                </div>
              </div>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Leaks Present</span>
                  <StatusIcon value={inspection.engine_leaks} />
                </div>
              </div>
            </div>
          </Section>

          {/* Transmission */}
          <Section title="Transmission" icon="⚙️">
            <InspectionItem 
              label="Transmission Condition"
              condition={inspection.transmission_condition}
              notes={inspection.transmission_notes}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Shifts Properly</span>
                  <StatusIcon value={inspection.transmission_shifts_properly} />
                </div>
              </div>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Fluid: {inspection.transmission_fluid_condition || 'N/A'}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Suspension & Steering */}
          <Section title="Suspension & Steering" icon="🚗">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <InspectionItem 
                label="Suspension"
                condition={inspection.suspension_condition}
              />
              <InspectionItem 
                label="Steering"
                condition={inspection.steering_condition}
              />
            </div>
            {inspection.suspension_notes && (
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                  {inspection.suspension_notes}
                </div>
              </div>
            )}
          </Section>

          {/* Chassis & Body */}
          <Section title="Chassis & Body" icon="🏗️">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <InspectionItem 
                label="Chassis"
                condition={inspection.chassis_condition}
              />
              <InspectionItem 
                label="Body"
                condition={inspection.body_condition}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: inspection.rust_present ? '#fef3c7' : '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Rust Present</span>
                  <StatusIcon value={inspection.rust_present} />
                </div>
                {inspection.rust_present && inspection.rust_severity && (
                  <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '0.25rem', fontWeight: '600' }}>
                    Severity: {inspection.rust_severity}
                  </div>
                )}
              </div>
              <div style={{ background: inspection.structural_damage ? '#fee2e2' : '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Structural Damage</span>
                  <StatusIcon value={inspection.structural_damage} />
                </div>
              </div>
            </div>
            {inspection.chassis_notes && (
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                  {inspection.chassis_notes}
                </div>
              </div>
            )}
          </Section>

          {/* Brakes */}
          <Section title="Brakes" icon="🛑">
            <InspectionItem 
              label="Brake System"
              condition={inspection.brake_condition}
              notes={inspection.brake_notes}
            />
            {inspection.brake_pads_percentage !== null && inspection.brake_pads_percentage !== undefined && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Brake Pads Life Remaining</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1f2937' }}>{inspection.brake_pads_percentage}%</span>
                </div>
                <div style={{ width: '100%', height: '1.5rem', background: '#e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${inspection.brake_pads_percentage}%`, 
                    height: '100%', 
                    background: inspection.brake_pads_percentage > 50 ? '#10b981' : inspection.brake_pads_percentage > 25 ? '#f59e0b' : '#ef4444',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
            )}
          </Section>

          {/* Electrical */}
          <Section title="Electrical System" icon="⚡">
            <InspectionItem 
              label="Electrical System"
              condition={inspection.electrical_system_condition}
              notes={inspection.electrical_notes}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Lights Working</span>
                  <StatusIcon value={inspection.lights_working} />
                </div>
              </div>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Battery: {inspection.battery_condition || 'N/A'}</span>
                </div>
              </div>
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Alternator Working</span>
                  <StatusIcon value={inspection.alternator_working} />
                </div>
              </div>
            </div>
          </Section>

          {/* Interior */}
          <Section title="Interior" icon="🪑">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <InspectionItem 
                label="Overall Interior"
                condition={inspection.interior_condition}
              />
              <InspectionItem 
                label="Seats"
                condition={inspection.seats_condition}
              />
              <InspectionItem 
                label="Floor"
                condition={inspection.floor_condition}
              />
            </div>
            {inspection.interior_notes && (
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                  {inspection.interior_notes}
                </div>
              </div>
            )}
          </Section>

          {/* Road Test */}
          {inspection.road_test_performed && (
            <Section title="Road Test" icon="🛣️">
              <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '0.5rem', border: '2px solid #10b981' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>✓</span>
                  <span style={{ fontWeight: '600', color: '#065f46', fontSize: '1.125rem' }}>Road Test Completed</span>
                </div>
                {inspection.road_test_notes && (
                  <div style={{ fontSize: '0.875rem', color: '#065f46', marginTop: '0.5rem' }}>
                    {inspection.road_test_notes}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Overall Assessment */}
          <Section title="Overall Assessment" icon="📊">
            <div style={{ 
              background: recommendationStyle.background,
              color: recommendationStyle.color,
              padding: '2rem',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.5rem' }}>
                    Overall Rating
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                    {inspection.overall_rating}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.5rem' }}>
                    Recommendation
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{recommendationStyle.icon}</span>
                    {inspection.recommendation}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.5rem' }}>
                    Estimated Repairs
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                    {formatCurrency(inspection.estimated_repair_cost_usd)}
                  </div>
                </div>
              </div>

              {inspection.inspector_notes && (
                <div style={{ 
                  background: 'rgba(0,0,0,0.1)', 
                  padding: '1rem', 
                  borderRadius: '0.5rem',
                  marginTop: '1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.5rem' }}>
                    Inspector Notes
                  </div>
                  <div style={{ fontSize: '1rem', lineHeight: '1.6' }}>
                    {inspection.inspector_notes}
                  </div>
                </div>
              )}

              {inspection.seller_asking_price && inspection.estimated_repair_cost_usd && (
                <div style={{ 
                  background: 'rgba(0,0,0,0.1)', 
                  padding: '1rem', 
                  borderRadius: '0.5rem',
                  marginTop: '1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.5rem' }}>
                    Estimated Net Value
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                    {formatCurrency(parseFloat(inspection.seller_asking_price) - parseFloat(inspection.estimated_repair_cost_usd))}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                    (Asking Price - Repair Estimate)
                  </div>
                </div>
              )}
            </div>
          </Section>

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '2px solid #e5e7eb',
          background: '#f9fafb',
          borderRadius: '0 0 1rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#374151',
              border: '2px solid #e5e7eb',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            Close
          </button>

          {inspection.recommendation === 'Approve' && !inspection.purchased && onCreateInventory && (
            <button
              onClick={() => onCreateInventory(inspection)}
              style={{
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '1rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            >
              ✅ Create Inventory from This Inspection
            </button>
          )}

          {inspection.purchased && (
            <div style={{
              padding: '0.75rem 1.5rem',
              background: '#e0e7ff',
              color: '#3730a3',
              borderRadius: '0.5rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>✓</span> Already Purchased
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.PreInspectionReport = PreInspectionReport;
