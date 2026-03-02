"""
Helper function to generate inspection summary for inventory notes
Priority 2: Auto-generate inspection summary
"""

def generate_inspection_summary(inspection_data):
    """
    Generate a formatted inspection summary from inspection data
    This will be auto-inserted into inventory internal_notes
    """
    
    summary = f"""
═══════════════════════════════════════════════════════════
PRE-PURCHASE INSPECTION SUMMARY
═══════════════════════════════════════════════════════════

Inspection Date: {inspection_data.get('inspection_date', 'N/A')}
Inspector: {inspection_data.get('inspector_name', 'N/A')}
Location: {inspection_data.get('inspection_location', 'N/A')}

───────────────────────────────────────────────────────────
VEHICLE INFORMATION
───────────────────────────────────────────────────────────
VIN: {inspection_data.get('vin', 'N/A')}
{inspection_data.get('year', 'N/A')} {inspection_data.get('make', 'N/A')} {inspection_data.get('model', 'N/A')}
Odometer: {inspection_data.get('odometer', 'N/A'):,} {inspection_data.get('odometer_unit', 'miles')}
Capacity: {inspection_data.get('passenger_capacity', 'N/A')} passengers

───────────────────────────────────────────────────────────
INSPECTION RESULTS
───────────────────────────────────────────────────────────

ENGINE: {inspection_data.get('engine_condition', 'N/A')}
  • Starts: {'✓ Yes' if inspection_data.get('engine_starts') else '✗ No'}
  • Oil: {inspection_data.get('engine_oil_condition', 'N/A')}
  • Coolant: {inspection_data.get('engine_coolant_condition', 'N/A')}
  • Leaks: {'⚠ Yes' if inspection_data.get('engine_leaks') else '✓ No'}
  • Noise Issues: {'⚠ Yes' if inspection_data.get('engine_noise') else '✓ No'}
  {f"  Notes: {inspection_data.get('engine_notes')}" if inspection_data.get('engine_notes') else ''}

TRANSMISSION: {inspection_data.get('transmission_condition', 'N/A')}
  • Shifts Properly: {'✓ Yes' if inspection_data.get('transmission_shifts_properly') else '✗ No'}
  • Fluid: {inspection_data.get('transmission_fluid_condition', 'N/A')}
  • Leaks: {'⚠ Yes' if inspection_data.get('transmission_leaks') else '✓ No'}
  {f"  Notes: {inspection_data.get('transmission_notes')}" if inspection_data.get('transmission_notes') else ''}

SUSPENSION & STEERING: {inspection_data.get('suspension_condition', 'N/A')}
  • Steering: {inspection_data.get('steering_condition', 'N/A')}
  • Alignment: {'✓ OK' if inspection_data.get('alignment_ok') else '✗ Needs Work'}
  {f"  Notes: {inspection_data.get('suspension_notes')}" if inspection_data.get('suspension_notes') else ''}

CHASSIS & BODY: {inspection_data.get('chassis_condition', 'N/A')}
  • Body: {inspection_data.get('body_condition', 'N/A')}
  • Rust: {'⚠ Yes (' + inspection_data.get('rust_severity', 'N/A') + ')' if inspection_data.get('rust_present') else '✓ No'}
  • Structural Damage: {'⚠ Yes' if inspection_data.get('structural_damage') else '✓ No'}
  {f"  Notes: {inspection_data.get('chassis_notes')}" if inspection_data.get('chassis_notes') else ''}

BRAKES: {inspection_data.get('brake_condition', 'N/A')}
  • Pad Life: {inspection_data.get('brake_pads_percentage', 'N/A')}%
  • Lines: {inspection_data.get('brake_lines_condition', 'N/A')}
  {f"  Notes: {inspection_data.get('brake_notes')}" if inspection_data.get('brake_notes') else ''}

ELECTRICAL: {inspection_data.get('electrical_system_condition', 'N/A')}
  • Lights: {'✓ Working' if inspection_data.get('lights_working') else '✗ Not Working'}
  • Battery: {inspection_data.get('battery_condition', 'N/A')}
  • Alternator: {'✓ Working' if inspection_data.get('alternator_working') else '✗ Not Working'}
  {f"  Notes: {inspection_data.get('electrical_notes')}" if inspection_data.get('electrical_notes') else ''}

INTERIOR: {inspection_data.get('interior_condition', 'N/A')}
  • Seats: {inspection_data.get('seats_condition', 'N/A')}
  • Floor: {inspection_data.get('floor_condition', 'N/A')}
  {f"  Notes: {inspection_data.get('interior_notes')}" if inspection_data.get('interior_notes') else ''}

ROAD TEST: {'✓ Performed' if inspection_data.get('road_test_performed') else '✗ Not Performed'}
  {f"  Notes: {inspection_data.get('road_test_notes')}" if inspection_data.get('road_test_notes') else ''}

───────────────────────────────────────────────────────────
OVERALL ASSESSMENT
───────────────────────────────────────────────────────────

Overall Rating: {inspection_data.get('overall_rating', 'N/A')}
Recommendation: {inspection_data.get('recommendation', 'N/A')}
Estimated Repair Cost: ${inspection_data.get('estimated_repair_cost_usd', 0):,.2f} USD

{f"Inspector Notes: {inspection_data.get('inspector_notes')}" if inspection_data.get('inspector_notes') else ''}

# Handle asking price with None check
asking_price = inspection_data.get('seller_asking_price')
asking_price_str = f"${asking_price:,.2f} USD" if asking_price is not None else "Not provided"

summary_parts.append(f"""
───────────────────────────────────────────────────────────
SELLER INFORMATION
───────────────────────────────────────────────────────────
Seller: {inspection_data.get('seller_name', 'N/A')}
Asking Price: {asking_price_str}
Contact: {inspection_data.get('seller_contact', 'N/A')}
═══════════════════════════════════════════════════════════
""")
    
    return summary.strip()


def calculate_pre_fill_data(inspection):
    """
    Extract data from inspection to pre-fill inventory form
    Priority 1: Auto-fill inventory form
    """
    
    # Determine condition based on overall rating
    condition_map = {
        'Excellent': 'Excellent',
        'Good': 'Good',
        'Fair': 'Fair',
        'Poor': 'Needs Major Work'
    }
    
    pre_fill = {
        # Direct transfers
        'vin': inspection.get('vin'),
        'year': inspection.get('year'),
        'make': inspection.get('make'),
        'model': inspection.get('model'),
        'odometer': inspection.get('odometer'),
        'passenger_capacity': inspection.get('passenger_capacity'),
        'wheelchair_capacity': inspection.get('wheelchair_capacity'),
        'engine_make': inspection.get('engine_make'),
        'engine_model': inspection.get('engine_model'),
        'engine_type': inspection.get('engine_type'),
        'transmission': inspection.get('transmission'),
        'fuel_type': inspection.get('fuel_type'),
        'gvwr': inspection.get('gvwr'),
        'length_feet': inspection.get('length_feet'),
        'exterior_color': inspection.get('exterior_color'),
        'interior_color': inspection.get('interior_color'),
        'title_status': inspection.get('title_status'),
        
        # Calculated/derived
        'condition': condition_map.get(inspection.get('overall_rating'), 'Used'),
        'reconditioning_cost_usd': inspection.get('estimated_repair_cost_usd', 0),
        
        # Acquisition info
        'acquisition_location': inspection.get('inspection_location'),
        
        # Reference to inspection
        'pre_inspection_id': inspection.get('inspection_id'),
        
        # Auto-generated inspection summary (Priority 2)
        'internal_notes': generate_inspection_summary(inspection)
    }
    
    return pre_fill

