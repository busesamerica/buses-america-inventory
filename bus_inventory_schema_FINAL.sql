-- Buses America - Final Database Schema
-- Used School Bus Dealer with US Stock and Mexico Import Operations

-- Exchange Rate Management
CREATE TABLE exchange_rates (
    rate_id SERIAL PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    to_currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
    rate DECIMAL(10,4) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Suppliers/Sources table
CREATE TABLE suppliers (
    supplier_id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    supplier_type VARCHAR(50), -- 'Auction', 'Trade-in', 'Dealer', 'Private'
    tax_id VARCHAR(50),
    payment_terms VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-Purchase Inspections (before buying the bus)
CREATE TABLE pre_purchase_inspections (
    inspection_id SERIAL PRIMARY KEY,
    vin VARCHAR(17) NOT NULL,
    stock_number_temp VARCHAR(50), -- Temporary identifier before purchase
    
    -- Basic Info
    year INTEGER,
    make VARCHAR(100),
    model VARCHAR(100),
    odometer INTEGER,
    
    -- Inspection Details
    inspection_date DATE NOT NULL,
    inspector_name VARCHAR(100),
    inspection_location VARCHAR(255), -- Where inspected (auction, dealer, etc.)
    
    -- Engine
    engine_condition VARCHAR(50), -- 'Excellent', 'Good', 'Fair', 'Poor', 'Failed'
    engine_starts BOOLEAN,
    engine_oil_condition VARCHAR(50),
    engine_coolant_condition VARCHAR(50),
    engine_leaks BOOLEAN,
    engine_noise BOOLEAN,
    engine_notes TEXT,
    
    -- Transmission
    transmission_condition VARCHAR(50),
    transmission_shifts_properly BOOLEAN,
    transmission_fluid_condition VARCHAR(50),
    transmission_leaks BOOLEAN,
    transmission_notes TEXT,
    
    -- Suspension & Steering
    suspension_condition VARCHAR(50),
    steering_condition VARCHAR(50),
    alignment_ok BOOLEAN,
    suspension_notes TEXT,
    
    -- Chassis & Body
    chassis_condition VARCHAR(50),
    body_condition VARCHAR(50),
    rust_present BOOLEAN,
    rust_severity VARCHAR(50), -- 'Minor', 'Moderate', 'Severe'
    structural_damage BOOLEAN,
    chassis_notes TEXT,
    
    -- Brakes
    brake_condition VARCHAR(50),
    brake_pads_percentage INTEGER, -- 0-100%
    brake_lines_condition VARCHAR(50),
    brake_notes TEXT,
    
    -- Electrical
    electrical_system_condition VARCHAR(50),
    lights_working BOOLEAN,
    battery_condition VARCHAR(50),
    alternator_working BOOLEAN,
    electrical_notes TEXT,
    
    -- Interior
    interior_condition VARCHAR(50),
    seats_condition VARCHAR(50),
    floor_condition VARCHAR(50),
    interior_notes TEXT,
    
    -- Road Test
    road_test_performed BOOLEAN,
    road_test_notes TEXT,
    
    -- Overall Assessment
    overall_rating VARCHAR(50), -- 'Excellent', 'Good', 'Fair', 'Poor'
    recommendation VARCHAR(50), -- 'Approve for Purchase', 'Conditional', 'Reject'
    estimated_repair_cost_usd DECIMAL(10,2),
    max_purchase_price_recommendation DECIMAL(10,2),
    
    -- Decision
    decision VARCHAR(50), -- 'Approved', 'Rejected', 'Pending'
    decision_date DATE,
    decision_notes TEXT,
    
    -- Link to inventory if purchased
    inventory_id INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Main Inventory Table (only purchased buses)
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    stock_number VARCHAR(50) UNIQUE NOT NULL,
    vin VARCHAR(17) UNIQUE NOT NULL,
    
    -- Basic Info
    year INTEGER NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    body_style VARCHAR(100), -- 'School Bus', 'Transit Bus', 'Shuttle'
    bus_type VARCHAR(50), -- 'Type A', 'Type B', 'Type C', 'Type D'
    
    -- Specifications
    passenger_capacity INTEGER,
    wheelchair_capacity INTEGER,
    engine_make VARCHAR(100),
    engine_model VARCHAR(100),
    engine_type VARCHAR(50), -- 'Diesel', 'Gasoline', 'CNG'
    transmission VARCHAR(100),
    fuel_type VARCHAR(50),
    gvwr INTEGER,
    length_feet DECIMAL(5,2),
    odometer INTEGER,
    odometer_unit VARCHAR(10) DEFAULT 'miles',
    
    -- Condition
    condition VARCHAR(50) DEFAULT 'Used',
    exterior_color VARCHAR(50),
    interior_color VARCHAR(50),
    title_status VARCHAR(50), -- 'Clean', 'Salvage', 'Rebuilt', 'Pending'
    
    -- Purchase Info (USD)
    supplier_id INTEGER REFERENCES suppliers(supplier_id),
    purchase_date DATE NOT NULL,
    purchase_price_usd DECIMAL(12,2) NOT NULL,
    purchase_location VARCHAR(255), -- Where purchased
    purchase_invoice_number VARCHAR(100),
    
    -- Transportation to US Stock (USD)
    transport_to_stock_cost_usd DECIMAL(12,2) DEFAULT 0,
    transport_to_stock_notes TEXT,
    
    -- Initial reconditioning at stock (USD) - if any
    initial_reconditioning_cost_usd DECIMAL(12,2) DEFAULT 0,
    
    -- Other acquisition costs (USD)
    other_acquisition_costs_usd DECIMAL(12,2) DEFAULT 0,
    
    -- Cost in US Inventory (auto-calculated)
    cost_in_us_stock_usd DECIMAL(12,2) GENERATED ALWAYS AS (
        COALESCE(purchase_price_usd, 0) + 
        COALESCE(transport_to_stock_cost_usd, 0) + 
        COALESCE(initial_reconditioning_cost_usd, 0) +
        COALESCE(other_acquisition_costs_usd, 0)
    ) STORED,
    
    -- Pricing (for sale)
    asking_price DECIMAL(12,2),
    asking_currency VARCHAR(3) DEFAULT 'USD',
    minimum_price DECIMAL(12,2),
    minimum_currency VARCHAR(3) DEFAULT 'USD',
    
    -- Status & Location
    status VARCHAR(50) NOT NULL DEFAULT 'Purchased - In Transit to Stock',
    /* Status options:
       - Purchased - In Transit to Stock
       - In Stock (US)
       - Sold - Pending Import
       - Import/Customs Processing
       - In Stock (Mexico)
       - In Preventive Maintenance (happens in Mexico)
       - Ready for Delivery
       - In Transit to Client
       - Delivered
    */
    
    current_location VARCHAR(100), -- 'US Stock', 'Mexico Stock', 'In Transit', 'Client'
    us_stock_location VARCHAR(100), -- Specific bay/area in US lot
    mexico_stock_location VARCHAR(100), -- Specific location in Mexico warehouse
    
    -- Sale Information (when client pays deposit)
    is_sold BOOLEAN DEFAULT FALSE,
    sale_date DATE, -- Date deposit received
    client_name VARCHAR(255),
    client_company VARCHAR(255),
    client_location VARCHAR(255), -- Final destination in Mexico
    client_contact VARCHAR(255),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_use_case TEXT,
    
    -- Sale Price & Payment
    sale_price DECIMAL(12,2),
    sale_currency VARCHAR(3), -- 'USD', 'MXN', or 'Mixed'
    sale_price_usd DECIMAL(12,2), -- If USD or converted amount
    sale_price_mxn DECIMAL(12,2), -- If MXN or converted amount
    
    deposit_amount DECIMAL(12,2),
    deposit_currency VARCHAR(3),
    deposit_date DATE,
    
    balance_due DECIMAL(12,2),
    balance_currency VARCHAR(3),
    payment_status VARCHAR(50), -- 'Pending Deposit', 'Deposit Paid', 'Paid in Full'
    final_payment_date DATE,
    
    -- Preventive Maintenance (after sale, before delivery)
    preventive_maintenance_cost DECIMAL(12,2) DEFAULT 0,
    preventive_maintenance_currency VARCHAR(3) DEFAULT 'USD',
    preventive_maintenance_notes TEXT,
    preventive_maintenance_date DATE,
    
    -- Import/Customs (MXN)
    border_crossing VARCHAR(50), -- 'Reynosa' or 'Nuevo Laredo'
    import_started_date DATE,
    import_completed_date DATE,
    customs_broker VARCHAR(255),
    import_cost_mxn DECIMAL(12,2) DEFAULT 0,
    customs_cost_mxn DECIMAL(12,2) DEFAULT 0,
    regulatory_cost_mxn DECIMAL(12,2) DEFAULT 0,
    other_import_costs_mxn DECIMAL(12,2) DEFAULT 0,
    import_documents_complete BOOLEAN DEFAULT FALSE,
    import_notes TEXT,
    
    -- Transportation to Client (MXN)
    transport_to_client_cost_mxn DECIMAL(12,2) DEFAULT 0,
    transport_to_client_notes TEXT,
    
    -- Other costs after sale (can be USD or MXN)
    other_costs_after_sale DECIMAL(12,2) DEFAULT 0,
    other_costs_currency VARCHAR(3),
    
    -- Exchange rate used for this transaction
    exchange_rate_used DECIMAL(10,4),
    
    -- Total Costs (calculated)
    total_cost_usd DECIMAL(12,2),
    total_cost_mxn DECIMAL(12,2),
    profit_usd DECIMAL(12,2),
    profit_mxn DECIMAL(12,2),
    
    -- Delivery
    delivery_date DATE,
    delivery_method VARCHAR(50), -- 'Client Pickup', 'Delivered to Location'
    delivery_notes TEXT,
    
    -- Warranty (60 days starting from delivery)
    warranty_start_date DATE,
    warranty_end_date DATE,
    warranty_status VARCHAR(50), -- 'Active', 'Expired', 'Claimed', 'N/A'
    
    -- Days tracking
    days_in_inventory INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN status = 'Delivered' THEN NULL
            ELSE EXTRACT(DAY FROM (CURRENT_DATE - purchase_date))
        END
    ) STORED,
    
    days_in_us_stock INTEGER, -- Manually updated or calculated
    days_in_mexico_stock INTEGER, -- For units imported before sale
    
    days_in_warranty INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN warranty_end_date IS NULL THEN NULL
            WHEN CURRENT_DATE > warranty_end_date THEN 0
            ELSE EXTRACT(DAY FROM (warranty_end_date - CURRENT_DATE))
        END
    ) STORED,
    
    -- Additional Info
    features TEXT[],
    description TEXT,
    internal_notes TEXT,
    
    -- Link to pre-purchase inspection
    pre_inspection_id INTEGER REFERENCES pre_purchase_inspections(inspection_id),
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Photos
CREATE TABLE inventory_photos (
    photo_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500),
    file_size INTEGER,
    mime_type VARCHAR(50),
    photo_type VARCHAR(50), -- 'Exterior', 'Interior', 'Engine', 'Damage', 'Pre-Purchase'
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    caption TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(100)
);

-- Documents
CREATE TABLE inventory_documents (
    document_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    document_type VARCHAR(100), -- 'Title', 'Purchase Invoice', 'Import Docs', 'Customs', 'Sale Agreement', 'Other'
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500),
    file_size INTEGER,
    mime_type VARCHAR(50),
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(100)
);

-- Service/Maintenance History
CREATE TABLE service_history (
    service_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    service_date DATE NOT NULL,
    service_type VARCHAR(100), -- 'Initial Reconditioning', 'Preventive Maintenance', 'Repair', 'Inspection'
    description TEXT NOT NULL,
    vendor VARCHAR(255),
    cost DECIMAL(10,2),
    cost_currency VARCHAR(3) DEFAULT 'USD',
    invoice_number VARCHAR(100),
    performed_by VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status Change History (audit trail)
CREATE TABLE inventory_status_history (
    history_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100),
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Detailed Cost Items (multi-currency)
CREATE TABLE cost_items (
    cost_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    cost_category VARCHAR(100), -- 'Purchase', 'Transport to Stock', 'Initial Reconditioning', 'Preventive Maintenance', 'Import', 'Customs', 'Transport to Client', 'Other'
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    vendor VARCHAR(255),
    invoice_number VARCHAR(100),
    date_incurred DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Warranty Claims
CREATE TABLE warranty_claims (
    claim_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    claim_date DATE NOT NULL,
    claim_type VARCHAR(50), -- 'Engine', 'Transmission', 'Both'
    description TEXT NOT NULL,
    client_name VARCHAR(255),
    status VARCHAR(50), -- 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Resolved'
    resolution TEXT,
    resolution_date DATE,
    cost DECIMAL(10,2),
    cost_currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client Follow-up
CREATE TABLE client_followup (
    followup_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    followup_date DATE NOT NULL,
    followup_type VARCHAR(50), -- 'Satisfaction Check', 'Performance Review', 'Issue Report'
    satisfaction_rating INTEGER, -- 1-5
    bus_performance VARCHAR(50), -- 'Excellent', 'Good', 'Fair', 'Poor'
    issues_reported TEXT,
    notes TEXT,
    contacted_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Work Plans (for logistics)
CREATE TABLE work_plans (
    plan_id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    plan_type VARCHAR(50), -- 'Acquisition' (auction to US stock) or 'Delivery' (US to Mexico client)
    
    origin_location VARCHAR(255),
    destination_location VARCHAR(255),
    estimated_distance_km INTEGER,
    estimated_days INTEGER,
    estimated_cost DECIMAL(10,2),
    cost_currency VARCHAR(3),
    
    plan_notes TEXT,
    created_date DATE DEFAULT CURRENT_DATE,
    
    -- Actual execution
    actual_cost DECIMAL(10,2),
    actual_days INTEGER,
    execution_notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    completion_date DATE,
    
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_inventory_vin ON inventory(vin);
CREATE INDEX idx_inventory_stock_number ON inventory(stock_number);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_is_sold ON inventory(is_sold);
CREATE INDEX idx_inventory_current_location ON inventory(current_location);
CREATE INDEX idx_inventory_supplier ON inventory(supplier_id);
CREATE INDEX idx_inventory_warranty_status ON inventory(warranty_status);
CREATE INDEX idx_pre_inspection_vin ON pre_purchase_inspections(vin);
CREATE INDEX idx_exchange_rate_date ON exchange_rates(effective_date DESC);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warranty_claims_updated_at BEFORE UPDATE ON warranty_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Track status changes
CREATE OR REPLACE FUNCTION track_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO inventory_status_history (inventory_id, old_status, new_status, changed_by)
        VALUES (NEW.inventory_id, OLD.status, NEW.status, CURRENT_USER);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_inventory_status_changes AFTER UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION track_status_change();

-- Auto-calculate warranty dates (60 days from delivery)
CREATE OR REPLACE FUNCTION calculate_warranty_dates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.delivery_date IS NOT NULL AND NEW.warranty_start_date IS NULL THEN
        NEW.warranty_start_date = NEW.delivery_date;
        NEW.warranty_end_date = NEW.delivery_date + INTERVAL '60 days';
        NEW.warranty_status = 'Active';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_calculate_warranty BEFORE INSERT OR UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION calculate_warranty_dates();

-- Update is_sold flag when deposit is received
CREATE OR REPLACE FUNCTION update_is_sold_flag()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deposit_date IS NOT NULL AND NEW.deposit_amount > 0 AND OLD.is_sold = FALSE THEN
        NEW.is_sold = TRUE;
        NEW.sale_date = NEW.deposit_date;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_update_is_sold BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_is_sold_flag();

-- Sample Data
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) VALUES
('USD', 'MXN', 17.50, CURRENT_DATE);

INSERT INTO suppliers (company_name, contact_person, email, phone, supplier_type, payment_terms) VALUES
('Midwest Bus Auction', 'John Smith', 'jsmith@auction.com', '555-0101', 'Auction', 'Wire Transfer'),
('Texas School District', 'Sarah Johnson', 'sjohnson@school.edu', '555-0102', 'Trade-in', 'Check'),
('Blue Bird Certified', 'Mike Davis', 'mdavis@bluebird.com', '555-0103', 'Dealer', 'Net 15');

-- Views
CREATE VIEW current_exchange_rate AS
SELECT rate_id, from_currency, to_currency, rate, effective_date
FROM exchange_rates
WHERE is_active = TRUE
ORDER BY effective_date DESC
LIMIT 1;

CREATE VIEW us_inventory AS
SELECT *
FROM inventory
WHERE current_location = 'US Stock' AND is_deleted = FALSE
ORDER BY purchase_date DESC;

CREATE VIEW mexico_inventory AS
SELECT *
FROM inventory
WHERE current_location = 'Mexico Stock' AND is_deleted = FALSE
ORDER BY purchase_date DESC;

CREATE VIEW sold_pending_delivery AS
SELECT *
FROM inventory
WHERE is_sold = TRUE AND status != 'Delivered' AND is_deleted = FALSE
ORDER BY sale_date;

CREATE VIEW units_under_warranty AS
SELECT *
FROM inventory
WHERE warranty_status = 'Active' AND warranty_end_date >= CURRENT_DATE
ORDER BY warranty_end_date;
