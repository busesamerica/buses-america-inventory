"""
Buses America - Complete Inventory Management API
Final version matching actual business operation
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from inspection_summary_helper import generate_inspection_summary, calculate_pre_fill_data
from vin_decoder import decode_vin
import asyncpg
import httpx
import os
import secrets
import hashlib
import json
import uuid
import time
from contextlib import asynccontextmanager

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/buses_america")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

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
    payment_account_id: int  # Required — which bank/cash account receives the payment

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
    gvwr: Optional[int] = None
    length_feet: Optional[Decimal] = None
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
    fuel_type: Optional[str] = None
    gvwr: Optional[int] = None
    length_feet: Optional[Decimal] = None

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

# A unit can't legitimately reach any of these statuses (see the documented
# inventory.status pipeline in bus_inventory_schema_FINAL.sql, plus the
# generic 'Sold' milestone for a unit that's sold but hasn't started - or
# won't go through - the import pipeline) without having been sold.
# update_inventory() below uses this to keep is_sold in sync no matter how
# status gets set, instead of relying on every caller (or every frontend
# form) to also set is_sold correctly on its own - see
# migrations/004_fix_inventory_location_status.sql for the bug that caused
# when nothing enforced it.
#
# Deliberately narrower than the full documented pipeline: 'Import/Customs
# Processing' and 'In Stock (Mexico)' are left out because Mexico Stock is
# also a valid *pre-sale* current_location - a unit can be relocated there
# before it's sold, not only imported there after, so those two statuses
# don't unambiguously imply a sale the way the others do.
POST_SALE_STATUSES = {
    'Sold', 'Sold - Pending Import', 'In Preventive Maintenance',
    'Ready for Delivery', 'In Transit to Client', 'Delivered',
}

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
    wheelchair_capacity: Optional[int] = None
    engine_make: Optional[str] = None
    engine_model: Optional[str] = None
    engine_type: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    gvwr: Optional[int] = None
    length_feet: Optional[Decimal] = None
    odometer: Optional[int]
    condition: str
    exterior_color: Optional[str]
    interior_color: Optional[str] = None
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
    client_name: Optional[str] = None
    client_company: Optional[str] = None
    client_location: Optional[str] = None
    client_contact: Optional[str] = None
    client_email: Optional[str] = None
    client_use_case: Optional[str] = None
    sale_price: Optional[Decimal]
    sale_currency: Optional[str]
    sale_exchange_rate: Optional[Decimal] = None
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
    
    has_purchase_payment: Optional[bool] = False
    
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

# Restrict cross-origin requests to known frontend origin(s). "*" combined with
# allow_credentials=True lets any website make authenticated requests using a
# visitor's bearer token, so the origin list must be explicit in production.
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
if not ALLOWED_ORIGINS:
    # Fail safe to localhost-only when ALLOWED_ORIGINS isn't configured, instead
    # of silently trusting every origin on the internet.
    ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_db():
    async with db_pool.acquire() as connection:
        yield connection

# ==================== AUTHENTICATION HELPERS ====================

PBKDF2_ITERATIONS = 600_000  # OWASP-recommended floor for PBKDF2-HMAC-SHA256
LEGACY_PBKDF2_ITERATIONS = 100_000  # iteration count used by hashes created before this change

def hash_password(password: str) -> str:
    """Hash password using PBKDF2. Format: pbkdf2_sha256$<iterations>$<salt>$<hex hash>."""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${pwd_hash.hex()}"

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash.

    Supports the current versioned format (which records its own iteration
    count so it can be strengthened later without invalidating every
    existing user's password) and the legacy two-field format from before
    this change, so existing accounts keep working.
    """
    try:
        parts = password_hash.split('$')
        if len(parts) == 4 and parts[0] == 'pbkdf2_sha256':
            _, iterations_str, salt, pwd_hash = parts
            iterations = int(iterations_str)
        elif len(parts) == 2:
            salt, pwd_hash = parts
            iterations = LEGACY_PBKDF2_ITERATIONS
        else:
            return False
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), iterations)
        return secrets.compare_digest(new_hash.hex(), pwd_hash)
    except Exception:
        return False

def generate_session_token() -> str:
    """Generate secure session token"""
    return secrets.token_urlsafe(32)

# In-memory login throttling, keyed by username+IP. Not shared across
# multiple server processes/instances, but on the single-instance deployment
# this app runs on it stops straightforward credential-stuffing / brute-force
# attempts against /api/auth/login with no extra infrastructure required.
_LOGIN_FAILURES: dict = {}
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_SECONDS = 15 * 60

def _login_throttle_key(username: str, request: Request) -> str:
    client_ip = request.client.host if request and request.client else "unknown"
    return f"{(username or '').lower()}:{client_ip}"

def _check_login_throttle(key: str):
    now = time.time()
    attempts = [t for t in _LOGIN_FAILURES.get(key, []) if now - t < LOGIN_LOCKOUT_SECONDS]
    _LOGIN_FAILURES[key] = attempts
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again in 15 minutes."
        )

def _record_login_failure(key: str):
    _LOGIN_FAILURES.setdefault(key, []).append(time.time())

def _clear_login_failures(key: str):
    _LOGIN_FAILURES.pop(key, None)

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

async def get_exchange_rate(db, from_curr: str, to_curr: str, as_of_date=None) -> float:
    """
    Get exchange rate from database, handling both directions.
    If as_of_date is provided, returns the rate effective on that date
    (most recent effective_date <= as_of_date).
    If no date, returns the latest rate.
    """
    if as_of_date:
        # Date-based lookup: find the rate effective on or before the given date
        rate = await db.fetchval(
            """SELECT rate FROM exchange_rates 
               WHERE from_currency = $1 AND to_currency = $2 
               AND is_active = true AND effective_date <= $3
               ORDER BY effective_date DESC LIMIT 1""",
            from_curr, to_curr, as_of_date
        )
        if rate:
            return float(rate)
        
        # Try inverse
        inverse_rate = await db.fetchval(
            """SELECT rate FROM exchange_rates 
               WHERE from_currency = $1 AND to_currency = $2 
               AND is_active = true AND effective_date <= $3
               ORDER BY effective_date DESC LIMIT 1""",
            to_curr, from_curr, as_of_date
        )
        if inverse_rate:
            return 1.0 / float(inverse_rate)
        
        # Fall back to any rate on or before that date
        any_rate = await db.fetchrow(
            """SELECT from_currency, to_currency, rate FROM exchange_rates 
               WHERE is_active = true AND effective_date <= $1
               ORDER BY effective_date DESC LIMIT 1""",
            as_of_date
        )
        if any_rate:
            if any_rate['from_currency'] == from_curr and any_rate['to_currency'] == to_curr:
                return float(any_rate['rate'])
            elif any_rate['from_currency'] == to_curr and any_rate['to_currency'] == from_curr:
                return 1.0 / float(any_rate['rate'])
        
        # No rate found for this date — fall through to latest rate
    
    # Latest rate lookup (no date or date lookup failed)
    rate = await db.fetchval(
        "SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2 AND is_active = true ORDER BY effective_date DESC LIMIT 1",
        from_curr, to_curr
    )
    if rate:
        return float(rate)
    
    # Try inverse
    inverse_rate = await db.fetchval(
        "SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2 AND is_active = true ORDER BY effective_date DESC LIMIT 1",
        to_curr, from_curr
    )
    if inverse_rate:
        return 1.0 / float(inverse_rate)
    
    # Fallback to any active rate
    any_rate = await db.fetchrow(
        "SELECT from_currency, to_currency, rate FROM exchange_rates WHERE is_active = true ORDER BY effective_date DESC LIMIT 1"
    )
    if any_rate:
        if any_rate['from_currency'] == from_curr and any_rate['to_currency'] == to_curr:
            return float(any_rate['rate'])
        elif any_rate['from_currency'] == to_curr and any_rate['to_currency'] == from_curr:
            return 1.0 / float(any_rate['rate'])
    
    raise HTTPException(
        status_code=400,
        detail=f"No exchange rate found for {from_curr}/{to_curr}. Please set an exchange rate in the Accounting module."
    )

# ==================== CENTRALIZED COST CALCULATION ====================

async def calculate_total_costs(db, inventory_id: int, target_currency: str = 'USD', as_of_date=None) -> dict:
    """
    SINGLE SOURCE OF TRUTH for cost calculations
    
    Calculates total costs for a vehicle in the specified currency.
    If as_of_date is provided, uses the exchange rate effective on that date.
    For sold buses, pass the sale_date to use the rate at time of sale.
    """
    # Get inventory purchase info
    inventory = await db.fetchrow(
        "SELECT purchase_price_usd, sale_exchange_rate, sale_date, is_sold FROM inventory WHERE inventory_id = $1",
        inventory_id
    )
    
    if not inventory:
        return None
    
    # Get all cost items
    costs = await db.fetch(
        "SELECT cost_id, cost_category, description, amount, currency, vendor, date_incurred FROM cost_items WHERE inventory_id = $1",
        inventory_id
    )
    
    # Get exchange rate: use sale_exchange_rate for sold buses, date-based otherwise
    if inventory['is_sold'] and inventory['sale_exchange_rate']:
        # Use the locked rate from time of sale
        sale_rate = float(inventory['sale_exchange_rate'])
        exchange_rate = 1.0 / sale_rate  # MXN→USD
    elif as_of_date:
        exchange_rate = await get_exchange_rate(db, 'MXN', 'USD', as_of_date)
    else:
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

# HEAD as well as GET: Render's health check probes the root with HEAD, which
# would otherwise answer 405 on every deploy and every keep-alive ping.
@app.api_route("/", methods=["GET", "HEAD"])
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
async def initialize_database(user=Depends(require_admin)):
    """Initialize database with schema - ONE TIME USE ONLY - ADMIN ONLY"""
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
async def login(credentials: UserLogin, request: Request, db=Depends(get_db)):
    """User login - returns session token"""
    throttle_key = _login_throttle_key(credentials.username, request)
    _check_login_throttle(throttle_key)

    user = await db.fetchrow("""
        SELECT * FROM users
        WHERE username = $1 AND is_active = TRUE
    """, credentials.username)

    if not user or not verify_password(credentials.password, user['password_hash']):
        _record_login_failure(throttle_key)
        await log_audit(db, None, credentials.username, 'login_failed',
                       description=f"Failed login attempt for {credentials.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _clear_login_failures(throttle_key)
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
    # Only invalidate the session used for this request, not every session
    # the user has open on other devices/browsers.
    await db.execute("""
        DELETE FROM user_sessions
        WHERE session_token = $1
    """, current_user['session_token'])
    
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
    if len(user_data.password) < 10:
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters long")

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
    # from_currency/to_currency filter is load-bearing, not decorative: every
    # consumer of this endpoint (CostManagementModal's grand total,
    # App_COMPLETE.jsx's displayed rate) assumes the result is USD->MXN
    # (~17) and multiplies by it directly. Without this filter, an MXN->USD
    # row (~0.057) with a later effective_date would silently win and wreck
    # every MXN total downstream. Today's only writer (AccountingDashboard.jsx)
    # always inserts USD->MXN, so this has stayed dormant - but nothing
    # stops a future caller of POST /api/exchange-rates from adding the
    # other direction, so this is the one place to hold that invariant.
    row = await db.fetchrow("""
        SELECT rate_id, from_currency, to_currency, rate, effective_date, created_at, is_active
        FROM exchange_rates
        WHERE is_active = TRUE AND from_currency = 'USD' AND to_currency = 'MXN'
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
async def create_supplier(supplier: SupplierCreate, db=Depends(get_db), user=Depends(get_current_user)):
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
async def get_suppliers(is_active: Optional[bool] = True, db=Depends(get_db), user=Depends(get_current_user)):
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
async def create_pre_purchase_inspection(inspection: PrePurchaseInspectionCreate, db=Depends(get_db), user=Depends(get_current_user)):
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
    db=Depends(get_db),
    user=Depends(get_current_user)
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
    db=Depends(get_db),
    user=Depends(get_current_user)
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

# ==================== VIN DECODE ====================
# Auto-populates year/make/model/engine/etc. from a VIN when a unit is being
# registered - used by both the Pre-Purchase Inspection form and the Add New
# Bus form (create_inventory below). get_current_user only (not
# require_manager_or_admin) because inspectors need this as much as
# managers/admins do, and it's read-only - it never writes anything.

@app.get("/api/vin-decode/{vin}")
async def vin_decode(vin: str, current_user: dict = Depends(get_current_user)):
    """Decode a VIN via NHTSA's free vPIC API for auto-fill on registration forms."""
    try:
        return await decode_vin(vin)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (httpx.TimeoutException, httpx.HTTPError):
        raise HTTPException(
            status_code=502,
            detail="VIN decode service unavailable right now - please enter details manually"
        )

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
            engine_type, transmission, fuel_type, gvwr, length_feet, odometer, condition,
            exterior_color, interior_color, title_status, supplier_id,
            purchase_date, purchase_price_usd, purchase_location, purchase_invoice_number,
            transport_to_stock_cost_usd, initial_reconditioning_cost_usd, other_acquisition_costs_usd,
            asking_price, asking_currency, minimum_price, minimum_currency,
            status, current_location, us_stock_location, pre_inspection_id,
            features, description, internal_notes, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
            $32, $33, $34, $35, $36, $37, $38, $39, $40, $41
        ) RETURNING *
    """
    try:
        row = await db.fetchrow(
            query, inventory.stock_number, inventory.vin, inventory.year, inventory.make,
            inventory.model, inventory.body_style, inventory.bus_type, inventory.passenger_capacity,
            inventory.wheelchair_capacity, inventory.engine_make, inventory.engine_model,
            inventory.engine_type, inventory.transmission, inventory.fuel_type,
            inventory.gvwr, inventory.length_feet, inventory.odometer,
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
    payment_account_id: Optional[int] = None
    payment_date: Optional[date] = None
    payment_status: str = 'paid'
    payable_to: Optional[str] = None

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
    
    payment_dt = payment_data.payment_date or bus.get('purchase_date') or date.today()
    
    # Find inventory asset account
    inventory_account = await db.fetchval(
        "SELECT account_id FROM accounts WHERE account_subtype = 'Inventory' AND is_active = TRUE LIMIT 1"
    )
    if not inventory_account:
        raise HTTPException(status_code=400, detail="No Inventory account found in chart of accounts")
    
    bus_label = f"{bus['stock_number']} — {bus['year']} {bus['make']} {bus['model']}"
    
    if payment_data.payment_status == 'on_credit':
        # On credit: Debit Inventory, Credit AP
        ap_account_id = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_subtype = 'AP' AND currency = 'USD' AND is_active = TRUE LIMIT 1"
        )
        if not ap_account_id:
            raise HTTPException(status_code=400, detail="No AP account found for USD")
        
        # Get creditor name for AP tracking
        # Use payable_to if provided, otherwise fall back to supplier name
        if payment_data.payable_to and payment_data.payable_to.strip():
            creditor_name = payment_data.payable_to.strip()
        else:
            creditor_name = 'Unknown'
            if bus['supplier_id']:
                supplier = await db.fetchrow(
                    "SELECT company_name FROM suppliers WHERE supplier_id = $1", bus['supplier_id']
                )
                if supplier:
                    creditor_name = supplier['company_name']
        
        trans_row = await db.fetchrow("""
            INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
            VALUES ($1, $2, 'purchase', $3, 'USD', $4)
            RETURNING transaction_id
        """, payment_dt,
            f"Purchase on credit for {bus_label}",
            inventory_id, user['username'])
        
        trans_id = trans_row['transaction_id']
        
        # Debit Inventory
        await db.execute("""
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
            VALUES ($1, $2, $3, 0, 'USD', $4)
        """, trans_id, inventory_account, purchase_price,
            f"Inventory asset — {bus['stock_number']}")
        
        # Credit AP
        await db.execute("""
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
            VALUES ($1, $2, 0, $3, 'USD', $4)
        """, trans_id, ap_account_id, purchase_price,
            f"AP — {creditor_name} — Purchase — {bus_label}")
        
        await update_account_balances(db, trans_id)
        
        await log_audit(
            db, user['user_id'], user['username'],
            'create', 'transactions', trans_id,
            new_values={
                'transaction_id': trans_id,
                'inventory_id': inventory_id,
                'stock_number': bus['stock_number'],
                'amount': str(purchase_price),
                'payment_status': 'on_credit',
                'vendor': creditor_name
            },
            description=f"Purchase on credit recorded: {bus['stock_number']} — ${purchase_price} (AP — {creditor_name})"
        )
        
        return {
            "message": f"Purchase of ${purchase_price} for {bus['stock_number']} recorded as Accounts Payable ({creditor_name})",
            "transaction_id": trans_id
        }
    
    else:
        # Paid: Debit Inventory, Credit Bank (original behavior)
        if not payment_data.payment_account_id:
            raise HTTPException(status_code=400, detail="Payment account required when paying immediately")
        
        bank_account = await db.fetchrow(
            "SELECT account_id, account_name, currency FROM accounts WHERE account_id = $1 AND is_active = TRUE",
            payment_data.payment_account_id
        )
        if not bank_account:
            raise HTTPException(status_code=404, detail="Bank account not found")
        # purchase_price is always purchase_price_usd - recorded below at face
        # value with no currency conversion, so an MXN account would silently
        # misrecord it as that many pesos instead of its USD amount converted.
        if (bank_account['currency'] or 'USD') != 'USD':
            raise HTTPException(
                status_code=400,
                detail=f"{bank_account['account_name']} is a {bank_account['currency']} account, "
                       f"but the purchase price is in USD. Select a USD account."
            )

        line_currency = bank_account['currency'] or 'USD'
        
        trans_row = await db.fetchrow("""
            INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
            VALUES ($1, $2, 'purchase', $3, $4, $5)
            RETURNING transaction_id
        """, payment_dt,
            f"Purchase payment for {bus_label}",
            inventory_id, 'USD', user['username'])
        
        trans_id = trans_row['transaction_id']
        
        # Debit Inventory
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
            description=f"Purchase payment recorded: {bus['stock_number']} — ${purchase_price} from {bank_account['account_name']}"
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
    db=Depends(get_db),
    user=Depends(get_current_user)
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
               c.client_contact, c.client_email, c.client_use_case,
               EXISTS(
                   SELECT 1 FROM transactions t 
                   WHERE t.reference_type = 'purchase' AND t.reference_id = i.inventory_id
               ) as has_purchase_payment
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
async def get_inventory_item(inventory_id: int, db=Depends(get_db), user=Depends(get_current_user)):
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

    # Force is_sold in step with status, rather than trusting every caller to
    # send both correctly - see POST_SALE_STATUSES above.
    if update_dict.get('status') in POST_SALE_STATUSES:
        update_dict['is_sold'] = True

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
    
    # Get bus info for descriptions
    bus_info = await db.fetchrow(
        "SELECT stock_number, year, make, model FROM inventory WHERE inventory_id = $1",
        inventory_id
    )
    bus_label = f"{bus_info['stock_number']} — {bus_info['year']} {bus_info['make']} {bus_info['model']}" if bus_info else f"Inventory #{inventory_id}"
    
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
        payment_account_id = cost_data.get('payment_account_id')
        payment_status = cost_data.get('payment_status', 'paid')
        
        # All costs tied to a specific bus are capitalized to Bus Inventory (GAAP).
        INVENTORY_ACCOUNT_CODE = '1200'
        expense_account_id = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_code = $1",
            INVENTORY_ACCOUNT_CODE
        )
        
        # Generate reference number
        reference_number = await generate_transaction_reference(
            db,
            'expense',
            date_incurred
        )
        
        # Create accounting transaction
        trans_description = f"Cost - {cost_category} - {cost_data.get('description', 'Inventory cost')} ({bus_label})"
        
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
        
        # Debit: Bus Inventory (capitalize cost) — same for both paid and on_credit
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
            f"{cost_category} - {cost_data.get('vendor', 'N/A')} — {bus_label}"
        )
        
        if payment_status == 'on_credit':
            # Credit: Accounts Payable
            ap_account_id = await db.fetchval(
                "SELECT account_id FROM accounts WHERE account_subtype = 'AP' AND currency = $1 AND is_active = TRUE LIMIT 1",
                currency
            )
            if not ap_account_id:
                ap_account_id = await db.fetchval(
                    "SELECT account_id FROM accounts WHERE account_subtype = 'AP' AND is_active = TRUE LIMIT 1"
                )
            if not ap_account_id:
                raise HTTPException(status_code=400, detail="No Accounts Payable account found in chart of accounts.")
            
            vendor_name = cost_data.get('vendor', 'Unknown vendor')
            await db.execute(
                """
                INSERT INTO transaction_lines (
                    transaction_id, account_id, debit_amount, credit_amount, currency, notes
                ) VALUES ($1, $2, $3, $4, $5, $6)
                """,
                trans_id,
                ap_account_id,
                0,
                amount,
                currency,
                f"AP — {vendor_name} — {cost_category} — {bus_label}"
            )
        else:
            # Credit: Bank/Cash account
            if payment_account_id and str(payment_account_id).strip():
                payment_account_id = int(payment_account_id)
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Payment account is required when paying immediately."
                )

            # Recorded below against this account at face value in the cost's
            # own currency, with no conversion - a mismatched account would
            # misrecord the payment as that many USD/MXN instead of converting.
            paid_account = await db.fetchrow(
                "SELECT account_name, currency FROM accounts WHERE account_id = $1 AND is_active = TRUE",
                payment_account_id
            )
            if not paid_account:
                raise HTTPException(status_code=404, detail="Payment account not found")
            if (paid_account['currency'] or 'USD') != currency:
                raise HTTPException(
                    status_code=400,
                    detail=f"{paid_account['account_name']} is a {paid_account['currency']} account, "
                           f"but this cost is in {currency}. Select a {currency} account."
                )

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
                f"Payment for {cost_category} — {bus_label}"
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
    """Delete a cost item and reverse its accounting entry"""
    cost = await db.fetchrow(
        "SELECT * FROM cost_items WHERE cost_id = $1 AND inventory_id = $2",
        cost_id, inventory_id
    )
    if not cost:
        raise HTTPException(status_code=404, detail="Cost item not found")
    
    # Reverse accounting entry
    trans = await db.fetchrow(
        "SELECT transaction_id FROM transactions WHERE reference_type = 'cost' AND reference_id = $1",
        cost_id
    )
    if trans:
        await db.execute("DELETE FROM transaction_lines WHERE transaction_id = $1", trans['transaction_id'])
        await db.execute("DELETE FROM transactions WHERE transaction_id = $1", trans['transaction_id'])
    
    await db.execute("DELETE FROM cost_items WHERE cost_id = $1", cost_id)
    
    # Rebuild balances for affected accounts
    if trans:
        # Full rebuild since we deleted lines
        await db.execute("DELETE FROM account_balances")
        await db.execute("""
            INSERT INTO account_balances (account_id, currency, balance, as_of_date)
            SELECT tl.account_id, tl.currency,
                SUM(CASE WHEN a.account_type IN ('Asset', 'Expense') THEN tl.debit_amount - tl.credit_amount
                    ELSE tl.credit_amount - tl.debit_amount END),
                CURRENT_DATE
            FROM transaction_lines tl
            JOIN accounts a ON tl.account_id = a.account_id
            WHERE tl.currency IS NOT NULL
            GROUP BY tl.account_id, tl.currency
        """)
    
    await log_audit(
        db, user['user_id'], user['username'],
        'delete', 'cost_items', cost_id,
        old_values=dict(cost),
        description=f"Deleted cost: {cost['description']}"
    )
    
    return {"message": "Cost deleted and accounting entry reversed"}

@app.patch("/api/inventory/{inventory_id}/costs/{cost_id}")
async def update_inventory_cost(
    inventory_id: int,
    cost_id: int,
    request: Request,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Update a cost item — deletes old accounting entry and creates new one"""
    cost = await db.fetchrow(
        "SELECT * FROM cost_items WHERE cost_id = $1 AND inventory_id = $2",
        cost_id, inventory_id
    )
    if not cost:
        raise HTTPException(status_code=404, detail="Cost item not found")
    
    updates = await request.json()
    
    # Update cost_items row
    set_clauses = []
    values = [cost_id]
    param_count = 2
    allowed_fields = ['cost_category', 'description', 'amount', 'currency', 'vendor', 'invoice_number', 'date_incurred']
    
    for field in allowed_fields:
        if field in updates:
            set_clauses.append(f"{field} = ${param_count}")
            val = updates[field]
            if field == 'date_incurred' and isinstance(val, str):
                val = datetime.strptime(val, '%Y-%m-%d').date()
            values.append(val)
            param_count += 1
    
    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updated_cost = await db.fetchrow(
        f"UPDATE cost_items SET {', '.join(set_clauses)} WHERE cost_id = $1 RETURNING *",
        *values
    )
    
    # Delete old accounting entry
    old_trans = await db.fetchrow(
        "SELECT transaction_id FROM transactions WHERE reference_type = 'cost' AND reference_id = $1",
        cost_id
    )
    if old_trans:
        await db.execute("DELETE FROM transaction_lines WHERE transaction_id = $1", old_trans['transaction_id'])
        await db.execute("DELETE FROM transactions WHERE transaction_id = $1", old_trans['transaction_id'])
    
    # Get bus info for descriptions
    bus_info = await db.fetchrow(
        "SELECT stock_number, year, make, model FROM inventory WHERE inventory_id = $1",
        inventory_id
    )
    bus_label = f"{bus_info['stock_number']} — {bus_info['year']} {bus_info['make']} {bus_info['model']}" if bus_info else f"Inventory #{inventory_id}"
    
    # Create new accounting entry
    cost_category = updated_cost['cost_category']
    amount = float(updated_cost['amount'])
    currency = updated_cost['currency']
    date_incurred = updated_cost['date_incurred']
    payment_status = updates.get('payment_status', 'on_credit')
    payment_account_id = updates.get('payment_account_id')
    
    INVENTORY_ACCOUNT_CODE = '1200'
    expense_account_id = await db.fetchval(
        "SELECT account_id FROM accounts WHERE account_code = $1",
        INVENTORY_ACCOUNT_CODE
    )
    
    reference_number = await generate_transaction_reference(db, 'expense', date_incurred)
    
    trans_description = f"Cost - {cost_category} - {updated_cost['description']} ({bus_label})"
    
    trans_id = await db.fetchval("""
        INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by, reference_number)
        VALUES ($1, $2, 'cost', $3, $4, $5, $6)
        RETURNING transaction_id
    """, date_incurred, trans_description, cost_id, currency, user['username'], reference_number)
    
    # Debit: Bus Inventory
    await db.execute("""
        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
        VALUES ($1, $2, $3, 0, $4, $5)
    """, trans_id, expense_account_id, amount, currency,
        f"{cost_category} - {updated_cost['vendor'] or 'N/A'} — {bus_label}")
    
    if payment_status == 'on_credit':
        ap_account_id = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_subtype = 'AP' AND currency = $1 AND is_active = TRUE LIMIT 1",
            currency
        )
        if not ap_account_id:
            ap_account_id = await db.fetchval(
                "SELECT account_id FROM accounts WHERE account_subtype = 'AP' AND is_active = TRUE LIMIT 1"
            )
        vendor_name = updated_cost['vendor'] or 'Unknown'
        await db.execute("""
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
            VALUES ($1, $2, 0, $3, $4, $5)
        """, trans_id, ap_account_id, amount, currency,
            f"AP — {vendor_name} — {cost_category} — {bus_label}")
    else:
        if payment_account_id:
            payment_account_id = int(payment_account_id)
        else:
            raise HTTPException(status_code=400, detail="Payment account required when status is paid")
        await db.execute("""
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
            VALUES ($1, $2, 0, $3, $4, $5)
        """, trans_id, payment_account_id, amount, currency,
            f"Payment for {cost_category} — {bus_label}")
    
    await update_account_balances(db, trans_id)
    
    await log_audit(
        db, user['user_id'], user['username'],
        'update', 'cost_items', cost_id,
        old_values=dict(cost),
        new_values=dict(updated_cost),
        description=f"Updated cost: {updated_cost['description']}"
    )
    
    return dict(updated_cost)

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

    # The accounting entry below records payment_amount/payment_currency
    # against payment_account_id at face value, with no conversion - checked
    # here, before the payment itself is inserted, rather than inside that
    # entry's own try/except (which only prints a warning on failure and
    # would otherwise silently swallow a mismatch: the payment would still
    # get recorded with no indication its accounting entry never happened).
    paid_account = await db.fetchrow(
        "SELECT account_name, currency FROM accounts WHERE account_id = $1 AND is_active = TRUE",
        payment.payment_account_id
    )
    if not paid_account:
        raise HTTPException(status_code=404, detail="Payment account not found")
    if (paid_account['currency'] or 'USD') != payment.payment_currency:
        raise HTTPException(
            status_code=400,
            detail=f"{paid_account['account_name']} is a {paid_account['currency']} account, "
                   f"but this payment is in {payment.payment_currency}. Select a {payment.payment_currency} account."
        )

    # Closing a period is supposed to lock it from edits, but this endpoint
    # never checked - a payment dated inside an already-closed period would
    # move money and change balances without ever touching the net income
    # figures that period's closing locked in.
    await check_period_lock(db, payment.payment_date)

    # Get exchange rate as of payment date
    exchange_rate = await get_exchange_rate(db, 'USD', 'MXN', payment.payment_date)

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

    # Create accounting entry — Debit Bank, Credit AR
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

        if not ar_account:
            print(f"Warning: No AR account found for currency {payment.payment_currency}")
        else:
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
    exchange_rate = await get_exchange_rate(db, 'USD', 'MXN')
    
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
    exchange_rate = await get_exchange_rate(db, 'USD', 'MXN')
    
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
            -- Split by sale_currency, same as revenue_usd/revenue_mxn above -
            -- balance_due is denominated in the sale's own currency, so
            -- summing it across USD and MXN sales together (as a single
            -- pending_balance_total) added incompatible units as if they
            -- were the same currency.
            SUM(CASE WHEN i.sale_currency = 'USD' AND i.payment_status != 'Paid in Full' THEN COALESCE(i.balance_due, 0) ELSE 0 END) as pending_balance_usd,
            SUM(CASE WHEN i.sale_currency = 'MXN' AND i.payment_status != 'Paid in Full' THEN COALESCE(i.balance_due, 0) ELSE 0 END) as pending_balance_mxn,
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
    # Consolidated (USD-equivalent) revenue per month, keyed by 'YYYY-MM'.
    # Built here rather than as its own SQL SUM() because each sale already
    # carries the exchange rate in effect on its own sale date (via
    # calculate_total_costs -> exchange_rate_used below), which is more
    # accurate than converting a month's MXN total at a single rate.
    monthly_consolidated_revenue = {}

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
        
        # Consolidate this sale into its month's USD-equivalent total.
        # exchange_rate here is MXN->USD (see calculate_total_costs), so an
        # MXN sale converts the same way a peso cost is converted to USD
        # everywhere else in this function.
        if sale['sale_date']:
            month_key = sale['sale_date'].strftime('%Y-%m')
            revenue_usd_equiv = sale_price if sale_currency == 'USD' else sale_price * exchange_rate
            monthly_consolidated_revenue[month_key] = monthly_consolidated_revenue.get(month_key, 0) + revenue_usd_equiv

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
    # generate_series fills in every month in [start_date, end_date] (params
    # $1/$2, always the date bounds - see where_clause above), then the sales
    # aggregate is LEFT JOINed onto it so months with zero sales still get a
    # row (zeroed via COALESCE) instead of being dropped from the result -
    # a month the chart skipped entirely used to look identical to one that
    # was never queried.
    monthly_query = f"""
        SELECT
            gs.month,
            COALESCE(m.sales_count, 0) as sales_count,
            COALESCE(m.revenue_usd, 0) as revenue_usd,
            COALESCE(m.revenue_mxn, 0) as revenue_mxn
        FROM generate_series(DATE_TRUNC('month', $1::date), DATE_TRUNC('month', $2::date), INTERVAL '1 month') AS gs(month)
        LEFT JOIN (
            SELECT
                DATE_TRUNC('month', i.sale_date) as month,
                COUNT(*) as sales_count,
                SUM(CASE WHEN i.sale_currency = 'USD' THEN i.sale_price ELSE 0 END) as revenue_usd,
                SUM(CASE WHEN i.sale_currency = 'MXN' THEN i.sale_price ELSE 0 END) as revenue_mxn
            FROM inventory i
            LEFT JOIN clients c ON i.client_id = c.client_id
            WHERE {where_clause}
            GROUP BY DATE_TRUNC('month', i.sale_date)
        ) m ON gs.month = m.month
        ORDER BY gs.month
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
            'pending_balance_usd': float(overview['pending_balance_usd'] or 0),
            'pending_balance_mxn': float(overview['pending_balance_mxn'] or 0),
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
                    'revenue_mxn': float(row['revenue_mxn'] or 0),
                    # USD+MXN consolidated into one USD-equivalent figure
                    # using each sale's own sale-date exchange rate.
                    'revenue_consolidated_usd': float(monthly_consolidated_revenue.get(row['month'].strftime('%Y-%m'), 0)) if row['month'] else 0.0
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
    
    # Check period lock
    await check_period_lock(db, sale_data.sale_date)

    # 2. Get exchange rate as of sale date and store it
    exchange_rate = await get_exchange_rate(db, 'MXN', 'USD', sale_data.sale_date)
    sale_exchange_rate = await get_exchange_rate(db, 'USD', 'MXN', sale_data.sale_date)
    sale_price = float(sale_data.sale_price)

    # 3. Calculate total costs in sale currency (use sale date rate)
    cost_data = await calculate_total_costs(db, sale_data.inventory_id, sale_data.sale_currency, sale_data.sale_date)
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
        'sale_exchange_rate': sale_exchange_rate,
        'balance_due': sale_data.sale_price,
        'payment_status': 'Pending'
    }
    # Move status off whatever pre-sale value it had (e.g. 'In Stock (US)',
    # or a leftover 'Available' from before the vocabulary fix) so it can't
    # keep showing a stale pre-sale status forever - this used to be the
    # only field is_sold changed, so any screen displaying bus.status
    # directly (e.g. InventoryManagement.jsx's expanded row) kept showing
    # the unit as available even after it was properly sold here. Only
    # applies if status isn't already further along the pipeline, so this
    # can't regress a unit whose import/delivery status was already set.
    if bus['status'] not in POST_SALE_STATUSES:
        update_fields['status'] = 'Sold'
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
        sale_currency = sale_data.sale_currency

        # Find currency-matched accounts
        revenue_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_type = 'Income' AND account_subtype = 'Sales' AND currency = $1 AND is_active = TRUE LIMIT 1",
            sale_currency
        )
        # Fallback: any Sales Income account
        if not revenue_account:
            revenue_account = await db.fetchval(
                "SELECT account_id FROM accounts WHERE account_type = 'Income' AND is_active = TRUE LIMIT 1"
            )

        ar_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_subtype = 'AR' AND currency = $1 AND is_active = TRUE LIMIT 1",
            sale_currency
        )
        if not ar_account:
            ar_account = await db.fetchval(
                "SELECT account_id FROM accounts WHERE account_subtype = 'AR' AND is_active = TRUE LIMIT 1"
            )

        cogs_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_subtype = 'Cost of Goods' AND is_active = TRUE LIMIT 1"
        )
        inventory_account = await db.fetchval(
            "SELECT account_id FROM accounts WHERE account_subtype = 'Inventory' AND is_active = TRUE LIMIT 1"
        )

        # Only create revenue entries if accounts exist
        if revenue_account and ar_account:
            # Revenue entry: Debit AR, Credit Revenue
            trans_row = await db.fetchrow("""
                INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
                VALUES ($1, $2, 'sale', $3, $4, $5)
                RETURNING transaction_id
            """, sale_data.sale_date,
                f"Sale of {bus['stock_number']} — {bus['year']} {bus['make']} {bus['model']}",
                sale_data.inventory_id, sale_currency, user['username'])

            trans_id = trans_row['transaction_id']

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

            await update_account_balances(db, trans_id)

        # COGS entry: move everything capitalized to Bus Inventory for this bus
        if cogs_account and inventory_account:
            # Calculate COGS per currency from what's ACTUALLY in Bus Inventory
            inventory_by_currency = await db.fetch("""
                SELECT tl.currency,
                       COALESCE(SUM(tl.debit_amount), 0) - COALESCE(SUM(tl.credit_amount), 0) as total
                FROM transaction_lines tl
                JOIN transactions t ON tl.transaction_id = t.transaction_id
                WHERE tl.account_id = $1
                  AND (
                    (t.reference_type = 'purchase' AND t.reference_id = $2)
                    OR
                    (t.reference_type = 'cost' AND t.reference_id IN (
                        SELECT cost_id FROM cost_items WHERE inventory_id = $2
                    ))
                  )
                GROUP BY tl.currency
                HAVING COALESCE(SUM(tl.debit_amount), 0) - COALESCE(SUM(tl.credit_amount), 0) > 0
            """, inventory_account, sale_data.inventory_id)

            if inventory_by_currency:
                cogs_trans = await db.fetchrow("""
                    INSERT INTO transactions (transaction_date, description, reference_type, reference_id, currency, created_by)
                    VALUES ($1, $2, 'cogs', $3, $4, $5)
                    RETURNING transaction_id
                """, sale_data.sale_date,
                    f"COGS for {bus['stock_number']} — {bus['year']} {bus['make']} {bus['model']}",
                    sale_data.inventory_id, sale_data.sale_currency, user['username'])

                cogs_trans_id = cogs_trans['transaction_id']

                for inv_row in inventory_by_currency:
                    cur = inv_row['currency']
                    cogs_amount = float(inv_row['total'])
                    
                    # Debit COGS (Bus Purchases) in this currency
                    await db.execute("""
                        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                        VALUES ($1, $2, $3, 0, $4, $5)
                    """, cogs_trans_id, cogs_account, Decimal(str(cogs_amount)), cur,
                        f"COGS for {bus['stock_number']} ({cur})")

                    # Credit Inventory in this currency
                    await db.execute("""
                        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                        VALUES ($1, $2, 0, $3, $4, $5)
                    """, cogs_trans_id, inventory_account, Decimal(str(cogs_amount)), cur,
                        f"Inventory reduction for {bus['stock_number']} ({cur})")

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
    erick_payment_account_id: Optional[int] = None
    omar_payment_account_id: Optional[int] = None

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

# ==================== ACCOUNTS PAYABLE ====================

@app.get("/api/accounting/ap-summary")
async def get_ap_summary(
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get AP balances grouped by vendor with detail lines"""
    # Summary by vendor
    query = """
        SELECT 
            tl.currency,
            COALESCE(
                CASE 
                    WHEN tl.notes LIKE 'AP — %' THEN split_part(split_part(tl.notes, 'AP — ', 2), ' — ', 1)
                    WHEN tl.notes LIKE 'AP payment — %' THEN split_part(split_part(tl.notes, 'AP payment — ', 2), ' — ', 1)
                    ELSE 'Unknown'
                END, 
                'Unknown'
            ) as vendor,
            SUM(tl.credit_amount) - SUM(tl.debit_amount) as balance,
            COUNT(DISTINCT t.transaction_id) as transaction_count
        FROM transaction_lines tl
        JOIN accounts a ON tl.account_id = a.account_id
        JOIN transactions t ON tl.transaction_id = t.transaction_id
        WHERE a.account_subtype = 'AP'
        GROUP BY tl.currency, vendor
        HAVING SUM(tl.credit_amount) - SUM(tl.debit_amount) > 0.01
        ORDER BY tl.currency, vendor
    """
    rows = await db.fetch(query)
    
    # Detail lines — full vendor ledger (charges and payments)
    detail_query = """
        SELECT 
            t.transaction_id,
            t.transaction_date,
            t.description,
            t.reference_type,
            tl.currency,
            tl.credit_amount,
            tl.debit_amount,
            tl.notes,
            COALESCE(
                CASE 
                    WHEN tl.notes LIKE 'AP — %' THEN split_part(split_part(tl.notes, 'AP — ', 2), ' — ', 1)
                    WHEN tl.notes LIKE 'AP payment — %' THEN split_part(split_part(tl.notes, 'AP payment — ', 2), ' — ', 1)
                    ELSE 'Unknown'
                END, 
                'Unknown'
            ) as vendor
        FROM transaction_lines tl
        JOIN accounts a ON tl.account_id = a.account_id
        JOIN transactions t ON tl.transaction_id = t.transaction_id
        WHERE a.account_subtype = 'AP'
        ORDER BY t.transaction_date ASC, t.transaction_id ASC
    """
    detail_rows = await db.fetch(detail_query)
    
    # Organize details by vendor+currency key
    vendor_details = {}
    for row in detail_rows:
        vendor = row['vendor']
        currency = row['currency']
        key = vendor + '|' + currency
        if key not in vendor_details:
            vendor_details[key] = []
        
        credit = float(row['credit_amount'])
        debit = float(row['debit_amount'])
        
        vendor_details[key].append({
            'transaction_id': row['transaction_id'],
            'date': str(row['transaction_date']),
            'description': row['description'],
            'type': row['reference_type'],
            'currency': currency,
            'charge': credit if credit > 0 else 0,
            'payment': debit if debit > 0 else 0,
            'notes': row['notes']
        })
    
    totals = {}
    payables = []
    for row in rows:
        item = dict(row)
        item['details'] = vendor_details.get(item['vendor'] + '|' + item['currency'], [])
        payables.append(item)
        cur = item['currency']
        totals[cur] = totals.get(cur, 0) + float(item['balance'])
    
    return {
        'payables': payables,
        'totals': totals
    }

class APPaymentCreate(BaseModel):
    vendor: str
    payment_amount: Decimal
    payment_currency: str = 'USD'
    payment_date: date
    payment_account_id: int
    notes: Optional[str] = None

@app.post("/api/accounting/ap-payment")
async def record_ap_payment(
    payment: APPaymentCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Record a payment against Accounts Payable for a vendor"""

    # See create_transaction for why this matters: closing a period is
    # supposed to lock it from edits.
    await check_period_lock(db, payment.payment_date)

    # Find AP account for this currency
    ap_account_id = await db.fetchval(
        "SELECT account_id FROM accounts WHERE account_subtype = 'AP' AND currency = $1 AND is_active = TRUE LIMIT 1",
        payment.payment_currency
    )
    if not ap_account_id:
        raise HTTPException(status_code=400, detail="No AP account found for this currency")
    
    # Verify bank account exists and matches the payment's currency - same
    # currency-mismatch guard as sale payments (add_payment): without it,
    # paying a USD vendor bill from an MXN account would credit the MXN
    # account's balance by the raw USD number with no conversion.
    bank_account = await db.fetchrow(
        "SELECT account_id, account_name, currency FROM accounts WHERE account_id = $1 AND is_active = TRUE",
        payment.payment_account_id
    )
    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    if bank_account['currency'] != payment.payment_currency:
        raise HTTPException(
            status_code=400,
            detail=f"{bank_account['account_name']} is a {bank_account['currency']} account, "
                   f"but this payment is in {payment.payment_currency}. Select a {payment.payment_currency} account."
        )

    # Create transaction: Debit AP, Credit Bank
    trans_row = await db.fetchrow("""
        INSERT INTO transactions (transaction_date, description, reference_type, currency, created_by)
        VALUES ($1, $2, 'ap_payment', $3, $4)
        RETURNING transaction_id
    """, payment.payment_date,
        f"AP Payment to {payment.vendor}" + (f" — {payment.notes}" if payment.notes else ""),
        payment.payment_currency, user['username'])
    
    trans_id = trans_row['transaction_id']
    
    # Debit AP (reduce what we owe)
    ap_note = f"AP payment — {payment.vendor}" + (f" — {payment.notes}" if payment.notes else "")
    await db.execute("""
        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
        VALUES ($1, $2, $3, 0, $4, $5)
    """, trans_id, ap_account_id, payment.payment_amount, payment.payment_currency,
        ap_note)
    
    # Credit Bank (money leaves)
    bank_note = f"Payment to {payment.vendor} from {bank_account['account_name']}" + (f" — {payment.notes}" if payment.notes else "")
    await db.execute("""
        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
        VALUES ($1, $2, 0, $3, $4, $5)
    """, trans_id, payment.payment_account_id, payment.payment_amount, payment.payment_currency,
        bank_note)
    
    await update_account_balances(db, trans_id)
    
    await log_audit(
        db, user['user_id'], user['username'],
        'create', 'ap_payment', trans_id,
        new_values={
            'vendor': payment.vendor,
            'amount': str(payment.payment_amount),
            'currency': payment.payment_currency,
            'bank_account': bank_account['account_name']
        },
        description=f"AP payment to {payment.vendor}: {payment.payment_amount} {payment.payment_currency}"
    )
    
    return {"message": f"Payment of {payment.payment_amount} {payment.payment_currency} to {payment.vendor} recorded", "transaction_id": trans_id}

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
        params.append(datetime.strptime(start_date, '%Y-%m-%d').date())
        param_count += 1
    
    if end_date:
        where_clauses.append(f"transaction_date <= ${param_count}")
        params.append(datetime.strptime(end_date, '%Y-%m-%d').date())
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
                    'account_type', a.account_type,
                    'account_subtype', a.account_subtype,
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

    # Closing a period is supposed to lock it from edits (see close_period),
    # but this endpoint - the one behind every Deposit/Expense/Transfer/
    # Exchange in the UI - never checked, so a backdated entry into an
    # already-closed period would move money without ever touching the net
    # income/FX figures that period's closing locked in.
    await check_period_lock(db, transaction.transaction_date)

    # Validate: Debits must equal credits
    # Only exchange transactions are exempt (different currencies can't balance numerically)
    total_debits = sum(float(line.debit_amount) for line in transaction.lines)
    total_credits = sum(float(line.credit_amount) for line in transaction.lines)
    
    if transaction.reference_type == 'exchange':
        # Exchange: just ensure we have at least one debit and one credit
        if total_debits == 0 or total_credits == 0:
            raise HTTPException(
                status_code=400,
                detail="Exchange transaction must have at least one debit and one credit"
            )
    else:
        # All other types: strict debit = credit check
        if abs(total_debits - total_credits) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Debits ({total_debits}) must equal credits ({total_credits})"
            )

    # A line's declared currency must match its account's actual currency,
    # but ONLY for Bank/Cash accounts. get_cash_position joins
    # account_balances to accounts ON b.currency = a.currency, scoped to
    # account_type = 'Asset' AND account_subtype IN ('Bank', 'Cash') - for
    # those accounts specifically, a mismatched line's balance lands under a
    # phantom-currency bucket that join never finds, so the money silently
    # vanishes from the cash dashboard with no error raised anywhere.
    # Every other report (income-statement, balance-sheet, ap-summary, the
    # FX revaluation step in close_period) buckets an account's activity by
    # transaction_lines.currency directly, not accounts.currency - so a
    # mismatched line on an Expense/Income/Equity/Liability(AP)/Asset(AR)
    # account is read correctly by all of them. Checking those here too only
    # blocked legitimate entries (a USD expense against a chart of accounts
    # that happens to only have an MXN-tagged Expense category, since a
    # category account's own currency tag is otherwise decorative).
    account_ids = list({line.account_id for line in transaction.lines})
    account_rows = await db.fetch(
        "SELECT account_id, account_name, currency, account_type, account_subtype FROM accounts WHERE account_id = ANY($1::int[])",
        account_ids
    )
    accounts_by_id = {row['account_id']: row for row in account_rows}
    for line in transaction.lines:
        account = accounts_by_id.get(line.account_id)
        if not account:
            raise HTTPException(status_code=404, detail=f"Account {line.account_id} not found")
        is_bank_or_cash = account['account_type'] == 'Asset' and account['account_subtype'] in ('Bank', 'Cash')
        if is_bank_or_cash and line.currency != account['currency']:
            raise HTTPException(
                status_code=400,
                detail=f"{account['account_name']} is a {account['currency']} account, but a line for it was submitted in {line.currency}. "
                       f"Each line's currency must match its account's currency — use an Exchange transaction to move money between currencies."
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
        
        # Upsert a single balance row (one per account+currency)
        await db.execute(
            """
            INSERT INTO account_balances (account_id, currency, balance, as_of_date)
            VALUES ($1, $2, $3, CURRENT_DATE)
            ON CONFLICT (account_id, currency)
            DO UPDATE SET balance = $3, as_of_date = CURRENT_DATE
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
        LEFT JOIN account_balances b ON a.account_id = b.account_id AND b.currency = a.currency
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
    try:
        exchange_rate = await get_exchange_rate(db, 'USD', 'MXN')
    except:
        exchange_rate = 17.50  # Cash position is a dashboard view — graceful fallback
    
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
        prefix = f"{type_code}-{date_str}-%"
        try:
            max_seq = await db.fetchval(
                """
                SELECT MAX(CAST(split_part(reference_number, '-', 3) AS INTEGER))
                FROM transactions 
                WHERE reference_number LIKE $1
                  AND split_part(reference_number, '-', 3) ~ '^[0-9]+$'
                """,
                prefix
            )
        except Exception:
            max_seq = None
        
        sequence = (max_seq or 0) + 1
        reference = f"{type_code}-{date_str}-{sequence:03d}"
        
        # Verify uniqueness — if collision, increment until unique
        for _ in range(10):
            exists = await db.fetchval(
                "SELECT COUNT(*) FROM transactions WHERE reference_number = $1",
                reference
            )
            if not exists:
                break
            sequence += 1
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
            purchase_price_usd, sale_exchange_rate
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
    
    # Use exchange rate at time of sale (not current rate)
    if sale['sale_exchange_rate']:
        exchange_rate = float(sale['sale_exchange_rate'])
    else:
        exchange_rate = await get_exchange_rate(db, 'USD', 'MXN')
    
    # Calculate profit in sale currency
    sale_price = float(sale['sale_price'])
    currency = sale['sale_currency']
    
    if currency == 'USD':
        total_cost = total_cost_usd
    else:  # MXN
        total_cost = (total_cost_usd * exchange_rate) + mxn_costs
    
    profit = sale_price - total_cost
    
    # Calculate distributions — round to ensure they sum to total
    erick_amount = round(profit * 0.60, 2)
    omar_amount = round(profit - erick_amount, 2)  # Remainder ensures exact total
    
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

    # See create_transaction for why this matters: closing a period is
    # supposed to lock it from edits.
    await check_period_lock(db, distribution.distribution_date)

    erick_amount = round(float(distribution.total_profit) * float(distribution.erick_percentage) / 100, 2)
    omar_amount = round(float(distribution.total_profit) - erick_amount, 2)  # Remainder ensures exact total

    # The payout lines below are inserted with currency=distribution.currency
    # against whichever account the frontend sent, with no check that the
    # account is actually in that currency - same gap as create_transaction
    # had (this endpoint builds its own transaction/lines directly, so that
    # fix doesn't cover it). A bus sold in MXN paid out to a USD account
    # would silently create a phantom MXN balance on a USD account instead
    # of ever crediting money anywhere real.
    for role, account_id in (('Erick', distribution.erick_payment_account_id), ('Omar', distribution.omar_payment_account_id)):
        if not account_id:
            continue
        payout_account = await db.fetchrow(
            "SELECT account_name, currency FROM accounts WHERE account_id = $1 AND is_active = TRUE",
            account_id
        )
        if not payout_account:
            raise HTTPException(status_code=404, detail=f"{role}'s payout account not found")
        if payout_account['currency'] != distribution.currency:
            raise HTTPException(
                status_code=400,
                detail=f"{payout_account['account_name']} is a {payout_account['currency']} account, "
                       f"but this distribution is in {distribution.currency}. Select a {distribution.currency} account for {role}."
            )

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
                transaction_id, account_id, debit_amount, credit_amount, currency, notes
            ) VALUES ($1, $2, $3, 0, $4, $5)
            """,
            trans_id, retained_earnings, distribution.total_profit, distribution.currency,
            f"Profit distribution — {distribution.notes or 'Distribution'}"
        )
        
        # Credit: Erick Distribution
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount, currency, notes
            ) VALUES ($1, $2, 0, $3, $4, $5)
            """,
            trans_id, erick_dist, erick_amount, distribution.currency,
            f"Distribution to Erick ({distribution.erick_percentage}%)"
        )
        
        # Credit: Omar Distribution
        await db.execute(
            """
            INSERT INTO transaction_lines (
                transaction_id, account_id, debit_amount, credit_amount, currency, notes
            ) VALUES ($1, $2, 0, $3, $4, $5)
            """,
            trans_id, omar_dist, omar_amount, distribution.currency,
            f"Distribution to Omar ({distribution.omar_percentage}%)"
        )
        
        # Update balances
        await update_account_balances(db, trans_id)
        
        # Create cash payout entries if bank accounts specified
        # Debit Distributions (reduce what's owed), Credit Bank (money leaves)
        if distribution.erick_payment_account_id and distribution.omar_payment_account_id:
            payout_trans_id = await db.fetchval("""
                INSERT INTO transactions (
                    transaction_date, description, reference_type, reference_id,
                    currency, created_by
                ) VALUES ($1, $2, 'distribution_payout', $3, $4, $5)
                RETURNING transaction_id
            """, distribution.distribution_date,
                f"Payout - {distribution.notes or 'Profit distribution'}",
                dist_row['distribution_id'], distribution.currency, user['username'])
            
            # Erick payout: Debit Distributions - Erick, Credit Bank
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, 0, $4, $5)
            """, payout_trans_id, erick_dist, erick_amount, distribution.currency,
                f"Payout to Erick ({distribution.erick_percentage}%)")
            
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, 0, $3, $4, $5)
            """, payout_trans_id, distribution.erick_payment_account_id, erick_amount, distribution.currency,
                f"Erick distribution payout")
            
            # Omar payout: Debit Distributions - Omar, Credit Bank
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, $3, 0, $4, $5)
            """, payout_trans_id, omar_dist, omar_amount, distribution.currency,
                f"Payout to Omar ({distribution.omar_percentage}%)")
            
            await db.execute("""
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                VALUES ($1, $2, 0, $3, $4, $5)
            """, payout_trans_id, distribution.omar_payment_account_id, omar_amount, distribution.currency,
                f"Omar distribution payout")
            
            await update_account_balances(db, payout_trans_id)
        
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
async def create_work_plan(inventory_id: int, plan: WorkPlanCreate, db=Depends(get_db), user=Depends(get_current_user)):
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
async def get_work_plans(inventory_id: int, db=Depends(get_db), user=Depends(get_current_user)):
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
    db=Depends(get_db),
    user=Depends(get_current_user)
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
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Upload photo for inventory item"""
    inv_check = await db.fetchval("SELECT inventory_id FROM inventory WHERE inventory_id = $1", inventory_id)
    if not inv_check:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    # Never trust the client-supplied filename for the on-disk path — it can
    # contain "../" sequences or an absolute path and lead to writing files
    # outside the upload directory. Only the extension is kept (validated
    # against an allowlist); the on-disk name is generated server-side.
    original_name = os.path.basename(file.filename or "")
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_PHOTO_EXTENSIONS))}"
        )

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    upload_subdir = os.path.join(UPLOAD_DIR, "inventory", str(inventory_id))
    os.makedirs(upload_subdir, exist_ok=True)
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_subdir, safe_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    query = """
        INSERT INTO inventory_photos (inventory_id, file_name, file_path, file_size,
                                     mime_type, photo_type, is_primary, caption)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    """
    row = await db.fetchrow(
        query, inventory_id, original_name, file_path, len(content),
        file.content_type, photo_type, is_primary, caption
    )
    return dict(row)

@app.get("/api/inventory/{inventory_id}/photos")
async def get_photos(inventory_id: int, db=Depends(get_db), user=Depends(get_current_user)):
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
async def create_warranty_claim(inventory_id: int, claim: WarrantyClaimCreate, db=Depends(get_db), user=Depends(get_current_user)):
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
async def get_warranty_claims(inventory_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Get warranty claims for a unit"""
    query = "SELECT * FROM warranty_claims WHERE inventory_id = $1 ORDER BY claim_date DESC"
    rows = await db.fetch(query, inventory_id)
    return [dict(row) for row in rows]

# ==================== REPORTING ENDPOINTS ====================

@app.get("/api/reports/dashboard")
async def get_dashboard(db=Depends(get_db), user=Depends(get_current_user)):
    """Dashboard statistics"""
    query = """
        SELECT
            COUNT(*) as total_units,
            COUNT(*) FILTER (WHERE current_location = 'US Stock' AND is_sold = FALSE) as us_inventory,
            COUNT(*) FILTER (WHERE current_location = 'Mexico Stock' AND is_sold = FALSE) as mexico_inventory,
            COUNT(*) FILTER (WHERE is_sold = FALSE) as available_for_sale,
            COUNT(*) FILTER (WHERE is_sold = TRUE AND status != 'Delivered') as sold_pending_delivery,
            COUNT(*) FILTER (WHERE status = 'Delivered') as delivered,
            COUNT(*) FILTER (WHERE warranty_status = 'Active') as under_warranty,
            AVG(days_in_inventory) FILTER (WHERE status != 'Delivered') as avg_days_in_inventory
        FROM inventory
        WHERE is_deleted = FALSE
    """
    row = await db.fetchrow(query)
    result = dict(row)

    # us_inventory_value / total_inventory_value: purchase price plus every
    # cost_items entry (transport, reconditioning, import, etc.), not just
    # cost_in_us_stock_usd's generated total. That column is purchase_price
    # + transport_to_stock_cost_usd + initial_reconditioning_cost_usd +
    # other_acquisition_costs_usd, but nothing in the UI ever sets those
    # three - the real cost-entry flow ("Costs" button -> CostManagement
    # Modal) writes to cost_items instead, so cost_in_us_stock_usd was
    # silently always == purchase_price_usd. calculate_total_costs() is
    # the same single-source-of-truth already used for COGS/profit
    # elsewhere, so this also handles MXN cost items correctly.
    available_units = await db.fetch(
        "SELECT inventory_id, current_location FROM inventory "
        "WHERE is_deleted = FALSE AND is_sold = FALSE"
    )
    us_value = 0.0
    total_value = 0.0
    for unit in available_units:
        cost_data = await calculate_total_costs(db, unit['inventory_id'], 'USD')
        unit_cost = float(cost_data['total_cost']) if cost_data else 0.0
        total_value += unit_cost
        if unit['current_location'] == 'US Stock':
            us_value += unit_cost

    result['us_inventory_value'] = us_value
    result['total_inventory_value'] = total_value

    # Recent Inventory widget: same total-cost fix as above, computed here
    # (rather than the frontend fetching /api/inventory itself) so it isn't
    # just purchase_price_usd either, and so showing 5 units doesn't require
    # fetching and discarding up to 100 full inventory rows.
    recent_rows = await db.fetch(
        "SELECT inventory_id, stock_number, vin, year, make, model, status, "
        "purchase_price_usd FROM inventory WHERE is_deleted = FALSE "
        "ORDER BY created_at DESC LIMIT 5"
    )
    recent_inventory = []
    for r in recent_rows:
        cost_data = await calculate_total_costs(db, r['inventory_id'], 'USD')
        total_cost = float(cost_data['total_cost']) if cost_data else float(r['purchase_price_usd'] or 0)
        recent_inventory.append({
            'inventory_id': r['inventory_id'],
            'stock_number': r['stock_number'],
            'vin': r['vin'],
            'year': r['year'],
            'make': r['make'],
            'model': r['model'],
            'status': r['status'],
            'total_cost_usd': total_cost,
        })
    result['recent_inventory'] = recent_inventory

    return result

@app.get("/api/reports/us-inventory")
async def get_us_inventory_report(db=Depends(get_db), user=Depends(get_current_user)):
    """US inventory report"""
    query = "SELECT * FROM us_inventory"
    rows = await db.fetch(query)
    return [dict(row) for row in rows]

@app.get("/api/reports/mexico-inventory")
async def get_mexico_inventory_report(db=Depends(get_db), user=Depends(get_current_user)):
    """Mexico inventory report"""
    query = "SELECT * FROM mexico_inventory"
    rows = await db.fetch(query)
    return [dict(row) for row in rows]

@app.get("/api/reports/sold-pending")
async def get_sold_pending_delivery(db=Depends(get_db), user=Depends(get_current_user)):
    """Sold units pending delivery"""
    query = "SELECT * FROM sold_pending_delivery"
    rows = await db.fetch(query)
    return [dict(row) for row in rows]

@app.get("/api/reports/warranty-active")
async def get_active_warranties(db=Depends(get_db), user=Depends(get_current_user)):
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

    # current_location/status must match the vocabulary the dashboard and
    # reporting queries filter on ('US Stock' / 'Mexico Stock', and the
    # documented status pipeline) - see migrations/004_fix_inventory_location_status.sql
    # for the bug this used to cause when they didn't.
    resolved_location = additional_data.get('current_location') or 'US Stock'
    if resolved_location == 'US Stock':
        initial_status = 'In Stock (US)'
    elif resolved_location == 'Mexico Stock':
        initial_status = 'In Stock (Mexico)'
    else:
        initial_status = 'Purchased - In Transit to Stock'

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
            $29, $30, $31, $32, $33, $34, $35, $36, $37
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
        resolved_location,
        initial_status,
        user['username']
    )
    
    # Mark inspection as purchased and link back to the inventory unit it
    # became (inventory.pre_inspection_id is already set above via the
    # INSERT; this is the same relationship in the other direction).
    await db.execute(
        "UPDATE pre_purchase_inspections SET purchased = true, inventory_id = $1 WHERE inspection_id = $2",
        inventory_row['inventory_id'], inspection_id
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
# PERIOD CLOSING
# ========================================

class PeriodCloseRequest(BaseModel):
    period_start: date
    period_end: date
    notes: Optional[str] = None

@app.get("/api/accounting/period-closings")
async def get_period_closings(
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get all period closings"""
    rows = await db.fetch(
        "SELECT * FROM period_closings ORDER BY period_end DESC"
    )
    return [dict(row) for row in rows]

@app.get("/api/accounting/last-closing-date")
async def get_last_closing_date(
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Get the last closed period end date"""
    last = await db.fetchval(
        "SELECT MAX(period_end) FROM period_closings"
    )
    return {"last_closing_date": str(last) if last else None}

@app.post("/api/accounting/period-close")
async def close_period(
    request: PeriodCloseRequest,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Close an accounting period:
    1. Verify no overlap with existing closings
    2. Calculate net income for the period
    3. Close income/expense accounts to Retained Earnings
    4. Run FX revaluation at closing rate
    5. Lock the period
    """
    period_start = request.period_start
    period_end = request.period_end
    
    # Validate: period_end must be before today
    if period_end >= datetime.now().date():
        raise HTTPException(status_code=400, detail="Cannot close a period that hasn't ended yet")
    
    # Validate: no overlap with existing closings
    overlap = await db.fetchval(
        "SELECT COUNT(*) FROM period_closings WHERE period_end >= $1 AND period_start <= $2",
        period_start, period_end
    )
    if overlap:
        raise HTTPException(status_code=400, detail="This period overlaps with an existing closing")
    
    # Validate: period starts after last closing
    last_close = await db.fetchval("SELECT MAX(period_end) FROM period_closings")
    if last_close and period_start <= last_close:
        raise HTTPException(
            status_code=400, 
            detail=f"Period must start after the last closing date ({last_close})"
        )
    
    # Get closing exchange rate (rate on period_end)
    closing_rate = await get_exchange_rate(db, 'USD', 'MXN', period_end)
    
    # === Step 1: Calculate net income for the period ===
    income_data = await db.fetchrow("""
        SELECT 
            COALESCE(SUM(CASE WHEN a.account_type = 'Income' AND tl.currency = 'USD' THEN tl.credit_amount - tl.debit_amount ELSE 0 END), 0) as income_usd,
            COALESCE(SUM(CASE WHEN a.account_type = 'Income' AND tl.currency = 'MXN' THEN tl.credit_amount - tl.debit_amount ELSE 0 END), 0) as income_mxn,
            COALESCE(SUM(CASE WHEN a.account_type = 'Expense' AND tl.currency = 'USD' THEN tl.debit_amount - tl.credit_amount ELSE 0 END), 0) as expense_usd,
            COALESCE(SUM(CASE WHEN a.account_type = 'Expense' AND tl.currency = 'MXN' THEN tl.debit_amount - tl.credit_amount ELSE 0 END), 0) as expense_mxn
        FROM transaction_lines tl
        JOIN accounts a ON tl.account_id = a.account_id
        JOIN transactions t ON tl.transaction_id = t.transaction_id
        WHERE a.account_type IN ('Income', 'Expense')
          AND t.transaction_date >= $1 AND t.transaction_date <= $2
    """, period_start, period_end)
    
    net_income_usd = float(income_data['income_usd']) - float(income_data['expense_usd'])
    net_income_mxn = float(income_data['income_mxn']) - float(income_data['expense_mxn'])
    
    # === Step 2: Close income/expense accounts to Retained Earnings ===
    # Get all income and expense accounts with activity in this period
    active_accounts = await db.fetch("""
        SELECT a.account_id, a.account_name, a.account_type, tl.currency,
               SUM(tl.debit_amount) as total_debit,
               SUM(tl.credit_amount) as total_credit
        FROM transaction_lines tl
        JOIN accounts a ON tl.account_id = a.account_id
        JOIN transactions t ON tl.transaction_id = t.transaction_id
        WHERE a.account_type IN ('Income', 'Expense')
          AND t.transaction_date >= $1 AND t.transaction_date <= $2
        GROUP BY a.account_id, a.account_name, a.account_type, tl.currency
        HAVING SUM(tl.debit_amount) != 0 OR SUM(tl.credit_amount) != 0
    """, period_start, period_end)
    
    # Get Retained Earnings account
    re_account = await db.fetchval(
        "SELECT account_id FROM accounts WHERE account_subtype = 'Retained Earnings' LIMIT 1"
    )
    if not re_account:
        raise HTTPException(status_code=400, detail="Retained Earnings account not found")
    
    # Create closing transaction
    closing_trans = await db.fetchrow("""
        INSERT INTO transactions (transaction_date, description, reference_type, currency, created_by)
        VALUES ($1, $2, 'period_close', 'MXN', $3)
        RETURNING transaction_id
    """, period_end,
        f"Period Closing {period_start} to {period_end}",
        user['username'])
    
    closing_trans_id = closing_trans['transaction_id']
    
    # Close each income/expense account to RE
    for acct in active_accounts:
        acct_type = acct['account_type']
        total_debit = float(acct['total_debit'])
        total_credit = float(acct['total_credit'])
        currency = acct['currency']
        
        if acct_type == 'Income':
            # Income has credit balance — debit income, credit RE
            net = total_credit - total_debit
            if abs(net) > 0.01:
                await db.execute("""
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, $3, 0, $4, $5)
                """, closing_trans_id, acct['account_id'], abs(net), currency,
                    f"Close {acct['account_name']} to RE")
                
                await db.execute("""
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, 0, $3, $4, $5)
                """, closing_trans_id, re_account, abs(net), currency,
                    f"RE — {acct['account_name']} ({currency})")
        
        elif acct_type == 'Expense':
            # Expense has debit balance — credit expense, debit RE
            net = total_debit - total_credit
            if abs(net) > 0.01:
                await db.execute("""
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, 0, $3, $4, $5)
                """, closing_trans_id, acct['account_id'], abs(net), currency,
                    f"Close {acct['account_name']} to RE")
                
                await db.execute("""
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                    VALUES ($1, $2, $3, 0, $4, $5)
                """, closing_trans_id, re_account, abs(net), currency,
                    f"RE — {acct['account_name']} ({currency})")
    
    await update_account_balances(db, closing_trans_id)
    
    # === Step 3: FX Revaluation ===
    # Get all USD monetary accounts (Bank, Cash, AR, AP, Inventory)
    fx_gain_loss_account = await db.fetchval(
        "SELECT account_id FROM accounts WHERE account_name = 'Unrealized FX Gain/Loss' LIMIT 1"
    )
    
    fx_total = 0
    revaluation_trans_id = None
    
    if fx_gain_loss_account:
        usd_accounts = await db.fetch("""
            SELECT ab.account_id, a.account_name, a.account_type, ab.balance
            FROM account_balances ab
            JOIN accounts a ON ab.account_id = a.account_id
            WHERE ab.currency = 'USD' AND ABS(ab.balance) > 0.01
              AND a.account_subtype IN ('Bank', 'Cash', 'AR', 'AP', 'Inventory')
        """)
        
        if usd_accounts:
            # Create revaluation transaction
            reval_trans = await db.fetchrow("""
                INSERT INTO transactions (transaction_date, description, reference_type, currency, created_by)
                VALUES ($1, $2, 'revaluation', 'MXN', $3)
                RETURNING transaction_id
            """, period_end,
                f"FX Revaluation at {closing_rate} — Period ending {period_end}",
                user['username'])
            
            revaluation_trans_id = reval_trans['transaction_id']
            
            for usd_acct in usd_accounts:
                usd_balance = float(usd_acct['balance'])
                # What this USD balance is worth in MXN at closing rate
                mxn_at_closing = usd_balance * closing_rate
                
                # What it's currently recorded as in MXN (from MXN balance for same account)
                mxn_recorded = await db.fetchval("""
                    SELECT COALESCE(balance, 0) FROM account_balances 
                    WHERE account_id = $1 AND currency = 'MXN'
                """, usd_acct['account_id'])
                mxn_recorded = float(mxn_recorded) if mxn_recorded else 0
                
                # The FX gain/loss for this account
                # For assets: positive difference = gain (USD worth more)
                # For liabilities: positive difference = loss (owe more)
                fx_diff = mxn_at_closing - mxn_recorded
                
                if abs(fx_diff) > 0.01 and mxn_recorded == 0:
                    # No MXN balance recorded — the entire USD balance converts
                    # This is the unrealized gain/loss from holding USD
                    fx_total += fx_diff
            
            # Record net FX gain/loss
            fx_total = round(fx_total, 2)
            
            if abs(fx_total) > 0.01:
                if fx_total > 0:
                    # FX Gain: Credit FX account (reduces expense = gain)
                    await db.execute("""
                        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                        VALUES ($1, $2, 0, $3, 'MXN', $4)
                    """, revaluation_trans_id, fx_gain_loss_account, abs(fx_total),
                        f"Unrealized FX gain at rate {closing_rate}")
                    # Debit RE for the gain
                    await db.execute("""
                        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                        VALUES ($1, $2, $3, 0, 'MXN', $4)
                    """, revaluation_trans_id, re_account, abs(fx_total),
                        f"FX gain to RE at rate {closing_rate}")
                else:
                    # FX Loss: Debit FX account (increases expense = loss)
                    await db.execute("""
                        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                        VALUES ($1, $2, $3, 0, 'MXN', $4)
                    """, revaluation_trans_id, fx_gain_loss_account, abs(fx_total),
                        f"Unrealized FX loss at rate {closing_rate}")
                    # Credit RE for the loss
                    await db.execute("""
                        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, currency, notes)
                        VALUES ($1, $2, 0, $3, 'MXN', $4)
                    """, revaluation_trans_id, re_account, abs(fx_total),
                        f"FX loss to RE at rate {closing_rate}")
                
                await update_account_balances(db, revaluation_trans_id)
    
    # === Step 4: Record the closing ===
    closing_record = await db.fetchrow("""
        INSERT INTO period_closings (
            period_start, period_end, closing_date, exchange_rate,
            net_income_usd, net_income_mxn, fx_gain_loss,
            closing_transaction_id, revaluation_transaction_id,
            notes, created_by
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    """, period_start, period_end, closing_rate,
        net_income_usd, net_income_mxn, fx_total,
        closing_trans_id, revaluation_trans_id,
        request.notes, user['username'])
    
    return {
        "message": f"Period {period_start} to {period_end} closed successfully",
        "closing": dict(closing_record),
        "net_income": {"usd": net_income_usd, "mxn": net_income_mxn},
        "fx_gain_loss": fx_total,
        "exchange_rate": closing_rate
    }

# ========================================
# PERIOD LOCK ENFORCEMENT
# ========================================

async def check_period_lock(db, transaction_date):
    """Check if a date falls within a closed period"""
    closed = await db.fetchval(
        "SELECT COUNT(*) FROM period_closings WHERE $1 <= period_end",
        transaction_date
    )
    if closed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create or modify transactions on {transaction_date} — this date falls within a closed period."
        )

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
    
    # Get exchange rate as of report end date (closing rate)
    exchange_rate = await get_exchange_rate(db, 'USD', 'MXN', end)
    
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
    
    # Get exchange rate as of report date (closing rate)
    exchange_rate = await get_exchange_rate(db, 'USD', 'MXN', report_date)
    
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
    
    # Calculate current period net income (Income - Expenses) for the balance sheet
    net_income_query = """
        SELECT 
            COALESCE(SUM(CASE 
                WHEN a.account_type = 'Income' AND tl.currency = 'USD' THEN tl.credit_amount - tl.debit_amount
                WHEN a.account_type = 'Expense' AND tl.currency = 'USD' THEN -(tl.debit_amount - tl.credit_amount)
                ELSE 0 
            END), 0) as net_income_usd,
            COALESCE(SUM(CASE 
                WHEN a.account_type = 'Income' AND tl.currency = 'MXN' THEN tl.credit_amount - tl.debit_amount
                WHEN a.account_type = 'Expense' AND tl.currency = 'MXN' THEN -(tl.debit_amount - tl.credit_amount)
                ELSE 0 
            END), 0) as net_income_mxn
        FROM transaction_lines tl
        JOIN accounts a ON tl.account_id = a.account_id
        JOIN transactions t ON tl.transaction_id = t.transaction_id
        WHERE a.account_type IN ('Income', 'Expense')
          AND t.transaction_date <= $1
    """
    net_income_row = await db.fetchrow(net_income_query, report_date)
    net_income_usd = float(net_income_row['net_income_usd']) if net_income_row else 0
    net_income_mxn = float(net_income_row['net_income_mxn']) if net_income_row else 0
    
    # Current asset subtypes — banks and cash are current assets
    current_asset_subtypes = {'Cash', 'Bank', 'Inventory', 'AR'}
    
    # Organize accounts
    assets = {'USD': 0, 'MXN': 0, 'current': [], 'non_current': []}
    liabilities = {'USD': 0, 'MXN': 0, 'current': [], 'non_current': []}
    equity = {'USD': 0, 'MXN': 0, 'accounts': []}
    
    for row in rows:
        balance_usd = float(row['balance_usd'])
        balance_mxn = float(row['balance_mxn'])
        
        # Skip accounts with zero balance in both currencies
        if abs(balance_usd) < 0.01 and abs(balance_mxn) < 0.01:
            continue
        
        account_data = {
            'code': row['account_code'],
            'name': row['account_name'],
            'subtype': row['account_subtype'],
            'balance_usd': balance_usd,
            'balance_mxn': balance_mxn
        }
        
        if row['account_type'] == 'Asset':
            assets['USD'] += account_data['balance_usd']
            assets['MXN'] += account_data['balance_mxn']
            if row['account_subtype'] in current_asset_subtypes:
                assets['current'].append(account_data)
            else:
                assets['non_current'].append(account_data)
                
        elif row['account_type'] == 'Liability':
            liabilities['USD'] += account_data['balance_usd']
            liabilities['MXN'] += account_data['balance_mxn']
            if row['account_subtype'] in ['AP', 'Current Liability', 'Line of Credit', 'Credit Line']:
                liabilities['current'].append(account_data)
            else:
                liabilities['non_current'].append(account_data)
                
        elif row['account_type'] == 'Equity':
            equity['USD'] += account_data['balance_usd']
            equity['MXN'] += account_data['balance_mxn']
            equity['accounts'].append(account_data)
    
    # Add current period net income to equity
    equity['USD'] += net_income_usd
    equity['MXN'] += net_income_mxn
    equity['accounts'].append({
        'code': '',
        'name': 'Current Period Net Income',
        'subtype': 'Net Income',
        'balance_usd': net_income_usd,
        'balance_mxn': net_income_mxn
    })
    
    # Format based on currency
    if currency == "USD":
        # Convert MXN to USD for consolidated view
        assets_total = assets['USD'] + assets['MXN'] / float(exchange_rate)
        liabilities_total = liabilities['USD'] + liabilities['MXN'] / float(exchange_rate)
        equity_total = equity['USD'] + equity['MXN'] / float(exchange_rate)
        
        for account in assets['current'] + assets['non_current'] + liabilities['current'] + liabilities['non_current'] + equity['accounts']:
            account['balance_usd'] += account['balance_mxn'] / float(exchange_rate)
            account['balance_mxn'] = 0
        
        # Calculate FX gain/loss — the difference caused by converting at different rates
        fx_gain_loss = assets_total - (liabilities_total + equity_total)
        fx_gain_loss = round(fx_gain_loss, 2)
        
        if abs(fx_gain_loss) >= 0.01:
            equity['accounts'].append({
                'code': '',
                'name': 'Unrealized FX Gain/Loss',
                'subtype': 'FX Adjustment',
                'balance_usd': fx_gain_loss,
                'balance_mxn': 0
            })
            equity_total += fx_gain_loss
        
        total_liabilities_equity = liabilities_total + equity_total
        is_balanced = abs(assets_total - total_liabilities_equity) < 0.01
        
        return {
            'as_of_date': as_of_date,
            'currency': 'USD',
            'exchange_rate': float(exchange_rate),
            'assets': {
                'current': assets['current'],
                'non_current': assets['non_current'],
                'total': round(assets_total, 2)
            },
            'liabilities': {
                'current': liabilities['current'],
                'non_current': liabilities['non_current'],
                'total': round(liabilities_total, 2)
            },
            'equity': {
                'accounts': equity['accounts'],
                'total': round(equity_total, 2)
            },
            'total_liabilities_equity': round(total_liabilities_equity, 2),
            'is_balanced': is_balanced,
            'balance_difference': round(assets_total - total_liabilities_equity, 2)
        }
    
    elif currency == "MXN":
        # Convert USD to MXN for consolidated view
        assets_total = assets['MXN'] + assets['USD'] * float(exchange_rate)
        liabilities_total = liabilities['MXN'] + liabilities['USD'] * float(exchange_rate)
        equity_total = equity['MXN'] + equity['USD'] * float(exchange_rate)
        
        for account in assets['current'] + assets['non_current'] + liabilities['current'] + liabilities['non_current'] + equity['accounts']:
            account['balance_mxn'] += account['balance_usd'] * float(exchange_rate)
            account['balance_usd'] = 0
        
        # Calculate FX gain/loss
        fx_gain_loss = assets_total - (liabilities_total + equity_total)
        fx_gain_loss = round(fx_gain_loss, 2)
        
        if abs(fx_gain_loss) >= 0.01:
            equity['accounts'].append({
                'code': '',
                'name': 'Unrealized FX Gain/Loss',
                'subtype': 'FX Adjustment',
                'balance_usd': 0,
                'balance_mxn': fx_gain_loss
            })
            equity_total += fx_gain_loss
        
        total_liabilities_equity = liabilities_total + equity_total
        is_balanced = abs(assets_total - total_liabilities_equity) < 0.01
        
        return {
            'as_of_date': as_of_date,
            'currency': 'MXN',
            'exchange_rate': float(exchange_rate),
            'assets': {
                'current': assets['current'],
                'non_current': assets['non_current'],
                'total': round(assets_total, 2)
            },
            'liabilities': {
                'current': liabilities['current'],
                'non_current': liabilities['non_current'],
                'total': round(liabilities_total, 2)
            },
            'equity': {
                'accounts': equity['accounts'],
                'total': round(equity_total, 2)
            },
            'total_liabilities_equity': round(total_liabilities_equity, 2),
            'is_balanced': is_balanced,
            'balance_difference': round(assets_total - total_liabilities_equity, 2)
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
    

# ========================================
# QUOTING MODULE
# ========================================
#
# A quote is a header (client, currency, validity, terms) plus line items.
# Line items are either:
#   'bus'    - a unit from inventory, priced. These become sales on acceptance.
#   'charge' - transport, import/customs, prep, warranty extension, etc.
#              A negative unit_price makes it a discount line.
#
# Lifecycle: Draft -> Sent -> Accepted | Rejected | Expired | Cancelled
# Accepting a quote records a sale for every bus line (reusing /api/sales/record
# so revenue and COGS postings stay identical to a manually recorded sale) and
# auto-cancels any other open quote holding the same units.

QUOTE_STATUSES = ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Cancelled')
QUOTE_OPEN_STATUSES = ('Draft', 'Sent')
QUOTE_EDITABLE_STATUSES = ('Draft', 'Sent', 'Expired')
QUOTE_CONVERTIBLE_STATUSES = ('Draft', 'Sent', 'Expired')

TWO_PLACES = Decimal('0.01')


def _dump(model, exclude_unset: bool = False) -> dict:
    """Pydantic v1/v2 compatible model -> dict."""
    if hasattr(model, 'model_dump'):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


def _dec(value, default='0') -> Decimal:
    """Coerce anything numeric-ish to Decimal without float drift."""
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value) -> Decimal:
    return _dec(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


# ==================== QUOTE MODELS ====================

class QuoteLineItemIn(BaseModel):
    line_type: str = 'bus'
    inventory_id: Optional[int] = None
    description: Optional[str] = None
    quantity: Decimal = Decimal('1')
    unit_price: Decimal = Decimal('0')
    notes: Optional[str] = None


class QuoteCreate(BaseModel):
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_company: Optional[str] = None
    client_contact: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_location: Optional[str] = None
    client_tax_id: Optional[str] = None
    billing_address: Optional[str] = None

    quote_date: Optional[date] = None
    valid_until: Optional[date] = None
    validity_days: Optional[int] = None      # alternative to valid_until

    currency: str = 'USD'
    discount_amount: Decimal = Decimal('0')
    tax_rate: Decimal = Decimal('0')
    deposit_percent: Optional[Decimal] = None
    deposit_required: Optional[Decimal] = None

    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    warranty_terms: Optional[str] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None

    # Shown under "Elaborado por" on the printed quote. Defaults to the signed-in
    # user's name when not supplied.
    prepared_by_name: Optional[str] = None
    prepared_by_phone: Optional[str] = None
    prepared_by_email: Optional[str] = None

    line_items: List[QuoteLineItemIn] = []


class QuoteUpdate(BaseModel):
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_company: Optional[str] = None
    client_contact: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_location: Optional[str] = None
    client_tax_id: Optional[str] = None
    billing_address: Optional[str] = None

    quote_date: Optional[date] = None
    valid_until: Optional[date] = None
    currency: Optional[str] = None
    discount_amount: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    deposit_percent: Optional[Decimal] = None
    deposit_required: Optional[Decimal] = None

    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    warranty_terms: Optional[str] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None

    prepared_by_name: Optional[str] = None
    prepared_by_phone: Optional[str] = None
    prepared_by_email: Optional[str] = None

    # None means "leave the existing lines alone"; a list replaces them wholesale.
    line_items: Optional[List[QuoteLineItemIn]] = None


class QuoteStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class QuoteAcceptRequest(BaseModel):
    sale_date: Optional[date] = None
    # 'prorate' spreads charges/tax/discount across the units so the recorded
    # revenue equals the quote total. 'none' records each unit at its line price.
    charge_allocation: str = 'prorate'
    client_id: Optional[int] = None


# ==================== QUOTE HELPERS ====================

async def _expire_stale_quotes(db):
    """Flip Sent quotes past their valid_until date to Expired."""
    await db.execute("""
        UPDATE quotes
        SET status = 'Expired',
            status_reason = COALESCE(status_reason, 'Automatically expired: past valid-until date')
        WHERE is_deleted = FALSE
          AND status = 'Sent'
          AND valid_until IS NOT NULL
          AND valid_until < CURRENT_DATE
    """)


async def _next_quote_number(db) -> str:
    year = date.today().year
    prefix = f"COT-{year}-"
    last = await db.fetchval("""
        SELECT quote_number FROM quotes
        WHERE quote_number LIKE $1
        ORDER BY quote_number DESC
        LIMIT 1
    """, prefix + '%')
    seq = 1
    if last:
        try:
            seq = int(last.rsplit('-', 1)[1]) + 1
        except (IndexError, ValueError):
            seq = await db.fetchval("SELECT COUNT(*) + 1 FROM quotes") or 1
    return f"{prefix}{seq:04d}"


async def _resolve_client_snapshot(db, payload: dict) -> dict:
    """Fill missing client fields from the clients table when client_id is given."""
    client_id = payload.get('client_id')
    if not client_id:
        return payload

    client = await db.fetchrow(
        "SELECT * FROM clients WHERE client_id = $1 AND is_deleted = FALSE", client_id
    )
    if not client:
        raise HTTPException(status_code=404, detail=f"Client {client_id} not found")

    mapping = {
        'client_name': 'client_name',
        'client_company': 'client_company',
        'client_location': 'client_location',
        'client_email': 'client_email',
        'client_phone': 'client_phone',
        'client_contact': 'contact_person',
        'client_tax_id': 'tax_id',
        'billing_address': 'billing_address',
    }
    for quote_field, client_field in mapping.items():
        if not payload.get(quote_field):
            payload[quote_field] = client[client_field] if client_field in client else None
    return payload


async def _build_line_rows(db, line_items: List[QuoteLineItemIn]) -> tuple:
    """Validate + snapshot line items. Returns (rows, warnings)."""
    rows = []
    warnings = []
    seen_inventory = set()

    for idx, item in enumerate(line_items, start=1):
        line_type = (item.line_type or 'bus').lower()
        if line_type not in ('bus', 'charge'):
            raise HTTPException(
                status_code=400,
                detail=f"Line {idx}: line_type must be 'bus' or 'charge', got '{item.line_type}'"
            )

        row = {
            'line_number': idx,
            'line_type': line_type,
            'inventory_id': None,
            'stock_number': None, 'vin': None, 'unit_year': None,
            'make': None, 'model': None, 'body_style': None,
            'passenger_capacity': None, 'odometer': None,
            'exterior_color': None, 'engine_make': None, 'engine_model': None,
            'engine_type': None, 'fuel_type': None, 'transmission': None,
            'condition': None,
            'description': item.description,
            'quantity': _dec(item.quantity, '1'),
            'unit_price': _money(item.unit_price),
            'notes': item.notes,
        }

        if line_type == 'bus':
            if not item.inventory_id:
                raise HTTPException(
                    status_code=400, detail=f"Line {idx}: a 'bus' line requires an inventory_id"
                )
            if item.inventory_id in seen_inventory:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {idx}: unit {item.inventory_id} appears more than once on this quote"
                )
            seen_inventory.add(item.inventory_id)

            bus = await db.fetchrow("""
                SELECT inventory_id, stock_number, vin, year, make, model, body_style,
                       passenger_capacity, odometer, asking_price, asking_currency,
                       exterior_color, engine_make, engine_model, engine_type,
                       fuel_type, transmission, condition,
                       is_sold, status
                FROM inventory
                WHERE inventory_id = $1 AND is_deleted = FALSE
            """, item.inventory_id)
            if not bus:
                raise HTTPException(
                    status_code=404, detail=f"Line {idx}: inventory unit {item.inventory_id} not found"
                )
            if bus['is_sold']:
                warnings.append(
                    f"{bus['stock_number']} is already marked sold — this quote cannot be converted "
                    f"until that changes."
                )

            row.update({
                'inventory_id': bus['inventory_id'],
                'stock_number': bus['stock_number'],
                'vin': bus['vin'],
                'unit_year': bus['year'],
                'make': bus['make'],
                'model': bus['model'],
                'body_style': bus['body_style'],
                'passenger_capacity': bus['passenger_capacity'],
                'odometer': bus['odometer'],
                'exterior_color': bus['exterior_color'],
                'engine_make': bus['engine_make'],
                'engine_model': bus['engine_model'],
                'engine_type': bus['engine_type'],
                'fuel_type': bus['fuel_type'],
                'transmission': bus['transmission'],
                'condition': bus['condition'],
            })
            row['quantity'] = Decimal('1')  # a unit is a unit
            if not row['description']:
                row['description'] = (
                    f"{bus['year'] or ''} {bus['make'] or ''} {bus['model'] or ''}".strip()
                    + f" — Stock {bus['stock_number']}"
                )
            if row['unit_price'] == 0 and bus['asking_price']:
                row['unit_price'] = _money(bus['asking_price'])
        else:
            if not row['description']:
                raise HTTPException(
                    status_code=400, detail=f"Line {idx}: a 'charge' line requires a description"
                )

        rows.append(row)

    return rows, warnings


def _calculate_totals(rows: List[dict], discount_amount, tax_rate) -> dict:
    subtotal = sum((_dec(r['quantity']) * _dec(r['unit_price']) for r in rows), Decimal('0'))
    subtotal = _money(subtotal)
    discount = _money(discount_amount)
    taxable = subtotal - discount
    tax = _money(taxable * _dec(tax_rate) / Decimal('100'))
    return {
        'subtotal': subtotal,
        'discount_amount': discount,
        'tax_rate': _dec(tax_rate),
        'tax_amount': tax,
        'total_amount': _money(taxable + tax),
    }


async def _replace_line_items(db, quote_id: int, rows: List[dict]):
    await db.execute("DELETE FROM quote_line_items WHERE quote_id = $1", quote_id)
    for row in rows:
        await db.execute("""
            INSERT INTO quote_line_items
                (quote_id, line_number, line_type, inventory_id, stock_number, vin,
                 unit_year, make, model, body_style, passenger_capacity, odometer,
                 exterior_color, engine_make, engine_model, engine_type, fuel_type,
                 transmission, condition,
                 description, quantity, unit_price, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                    $20,$21,$22,$23)
        """, quote_id, row['line_number'], row['line_type'], row['inventory_id'],
             row['stock_number'], row['vin'], row['unit_year'], row['make'], row['model'],
             row['body_style'], row['passenger_capacity'], row['odometer'],
             row['exterior_color'], row['engine_make'], row['engine_model'],
             row['engine_type'], row['fuel_type'], row['transmission'], row['condition'],
             row['description'], row['quantity'], row['unit_price'], row['notes'])


async def _load_quote(db, quote_id: int) -> dict:
    quote = await db.fetchrow(
        "SELECT * FROM quotes WHERE quote_id = $1 AND is_deleted = FALSE", quote_id
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    lines = await db.fetch("""
        SELECT li.*, i.is_sold, i.status AS unit_status
        FROM quote_line_items li
        LEFT JOIN inventory i ON i.inventory_id = li.inventory_id
        WHERE li.quote_id = $1
        ORDER BY li.line_number, li.line_id
    """, quote_id)

    result = dict(quote)
    result['line_items'] = [dict(line) for line in lines]
    result['unit_count'] = sum(1 for line in lines if line['line_type'] == 'bus')
    result['is_editable'] = result['status'] in QUOTE_EDITABLE_STATUSES
    result['is_convertible'] = (
        result['status'] in QUOTE_CONVERTIBLE_STATUSES and result['unit_count'] > 0
    )
    return result


# ==================== QUOTE ENDPOINTS ====================

@app.get("/api/quotes")
async def list_quotes(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    search: Optional[str] = None,
    include_lines: bool = False,
    limit: int = 200,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """List quotes, newest first. Stale Sent quotes are expired on the way through."""
    await _expire_stale_quotes(db)

    conditions = ["q.is_deleted = FALSE"]
    values = []

    if status:
        wanted = [s.strip() for s in status.split(',') if s.strip()]
        values.append(wanted)
        conditions.append(f"q.status = ANY(${len(values)})")

    if client_id:
        values.append(client_id)
        conditions.append(f"q.client_id = ${len(values)}")

    if search:
        values.append(f"%{search.lower()}%")
        idx = len(values)
        conditions.append(
            f"(LOWER(q.quote_number) LIKE ${idx} OR LOWER(q.client_name) LIKE ${idx} "
            f"OR LOWER(COALESCE(q.client_company,'')) LIKE ${idx})"
        )

    values.append(limit)

    quotes = await db.fetch(f"""
        SELECT q.*,
               COUNT(li.line_id) FILTER (WHERE li.line_type = 'bus') AS unit_count
        FROM quotes q
        LEFT JOIN quote_line_items li ON li.quote_id = q.quote_id
        WHERE {' AND '.join(conditions)}
        GROUP BY q.quote_id
        ORDER BY q.quote_date DESC, q.quote_id DESC
        LIMIT ${len(values)}
    """, *values)

    results = [dict(q) for q in quotes]

    if include_lines and results:
        ids = [q['quote_id'] for q in results]
        lines = await db.fetch("""
            SELECT * FROM quote_line_items
            WHERE quote_id = ANY($1)
            ORDER BY quote_id, line_number, line_id
        """, ids)
        by_quote = {}
        for line in lines:
            by_quote.setdefault(line['quote_id'], []).append(dict(line))
        for quote in results:
            quote['line_items'] = by_quote.get(quote['quote_id'], [])

    return results


@app.get("/api/quotes/stats/summary")
async def get_quote_stats(db=Depends(get_db), user=Depends(get_current_user)):
    """Counts and open value by status, plus win rate."""
    await _expire_stale_quotes(db)

    rows = await db.fetch("""
        SELECT status, currency, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS value
        FROM quotes
        WHERE is_deleted = FALSE
        GROUP BY status, currency
    """)

    by_status = {}
    for row in rows:
        entry = by_status.setdefault(row['status'], {'count': 0, 'value_usd': 0.0, 'value_mxn': 0.0})
        entry['count'] += row['count']
        key = 'value_mxn' if row['currency'] == 'MXN' else 'value_usd'
        entry[key] += float(row['value'])

    decided = sum(by_status.get(s, {}).get('count', 0) for s in ('Accepted', 'Rejected'))
    accepted = by_status.get('Accepted', {}).get('count', 0)

    return {
        'by_status': by_status,
        'open_count': sum(by_status.get(s, {}).get('count', 0) for s in QUOTE_OPEN_STATUSES),
        'open_value_usd': sum(by_status.get(s, {}).get('value_usd', 0.0) for s in QUOTE_OPEN_STATUSES),
        'open_value_mxn': sum(by_status.get(s, {}).get('value_mxn', 0.0) for s in QUOTE_OPEN_STATUSES),
        'accepted_count': accepted,
        'win_rate': round(accepted / decided * 100, 1) if decided else None,
    }


@app.get("/api/quotes/{quote_id}")
async def get_quote(quote_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """One quote with its line items."""
    await _expire_stale_quotes(db)
    return await _load_quote(db, quote_id)


@app.post("/api/quotes")
async def create_quote(
    quote: QuoteCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Create a quote with its line items. Totals are computed server-side."""
    payload = _dump(quote)
    line_items = quote.line_items or []
    payload.pop('line_items', None)
    validity_days = payload.pop('validity_days', None)

    payload = await _resolve_client_snapshot(db, payload)

    if not payload.get('client_name'):
        raise HTTPException(status_code=400, detail="client_name is required (or pass a client_id)")

    currency = (payload.get('currency') or 'USD').upper()
    if currency not in ('USD', 'MXN'):
        raise HTTPException(status_code=400, detail="currency must be USD or MXN")
    payload['currency'] = currency

    quote_date = payload.get('quote_date') or date.today()
    payload['quote_date'] = quote_date
    if not payload.get('valid_until') and validity_days:
        payload['valid_until'] = quote_date + timedelta(days=validity_days)

    if not payload.get('prepared_by_name'):
        payload['prepared_by_name'] = user.get('full_name') or user['username']
    if not payload.get('prepared_by_email'):
        payload['prepared_by_email'] = user.get('email')

    rows, warnings = await _build_line_rows(db, line_items)
    totals = _calculate_totals(rows, payload.get('discount_amount'), payload.get('tax_rate'))

    deposit_required = payload.get('deposit_required')
    if deposit_required is None and payload.get('deposit_percent'):
        deposit_required = _money(totals['total_amount'] * _dec(payload['deposit_percent']) / Decimal('100'))

    try:
        exchange_rate = await get_exchange_rate(db, 'USD', 'MXN', quote_date)
    except HTTPException:
        exchange_rate = None

    async with db.transaction():
        quote_number = await _next_quote_number(db)

        created = await db.fetchrow("""
            INSERT INTO quotes (
                quote_number, client_id, client_name, client_company, client_contact,
                client_email, client_phone, client_location, client_tax_id, billing_address,
                quote_date, valid_until, currency, exchange_rate, status,
                subtotal, discount_amount, tax_rate, tax_amount, total_amount,
                deposit_required, deposit_percent,
                payment_terms, delivery_terms, warranty_terms, notes, internal_notes,
                prepared_by_name, prepared_by_phone, prepared_by_email,
                created_by
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,'Draft',
                $15,$16,$17,$18,$19,
                $20,$21,
                $22,$23,$24,$25,$26,
                $27,$28,$29,
                $30
            )
            RETURNING *
        """, quote_number, payload.get('client_id'), payload.get('client_name'),
             payload.get('client_company'), payload.get('client_contact'),
             payload.get('client_email'), payload.get('client_phone'),
             payload.get('client_location'), payload.get('client_tax_id'),
             payload.get('billing_address'),
             quote_date, payload.get('valid_until'), currency,
             _dec(exchange_rate) if exchange_rate else None,
             totals['subtotal'], totals['discount_amount'], totals['tax_rate'],
             totals['tax_amount'], totals['total_amount'],
             deposit_required, payload.get('deposit_percent'),
             payload.get('payment_terms'), payload.get('delivery_terms'),
             payload.get('warranty_terms'), payload.get('notes'), payload.get('internal_notes'),
             payload.get('prepared_by_name'), payload.get('prepared_by_phone'),
             payload.get('prepared_by_email'),
             user['username'])

        await _replace_line_items(db, created['quote_id'], rows)

        await log_audit(
            db, user['user_id'], user['username'], 'create', 'quotes', created['quote_id'],
            new_values=dict(created),
            description=(
                f"Created quote {quote_number} for {payload.get('client_name')} — "
                f"{len(rows)} line(s), total {totals['total_amount']} {currency}"
            )
        )

    result = await _load_quote(db, created['quote_id'])
    result['warnings'] = warnings
    return result


@app.put("/api/quotes/{quote_id}")
async def update_quote(
    quote_id: int,
    updates: QuoteUpdate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Update a quote. Only Draft/Sent/Expired quotes can be edited."""
    existing = await _load_quote(db, quote_id)

    if existing['status'] not in QUOTE_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"A {existing['status'].lower()} quote cannot be edited. "
                   f"Duplicate it instead to create a revision."
        )

    payload = _dump(updates, exclude_unset=True)
    new_lines = payload.pop('line_items', None)

    if 'client_id' in payload and payload['client_id']:
        payload = await _resolve_client_snapshot(db, payload)

    if payload.get('currency'):
        payload['currency'] = payload['currency'].upper()
        if payload['currency'] not in ('USD', 'MXN'):
            raise HTTPException(status_code=400, detail="currency must be USD or MXN")

    warnings = []
    if new_lines is not None:
        rows, warnings = await _build_line_rows(
            db, [QuoteLineItemIn(**line) if isinstance(line, dict) else line for line in new_lines]
        )
    else:
        rows = [
            {'quantity': line['quantity'], 'unit_price': line['unit_price']}
            for line in existing['line_items']
        ]

    discount = payload.get('discount_amount', existing['discount_amount'])
    tax_rate = payload.get('tax_rate', existing['tax_rate'])
    totals = _calculate_totals(rows, discount, tax_rate)
    payload.update(totals)

    deposit_percent = payload.get('deposit_percent', existing['deposit_percent'])
    if 'deposit_required' not in payload and deposit_percent:
        payload['deposit_required'] = _money(
            totals['total_amount'] * _dec(deposit_percent) / Decimal('100')
        )

    async with db.transaction():
        set_clauses = []
        values = [quote_id]
        for field, value in payload.items():
            values.append(value)
            set_clauses.append(f"{field} = ${len(values)}")

        updated = await db.fetchrow(f"""
            UPDATE quotes SET {', '.join(set_clauses)}
            WHERE quote_id = $1 AND is_deleted = FALSE
            RETURNING *
        """, *values)

        if new_lines is not None:
            await _replace_line_items(db, quote_id, rows)

        await log_audit(
            db, user['user_id'], user['username'], 'update', 'quotes', quote_id,
            old_values={k: v for k, v in existing.items() if k != 'line_items'},
            new_values=dict(updated),
            description=f"Updated quote {existing['quote_number']}"
        )

    result = await _load_quote(db, quote_id)
    result['warnings'] = warnings
    return result


@app.post("/api/quotes/{quote_id}/status")
async def set_quote_status(
    quote_id: int,
    change: QuoteStatusUpdate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Move a quote through its lifecycle. Use /accept to convert to a sale."""
    new_status = change.status

    if new_status not in QUOTE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {', '.join(QUOTE_STATUSES)}"
        )
    if new_status == 'Accepted':
        raise HTTPException(
            status_code=400,
            detail="Use POST /api/quotes/{quote_id}/accept to accept a quote — "
                   "it records the sale and the accounting entries."
        )

    existing = await _load_quote(db, quote_id)

    if existing['status'] == 'Accepted':
        raise HTTPException(
            status_code=400,
            detail="This quote was already accepted and converted to a sale."
        )
    if existing['status'] == new_status:
        return existing

    sent_at = existing['sent_at']
    responded_at = existing['responded_at']
    if new_status == 'Sent' and not sent_at:
        sent_at = datetime.utcnow()
    if new_status in ('Rejected', 'Cancelled'):
        responded_at = datetime.utcnow()

    updated = await db.fetchrow("""
        UPDATE quotes
        SET status = $2, status_reason = $3, sent_at = $4, responded_at = $5
        WHERE quote_id = $1 AND is_deleted = FALSE
        RETURNING *
    """, quote_id, new_status, change.reason, sent_at, responded_at)

    await log_audit(
        db, user['user_id'], user['username'], 'update', 'quotes', quote_id,
        old_values={'status': existing['status']},
        new_values={'status': new_status},
        description=(
            f"Quote {existing['quote_number']}: {existing['status']} -> {new_status}"
            + (f" ({change.reason})" if change.reason else "")
        )
    )

    return await _load_quote(db, quote_id)


@app.post("/api/quotes/{quote_id}/duplicate")
async def duplicate_quote(
    quote_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Copy a quote into a new Draft — the way to revise a sent or expired quote."""
    source = await _load_quote(db, quote_id)

    async with db.transaction():
        quote_number = await _next_quote_number(db)
        valid_until = None
        if source['valid_until'] and source['quote_date']:
            span = (source['valid_until'] - source['quote_date']).days
            valid_until = date.today() + timedelta(days=span)

        created = await db.fetchrow("""
            INSERT INTO quotes (
                quote_number, revision, client_id, client_name, client_company, client_contact,
                client_email, client_phone, client_location, client_tax_id, billing_address,
                quote_date, valid_until, currency, exchange_rate, status,
                subtotal, discount_amount, tax_rate, tax_amount, total_amount,
                deposit_required, deposit_percent,
                payment_terms, delivery_terms, warranty_terms, notes, internal_notes,
                prepared_by_name, prepared_by_phone, prepared_by_email,
                created_by
            )
            SELECT $2, revision + 1, client_id, client_name, client_company, client_contact,
                   client_email, client_phone, client_location, client_tax_id, billing_address,
                   CURRENT_DATE, $3, currency, exchange_rate, 'Draft',
                   subtotal, discount_amount, tax_rate, tax_amount, total_amount,
                   deposit_required, deposit_percent,
                   payment_terms, delivery_terms, warranty_terms, notes, internal_notes,
                   prepared_by_name, prepared_by_phone, prepared_by_email,
                   $4
            FROM quotes WHERE quote_id = $1
            RETURNING *
        """, quote_id, quote_number, valid_until, user['username'])

        await db.execute("""
            INSERT INTO quote_line_items
                (quote_id, line_number, line_type, inventory_id, stock_number, vin,
                 unit_year, make, model, body_style, passenger_capacity, odometer,
                 exterior_color, engine_make, engine_model, engine_type, fuel_type,
                 transmission, condition,
                 description, quantity, unit_price, notes)
            SELECT $2, line_number, line_type, inventory_id, stock_number, vin,
                   unit_year, make, model, body_style, passenger_capacity, odometer,
                   exterior_color, engine_make, engine_model, engine_type, fuel_type,
                   transmission, condition,
                   description, quantity, unit_price, notes
            FROM quote_line_items WHERE quote_id = $1
            ORDER BY line_number, line_id
        """, quote_id, created['quote_id'])

        await log_audit(
            db, user['user_id'], user['username'], 'create', 'quotes', created['quote_id'],
            description=f"Duplicated quote {source['quote_number']} as {quote_number}"
        )

    return await _load_quote(db, created['quote_id'])


@app.delete("/api/quotes/{quote_id}")
async def delete_quote(
    quote_id: int,
    db=Depends(get_db),
    user=Depends(require_manager_or_admin)
):
    """Soft-delete a quote. Accepted quotes are kept as the record of a sale."""
    existing = await _load_quote(db, quote_id)

    if existing['status'] == 'Accepted':
        raise HTTPException(
            status_code=400,
            detail="An accepted quote is the record behind a sale and cannot be deleted. "
                   "Cancel it instead if it was raised in error."
        )

    await db.execute("UPDATE quotes SET is_deleted = TRUE WHERE quote_id = $1", quote_id)
    await log_audit(
        db, user['user_id'], user['username'], 'delete', 'quotes', quote_id,
        old_values={k: v for k, v in existing.items() if k != 'line_items'},
        description=f"Deleted quote {existing['quote_number']}"
    )
    return {"status": "deleted", "quote_id": quote_id, "quote_number": existing['quote_number']}


@app.post("/api/quotes/{quote_id}/accept")
async def accept_quote(
    quote_id: int,
    request: QuoteAcceptRequest,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Accept a quote and convert every bus line into a recorded sale.

    Runs in one transaction: either all units are sold and the quote is marked
    Accepted, or nothing changes. Other open quotes holding the same units are
    cancelled as superseded.
    """
    await _expire_stale_quotes(db)
    quote = await _load_quote(db, quote_id)

    if quote['status'] == 'Accepted':
        raise HTTPException(status_code=400, detail="This quote has already been accepted.")
    if quote['status'] not in QUOTE_CONVERTIBLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"A {quote['status'].lower()} quote cannot be accepted. "
                   f"Duplicate it to create a fresh quote."
        )

    bus_lines = [line for line in quote['line_items'] if line['line_type'] == 'bus']
    if not bus_lines:
        raise HTTPException(
            status_code=400,
            detail="This quote has no bus line items, so there is nothing to convert into a sale."
        )

    allocation = (request.charge_allocation or 'prorate').lower()
    if allocation not in ('prorate', 'none'):
        raise HTTPException(status_code=400, detail="charge_allocation must be 'prorate' or 'none'")

    sale_date = request.sale_date or date.today()
    client_id = request.client_id or quote['client_id']

    # Every unit must still be available before anything is written.
    unavailable = []
    for line in bus_lines:
        bus = await db.fetchrow(
            "SELECT stock_number, is_sold FROM inventory WHERE inventory_id = $1 AND is_deleted = FALSE",
            line['inventory_id']
        )
        if not bus:
            unavailable.append(f"unit {line['inventory_id']} (no longer in inventory)")
        elif bus['is_sold']:
            unavailable.append(f"{bus['stock_number']} (already sold)")
    if unavailable:
        raise HTTPException(
            status_code=400,
            detail="Cannot accept this quote — " + ", ".join(unavailable)
        )

    # Split the quote total across the units.
    bus_subtotal = sum((_dec(line['line_total']) for line in bus_lines), Decimal('0'))
    sale_prices = {}

    if allocation == 'prorate' and bus_subtotal > 0:
        extras = _dec(quote['total_amount']) - bus_subtotal
        running = Decimal('0')
        for i, line in enumerate(bus_lines):
            if i == len(bus_lines) - 1:
                # last line absorbs the rounding remainder so the sum is exact
                price = _dec(quote['total_amount']) - running
            else:
                share = _dec(line['line_total']) / bus_subtotal
                price = _money(_dec(line['line_total']) + extras * share)
                running += price
            sale_prices[line['line_id']] = _money(price)
    else:
        for line in bus_lines:
            sale_prices[line['line_id']] = _money(line['line_total'])

    sales = []
    async with db.transaction():
        for line in bus_lines:
            sale = await record_sale(
                RecordSaleRequest(
                    inventory_id=line['inventory_id'],
                    sale_price=sale_prices[line['line_id']],
                    sale_currency=quote['currency'],
                    sale_date=sale_date,
                    client_id=client_id,
                    sale_notes=f"Converted from quote {quote['quote_number']}"
                ),
                db=db,
                user=user
            )
            await db.execute(
                "UPDATE inventory SET quote_id = $1 WHERE inventory_id = $2",
                quote_id, line['inventory_id']
            )
            sales.append(sale)

        await db.execute("""
            UPDATE quotes
            SET status = 'Accepted',
                responded_at = CURRENT_TIMESTAMP,
                converted_at = CURRENT_TIMESTAMP,
                converted_sale_date = $2,
                client_id = COALESCE($3, client_id),
                status_reason = $4
            WHERE quote_id = $1
        """, quote_id, sale_date, client_id,
             f"Accepted and converted to {len(sales)} sale(s)")

        # Any other open quote holding one of these units is now dead.
        unit_ids = [line['inventory_id'] for line in bus_lines]
        superseded = await db.fetch("""
            UPDATE quotes
            SET status = 'Cancelled',
                responded_at = CURRENT_TIMESTAMP,
                superseded_by = $1,
                status_reason = $3
            WHERE quote_id <> $1
              AND is_deleted = FALSE
              AND status = ANY($4)
              AND quote_id IN (
                  SELECT DISTINCT quote_id FROM quote_line_items
                  WHERE line_type = 'bus' AND inventory_id = ANY($2)
              )
            RETURNING quote_id, quote_number
        """, quote_id, unit_ids,
             f"Superseded — unit(s) sold on quote {quote['quote_number']}",
             list(QUOTE_OPEN_STATUSES))

        await log_audit(
            db, user['user_id'], user['username'], 'update', 'quotes', quote_id,
            new_values={'status': 'Accepted', 'sale_date': sale_date.isoformat()},
            description=(
                f"Accepted quote {quote['quote_number']} — converted {len(sales)} unit(s) "
                f"totalling {quote['total_amount']} {quote['currency']} "
                f"({allocation} charge allocation)"
            )
        )

    result = await _load_quote(db, quote_id)
    result['sales'] = sales
    result['superseded_quotes'] = [dict(row) for row in superseded]
    result['charge_allocation'] = allocation
    return result


@app.get("/api/quotes/inventory/available")
async def get_quotable_inventory(
    search: Optional[str] = None,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    """Units that can go on a quote, flagged with how many open quotes already hold them."""
    await _expire_stale_quotes(db)

    conditions = ["i.is_deleted = FALSE", "i.is_sold = FALSE"]
    values = []
    if search:
        values.append(f"%{search.lower()}%")
        idx = len(values)
        conditions.append(
            f"(LOWER(i.stock_number) LIKE ${idx} OR LOWER(i.vin) LIKE ${idx} "
            f"OR LOWER(COALESCE(i.make,'')) LIKE ${idx} OR LOWER(COALESCE(i.model,'')) LIKE ${idx})"
        )

    rows = await db.fetch(f"""
        SELECT i.inventory_id, i.stock_number, i.vin, i.year, i.make, i.model,
               i.body_style, i.passenger_capacity, i.odometer, i.status,
               i.asking_price, i.asking_currency, i.minimum_price, i.minimum_currency,
               COUNT(DISTINCT q.quote_id) AS open_quote_count
        FROM inventory i
        LEFT JOIN quote_line_items li
               ON li.inventory_id = i.inventory_id AND li.line_type = 'bus'
        LEFT JOIN quotes q
               ON q.quote_id = li.quote_id AND q.is_deleted = FALSE
              AND q.status IN ('Draft','Sent')
        WHERE {' AND '.join(conditions)}
        GROUP BY i.inventory_id
        ORDER BY i.stock_number
    """, *values)

    return [dict(row) for row in rows]


@app.post("/admin/migrate")
async def run_migrations(user=Depends(require_admin)):
    """Apply every migrations/NNN_*.sql file in filename order. Idempotent."""
    directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
    if not os.path.isdir(directory):
        raise HTTPException(status_code=500, detail=f"Migrations directory not found at {directory}")

    files = sorted(name for name in os.listdir(directory) if name.endswith(".sql"))
    if not files:
        raise HTTPException(status_code=500, detail="No migration files found")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        for name in files:
            with open(os.path.join(directory, name), "r") as f:
                await conn.execute(f.read())
        present = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_name IN ('quotes','quote_line_items')"
        )
        return {
            "status": "success" if present == 2 else "incomplete",
            "migrations_applied": files,
            "tables_present": present,
            "message": "Quoting tables are ready." if present == 2 else "Migration did not complete.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quote migration failed: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
