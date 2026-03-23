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
    
    # Allow partial updates
    status: Optional[str] = None
    current_location: Optional[str] = None
    us_stock_location: Optional[str] = None
    mexico_stock_location: Optional[str] = None
    asking_price: Optional[Decimal] = None
    minimum_price: Optional[Decimal] = None
    
    # Sale info
    client_id: Optional[int] = None
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
    client_id: Optional[int]
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
    await db.execute("""
        INSERT INTO audit_log 
        (user_id, username, action, table_name, record_id, old_values, new_values, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, user_id, username, action, table_name, record_id, 
         json.dumps(old_values) if old_values else None,
         json.dumps(new_values) if new_values else None,
         description)

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
async def create_exchange_rate(rate: ExchangeRateCreate, db=Depends(get_db)):
    """Add new exchange rate"""
    query = """
        INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    """
    row = await db.fetchrow(query, rate.from_currency, rate.to_currency, rate.rate, rate.effective_date)
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
        
        # CREATE ACCOUNTING ENTRIES FOR PURCHASE
        # Calculate total purchase cost (all in USD initially)
        purchase_price = float(inventory.purchase_price_usd or 0)
        transport_cost = float(inventory.transport_to_stock_cost_usd or 0)
        reconditioning_cost = float(inventory.initial_reconditioning_cost_usd or 0)
        other_costs = float(inventory.other_acquisition_costs_usd or 0)
        total_purchase_cost = purchase_price + transport_cost + reconditioning_cost + other_costs
        
        # Only create accounting entry if there's a purchase cost
        if total_purchase_cost > 0:
            from datetime import datetime
            purchase_date = inventory.purchase_date or datetime.now().date()
            stock_number = inventory.stock_number
            
            # Get account IDs
            inventory_account = await db.fetchrow(
                "SELECT account_id FROM accounts WHERE account_name = 'Bus Inventory'"
            )
            cash_account = await db.fetchrow(
                "SELECT account_id FROM accounts WHERE account_name = 'Cash on Hand - USD'"
            )
            
            if inventory_account and cash_account:
                # Create transaction
                reference_number = f"PURCH-{purchase_date.strftime('%Y%m%d')}-{stock_number}"
                
                transaction_id = await db.fetchval(
                    """
                    INSERT INTO transactions (
                        transaction_date, description, reference_type, reference_id,
                        reference_number, currency, created_by, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    RETURNING transaction_id
                    """,
                    purchase_date,
                    f"Purchase of {stock_number}",
                    "purchase",
                    row['inventory_id'],
                    reference_number,
                    'USD',
                    current_user['username']
                )
                
                # Line 1: Debit Bus Inventory (increase asset)
                await db.execute(
                    """
                    INSERT INTO transaction_lines (
                        transaction_id, account_id, debit_amount, credit_amount,
                        currency, notes
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    transaction_id, inventory_account['account_id'],
                    total_purchase_cost, 0,
                    'USD',
                    f"Purchase of {stock_number} - Total cost: ${total_purchase_cost:,.2f}"
                )
                
                # Line 2: Credit Cash (decrease asset - money paid out)
                await db.execute(
                    """
                    INSERT INTO transaction_lines (
                        transaction_id, account_id, debit_amount, credit_amount,
                        currency, notes
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    transaction_id, cash_account['account_id'],
                    0, total_purchase_cost,
                    'USD',
                    f"Payment for {stock_number}"
                )
        
        return dict(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=400, detail="VIN or Stock Number already exists")

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
    conditions = ["is_deleted = FALSE"]
    params = []
    param_count = 1
    
    if status:
        conditions.append(f"status = ${param_count}")
        params.append(status)
        param_count += 1
    
    if current_location:
        conditions.append(f"current_location = ${param_count}")
        params.append(current_location)
        param_count += 1
    
    if is_sold is not None:
        conditions.append(f"is_sold = ${param_count}")
        params.append(is_sold)
        param_count += 1
    
    if make:
        conditions.append(f"make ILIKE ${param_count}")
        params.append(f"%{make}%")
        param_count += 1
    
    if year:
        conditions.append(f"year = ${param_count}")
        params.append(year)
        param_count += 1
    
    if supplier_id:
        conditions.append(f"supplier_id = ${param_count}")
        params.append(supplier_id)
        param_count += 1
    
    where_clause = " AND ".join(conditions)
    query = f"""
        SELECT * FROM inventory 
        WHERE {where_clause}
        ORDER BY created_at DESC
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
async def update_inventory(inventory_id: int, updates: InventoryUpdate, db=Depends(get_db)):
    """Update inventory item"""
    update_dict = updates.dict(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
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

# ==================== UNIFIED SALES MANAGEMENT ====================

@app.post("/api/sales/record")
async def record_sale(
    sale_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    UNIFIED SALE RECORDING
    
    Records a complete sale transaction:
    1. Updates inventory (marks as sold, sets price/date/currency)
    2. Creates Revenue accounting entry
    3. Creates COGS accounting entry (from cost_items)
    4. Creates AR entry
    5. Links to client (if provided)
    
    This is the ONLY way to record a sale - ensures consistency
    """
    from datetime import datetime
    
    # Extract sale data
    inventory_id = sale_data.get('inventory_id')
    sale_price = float(sale_data.get('sale_price'))
    sale_currency = sale_data.get('sale_currency')
    sale_date_str = sale_data.get('sale_date')
    client_id = sale_data.get('client_id')  # Optional
    sale_notes = sale_data.get('sale_notes', '')
    
    # Convert date
    if isinstance(sale_date_str, str):
        sale_date = datetime.strptime(sale_date_str, '%Y-%m-%d').date()
    else:
        sale_date = datetime.now().date()
    
    # Verify inventory exists and is NOT already sold
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, is_deleted, 
               purchase_price_usd
        FROM inventory 
        WHERE inventory_id = $1
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if inventory['is_deleted']:
        raise HTTPException(status_code=400, detail="Cannot sell deleted inventory")
    
    if inventory['is_sold']:
        raise HTTPException(status_code=400, detail="Inventory already marked as sold")
    
    stock_number = inventory['stock_number']
    purchase_price_usd = float(inventory['purchase_price_usd'])
    
    # Check if sale already recorded in accounting
    existing_sale = await db.fetchval(
        "SELECT transaction_id FROM transactions WHERE reference_type = 'sale' AND reference_id = $1",
        inventory_id
    )
    
    if existing_sale:
        raise HTTPException(status_code=400, detail="Sale already recorded in accounting system")
    
    # Calculate COGS: Purchase Price + Cost Items
    # Get exchange rate if needed
    if sale_currency == 'MXN':
        # Need to convert purchase_price_usd to MXN
        exchange_rate_row = await db.fetchrow(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'MXN' AND is_active = TRUE ORDER BY effective_date DESC LIMIT 1"
        )
        usd_to_mxn_rate = float(exchange_rate_row['rate']) if exchange_rate_row else 17.50
        purchase_price_in_sale_currency = purchase_price_usd * usd_to_mxn_rate
    else:
        # Sale is in USD, purchase price is already in USD
        purchase_price_in_sale_currency = purchase_price_usd
    
    # Add cost items - need to convert to sale currency
    # Get all cost items (both USD and MXN)
    all_cost_items = await db.fetch(
        "SELECT amount, currency FROM cost_items WHERE inventory_id = $1",
        inventory_id
    )
    
    total_cost_items = 0.0
    for item in all_cost_items:
        item_amount = float(item['amount'])
        item_currency = item['currency']
        
        if item_currency == sale_currency:
            # Already in the right currency
            total_cost_items += item_amount
        elif item_currency == 'USD' and sale_currency == 'MXN':
            # Convert USD to MXN
            total_cost_items += item_amount * usd_to_mxn_rate
        elif item_currency == 'MXN' and sale_currency == 'USD':
            # Convert MXN to USD (divide by rate)
            total_cost_items += item_amount / usd_to_mxn_rate
    
    # Total COGS = Purchase Price (converted if needed) + Cost Items (all converted)
    total_cogs = purchase_price_in_sale_currency + total_cost_items
    
    # Get account IDs
    revenue_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name LIKE '%Bus Sales%' AND account_type = 'Income' LIMIT 1"
    )
    
    ar_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Accounts Receivable - {sale_currency}'"
    )
    
    cogs_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name LIKE '%Cost of Goods Sold%' AND account_code = '5000'"
    )
    
    inventory_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name = 'Bus Inventory'"
    )
    
    if not revenue_account:
        raise HTTPException(status_code=500, detail="Bus Sales Revenue account not found")
    if not ar_account:
        raise HTTPException(status_code=500, detail=f"Accounts Receivable - {sale_currency} account not found")
    if not cogs_account:
        raise HTTPException(status_code=500, detail="COGS account not found")
    if not inventory_account:
        raise HTTPException(status_code=500, detail="Bus Inventory account not found")
    
    # Generate reference number
    reference_number = f"SALE-{sale_date.strftime('%Y%m%d')}-{stock_number}"
    
    # START UNIFIED TRANSACTION
    async with db.transaction():
        # STEP 1: Update inventory (mark as sold)
        await db.execute(
            """
            UPDATE inventory 
            SET is_sold = TRUE,
                sale_price = $1,
                sale_currency = $2,
                sale_date = $3,
                sale_price_usd = CASE WHEN $2 = 'USD' THEN $1 ELSE NULL END,
                sale_price_mxn = CASE WHEN $2 = 'MXN' THEN $1 ELSE NULL END,
                client_id = $4
            WHERE inventory_id = $5
            """,
            sale_price, sale_currency, sale_date, client_id, inventory_id
        )
        
        # STEP 2: Create accounting transaction
        transaction_id = await db.fetchval(
            """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id, 
                reference_number, currency, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING transaction_id
            """,
            sale_date,
            f"Sale of {stock_number}" + (f" - {sale_notes}" if sale_notes else ""),
            "sale",
            inventory_id,
            reference_number,
            sale_currency,
            user['username']
        )
        
        # STEP 3: Create accounting entries
        
        # Line 1: Debit AR (increase receivable)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, ar_account['account_id'],
            sale_price, 0,
            sale_currency,
            f"Sale of {stock_number} - Receivable"
        )
        
        # Line 2: Credit Revenue (increase revenue)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, revenue_account['account_id'],
            0, sale_price,
            sale_currency,
            f"Sale of {stock_number} - Revenue"
        )
        
        # Line 3 & 4: COGS entries (if there are costs)
        if total_cogs > 0:
            # Debit COGS (record expense)
            await db.execute(
                """
                INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, cogs_account['account_id'],
                total_cogs, 0,
                sale_currency,
                f"COGS for {stock_number}"
            )
            
            # Credit Inventory (reduce asset)
            await db.execute(
                """
                INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, inventory_account['account_id'],
                0, total_cogs,
                sale_currency,
                f"Remove {stock_number} from inventory"
            )
    
    gross_profit = sale_price - total_cogs
    gross_profit_margin = (gross_profit / sale_price * 100) if sale_price > 0 else 0
    
    return {
        'success': True,
        'inventory_id': inventory_id,
        'stock_number': stock_number,
        'transaction_id': transaction_id,
        'reference_number': reference_number,
        'sale_price': sale_price,
        'currency': sale_currency,
        'cogs': total_cogs,
        'gross_profit': gross_profit,
        'gross_profit_margin': round(gross_profit_margin, 2),
        'ar_balance': sale_price,
        'message': f"Sale recorded successfully! {stock_number} sold for {sale_currency} ${sale_price:,.2f}. Gross Profit: {sale_currency} ${gross_profit:,.2f} ({gross_profit_margin:.1f}%)"
    }

@app.post("/api/sales/{inventory_id}/payment")
async def record_sale_payment(
    inventory_id: int,
    payment_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Record a payment for a sold bus
    
    Creates:
    1. Payment record in payments table
    2. Accounting entry (Debit Cash/Bank, Credit AR)
    
    Part of unified sales management
    """
    from datetime import datetime
    
    # Verify inventory exists and is sold
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_currency
        FROM inventory 
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        raise HTTPException(status_code=400, detail="Cannot record payment for unsold inventory. Record the sale first.")
    
    # Extract payment info
    payment_amount = float(payment_data.get('payment_amount'))
    payment_currency = payment_data.get('payment_currency', inventory['sale_currency'])
    payment_date_str = payment_data.get('payment_date')
    payment_method = payment_data.get('payment_method', 'Cash')
    payment_type = payment_data.get('payment_type', 'Payment')
    payment_account_id = payment_data.get('payment_account_id')  # Bank account receiving payment
    payment_notes = payment_data.get('payment_notes', '')
    
    # Convert date
    if isinstance(payment_date_str, str):
        payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
    else:
        payment_date = datetime.now().date()
    
    stock_number = inventory['stock_number']
    
    # Get AR account
    ar_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Accounts Receivable - {payment_currency}'"
    )
    
    if not ar_account:
        raise HTTPException(status_code=500, detail=f"AR account for {payment_currency} not found")
    
    # Get payment destination account (bank/cash)
    if not payment_account_id:
        raise HTTPException(status_code=400, detail="payment_account_id required (bank account receiving payment)")
    
    payment_account = await db.fetchrow(
        "SELECT account_id, account_name FROM accounts WHERE account_id = $1",
        int(payment_account_id)
    )
    
    if not payment_account:
        raise HTTPException(status_code=404, detail="Payment account not found")
    
    # Start transaction
    async with db.transaction():
        # Insert into payments table
        payment_id = await db.fetchval(
            """
            INSERT INTO payments (
                inventory_id, payment_amount, payment_currency, payment_date,
                payment_method, payment_type, payment_notes, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING payment_id
            """,
            inventory_id, payment_amount, payment_currency, payment_date,
            payment_method, payment_type, payment_notes, user['username']
        )
        
        # Count existing payments to generate sequence number
        payment_count = await db.fetchval(
            "SELECT COUNT(*) FROM payments WHERE inventory_id = $1",
            inventory_id
        )
        
        # Generate reference number
        reference_number = f"PYMT-{payment_date.strftime('%Y%m%d')}-{stock_number}-{payment_count:03d}"
        
        # Update payment with reference number
        await db.execute(
            "UPDATE payments SET reference_number = $1 WHERE payment_id = $2",
            reference_number, payment_id
        )
        
        # Create accounting transaction
        transaction_id = await db.fetchval(
            """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id,
                reference_number, currency, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING transaction_id
            """,
            payment_date,
            f"Payment for {stock_number} - {payment_type}",
            "payment",
            payment_id,
            reference_number,
            payment_currency,
            user['username']
        )
        
        # Transaction Line 1: Debit Cash/Bank (increase cash)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, payment_account['account_id'],
            payment_amount, 0,
            payment_currency,
            f"Received payment for {stock_number}"
        )
        
        # Transaction Line 2: Credit AR (reduce receivable)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, ar_account['account_id'],
            0, payment_amount,
            payment_currency,
            f"Payment reduces AR for {stock_number}"
        )
    
    # Get updated AR balance
    ar_balance_row = await db.fetchrow(
        """
        SELECT 
            i.sale_price,
            COALESCE(SUM(p.payment_amount), 0) as total_paid
        FROM inventory i
        LEFT JOIN payments p ON p.inventory_id = i.inventory_id AND p.payment_currency = i.sale_currency
        WHERE i.inventory_id = $1
        GROUP BY i.sale_price
        """,
        inventory_id
    )
    
    ar_balance = float(ar_balance_row['sale_price'] or 0) - float(ar_balance_row['total_paid'] or 0)
    
    return {
        'success': True,
        'payment_id': payment_id,
        'transaction_id': transaction_id,
        'reference_number': reference_number,
        'payment_amount': payment_amount,
        'currency': payment_currency,
        'ar_balance': ar_balance,
        'paid_in_full': ar_balance <= 0.01,  # Account for floating point
        'message': f"Payment recorded: {payment_currency} ${payment_amount:,.2f}. Remaining balance: {payment_currency} ${ar_balance:,.2f}"
    }

@app.get("/api/sales/{inventory_id}/summary")
async def get_sale_summary(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Get complete financial summary for a sale
    
    Returns:
    - Sale details (price, date, currency)
    - COGS and Gross Profit
    - Payment history
    - AR balance
    - Sale status
    """
    
    # Get inventory and sale info (including purchase price for COGS)
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_price, sale_currency, 
               sale_date, client_id, status, purchase_price_usd
        FROM inventory
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        return {
            'is_sold': False,
            'stock_number': inventory['stock_number'],
            'status': inventory['status'],
            'message': 'Bus not yet sold. Use POST /api/sales/record to record the sale.'
        }
    
    sale_price = float(inventory['sale_price'] or 0)
    sale_currency = inventory['sale_currency']
    purchase_price_usd = float(inventory['purchase_price_usd'])
    
    # Calculate COGS: Purchase Price + Cost Items
    # Convert purchase price to sale currency if needed
    if sale_currency == 'MXN':
        # Convert USD purchase price to MXN
        exchange_rate_row = await db.fetchrow(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'MXN' AND is_active = TRUE ORDER BY effective_date DESC LIMIT 1"
        )
        usd_to_mxn_rate = float(exchange_rate_row['rate']) if exchange_rate_row else 17.50
        purchase_price_in_sale_currency = purchase_price_usd * usd_to_mxn_rate
    else:
        usd_to_mxn_rate = 17.50  # Default rate for conversions
        purchase_price_in_sale_currency = purchase_price_usd
    
    # Add cost items - need to convert ALL costs to sale currency
    all_cost_items = await db.fetch(
        "SELECT amount, currency FROM cost_items WHERE inventory_id = $1",
        inventory_id
    )
    
    total_cost_items = 0.0
    for item in all_cost_items:
        item_amount = float(item['amount'])
        item_currency = item['currency']
        
        if item_currency == sale_currency:
            # Already in the right currency
            total_cost_items += item_amount
        elif item_currency == 'USD' and sale_currency == 'MXN':
            # Convert USD to MXN
            total_cost_items += item_amount * usd_to_mxn_rate
        elif item_currency == 'MXN' and sale_currency == 'USD':
            # Convert MXN to USD (divide by rate)
            total_cost_items += item_amount / usd_to_mxn_rate
    
    # Total COGS = Purchase Price + Cost Items (all converted to sale currency)
    total_cogs = purchase_price_in_sale_currency + total_cost_items
    
    # Check if sale recorded in accounting
    sale_transaction = await db.fetchrow(
        """
        SELECT transaction_id, reference_number, transaction_date
        FROM transactions 
        WHERE reference_type = 'sale' AND reference_id = $1
        """,
        inventory_id
    )
    
    # Get payments
    payments = await db.fetch(
        """
        SELECT payment_id, payment_amount, payment_currency, payment_date,
               payment_method, payment_type, reference_number, payment_notes
        FROM payments
        WHERE inventory_id = $1
        ORDER BY payment_date ASC
        """,
        inventory_id
    )
    
    total_paid = sum(float(p['payment_amount']) for p in payments if p['payment_currency'] == sale_currency)
    ar_balance = sale_price - total_paid
    
    # Determine sale status
    if ar_balance <= 0.01:
        payment_status = 'Paid in Full'
    elif total_paid > 0:
        payment_status = 'Partially Paid'
    else:
        payment_status = 'Unpaid'
    
    # Get client info if available
    client = None
    if inventory['client_id']:
        client = await db.fetchrow(
            "SELECT client_id, client_name, client_email, client_phone FROM clients WHERE client_id = $1",
            inventory['client_id']
        )
    
    return {
        'is_sold': True,
        'stock_number': inventory['stock_number'],
        'sale_date': str(inventory['sale_date']) if inventory['sale_date'] else None,
        'sale_price': sale_price,
        'currency': sale_currency,
        'cogs': total_cogs,
        'gross_profit': sale_price - total_cogs,
        'gross_profit_margin': ((sale_price - total_cogs) / sale_price * 100) if sale_price > 0 else 0,
        'sale_recorded_in_accounting': bool(sale_transaction),
        'sale_reference_number': sale_transaction['reference_number'] if sale_transaction else None,
        'total_payments_received': total_paid,
        'ar_balance': ar_balance,
        'payment_status': payment_status,
        'payment_count': len(payments),
        'payments': [dict(p) for p in payments],
        'client': dict(client) if client else None
    }

@app.post("/api/sales/{inventory_id}/import-payments")
async def import_existing_sale_payments(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    ONE-TIME MIGRATION: Import existing payments into accounting system
    
    For payments that were recorded before the unified sales system.
    Creates accounting entries for payments that don't have them yet.
    """
    from datetime import datetime
    
    # Verify inventory exists and is sold
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_currency
        FROM inventory 
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        raise HTTPException(status_code=400, detail="Cannot import payments for unsold inventory")
    
    stock_number = inventory['stock_number']
    sale_currency = inventory['sale_currency']
    
    # Get AR account
    ar_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Accounts Receivable - {sale_currency}'"
    )
    
    if not ar_account:
        raise HTTPException(status_code=500, detail=f"AR account for {sale_currency} not found")
    
    # Find payments without accounting entries
    payments_to_import = await db.fetch(
        """
        SELECT p.payment_id, p.payment_amount, p.payment_currency, p.payment_date,
               p.payment_method, p.payment_type, p.payment_notes
        FROM payments p
        LEFT JOIN transactions t ON t.reference_type = 'payment' AND t.reference_id = p.payment_id
        WHERE p.inventory_id = $1 AND t.transaction_id IS NULL
        ORDER BY p.payment_date, p.payment_id
        """,
        inventory_id
    )
    
    if not payments_to_import:
        return {
            'success': True,
            'imported_count': 0,
            'message': 'No payments need importing. All payments already have accounting entries.'
        }
    
    # Use default cash account
    default_cash_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Cash on Hand - {sale_currency}'"
    )
    
    if not default_cash_account:
        raise HTTPException(status_code=500, detail=f"Default cash account not found")
    
    imported_count = 0
    imported_transactions = []
    
    # Process each payment
    for idx, payment in enumerate(payments_to_import, start=1):
        payment_id = payment['payment_id']
        payment_amount = float(payment['payment_amount'])
        payment_currency = payment['payment_currency']
        payment_date = payment['payment_date']
        payment_type = payment['payment_type']
        
        reference_number = f"PYMT-{payment_date.strftime('%Y%m%d')}-{stock_number}-{idx:03d}"
        
        async with db.transaction():
            await db.execute(
                "UPDATE payments SET reference_number = $1 WHERE payment_id = $2",
                reference_number, payment_id
            )
            
            transaction_id = await db.fetchval(
                """
                INSERT INTO transactions (
                    transaction_date, description, reference_type, reference_id,
                    reference_number, currency, created_by, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING transaction_id
                """,
                payment_date,
                f"Payment for {stock_number} - {payment_type} (imported)",
                "payment",
                payment_id,
                reference_number,
                payment_currency,
                user['username']
            )
            
            await db.execute(
                """
                INSERT INTO transaction_lines (
                    transaction_id, account_id, debit_amount, credit_amount,
                    currency, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, default_cash_account['account_id'],
                payment_amount, 0,
                payment_currency,
                f"Received payment for {stock_number} (imported)"
            )
            
            await db.execute(
                """
                INSERT INTO transaction_lines (
                    transaction_id, account_id, debit_amount, credit_amount,
                    currency, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, ar_account['account_id'],
                0, payment_amount,
                payment_currency,
                f"Payment reduces AR for {stock_number} (imported)"
            )
            
            imported_count += 1
            imported_transactions.append({
                'payment_id': payment_id,
                'transaction_id': transaction_id,
                'reference_number': reference_number,
                'amount': payment_amount,
                'date': str(payment_date)
            })
    
    return {
        'success': True,
        'imported_count': imported_count,
        'imported_transactions': imported_transactions,
        'message': f"Successfully imported {imported_count} payment(s) into accounting system"
    }

@app.post("/api/sales/{inventory_id}/record-sale-accounting")
async def record_sale_accounting_retroactive(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    RETROACTIVE SALE RECORDING
    
    For buses that were marked as sold BEFORE the unified accounting system.
    Creates the Revenue + COGS + AR accounting entries for an already-sold bus.
    
    Requirements:
    - Inventory must already be marked as sold (is_sold = True)
    - Must have sale_price, sale_currency, sale_date
    - Sale must NOT already be recorded in accounting
    """
    from datetime import datetime
    
    # Get inventory details
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_price, sale_currency, 
               sale_date, purchase_price_usd
        FROM inventory 
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        raise HTTPException(status_code=400, detail="Inventory must be marked as sold. Use POST /api/sales/record for new sales.")
    
    if not inventory['sale_price'] or not inventory['sale_currency']:
        raise HTTPException(status_code=400, detail="Sale price and currency required")
    
    # Check if sale already recorded in accounting
    existing_sale = await db.fetchval(
        "SELECT transaction_id FROM transactions WHERE reference_type = 'sale' AND reference_id = $1",
        inventory_id
    )
    
    if existing_sale:
        raise HTTPException(status_code=400, detail="Sale already recorded in accounting. Cannot record twice.")
    
    sale_price = float(inventory['sale_price'])
    sale_currency = inventory['sale_currency']
    sale_date = inventory['sale_date'] or datetime.now().date()
    stock_number = inventory['stock_number']
    purchase_price_usd = float(inventory['purchase_price_usd'])
    
    # Calculate COGS: Purchase Price + Cost Items
    if sale_currency == 'MXN':
        exchange_rate_row = await db.fetchrow(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'MXN' AND is_active = TRUE ORDER BY effective_date DESC LIMIT 1"
        )
        usd_to_mxn_rate = float(exchange_rate_row['rate']) if exchange_rate_row else 17.50
        purchase_price_in_sale_currency = purchase_price_usd * usd_to_mxn_rate
    else:
        usd_to_mxn_rate = 17.50
        purchase_price_in_sale_currency = purchase_price_usd
    
    # Get all cost items and convert to sale currency
    all_cost_items = await db.fetch(
        "SELECT amount, currency FROM cost_items WHERE inventory_id = $1",
        inventory_id
    )
    
    total_cost_items = 0.0
    for item in all_cost_items:
        item_amount = float(item['amount'])
        item_currency = item['currency']
        
        if item_currency == sale_currency:
            total_cost_items += item_amount
        elif item_currency == 'USD' and sale_currency == 'MXN':
            total_cost_items += item_amount * usd_to_mxn_rate
        elif item_currency == 'MXN' and sale_currency == 'USD':
            total_cost_items += item_amount / usd_to_mxn_rate
    
    total_cogs = purchase_price_in_sale_currency + total_cost_items
    
    # Get account IDs
    revenue_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name LIKE '%Bus Sales%' AND account_type = 'Income' LIMIT 1"
    )
    
    ar_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Accounts Receivable - {sale_currency}'"
    )
    
    cogs_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name LIKE '%Cost of Goods Sold%' AND account_code = '5000'"
    )
    
    inventory_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name = 'Bus Inventory'"
    )
    
    if not revenue_account:
        raise HTTPException(status_code=500, detail="Bus Sales Revenue account not found")
    if not ar_account:
        raise HTTPException(status_code=500, detail=f"Accounts Receivable - {sale_currency} account not found")
    if not cogs_account:
        raise HTTPException(status_code=500, detail="COGS account not found")
    if not inventory_account:
        raise HTTPException(status_code=500, detail="Bus Inventory account not found")
    
    reference_number = f"SALE-{sale_date.strftime('%Y%m%d')}-{stock_number}"
    
    # Create accounting entries
    async with db.transaction():
        # Main transaction record
        transaction_id = await db.fetchval(
            """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id,
                reference_number, currency, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING transaction_id
            """,
            sale_date,
            f"Sale of {stock_number} (retroactive)",
            "sale",
            inventory_id,
            reference_number,
            sale_currency,
            user['username']
        )
        
        # Line 1: Debit AR (increase receivable)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, ar_account['account_id'],
            sale_price, 0,
            sale_currency,
            f"Sale of {stock_number} - Receivable (retroactive)"
        )
        
        # Line 2: Credit Revenue (increase revenue)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, revenue_account['account_id'],
            0, sale_price,
            sale_currency,
            f"Sale of {stock_number} - Revenue (retroactive)"
        )
        
        # Line 3: Debit COGS (increase expense)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, cogs_account['account_id'],
            total_cogs, 0,
            sale_currency,
            f"COGS for {stock_number} (retroactive)"
        )
        
        # Line 4: Credit Inventory (decrease asset)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, inventory_account['account_id'],
            0, total_cogs,
            sale_currency,
            f"Inventory sold: {stock_number} (retroactive)"
        )
    
    gross_profit = sale_price - total_cogs
    margin = (gross_profit / sale_price * 100) if sale_price > 0 else 0
    
    return {
        'success': True,
        'transaction_id': transaction_id,
        'reference_number': reference_number,
        'sale_price': sale_price,
        'cogs': total_cogs,
        'gross_profit': gross_profit,
        'margin': round(margin, 2),
        'currency': sale_currency,
        'message': f"Sale accounting entries created for {stock_number}. Revenue and COGS recorded."
    }

# ==================== PURCHASE PAYMENT ENDPOINTS ====================

@app.post("/api/inventory/{inventory_id}/record-purchase-payment")
async def record_purchase_payment(
    inventory_id: int,
    payment_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Record the payment for a bus purchase in accounting
    
    Creates:
    1. Debit Bus Inventory (Asset increases)
    2. Credit Payment Account (Asset decreases - cash/bank account)
    
    Handles multi-currency: If payment is from MXN account but purchase is in USD,
    uses exchange rate for conversion.
    
    Required fields in payment_data:
    - payment_account_id: Which account was used to pay
    - payment_date: When payment was made (optional, defaults to purchase_date)
    """
    from datetime import datetime
    
    # Extract payment data
    payment_account_id = payment_data.get('payment_account_id')
    payment_date_str = payment_data.get('payment_date')
    
    if not payment_account_id:
        raise HTTPException(status_code=400, detail="payment_account_id is required")
    
    # Get inventory details
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, purchase_price_usd, purchase_date
        FROM inventory
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['purchase_price_usd']:
        raise HTTPException(status_code=400, detail="Bus must have a purchase price")
    
    purchase_price_usd = float(inventory['purchase_price_usd'])
    stock_number = inventory['stock_number']
    
    # Use provided payment date or default to purchase date
    if payment_date_str:
        payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
    else:
        payment_date = inventory['purchase_date'] or datetime.now().date()
    
    # Check if purchase payment already recorded
    existing_payment = await db.fetchval(
        "SELECT transaction_id FROM transactions WHERE reference_type = 'purchase' AND reference_id = $1",
        inventory_id
    )
    
    if existing_payment:
        raise HTTPException(status_code=400, detail="Purchase payment already recorded in accounting")
    
    # Get payment account details
    payment_account = await db.fetchrow(
        "SELECT account_id, account_name, currency FROM accounts WHERE account_id = $1",
        payment_account_id
    )
    
    if not payment_account:
        raise HTTPException(status_code=404, detail="Payment account not found")
    
    payment_account_currency = payment_account['currency']
    
    # Get Bus Inventory account
    inventory_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name = 'Bus Inventory'"
    )
    
    if not inventory_account:
        raise HTTPException(status_code=500, detail="Bus Inventory account not found")
    
    # Handle currency conversion if needed
    if payment_account_currency == 'MXN':
        # Payment is in MXN, but purchase is in USD - need to convert
        exchange_rate_row = await db.fetchrow(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'MXN' AND is_active = TRUE ORDER BY effective_date DESC LIMIT 1"
        )
        usd_to_mxn_rate = float(exchange_rate_row['rate']) if exchange_rate_row else 17.50
        payment_amount_mxn = purchase_price_usd * usd_to_mxn_rate
        payment_currency = 'MXN'
        payment_amount = payment_amount_mxn
    elif payment_account_currency == 'USD':
        # Both in USD - straightforward
        payment_currency = 'USD'
        payment_amount = purchase_price_usd
    else:
        # Account is multi-currency - default to USD
        payment_currency = 'USD'
        payment_amount = purchase_price_usd
    
    reference_number = f"PURCH-{payment_date.strftime('%Y%m%d')}-{stock_number}"
    
    # Create accounting entries
    async with db.transaction():
        # Main transaction record
        transaction_id = await db.fetchval(
            """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id,
                reference_number, currency, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING transaction_id
            """,
            payment_date,
            f"Purchase of {stock_number}",
            "purchase",
            inventory_id,
            reference_number,
            payment_currency,
            user['username']
        )
        
        # Line 1: Debit Bus Inventory (increase asset)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, inventory_account['account_id'],
            payment_amount, 0,
            payment_currency,
            f"Purchase of {stock_number} - Add to inventory"
        )
        
        # Line 2: Credit Payment Account (decrease cash/bank)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, payment_account['account_id'],
            0, payment_amount,
            payment_currency,
            f"Payment for {stock_number}"
        )
    
    return {
        'success': True,
        'transaction_id': transaction_id,
        'reference_number': reference_number,
        'purchase_price_usd': purchase_price_usd,
        'payment_amount': payment_amount,
        'payment_currency': payment_currency,
        'payment_account': payment_account['account_name'],
        'message': f"Purchase payment recorded for {stock_number}"
    }

# ==================== CLIENTS ENDPOINTS ====================

@app.get("/api/clients")
async def get_clients(
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get all clients for dropdowns and selection"""
    try:
        query = """
            SELECT client_id, client_name, client_email, client_phone, 
                   client_company, client_location
            FROM clients
            WHERE is_deleted = FALSE
            ORDER BY client_name
        """
        rows = await db.fetch(query)
        return [dict(row) for row in rows]
    except Exception as e:
        # If clients table doesn't exist, return empty array
        # This allows the system to work without client management
        return []

# ==================== COST ITEMS ENDPOINTS ====================
async def record_inventory_sale(
    inventory_id: int,
    sale_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Record a bus sale in the accounting system
    
    Creates:
    1. Revenue entry (Debit AR, Credit Revenue)
    2. COGS entry (Debit COGS, Credit Inventory)
    
    Requires inventory to be marked as sold first (is_sold = True)
    """
    from datetime import datetime
    
    # Verify inventory exists and is sold
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_price, sale_currency, sale_date
        FROM inventory 
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        raise HTTPException(status_code=400, detail="Inventory must be marked as sold before recording sale")
    
    if not inventory['sale_price'] or not inventory['sale_currency']:
        raise HTTPException(status_code=400, detail="Sale price and currency required")
    
    # Check if sale already recorded
    existing_sale = await db.fetchval(
        "SELECT transaction_id FROM transactions WHERE reference_type = 'sale' AND reference_id = $1",
        inventory_id
    )
    
    if existing_sale:
        raise HTTPException(status_code=400, detail="Sale already recorded in accounting. Cannot record twice.")
    
    sale_price = float(inventory['sale_price'])
    sale_currency = inventory['sale_currency']
    sale_date = inventory['sale_date'] or datetime.now().date()
    stock_number = inventory['stock_number']
    
    # Calculate COGS from cost_items
    cogs_query = """
        SELECT COALESCE(SUM(amount), 0) as total_cogs
        FROM cost_items
        WHERE inventory_id = $1 AND currency = $2
    """
    cogs_row = await db.fetchrow(cogs_query, inventory_id, sale_currency)
    total_cogs = float(cogs_row['total_cogs'])
    
    # Get account IDs
    revenue_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name LIKE '%Bus Sales%' AND account_type = 'Income' LIMIT 1"
    )
    
    ar_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Accounts Receivable - {sale_currency}'"
    )
    
    cogs_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name LIKE '%Cost of Goods Sold%' AND account_code = '5000'"
    )
    
    inventory_account = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name = 'Bus Inventory'"
    )
    
    if not revenue_account:
        raise HTTPException(status_code=500, detail="Bus Sales Revenue account not found")
    if not ar_account:
        raise HTTPException(status_code=500, detail=f"Accounts Receivable - {sale_currency} account not found")
    if not cogs_account:
        raise HTTPException(status_code=500, detail="COGS account not found")
    if not inventory_account:
        raise HTTPException(status_code=500, detail="Bus Inventory account not found")
    
    # Generate reference number
    reference_number = f"SALE-{sale_date.strftime('%Y%m%d')}-{stock_number}"
    
    # Start transaction
    async with db.transaction():
        # Create main transaction record
        transaction_id = await db.fetchval(
            """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id, 
                reference_number, currency, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING transaction_id
            """,
            sale_date,
            f"Sale of {stock_number}",
            "sale",
            inventory_id,
            reference_number,
            sale_currency,
            user['username']
        )
        
        # Transaction Line 1: Debit AR (increase receivable)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, ar_account['account_id'],
            sale_price, 0,
            sale_currency,
            f"Sale of {stock_number} - Receivable"
        )
        
        # Transaction Line 2: Credit Revenue (increase revenue)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, revenue_account['account_id'],
            0, sale_price,
            sale_currency,
            f"Sale of {stock_number} - Revenue"
        )
        
        # Transaction Line 3: Debit COGS (record expense)
        if total_cogs > 0:
            await db.execute(
                """
                INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, cogs_account['account_id'],
                total_cogs, 0,
                sale_currency,
                f"COGS for {stock_number}"
            )
            
            # Transaction Line 4: Credit Inventory (reduce asset)
            await db.execute(
                """
                INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, inventory_account['account_id'],
                0, total_cogs,
                sale_currency,
                f"Remove {stock_number} from inventory"
            )
    
    gross_profit = sale_price - total_cogs
    
    return {
        'success': True,
        'transaction_id': transaction_id,
        'reference_number': reference_number,
        'sale_price': sale_price,
        'currency': sale_currency,
        'cogs': total_cogs,
        'gross_profit': gross_profit,
        'ar_balance': sale_price,  # Initially equals sale price
        'message': f"Sale recorded successfully. Gross Profit: {sale_currency} ${gross_profit:,.2f}"
    }

@app.post("/api/inventory/{inventory_id}/record-payment")
async def record_inventory_payment(
    inventory_id: int,
    payment_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Record a payment against a sold bus
    
    Creates:
    1. Payment record in payments table
    2. Accounting entry (Debit Cash/Bank, Credit AR)
    """
    from datetime import datetime
    
    # Verify inventory exists and is sold
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_currency
        FROM inventory 
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        raise HTTPException(status_code=400, detail="Cannot record payment for unsold inventory")
    
    # Extract payment info
    payment_amount = float(payment_data.get('payment_amount'))
    payment_currency = payment_data.get('payment_currency', inventory['sale_currency'])
    payment_date_str = payment_data.get('payment_date')
    payment_method = payment_data.get('payment_method', 'Cash')
    payment_type = payment_data.get('payment_type', 'Payment')
    payment_account_id = payment_data.get('payment_account_id')  # Bank account receiving payment
    payment_notes = payment_data.get('payment_notes', '')
    
    # Convert date
    if isinstance(payment_date_str, str):
        payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
    else:
        payment_date = datetime.now().date()
    
    stock_number = inventory['stock_number']
    
    # Get AR account
    ar_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Accounts Receivable - {payment_currency}'"
    )
    
    if not ar_account:
        raise HTTPException(status_code=500, detail=f"AR account for {payment_currency} not found")
    
    # Get payment destination account (bank/cash)
    if not payment_account_id:
        raise HTTPException(status_code=400, detail="payment_account_id required (bank account receiving payment)")
    
    payment_account = await db.fetchrow(
        "SELECT account_id, account_name FROM accounts WHERE account_id = $1",
        int(payment_account_id)
    )
    
    if not payment_account:
        raise HTTPException(status_code=404, detail="Payment account not found")
    
    # Start transaction
    async with db.transaction():
        # Insert into payments table
        payment_id = await db.fetchval(
            """
            INSERT INTO payments (
                inventory_id, payment_amount, payment_currency, payment_date,
                payment_method, payment_type, payment_notes, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING payment_id
            """,
            inventory_id, payment_amount, payment_currency, payment_date,
            payment_method, payment_type, payment_notes, user['username']
        )
        
        # Count existing payments to generate sequence number
        payment_count = await db.fetchval(
            "SELECT COUNT(*) FROM payments WHERE inventory_id = $1",
            inventory_id
        )
        
        # Generate reference number
        reference_number = f"PYMT-{payment_date.strftime('%Y%m%d')}-{stock_number}-{payment_count:03d}"
        
        # Update payment with reference number
        await db.execute(
            "UPDATE payments SET reference_number = $1 WHERE payment_id = $2",
            reference_number, payment_id
        )
        
        # Create accounting transaction
        transaction_id = await db.fetchval(
            """
            INSERT INTO transactions (
                transaction_date, description, reference_type, reference_id,
                reference_number, currency, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING transaction_id
            """,
            payment_date,
            f"Payment for {stock_number} - {payment_type}",
            "payment",
            payment_id,
            reference_number,
            payment_currency,
            user['username']
        )
        
        # Transaction Line 1: Debit Cash/Bank (increase cash)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, payment_account['account_id'],
            payment_amount, 0,
            payment_currency,
            f"Received payment for {stock_number}"
        )
        
        # Transaction Line 2: Credit AR (reduce receivable)
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            transaction_id, ar_account['account_id'],
            0, payment_amount,
            payment_currency,
            f"Payment reduces AR for {stock_number}"
        )
    
    return {
        'success': True,
        'payment_id': payment_id,
        'transaction_id': transaction_id,
        'reference_number': reference_number,
        'payment_amount': payment_amount,
        'currency': payment_currency,
        'message': f"Payment recorded successfully: {payment_currency} ${payment_amount:,.2f}"
    }

@app.get("/api/inventory/{inventory_id}/sale-summary")
async def get_inventory_sale_summary(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Get financial summary for a sold bus
    
    Returns:
    - Sale price, COGS, Gross Profit
    - Total payments received
    - AR balance
    - Payment history
    """
    
    # Get inventory info
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_price, sale_currency, sale_date
        FROM inventory
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        return {
            'is_sold': False,
            'message': 'Bus not yet sold'
        }
    
    sale_price = float(inventory['sale_price'] or 0)
    sale_currency = inventory['sale_currency']
    
    # Calculate COGS
    cogs = await db.fetchval(
        """
        SELECT COALESCE(SUM(amount), 0)
        FROM cost_items
        WHERE inventory_id = $1 AND currency = $2
        """,
        inventory_id, sale_currency
    )
    total_cogs = float(cogs or 0)
    
    # Check if sale recorded in accounting
    sale_recorded = await db.fetchval(
        "SELECT transaction_id FROM transactions WHERE reference_type = 'sale' AND reference_id = $1",
        inventory_id
    )
    
    # Get payments
    payments = await db.fetch(
        """
        SELECT payment_id, payment_amount, payment_currency, payment_date,
               payment_method, payment_type, reference_number, payment_notes
        FROM payments
        WHERE inventory_id = $1
        ORDER BY payment_date ASC
        """,
        inventory_id
    )
    
    total_paid = sum(float(p['payment_amount']) for p in payments if p['payment_currency'] == sale_currency)
    
    # Calculate AR balance
    ar_balance = sale_price - total_paid if sale_recorded else sale_price
    
    return {
        'is_sold': True,
        'stock_number': inventory['stock_number'],
        'sale_date': str(inventory['sale_date']),
        'sale_price': sale_price,
        'currency': sale_currency,
        'cogs': total_cogs,
        'gross_profit': sale_price - total_cogs,
        'gross_profit_margin': ((sale_price - total_cogs) / sale_price * 100) if sale_price > 0 else 0,
        'sale_recorded_in_accounting': bool(sale_recorded),
        'total_payments_received': total_paid,
        'ar_balance': ar_balance,
        'payment_count': len(payments),
        'payments': [dict(p) for p in payments]
    }

@app.post("/api/inventory/{inventory_id}/import-existing-payments")
async def import_existing_payments(
    inventory_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    ONE-TIME MIGRATION: Import existing payments into accounting system
    
    For payments that were recorded in the payments table but never 
    created accounting entries. This creates the missing accounting 
    entries (Debit Cash, Credit AR) for each payment.
    """
    from datetime import datetime
    
    # Verify inventory exists and is sold
    inventory = await db.fetchrow(
        """
        SELECT inventory_id, stock_number, is_sold, sale_currency
        FROM inventory 
        WHERE inventory_id = $1 AND is_deleted = FALSE
        """,
        inventory_id
    )
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    if not inventory['is_sold']:
        raise HTTPException(status_code=400, detail="Cannot import payments for unsold inventory")
    
    stock_number = inventory['stock_number']
    sale_currency = inventory['sale_currency']
    
    # Get AR account
    ar_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Accounts Receivable - {sale_currency}'"
    )
    
    if not ar_account:
        raise HTTPException(status_code=500, detail=f"AR account for {sale_currency} not found")
    
    # Find all payments that don't have accounting entries yet
    payments_to_import = await db.fetch(
        """
        SELECT p.payment_id, p.payment_amount, p.payment_currency, p.payment_date,
               p.payment_method, p.payment_type, p.payment_notes
        FROM payments p
        LEFT JOIN transactions t ON t.reference_type = 'payment' AND t.reference_id = p.payment_id
        WHERE p.inventory_id = $1 AND t.transaction_id IS NULL
        ORDER BY p.payment_date, p.payment_id
        """,
        inventory_id
    )
    
    if not payments_to_import:
        return {
            'success': True,
            'imported_count': 0,
            'message': 'No payments need importing. All payments already have accounting entries.'
        }
    
    # For payments without a payment_account_id, we need to determine where to credit
    # We'll use a default cash account or require it in the request
    # For now, let's use "Cash on Hand" in the appropriate currency
    default_cash_account = await db.fetchrow(
        f"SELECT account_id FROM accounts WHERE account_name = 'Cash on Hand - {sale_currency}'"
    )
    
    if not default_cash_account:
        raise HTTPException(
            status_code=500, 
            detail=f"Default cash account not found. Please specify payment_account_id for each payment."
        )
    
    imported_count = 0
    imported_transactions = []
    
    # Process each payment
    for idx, payment in enumerate(payments_to_import, start=1):
        payment_id = payment['payment_id']
        payment_amount = float(payment['payment_amount'])
        payment_currency = payment['payment_currency']
        payment_date = payment['payment_date']
        payment_type = payment['payment_type']
        
        # Generate reference number
        reference_number = f"PYMT-{payment_date.strftime('%Y%m%d')}-{stock_number}-{idx:03d}"
        
        async with db.transaction():
            # Update payment with reference number
            await db.execute(
                "UPDATE payments SET reference_number = $1 WHERE payment_id = $2",
                reference_number, payment_id
            )
            
            # Create accounting transaction
            transaction_id = await db.fetchval(
                """
                INSERT INTO transactions (
                    transaction_date, description, reference_type, reference_id,
                    reference_number, currency, created_by, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING transaction_id
                """,
                payment_date,
                f"Payment for {stock_number} - {payment_type} (imported)",
                "payment",
                payment_id,
                reference_number,
                payment_currency,
                user['username']
            )
            
            # Transaction Line 1: Debit Cash (increase cash)
            await db.execute(
                """
                INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, default_cash_account['account_id'],
                payment_amount, 0,
                payment_currency,
                f"Received payment for {stock_number} (imported)"
            )
            
            # Transaction Line 2: Credit AR (reduce receivable)
            await db.execute(
                """
                INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount,
                currency, notes
            )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id, ar_account['account_id'],
                0, payment_amount,
                payment_currency,
                f"Payment reduces AR for {stock_number} (imported)"
            )
            
            imported_count += 1
            imported_transactions.append({
                'payment_id': payment_id,
                'transaction_id': transaction_id,
                'reference_number': reference_number,
                'amount': payment_amount,
                'date': str(payment_date)
            })
    
    return {
        'success': True,
        'imported_count': imported_count,
        'imported_transactions': imported_transactions,
        'message': f"Successfully imported {imported_count} payment(s) into accounting system"
    }

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
            ) VALUES ($1, $2, $3, $4, $5, $6)
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
        
        # Update cost item with transaction reference
        await db.execute(
            "UPDATE cost_items SET notes = $1 WHERE cost_id = $2",
            f"Accounting Ref: {reference_number}",
            cost_row['cost_id']
        )
        
        # Audit log
        await log_audit(
            db, user['user_id'], user['username'],
            'create', 'cost_items', cost_row['cost_id'],
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
    
    return dict(row)

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
    
    return {"message": "Payment deleted successfully"}

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
    where_clauses = ["is_sold = TRUE", "is_deleted = FALSE"]
    params = []
    param_count = 1
    
    # Date filter
    where_clauses.append(f"sale_date >= ${param_count}")
    params.append(start_date)
    param_count += 1
    
    where_clauses.append(f"sale_date <= ${param_count}")
    params.append(end_date)
    param_count += 1
    
    # Currency filter (optional)
    if currency and currency != 'ALL':
        where_clauses.append(f"sale_currency = ${param_count}")
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
            i.client_use_case,
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
        # Get additional costs from cost_items
        costs_query = """
            SELECT 
                SUM(CASE WHEN currency = 'USD' THEN amount ELSE 0 END) as usd_costs,
                SUM(CASE WHEN currency = 'MXN' THEN amount ELSE 0 END) as mxn_costs
            FROM cost_items
            WHERE inventory_id = $1
        """
        costs = await db.fetchrow(costs_query, sale['inventory_id'])
        
        usd_costs = float(costs['usd_costs'] or 0)
        mxn_costs = float(costs['mxn_costs'] or 0)
        purchase_price = float(sale['purchase_price_usd'] or 0)
        
        # Calculate total costs
        total_cost_usd = purchase_price + usd_costs
        
        # Get current exchange rate for conversion
        exchange_rate_row = await db.fetchrow(
            "SELECT rate FROM exchange_rates ORDER BY created_at DESC LIMIT 1"
        )
        exchange_rate = float(exchange_rate_row['rate']) if exchange_rate_row else 17.50
        
        # Calculate profit based on sale currency
        sale_price = float(sale['sale_price'] or 0)
        if sale['sale_currency'] == 'USD':
            cost_in_sale_currency = total_cost_usd
            profit = sale_price - cost_in_sale_currency
            total_profit_usd += profit
        else:  # MXN
            cost_in_sale_currency = (total_cost_usd * exchange_rate) + mxn_costs
            profit = sale_price - cost_in_sale_currency
            total_profit_mxn += profit
        
        profit_margin = (profit / sale_price * 100) if sale_price > 0 else 0
        
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
            'sale_currency': sale['sale_currency'],
            'purchase_price_usd': purchase_price,
            'additional_costs_usd': usd_costs,
            'additional_costs_mxn': mxn_costs,
            'total_cost': cost_in_sale_currency,
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
            STRING_AGG(DISTINCT i.client_use_case, ', ') as use_cases
        FROM inventory i
        LEFT JOIN clients c ON i.client_id = c.client_id
        WHERE {where_clause} AND i.client_id IS NOT NULL
        GROUP BY c.client_name, c.client_company, c.client_location
        ORDER BY total_purchases DESC, total_spent_usd DESC
        LIMIT 10
    """
    top_clients = await db.fetch(client_analytics_query, *params)
    
    # Use case breakdown
    use_case_query = f"""
        SELECT 
            COALESCE(i.client_use_case, 'Not Specified') as use_case,
            COUNT(*) as count,
            SUM(CASE WHEN i.sale_currency = 'USD' THEN i.sale_price ELSE 0 END) as revenue_usd,
            SUM(CASE WHEN i.sale_currency = 'MXN' THEN i.sale_price ELSE 0 END) as revenue_mxn
        FROM inventory i
        WHERE {where_clause}
        GROUP BY i.client_use_case
        ORDER BY count DESC
    """
    use_case_breakdown = await db.fetch(use_case_query, *params)
    
    # ========== MONTHLY TRENDS ==========
    monthly_query = f"""
        SELECT 
            DATE_TRUNC('month', sale_date) as month,
            COUNT(*) as sales_count,
            SUM(CASE WHEN sale_currency = 'USD' THEN sale_price ELSE 0 END) as revenue_usd,
            SUM(CASE WHEN sale_currency = 'MXN' THEN sale_price ELSE 0 END) as revenue_mxn
        FROM inventory
        WHERE {where_clause}
        GROUP BY DATE_TRUNC('month', sale_date)
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
        ) VALUES ($1, $2, $3, $4, $5, $6)
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
    
    return {
        "transaction": dict(trans_row),
        "lines": lines
    }

async def update_account_balances(db, transaction_id: int):
    """Update cached account balances after a transaction"""
    # Get transaction date
    trans = await db.fetchrow(
        "SELECT transaction_date FROM transactions WHERE transaction_id = $1",
        transaction_id
    )
    trans_date = trans['transaction_date']
    
    # Get all affected accounts
    lines = await db.fetch(
        """
        SELECT account_id, currency, 
               SUM(debit_amount) as total_debit,
               SUM(credit_amount) as total_credit
        FROM transaction_lines
        WHERE transaction_id = $1
        GROUP BY account_id, currency
        """,
        transaction_id
    )
    
    for line in lines:
        account_id = line['account_id']
        currency = line['currency']
        
        # Get account type to determine normal balance
        account = await db.fetchrow(
            "SELECT account_type FROM accounts WHERE account_id = $1",
            account_id
        )
        account_type = account['account_type']
        
        # Calculate balance change
        # Assets & Expenses: Debit increases, Credit decreases
        # Liabilities, Equity, Income: Credit increases, Debit decreases
        if account_type in ['Asset', 'Expense']:
            balance_change = float(line['total_debit']) - float(line['total_credit'])
        else:
            balance_change = float(line['total_credit']) - float(line['total_debit'])
        
        # Update or insert balance
        await db.execute(
            """
            INSERT INTO account_balances (account_id, currency, balance, as_of_date)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (account_id, currency, as_of_date)
            DO UPDATE SET balance = account_balances.balance + $3
            """,
            account_id, currency, balance_change, trans_date
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
            ) VALUES ($1, $2, $3, $4, $5, $6)
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
        $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66
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
            condition, purchase_location, pre_inspection_id, internal_notes,
            purchase_date, purchase_price_usd, supplier_id,
            current_location, status, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        )
        RETURNING *
    """
    
    # Execute the inventory creation
    inventory_row = await db.fetchrow(
        inventory_query,
        inspection['vin'],
        additional_data.get('stock_number'),
        inspection['year'],
        inspection['make'],
        inspection['model'],
        inspection['odometer'],
        inspection['passenger_capacity'],
        inspection['wheelchair_capacity'],
        inspection['engine_make'],
        inspection['engine_model'],
        inspection['engine_type'],
        inspection['transmission'],
        inspection['fuel_type'],
        inspection['gvwr'],
        inspection['length_feet'],
        inspection['exterior_color'],
        inspection['interior_color'],
        inspection['title_status'],
        condition,
        inspection['inspection_location'],
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
    
    return dict(inventory_row)

# ==================== FINANCIAL REPORTS ====================

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
    
    # Get exchange rate if needed
    exchange_rate = 1.0
    if currency == "USD":
        # Converting MXN to USD: need MXN→USD rate
        rate = await db.fetchval(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'MXN' AND to_currency = 'USD' ORDER BY created_at DESC LIMIT 1"
        )
        exchange_rate = float(rate) if rate else 0.057  # Default ~1/17.5
    elif currency == "MXN":
        # Converting USD to MXN: need USD→MXN rate
        rate = await db.fetchval(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'MXN' ORDER BY created_at DESC LIMIT 1"
        )
        # If no USD→MXN rate exists, calculate from MXN→USD rate
        if rate:
            exchange_rate = float(rate)
        else:
            mxn_to_usd = await db.fetchval(
                "SELECT rate FROM exchange_rates WHERE from_currency = 'MXN' AND to_currency = 'USD' ORDER BY created_at DESC LIMIT 1"
            )
            if mxn_to_usd:
                exchange_rate = 1 / float(mxn_to_usd)  # Invert the rate
            else:
                exchange_rate = 17.50  # Default USD→MXN rate
    
    # Query account activity for the period
    query = """
        WITH account_activity AS (
            SELECT 
                a.account_id,
                a.account_code,
                a.account_name,
                a.account_type,
                a.account_subtype,
                a.currency,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.debit_amount ELSE 0 END), 0) as debit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.credit_amount ELSE 0 END), 0) as credit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.debit_amount ELSE 0 END), 0) as debit_mxn,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.credit_amount ELSE 0 END), 0) as credit_mxn
            FROM accounts a
            LEFT JOIN transaction_lines tl ON a.account_id = tl.account_id
            LEFT JOIN transactions t ON tl.transaction_id = t.transaction_id
            WHERE t.transaction_date >= $1 AND t.transaction_date <= $2
            GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.account_subtype, a.currency
        )
        SELECT 
            account_code,
            account_name,
            account_type,
            account_subtype,
            currency,
            debit_usd,
            credit_usd,
            debit_mxn,
            credit_mxn,
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
    
    cogs_codes = ['5000', '5100', '5200']
    
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
            
            if row['account_code'] in cogs_codes:
                cogs['USD'] += account_data['amount_usd']
                cogs['MXN'] += account_data['amount_mxn']
                cogs['accounts'].append(account_data)
            else:
                operating_expenses['USD'] += account_data['amount_usd']
                operating_expenses['MXN'] += account_data['amount_mxn']
                operating_expenses['accounts'].append(account_data)
    
    # Calculate totals
    gross_profit_usd = revenue['USD'] - cogs['USD']
    gross_profit_mxn = revenue['MXN'] - cogs['MXN']
    net_income_usd = gross_profit_usd - operating_expenses['USD']
    net_income_mxn = gross_profit_mxn - operating_expenses['MXN']
    
    # Convert if needed
    if currency == "USD":
        # exchange_rate is MXN→USD (e.g., 0.057 means 1 MXN = 0.057 USD)
        # To convert MXN to USD: multiply by the rate
        revenue['USD'] += revenue['MXN'] * float(exchange_rate)
        cogs['USD'] += cogs['MXN'] * float(exchange_rate)
        operating_expenses['USD'] += operating_expenses['MXN'] * float(exchange_rate)
        gross_profit = gross_profit_usd + (gross_profit_mxn * float(exchange_rate))
        net_income = net_income_usd + (net_income_mxn * float(exchange_rate))
        
        for account in revenue['accounts'] + cogs['accounts'] + operating_expenses['accounts']:
            account['amount_usd'] += account['amount_mxn'] * float(exchange_rate)
            account['amount_mxn'] = 0
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'currency': 'USD',
            'exchange_rate': exchange_rate,
            'revenue': {'total': revenue['USD'], 'accounts': revenue['accounts']},
            'cogs': {'total': cogs['USD'], 'accounts': cogs['accounts']},
            'gross_profit': gross_profit,
            'operating_expenses': {'total': operating_expenses['USD'], 'accounts': operating_expenses['accounts']},
            'net_income': net_income
        }
    
    elif currency == "MXN":
        revenue['MXN'] += revenue['USD'] * float(exchange_rate)
        cogs['MXN'] += cogs['USD'] * float(exchange_rate)
        operating_expenses['MXN'] += operating_expenses['USD'] * float(exchange_rate)
        gross_profit = gross_profit_mxn + (gross_profit_usd * float(exchange_rate))
        net_income = net_income_mxn + (net_income_usd * float(exchange_rate))
        
        for account in revenue['accounts'] + cogs['accounts'] + operating_expenses['accounts']:
            # Only convert if there's actually USD amount (not zero)
            if account['amount_usd'] != 0:
                account['amount_mxn'] += account['amount_usd'] * float(exchange_rate)
                account['amount_usd'] = 0
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'currency': 'MXN',
            'exchange_rate': exchange_rate,
            'revenue': {'total': revenue['MXN'], 'accounts': revenue['accounts']},
            'cogs': {'total': cogs['MXN'], 'accounts': cogs['accounts']},
            'gross_profit': gross_profit,
            'operating_expenses': {'total': operating_expenses['MXN'], 'accounts': operating_expenses['accounts']},
            'net_income': net_income
        }
    
    else:
        return {
            'start_date': start_date,
            'end_date': end_date,
            'currency': 'BOTH',
            'exchange_rate': exchange_rate,
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
    
    # Convert date string to date object
    report_date = datetime.strptime(as_of_date, '%Y-%m-%d').date()
    
    # Get exchange rate if needed
    exchange_rate = 1.0
    if currency == "USD":
        rate = await db.fetchval(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'MXN' AND to_currency = 'USD' ORDER BY created_at DESC LIMIT 1"
        )
        exchange_rate = float(rate) if rate else 0.057
    elif currency == "MXN":
        rate = await db.fetchval(
            "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'MXN' ORDER BY created_at DESC LIMIT 1"
        )
        if rate:
            exchange_rate = float(rate)
        else:
            mxn_to_usd = await db.fetchval(
                "SELECT rate FROM exchange_rates WHERE from_currency = 'MXN' AND to_currency = 'USD' ORDER BY created_at DESC LIMIT 1"
            )
            if mxn_to_usd:
                exchange_rate = 1 / float(mxn_to_usd)
            else:
                exchange_rate = 17.50
    
    # Query account balances as of the date
    # Balance = sum of all transaction lines up to and including the date
    query = """
        WITH account_balances AS (
            SELECT 
                a.account_id,
                a.account_code,
                a.account_name,
                a.account_type,
                a.account_subtype,
                a.currency,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.debit_amount ELSE 0 END), 0) as debit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.credit_amount ELSE 0 END), 0) as credit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.debit_amount ELSE 0 END), 0) as debit_mxn,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.credit_amount ELSE 0 END), 0) as credit_mxn
            FROM accounts a
            LEFT JOIN transaction_lines tl ON a.account_id = tl.account_id
            LEFT JOIN transactions t ON tl.transaction_id = t.transaction_id
            WHERE t.transaction_date IS NULL OR t.transaction_date <= $1
            GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.account_subtype, a.currency
        )
        SELECT 
            account_code,
            account_name,
            account_type,
            account_subtype,
            currency,
            debit_usd,
            credit_usd,
            debit_mxn,
            credit_mxn,
            -- Asset accounts: debit increases, credit decreases
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
            # Current Assets: Bank, Cash, AR, Inventory
            if row['account_subtype'] in ['Bank', 'Cash', 'AR', 'Inventory']:
                assets['current'].append(account_data)
            else:
                assets['non_current'].append(account_data)
                
        elif row['account_type'] == 'Liability':
            liabilities['USD'] += account_data['balance_usd']
            liabilities['MXN'] += account_data['balance_mxn']
            # Current Liabilities: AP, Credit Line
            if row['account_subtype'] in ['AP', 'Credit Line']:
                liabilities['current'].append(account_data)
            else:
                liabilities['non_current'].append(account_data)
                
        elif row['account_type'] == 'Equity':
            equity['USD'] += account_data['balance_usd']
            equity['MXN'] += account_data['balance_mxn']
            equity['accounts'].append(account_data)
    
    # Convert if needed
    if currency == "USD":
        # Converting MXN to USD: multiply by MXN→USD rate (e.g., MXN * 0.057)
        assets['USD'] += assets['MXN'] * float(exchange_rate)
        liabilities['USD'] += liabilities['MXN'] * float(exchange_rate)
        equity['USD'] += equity['MXN'] * float(exchange_rate)
        
        for account in assets['current'] + assets['non_current'] + liabilities['current'] + liabilities['non_current'] + equity['accounts']:
            account['balance_usd'] += account['balance_mxn'] * float(exchange_rate)
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

@app.post("/api/accounting/close-period")
async def close_accounting_period(
    period_data: dict,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Close an accounting period by transferring Net Income to Retained Earnings
    
    Steps:
    1. Calculate Net Income for the period (Revenue - Expenses)
    2. Create closing entries to zero out all Revenue and Expense accounts
    3. Transfer Net Income to Retained Earnings
    """
    
    from datetime import datetime
    
    start_date = period_data.get('start_date')
    end_date = period_data.get('end_date')
    period_name = period_data.get('period_name', f"{start_date} to {end_date}")
    
    # Convert dates
    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    # Get exchange rate for conversions
    exchange_rate_mxn_usd = await db.fetchval(
        "SELECT rate FROM exchange_rates WHERE from_currency = 'MXN' AND to_currency = 'USD' ORDER BY created_at DESC LIMIT 1"
    ) or 0.057
    
    # Query to get all revenue and expense account balances for the period
    query = """
        WITH period_activity AS (
            SELECT 
                a.account_id,
                a.account_code,
                a.account_name,
                a.account_type,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.debit_amount ELSE 0 END), 0) as debit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'USD' THEN tl.credit_amount ELSE 0 END), 0) as credit_usd,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.debit_amount ELSE 0 END), 0) as debit_mxn,
                COALESCE(SUM(CASE WHEN tl.currency = 'MXN' THEN tl.credit_amount ELSE 0 END), 0) as credit_mxn
            FROM accounts a
            LEFT JOIN transaction_lines tl ON a.account_id = tl.account_id
            LEFT JOIN transactions t ON tl.transaction_id = t.transaction_id
            WHERE t.transaction_date >= $1 AND t.transaction_date <= $2
            GROUP BY a.account_id, a.account_code, a.account_name, a.account_type
        )
        SELECT 
            account_id,
            account_code,
            account_name,
            account_type,
            debit_usd,
            credit_usd,
            debit_mxn,
            credit_mxn,
            -- Income: credits - debits (revenue increases with credits)
            -- Expense: debits - credits (expenses increase with debits)
            CASE 
                WHEN account_type = 'Income' THEN (credit_usd - debit_usd)
                WHEN account_type = 'Expense' THEN (debit_usd - credit_usd)
                ELSE 0
            END as net_usd,
            CASE 
                WHEN account_type = 'Income' THEN (credit_mxn - debit_mxn)
                WHEN account_type = 'Expense' THEN (debit_mxn - credit_mxn)
                ELSE 0
            END as net_mxn
        FROM period_activity
        WHERE account_type IN ('Income', 'Expense')
          AND (debit_usd > 0 OR credit_usd > 0 OR debit_mxn > 0 OR credit_mxn > 0)
        ORDER BY account_type, account_code
    """
    
    rows = await db.fetch(query, start, end)
    
    # Calculate Net Income
    total_revenue_usd = 0
    total_revenue_mxn = 0
    total_expenses_usd = 0
    total_expenses_mxn = 0
    
    accounts_to_close = []
    
    for row in rows:
        account_info = {
            'account_id': row['account_id'],
            'account_name': row['account_name'],
            'account_type': row['account_type'],
            'net_usd': float(row['net_usd']),
            'net_mxn': float(row['net_mxn'])
        }
        accounts_to_close.append(account_info)
        
        if row['account_type'] == 'Income':
            total_revenue_usd += account_info['net_usd']
            total_revenue_mxn += account_info['net_mxn']
        elif row['account_type'] == 'Expense':
            total_expenses_usd += account_info['net_usd']
            total_expenses_mxn += account_info['net_mxn']
    
    net_income_usd = total_revenue_usd - total_expenses_usd
    net_income_mxn = total_revenue_mxn - total_expenses_mxn
    
    # Get Retained Earnings account
    retained_earnings = await db.fetchrow(
        "SELECT account_id FROM accounts WHERE account_name = 'Retained Earnings'"
    )
    
    if not retained_earnings:
        raise HTTPException(status_code=404, detail="Retained Earnings account not found")
    
    # Generate reference number
    period_code = end.strftime('%Y%m')  # e.g., 202603 for March 2026
    reference_number = f"CLOSE-{period_code}"
    
    # Check if period already closed
    existing_close = await db.fetchval(
        "SELECT transaction_id FROM transactions WHERE reference_number = $1",
        reference_number
    )
    
    if existing_close:
        raise HTTPException(status_code=400, detail=f"Period {period_name} has already been closed")
    
    # Create closing transaction
    transaction_id = await db.fetchval(
        """
        INSERT INTO transactions (transaction_date, description, reference_type, reference_number, currency, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING transaction_id
        """,
        end,  # Use last day of period as transaction date
        f"Closing Entry - {period_name}",
        "closing",
        reference_number,
        "USD",  # Default currency
        user['username']
    )
    
    # Create closing entries for each revenue and expense account
    
    # Close Revenue accounts (debit revenue, credit retained earnings)
    for account in accounts_to_close:
        if account['account_type'] == 'Income':
            # Close USD revenue
            if account['net_usd'] != 0:
                await db.execute(
                    """
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    transaction_id,
                    account['account_id'],
                    abs(account['net_usd']),  # Debit revenue to zero it out
                    0,
                    'USD',
                    f"Close {account['account_name']} to Retained Earnings"
                )
            
            # Close MXN revenue
            if account['net_mxn'] != 0:
                await db.execute(
                    """
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    transaction_id,
                    account['account_id'],
                    abs(account['net_mxn']),  # Debit revenue to zero it out
                    0,
                    'MXN',
                    f"Close {account['account_name']} to Retained Earnings"
                )
    
    # Close Expense accounts (credit expense, debit retained earnings)
    for account in accounts_to_close:
        if account['account_type'] == 'Expense':
            # Close USD expenses
            if account['net_usd'] != 0:
                await db.execute(
                    """
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    transaction_id,
                    account['account_id'],
                    0,
                    abs(account['net_usd']),  # Credit expense to zero it out
                    'USD',
                    f"Close {account['account_name']} to Retained Earnings"
                )
            
            # Close MXN expenses
            if account['net_mxn'] != 0:
                await db.execute(
                    """
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    transaction_id,
                    account['account_id'],
                    0,
                    abs(account['net_mxn']),  # Credit expense to zero it out
                    'MXN',
                    f"Close {account['account_name']} to Retained Earnings"
                )
    
    # Transfer Net Income to Retained Earnings
    # If Net Income is positive (profit): Credit Retained Earnings
    # If Net Income is negative (loss): Debit Retained Earnings
    
    if net_income_usd != 0:
        if net_income_usd > 0:
            # Profit: Credit Retained Earnings
            await db.execute(
                """
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id,
                retained_earnings['account_id'],
                0,
                abs(net_income_usd),
                'USD',
                f"Net Income for {period_name}"
            )
        else:
            # Loss: Debit Retained Earnings
            await db.execute(
                """
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id,
                retained_earnings['account_id'],
                abs(net_income_usd),
                0,
                'USD',
                f"Net Loss for {period_name}"
            )
    
    if net_income_mxn != 0:
        if net_income_mxn > 0:
            # Profit: Credit Retained Earnings
            await db.execute(
                """
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id,
                retained_earnings['account_id'],
                0,
                abs(net_income_mxn),
                'MXN',
                f"Net Income for {period_name}"
            )
        else:
            # Loss: Debit Retained Earnings
            await db.execute(
                """
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                transaction_id,
                retained_earnings['account_id'],
                abs(net_income_mxn),
                0,
                'MXN',
                f"Net Loss for {period_name}"
            )
    
    return {
        'success': True,
        'transaction_id': transaction_id,
        'reference_number': reference_number,
        'period_name': period_name,
        'net_income_usd': net_income_usd,
        'net_income_mxn': net_income_mxn,
        'accounts_closed': len(accounts_to_close),
        'message': f"Successfully closed period {period_name}. Net Income: ${net_income_usd:,.2f} USD / MXN ${net_income_mxn:,.2f}"
    }
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
