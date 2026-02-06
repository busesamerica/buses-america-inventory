"""
Buses America - Sample Data Generator
Creates realistic data showing buses through complete workflow
"""

import asyncpg
import asyncio
from datetime import date, timedelta
from decimal import Decimal

DATABASE_URL = "postgresql://user:password@localhost/buses_america"

# Sample Suppliers
suppliers = [
    {
        'company_name': 'Midwest Bus Auction',
        'contact_person': 'John Smith',
        'email': 'jsmith@mwbusauction.com',
        'phone': '555-0101',
        'city': 'Dallas',
        'state': 'TX',
        'supplier_type': 'Auction',
        'payment_terms': 'Wire Transfer Same Day',
        'country': 'USA'
    },
    {
        'company_name': 'Texas School District Fleet',
        'contact_person': 'Sarah Johnson',
        'email': 'sjohnson@txschools.edu',
        'phone': '555-0102',
        'city': 'Houston',
        'state': 'TX',
        'supplier_type': 'Trade-in',
        'payment_terms': 'Check on Pickup',
        'country': 'USA'
    },
    {
        'company_name': 'Arizona Public Schools',
        'contact_person': 'Mike Davis',
        'email': 'mdavis@azschools.edu',
        'phone': '555-0103',
        'city': 'Phoenix',
        'state': 'AZ',
        'supplier_type': 'Trade-in',
        'payment_terms': 'Wire Transfer',
        'country': 'USA'
    },
    {
        'company_name': 'Blue Bird Certified Pre-Owned',
        'contact_person': 'Lisa Martinez',
        'email': 'lmartinez@bluebird.com',
        'phone': '555-0104',
        'city': 'Fort Worth',
        'state': 'TX',
        'supplier_type': 'Dealer',
        'payment_terms': 'Net 15',
        'country': 'USA'
    }
]

# Pre-Purchase Inspections (some approved, some rejected)
pre_inspections = [
    {
        'vin': '1FDEE3FL9KDC12345',
        'stock_number_temp': 'INSPECT-001',
        'year': 2019,
        'make': 'Blue Bird',
        'model': 'Vision',
        'odometer': 45000,
        'inspection_date': date.today() - timedelta(days=90),
        'inspector_name': 'Carlos Rodriguez',
        'inspection_location': 'Midwest Bus Auction - Dallas',
        'engine_condition': 'Good',
        'engine_starts': True,
        'engine_oil_condition': 'Good',
        'engine_coolant_condition': 'Good',
        'engine_leaks': False,
        'engine_noise': False,
        'engine_notes': 'Cummins ISB 6.7L runs smoothly, no issues detected',
        'transmission_condition': 'Good',
        'transmission_shifts_properly': True,
        'transmission_fluid_condition': 'Good',
        'transmission_leaks': False,
        'transmission_notes': 'Allison 2500, shifts well through all gears',
        'suspension_condition': 'Good',
        'steering_condition': 'Good',
        'chassis_condition': 'Good',
        'body_condition': 'Good',
        'rust_present': True,
        'rust_severity': 'Minor',
        'brake_condition': 'Good',
        'brake_pads_percentage': 70,
        'electrical_system_condition': 'Good',
        'interior_condition': 'Good',
        'seats_condition': 'Good',
        'road_test_performed': True,
        'road_test_notes': 'Drives straight, brakes evenly, no unusual noises',
        'overall_rating': 'Good',
        'recommendation': 'Approve for Purchase',
        'estimated_repair_cost_usd': Decimal('2500.00'),
        'max_purchase_price_recommendation': Decimal('58000.00'),
        'decision': 'Approved',
        'decision_date': date.today() - timedelta(days=89)
    },
    {
        'vin': '1FDEE3FS2KDC23456',
        'stock_number_temp': 'INSPECT-002',
        'year': 2020,
        'make': 'Thomas Built',
        'model': 'Saf-T-Liner C2',
        'odometer': 32000,
        'inspection_date': date.today() - timedelta(days=60),
        'inspector_name': 'Carlos Rodriguez',
        'inspection_location': 'Texas School District - Houston',
        'engine_condition': 'Excellent',
        'engine_starts': True,
        'engine_oil_condition': 'Excellent',
        'engine_coolant_condition': 'Good',
        'engine_leaks': False,
        'engine_noise': False,
        'engine_notes': 'Cummins ISL, very low miles, excellent condition',
        'transmission_condition': 'Excellent',
        'transmission_shifts_properly': True,
        'transmission_fluid_condition': 'Excellent',
        'transmission_leaks': False,
        'transmission_notes': 'Allison 3000, like new',
        'suspension_condition': 'Excellent',
        'steering_condition': 'Good',
        'chassis_condition': 'Excellent',
        'body_condition': 'Good',
        'rust_present': False,
        'rust_severity': None,
        'brake_condition': 'Good',
        'brake_pads_percentage': 85,
        'electrical_system_condition': 'Good',
        'interior_condition': 'Excellent',
        'seats_condition': 'Excellent',
        'road_test_performed': True,
        'road_test_notes': 'Excellent in all aspects, well maintained unit',
        'overall_rating': 'Excellent',
        'recommendation': 'Approve for Purchase',
        'estimated_repair_cost_usd': Decimal('500.00'),
        'max_purchase_price_recommendation': Decimal('75000.00'),
        'decision': 'Approved',
        'decision_date': date.today() - timedelta(days=59)
    },
    {
        'vin': '1FDEE3FS3KDC34567',
        'stock_number_temp': 'INSPECT-003',
        'year': 2017,
        'make': 'IC Bus',
        'model': 'CE Series',
        'odometer': 95000,
        'inspection_date': date.today() - timedelta(days=45),
        'inspector_name': 'Maria Gonzalez',
        'inspection_location': 'Arizona Public Schools - Phoenix',
        'engine_condition': 'Poor',
        'engine_starts': True,
        'engine_oil_condition': 'Poor',
        'engine_coolant_condition': 'Fair',
        'engine_leaks': True,
        'engine_noise': True,
        'engine_notes': 'MaxxForce engine with significant oil leaks, unusual knocking noise',
        'transmission_condition': 'Fair',
        'transmission_shifts_properly': False,
        'transmission_fluid_condition': 'Fair',
        'transmission_leaks': True,
        'transmission_notes': 'Hard shifting between 2nd and 3rd gear, leak detected',
        'suspension_condition': 'Fair',
        'steering_condition': 'Fair',
        'chassis_condition': 'Fair',
        'body_condition': 'Fair',
        'rust_present': True,
        'rust_severity': 'Moderate',
        'brake_condition': 'Fair',
        'brake_pads_percentage': 40,
        'electrical_system_condition': 'Poor',
        'interior_condition': 'Poor',
        'seats_condition': 'Poor',
        'road_test_performed': True,
        'road_test_notes': 'Multiple issues, not recommended',
        'overall_rating': 'Poor',
        'recommendation': 'Reject',
        'estimated_repair_cost_usd': Decimal('15000.00'),
        'max_purchase_price_recommendation': Decimal('25000.00'),
        'decision': 'Rejected',
        'decision_date': date.today() - timedelta(days=44)
    },
    {
        'vin': '1FDEE3FL4KDC45678',
        'stock_number_temp': 'INSPECT-004',
        'year': 2018,
        'make': 'Blue Bird',
        'model': 'Vision',
        'odometer': 52000,
        'inspection_date': date.today() - timedelta(days=30),
        'inspector_name': 'Carlos Rodriguez',
        'inspection_location': 'Midwest Bus Auction - Dallas',
        'engine_condition': 'Good',
        'engine_starts': True,
        'engine_oil_condition': 'Good',
        'engine_coolant_condition': 'Good',
        'engine_leaks': False,
        'engine_noise': False,
        'transmission_condition': 'Good',
        'transmission_shifts_properly': True,
        'transmission_fluid_condition': 'Good',
        'transmission_leaks': False,
        'suspension_condition': 'Good',
        'steering_condition': 'Good',
        'chassis_condition': 'Good',
        'body_condition': 'Fair',
        'rust_present': True,
        'rust_severity': 'Minor',
        'brake_condition': 'Good',
        'brake_pads_percentage': 65,
        'electrical_system_condition': 'Good',
        'interior_condition': 'Good',
        'seats_condition': 'Good',
        'road_test_performed': True,
        'road_test_notes': 'Solid unit, minor cosmetic work needed',
        'overall_rating': 'Good',
        'recommendation': 'Approve for Purchase',
        'estimated_repair_cost_usd': Decimal('3000.00'),
        'max_purchase_price_recommendation': Decimal('50000.00'),
        'decision': 'Approved',
        'decision_date': date.today() - timedelta(days=29)
    },
    {
        'vin': '1FDEE3FS5KDC56789',
        'stock_number_temp': 'INSPECT-005',
        'year': 2021,
        'make': 'Thomas Built',
        'model': 'Saf-T-Liner C2',
        'odometer': 18000,
        'inspection_date': date.today() - timedelta(days=15),
        'inspector_name': 'Maria Gonzalez',
        'inspection_location': 'Blue Bird Certified - Fort Worth',
        'engine_condition': 'Excellent',
        'engine_starts': True,
        'engine_oil_condition': 'Excellent',
        'engine_coolant_condition': 'Excellent',
        'engine_leaks': False,
        'engine_noise': False,
        'transmission_condition': 'Excellent',
        'transmission_shifts_properly': True,
        'transmission_fluid_condition': 'Excellent',
        'transmission_leaks': False,
        'suspension_condition': 'Excellent',
        'steering_condition': 'Excellent',
        'chassis_condition': 'Excellent',
        'body_condition': 'Excellent',
        'rust_present': False,
        'brake_condition': 'Excellent',
        'brake_pads_percentage': 95,
        'electrical_system_condition': 'Excellent',
        'interior_condition': 'Excellent',
        'seats_condition': 'Excellent',
        'road_test_performed': True,
        'road_test_notes': 'Nearly new condition, CPO unit',
        'overall_rating': 'Excellent',
        'recommendation': 'Approve for Purchase',
        'estimated_repair_cost_usd': Decimal('0.00'),
        'max_purchase_price_recommendation': Decimal('85000.00'),
        'decision': 'Approved',
        'decision_date': date.today() - timedelta(days=14)
    }
]

# Inventory - Different stages of workflow
inventory_items = [
    # Unit 1: DELIVERED (Complete workflow example)
    {
        'stock_number': 'BA-2024-001',
        'vin': '1FDEE3FL9KDC12345',
        'year': 2019,
        'make': 'Blue Bird',
        'model': 'Vision',
        'body_style': 'School Bus',
        'bus_type': 'Type C',
        'passenger_capacity': 72,
        'wheelchair_capacity': 2,
        'engine_make': 'Cummins',
        'engine_model': 'ISB 6.7L',
        'engine_type': 'Diesel',
        'transmission': 'Allison 2500',
        'fuel_type': 'Diesel',
        'odometer': 45000,
        'condition': 'Used',
        'exterior_color': 'Yellow',
        'interior_color': 'Gray',
        'title_status': 'Clean',
        'supplier_id': 1,
        'purchase_date': date.today() - timedelta(days=88),
        'purchase_price_usd': Decimal('55000.00'),
        'purchase_location': 'Midwest Bus Auction - Dallas, TX',
        'transport_to_stock_cost_usd': Decimal('800.00'),
        'initial_reconditioning_cost_usd': Decimal('2200.00'),
        'asking_price': Decimal('72000.00'),
        'asking_currency': 'USD',
        'minimum_price': Decimal('68000.00'),
        'minimum_currency': 'USD',
        'status': 'Delivered',
        'current_location': 'Client',
        'us_stock_location': 'Bay A-3',
        'is_sold': True,
        'sale_date': date.today() - timedelta(days=50),
        'client_name': 'Transportes Escolares del Norte SA',
        'client_company': 'Transportes Escolares del Norte SA',
        'client_location': 'Monterrey, Nuevo León, Mexico',
        'client_contact': 'Roberto García',
        'client_email': 'rgarcia@tenorte.mx',
        'client_phone': '+52-81-8555-1234',
        'sale_price': Decimal('70000.00'),
        'sale_currency': 'USD',
        'sale_price_usd': Decimal('70000.00'),
        'deposit_amount': Decimal('20000.00'),
        'deposit_currency': 'USD',
        'deposit_date': date.today() - timedelta(days=50),
        'payment_status': 'Paid in Full',
        'final_payment_date': date.today() - timedelta(days=20),
        'border_crossing': 'Nuevo Laredo',
        'import_started_date': date.today() - timedelta(days=40),
        'import_completed_date': date.today() - timedelta(days=35),
        'customs_broker': 'Lopez Customs Services',
        'import_cost_mxn': Decimal('42000.00'),
        'customs_cost_mxn': Decimal('28000.00'),
        'regulatory_cost_mxn': Decimal('8500.00'),
        'import_documents_complete': True,
        'preventive_maintenance_cost': Decimal('12000.00'),
        'preventive_maintenance_currency': 'MXN',
        'preventive_maintenance_date': date.today() - timedelta(days=25),
        'transport_to_client_cost_mxn': Decimal('6500.00'),
        'exchange_rate_used': Decimal('17.50'),
        'delivery_date': date.today() - timedelta(days=18),
        'delivery_method': 'Delivered to Location',
        'description': 'Well-maintained school bus, single owner, complete service records',
        'features': ['Air Conditioning', 'Backup Camera', 'LED Lights', 'AM/FM Radio'],
        'pre_inspection_id': 1
    },
    
    # Unit 2: IN PREVENTIVE MAINTENANCE (In Mexico)
    {
        'stock_number': 'BA-2024-002',
        'vin': '1FDEE3FS2KDC23456',
        'year': 2020,
        'make': 'Thomas Built',
        'model': 'Saf-T-Liner C2',
        'body_style': 'School Bus',
        'bus_type': 'Type C',
        'passenger_capacity': 84,
        'wheelchair_capacity': 3,
        'engine_make': 'Cummins',
        'engine_model': 'ISL 8.9L',
        'engine_type': 'Diesel',
        'transmission': 'Allison 3000',
        'fuel_type': 'Diesel',
        'odometer': 32000,
        'condition': 'Used',
        'exterior_color': 'Yellow',
        'interior_color': 'Tan',
        'title_status': 'Clean',
        'supplier_id': 2,
        'purchase_date': date.today() - timedelta(days=58),
        'purchase_price_usd': Decimal('68000.00'),
        'purchase_location': 'Texas School District - Houston, TX',
        'transport_to_stock_cost_usd': Decimal('600.00'),
        'initial_reconditioning_cost_usd': Decimal('800.00'),
        'asking_price': Decimal('85000.00'),
        'asking_currency': 'USD',
        'status': 'In Preventive Maintenance',
        'current_location': 'Mexico Stock',
        'mexico_stock_location': 'Section B',
        'is_sold': True,
        'sale_date': date.today() - timedelta(days=25),
        'client_name': 'Autobuses Escolares Guadalajara',
        'client_company': 'Autobuses Escolares Guadalajara',
        'client_location': 'Guadalajara, Jalisco, Mexico',
        'client_contact': 'Ana Martínez',
        'client_email': 'amartinez@aegdl.mx',
        'client_phone': '+52-33-3612-5678',
        'sale_price': Decimal('82000.00'),
        'sale_currency': 'USD',
        'sale_price_usd': Decimal('82000.00'),
        'deposit_amount': Decimal('25000.00'),
        'deposit_currency': 'USD',
        'deposit_date': date.today() - timedelta(days=25),
        'payment_status': 'Deposit Paid',
        'border_crossing': 'Reynosa',
        'import_started_date': date.today() - timedelta(days=15),
        'import_completed_date': date.today() - timedelta(days=10),
        'customs_broker': 'Ramirez Aduanas',
        'import_cost_mxn': Decimal('45000.00'),
        'customs_cost_mxn': Decimal('30000.00'),
        'regulatory_cost_mxn': Decimal('9000.00'),
        'import_documents_complete': True,
        'preventive_maintenance_date': date.today() - timedelta(days=5),
        'exchange_rate_used': Decimal('17.50'),
        'description': 'Low mileage, excellent condition, fleet maintained',
        'features': ['Air Conditioning', 'Backup Camera', 'LED Lights', 'Wheelchair Lift'],
        'pre_inspection_id': 2
    },
    
    # Unit 3: IN STOCK (US) - Available for sale
    {
        'stock_number': 'BA-2024-003',
        'vin': '1FDEE3FL4KDC45678',
        'year': 2018,
        'make': 'Blue Bird',
        'model': 'Vision',
        'body_style': 'School Bus',
        'bus_type': 'Type C',
        'passenger_capacity': 66,
        'wheelchair_capacity': 2,
        'engine_make': 'Cummins',
        'engine_model': 'ISB 6.7L',
        'engine_type': 'Diesel',
        'transmission': 'Allison 2500',
        'fuel_type': 'Diesel',
        'odometer': 52000,
        'condition': 'Used',
        'exterior_color': 'Yellow',
        'interior_color': 'Gray',
        'title_status': 'Clean',
        'supplier_id': 1,
        'purchase_date': date.today() - timedelta(days=28),
        'purchase_price_usd': Decimal('48000.00'),
        'purchase_location': 'Midwest Bus Auction - Dallas, TX',
        'transport_to_stock_cost_usd': Decimal('750.00'),
        'initial_reconditioning_cost_usd': Decimal('2800.00'),
        'asking_price': Decimal('62000.00'),
        'asking_currency': 'USD',
        'minimum_price': Decimal('58000.00'),
        'minimum_currency': 'USD',
        'status': 'In Stock (US)',
        'current_location': 'US Stock',
        'us_stock_location': 'Bay B-7',
        'is_sold': False,
        'description': 'Good overall condition, minor body work completed',
        'features': ['Backup Camera', 'LED Lights'],
        'pre_inspection_id': 4
    },
    
    # Unit 4: IMPORT/CUSTOMS PROCESSING
    {
        'stock_number': 'BA-2024-004',
        'vin': '1FDEE3FS5KDC56789',
        'year': 2021,
        'make': 'Thomas Built',
        'model': 'Saf-T-Liner C2',
        'body_style': 'School Bus',
        'bus_type': 'Type C',
        'passenger_capacity': 84,
        'wheelchair_capacity': 3,
        'engine_make': 'Cummins',
        'engine_model': 'ISL 8.9L',
        'engine_type': 'Diesel',
        'transmission': 'Allison 3000',
        'fuel_type': 'Diesel',
        'odometer': 18000,
        'condition': 'Used',
        'exterior_color': 'Yellow',
        'interior_color': 'Blue',
        'title_status': 'Clean',
        'supplier_id': 4,
        'purchase_date': date.today() - timedelta(days=13),
        'purchase_price_usd': Decimal('80000.00'),
        'purchase_location': 'Blue Bird Certified - Fort Worth, TX',
        'transport_to_stock_cost_usd': Decimal('500.00'),
        'asking_price': Decimal('98000.00'),
        'asking_currency': 'USD',
        'status': 'Import/Customs Processing',
        'current_location': 'In Transit',
        'is_sold': True,
        'sale_date': date.today() - timedelta(days=7),
        'client_name': 'Transporte Escolar Bajío',
        'client_company': 'Transporte Escolar Bajío SA',
        'client_location': 'León, Guanajuato, Mexico',
        'client_contact': 'Jorge Hernández',
        'client_email': 'jhernandez@tebajio.mx',
        'client_phone': '+52-47-7145-9876',
        'sale_price': Decimal('1680000.00'),
        'sale_currency': 'MXN',
        'sale_price_mxn': Decimal('1680000.00'),
        'deposit_amount': Decimal('500000.00'),
        'deposit_currency': 'MXN',
        'deposit_date': date.today() - timedelta(days=7),
        'payment_status': 'Deposit Paid',
        'border_crossing': 'Nuevo Laredo',
        'import_started_date': date.today() - timedelta(days=3),
        'customs_broker': 'Lopez Customs Services',
        'exchange_rate_used': Decimal('17.50'),
        'description': 'Nearly new, CPO unit with remaining factory warranty',
        'features': ['Air Conditioning', 'Backup Camera', 'LED Lights', 'Wheelchair Lift', 'GPS'],
        'pre_inspection_id': 5
    },
    
    # Unit 5: PURCHASED - IN TRANSIT TO STOCK
    {
        'stock_number': 'BA-2024-005',
        'vin': '1FDEE3FL6KDC67890',
        'year': 2019,
        'make': 'IC Bus',
        'model': 'CE Series',
        'body_style': 'School Bus',
        'bus_type': 'Type C',
        'passenger_capacity': 72,
        'odometer': 48000,
        'condition': 'Used',
        'exterior_color': 'Yellow',
        'title_status': 'Clean',
        'supplier_id': 3,
        'purchase_date': date.today() - timedelta(days=2),
        'purchase_price_usd': Decimal('51000.00'),
        'purchase_location': 'Arizona Public Schools - Phoenix, AZ',
        'asking_price': Decimal('65000.00'),
        'asking_currency': 'USD',
        'status': 'Purchased - In Transit to Stock',
        'current_location': 'In Transit',
        'is_sold': False,
        'description': 'Recently purchased, in transit to US warehouse',
        'features': ['Backup Camera']
    }
]

async def seed_database():
    print("=" * 70)
    print("BUSES AMERICA - SAMPLE DATA GENERATOR")
    print("=" * 70)
    print("\nThis will create realistic sample data showing buses at different")
    print("stages of your business workflow.\n")
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # 1. Set Exchange Rate
        print("\n1. Setting Exchange Rate...")
        await conn.execute("""
            INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
            VALUES ('USD', 'MXN', 17.50, CURRENT_DATE)
        """)
        print("   ✓ Exchange rate set: 1 USD = 17.50 MXN")
        
        # 2. Insert Suppliers
        print("\n2. Creating Suppliers...")
        supplier_ids = []
        for sup in suppliers:
            row = await conn.fetchrow("""
                INSERT INTO suppliers (company_name, contact_person, email, phone, city, state,
                                     supplier_type, payment_terms, country)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING supplier_id
            """, sup['company_name'], sup['contact_person'], sup['email'], sup['phone'],
                sup['city'], sup['state'], sup['supplier_type'], sup['payment_terms'], sup['country'])
            supplier_ids.append(row['supplier_id'])
            print(f"   ✓ {sup['company_name']} ({sup['supplier_type']})")
        
        # 3. Insert Pre-Purchase Inspections
        print("\n3. Creating Pre-Purchase Inspections...")
        inspection_ids = {}
        for idx, insp in enumerate(pre_inspections):
            row = await conn.fetchrow("""
                INSERT INTO pre_purchase_inspections (
                    vin, stock_number_temp, year, make, model, odometer,
                    inspection_date, inspector_name, inspection_location,
                    engine_condition, engine_starts, engine_oil_condition, engine_coolant_condition,
                    engine_leaks, engine_noise, engine_notes,
                    transmission_condition, transmission_shifts_properly, transmission_fluid_condition,
                    transmission_leaks, transmission_notes,
                    suspension_condition, steering_condition, chassis_condition, body_condition,
                    rust_present, rust_severity, brake_condition, brake_pads_percentage,
                    electrical_system_condition, interior_condition, seats_condition,
                    road_test_performed, road_test_notes, overall_rating, recommendation,
                    estimated_repair_cost_usd, max_purchase_price_recommendation,
                    decision, decision_date
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                    $31, $32, $33, $34, $35, $36, $37, $38, $39, $40
                ) RETURNING inspection_id
            """, insp['vin'], insp['stock_number_temp'], insp['year'], insp['make'], insp['model'],
                insp['odometer'], insp['inspection_date'], insp['inspector_name'], insp['inspection_location'],
                insp['engine_condition'], insp['engine_starts'], insp['engine_oil_condition'],
                insp['engine_coolant_condition'], insp['engine_leaks'], insp['engine_noise'], insp['engine_notes'],
                insp['transmission_condition'], insp['transmission_shifts_properly'], insp['transmission_fluid_condition'],
                insp['transmission_leaks'], insp['transmission_notes'], insp['suspension_condition'],
                insp['steering_condition'], insp['chassis_condition'], insp['body_condition'],
                insp['rust_present'], insp.get('rust_severity'), insp['brake_condition'], insp['brake_pads_percentage'],
                insp['electrical_system_condition'], insp['interior_condition'], insp['seats_condition'],
                insp['road_test_performed'], insp['road_test_notes'], insp['overall_rating'],
                insp['recommendation'], insp['estimated_repair_cost_usd'], insp['max_purchase_price_recommendation'],
                insp['decision'], insp['decision_date'])
            
            inspection_ids[insp['vin']] = row['inspection_id']
            status = "✓" if insp['decision'] == 'Approved' else "✗"
            print(f"   {status} {insp['year']} {insp['make']} {insp['model']} - {insp['decision']}")
        
        # 4. Insert Inventory
        print("\n4. Creating Inventory...")
        inventory_ids = {}
        for inv in inventory_items:
            # Map supplier_id
            inv['supplier_id'] = supplier_ids[inv['supplier_id'] - 1]
            
            # Map pre_inspection_id if exists
            if 'pre_inspection_id' in inv and inv['pre_inspection_id']:
                inv['pre_inspection_id'] = list(inspection_ids.values())[inv['pre_inspection_id'] - 1]
            
            row = await conn.fetchrow("""
                INSERT INTO inventory (
                    stock_number, vin, year, make, model, body_style, bus_type,
                    passenger_capacity, wheelchair_capacity, engine_make, engine_model,
                    engine_type, transmission, fuel_type, odometer, condition,
                    exterior_color, interior_color, title_status, supplier_id,
                    purchase_date, purchase_price_usd, purchase_location,
                    transport_to_stock_cost_usd, initial_reconditioning_cost_usd,
                    asking_price, asking_currency, minimum_price, minimum_currency,
                    status, current_location, us_stock_location, mexico_stock_location,
                    is_sold, sale_date, client_name, client_company, client_location,
                    client_contact, client_email, client_phone,
                    sale_price, sale_currency, sale_price_usd, sale_price_mxn,
                    deposit_amount, deposit_currency, deposit_date, payment_status, final_payment_date,
                    border_crossing, import_started_date, import_completed_date, customs_broker,
                    import_cost_mxn, customs_cost_mxn, regulatory_cost_mxn, import_documents_complete,
                    preventive_maintenance_cost, preventive_maintenance_currency, preventive_maintenance_date,
                    transport_to_client_cost_mxn, exchange_rate_used,
                    delivery_date, delivery_method,
                    description, features, pre_inspection_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                    $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
                    $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58,
                    $59, $60, $61, $62, $63, $64, $65, $66
                ) RETURNING inventory_id
            """, 
                inv['stock_number'], inv['vin'], inv['year'], inv['make'], inv['model'],
                inv.get('body_style'), inv.get('bus_type'), inv.get('passenger_capacity'),
                inv.get('wheelchair_capacity'), inv.get('engine_make'), inv.get('engine_model'),
                inv.get('engine_type'), inv.get('transmission'), inv.get('fuel_type'),
                inv.get('odometer'), inv['condition'], inv.get('exterior_color'),
                inv.get('interior_color'), inv['title_status'], inv['supplier_id'],
                inv['purchase_date'], inv['purchase_price_usd'], inv.get('purchase_location'),
                inv.get('transport_to_stock_cost_usd', 0), inv.get('initial_reconditioning_cost_usd', 0),
                inv.get('asking_price'), inv.get('asking_currency', 'USD'),
                inv.get('minimum_price'), inv.get('minimum_currency', 'USD'),
                inv['status'], inv['current_location'], inv.get('us_stock_location'),
                inv.get('mexico_stock_location'), inv.get('is_sold', False),
                inv.get('sale_date'), inv.get('client_name'), inv.get('client_company'),
                inv.get('client_location'), inv.get('client_contact'), inv.get('client_email'),
                inv.get('client_phone'), inv.get('sale_price'), inv.get('sale_currency'),
                inv.get('sale_price_usd'), inv.get('sale_price_mxn'), inv.get('deposit_amount'),
                inv.get('deposit_currency'), inv.get('deposit_date'), inv.get('payment_status'),
                inv.get('final_payment_date'), inv.get('border_crossing'),
                inv.get('import_started_date'), inv.get('import_completed_date'),
                inv.get('customs_broker'), inv.get('import_cost_mxn', 0),
                inv.get('customs_cost_mxn', 0), inv.get('regulatory_cost_mxn', 0),
                inv.get('import_documents_complete', False), inv.get('preventive_maintenance_cost'),
                inv.get('preventive_maintenance_currency'), inv.get('preventive_maintenance_date'),
                inv.get('transport_to_client_cost_mxn'), inv.get('exchange_rate_used'),
                inv.get('delivery_date'), inv.get('delivery_method'),
                inv.get('description'), inv.get('features', []), inv.get('pre_inspection_id'))
            
            inventory_ids[inv['stock_number']] = row['inventory_id']
            print(f"   ✓ {inv['stock_number']}: {inv['year']} {inv['make']} {inv['model']} - {inv['status']}")
        
        # 5. Add Work Plans
        print("\n5. Creating Work Plans...")
        
        # Acquisition work plan for delivered unit
        await conn.execute("""
            INSERT INTO work_plans (
                inventory_id, plan_type, origin_location, destination_location,
                estimated_distance_km, estimated_days, estimated_cost, cost_currency,
                actual_cost, actual_days, completed, completion_date
            ) VALUES ($1, 'Acquisition', 'Dallas, TX', 'Buses America US Warehouse',
                      450, 2, 800, 'USD', 800, 2, true, $2)
        """, inventory_ids['BA-2024-001'], date.today() - timedelta(days=86))
        
        # Delivery work plan for delivered unit
        await conn.execute("""
            INSERT INTO work_plans (
                inventory_id, plan_type, origin_location, destination_location,
                estimated_distance_km, estimated_days, estimated_cost, cost_currency,
                actual_cost, actual_days, completed, completion_date
            ) VALUES ($1, 'Delivery', 'US Warehouse', 'Monterrey, Mexico',
                      850, 5, 22000, 'MXN', 21500, 4, true, $2)
        """, inventory_ids['BA-2024-001'], date.today() - timedelta(days=36))
        
        print("   ✓ Work plans created for delivered unit")
        
        # 6. Add Warranty Claim (for delivered unit)
        print("\n6. Creating Sample Warranty Claim...")
        await conn.execute("""
            INSERT INTO warranty_claims (
                inventory_id, claim_date, claim_type, description, client_name, status
            ) VALUES ($1, $2, 'Transmission', 
                     'Minor transmission fluid leak detected during routine check',
                     'Transportes Escolares del Norte SA', 'Resolved')
        """, inventory_ids['BA-2024-001'], date.today() - timedelta(days=10))
        print("   ✓ Warranty claim created")
        
        # Summary
        print("\n" + "=" * 70)
        print("SAMPLE DATA CREATED SUCCESSFULLY!")
        print("=" * 70)
        print("\nSummary:")
        print(f"  • {len(suppliers)} Suppliers")
        print(f"  • {len(pre_inspections)} Pre-Purchase Inspections")
        print(f"    - {sum(1 for i in pre_inspections if i['decision'] == 'Approved')} Approved")
        print(f"    - {sum(1 for i in pre_inspections if i['decision'] == 'Rejected')} Rejected")
        print(f"  • {len(inventory_items)} Inventory Units:")
        print(f"    - 1 Delivered (with warranty)")
        print(f"    - 1 In Preventive Maintenance (Mexico)")
        print(f"    - 1 In Stock (US) - Available for sale")
        print(f"    - 1 Import/Customs Processing")
        print(f"    - 1 In Transit to Stock")
        print(f"  • 2 Work Plans")
        print(f"  • 1 Warranty Claim")
        print("\n✓ You can now start the backend and explore the data!")
        print("  API: http://localhost:8000")
        print("  Docs: http://localhost:8000/docs")
        print("\n" + "=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    print("\n⚠️  WARNING: This will add sample data to your database.")
    print("Make sure you've already run the schema SQL file!\n")
    
    response = input("Continue? (yes/no): ")
    if response.lower() in ['yes', 'y']:
        asyncio.run(seed_database())
    else:
        print("Cancelled.")
