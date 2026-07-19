"""
Buses America - Complete Inventory Management API
Final version matching actual business operation
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import date, datetime, timedelta
from decimal import Decimal
from inspection_summary_helper import generate_inspection_summary, calculate_pre_fill_data
import asyncpg
import os
import secrets
import hashlib
import json
from contextlib import asynccontextmanager

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/buses_america")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

# Security
security = HTTPBearer()

# ==================== PYDANTIC MODELS ====================

class ExchangeRateCreate(BaseModel):
    from_currency: str = "USD"
    to_currency: str = "MXN"
    rate: Decimal
    effective_date: date = Field(default_factory=date.today)

class ExchangeRate(ExchangeRateCreate):
    rate_id: int
    created_at: datetime
    is_active: bool = True
    
    class Config:
        from_attributes = True

class SupplierCreate(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    supplier_type: Optional[str] = None
    payment_terms: Optional[str] = None
    country: str = "USA"

class Supplier(SupplierCreate):
    supplier_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    payment_amount: Decimal
    payment_currency: str = 'USD'
    payment_date: date
    payment_method: str
    payment_type: str
    reference_number: Optional[str] = None
    payment_notes: Optional[str] = None
    payment_account_id: Optional[int] = None

class PrePurchaseInspectionCreate(BaseModel):
    vin: str
    stock_number_temp: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    odometer: Optional[int] = None
    inspection_date: date
    inspector_name: Optional[str] = None
    inspection_location: Optional[str] = None
    # Engine
    engine_condition: Optional[str] = None
    engine_starts: Optional[bool] = None
    engine_oil_condition: Optional[str] = None
    engine_coolant_condition: Optional[str] = None
    engine_leaks: Optional[bool] = None
    engine_noise: Optional[bool] = None
    engine_notes: Optional[str] = None
    # Transmission
    transmission_condition: Optional[str] = None
    transmission_shifts_properly: Optional[bool] = None
    transmission_fluid_condition: Optional[str] = None
    transmission_leaks: Optional[bool] = None
    transmission_notes: Optional[str] = None
    # Other systems
    suspension_condition: Optional[str] = None
    steering_condition: Optional[str] = None
    chassis_condition: Optional[str] = None
    body_condition: Optional[str] = None
    rust_present: Optional[bool] = None
    rust_severity: Optional[str] = None
    brake_condition: Optional[str] = None
    brake_pads_percentage: Optional[int] = None
    electrical_system_condition: Optional[str] = None
    interior_condition: Optional[str] = None
    seats_condition: Optional[str] = None
    # Overall
    road_test_performed: Optional[bool] = None
    road_test_notes: Optional[str] = None
    overall_rating: Optional[str] = None
    recommendation: Optional[str] = None  # 'Approve for Purchase', 'Conditional', 'Reject'
    estimated_repair_cost_usd: Optional[Decimal] = None
    max_purchase_price_recommendation: Optional[Decimal] = None

class PrePurchaseInspection(PrePurchaseInspectionCreate):
    inspection_id: int
    decision: Optional[str] = None
    decision_date: Optional[date] = None
    inventory_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class WorkPlanCreate(BaseModel):
    plan_type: str  # 'Acquisition' or 'Delivery'
    origin_location: str
    destination_location: str
    estimated_distance_km: Optional[int] = None
    estimated_days: Optional[int] = None
    estimated_cost: Optional[Decimal] = None
    cost_currency: Optional[str] = "USD"
    plan_notes: Optional[str] = None

class WorkPlan(WorkPlanCreate):
    plan_id: int
    inventory_id: int
    actual_cost: Optional[Decimal] = None
    actual_days: Optional[int] = None
    completed: bool = False
    completion_date: Optional[date] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class InventoryCreate(BaseModel):
    stock_number: str
    vin: str
    year: int
    make: str
    model: str
    body_style: Optional[str] = None
    bus_type: Optional[str] = None
    passenger_capacity: Optional[int] = None
    wheelchair_capacity: Optional[int] = None
    engine_make: Optional[str] = None
    engine_model: Optional[str] = None
    engine_type: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    odometer: Optional[int] = None
    condition: str = "Used"
    exterior_color: Optional[str] = None
    interior_color: Optional[str] = None
    title_status: Optional[str] = "Clean"
    
    # Purchase info
    supplier_id: Optional[int] = None
    purchase_date: date
    purchase_price_usd: Decimal
    purchase_location: Optional[str] = None
    purchase_invoice_number: Optional[str] = None
    
    # Costs
    transport_to_stock_cost_usd: Optional[Decimal] = 0
    initial_reconditioning_cost_usd: Optional[Decimal] = 0
    other_acquisition_costs_usd: Optional[Decimal] = 0
    
    # Pricing
    asking_price: Optional[Decimal] = None
    asking_currency: str = "USD"
    minimum_price: Optional[Decimal] = None
    minimum_currency: str = "USD"
    
    # Location
    status: str = "Purchased - In Transit to Stock"
    current_location: str = "In Transit"
    us_stock_location: Optional[str] = None
    
    # Link to pre-inspection
    pre_inspection_id: Optional[int] = None
    
    # Additional
    features: Optional[List[str]] = []
    description: Optional[str] = None
    internal_notes: Optional[str] = None
    created_by: Optional[str] = "system"

class InventoryUpdate(BaseModel):
    # Core inventory fields that can be updated
    stock_number: Optional[str] = None
    vin: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    passenger_capacity: Optional[int] = None
    purchase_price_usd: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    condition: Optional[str] = None
    
    # Engine fields
    engine_make: Optional[str] = None
    engine_model: Optional[str] = None
    engine_type: Optional[str] = None
    transmission: Optional[str] = None
    
    # Vehicle specs and safety
    body_style: Optional[str] = None
    brake_system: Optional[str] = None
    air_conditioning: Optional[bool] = None
    heater: Optional[bool] = None
    seat_belts: Optional[int] = None
    emergency_exits: Optional[int] = None
    fire_extinguisher: Optional[bool] = None
    first_aid_kit: Optional[bool] = None
    ada_compliant: Optional[bool] = None
    wheelchair_lift_ramp: Optional[str] = None
    
    # Allow partial updates
    status: Optional[str] = None
    current_location: Optional[str] = None
    us_stock_location: Optional[str] = None
    mexico_stock_location: Optional[str] = None
    asking_price: Optional[Decimal] = None
    asking_currency: Optional[str] = None
    minimum_price: Optional[Decimal] = None
    minimum_currency: Optional[str] = None
    
    # Supplier
    supplier_id: Optional[int] = None
    
    # Client link (foreign key to clients table)
    client_id: Optional[int] = None
    
    # Sale info
    sale_date: Optional[date] = None
    sale_price: Optional[Decimal] = None
    sale_price_usd: Optional[Decimal] = None
    sale_price_mxn: Optional[Decimal] = None
    sale_currency: Optional[str] = None
    deposit_amount: Optional[Decimal] = None
    deposit_currency: Optional[str] = None
    deposit_date: Optional[date] = None
    balance_due: Optional[Decimal] = None
    payment_status: Optional[str] = None
    is_sold: Optional[bool] = None
    
    # Import
    border_crossing: Optional[str] = None
    import_started_date: Optional[date] = None
    import_completed_date: Optional[date] = None
    customs_broker: Optional[str] = None
    import_cost_mxn: Optional[Decimal] = None
    customs_cost_mxn: Optional[Decimal] = None
    
    # Maintenance
    preventive_maintenance_cost: Optional[Decimal] = None
    preventive_maintenance_date: Optional[date] = None
    
    # Delivery
    delivery_date: Optional[date] = None
    delivery_method: Optional[str] = None
    
    # Exchange rate
    exchange_rate_used: Optional[Decimal] = None

class Inventory(BaseModel):
    inventory_id: int
    stock_number: str
    vin: str
    year: int
    make: str
    model: str
    body_style: Optional[str]
    bus_type: Optional[str]
    passenger_capacity: Optional[int]
    odometer: Optional[int]
    condition: str
    exterior_color: Optional[str]
    title_status: Optional[str]
    
    supplier_id: Optional[int]
    purchase_date: date
    purchase_price_usd: Decimal
    purchase_location: Optional[str]
    
    cost_in_us_stock_usd: Optional[Decimal]
    
    asking_price: Optional[Decimal]
    asking_currency: Optional[str]
    
    status: str
    current_location: str
    us_stock_location: Optional[str]
    mexico_stock_location: Optional[str]
    
    is_sold: bool
    sale_date: Optional[date]
    client_name: Optional[str]
    client_company: Optional[str]
    client_location: Optional[str]
    client_contact: Optional[str]
    client_email: Optional[str]
    client_use_case: Optional[str]
    sale_price: Optional[Decimal]
    sale_currency: Optional[str]
    deposit_amount: Optional[Decimal]
    payment_status: Optional[str]
    balance_due: Optional[Decimal]
    
    border_crossing: Optional[str]
    import_cost_mxn: Optional[Decimal]
    customs_cost_mxn: Optional[Decimal]
    
    delivery_date: Optional[date]
    warranty_status: Optional[str]
    warranty_end_date: Optional[date]
    days_in_warranty: Optional[int]
    
    days_in_inventory: Optional[int]
    
    description: Optional[str]
    internal_notes: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class WarrantyClaimCreate(BaseModel):
    claim_date: date
    claim_type: str  # 'Engine', 'Transmission', 'Both'
    description: str
    client_name: Optional[str] = None

class WarrantyClaim(WarrantyClaimCreate):
    claim_id: int
    inventory_id: int
    status: str
    resolution: Optional[str] = None
    cost: Optional[Decimal] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ==================== PRE-INSPECTION MODELS ====================

class PreInspectionCreate(BaseModel):
    vin: str
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    odometer: Optional[int] = None
    odometer_unit: str = "miles"
    passenger_capacity: Optional[int] = None
    wheelchair_capacity: Optional[int] = None
    engine_make: Optional[str] = None
    engine_model: Optional[str] = None
    engine_type: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    gvwr: Optional[int] = None
    length_feet: Optional[Decimal] = None
    exterior_color: Optional[str] = None
    interior_color: Optional[str] = None
    title_status: Optional[str] = None
    # NEW: Additional vehicle specs and safety
    body_style: Optional[str] = None
    brake_system: Optional[str] = None
    air_conditioning: Optional[bool] = None
    heater: Optional[bool] = None
    emergency_exits: Optional[int] = None
    fire_extinguisher: Optional[bool] = None
    first_aid_kit: Optional[bool] = None
    ada_compliant: Optional[bool] = None
    wheelchair_lift_ramp: Optional[str] = None
    inspection_location: Optional[str] = None
    seller_name: Optional[str] = None
    seller_asking_price: Optional[Decimal] = None
    seller_contact: Optional[str] = None
    inspection_date: date
    inspector_name: Optional[str] = None
    engine_condition: Optional[str] = None
    engine_starts: Optional[bool] = None
    engine_oil_condition: Optional[str] = None
    engine_coolant_condition: Optional[str] = None
    engine_leaks: Optional[bool] = None
    engine_noise: Optional[bool] = None
    engine_notes: Optional[str] = None
    transmission_condition: Optional[str] = None
    transmission_shifts_properly: Optional[bool] = None
    transmission_fluid_condition: Optional[str] = None
    transmission_leaks: Optional[bool] = None
    transmission_notes: Optional[str] = None
    suspension_condition: Optional[str] = None
    steering_condition: Optional[str] = None
    alignment_ok: Optional[bool] = None
    suspension_notes: Optional[str] = None
    chassis_condition: Optional[str] = None
    body_condition: Optional[str] = None
    rust_present: Optional[bool] = None
    rust_severity: Optional[str] = None
    structural_damage: Optional[bool] = None
    chassis_notes: Optional[str] = None
    brake_condition: Optional[str] = None
    brake_pads_percentage: Optional[int] = None
    brake_lines_condition: Optional[str] = None
    brake_notes: Optional[str] = None
    electrical_system_condition: Optional[str] = None
    lights_working: Optional[bool] = None
    battery_condition: Optional[str] = None
    alternator_working: Optional[bool] = None
    electrical_notes: Optional[str] = None
    interior_condition: Optional[str] = None
    seats_condition: Optional[str] = None
    floor_condition: Optional[str] = None
    interior_notes: Optional[str] = None
    road_test_performed: Optional[bool] = None
    road_test_notes: Optional[str] = None
    overall_rating: Optional[str] = None
    recommendation: Optional[str] = None
    estimated_repair_cost_usd: Optional[Decimal] = None
    inspector_notes: Optional[str] = None

class PreInspection(PreInspectionCreate):
    inspection_id: int
    purchased: bool = False
    inventory_id: Optional[int] = None
    purchase_date: Optional[date] = None
    actual_purchase_price: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True

# ==================== AUTHENTICATION MODELS ====================

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = 'manager'  # 'admin', 'manager'

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

class SessionResponse(BaseModel):
    user: dict
    session_token: str
    expires_at: str

# Database pool
db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
    yield
    await db_pool.close()

# FastAPI app
app = FastAPI(
    title="Buses America - Inventory Management API",
    version="3.0.0",
    description="Complete inventory management for used school bus dealer with Mexico import operations",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_db():
    async with db_pool.acquire() as connection:
        yield connection

# ==================== AUTHENTICATION HELPERS ====================

def hash_password(password: str) -> str:
    """Hash password using PBKDF2"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${pwd_hash.hex()}"

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    try:
        salt, pwd_hash = password_hash.split('$')
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return new_hash.hex() == pwd_hash
    except:
        return False

def generate_session_token() -> str:
    """Generate secure session token"""
    return secrets.token_urlsafe(32)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_db)
):
    """Get current authenticated user from session token"""
    token = credentials.credentials
    
    session = await db.fetchrow("""
        SELECT s.*, u.* 
        FROM user_sessions s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.session_token = $1 
        AND s.expires_at > CURRENT_TIMESTAMP
        AND u.is_active = TRUE
    """, token)
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    await db.execute("""
        UPDATE user_sessions 
        SET last_activity = CURRENT_TIMESTAMP 
        WHERE session_token = $1
    """, token)
    
    return dict(session)

async def require_admin(current_user: dict = Depends(get_current_user)):
    """Require admin role"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_manager_or_admin(current_user: dict = Depends(get_current_user)):
    """Require manager or admin role"""
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Manager or admin access required")
    return current_user

async def log_audit(
    db, user_id: int, username: str, action: str,
    table_name: str = None, record_id: int = None,
    old_values: dict = None, new_values: dict = None,
    description: str = None
):
    """Log action to audit trail"""

    def _serialize(obj):
        """Custom serializer for types not supported by json.dumps by default.
        Handles datetime, date, and Decimal — all common in asyncpg row dicts."""
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

    await db.execute("""
        INSERT INTO audit_log 
        (user_id, username, action, table_name, record_id, old_values, new_values, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, user_id, username, action, table_name, record_id,
         json.dumps(old_values, default=_serialize) if old_values else None,
         json.dumps(new_values, default=_serialize) if new_values else None,
         description)

# ==================== EXCHANGE RATE HELPER ====================

async def get_exchange_rate(db, from_curr: str, to_curr: str) -> float:
    """
    Get exchange rate from database, handling both directions
    Standardizes all exchange rate lookups across the application
    """
    # Try to get the exact rate
    rate = await db.fetchval(
        "SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1",
        from_curr, to_curr
    )
    
    if rate:
        return float(rate)
    
    # Try inverse rate
    inverse_rate = await db.fetchval(
        "SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1",
        to_curr, from_curr
    )
    
    if inverse_rate:
        return 1.0 / float(inverse_rate)
    
    # Fallback to any active rate (convert through USD if needed)
    any_rate = await db.fetchrow(
        "SELECT from_currency, to_currency, rate FROM exchange_rates WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
    )
    
    if any_rate:
        # If we have USD→MXN (17.5), and need MXN→USD, return 1/17.5
        if any_rate['from_currency'] == to_curr and any_rate['to_currency'] == from_curr:
            return 1.0 / float(any_rate['rate'])
        elif any_rate['from_currency'] == from_curr and any_rate['to_currency'] == to_curr:
            return float(any_rate['rate'])
    
    # Ultimate fallback based on standard USD→MXN rate of 17.5
    if from_curr == 'USD' and to_curr == 'MXN':
        return 17.5
    elif from_curr == 'MXN' and to_curr == 'USD':
        return 1.0 / 17.5  # 0.057142857
    
    return 1.0  # Same currency

# ==================== CENTRALIZED COST CALCULATION ====================

async def calculate_total_costs(db, inventory_id: int, target_currency: str = 'USD') -> dict:
    """
    SINGLE SOURCE OF TRUTH for cost calculations
    
    Calculates total costs for a vehicle in the specified currency
    Returns: {
        'purchase_price': float,
        'additional_costs': float,
        'total_cost': float,
        'currency': str,
        'breakdown': {
            'purchase_price_original': float,
            'purchase_currency': str,
            'cost_items': [list of costs],
            'exchange_rate_used': float
        }
    }
    """
    # Get inventory purchase info
    inventory = await db.fetchrow(
        "SELECT purchase_price_usd FROM inventory WHERE inventory_id = $1",
        inventory_id
    )
    
    if not inventory:
        return None
    
    # Get all cost items
    costs = await db.fetch(
        "SELECT cost_id, cost_category, description, amount, currency, vendor, date_incurred FROM cost_items WHERE inventory_id = $1",
        inventory_id
    )
    
    # Get exchange rate
    exchange_rate = await get_exchange_rate(db, 'MXN', 'USD')
    
    # Purchase price (always stored in USD)
    purchase_price_usd = float(inventory['purchase_price_usd'] or 0)
    
    # Convert purchase price to target currency
    if target_currency == 'USD':
        purchase_price_target = purchase_price_usd
    else:  # MXN
        purchase_price_target = purchase_price_usd / exchange_rate
    
    # Sum additional costs in target currency
    additional_costs_target = 0
    cost_breakdown = []
    
    for cost in costs:
        cost_amount = float(cost['amount'])
        cost_currency = cost['currency']
        
        # Convert to target currency
        if cost_currency == target_currency:
            cost_in_target = cost_amount
        elif target_currency == 'USD' and cost_currency == 'MXN':
            cost_in_target = cost_amount * exchange_rate
        elif target_currency == 'MXN' and cost_currency == 'USD':
            cost_in_target = cost_amount / exchange_rate
        else:
            cost_in_target = cost_amount
        
        additional_costs_target += cost_in_target
        
        cost_breakdown.append({
            'cost_id': cost['cost_id'],
            'category': cost['cost_category'],
            'description': cost['description'],
            'amount_original': cost_amount,
            'currency_original': cost_currency,
            'amount_in_target_currency': cost_in_target,
            'vendor': cost['vendor'],
            'date': cost['date_incurred']
        })
    
    total_cost = purchase_price_target + additional_costs_target
    
    return {
        'purchase_price': purchase_price_target,
        'additional_costs': additional_costs_target,
        'total_cost': total_cost,
        'currency': target_currency,
        'breakdown': {
            'purchase_price_original': purchase_price_usd,
            'purchase_currency': 'USD',
            'cost_items': cost_breakdown,
            'exchange_rate_used': exchange_rate
        }
    }

# ==================== ROOT ENDPOINT ====================

@app.get("/")
async def root():
    """Root endpoint - API status and available endpoints"""
    return {
        "message": "Buses America Inventory API",
        "status": "online",
        "version": "3.0.0",
        "tagline": "Juntos Movemos América",
        "documentation": "/docs",
        "endpoints": {
            "dashboard": "/api/reports/dashboard",
            "inventory": "/api/inventory",
            "suppliers": "/api/suppliers",
            "inspections": "/api/pre-inspections",
            "exchange_rates": "/api/exchange-rates/current"
        }
    }

@app.post("/admin/initialize-database")
async def initialize_database():
    """Initialize database with schema - ONE TIME USE ONLY"""
    try:
        # Read schema file
        with open('bus_inventory_schema_FINAL.sql', 'r') as f:
            schema_sql = f.read()
        
        # Connect to database
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Check if already initialized
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'inventory'"
        )
        
        if result > 0:
            await conn.close()
            return {
                "status": "already_initialized",
                "message": "Database already has tables. Skipping initialization."
            }
        
        # Execute schema statements
        statements = [s.strip() for s in schema_sql.split(';') if s.strip()]
        executed = 0
        
        for statement in statements:
            try:
                await conn.execute(statement)
                executed += 1
            except Exception as e:
                if "already exists" not in str(e):
                    print(f"Warning: {e}")
        
        await conn.close()
        
        return {
            "status": "success",
            "message": "Database initialized successfully!",
            "statements_executed": executed,
            "next_step": "Visit /api/inventory to verify"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database initialization failed: {str(e)}")

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/api/auth/login", response_model=SessionResponse)
async def login(credentials: UserLogin, db=Depends(get_db)):
    """User login - returns session token"""
    user = await db.fetchrow("""
        SELECT * FROM users 
        WHERE username = $1 AND is_active = TRUE
    """, credentials.username)
    
    if not user or not verify_password(credentials.password, user['password_hash']):
        await log_audit(db, None, credentials.username, 'login_failed',
                       description=f"Failed login attempt for {credentials.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = generate_session_token()
    expires_at = datetime.utcnow() + timedelta(hours=8)
    
    await db.execute("""
        INSERT INTO user_sessions (user_id, session_token, expires_at)
        VALUES ($1, $2, $3)
    """, user['user_id'], session_token, expires_at)
    
    await db.execute("""
        UPDATE users SET last_login = CURRENT_TIMESTAMP
        WHERE user_id = $1
    """, user['user_id'])
    
    await log_audit(db, user['user_id'], user['username'], 'login',
                   description=f"{user['full_name']} logged in")
    
    return {
        "user": dict(user),
        "session_token": session_token,
        "expires_at": expires_at.isoformat()
    }

@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """User logout"""
    await db.execute("""
        DELETE FROM user_sessions 
        WHERE user_id = $1
    """, current_user['user_id'])
    
    await log_audit(db, current_user['user_id'], current_user['username'], 'logout',
                   description=f"{current_user['full_name']} logged out")
    
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@app.post("/api/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_admin),
    db=Depends(get_db)
):
    """Create new user (admin only)"""
    password_hash = hash_password(user_data.password)
    
    new_user = await db.fetchrow("""
        INSERT INTO users (username, email, password_hash, full_name, role, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """, user_data.username, user_data.email, password_hash, 
         user_data.full_name, user_data.role, current_user['user_id'])
    
    await log_audit(db, current_user['user_id'], current_user['username'], 
                   'create', 'users', new_user['user_id'],
                   description=f"Created user {user_data.username}")
    
    return dict(new_user)

@app.get("/api/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_admin), db=Depends(get_db)):
    """List all users (admin only)"""
    users = await db.fetch("SELECT * FROM users ORDER BY created_at DESC")
    return [dict(u) for u in users]

@app.put("/api/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db=Depends(get_db)
):
    """Deactivate user (admin only)"""
    if user_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    await db.execute("UPDATE users SET is_active = FALSE WHERE user_id = $1", user_id)
    await log_audit(db, current_user['user_id'], current_user['username'],
                   'update', 'users', user_id,
                   description=f"Deactivated user ID {user_id}")
    
    return {"message": "User deactivated"}

@app.get("/api/audit-log")
async def get_audit_log(
    limit: int = 100,
    current_user: dict = Depends(require_admin),
    db=Depends(get_db)
):
    """Get audit log (admin only)"""
    logs = await db.fetch("""
        SELECT * FROM audit_log 
        ORDER BY timestamp DESC 
        LIMIT $1
    """, limit)
    return [dict(log) for log in logs]

# ==================== EXCHANGE RATE ENDPOINTS ====================

@app.get("/api/exchange-rates/current")
async def get_current_exchange_rate(db=Depends(get_db)):
    """Get current active USD/MXN exchange rate"""
    row = await db.fetchrow("""
        SELECT rate_id, from_currency, to_currency, rate, effective_date, created_at, is_active
        FROM exchange_rates
        WHERE is_active = TRUE
        ORDER BY effective_date DESC
        LIMIT 1
    """)
    if not row:
        raise HTTPException(status_code=404, detail="No active exchange rate found")
    return dict(row)

@app.post("/api/exchange-rates", response_model=ExchangeRate)
async def create_exchange_rate(
    rate: ExchangeRateCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Add new exchange rate"""
    query = """
        INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    """
    row = await db.fetchrow(query, rate.from_currency, rate.to_currency, rate.rate, rate.effective_date)

    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'exchange_rates', row['rate_id'],
        new_values=dict(row),
        description=f"Set exchange rate: {rate.from_currency}/{rate.to_currency} = {rate.rate} (effective {rate.effective_date})"
    )

    return dict(row)

@app.get("/api/exchange-rates", response_model=List[ExchangeRate])
async def get_exchange_rate_history(limit: int = 30, db=Depends(get_db)):
    """Get exchange rate history"""
    query = "SELECT * FROM exchange_rates ORDER BY effective_date DESC LIMIT $1"
    rows = await db.fetch(query, limit)
    return [dict(row) for row in rows]

# ==================== SUPPLIER ENDPOINTS ====================

@app.post("/api/suppliers", response_model=Supplier)
async def create_supplier(supplier: SupplierCreate, db=Depends(get_db)):
    """Create new supplier"""
    query = """
        INSERT INTO suppliers (company_name, contact_person, email, phone, address, 
                             city, state, supplier_type, payment_terms, country)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    """
    row = await db.fetchrow(
        query, supplier.company_name, supplier.contact_person, supplier.email, supplier.phone,
        supplier.address, supplier.city, supplier.state, supplier.supplier_type,
        supplier.payment_terms, supplier.country
    )
    return dict(row)

@app.get("/api/suppliers", response_model=List[Supplier])
async def get_suppliers(is_active: Optional[bool] = True, db=Depends(get_db)):
    """Get all suppliers"""
    if is_active is not None:
        query = "SELECT * FROM suppliers WHERE is_active = $1 ORDER BY company_name"
        rows = await db.fetch(query, is_active)
    else:
        query = "SELECT * FROM suppliers ORDER BY company_name"
        rows = await db.fetch(query)
    return [dict(row) for row in rows]

# ==================== PRE-PURCHASE INSPECTION ENDPOINTS ====================

@app.post("/api/inspections/pre-purchase", response_model=PrePurchaseInspection)
async def create_pre_purchase_inspection(inspection: PrePurchaseInspectionCreate, db=Depends(get_db)):
    """Create pre-purchase inspection (before buying the bus)"""
    query = """
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
            estimated_repair_cost_usd, max_purchase_price_recommendation
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38
        ) RETURNING *
    """
    row = await db.fetchrow(
        query, inspection.vin, inspection.stock_number_temp, inspection.year, inspection.make,
        inspection.model, inspection.odometer, inspection.inspection_date, inspection.inspector_name,
        inspection.inspection_location, inspection.engine_condition, inspection.engine_starts,
        inspection.engine_oil_condition, inspection.engine_coolant_condition, inspection.engine_leaks,
        inspection.engine_noise, inspection.engine_notes, inspection.transmission_condition,
        inspection.transmission_shifts_properly, inspection.transmission_fluid_condition,
        inspection.transmission_leaks, inspection.transmission_notes, inspection.suspension_condition,
        inspection.steering_condition, inspection.chassis_condition, inspection.body_condition,
        inspection.rust_present, inspection.rust_severity, inspection.brake_condition,
        inspection.brake_pads_percentage, inspection.electrical_system_condition,
        inspection.interior_condition, inspection.seats_condition, inspection.road_test_performed,
        inspection.road_test_notes, inspection.overall_rating, inspection.recommendation,
        inspection.estimated_repair_cost_usd, inspection.max_purchase_price_recommendation
    )
    return dict(row)

@app.get("/api/inspections/pre-purchase", response_model=List[PrePurchaseInspection])
async def get_pre_purchase_inspections(
    decision: Optional[str] = None,
    recommendation: Optional[str] = None,
    limit: int = 50,
    db=Depends(get_db)
):
    """Get pre-purchase inspections"""
    conditions = []
    params = []
    param_count = 1
    
    if decision:
        conditions.append(f"decision = ${param_count}")
        params.append(decision)
        param_count += 1
    
    if recommendation:
        conditions.append(f"recommendation = ${param_count}")
        params.append(recommendation)
        param_count += 1
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    query = f"""
        SELECT * FROM pre_purchase_inspections 
        WHERE {where_clause}
        ORDER BY inspection_date DESC 
        LIMIT ${param_count}
    """
    params.append(limit)
    
    rows = await db.fetch(query, *params)
    return [dict(row) for row in rows]

@app.patch("/api/inspections/pre-purchase/{inspection_id}/decision")
async def update_inspection_decision(
    inspection_id: int,
    decision: str,
    decision_notes: Optional[str] = None,
    db=Depends(get_db)
):
    """Update inspection decision (Approved/Rejected)"""
    query = """
        UPDATE pre_purchase_inspections 
        SET decision = $1, decision_date = CURRENT_DATE, decision_notes = $2
        WHERE inspection_id = $3
        RETURNING *
    """
    row = await db.fetchrow(query, decision, decision_notes, inspection_id)
    if not row:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return dict(row)

# ==================== INVENTORY ENDPOINTS ====================

@app.post("/api/inventory", response_model=Inventory)
async def create_inventory(
    inventory: InventoryCreate,
    current_user: dict = Depends(require_manager_or_admin),
    db=Depends(get_db)
):
    """Add new bus to inventory (after purchase) - Requires manager or admin role"""
    query = """
        INSERT INTO inventory (
            stock_number, vin, year, make, model, body_style, bus_type,
            passenger_capacity, wheelchair_capacity, engine_make, engine_model,
            engine_type, transmission, fuel_type, odometer, condition,
            exterior_color, interior_color, title_status, supplier_id,
            purchase_date, purchase_price_usd, purchase_location, purchase_invoice_number,
            transport_to_stock_cost_usd, initial_reconditioning_cost_usd, other_acquisition_costs_usd,
            asking_price, asking_currency, minimum_price, minimum_currency,
            status, current_location, us_stock_location, pre_inspection_id,
            features, description, internal_notes, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
            $32, $33, $34, $35, $36, $37, $38, $39
        ) RETURNING *
    """
    try:
        row = await db.fetchrow(
            query, inventory.stock_number, inventory.vin, inventory.year, inventory.make,
            inventory.model, inventory.body_style, inventory.bus_type, inventory.passenger_capacity,
            inventory.wheelchair_capacity, inventory.engine_make, inventory.engine_model,
            inventory.engine_type, inventory.transmission, inventory.fuel_type, inventory.odometer,
            inventory.condition, inventory.exterior_color, inventory.interior_color, inventory.title_status,
            inventory.supplier_id, inventory.purchase_date, inventory.purchase_price_usd,
            inventory.purchase_location, inventory.purchase_invoice_number,
            inventory.transport_to_stock_cost_usd, inventory.initial_reconditioning_cost_usd,
            inventory.other_acquisition_costs_usd, inventory.asking_price, inventory.asking_currency,
            inventory.minimum_price, inventory.minimum_currency, inventory.status, inventory.current_location,
            inventory.us_stock_location, inventory.pre_inspection_id, inventory.features,
            inventory.description, inventory.internal_notes, inventory.created_by
        )
        
        # Link inspection to inventory if provided
        if inventory.pre_inspection_id:
            await db.execute(
                "UPDATE pre_purchase_inspections SET inventory_id = $1 WHERE inspection_id = $2",
                row['inventory_id'], inventory.pre_inspection_id
            )
        
        await log_audit(
            db, current_user['user_id'], current_user['username'],
            'create', 'inventory', row['inventory_id'],
            new_values=dict(row),
            description=f"Added bus to inventory: {inventory.stock_number} — {inventory.year} {inventory.make} {inventory.model}"
        )

        return dict(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=400, detail="VIN or Stock Number already exists")

# ========================================
# RECORD PURCHASE PAYMENT (Accounting Entry)
# ========================================

class RecordPurchasePayment(BaseModel):
    payment_account_id: int
    payment_date: Optional[date] = None

@app.post("/api/inventory/{inventory_id}/record-purchase-payment")
async def record_purchase_payment(
    inventory_id: int,
    payment_data: RecordPurchasePayment,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Record the purchase payment as an accounting journal entry (Debit Inventory, Credit Bank)"""
    
    # Get inventory item
    bus = await db.fetchrow(
        "SELECT * FROM inventory WHERE inventory_id = $1 AND is_deleted = FALSE",
        inventory_id
    )
    if not bus:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    purchase_price = bus['purchase_price_usd']
    if not purchase_price or float(purchase_price) == 0:
        raise HTTPException(status_code=400, detail="No purchase price set for this inventory item")
    
    # Verify the bank account exists
    bank_account = await db.fetchrow(
        "SELECT account_id, account_name, currency FROM accounts WHERE account_id = $1 AND is_active = TRUE",
        payment_data.payment_account_id
    )
    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Find inventory asset account
    inventory_account = await db.fetchval(
        "SELECT account_id FROM accounts WHERE account_subtype = 'Inventory' AND is_active = TRUE LIMIT 1"
    )
    
    if not inventory_account:
        raise HTTPException(status_code=400, detail="No Inventory account found in chart of accounts")
    
    payment_dt = payment_data.payment_date or bus.get('purchase_date') or date.today()
    
    # Create journal entry: Debit Inventory Asset, Credit Bank
    trans_row = await db.fetchrow("""
        INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
        VALUES ($1, $2, 'purchase', $3, $4, $5)
        RETURNING transaction_id
    """, payment_dt,
        f"Purchase payment for {bus['stock_number']} — {bus['year']} {bus['make']} {bus['model']}",
        inventory_id, 'USD', user['username'])
    
    trans_id = trans_row['transaction_id']
    
    # Determine currency from the bank account
    line_currency = bank_account['currency'] or 'USD'
    
    # Debit Inventory Asset
    await db.execute("""
        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
        VALUES ($1, $2, $3, 0, $4, $5)
    """, trans_id, inventory_account, purchase_price, line_currency,
        f"Inventory asset — {bus['stock_number']}")
    
    # Credit Bank
    await db.execute("""
        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
        VALUES ($1, $2, 0, $3, $4, $5)
    """, trans_id, payment_data.payment_account_id, purchase_price, line_currency,
        f"Payment for purchase of {bus['stock_number']}")
    
    await update_account_balances(db, trans_id)
    
    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'transactions', trans_id,
        new_values={
            'transaction_id': trans_id,
            'inventory_id': inventory_id,
            'stock_number': bus['stock_number'],
            'amount': str(purchase_price),
            'bank_account': bank_account['account_name'],
        },
        description=(
            f"Purchase payment recorded: {bus['stock_number']} — "
            f"${purchase_price} from {bank_account['account_name']}"
        )
    )
    
    return {
        "message": f"Purchase payment of ${purchase_price} recorded for {bus['stock_number']}",
        "transaction_id": trans_id
    }

@app.get("/api/inventory", response_model=List[Inventory])
async def get_inventory(
    status: Optional[str] = None,
    current_location: Optional[str] = None,
    is_sold: Optional[bool] = None,
    make: Optional[str] = None,
    year: Optional[int] = None,
    supplier_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db=Depends(get_db)
):
    """Get inventory with filters"""
    conditions = ["i.is_deleted = FALSE"]
    params = []
    param_count = 1
    
    if status:
        conditions.append(f"i.status = ${param_count}")
        params.append(status)
        param_count += 1
    
    if current_location:
        conditions.append(f"i.current_location = ${param_count}")
        params.append(current_location)
        param_count += 1
    
    if is_sold is not None:
        conditions.append(f"i.is_sold = ${param_count}")
        params.append(is_sold)
        param_count += 1
    
    if make:
        conditions.append(f"i.make ILIKE ${param_count}")
        params.append(f"%{make}%")
        param_count += 1
    
    if year:
        conditions.append(f"i.year = ${param_count}")
        params.append(year)
        param_count += 1
    
    if supplier_id:
        conditions.append(f"i.supplier_id = ${param_count}")
        params.append(supplier_id)
        param_count += 1
    
    where_clause = " AND ".join(conditions)
    query = f"""
        SELECT i.*, 
               c.client_name, c.client_company, c.client_location, 
               c.client_contact, c.client_email, c.client_use_case
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE {where_clause}
        ORDER BY i.created_at DESC
        LIMIT ${param_count} OFFSET ${param_count + 1}
    """
    params.extend([limit, offset])
    
    rows = await db.fetch(query, *params)
    return [dict(row) for row in rows]

@app.get("/api/inventory/{inventory_id}", response_model=Inventory)
async def get_inventory_item(inventory_id: int, db=Depends(get_db)):
    """Get specific inventory item"""
    query = "SELECT * FROM inventory WHERE inventory_id = $1 AND is_deleted = FALSE"
    row = await db.fetchrow(query, inventory_id)
    if not row:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return dict(row)

@app.patch("/api/inventory/{inventory_id}")
async def update_inventory(
    inventory_id: int,
    updates: InventoryUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Update inventory item"""
    update_dict = updates.dict(exclude_unset=True)
    
    # Safety: strip any fields that come from JOINed tables, not the inventory table itself
    NON_INVENTORY_FIELDS = {
        'client_name', 'client_company', 'client_location',
        'client_contact', 'client_email', 'client_phone', 'client_use_case'
    }
    update_dict = {k: v for k, v in update_dict.items() if k not in NON_INVENTORY_FIELDS}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Fetch old values before update for audit trail
    old_row = await db.fetchrow(
        "SELECT * FROM inventory WHERE inventory_id = $1 AND is_deleted = FALSE",
        inventory_id
    )
    if not old_row:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    set_clauses = []
    values = [inventory_id]
    param_count = 2
    
    for field, value in update_dict.items():
        set_clauses.append(f"{field} = ${param_count}")
        values.append(value)
        param_count += 1
    
    query = f"""
        UPDATE inventory 
        SET {', '.join(set_clauses)}
        WHERE inventory_id = $1 AND is_deleted = FALSE
        RETURNING *
    """
    
    row = await db.fetchrow(query, *values)
    if not row:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    # Determine if this is a sale event for a more descriptive log
    if update_dict.get('is_sold'):
        action_description = (
            f"Marked as SOLD: {old_row['stock_number']} — "
            f"{old_row['year']} {old_row['make']} {old_row['model']} "
            f"@ {update_dict.get('sale_price')} {update_dict.get('sale_currency', '')}"
        )
    else:
        changed_fields = ', '.join(update_dict.keys())
        action_description = (
            f"Updated inventory {old_row['stock_number']} — "
            f"{old_row['year']} {old_row['make']} {old_row['model']}. "
            f"Fields changed: {changed_fields}"
        )

    await log_audit(
        db, current_user['user_id'], current_user['username'],
        'update', 'inventory', inventory_id,
        old_values=dict(old_row),
        new_values=dict(row),
        description=action_description
    )

    return dict(row)

@app.delete("/api/inventory/{inventory_id}")
async def delete_inventory(
    inventory_id: int,
    current_user: dict = Depends(require_admin),
    db=Depends(get_db)
):
    """Soft delete inventory item - ADMIN ONLY"""
    query = "UPDATE inventory SET is_deleted = TRUE WHERE inventory_id = $1 RETURNING inventory_id, stock_number"
    row = await db.fetchrow(query, inventory_id)
    if not row:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    await log_audit(db, current_user['user_id'], current_user['username'],
                   'delete', 'inventory', inventory_id,
                   description=f"Deleted bus {row['stock_number']}")
    
    return {"message": "Inventory item deleted successfully"}

# ==================== COST ITEMS ENDPOINTS ====================

@app.get("/api/inventory/{inventory_id}/costs")
async def get_inventory_costs(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get all cost items for an inventory unit"""
    query = """
        SELECT cost_id, inventory_id, cost_category, description, amount, currency,
               vendor, invoice_number, date_incurred, created_at, created_by
        FROM cost_items
        WHERE inventory_id = $1
        ORDER BY date_incurred DESC, created_at DESC
    """
    rows = await db.fetch(query, inventory_id)
    return [dict(row) for row in rows]

@app.get("/api/inventory/{inventory_id}/costs/summary")
async def get_inventory_costs_summary(
    inventory_id: int,
    currency: str = 'USD',
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Get complete cost summary with breakdown
    SINGLE SOURCE OF TRUTH for cost calculations
    """
    cost_data = await calculate_total_costs(db, inventory_id, currency)
    
    if not cost_data:
        raise HTTPException(status_code=404, detail="Inventory not found or costs unavailable")
    
    return cost_data

@app.post("/api/inventory/{inventory_id}/costs")
async def add_inventory_cost(
    inventory_id: int,
    cost_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Add a cost item to an inventory unit and create accounting entry"""
    
    # Verify inventory exists
    inv_check = await db.fetchval(
        "SELECT inventory_id FROM inventory WHERE inventory_id = $1",
        inventory_id
    )
    if not inv_check:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    # Convert date string to date object if needed
    from datetime import datetime
    date_incurred = cost_data.get('date_incurred')
    if isinstance(date_incurred, str):
        date_incurred = datetime.strptime(date_incurred, '%Y-%m-%d').date()
    
    # Start transaction for both cost entry and accounting entry
    async with db.transaction():
        # Insert cost item
        cost_query = """
            INSERT INTO cost_items (
                inventory_id, cost_category, description, amount, currency,
                vendor, invoice_number, date_incurred, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        """
        cost_row = await db.fetchrow(
            cost_query,
            inventory_id,
            cost_data.get('cost_category'),
            cost_data.get('description'),
            cost_data.get('amount'),
            cost_data.get('currency', 'USD'),
            cost_data.get('vendor'),
            cost_data.get('invoice_number'),
            date_incurred,
            user['username']
        )
        
        # Create accounting entry
        # Determine which accounts to use based on cost category
        cost_category = cost_data.get('cost_category')
        amount = float(cost_data.get('amount'))
        currency = cost_data.get('currency', 'USD')
        payment_account_id = cost_data.get('payment_account_id')  # Bank/cash account paid from
        
        # Convert payment_account_id to int if it's a string
        if payment_account_id:
            payment_account_id = int(payment_account_id)
        
        # Map cost categories to expense accounts
        category_to_account = {
            # ASSET ACCOUNTS (adds to bus value)
            'Purchase': '1200',                    # Bus Inventory
            'Other Acquisition': '1200',           # Bus Inventory
            'Initial Reconditioning': '1200',      # Bus Inventory
            
            # EXPENSE ACCOUNTS
            'Transport to Stock': '5100',          # Transportation Costs
            'Import': '5200',                      # Import/Customs Fees
            'Customs': '5200',                     # Import/Customs Fees
            'Regulatory': '5530',                  # Vehicle Registration & Permits
            'Preventive Maintenance': '5520',      # Vehicle Repairs & Maintenance
            'Transport to Client': '5100',         # Transportation Costs
            'Repair': '5520',                      # Vehicle Repairs & Maintenance
            'Other': '5900'                        # Other Expenses
        }
        
        expense_account_code = category_to_account.get(cost_category, '5900')
        
        # Get account IDs
        expense_account_id = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_code = $1",
            expense_account_code
        )
        
        # If no payment account specified, default to first cash account in same currency
        if not payment_account_id:
            payment_account_id = await db.fetchval(
                """
                SELECT account_id FROM accounts 
                WHERE account_type = 'Asset' 
                  AND account_subtype = 'Cash' 
                  AND currency IN ('BOTH', $1)
                LIMIT 1
                """,
                currency
            )
        
        # Generate reference number
        reference_number = await generate_transaction_reference(
            db,
            'expense',
            date_incurred
        )
        
        # Create accounting transaction
        trans_description = f"Cost - {cost_category} - {cost_data.get('description', 'Inventory cost')}"
        
        trans_query = """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id,
                currency, created_by, reference_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING transaction_id
        """
        
        trans_id = await db.fetchval(
            trans_query,
            date_incurred,
            trans_description,
            'cost',
            cost_row['cost_id'],
            currency,
            user['username'],
            reference_number
        )
        
        # Create transaction lines
        # Debit: Expense/Inventory account (increases expense or asset)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount, currency, notes
            ) VALUES ($1, $2, $3, $4, $5, $6)
            """,
            trans_id,
            expense_account_id,
            amount,
            0,
            currency,
            f"{cost_category} - {cost_data.get('vendor', 'N/A')}"
        )
        
        # Credit: Bank/Cash account (decreases cash)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount, currency, notes
            ) VALUES ($1, $2, $3, $4, $5, $6)
            """,
            trans_id,
            payment_account_id,
            0,
            amount,
            currency,
            f"Payment for {cost_category}"
        )
        
        # Update account balances
        await update_account_balances(db, trans_id)
        
        # Note: cost_items table doesn't have a notes column
        # Accounting reference is tracked in the transactions table via reference_number
        
        # Audit log
        await log_audit(
            db, user['user_id'], user['username'],
            'create', 'cost_items', cost_row['cost_id'],
            new_values=dict(cost_row),
            description=f"Added cost with accounting entry: {cost_data.get('description')} - {amount} {currency}"
        )
    
    return dict(cost_row)

@app.delete("/api/inventory/{inventory_id}/costs/{cost_id}")
async def delete_inventory_cost(
    inventory_id: int,
    cost_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Delete a cost item"""
    # Verify cost belongs to this inventory
    cost = await db.fetchrow(
        "SELECT * FROM cost_items WHERE cost_id = $1 AND inventory_id = $2",
        cost_id, inventory_id
    )
    if not cost:
        raise HTTPException(status_code=404, detail="Cost item not found")
    
    await db.execute("DELETE FROM cost_items WHERE cost_id = $1", cost_id)
    
    await log_audit(
        db, user['user_id'], user['username'],
        'delete', 'cost_items', cost_id,
        old_values=dict(cost),
        description=f"Deleted cost: {cost['description']}"
    )
    
    return {"message": "Cost deleted successfully"}

# ==================== PAYMENT ENDPOINTS ====================

# UPDATED PAYMENT ENDPOINTS - MULTI-CURRENCY SUPPORT
# Replace the existing payment endpoints in backend_api_FINAL.py

# ==================== PAYMENT TRACKING (MULTI-CURRENCY) ====================

@app.post("/api/inventory/{inventory_id}/payments")
async def add_payment(
    inventory_id: int,
    payment: PaymentCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Add a payment to an inventory item (supports multi-currency)"""
    
    # Verify inventory exists and is sold
    inventory = await db.fetchrow(
        "SELECT inventory_id, sale_currency, sale_price FROM inventory WHERE inventory_id = $1 AND is_sold = TRUE",
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Sold inventory not found")
    
    sale_currency = inventory['sale_currency']
    sale_price = float(inventory['sale_price'])
    
    # Get current exchange rate
    rate_row = await db.fetchrow(
        "SELECT rate FROM exchange_rates ORDER BY created_at DESC LIMIT 1"
    )
    exchange_rate = float(rate_row['rate']) if rate_row else 17.50
    
    # Insert payment
    query = """
        INSERT INTO payments (
            inventory_id, payment_amount, payment_currency, payment_date, 
            payment_method, payment_type, reference_number, payment_notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    """
    
    row = await db.fetchrow(
        query,
        inventory_id,
        payment.payment_amount,
        payment.payment_currency,  # Can be different from sale_currency!
        payment.payment_date,
        payment.payment_method,
        payment.payment_type,
        payment.reference_number,
        payment.payment_notes,
        user['username']
    )
    
    # Update payment status and balance
    await update_payment_status(db, inventory_id, sale_currency, sale_price, exchange_rate)

    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'payments', row['payment_id'],
        new_values=dict(row),
        description=(
            f"Payment recorded on inventory #{inventory_id}: "
            f"{payment.payment_amount} {payment.payment_currency} "
            f"via {payment.payment_method} ({payment.payment_type})"
        )
    )

    # Create accounting entry if bank account was specified
    if payment.payment_account_id:
        try:
            # Find AR account for this currency
            ar_account = await db.fetchval(
                "SELECT account_id FROM accounts WHERE account_subtype = 'AR' AND currency = $1 AND is_active = TRUE LIMIT 1",
                payment.payment_currency
            )
            # Fallback: any AR account
            if not ar_account:
                ar_account = await db.fetchval(
                    "SELECT account_id FROM accounts WHERE account_subtype = 'AR' AND is_active = TRUE LIMIT 1"
                )

            if ar_account:
                # Get bus info for description
                bus_info = await db.fetchrow(
                    "SELECT stock_number, year, make, model FROM inventory WHERE inventory_id = $1",
                    inventory_id
                )
                bus_desc = f"{bus_info['stock_number']} — {bus_info['year']} {bus_info['make']} {bus_info['model']}" if bus_info else f"inventory #{inventory_id}"

                # Create journal entry: Debit Bank, Credit AR
                trans_row = await db.fetchrow("""
                    INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
                    VALUES ($1, $2, 'payment', $3, $4, $5)
                    RETURNING transaction_id
                """, payment.payment_date,
                    f"Payment received for {bus_desc} — {payment.payment_method} ({payment.payment_type})",
                    row['payment_id'], payment.payment_currency, user['username'])

                trans_id = trans_row['transaction_id']

                # Debit Bank (cash in)
                await db.execute("""
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, $3, 0, $4, $5)
                """, trans_id, payment.payment_account_id, payment.payment_amount, payment.payment_currency,
                    f"Payment received — {payment.payment_method}")

                # Credit AR (reduce receivable)
                await db.execute("""
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, 0, $3, $4, $5)
                """, trans_id, ar_account, payment.payment_amount, payment.payment_currency,
                    f"AR reduction — {payment.payment_type} for {bus_desc}")

                await update_account_balances(db, trans_id)
        except Exception as e:
            print(f"Warning: Payment saved but accounting entry failed: {e}")

    result = dict(row)
    result['message'] = (
        f"Payment of {payment.payment_amount} {payment.payment_currency} "
        f"recorded via {payment.payment_method}"
    )
    return result

async def update_payment_status(db, inventory_id: int, sale_currency: str, sale_price: float, exchange_rate: float):
    """
    Update payment_status and balance_due based on total payments received
    Handles multi-currency conversion automatically
    """
    
    # Get all payments for this inventory
    payments = await db.fetch(
        """
        SELECT payment_amount, payment_currency 
        FROM payments 
        WHERE inventory_id = $1
        ORDER BY payment_date
        """,
        inventory_id
    )
    
    # Convert all payments to sale currency
    total_paid_in_sale_currency = 0
    
    for payment in payments:
        payment_amount = float(payment['payment_amount'])
        payment_currency = payment['payment_currency']
        
        if payment_currency == sale_currency:
            # Same currency - no conversion needed
            converted_amount = payment_amount
        elif sale_currency == 'USD' and payment_currency == 'MXN':
            # Payment in MXN, Sale in USD: divide by rate
            converted_amount = payment_amount / exchange_rate
        elif sale_currency == 'MXN' and payment_currency == 'USD':
            # Payment in USD, Sale in MXN: multiply by rate
            converted_amount = payment_amount * exchange_rate
        else:
            # Shouldn't happen, but default to no conversion
            converted_amount = payment_amount
        
        total_paid_in_sale_currency += converted_amount
    
    # Calculate balance due in sale currency
    balance_due = sale_price - total_paid_in_sale_currency
    
    # Determine payment status
    if balance_due <= 0.01:  # Paid in full (allow for rounding)
        payment_status = "Paid in Full"
        balance_due = 0
    elif total_paid_in_sale_currency > 0:
        payment_status = "Partial Payment"
    else:
        payment_status = "Pending Deposit"
    
    # Update inventory
    await db.execute(
        """
        UPDATE inventory 
        SET payment_status = $1, balance_due = $2
        WHERE inventory_id = $3
        """,
        payment_status, balance_due, inventory_id
    )

@app.get("/api/inventory/{inventory_id}/payments")
async def get_payments(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get all payments for an inventory item with converted amounts"""
    
    # Get sale info for conversion context
    inventory = await db.fetchrow(
        "SELECT sale_currency, sale_price FROM inventory WHERE inventory_id = $1",
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    
    sale_currency = inventory['sale_currency']
    
    # Get exchange rate
    rate_row = await db.fetchrow(
        "SELECT rate FROM exchange_rates ORDER BY created_at DESC LIMIT 1"
    )
    exchange_rate = float(rate_row['rate']) if rate_row else 17.50
    
    # Get payments
    query = """
        SELECT * FROM payments 
        WHERE inventory_id = $1 
        ORDER BY payment_date, created_at
    """
    
    rows = await db.fetch(query, inventory_id)
    payments = []
    
    for row in rows:
        payment_dict = dict(row)
        payment_amount = float(payment_dict['payment_amount'])
        payment_currency = payment_dict['payment_currency']
        
        # Calculate converted amount (to sale currency)
        if payment_currency == sale_currency:
            converted_amount = payment_amount
        elif sale_currency == 'USD' and payment_currency == 'MXN':
            converted_amount = payment_amount / exchange_rate
        elif sale_currency == 'MXN' and payment_currency == 'USD':
            converted_amount = payment_amount * exchange_rate
        else:
            converted_amount = payment_amount
        
        payment_dict['converted_amount'] = converted_amount
        payment_dict['conversion_rate'] = exchange_rate if payment_currency != sale_currency else None
        payments.append(payment_dict)
    
    return {
        'payments': payments,
        'sale_currency': sale_currency,
        'exchange_rate': exchange_rate
    }

@app.delete("/api/inventory/{inventory_id}/payments/{payment_id}")
async def delete_payment(
    inventory_id: int,
    payment_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Delete a payment and recalculate balance"""
    
    # Get sale info for recalculation
    inventory = await db.fetchrow(
        "SELECT sale_currency, sale_price FROM inventory WHERE inventory_id = $1",
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    
    sale_currency = inventory['sale_currency']
    sale_price = float(inventory['sale_price'])
    
    # Get exchange rate
    rate_row = await db.fetchrow(
        "SELECT rate FROM exchange_rates ORDER BY created_at DESC LIMIT 1"
    )
    exchange_rate = float(rate_row['rate']) if rate_row else 17.50
    
    # Delete payment
    result = await db.execute(
        "DELETE FROM payments WHERE payment_id = $1 AND inventory_id = $2",
        payment_id, inventory_id
    )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Recalculate payment status
    await update_payment_status(db, inventory_id, sale_currency, sale_price, exchange_rate)

    await log_audit(
        db, user['user_id'], user['username'],
        'delete', 'payments', payment_id,
        description=f"Deleted payment #{payment_id} on inventory #{inventory_id}"
    )

    return {"message": "Payment deleted successfully"}

# ==================== SALES ROUTE ALIASES ====================
# The SalesManagement frontend calls /api/sales/{id}/payment
# These aliases forward to the existing inventory payment handlers

@app.post("/api/sales/{inventory_id}/payment")
async def add_sale_payment(
    inventory_id: int,
    payment: PaymentCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Alias: Record a payment on a sale (forwards to inventory payments)"""
    return await add_payment(inventory_id, payment, db, user)

@app.post("/api/sales/{inventory_id}/import-payments")
async def import_sale_payments(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Import existing payments into accounting entries"""
    # Get all payments for this sale
    payments = await db.fetch(
        "SELECT * FROM payments WHERE inventory_id = $1 ORDER BY payment_date",
        inventory_id
    )
    
    if not payments:
        raise HTTPException(status_code=404, detail="No payments found to import")
    
    imported = 0
    for payment in payments:
        try:
            # Check if an accounting entry already exists for this payment
            existing = await db.fetchval(
                "SELECT transaction_id FROM transactions WHERE reference_type = 'payment' AND reference_id = $1",
                payment['payment_id']
            )
            if existing:
                continue
            
            # Find bank account and AR account
            bank_account_id = payment.get('payment_account_id')
            ar_account = await db.fetchval(
                "SELECT account_id FROM accounts WHERE account_subtype = 'AR' AND is_active = TRUE LIMIT 1"
            )
            
            if not bank_account_id or not ar_account:
                continue
            
            # Create journal entry: Debit Bank, Credit AR
            trans_row = await db.fetchrow("""
                INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
                VALUES ($1, $2, 'payment', $3, $4, $5)
                RETURNING transaction_id
            """, payment['payment_date'],
                f"Payment received for inventory #{inventory_id} — {payment['payment_method']}",
                payment['payment_id'], payment['payment_currency'], user['username'])
            
            trans_id = trans_row['transaction_id']
            
            pay_currency = payment['payment_currency'] or 'USD'
            
            # Debit Bank
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, 0, $4, $5)
            """, trans_id, bank_account_id, payment['payment_amount'], pay_currency,
                f"Payment received — {payment['payment_method']}")
            
            # Credit AR
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, 0, $3, $4, $5)
            """, trans_id, ar_account, payment['payment_amount'], pay_currency,
                f"AR reduction — payment on inventory #{inventory_id}")
            
            await update_account_balances(db, trans_id)
            imported += 1
        except Exception as e:
            print(f"Warning: Could not import payment {payment['payment_id']}: {e}")
    
    return {"message": f"Imported {imported} of {len(payments)} payments into accounting"}

# ==================== SALES ANALYTICS ENDPOINT ====================

@app.get("/api/reports/sales-analytics")
async def get_sales_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    currency: Optional[str] = None,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Get comprehensive sales analytics
    Returns: overview metrics, client analytics, financial breakdown, and detailed sales
    """
    from datetime import datetime, timedelta
    
    # Default to last 12 months if no dates provided
    if not end_date:
        end_date = datetime.now().date()
    else:
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    if not start_date:
        start_date = end_date - timedelta(days=365)
    else:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
    
    # Build base query with filters
    where_clauses = ["i.is_sold = TRUE", "i.is_deleted = FALSE"]
    params = []
    param_count = 1
    
    # Date filter
    where_clauses.append(f"i.sale_date >= ${param_count}")
    params.append(start_date)
    param_count += 1
    
    where_clauses.append(f"i.sale_date <= ${param_count}")
    params.append(end_date)
    param_count += 1
    
    # Currency filter (optional)
    if currency and currency != 'ALL':
        where_clauses.append(f"i.sale_currency = ${param_count}")
        params.append(currency)
        param_count += 1
    
    where_clause = " AND ".join(where_clauses)
    
    # ========== OVERVIEW METRICS ==========
    overview_query = f"""
        SELECT 
            COUNT(*) as total_sales,
            COUNT(DISTINCT i.client_id) as unique_clients,
            SUM(CASE WHEN i.sale_currency = 'USD' THEN i.sale_price ELSE 0 END) as revenue_usd,
            SUM(CASE WHEN i.sale_currency = 'MXN' THEN i.sale_price ELSE 0 END) as revenue_mxn,
            SUM(CASE WHEN i.payment_status = 'Paid in Full' THEN 0 ELSE COALESCE(i.balance_due, 0) END) as pending_balance_total,
            COUNT(CASE WHEN i.payment_status = 'Paid in Full' THEN 1 END) as paid_in_full_count,
            COUNT(CASE WHEN i.payment_status = 'Partial Payment' THEN 1 END) as partial_payment_count,
            COUNT(CASE WHEN i.payment_status = 'Pending Deposit' THEN 1 END) as pending_deposit_count
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE {where_clause}
    """
    overview = await db.fetchrow(overview_query, *params)
    
    # ========== DETAILED SALES WITH PROFIT CALCULATION ==========
    # Get all sold inventory with costs
    sales_query = f"""
        SELECT 
            i.inventory_id,
            i.stock_number,
            i.year,
            i.make,
            i.model,
            i.vin,
            i.sale_date,
            c.client_name,
            c.client_company,
            c.client_location,
            c.client_use_case,
            i.sale_price,
            i.sale_currency,
            i.purchase_price_usd,
            i.payment_status,
            i.balance_due,
            COALESCE(i.total_cost_usd, i.purchase_price_usd) as total_cost_usd,
            COALESCE(i.total_cost_mxn, 0) as total_cost_mxn
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE {where_clause}
        ORDER BY i.sale_date DESC
    """
    sales_rows = await db.fetch(sales_query, *params)
    
    # Get costs for each sale
    detailed_sales = []
    total_profit_usd = 0
    total_profit_mxn = 0
    
    for sale in sales_rows:
        # Get costs using centralized calculation (SINGLE SOURCE OF TRUTH)
        sale_currency = sale['sale_currency']
        cost_data = await calculate_total_costs(db, sale['inventory_id'], sale_currency)
        
        if not cost_data:
            continue
        
        total_cost = cost_data['total_cost']
        exchange_rate = cost_data['breakdown']['exchange_rate_used']
        
        # Calculate profit
        sale_price = float(sale['sale_price'] or 0)
        profit = sale_price - total_cost
        profit_margin = (profit / sale_price * 100) if sale_price > 0 else 0
        
        # Track profit by currency
        if sale_currency == 'USD':
            total_profit_usd += profit
        else:  # MXN
            total_profit_mxn += profit
        
        detailed_sales.append({
            'inventory_id': sale['inventory_id'],
            'stock_number': sale['stock_number'],
            'vehicle': f"{sale['year']} {sale['make']} {sale['model']}",
            'vin': sale['vin'],
            'sale_date': sale['sale_date'].isoformat() if sale['sale_date'] else None,
            'client_name': sale['client_name'],
            'client_company': sale['client_company'],
            'client_location': sale['client_location'],
            'client_use_case': sale['client_use_case'],
            'sale_price': sale_price,
            'sale_currency': sale_currency,
            'purchase_price': cost_data['purchase_price'],
            'additional_costs': cost_data['additional_costs'],
            'total_cost': total_cost,
            'profit': profit,
            'profit_margin': profit_margin,
            'payment_status': sale['payment_status'],
            'balance_due': float(sale['balance_due'] or 0)
        })
    
    # ========== CLIENT ANALYTICS ==========
    client_analytics_query = f"""
        SELECT 
            c.client_name,
            c.client_company,
            c.client_location,
            COUNT(*) as total_purchases,
            SUM(CASE WHEN i.sale_currency = 'USD' THEN i.sale_price ELSE 0 END) as total_spent_usd,
            SUM(CASE WHEN i.sale_currency = 'MXN' THEN i.sale_price ELSE 0 END) as total_spent_mxn,
            MAX(i.sale_date) as last_purchase_date,
            STRING_AGG(DISTINCT c.client_use_case, ', ') as use_cases
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE {where_clause} AND c.client_name IS NOT NULL
        GROUP BY c.client_name, c.client_company, c.client_location
        ORDER BY total_purchases DESC, total_spent_usd DESC
        LIMIT 10
    """
    top_clients = await db.fetch(client_analytics_query, *params)
    
    # Use case breakdown
    use_case_query = f"""
        SELECT 
            COALESCE(c.client_use_case, 'Not Specified') as use_case,
            COUNT(*) as count,
            SUM(CASE WHEN i.sale_currency = 'USD' THEN i.sale_price ELSE 0 END) as revenue_usd,
            SUM(CASE WHEN i.sale_currency = 'MXN' THEN i.sale_price ELSE 0 END) as revenue_mxn
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE {where_clause}
        GROUP BY c.client_use_case
        ORDER BY count DESC
    """
    use_case_breakdown = await db.fetch(use_case_query, *params)
    
    # ========== MONTHLY TRENDS ==========
    monthly_query = f"""
        SELECT 
            DATE_TRUNC('month', i.sale_date) as month,
            COUNT(*) as sales_count,
            SUM(CASE WHEN i.sale_currency = 'USD' THEN i.sale_price ELSE 0 END) as revenue_usd,
            SUM(CASE WHEN i.sale_currency = 'MXN' THEN i.sale_price ELSE 0 END) as revenue_mxn
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE {where_clause}
        GROUP BY DATE_TRUNC('month', i.sale_date)
        ORDER BY month
    """
    monthly_trends = await db.fetch(monthly_query, *params)
    
    # Calculate average profit margin
    total_sales_count = len(detailed_sales)
    avg_profit_margin = sum(s['profit_margin'] for s in detailed_sales) / total_sales_count if total_sales_count > 0 else 0
    
    return {
        'overview': {
            'total_sales': overview['total_sales'],
            'unique_clients': overview['unique_clients'],
            'revenue_usd': float(overview['revenue_usd'] or 0),
            'revenue_mxn': float(overview['revenue_mxn'] or 0),
            'total_profit_usd': total_profit_usd,
            'total_profit_mxn': total_profit_mxn,
            'avg_profit_margin': avg_profit_margin,
            'pending_balance': float(overview['pending_balance_total'] or 0),
            'payment_status_breakdown': {
                'paid_in_full': overview['paid_in_full_count'],
                'partial_payment': overview['partial_payment_count'],
                'pending_deposit': overview['pending_deposit_count']
            }
        },
        'client_analytics': {
            'top_clients': [dict(row) for row in top_clients],
            'use_case_breakdown': [dict(row) for row in use_case_breakdown]
        },
        'financial_analysis': {
            'detailed_sales': detailed_sales,
            'total_profit_usd': total_profit_usd,
            'total_profit_mxn': total_profit_mxn,
            'avg_profit_margin': avg_profit_margin
        },
        'trends': {
            'monthly': [
                {
                    'month': row['month'].isoformat() if row['month'] else None,
                    'sales_count': row['sales_count'],
                    'revenue_usd': float(row['revenue_usd'] or 0),
                    'revenue_mxn': float(row['revenue_mxn'] or 0)
                }
                for row in monthly_trends
            ]
        },
        'filters': {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'currency': currency or 'ALL'
        }
    }

# ========================================
# CLIENTS ENDPOINT
# ========================================

@app.get("/api/clients")
async def get_clients(
    include_analytics: bool = False,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get all clients with optional analytics"""
    
    if not include_analytics:
        # Simple list without analytics
        query = """
            SELECT 
                client_id,
                client_name,
                client_company,
                client_location,
                client_use_case,
                client_phone,
                client_email,
                billing_address,
                tax_id,
                contact_person,
                notes,
                credit_terms,
                payment_reliability,
                preferred_payment_method,
                created_at,
                updated_at
            FROM clients
            WHERE is_deleted = FALSE
            ORDER BY client_name
        """
        clients = await db.fetch(query)
        return [dict(client) for client in clients]
    
    # Full list with analytics
    query = """
        SELECT 
            c.client_id,
            c.client_name,
            c.client_company,
            c.client_location,
            c.client_use_case,
            c.client_phone,
            c.client_email,
            c.billing_address,
            c.tax_id,
            c.contact_person,
            c.notes,
            c.credit_terms,
            c.payment_reliability,
            c.preferred_payment_method,
            c.created_at,
            c.updated_at,
            COUNT(i.inventory_id) as total_purchases,
            SUM(CASE WHEN i.sale_currency = 'USD' THEN i.sale_price ELSE 0 END) as total_spent_usd,
            SUM(CASE WHEN i.sale_currency = 'MXN' THEN i.sale_price ELSE 0 END) as total_spent_mxn,
            MAX(i.sale_date) as last_purchase_date,
            STRING_AGG(DISTINCT i.body_style, ', ') as favorite_bus_types
        FROM clients c
        LEFT JOIN inventory i ON c.client_id = i.client_id AND i.is_sold = TRUE
        WHERE c.is_deleted = FALSE
        GROUP BY c.client_id, c.client_name, c.client_company, c.client_location, 
                 c.client_use_case, c.client_phone, c.client_email, c.billing_address,
                 c.tax_id, c.contact_person, c.notes, c.credit_terms, c.payment_reliability,
                 c.preferred_payment_method, c.created_at, c.updated_at
        ORDER BY c.client_name
    """
    
    clients = await db.fetch(query)
    return [dict(client) for client in clients]

@app.get("/api/clients/{client_id}")
async def get_client_detail(
    client_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get detailed client information with purchase history"""
    
    # Get client info
    client_query = """
        SELECT 
            client_id,
            client_name,
            client_company,
            client_location,
            client_use_case,
            client_phone,
            client_email,
            billing_address,
            tax_id,
            contact_person,
            notes,
            credit_terms,
            payment_reliability,
            preferred_payment_method,
            created_at,
            updated_at
        FROM clients
        WHERE client_id = $1 AND is_deleted = FALSE
    """
    
    client = await db.fetchrow(client_query, client_id)
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get purchase history
    purchases_query = """
        SELECT 
            i.inventory_id,
            i.stock_number,
            i.year,
            i.make,
            i.model,
            i.body_style,
            i.sale_date,
            i.sale_price,
            i.sale_currency,
            i.payment_status
        FROM inventory i
        WHERE i.client_id = $1 AND i.is_sold = TRUE
        ORDER BY i.sale_date DESC
    """
    
    purchases = await db.fetch(purchases_query, client_id)
    
    # Calculate analytics
    total_purchases = len(purchases)
    total_spent_usd = sum(float(p['sale_price']) for p in purchases if p['sale_currency'] == 'USD')
    total_spent_mxn = sum(float(p['sale_price']) for p in purchases if p['sale_currency'] == 'MXN')
    
    # Favorite bus types
    bus_types = {}
    for p in purchases:
        body_style = p['body_style'] or 'Unknown'
        bus_types[body_style] = bus_types.get(body_style, 0) + 1
    
    favorite_bus_type = max(bus_types.items(), key=lambda x: x[1])[0] if bus_types else None
    
    return {
        'client': dict(client),
        'analytics': {
            'total_purchases': total_purchases,
            'total_spent_usd': total_spent_usd,
            'total_spent_mxn': total_spent_mxn,
            'favorite_bus_type': favorite_bus_type,
            'bus_type_breakdown': bus_types
        },
        'purchase_history': [dict(p) for p in purchases]
    }

@app.post("/api/clients")
async def create_client(
    client_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Create a new client"""
    
    query = """
        INSERT INTO clients (
            client_name, client_company, client_location, client_use_case,
            client_phone, client_email, billing_address, tax_id, contact_person,
            notes, credit_terms, payment_reliability, preferred_payment_method,
            created_at, updated_at, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $14)
        RETURNING client_id, client_name, client_company, client_location, client_use_case,
                  client_phone, client_email, billing_address, tax_id, contact_person,
                  notes, credit_terms, payment_reliability, preferred_payment_method, created_at
    """
    
    client = await db.fetchrow(
        query,
        client_data.get('client_name'),
        client_data.get('client_company'),
        client_data.get('client_location'),
        client_data.get('client_use_case'),
        client_data.get('client_phone'),
        client_data.get('client_email'),
        client_data.get('billing_address'),
        client_data.get('tax_id'),
        client_data.get('contact_person'),
        client_data.get('notes'),
        client_data.get('credit_terms'),
        client_data.get('payment_reliability', 'Not Rated'),
        client_data.get('preferred_payment_method'),
        user['username']
    )
    
    # Log audit
    await log_audit(
        db=db,
        user_id=user['user_id'],
        username=user['username'],
        action='CREATE',
        table_name='clients',
        record_id=client['client_id'],
        new_values=dict(client),
        description=f"Created client: {client['client_name']}"
    )
    
    return dict(client)

@app.put("/api/clients/{client_id}")
async def update_client(
    client_id: int,
    client_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Update an existing client"""
    
    # Get old values for audit
    old_client = await db.fetchrow(
        "SELECT * FROM clients WHERE client_id = $1 AND is_deleted = FALSE",
        client_id
    )
    
    if not old_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    query = """
        UPDATE clients
        SET client_name = $1,
            client_company = $2,
            client_location = $3,
            client_use_case = $4,
            client_phone = $5,
            client_email = $6,
            billing_address = $7,
            tax_id = $8,
            contact_person = $9,
            notes = $10,
            credit_terms = $11,
            payment_reliability = $12,
            preferred_payment_method = $13,
            updated_by = $14
        WHERE client_id = $15 AND is_deleted = FALSE
        RETURNING client_id, client_name, client_company, client_location, client_use_case,
                  client_phone, client_email, billing_address, tax_id, contact_person,
                  notes, credit_terms, payment_reliability, preferred_payment_method,
                  created_at, updated_at
    """
    
    updated_client = await db.fetchrow(
        query,
        client_data.get('client_name'),
        client_data.get('client_company'),
        client_data.get('client_location'),
        client_data.get('client_use_case'),
        client_data.get('client_phone'),
        client_data.get('client_email'),
        client_data.get('billing_address'),
        client_data.get('tax_id'),
        client_data.get('contact_person'),
        client_data.get('notes'),
        client_data.get('credit_terms'),
        client_data.get('payment_reliability'),
        client_data.get('preferred_payment_method'),
        user['username'],
        client_id
    )
    
    # Log audit
    await log_audit(
        db=db,
        user_id=user['user_id'],
        username=user['username'],
        action='UPDATE',
        table_name='clients',
        record_id=client_id,
        old_values=dict(old_client),
        new_values=dict(updated_client),
        description=f"Updated client: {updated_client['client_name']}"
    )
    
    return dict(updated_client)

@app.delete("/api/clients/{client_id}")
async def delete_client(
    client_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Soft delete a client"""
    
    # Check if client has any sales
    sales_count = await db.fetchval(
        "SELECT COUNT(*) FROM inventory WHERE client_id = $1 AND is_sold = TRUE",
        client_id
    )
    
    if sales_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete client with {sales_count} existing sale(s). Client will be marked as deleted but preserved for historical records."
        )
    
    # Get client for audit
    client = await db.fetchrow(
        "SELECT * FROM clients WHERE client_id = $1",
        client_id
    )
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Soft delete
    await db.execute(
        "UPDATE clients SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE client_id = $2",
        user['username'],
        client_id
    )
    
    # Log audit
    await log_audit(
        db=db,
        user_id=user['user_id'],
        username=user['username'],
        action='DELETE',
        table_name='clients',
        record_id=client_id,
        old_values=dict(client),
        description=f"Deleted client: {client['client_name']}"
    )
    
    return {"message": "Client deleted successfully"}

# ========================================
# SALE SUMMARY ENDPOINT
# ========================================

@app.get("/api/sales/{inventory_id}/summary")
async def get_sale_summary(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get detailed summary of a specific sale"""
    
    # Get sale info with client details
    sale_query = """
        SELECT 
            i.inventory_id,
            i.stock_number,
            i.year,
            i.make,
            i.model,
            i.vin,
            i.sale_date,
            i.sale_price,
            i.sale_currency,
            i.payment_status,
            i.balance_due,
            i.purchase_price_usd,
            i.total_cost_usd,
            i.total_cost_mxn,
            i.is_sold,
            c.client_id,
            c.client_name,
            c.client_company,
            c.client_location,
            c.client_phone,
            c.client_email,
            c.client_use_case
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE i.inventory_id = $1 AND i.is_sold = TRUE
    """
    
    sale = await db.fetchrow(sale_query, inventory_id)
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Get payment history
    payments_query = """
        SELECT 
            payment_id,
            payment_date,
            payment_amount,
            payment_currency,
            payment_method,
            payment_type,
            reference_number,
            payment_notes,
            created_at,
            created_by
        FROM payments
        WHERE inventory_id = $1
        ORDER BY payment_date DESC
    """
    payments = await db.fetch(payments_query, inventory_id)
    
    # Get cost breakdown
    costs_query = """
        SELECT 
            cost_id,
            cost_category,
            description,
            amount,
            currency,
            vendor,
            invoice_number,
            date_incurred,
            created_at,
            created_by
        FROM cost_items
        WHERE inventory_id = $1
        ORDER BY date_incurred DESC, created_at DESC
    """
    costs = await db.fetch(costs_query, inventory_id)
    
    # Calculate profit properly with currency conversion
    sale_price = float(sale['sale_price'])
    sale_currency = sale['sale_currency']
    
    # Get costs using centralized calculation (SINGLE SOURCE OF TRUTH)
    cost_data = await calculate_total_costs(db, inventory_id, sale_currency)
    
    if not cost_data:
        raise HTTPException(status_code=404, detail="Could not calculate costs")
    
    total_cost = cost_data['total_cost']
    exchange_rate = cost_data['breakdown']['exchange_rate_used']
    
    # Calculate profit
    profit = sale_price - total_cost
    profit_margin = (profit / sale_price * 100) if sale_price > 0 else 0
    
    # Get profit distribution if exists
    try:
        distribution_query = """
            SELECT 
                distribution_id,
                partner_name,
                ownership_percentage,
                profit_share_amount,
                currency,
                status,
                created_at
            FROM profit_distributions
            WHERE inventory_id = $1
            ORDER BY partner_name
        """
        distributions = await db.fetch(distribution_query, inventory_id)
    except:
        distributions = []
    
    # Check if payments have accounting entries
    if payments:
        payment_ids = [p['payment_id'] for p in payments]
        accounting_count = await db.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE reference_type = 'payment' AND reference_id = ANY($1::int[])",
            payment_ids
        )
        sale_recorded_in_accounting = accounting_count >= len(payments)
    else:
        # No payments yet — no warning needed
        sale_recorded_in_accounting = True

    return {
        'sale': dict(sale),
        'payments': [dict(p) for p in payments],
        'costs': [dict(c) for c in costs],
        'profit_analysis': {
            'sale_price': sale_price,
            'sale_currency': sale_currency,
            'total_cost': total_cost,
            'profit': profit,
            'profit_margin': profit_margin,
            'exchange_rate_used': float(exchange_rate)
        },
        'profit_distributions': [dict(d) for d in distributions],
        # Top-level fields for frontend modal compatibility
        'is_sold': True,
        'stock_number': sale['stock_number'],
        'sale_price': sale_price,
        'currency': sale_currency,
        'cogs': total_cost,
        'gross_profit': profit,
        'gross_profit_margin': profit_margin,
        'payment_status': sale['payment_status'],
        'total_payments_received': sum(float(p['payment_amount']) for p in payments if p['payment_currency'] == sale_currency),
        'ar_balance': float(sale['balance_due']) if sale['balance_due'] else 0,
        'payment_count': len(payments),
        'sale_recorded_in_accounting': sale_recorded_in_accounting,
        'client': {
            'client_id': sale['client_id'],
            'client_name': sale['client_name'],
            'client_company': sale['client_company'],
            'client_email': sale['client_email'],
            'client_phone': sale['client_phone']
        } if sale['client_id'] else None
    }

# ========================================
# RECORD SALE ENDPOINT
# ========================================

class RecordSaleRequest(BaseModel):
    inventory_id: int
    sale_price: Decimal
    sale_currency: str = 'USD'
    sale_date: date
    client_id: Optional[int] = None
    sale_notes: Optional[str] = None

@app.post("/api/sales/record")
async def record_sale(
    sale_data: RecordSaleRequest,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Record a sale: mark bus as sold, calculate profit, create accounting entries.
    Returns sale summary with profit analysis for the frontend.
    """
    # 1. Validate the inventory item exists and is not already sold
    bus = await db.fetchrow(
        "SELECT * FROM inventory WHERE inventory_id = $1 AND is_deleted = FALSE",
        sale_data.inventory_id
    )
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if bus['is_sold']:
        raise HTTPException(status_code=400, detail="This bus is already marked as sold")

    # 2. Get exchange rate
    exchange_rate = await get_exchange_rate(db, 'MXN', 'USD')
    sale_price = float(sale_data.sale_price)

    # 3. Calculate total costs in sale currency
    cost_data = await calculate_total_costs(db, sale_data.inventory_id, sale_data.sale_currency)
    total_cost = cost_data['total_cost'] if cost_data else 0

    # 4. Calculate profit
    gross_profit = sale_price - total_cost
    gross_profit_margin = round((gross_profit / sale_price * 100), 2) if sale_price > 0 else 0

    # 5. Generate reference number
    sale_count = await db.fetchval("SELECT COUNT(*) FROM inventory WHERE is_sold = TRUE")
    reference_number = f"SALE-{(sale_count or 0) + 1:04d}"

    # 6. Build update fields
    update_fields = {
        'is_sold': True,
        'sale_price': sale_data.sale_price,
        'sale_currency': sale_data.sale_currency,
        'sale_date': sale_data.sale_date,
        'balance_due': sale_data.sale_price,
        'payment_status': 'Pending'
    }
    if sale_data.client_id:
        update_fields['client_id'] = sale_data.client_id

    # 7. Update inventory record
    set_clauses = []
    values = [sale_data.inventory_id]
    param_count = 2
    for field, value in update_fields.items():
        set_clauses.append(f"{field} = ${param_count}")
        values.append(value)
        param_count += 1

    updated_row = await db.fetchrow(f"""
        UPDATE inventory
        SET {', '.join(set_clauses)}
        WHERE inventory_id = $1 AND is_deleted = FALSE
        RETURNING *
    """, *values)

    if not updated_row:
        raise HTTPException(status_code=500, detail="Failed to update inventory record")

    # 8. Create accounting entries (Revenue + COGS)
    try:
        # Find or use default accounts
        revenue_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_type = 'Income' AND is_active = TRUE LIMIT 1"
        )
        ar_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_subtype = 'AR' AND is_active = TRUE LIMIT 1"
        )
        cogs_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_name ILIKE '%cost of goods%' OR account_name ILIKE '%COGS%' AND is_active = TRUE LIMIT 1"
        )
        inventory_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_subtype = 'Inventory' AND is_active = TRUE LIMIT 1"
        )

        # Only create entries if accounts exist
        if revenue_account and ar_account:
            # Revenue entry: Debit AR, Credit Revenue
            trans_row = await db.fetchrow("""
                INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
                VALUES ($1, $2, 'sale', $3, $4, $5)
                RETURNING transaction_id
            """, sale_data.sale_date,
                f"Sale of {bus['stock_number']} — {bus['year']} {bus['make']} {bus['model']}",
                sale_data.inventory_id, sale_data.sale_currency, user['username'])

            trans_id = trans_row['transaction_id']

            sale_currency = sale_data.sale_currency

            # Debit AR
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, 0, $4, $5)
            """, trans_id, ar_account, sale_data.sale_price, sale_currency,
                f"AR for sale of {bus['stock_number']}")

            # Credit Revenue
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, 0, $3, $4, $5)
            """, trans_id, revenue_account, sale_data.sale_price, sale_currency,
                f"Revenue from sale of {bus['stock_number']}")

            # Update account balances
            await update_account_balances(db, trans_id)

        # COGS entry if accounts exist
        if cogs_account and inventory_account and total_cost > 0:
            cogs_trans = await db.fetchrow("""
                INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
                VALUES ($1, $2, 'cogs', $3, $4, $5)
                RETURNING transaction_id
            """, sale_data.sale_date,
                f"COGS for {bus['stock_number']} — {bus['year']} {bus['make']} {bus['model']}",
                sale_data.inventory_id, sale_data.sale_currency, user['username'])

            cogs_trans_id = cogs_trans['transaction_id']

            # Debit COGS
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, 0, $4, $5)
            """, cogs_trans_id, cogs_account, Decimal(str(total_cost)), sale_currency,
                f"COGS for {bus['stock_number']}")

            # Credit Inventory
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, 0, $3, $4, $5)
            """, cogs_trans_id, inventory_account, Decimal(str(total_cost)), sale_currency,
                f"Inventory reduction for sale of {bus['stock_number']}")

            await update_account_balances(db, cogs_trans_id)

    except Exception as e:
        # Log but don't fail the sale if accounting entries fail
        print(f"Warning: Could not create accounting entries for sale: {e}")

    # 9. Audit log
    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'sales', sale_data.inventory_id,
        old_values=dict(bus),
        new_values=dict(updated_row),
        description=(
            f"Recorded sale: {bus['stock_number']} — {bus['year']} {bus['make']} {bus['model']} "
            f"@ {sale_price} {sale_data.sale_currency}. "
            f"Gross profit: {gross_profit:.2f} ({gross_profit_margin}%). Ref: {reference_number}"
        )
    )

    # 10. Return response matching what the frontend expects
    return {
        'stock_number': bus['stock_number'],
        'sale_price': sale_price,
        'currency': sale_data.sale_currency,
        'total_cost': total_cost,
        'gross_profit': gross_profit,
        'gross_profit_margin': gross_profit_margin,
        'reference_number': reference_number,
        'inventory_id': sale_data.inventory_id,
        'is_sold': True,
        'payment_status': 'Pending'
    }

    # ==================== ACCOUNTING MODULE BACKEND ENDPOINTS ====================

from decimal import Decimal
from typing import Optional, List

# ==================== PYDANTIC MODELS ====================

class AccountCreate(BaseModel):
    account_code: str
    account_name: str
    account_type: str  # Asset, Liability, Equity, Income, Expense
    account_subtype: Optional[str] = None
    currency: str = 'USD'
    parent_account_id: Optional[int] = None
    description: Optional[str] = None

class TransactionLineCreate(BaseModel):
    account_id: int
    debit_amount: Decimal = 0
    credit_amount: Decimal = 0
    currency: str = 'USD'
    notes: Optional[str] = None

class TransactionCreate(BaseModel):
    transaction_date: date
    description: str
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    currency: str = 'USD'
    exchange_rate: Optional[Decimal] = None
    notes: Optional[str] = None
    lines: List[TransactionLineCreate]

class ProfitDistributionCreate(BaseModel):
    distribution_date: date
    inventory_id: Optional[int] = None
    total_profit: Decimal
    currency: str = 'USD'
    erick_percentage: Decimal = 60.00
    omar_percentage: Decimal = 40.00
    notes: Optional[str] = None

# ==================== CHART OF ACCOUNTS ====================

@app.get("/api/accounting/accounts")
async def get_accounts(
    account_type: Optional[str] = None,
    is_active: bool = True,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get all accounts, optionally filtered by type"""
    where_clauses = []
    params = []
    param_count = 1
    
    if is_active is not None:
        where_clauses.append(f"is_active = ${param_count}")
        params.append(is_active)
        param_count += 1
    
    if account_type:
        where_clauses.append(f"account_type = ${param_count}")
        params.append(account_type)
        param_count += 1
    
    where_clause = " AND ".join(where_clauses) if where_clauses else "TRUE"
    
    query = f"""
        SELECT * FROM accounts 
        WHERE {where_clause}
        ORDER BY account_code
    """
    
    rows = await db.fetch(query, *params)
    return [dict(row) for row in rows]

@app.post("/api/accounting/accounts")
async def create_account(
    account: AccountCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Create a new account"""
    query = """
        INSERT INTO accounts (
            account_code, account_name, account_type, account_subtype,
            currency, parent_account_id, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    """
    
    row = await db.fetchrow(
        query,
        account.account_code,
        account.account_name,
        account.account_type,
        account.account_subtype,
        account.currency,
        account.parent_account_id,
        account.description
    )
    
    return dict(row)

# ==================== TRANSACTIONS ====================

@app.get("/api/accounting/transactions")
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    reference_type: Optional[str] = None,
    limit: int = 100,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get transactions with optional filters"""
    where_clauses = []
    params = []
    param_count = 1
    
    if start_date:
        where_clauses.append(f"transaction_date >= ${param_count}")
        params.append(start_date)
        param_count += 1
    
    if end_date:
        where_clauses.append(f"transaction_date <= ${param_count}")
        params.append(end_date)
        param_count += 1
    
    if reference_type:
        where_clauses.append(f"reference_type = ${param_count}")
        params.append(reference_type)
        param_count += 1
    
    where_clause = " AND ".join(where_clauses) if where_clauses else "TRUE"
    
    query = f"""
        SELECT 
            t.*,
            json_agg(
                json_build_object(
                    'line_id', tl.line_id,
                    'account_id', tl.account_id,
                    'account_name', a.account_name,
                    'account_code', a.account_code,
                    'debit_amount', tl.debit_amount,
                    'credit_amount', tl.credit_amount,
                    'currency', tl.currency,
                    'notes', tl.notes
                )
            ) as lines
        FROM transactions t
        LEFT JOIN transaction_lines tl ON t.transaction_id = tl.transaction_id
        LEFT JOIN accounts a ON tl.account_id = a.account_id
        WHERE {where_clause}
        GROUP BY t.transaction_id
        ORDER BY t.transaction_date DESC, t.transaction_id DESC
        LIMIT ${param_count}
    """
    params.append(limit)
    
    rows = await db.fetch(query, *params)
    return [dict(row) for row in rows]

@app.post("/api/accounting/transactions")
async def create_transaction(
    transaction: TransactionCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Create a new transaction with lines (journal entry)"""
    
    # Validate: Debits must equal credits
    total_debits = sum(float(line.debit_amount) for line in transaction.lines)
    total_credits = sum(float(line.credit_amount) for line in transaction.lines)
    
    if abs(total_debits - total_credits) > 0.01:  # Allow for rounding
        raise HTTPException(
            status_code=400,
            detail=f"Debits ({total_debits}) must equal credits ({total_credits})"
        )
    
    async with db.transaction():
        # Create transaction header
        trans_query = """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id,
                currency, exchange_rate, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """
        
        trans_row = await db.fetchrow(
            trans_query,
            transaction.transaction_date,
            transaction.description,
            transaction.reference_type,
            transaction.reference_id,
            transaction.currency,
            transaction.exchange_rate,
            transaction.notes,
            user['username']
        )
        
        transaction_id = trans_row['transaction_id']
        
        # Create transaction lines
        lines = []
        for line in transaction.lines:
            line_query = """
                INSERT INTO transaction_lines (
                    transaction_id, account_id, debit_amount, credit_amount,
                    currency, notes
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            """
            
            line_row = await db.fetchrow(
                line_query,
                transaction_id,
                line.account_id,
                line.debit_amount,
                line.credit_amount,
                line.currency,
                line.notes
            )
            lines.append(dict(line_row))
        
        # Update account balances
        await update_account_balances(db, transaction_id)
    
    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'transactions', transaction_id,
        new_values={
            'transaction_id': transaction_id,
            'transaction_date': transaction.transaction_date.isoformat(),
            'description': transaction.description,
            'reference_type': transaction.reference_type,
            'reference_id': transaction.reference_id,
            'currency': transaction.currency,
            'total_amount': sum(float(l.debit_amount) for l in transaction.lines)
        },
        description=f"Journal entry posted: {transaction.description} — {transaction.currency}"
    )

    return {
        "transaction": dict(trans_row),
        "lines": lines
    }

async def update_account_balances(db, transaction_id: int):
    """
    Update cached account balances after a transaction.
    Recalculates cumulative totals from ALL transaction_lines for each affected account,
    then writes a single row per account+currency dated today.
    This ensures the dashboard always reads the correct total.
    """
    # Find which accounts are affected by this transaction
    affected = await db.fetch(
        "SELECT DISTINCT account_id, currency FROM transaction_lines WHERE transaction_id = $1",
        transaction_id
    )
    
    for row in affected:
        account_id = row['account_id']
        currency = row['currency']
        
        # Get account type to determine normal balance direction
        account = await db.fetchrow(
            "SELECT account_type FROM accounts WHERE account_id = $1",
            account_id
        )
        account_type = account['account_type']
        
        # Recalculate cumulative balance from ALL transaction_lines for this account+currency
        totals = await db.fetchrow(
            """
            SELECT COALESCE(SUM(debit_amount), 0) as total_debit,
                   COALESCE(SUM(credit_amount), 0) as total_credit
            FROM transaction_lines
            WHERE account_id = $1 AND currency = $2
            """,
            account_id, currency
        )
        
        # Assets & Expenses: Debit increases, Credit decreases
        # Liabilities, Equity, Income: Credit increases, Debit decreases
        if account_type in ['Asset', 'Expense']:
            cumulative_balance = float(totals['total_debit']) - float(totals['total_credit'])
        else:
            cumulative_balance = float(totals['total_credit']) - float(totals['total_debit'])
        
        # Upsert a single balance row dated today (replaces any previous value for today)
        await db.execute(
            """
            INSERT INTO account_balances (account_id, currency, balance, as_of_date)
            VALUES ($1, $2, $3, CURRENT_DATE)
            ON CONFLICT (account_id, currency, as_of_date)
            DO UPDATE SET balance = $3
            """,
            account_id, currency, cumulative_balance
        )

# ==================== CASH POSITION ====================

@app.get("/api/accounting/cash-position")
async def get_cash_position(
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get current cash position across all bank accounts and cash"""
    
    # Get all bank and cash accounts with current balances
    query = """
        SELECT 
            a.account_id,
            a.account_code,
            a.account_name,
            a.account_subtype,
            a.currency,
            COALESCE(b.balance, 0) as balance
        FROM accounts a
        LEFT JOIN LATERAL (
            SELECT balance 
            FROM account_balances 
            WHERE account_id = a.account_id 
                AND currency = a.currency
                AND as_of_date <= CURRENT_DATE
            ORDER BY as_of_date DESC
            LIMIT 1
        ) b ON TRUE
        WHERE a.account_type = 'Asset'
            AND a.account_subtype IN ('Bank', 'Cash')
            AND a.is_active = TRUE
        ORDER BY a.currency, a.account_code
    """
    
    rows = await db.fetch(query)
    accounts = [dict(row) for row in rows]
    
    # Calculate totals by currency
    usd_total = sum(float(acc['balance']) for acc in accounts if acc['currency'] == 'USD')
    mxn_total = sum(float(acc['balance']) for acc in accounts if acc['currency'] == 'MXN')
    
    # Get current exchange rate
    rate_row = await db.fetchrow(
        "SELECT rate FROM exchange_rates ORDER BY created_at DESC LIMIT 1"
    )
    exchange_rate = float(rate_row['rate']) if rate_row else 17.50
    
    return {
        'accounts': accounts,
        'totals': {
            'usd': usd_total,
            'mxn': mxn_total,
            'usd_equivalent': usd_total + (mxn_total / exchange_rate)
        },
        'exchange_rate': exchange_rate
    }

# ==================== PROFIT DISTRIBUTION ====================

async def generate_transaction_reference(
    db, 
    transaction_type: str, 
    transaction_date: date,
    stock_number: str = None
) -> str:
    """
    Generate human-readable transaction reference number
    
    Formats:
    - DIST-20260306-BA164947 (distributions with stock number)
    - DEP-20260306-001 (deposits with sequence)
    - EXP-20260306-001 (expenses with sequence)
    - TRF-20260306-001 (transfers with sequence)
    """
    
    date_str = transaction_date.strftime('%Y%m%d')
    
    type_codes = {
        'distribution': 'DIST',
        'deposit': 'DEP',
        'expense': 'EXP',
        'transfer': 'TRF',
        'payment': 'PAY',
        'manual': 'TXN'
    }
    
    type_code = type_codes.get(transaction_type, 'TXN')
    
    if transaction_type == 'distribution' and stock_number:
        # Remove hyphen from stock number for cleaner reference
        clean_stock = stock_number.replace('-', '')
        reference = f"{type_code}-{date_str}-{clean_stock}"
    else:
        # For other types, get next sequence number for that day
        existing_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM transactions 
            WHERE reference_number LIKE $1
            """,
            f"{type_code}-{date_str}-%"
        )
        
        sequence = (existing_count or 0) + 1
        reference = f"{type_code}-{date_str}-{sequence:03d}"
    
    return reference

@app.post("/api/accounting/profit-distribution/calculate")
async def calculate_profit_distribution(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Calculate profit for a sale and distribution amounts"""
    
    # Get sale information
    sale = await db.fetchrow(
        """
        SELECT 
            inventory_id, stock_number, sale_price, sale_currency,
            purchase_price_usd
        FROM inventory
        WHERE inventory_id = $1 AND is_sold = TRUE
        """,
        inventory_id
    )
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Get all costs
    costs = await db.fetch(
        """
        SELECT currency, SUM(amount) as total
        FROM cost_items
        WHERE inventory_id = $1
        GROUP BY currency
        """,
        inventory_id
    )
    
    usd_costs = sum(float(c['total']) for c in costs if c['currency'] == 'USD')
    mxn_costs = sum(float(c['total']) for c in costs if c['currency'] == 'MXN')
    
    purchase_price = float(sale['purchase_price_usd'])
    total_cost_usd = purchase_price + usd_costs
    
    # Get exchange rate
    rate_row = await db.fetchrow(
        "SELECT rate FROM exchange_rates ORDER BY created_at DESC LIMIT 1"
    )
    exchange_rate = float(rate_row['rate']) if rate_row else 17.50
    
    # Calculate profit in sale currency
    sale_price = float(sale['sale_price'])
    currency = sale['sale_currency']
    
    if currency == 'USD':
        total_cost = total_cost_usd
    else:  # MXN
        total_cost = (total_cost_usd * exchange_rate) + mxn_costs
    
    profit = sale_price - total_cost
    
    # Calculate distributions
    erick_amount = profit * 0.60
    omar_amount = profit * 0.40
    
    return {
        'inventory_id': inventory_id,
        'stock_number': sale['stock_number'],
        'sale_price': sale_price,
        'total_cost': total_cost,
        'profit': profit,
        'currency': currency,
        'distributions': {
            'erick': {
                'percentage': 60,
                'amount': erick_amount
            },
            'omar': {
                'percentage': 40,
                'amount': omar_amount
            }
        },
        'exchange_rate': exchange_rate
    }

@app.post("/api/accounting/profit-distribution")
async def record_profit_distribution(
    distribution: ProfitDistributionCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Record a profit distribution"""
    
    erick_amount = float(distribution.total_profit) * float(distribution.erick_percentage) / 100
    omar_amount = float(distribution.total_profit) * float(distribution.omar_percentage) / 100
    
    async with db.transaction():
        # Get stock number for reference
        stock_number = None
        if distribution.inventory_id:
            stock_number = await db.fetchval(
                "SELECT stock_number FROM inventory WHERE inventory_id = $1",
                distribution.inventory_id
            )
        
        # Generate reference number
        reference_number = await generate_transaction_reference(
            db,
            'distribution',
            distribution.distribution_date,
            stock_number
        )
        
        # Create distribution record
        dist_query = """
            INSERT INTO profit_distributions (
                distribution_date, inventory_id, total_profit, currency,
                erick_percentage, erick_amount, omar_percentage, omar_amount,
                notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        """
        
        dist_row = await db.fetchrow(
            dist_query,
            distribution.distribution_date,
            distribution.inventory_id,
            distribution.total_profit,
            distribution.currency,
            distribution.erick_percentage,
            erick_amount,
            distribution.omar_percentage,
            omar_amount,
            distribution.notes,
            user['username']
        )
        
        # Create accounting transaction
        # Get account IDs
        retained_earnings = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_code = '3100'"
        )
        erick_dist = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_code = '3200'"
        )
        omar_dist = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_code = '3201'"
        )
        
        # Create transaction with reference number
        trans_query = """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id,
                currency, created_by, reference_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING transaction_id
        """
        
        trans_id = await db.fetchval(
            trans_query,
            distribution.distribution_date,
            f"Profit Distribution - {distribution.notes or ''}",
            'distribution',
            dist_row['distribution_id'],
            distribution.currency,
            user['username'],
            reference_number  # Add reference number
        )
        
        # Create lines
        # Debit: Retained Earnings (reduce equity)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, currency
            ) VALUES ($1, $2, $3, $4)
            """,
            trans_id, retained_earnings, distribution.total_profit, distribution.currency
        )
        
        # Credit: Erick Distribution
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, credit_amount, currency
            ) VALUES ($1, $2, $3, $4)
            """,
            trans_id, erick_dist, erick_amount, distribution.currency
        )
        
        # Credit: Omar Distribution
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, credit_amount, currency
            ) VALUES ($1, $2, $3, $4)
            """,
            trans_id, omar_dist, omar_amount, distribution.currency
        )
        
        # Update balances
        await update_account_balances(db, trans_id)
        
        # Update distribution with transaction_id
        await db.execute(
            "UPDATE profit_distributions SET transaction_id = $1 WHERE distribution_id = $2",
            trans_id, dist_row['distribution_id']
        )
    
    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'profit_distributions', dist_row['distribution_id'],
        new_values=dict(dist_row),
        description=(
            f"Profit distribution recorded: {distribution.total_profit} {distribution.currency} — "
            f"Erick {distribution.erick_percentage}% (${erick_amount:.2f}), "
            f"Omar {distribution.omar_percentage}% (${omar_amount:.2f})"
        )
    )

    return dict(dist_row)

@app.get("/api/accounting/profit-distributions")
async def get_profit_distributions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get profit distribution history"""
    where_clauses = []
    params = []
    param_count = 1
    
    if start_date:
        where_clauses.append(f"distribution_date >= ${param_count}")
        params.append(start_date)
        param_count += 1
    
    if end_date:
        where_clauses.append(f"distribution_date <= ${param_count}")
        params.append(end_date)
        param_count += 1
    
    where_clause = " AND ".join(where_clauses) if where_clauses else "TRUE"
    
    query = f"""
        SELECT 
            pd.*,
            i.stock_number,
            i.sale_price as sale_amount
        FROM profit_distributions pd
        LEFT JOIN inventory i ON pd.inventory_id = i.inventory_id
        WHERE {where_clause}
        ORDER BY pd.distribution_date DESC
    """
    
    rows = await db.fetch(query, *params)
    return [dict(row) for row in rows]

# ==================== WORK PLAN ENDPOINTS ====================

@app.post("/api/inventory/{inventory_id}/work-plan", response_model=WorkPlan)
async def create_work_plan(inventory_id: int, plan: WorkPlanCreate, db=Depends(get_db)):
    """Create work plan for a unit"""
    query = """
        INSERT INTO work_plans (
            inventory_id, plan_type, origin_location, destination_location,
            estimated_distance_km, estimated_days, estimated_cost, cost_currency, plan_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    """
    row = await db.fetchrow(
        query, inventory_id, plan.plan_type, plan.origin_location, plan.destination_location,
        plan.estimated_distance_km, plan.estimated_days, plan.estimated_cost,
        plan.cost_currency, plan.plan_notes
    )
    return dict(row)

@app.get("/api/inventory/{inventory_id}/work-plans", response_model=List[WorkPlan])
async def get_work_plans(inventory_id: int, db=Depends(get_db)):
    """Get all work plans for a unit"""
    query = "SELECT * FROM work_plans WHERE inventory_id = $1 ORDER BY created_at DESC"
    rows = await db.fetch(query, inventory_id)
    return [dict(row) for row in rows]

@app.patch("/api/work-plans/{plan_id}/complete")
async def complete_work_plan(
    plan_id: int,
    actual_cost: Optional[Decimal] = None,
    actual_days: Optional[int] = None,
    execution_notes: Optional[str] = None,
    db=Depends(get_db)
):
    """Mark work plan as complete"""
    query = """
        UPDATE work_plans 
        SET completed = TRUE, completion_date = CURRENT_DATE,
            actual_cost = $1, actual_days = $2, execution_notes = $3
        WHERE plan_id = $4
        RETURNING *
    """
    row = await db.fetchrow(query, actual_cost, actual_days, execution_notes, plan_id)
    if not row:
        raise HTTPException(status_code=404, detail="Work plan not found")
    return dict(row)

# ==================== PHOTOS ENDPOINTS ====================

@app.post("/api/inventory/{inventory_id}/photos")
async def upload_photo(
    inventory_id: int,
    file: UploadFile = File(...),
    photo_type: str = Form("Exterior"),
    is_primary: bool = Form(False),
    caption: Optional[str] = Form(None),
    db=Depends(get_db)
):
    """Upload photo for inventory item"""
    inv_check = await db.fetchval("SELECT inventory_id FROM inventory WHERE inventory_id = $1", inventory_id)
    if not inv_check:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    os.makedirs(f"{UPLOAD_DIR}/inventory/{inventory_id}", exist_ok=True)
    file_path = f"{UPLOAD_DIR}/inventory/{inventory_id}/{file.filename}"
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    query = """
        INSERT INTO inventory_photos (inventory_id, file_name, file_path, file_size, 
                                     mime_type, photo_type, is_primary, caption)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    """
    row = await db.fetchrow(
        query, inventory_id, file.filename, file_path, len(content),
        file.content_type, photo_type, is_primary, caption
    )
    return dict(row)

@app.get("/api/inventory/{inventory_id}/photos")
async def get_photos(inventory_id: int, db=Depends(get_db)):
    """Get all photos for inventory item"""
    query = """
        SELECT * FROM inventory_photos 
        WHERE inventory_id = $1 
        ORDER BY is_primary DESC, display_order, uploaded_at
    """
    rows = await db.fetch(query, inventory_id)
    return [dict(row) for row in rows]

# ==================== WARRANTY ENDPOINTS ====================

@app.post("/api/inventory/{inventory_id}/warranty-claim", response_model=WarrantyClaim)
async def create_warranty_claim(inventory_id: int, claim: WarrantyClaimCreate, db=Depends(get_db)):
    """File warranty claim"""
    query = """
        INSERT INTO warranty_claims (inventory_id, claim_date, claim_type, description, client_name, status)
        VALUES ($1, $2, $3, $4, $5, 'Submitted')
        RETURNING *
    """
    row = await db.fetchrow(
        query, inventory_id, claim.claim_date, claim.claim_type,
        claim.description, claim.client_name
    )
    return dict(row)

@app.get("/api/inventory/{inventory_id}/warranty-claims", response_model=List[WarrantyClaim])
async def get_warranty_claims(inventory_id: int, db=Depends(get_db)):
    """Get warranty claims for a unit"""
    query = "SELECT * FROM warranty_claims WHERE inventory_id = $1 ORDER BY claim_date DESC"
    rows = await db.fetch(query, inventory_id)
    return [dict(row) for row in rows]

# ==================== REPORTING ENDPOINTS ====================

@app.get("/api/reports/dashboard")
async def get_dashboard(db=Depends(get_db)):
    """Dashboard statistics"""
    query = """
        SELECT 
            COUNT(*) as total_units,
            COUNT(*) FILTER (WHERE current_location = 'US Stock') as us_inventory,
            COUNT(*) FILTER (WHERE current_location = 'Mexico Stock') as mexico_inventory,
            COUNT(*) FILTER (WHERE is_sold = FALSE) as available_for_sale,
            COUNT(*) FILTER (WHERE is_sold = TRUE AND status != 'Delivered') as sold_pending_delivery,
            COUNT(*) FILTER (WHERE status = 'Delivered') as delivered,
            COUNT(*) FILTER (WHERE warranty_status = 'Active') as under_warranty,
            SUM(cost_in_us_stock_usd) FILTER (WHERE current_location = 'US Stock') as us_inventory_value,
            AVG(days_in_inventory) FILTER (WHERE status != 'Delivered') as avg_days_in_inventory
        FROM inventory
        WHERE is_deleted = FALSE
    """
    row = await db.fetchrow(query)
    return dict(row)

@app.get("/api/reports/us-inventory")
async def get_us_inventory_report(db=Depends(get_db)):
    """US inventory report"""
    query = "SELECT * FROM us_inventory"
    rows = await db.fetch(query)
    return [dict(row) for row in rows]

@app.get("/api/reports/mexico-inventory")
async def get_mexico_inventory_report(db=Depends(get_db)):
    """Mexico inventory report"""
    query = "SELECT * FROM mexico_inventory"
    rows = await db.fetch(query)
    return [dict(row) for row in rows]

@app.get("/api/reports/sold-pending")
async def get_sold_pending_delivery(db=Depends(get_db)):
    """Sold units pending delivery"""
    query = "SELECT * FROM sold_pending_delivery"
    rows = await db.fetch(query)
    return [dict(row) for row in rows]

@app.get("/api/reports/warranty-active")
async def get_active_warranties(db=Depends(get_db)):
    """Units under active warranty"""
    query = "SELECT * FROM units_under_warranty"
    rows = await db.fetch(query)
    return [dict(row) for row in rows]

# ==================== PRE-INSPECTION ENDPOINTS ====================

@app.post("/api/pre-inspections", response_model=PreInspection)
async def create_pre_inspection(inspection: PreInspectionCreate, db=Depends(get_db), user=Depends(get_current_user)):
    """Create a new pre-purchase inspection"""
    query = """
        INSERT INTO pre_purchase_inspections (
            vin, year, make, model, odometer, odometer_unit,
            passenger_capacity, wheelchair_capacity, engine_make, engine_model,
            engine_type, transmission, fuel_type, gvwr, length_feet,
            exterior_color, interior_color, title_status,
            body_style, brake_system, air_conditioning, heater,
            seat_belts, emergency_exits, fire_extinguisher, first_aid_kit,
            ada_compliant, wheelchair_lift_ramp,
            inspection_location, seller_name, seller_asking_price, seller_contact,
            inspection_date, inspector_name,
            engine_condition, engine_starts, engine_oil_condition, engine_coolant_condition,
            engine_leaks, engine_noise, engine_notes,
            transmission_condition, transmission_shifts_properly, transmission_fluid_condition,
            transmission_leaks, transmission_notes,
            suspension_condition, steering_condition, alignment_ok, suspension_notes,
            chassis_condition, body_condition, rust_present, rust_severity,
            structural_damage, chassis_notes,
            brake_condition, brake_pads_percentage, brake_lines_condition, brake_notes,
            electrical_system_condition, lights_working, battery_condition,
            alternator_working, electrical_notes,
            interior_condition, seats_condition, floor_condition, interior_notes,
            road_test_performed, road_test_notes,
            overall_rating, recommendation, estimated_repair_cost_usd, inspector_notes,
            created_by
        ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54,
        $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67,
        $68, $69, $70, $71, $72, $73, $74, $75, $76
    )
        RETURNING *
    """
    
    row = await db.fetchrow(
        query,
        inspection.vin, inspection.year, inspection.make, inspection.model,
        inspection.odometer, inspection.odometer_unit,
        inspection.passenger_capacity, inspection.wheelchair_capacity,
        inspection.engine_make, inspection.engine_model, inspection.engine_type,
        inspection.transmission, inspection.fuel_type, inspection.gvwr, inspection.length_feet,
        inspection.exterior_color, inspection.interior_color, inspection.title_status,
        inspection.body_style, inspection.brake_system, inspection.air_conditioning, inspection.heater,
        inspection.seat_belts, inspection.emergency_exits, inspection.fire_extinguisher, inspection.first_aid_kit,
        inspection.ada_compliant, inspection.wheelchair_lift_ramp,
        inspection.inspection_location, inspection.seller_name, inspection.seller_asking_price,
        inspection.seller_contact, inspection.inspection_date, inspection.inspector_name,
        inspection.engine_condition, inspection.engine_starts, inspection.engine_oil_condition,
        inspection.engine_coolant_condition, inspection.engine_leaks, inspection.engine_noise,
        inspection.engine_notes, inspection.transmission_condition, inspection.transmission_shifts_properly,
        inspection.transmission_fluid_condition, inspection.transmission_leaks, inspection.transmission_notes,
        inspection.suspension_condition, inspection.steering_condition, inspection.alignment_ok,
        inspection.suspension_notes, inspection.chassis_condition, inspection.body_condition,
        inspection.rust_present, inspection.rust_severity, inspection.structural_damage,
        inspection.chassis_notes, inspection.brake_condition, inspection.brake_pads_percentage,
        inspection.brake_lines_condition, inspection.brake_notes, inspection.electrical_system_condition,
        inspection.lights_working, inspection.battery_condition, inspection.alternator_working,
        inspection.electrical_notes, inspection.interior_condition, inspection.seats_condition,
        inspection.floor_condition, inspection.interior_notes, inspection.road_test_performed,
        inspection.road_test_notes, inspection.overall_rating, inspection.recommendation,
        inspection.estimated_repair_cost_usd, inspection.inspector_notes, user['username']
    )

    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'pre_purchase_inspections', row['inspection_id'],
        new_values={
            'inspection_id': row['inspection_id'],
            'vin': inspection.vin,
            'year': inspection.year,
            'make': inspection.make,
            'model': inspection.model,
            'inspection_date': inspection.inspection_date.isoformat(),
            'inspector_name': inspection.inspector_name,
            'overall_rating': inspection.overall_rating,
            'recommendation': inspection.recommendation,
        },
        description=f"Pre-inspection created: {inspection.year} {inspection.make} {inspection.model} VIN {inspection.vin} — {inspection.recommendation}"
    )

    return dict(row)

@app.get("/api/pre-inspections", response_model=List[PreInspection])
async def get_pre_inspections(
    vin: Optional[str] = None,
    recommendation: Optional[str] = None,
    purchased: Optional[bool] = None,
    limit: int = 100,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get all pre-inspections with optional filters"""
    conditions = []
    params = []
    param_count = 1
    
    if vin:
        conditions.append(f"vin ILIKE ${param_count}")
        params.append(f"%{vin}%")
        param_count += 1
    
    if recommendation:
        conditions.append(f"recommendation = ${param_count}")
        params.append(recommendation)
        param_count += 1
    
    if purchased is not None:
        conditions.append(f"purchased = ${param_count}")
        params.append(purchased)
        param_count += 1
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    query = f"""
        SELECT * FROM pre_purchase_inspections
        WHERE {where_clause}
        ORDER BY inspection_date DESC, created_at DESC
        LIMIT ${param_count}
    """
    params.append(limit)
    
    rows = await db.fetch(query, *params)
    return [dict(row) for row in rows]

@app.get("/api/pre-inspections/{inspection_id}", response_model=PreInspection)
async def get_pre_inspection(inspection_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Get a specific pre-inspection by ID"""
    query = "SELECT * FROM pre_purchase_inspections WHERE inspection_id = $1"
    row = await db.fetchrow(query, inspection_id)
    if not row:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return dict(row)

@app.get("/api/pre-inspections/by-vin/{vin}")
async def get_pre_inspection_by_vin(vin: str, db=Depends(get_db), user=Depends(get_current_user)):
    """Get pre-inspection by VIN"""
    query = "SELECT * FROM pre_purchase_inspections WHERE vin = $1 ORDER BY inspection_date DESC LIMIT 1"
    row = await db.fetchrow(query, vin)
    if not row:
        raise HTTPException(status_code=404, detail="No inspection found for this VIN")
    return dict(row)

@app.post("/api/pre-inspections/{inspection_id}/create-inventory")
async def create_inventory_from_inspection(
    inspection_id: int,
    additional_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Create inventory record from approved inspection"""
    inspection = await db.fetchrow(
        "SELECT * FROM pre_purchase_inspections WHERE inspection_id = $1",
        inspection_id
    )
    
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    if inspection['recommendation'] != 'Approve':
        raise HTTPException(status_code=400, detail="Can only create inventory from approved inspections")
    
    if inspection['purchased']:
        raise HTTPException(status_code=400, detail="Inspection already used to create inventory")
    
    # Convert date string to date object if needed
    purchase_date = additional_data.get('purchase_date')
    if isinstance(purchase_date, str):
        from datetime import datetime
        purchase_date = datetime.strptime(purchase_date, '%Y-%m-%d').date()
    
    # Generate inspection summary
    summary = generate_inspection_summary(dict(inspection))
    
    # Determine condition
    condition_map = {
        'Excellent': 'Excellent',
        'Good': 'Good',
        'Fair': 'Fair',
        'Poor': 'Needs Major Work'
    }
    condition = condition_map.get(inspection['overall_rating'], 'Used')
    
    # Create inventory
    inventory_query = """
        INSERT INTO inventory (
            vin, stock_number, year, make, model, odometer,
            passenger_capacity, wheelchair_capacity,
            engine_make, engine_model, engine_type, transmission, fuel_type,
            gvwr, length_feet, exterior_color, interior_color, title_status,
            body_style, brake_system, air_conditioning, heater,
            emergency_exits, fire_extinguisher, first_aid_kit,
            ada_compliant, wheelchair_lift_ramp,
            condition, purchase_location, pre_inspection_id, internal_notes,
            purchase_date, purchase_price_usd, supplier_id,
            current_location, status, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
            $29, $30, $31, $32, $33, $34, $35
        )
        RETURNING *
    """
    
    # Execute the inventory creation
    # Use .get() for fields that might not exist in inspection table
    inventory_row = await db.fetchrow(
        inventory_query,
        inspection['vin'],
        additional_data.get('stock_number'),
        inspection['year'],
        inspection['make'],
        inspection['model'],
        inspection.get('odometer'),
        inspection.get('passenger_capacity'),  # NULL if not in inspection
        inspection.get('wheelchair_capacity'),  # NULL if not in inspection
        inspection.get('engine_make'),  # NULL if not in inspection
        inspection.get('engine_model'),  # NULL if not in inspection
        inspection.get('engine_type'),  # NULL if not in inspection
        inspection.get('transmission'),  # NULL if not in inspection
        inspection.get('fuel_type'),  # NULL if not in inspection
        inspection.get('gvwr'),  # NULL if not in inspection
        inspection.get('length_feet'),  # NULL if not in inspection
        inspection.get('exterior_color'),  # NULL if not in inspection
        inspection.get('interior_color'),  # NULL if not in inspection
        inspection.get('title_status'),  # NULL if not in inspection
        inspection.get('body_style'),  # Body style
        inspection.get('brake_system'),  # Brake system type
        inspection.get('air_conditioning'),  # Has AC
        inspection.get('heater'),  # Has heater
        inspection.get('emergency_exits'),  # Number of emergency exits
        inspection.get('fire_extinguisher'),  # Has fire extinguisher
        inspection.get('first_aid_kit'),  # NEW: Has first aid kit
        inspection.get('ada_compliant'),  # NEW: ADA compliant
        inspection.get('wheelchair_lift_ramp'),  # NEW: Wheelchair lift/ramp type
        condition,
        inspection.get('inspection_location'),
        inspection_id,
        summary,
        purchase_date,
        additional_data.get('purchase_price_usd'),
        additional_data.get('supplier_id'),
        additional_data.get('current_location', 'United States'),
        'Available',
        user['username']
    )
    
    # Mark inspection as purchased
    await db.execute(
        "UPDATE pre_purchase_inspections SET purchased = true WHERE inspection_id = $1",
        inspection_id
    )

    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'inventory', inventory_row['inventory_id'],
        new_values={
            'inventory_id': inventory_row['inventory_id'],
            'stock_number': additional_data.get('stock_number'),
            'vin': inspection['vin'],
            'year': inspection['year'],
            'make': inspection['make'],
            'model': inspection['model'],
            'purchase_price_usd': str(additional_data.get('purchase_price_usd', '')),
            'source_inspection_id': inspection_id,
        },
        description=(
            f"Inventory created from inspection #{inspection_id}: "
            f"{inspection['year']} {inspection['make']} {inspection['model']} "
            f"VIN {inspection['vin']} — Stock {additional_data.get('stock_number')}"
        )
    )

    return dict(inventory_row)

# ========================================
# ACCOUNTING REPORTS ENDPOINTS
# ========================================

@app.get("/api/accounting/reports/income-statement")
async def get_income_statement(
    start_date: str,
    end_date: str,
    currency: str = "USD",
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Generate Income Statement (Profit & Loss) for a date range"""
    
    from datetime import datetime
    
    # Convert date strings to date objects
    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    # Get exchange rate using helper function
    exchange_rate = await get_exchange_rate(db, 'MXN', 'USD')
    
    # Query account activity for the period
    query = """
        WITH account_activity AS (
            SELECT 
                a.account_id,
                a.account_code,
                a.account_name,
                a.account_type,
                a.account_subtype,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.debit_amount ELSE 0 END), 0) as debit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.credit_amount ELSE 0 END), 0) as credit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.debit_amount ELSE 0 END), 0) as debit_mxn,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.credit_amount ELSE 0 END), 0) as credit_mxn
            FROM accounts a
            LEFT JOIN transaction_lines tl ON a.account_id = tl.account_id
            LEFT JOIN transactions t ON tl.transaction_id = t.transaction_id
            WHERE t.transaction_date >= $1 AND t.transaction_date <= $2
            GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.account_subtype
        )
        SELECT 
            account_code,
            account_name,
            account_type,
            account_subtype,
            (credit_usd - debit_usd) as net_usd,
            (credit_mxn - debit_mxn) as net_mxn,
            (debit_usd - credit_usd) as expense_usd,
            (debit_mxn - credit_mxn) as expense_mxn
        FROM account_activity
        WHERE account_type IN ('Income', 'Expense')
        ORDER BY account_code
    """
    
    rows = await db.fetch(query, start, end)
    
    # Organize data
    revenue = {'USD': 0, 'MXN': 0, 'accounts': []}
    cogs = {'USD': 0, 'MXN': 0, 'accounts': []}
    operating_expenses = {'USD': 0, 'MXN': 0, 'accounts': []}
    
    # COGS subtypes - actual cost of acquiring inventory
    cogs_subtypes = {'Cost of Goods'}
    
    for row in rows:
        account_data = {
            'code': row['account_code'],
            'name': row['account_name'],
            'amount_usd': 0,
            'amount_mxn': 0
        }
        
        if row['account_type'] == 'Income':
            account_data['amount_usd'] = float(row['net_usd'])
            account_data['amount_mxn'] = float(row['net_mxn'])
            revenue['USD'] += account_data['amount_usd']
            revenue['MXN'] += account_data['amount_mxn']
            revenue['accounts'].append(account_data)
            
        elif row['account_type'] == 'Expense':
            account_data['amount_usd'] = float(row['expense_usd'])
            account_data['amount_mxn'] = float(row['expense_mxn'])
            
            if row['account_subtype'] in cogs_subtypes:
                cogs['USD'] += account_data['amount_usd']
                cogs['MXN'] += account_data['amount_mxn']
                cogs['accounts'].append(account_data)
            else:
                operating_expenses['USD'] += account_data['amount_usd']
                operating_expenses['MXN'] += account_data['amount_mxn']
                operating_expenses['accounts'].append(account_data)
    
    gross_profit_usd = revenue['USD'] - cogs['USD']
    gross_profit_mxn = revenue['MXN'] - cogs['MXN']
    net_income_usd = gross_profit_usd - operating_expenses['USD']
    net_income_mxn = gross_profit_mxn - operating_expenses['MXN']
    
    # Format response based on currency
    if currency == "USD":
        revenue['USD'] += revenue['MXN'] / float(exchange_rate)
        cogs['USD'] += cogs['MXN'] / float(exchange_rate)
        operating_expenses['USD'] += operating_expenses['MXN'] / float(exchange_rate)
        
        for account in revenue['accounts'] + cogs['accounts'] + operating_expenses['accounts']:
            account['amount_usd'] += account['amount_mxn'] / float(exchange_rate)
            account['amount_mxn'] = 0
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'currency': 'USD',
            'exchange_rate': float(exchange_rate),
            'revenue': {'total': revenue['USD'], 'accounts': revenue['accounts']},
            'cogs': {'total': cogs['USD'], 'accounts': cogs['accounts']},
            'gross_profit': gross_profit_usd + (gross_profit_mxn / float(exchange_rate)),
            'operating_expenses': {'total': operating_expenses['USD'], 'accounts': operating_expenses['accounts']},
            'net_income': net_income_usd + (net_income_mxn / float(exchange_rate))
        }
    
    elif currency == "MXN":
        revenue['MXN'] += revenue['USD'] * float(exchange_rate)
        cogs['MXN'] += cogs['USD'] * float(exchange_rate)
        operating_expenses['MXN'] += operating_expenses['USD'] * float(exchange_rate)
        
        for account in revenue['accounts'] + cogs['accounts'] + operating_expenses['accounts']:
            account['amount_mxn'] += account['amount_usd'] * float(exchange_rate)
            account['amount_usd'] = 0
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'currency': 'MXN',
            'exchange_rate': float(exchange_rate),
            'revenue': {'total': revenue['MXN'], 'accounts': revenue['accounts']},
            'cogs': {'total': cogs['MXN'], 'accounts': cogs['accounts']},
            'gross_profit': gross_profit_mxn + (gross_profit_usd * float(exchange_rate)),
            'operating_expenses': {'total': operating_expenses['MXN'], 'accounts': operating_expenses['accounts']},
            'net_income': net_income_mxn + (net_income_usd * float(exchange_rate))
        }
    
    else:  # BOTH
        return {
            'start_date': start_date,
            'end_date': end_date,
            'currency': 'BOTH',
            'exchange_rate': float(exchange_rate),
            'revenue': {
                'total_usd': revenue['USD'],
                'total_mxn': revenue['MXN'],
                'accounts': revenue['accounts']
            },
            'cogs': {
                'total_usd': cogs['USD'],
                'total_mxn': cogs['MXN'],
                'accounts': cogs['accounts']
            },
            'gross_profit_usd': gross_profit_usd,
            'gross_profit_mxn': gross_profit_mxn,
            'operating_expenses': {
                'total_usd': operating_expenses['USD'],
                'total_mxn': operating_expenses['MXN'],
                'accounts': operating_expenses['accounts']
            },
            'net_income_usd': net_income_usd,
            'net_income_mxn': net_income_mxn
        }

@app.get("/api/accounting/reports/balance-sheet")
async def get_balance_sheet(
    as_of_date: str,
    currency: str = "USD",
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Generate Balance Sheet as of a specific date"""
    
    from datetime import datetime
    
    report_date = datetime.strptime(as_of_date, '%Y-%m-%d').date()
    
    # Get exchange rate using helper function
    exchange_rate = await get_exchange_rate(db, 'MXN', 'USD')
    
    # Query account balances as of the date
    query = """
        WITH account_balances AS (
            SELECT 
                a.account_id,
                a.account_code,
                a.account_name,
                a.account_type,
                a.account_subtype,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.debit_amount ELSE 0 END), 0) as debit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.credit_amount ELSE 0 END), 0) as credit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.debit_amount ELSE 0 END), 0) as debit_mxn,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.credit_amount ELSE 0 END), 0) as credit_mxn
            FROM accounts a
            LEFT JOIN transaction_lines tl ON a.account_id = tl.account_id
            LEFT JOIN transactions t ON tl.transaction_id = t.transaction_id AND t.transaction_date <= $1
            GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.account_subtype
        )
        SELECT 
            account_code,
            account_name,
            account_type,
            account_subtype,
            CASE 
                WHEN account_type = 'Asset' THEN (debit_usd - credit_usd)
                WHEN account_type = 'Liability' THEN (credit_usd - debit_usd)
                WHEN account_type = 'Equity' THEN (credit_usd - debit_usd)
                ELSE 0
            END as balance_usd,
            CASE 
                WHEN account_type = 'Asset' THEN (debit_mxn - credit_mxn)
                WHEN account_type = 'Liability' THEN (credit_mxn - debit_mxn)
                WHEN account_type = 'Equity' THEN (credit_mxn - debit_mxn)
                ELSE 0
            END as balance_mxn
        FROM account_balances
        WHERE account_type IN ('Asset', 'Liability', 'Equity')
        ORDER BY account_type, account_code
    """
    
    rows = await db.fetch(query, report_date)
    
    # Organize accounts
    assets = {'USD': 0, 'MXN': 0, 'current': [], 'non_current': []}
    liabilities = {'USD': 0, 'MXN': 0, 'current': [], 'non_current': []}
    equity = {'USD': 0, 'MXN': 0, 'accounts': []}
    
    for row in rows:
        account_data = {
            'code': row['account_code'],
            'name': row['account_name'],
            'subtype': row['account_subtype'],
            'balance_usd': float(row['balance_usd']),
            'balance_mxn': float(row['balance_mxn'])
        }
        
        if row['account_type'] == 'Asset':
            assets['USD'] += account_data['balance_usd']
            assets['MXN'] += account_data['balance_mxn']
            if row['account_subtype'] in ['Cash & Cash Equivalents', 'Inventory', 'Current Asset']:
                assets['current'].append(account_data)
            else:
                assets['non_current'].append(account_data)
                
        elif row['account_type'] == 'Liability':
            liabilities['USD'] += account_data['balance_usd']
            liabilities['MXN'] += account_data['balance_mxn']
            if row['account_subtype'] in ['Current Liability', 'Line of Credit']:
                liabilities['current'].append(account_data)
            else:
                liabilities['non_current'].append(account_data)
                
        elif row['account_type'] == 'Equity':
            equity['USD'] += account_data['balance_usd']
            equity['MXN'] += account_data['balance_mxn']
            equity['accounts'].append(account_data)
    
    # Format based on currency
    if currency == "USD":
        assets['USD'] += assets['MXN'] / float(exchange_rate)
        liabilities['USD'] += liabilities['MXN'] / float(exchange_rate)
        equity['USD'] += equity['MXN'] / float(exchange_rate)
        
        for account in assets['current'] + assets['non_current'] + liabilities['current'] + liabilities['non_current'] + equity['accounts']:
            account['balance_usd'] += account['balance_mxn'] / float(exchange_rate)
            account['balance_mxn'] = 0
        
        total_liabilities_equity = liabilities['USD'] + equity['USD']
        is_balanced = abs(assets['USD'] - total_liabilities_equity) < 0.01
        
        return {
            'as_of_date': as_of_date,
            'currency': 'USD',
            'exchange_rate': float(exchange_rate),
            'assets': {
                'current': assets['current'],
                'non_current': assets['non_current'],
                'total': assets['USD']
            },
            'liabilities': {
                'current': liabilities['current'],
                'non_current': liabilities['non_current'],
                'total': liabilities['USD']
            },
            'equity': {
                'accounts': equity['accounts'],
                'total': equity['USD']
            },
            'total_liabilities_equity': total_liabilities_equity,
            'is_balanced': is_balanced,
            'balance_difference': assets['USD'] - total_liabilities_equity
        }
    
    elif currency == "MXN":
        assets['MXN'] += assets['USD'] * float(exchange_rate)
        liabilities['MXN'] += liabilities['USD'] * float(exchange_rate)
        equity['MXN'] += equity['USD'] * float(exchange_rate)
        
        for account in assets['current'] + assets['non_current'] + liabilities['current'] + liabilities['non_current'] + equity['accounts']:
            account['balance_mxn'] += account['balance_usd'] * float(exchange_rate)
            account['balance_usd'] = 0
        
        total_liabilities_equity = liabilities['MXN'] + equity['MXN']
        is_balanced = abs(assets['MXN'] - total_liabilities_equity) < 0.01
        
        return {
            'as_of_date': as_of_date,
            'currency': 'MXN',
            'exchange_rate': float(exchange_rate),
            'assets': {
                'current': assets['current'],
                'non_current': assets['non_current'],
                'total': assets['MXN']
            },
            'liabilities': {
                'current': liabilities['current'],
                'non_current': liabilities['non_current'],
                'total': liabilities['MXN']
            },
            'equity': {
                'accounts': equity['accounts'],
                'total': equity['MXN']
            },
            'total_liabilities_equity': total_liabilities_equity,
            'is_balanced': is_balanced,
            'balance_difference': assets['MXN'] - total_liabilities_equity
        }
    
    else:  # BOTH
        total_liabilities_equity_usd = liabilities['USD'] + equity['USD']
        total_liabilities_equity_mxn = liabilities['MXN'] + equity['MXN']
        is_balanced = (abs(assets['USD'] - total_liabilities_equity_usd) < 0.01 and 
                      abs(assets['MXN'] - total_liabilities_equity_mxn) < 0.01)
        
        return {
            'as_of_date': as_of_date,
            'currency': 'BOTH',
            'exchange_rate': float(exchange_rate),
            'assets': {
                'current': assets['current'],
                'non_current': assets['non_current'],
                'total_usd': assets['USD'],
                'total_mxn': assets['MXN']
            },
            'liabilities': {
                'current': liabilities['current'],
                'non_current': liabilities['non_current'],
                'total_usd': liabilities['USD'],
                'total_mxn': liabilities['MXN']
            },
            'equity': {
                'accounts': equity['accounts'],
                'total_usd': equity['USD'],
                'total_mxn': equity['MXN']
            },
            'total_liabilities_equity_usd': total_liabilities_equity_usd,
            'total_liabilities_equity_mxn': total_liabilities_equity_mxn,
            'is_balanced': is_balanced,
            'balance_difference_usd': assets['USD'] - total_liabilities_equity_usd,
            'balance_difference_mxn': assets['MXN'] - total_liabilities_equity_mxn
        }
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
