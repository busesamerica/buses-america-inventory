"""
Helper function to generate inspection summary for inventory notes
Priority 2: Auto-generate inspection summary
"""

def generate_inspection_summary(inspection_data):
    """
    Generate a formatted inspection summary from inspection data
    This will be auto-inserted into inventory internal_notes
    """
    
    # Handle asking price with None check
    asking_price = inspection_data.get('seller_asking_price')
    asking_price_str = f"${asking_price:,.2f} USD" if asking_price is not None else "Not provided"
    
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
SELLER INFORMATION
───────────────────────────────────────────────────────────
Seller: {inspection_data.get('seller_name', 'N/A')}
Asking Price: {asking_price_str}
Contact: {inspection_data.get('seller_contact', 'N/A')}

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
  • Structural Damage
