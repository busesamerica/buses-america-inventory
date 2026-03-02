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
    client_name: Optional[str] = None
    client_company: Optional[str] = None
    client_location: Optional[str] = None
    client_contact: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    sale_price: Optional[Decimal] = None
    sale_currency: Optional[str] = None
    deposit_amount: Optional[Decimal] = None
    deposit_currency: Optional[str] = None
    deposit_date: Optional[date] = None
    payment_status: Optional[str] = None
    
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
    client_location: Optional[str]
    sale_price: Optional[Decimal]
    sale_currency: Optional[str]
    deposit_amount: Optional[Decimal]
    payment_status: Optional[str]
    
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

@app.get("/api/exchange-rates/current", response_model=ExchangeRate)
async def get_current_exchange_rate(db=Depends(get_db)):
    """Get current active USD/MXN exchange rate"""
    query = "SELECT * FROM current_exchange_rate"
    row = await db.fetchrow(query)
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
            condition, acquisition_location, pre_inspection_id, internal_notes,
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
        additional_data.get('purchase_date'),
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
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)    rate_id: int
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
    client_name: Optional[str] = None
    client_company: Optional[str] = None
    client_location: Optional[str] = None
    client_contact: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    sale_price: Optional[Decimal] = None
    sale_currency: Optional[str] = None
    deposit_amount: Optional[Decimal] = None
    deposit_currency: Optional[str] = None
    deposit_date: Optional[date] = None
    payment_status: Optional[str] = None
    
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
    client_location: Optional[str]
    sale_price: Optional[Decimal]
    sale_currency: Optional[str]
    deposit_amount: Optional[Decimal]
    payment_status: Optional[str]
    
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

@app.get("/api/exchange-rates/current", response_model=ExchangeRate)
async def get_current_exchange_rate(db=Depends(get_db)):
    """Get current active USD/MXN exchange rate"""
    query = "SELECT * FROM current_exchange_rate"
    row = await db.fetchrow(query)
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
            condition, reconditioning_cost_usd,
            acquisition_location, pre_inspection_id, internal_notes,
            purchase_date, purchase_price_usd, supplier_id,
            current_location, status, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
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
        inspection['estimated_repair_cost_usd'],
        inspection['inspection_location'],
        inspection_id,
        summary,
        additional_data.get('purchase_date'),
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
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
