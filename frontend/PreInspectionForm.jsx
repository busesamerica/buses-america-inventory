import React, { useState } from 'react';

const PreInspectionForm = ({ onClose, onSave, initialData = null }) => {
  const [formData, setFormData] = useState(initialData || {
    // Section 1: Basic Information
    vin: '',
    year: '',
    make: '',
    model: '',
    odometer: '',
    odometer_unit: 'miles',
    passenger_capacity: '',
    wheelchair_capacity: '',
    engine_make: '',
    engine_model: '',
    engine_type: '',
    transmission: '',
    fuel_type: '',
    gvwr: '',
    length_feet: '',
    exterior_color: '',
    interior_color: '',
    title_status: '',
    
    // NEW: Additional Vehicle Details
    body_style: '',
    brake_system: '',
    air_conditioning: null,
    heater: null,
    seat_belts: '',
    emergency_exits: '',
    fire_extinguisher: null,
    first_aid_kit: null,
    ada_compliant: null,
    wheelchair_lift_ramp: '',
    
    // Section 2: Location & Source
    inspection_location: '',
    seller_name: '',
    seller_asking_price: '',
    seller_contact: '',
    
    // Section 3: Inspection Date
    inspection_date: new Date().toISOString().split('T')[0],
    inspector_name: '',
    
    // Engine
    engine_condition: '',
    engine_starts: null,
    engine_oil_condition: '',
    engine_coolant_condition: '',
    engine_leaks: null,
    engine_noise: null,
    engine_notes: '',
    
    // Transmission
    transmission_condition: '',
    transmission_shifts_properly: null,
    transmission_fluid_condition: '',
    transmission_leaks: null,
    transmission_notes: '',
    
    // Suspension & Steering
    suspension_condition: '',
    steering_condition: '',
    alignment_ok: null,
    suspension_notes: '',
    
    // Chassis & Body
    chassis_condition: '',
    body_condition: '',
    rust_present: null,
    rust_severity: '',
    structural_damage: null,
    chassis_notes: '',
    
    // Brakes
    brake_condition: '',
    brake_pads_percentage: '',
    brake_lines_condition: '',
    brake_notes: '',
    
    // Electrical
    electrical_system_condition: '',
    lights_working: null,
    battery_condition: '',
    alternator_working: null,
    electrical_notes: '',
    
    // Interior
    interior_condition: '',
    seats_condition: '',
    floor_condition: '',
    interior_notes: '',
    
    // Road Test
    road_test_performed: null,
    road_test_notes: '',
    
    // Overall
    overall_rating: '',
    recommendation: '',
    estimated_repair_cost_usd: '',
    inspector_notes: ''
  });

  const [currentSection, setCurrentSection] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBooleanChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 0, title: '📋 Basic Information', icon: '📋' },
    { id: 1, title: '📍 Location & Source', icon: '📍' },
    { id: 2, title: '🔧 Engine', icon: '🔧' },
    { id: 3, title: '⚙️ Transmission', icon: '⚙️' },
    { id: 4, title: '🚗 Suspension & Steering', icon: '🚗' },
    { id: 5, title: '🏗️ Chassis & Body', icon: '🏗️' },
    { id: 6, title: '🛑 Brakes', icon: '🛑' },
    { id: 7, title: '⚡ Electrical', icon: '⚡' },
    { id: 8, title: '🪑 Interior', icon: '🪑' },
    { id: 9, title: '🛣️ Road Test', icon: '🛣️' },
    { id: 10, title: '📊 Overall Assessment', icon: '📊' }
  ];

  const conditionOptions = ['Excellent', 'Good', 'Fair', 'Poor', 'Failed'];
  const fluidConditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];
  const titleStatuses = ['Clean', 'Salvage', 'Rebuilt', 'Pending'];
  const engineTypes = ['Diesel', 'Gasoline', 'CNG', 'Electric', 'Hybrid'];
  const fuelTypes = ['Diesel', 'Gasoline', 'CNG', 'Electric', 'Hybrid', 'Propane'];
  const rustSeverities = ['None', 'Light', 'Moderate', 'Severe'];
  const recommendations = ['Approve', 'Reject', 'Conditional'];
  const overallRatings = ['Excellent', 'Good', 'Fair', 'Poor'];

  const BooleanToggle = ({ label, name, value }) => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => handleBooleanChange(name, true)}
          style={{
            padding: '0.5rem 1rem',
            border: '2px solid',
            borderColor: value === true ? '#10b981' : '#d1d5db',
            background: value === true ? '#10b981' : 'white',
            color: value === true ? 'white' : '#374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '500',
            flex: 1
          }}
        >
          ✓ Yes
        </button>
        <button
          type="button"
          onClick={() => handleBooleanChange(name, false)}
          style={{
            padding: '0.5rem 1rem',
            border: '2px solid',
            borderColor: value === false ? '#ef4444' : '#d1d5db',
            background: value === false ? '#ef4444' : 'white',
            color: value === false ? 'white' : '#374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '500',
            flex: 1
          }}
        >
          ✗ No
        </button>
      </div>
    </div>
  );

  const renderSection = () => {
    switch(currentSection) {
      case 0: // Basic Information
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1f2937' }}>
                VIN *
              </label>
              <input
                type="text"
                name="vin"
                value={formData.vin}
                onChange={handleChange}
                required
                maxLength={17}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
                placeholder="1HGBH41JXMN109186"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Year</label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="2015"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Make</label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="International"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Model</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="CE"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Odometer</label>
              <input
                type="number"
                name="odometer"
                value={formData.odometer}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="150000"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Passenger Capacity</label>
              <input
                type="number"
                name="passenger_capacity"
                value={formData.passenger_capacity}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="72"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Wheelchair Capacity</label>
              <input
                type="number"
                name="wheelchair_capacity"
                value={formData.wheelchair_capacity}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="0"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Engine Make</label>
              <input
                type="text"
                name="engine_make"
                value={formData.engine_make}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Cummins"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Engine Model</label>
              <input
                type="text"
                name="engine_model"
                value={formData.engine_model}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="ISB 6.7"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Engine Type</label>
              <select
                name="engine_type"
                value={formData.engine_type}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {engineTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Transmission</label>
              <input
                type="text"
                name="transmission"
                value={formData.transmission}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Allison Automatic"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Fuel Type</label>
              <select
                name="fuel_type"
                value={formData.fuel_type}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {fuelTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>GVWR (lbs)</label>
              <input
                type="number"
                name="gvwr"
                value={formData.gvwr}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="33000"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Length (feet)</label>
              <input
                type="number"
                step="0.1"
                name="length_feet"
                value={formData.length_feet}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="35.0"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Exterior Color</label>
              <input
                type="text"
                name="exterior_color"
                value={formData.exterior_color}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Yellow"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Interior Color</label>
              <input
                type="text"
                name="interior_color"
                value={formData.interior_color}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Gray"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Title Status</label>
              <select
                name="title_status"
                value={formData.title_status}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {titleStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>

            {/* NEW FIELDS */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Body Style</label>
              <select
                name="body_style"
                value={formData.body_style}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="Type A School Bus">Type A School Bus</option>
                <option value="Type B School Bus">Type B School Bus</option>
                <option value="Type C School Bus">Type C School Bus</option>
                <option value="Type D School Bus">Type D School Bus</option>
                <option value="Transit Bus">Transit Bus</option>
                <option value="Shuttle Bus">Shuttle Bus</option>
                <option value="Coach Bus">Coach Bus</option>
                <option value="Mini Bus">Mini Bus</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Brake System</label>
              <select
                name="brake_system"
                value={formData.brake_system}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="Air Brakes">Air Brakes</option>
                <option value="Hydraulic Brakes">Hydraulic Brakes</option>
                <option value="Air-Over-Hydraulic">Air-Over-Hydraulic</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Air Conditioning</label>
              <select
                name="air_conditioning"
                value={formData.air_conditioning === null ? '' : formData.air_conditioning}
                onChange={(e) => setFormData({...formData, air_conditioning: e.target.value === '' ? null : e.target.value === 'true'})}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Heater</label>
              <select
                name="heater"
                value={formData.heater === null ? '' : formData.heater}
                onChange={(e) => setFormData({...formData, heater: e.target.value === '' ? null : e.target.value === 'true'})}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Seat Belts (quantity)</label>
              <input
                type="number"
                name="seat_belts"
                value={formData.seat_belts}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="40"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Emergency Exits (quantity)</label>
              <input
                type="number"
                name="emergency_exits"
                value={formData.emergency_exits}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="3"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Fire Extinguisher</label>
              <select
                name="fire_extinguisher"
                value={formData.fire_extinguisher === null ? '' : formData.fire_extinguisher}
                onChange={(e) => setFormData({...formData, fire_extinguisher: e.target.value === '' ? null : e.target.value === 'true'})}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>First Aid Kit</label>
              <select
                name="first_aid_kit"
                value={formData.first_aid_kit === null ? '' : formData.first_aid_kit}
                onChange={(e) => setFormData({...formData, first_aid_kit: e.target.value === '' ? null : e.target.value === 'true'})}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>ADA Compliant</label>
              <select
                name="ada_compliant"
                value={formData.ada_compliant === null ? '' : formData.ada_compliant}
                onChange={(e) => setFormData({...formData, ada_compliant: e.target.value === '' ? null : e.target.value === 'true'})}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Wheelchair Lift/Ramp</label>
              <select
                name="wheelchair_lift_ramp"
                value={formData.wheelchair_lift_ramp}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                <option value="None">None</option>
                <option value="Wheelchair Lift">Wheelchair Lift</option>
                <option value="Wheelchair Ramp">Wheelchair Ramp</option>
                <option value="Both">Both Lift & Ramp</option>
              </select>
            </div>
          </div>
        );

      case 1: // Location & Source
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Inspection Location</label>
              <input
                type="text"
                name="inspection_location"
                value={formData.inspection_location}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Midwest Bus Auction - Columbus, OH"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Seller Name</label>
              <input
                type="text"
                name="seller_name"
                value={formData.seller_name}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="School District ABC"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Seller Asking Price (USD)</label>
              <input
                type="number"
                step="0.01"
                name="seller_asking_price"
                value={formData.seller_asking_price}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="15000"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Seller Contact</label>
              <input
                type="text"
                name="seller_contact"
                value={formData.seller_contact}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="John Smith - (555) 123-4567"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1f2937' }}>
                Inspection Date *
              </label>
              <input
                type="date"
                name="inspection_date"
                value={formData.inspection_date}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Inspector Name</label>
              <input
                type="text"
                name="inspector_name"
                value={formData.inspector_name}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Your Name"
              />
            </div>
          </div>
        );

      case 2: // Engine
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Engine Condition</label>
              <select
                name="engine_condition"
                value={formData.engine_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Engine Starts" name="engine_starts" value={formData.engine_starts} />

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Engine Oil Condition</label>
              <select
                name="engine_oil_condition"
                value={formData.engine_oil_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {fluidConditions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Engine Coolant Condition</label>
              <select
                name="engine_coolant_condition"
                value={formData.engine_coolant_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {fluidConditions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Engine Leaks Present" name="engine_leaks" value={formData.engine_leaks} />
            <BooleanToggle label="Engine Noise Issues" name="engine_noise" value={formData.engine_noise} />

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Engine Notes</label>
              <textarea
                name="engine_notes"
                value={formData.engine_notes}
                onChange={handleChange}
                rows={4}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Additional notes about engine condition..."
              />
            </div>
          </div>
        );

      case 3: // Transmission
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Transmission Condition</label>
              <select
                name="transmission_condition"
                value={formData.transmission_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Shifts Properly" name="transmission_shifts_properly" value={formData.transmission_shifts_properly} />

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Transmission Fluid Condition</label>
              <select
                name="transmission_fluid_condition"
                value={formData.transmission_fluid_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {fluidConditions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Transmission Leaks Present" name="transmission_leaks" value={formData.transmission_leaks} />

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Transmission Notes</label>
              <textarea
                name="transmission_notes"
                value={formData.transmission_notes}
                onChange={handleChange}
                rows={4}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Additional notes about transmission..."
              />
            </div>
          </div>
        );

      case 4: // Suspension & Steering
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Suspension Condition</label>
              <select
                name="suspension_condition"
                value={formData.suspension_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Steering Condition</label>
              <select
                name="steering_condition"
                value={formData.steering_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Alignment OK" name="alignment_ok" value={formData.alignment_ok} />

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Suspension Notes</label>
              <textarea
                name="suspension_notes"
                value={formData.suspension_notes}
                onChange={handleChange}
                rows={4}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        );

      case 5: // Chassis & Body
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Chassis Condition</label>
              <select
                name="chassis_condition"
                value={formData.chassis_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Body Condition</label>
              <select
                name="body_condition"
                value={formData.body_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Rust Present" name="rust_present" value={formData.rust_present} />

            {formData.rust_present && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Rust Severity</label>
                <select
                  name="rust_severity"
                  value={formData.rust_severity}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                >
                  <option value="">Select...</option>
                  {rustSeverities.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}

            <BooleanToggle label="Structural Damage" name="structural_damage" value={formData.structural_damage} />

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Chassis Notes</label>
              <textarea
                name="chassis_notes"
                value={formData.chassis_notes}
                onChange={handleChange}
                rows={4}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        );

      case 6: // Brakes
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Brake Condition</label>
              <select
                name="brake_condition"
                value={formData.brake_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Brake Pads Percentage (0-100%)</label>
              <input
                type="number"
                name="brake_pads_percentage"
                value={formData.brake_pads_percentage}
                onChange={handleChange}
                min="0"
                max="100"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="75"
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Brake Lines Condition</label>
              <select
                name="brake_lines_condition"
                value={formData.brake_lines_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Brake Notes</label>
              <textarea
                name="brake_notes"
                value={formData.brake_notes}
                onChange={handleChange}
                rows={4}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        );

      case 7: // Electrical
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Electrical System Condition</label>
              <select
                name="electrical_system_condition"
                value={formData.electrical_system_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Lights Working" name="lights_working" value={formData.lights_working} />

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Battery Condition</label>
              <select
                name="battery_condition"
                value={formData.battery_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <BooleanToggle label="Alternator Working" name="alternator_working" value={formData.alternator_working} />

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Electrical Notes</label>
              <textarea
                name="electrical_notes"
                value={formData.electrical_notes}
                onChange={handleChange}
                rows={4}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        );

      case 8: // Interior
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Interior Condition</label>
              <select
                name="interior_condition"
                value={formData.interior_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Seats Condition</label>
              <select
                name="seats_condition"
                value={formData.seats_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Floor Condition</label>
              <select
                name="floor_condition"
                value={formData.floor_condition}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              >
                <option value="">Select...</option>
                {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Interior Notes</label>
              <textarea
                name="interior_notes"
                value={formData.interior_notes}
                onChange={handleChange}
                rows={4}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        );

      case 9: // Road Test
        return (
          <div>
            <BooleanToggle label="Road Test Performed" name="road_test_performed" value={formData.road_test_performed} />

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Road Test Notes</label>
              <textarea
                name="road_test_notes"
                value={formData.road_test_notes}
                onChange={handleChange}
                rows={6}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Performance, handling, unusual noises, shifting quality, braking effectiveness, etc..."
              />
            </div>
          </div>
        );

      case 10: // Overall Assessment
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1f2937' }}>
                Overall Rating *
              </label>
              <select
                name="overall_rating"
                value={formData.overall_rating}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem' }}
              >
                <option value="">Select...</option>
                {overallRatings.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1f2937' }}>
                Recommendation *
              </label>
              <select
                name="recommendation"
                value={formData.recommendation}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem' }}
              >
                <option value="">Select...</option>
                {recommendations.map(opt => (
                  <option key={opt} value={opt}>
                    {opt === 'Approve' ? '✅ Approve' : opt === 'Reject' ? '❌ Reject' : '⚠️ Conditional'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Estimated Repair Cost (USD)
              </label>
              <input
                type="number"
                step="0.01"
                name="estimated_repair_cost_usd"
                value={formData.estimated_repair_cost_usd}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="1200.00"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Inspector Notes</label>
              <textarea
                name="inspector_notes"
                value={formData.inspector_notes}
                onChange={handleChange}
                rows={6}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                placeholder="Overall assessment, concerns, recommendations for purchase decision..."
              />
            </div>
          </div>
        );

      default:
        return null;
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
        borderRadius: '1rem',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '2px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#FFD700', fontWeight: '700' }}>
            🔍 Pre-Purchase Inspection
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'white',
              padding: '0.5rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', overflowX: 'auto' }}>
            {sections.map((section, idx) => (
              <button
                key={section.id}
                onClick={() => setCurrentSection(idx)}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  background: currentSection === idx ? '#FFD700' : currentSection > idx ? '#10b981' : '#e5e7eb',
                  color: currentSection === idx ? '#1a1a1a' : currentSection > idx ? 'white' : '#6b7280',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {section.icon}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
            Section {currentSection + 1} of {sections.length}: {sections[currentSection].title}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {renderSection()}
        </form>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: '2px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          background: '#f9fafb'
        }}>
          <button
            type="button"
            onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
            disabled={currentSection === 0}
            style={{
              padding: '0.75rem 1.5rem',
              background: currentSection === 0 ? '#e5e7eb' : 'white',
              color: currentSection === 0 ? '#9ca3af' : '#374151',
              border: '2px solid #e5e7eb',
              borderRadius: '0.5rem',
              cursor: currentSection === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600'
            }}
          >
            ← Previous
          </button>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#374151',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>

            {currentSection < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentSection(currentSection + 1)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#FFD700',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: saving ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '700'
                }}
              >
                {saving ? '💾 Saving...' : '✅ Save Inspection'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreInspectionForm;
