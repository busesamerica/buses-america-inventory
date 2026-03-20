// Buses America - Complete Inventory Management System
// Production-ready with full authentication and Pre-Inspection features
// Version: 2.0 Final - Fully Integrated

const { useState, useEffect } = React;

const API_BASE_URL = window.API_BASE_URL || 'https://buses-america.onrender.com';
const API_URL = `${API_BASE_URL}/api`;

// ============= UTILITIES =============
const formatCurrency = (amount, currency = 'USD') => {
  if (!amount && amount !== 0) return currency === 'USD' ? '$0.00' : 'MXN $0.00';
  const roundedAmount = Math.round(amount * 100) / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundedAmount);
  return currency === 'USD' ? `$${formatted}` : `MXN $${formatted}`;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// ============= AUTH =============
const AuthContext = React.createContext(null);
const useAuth = () => React.useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('session_token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error('Invalid credentials');
    const data = await response.json();
    setToken(data.session_token);
    setUser(data.user);
    localStorage.setItem('session_token', data.session_token);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {}
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============= API =============
const api = (() => {
  const headers = () => {
    const token = localStorage.getItem('session_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  return {
    getDashboard: async () => (await fetch(`${API_URL}/reports/dashboard`, {headers: headers()})).json(),
    getInventory: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      return (await fetch(`${API_URL}/inventory?${params}`, {headers: headers()})).json();
    },
    createInventory: async (data) => {
      const res = await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    updateInventory: async (id, data) => {
      const res = await fetch(`${API_URL}/inventory/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    deleteInventory: async (id) => {
      const res = await fetch(`${API_URL}/inventory/${id}`, {
        method: 'DELETE',
        headers: headers()
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    getSuppliers: async () => (await fetch(`${API_URL}/suppliers`, {headers: headers()})).json(),
    createSupplier: async (data) => {
      const res = await fetch(`${API_URL}/suppliers`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create supplier');
      return res.json();
    },
    // PRE-INSPECTION API METHODS
    getPreInspections: async (filters = {}) => {
      try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`${API_URL}/pre-inspections?${params}`, {headers: headers()});
        return res.ok ? await res.json() : [];
      } catch (e) {
        console.error('Error fetching inspections:', e);
        return [];
      }
    },
    createPreInspection: async (data) => {
      const res = await fetch(`${API_URL}/pre-inspections`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create inspection');
      return res.json();
    },
    getPreInspectionById: async (id) => {
      const res = await fetch(`${API_URL}/pre-inspections/${id}`, {headers: headers()});
      if (!res.ok) return null;
      return res.json();
    },
 createInventoryFromInspection: async (inspectionId, additionalData) => {
      const res = await fetch(`${API_URL}/pre-inspections/${inspectionId}/create-inventory`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(additionalData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create inventory');
      }
      return res.json();
    },
    getCurrentExchangeRate: async () => {
      const res = await fetch(`${API_URL}/exchange-rates/current`, { headers: headers() });
      if (!res.ok) throw new Error('Failed to fetch exchange rate');
      return res.json();
    }
  };
})();
// ============= LOGIN PAGE =============
function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%)'}}>
      <div style={{background:'white',padding:'3rem',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <img src={window.LOGO_PATH||'./logo.png'} alt="Buses America" style={{width:'80px',height:'80px',marginBottom:'1rem'}}/>
          <h1 style={{fontSize:'1.75rem',fontWeight:'700',color:'#1a1a1a',margin:'0 0 0.5rem 0'}}>Buses America</h1>
          <p style={{color:'#666',fontSize:'0.95rem',margin:0}}>Sistema de Inventario</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div style={{background:'#fee',color:'#c33',padding:'0.75rem',borderRadius:'6px',marginBottom:'1.5rem',fontSize:'0.9rem',textAlign:'center'}}>{error}</div>}
          <div style={{marginBottom:'1.5rem'}}>
            <label style={{display:'block',marginBottom:'0.5rem',color:'#333',fontSize:'0.9rem',fontWeight:'500'}}>Usuario</label>
            <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} required autoFocus style={{width:'100%',padding:'0.75rem',border:'2px solid #ddd',borderRadius:'6px',fontSize:'1rem'}}/>
          </div>
          <div style={{marginBottom:'2rem'}}>
            <label style={{display:'block',marginBottom:'0.5rem',color:'#333',fontSize:'0.9rem',fontWeight:'500'}}>Contraseña</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required style={{width:'100%',padding:'0.75rem',border:'2px solid #ddd',borderRadius:'6px',fontSize:'1rem'}}/>
          </div>
          <button type="submit" disabled={loading} style={{width:'100%',padding:'0.875rem',background:loading?'#ccc':'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontSize:'1rem',fontWeight:'600',cursor:loading?'not-allowed':'pointer'}}>
            {loading?'Iniciando sesión...':'Iniciar Sesión'}
          </button>
        </form>
        <div style={{marginTop:'2rem',paddingTop:'1.5rem',borderTop:'1px solid #eee',textAlign:'center'}}>
          <p style={{color:'#999',fontSize:'0.85rem',margin:0}}>Juntos Movemos América 🚌</p>
        </div>
      </div>
    </div>
  );
}

// ============= USER DROPDOWN =============
function UserDropdown() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  if (!user) return null;

  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setIsOpen(!isOpen)} style={{display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.5rem 1rem',background:'#1a1a1a',border:'1px solid #444',borderRadius:'6px',color:'white',cursor:'pointer',fontSize:'0.9rem'}}>
        <span>👤</span>
        <span style={{fontWeight:'600'}}>{user.full_name}</span>
        <span style={{fontSize:'0.7rem'}}>▼</span>
      </button>
      {isOpen && (
        <>
          <div onClick={()=>setIsOpen(false)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:999}}/>
          <div style={{position:'absolute',right:0,top:'100%',marginTop:'0.5rem',background:'white',borderRadius:'6px',boxShadow:'0 4px 12px rgba(0,0,0,0.15)',minWidth:'200px',zIndex:1000}}>
            <div style={{padding:'1rem',borderBottom:'1px solid #eee'}}>
              <div style={{fontSize:'0.9rem',fontWeight:'600',color:'#333'}}>{user.full_name}</div>
              <div style={{fontSize:'0.8rem',color:'#666',marginTop:'0.25rem'}}>{user.email}</div>
              <div style={{fontSize:'0.75rem',color:'#999',marginTop:'0.25rem'}}>
                {user.role==='admin'?'👑 Admin':'👔 Manager'}
              </div>
            </div>
            <button onClick={()=>{setIsOpen(false);logout();}} style={{width:'100%',padding:'0.75rem 1rem',background:'none',border:'none',color:'#c33',textAlign:'left',cursor:'pointer',fontSize:'0.9rem',fontWeight:'500'}}>
              🚪 Cerrar Sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============= BUS FORM (ADD/EDIT) =============
function BusForm({ bus, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    stock_number: '',
    vin: '',
    year: new Date().getFullYear(),
    make: '',
    model: '',
    passenger_capacity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price_usd: '',
    current_location: 'United States',
    status: 'Available',
    condition: 'Good'
  });
  
  useEffect(() => {
    if (bus) {
      setFormData({
        ...bus,
        purchase_price_usd: bus.purchase_price_usd || '',
        passenger_capacity: bus.passenger_capacity || '',
        purchase_date: bus.purchase_date ? bus.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0]
      });
    }
  }, [bus]);
  
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...formData,
        year: parseInt(formData.year),
        passenger_capacity: formData.passenger_capacity ? parseInt(formData.passenger_capacity) : null,
        purchase_price_usd: Math.round(parseFloat(formData.purchase_price_usd) * 100) / 100
      };
      await onSave(data);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
  const { name, value } = e.target;
  const updated = { ...formData, [name]: value };
  
  // Auto-generate stock number from VIN
  if (name === 'vin' && value.length >= 6) {
    const last6 = value.slice(-6).toUpperCase();
    updated.stock_number = `BA-${last6}`;
  }
  
  setFormData(updated);
};

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
      <div style={{background:'white',borderRadius:'8px',maxWidth:'700px',width:'100%',maxHeight:'90vh',overflow:'auto'}}>
        <div style={{padding:'1.5rem',borderBottom:'1px solid #ddd',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1}}>
          <h2 style={{margin:0}}>{bus ? 'Edit Bus' : 'Add New Bus'}</h2>
          <button onClick={onCancel} style={{background:'none',border:'none',fontSize:'1.5rem',cursor:'pointer',color:'#666'}}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} style={{padding:'1.5rem'}}>
          <div style={{display:'grid',gap:'1.25rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Stock Number *</label>
                <input name="stock_number" value={formData.stock_number} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>VIN *</label>
                <input name="vin" value={formData.vin} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 2fr',gap:'1rem'}}>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Year *</label>
                <input name="year" type="number" value={formData.year} onChange={handleChange} required min="1990" max="2030" style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Make *</label>
                <input name="make" value={formData.make} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Model *</label>
                <input name="model" value={formData.model} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Capacity</label>
                <input name="passenger_capacity" type="number" value={formData.passenger_capacity} onChange={handleChange} min="1" max="99" style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Purchase Date *</label>
                <input name="purchase_date" type="date" value={formData.purchase_date} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1rem'}}>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Price (USD) *</label>
                <input name="purchase_price_usd" type="number" step="0.01" value={formData.purchase_price_usd} onChange={handleChange} required min="0" style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Location *</label>
                <select name="current_location" value={formData.current_location} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}>
                  <option value="United States">United States</option>
                  <option value="Mexico">Mexico</option>
                </select>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500',fontSize:'0.9rem'}}>Status *</label>
                <select name="status" value={formData.status} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}>
                  <option value="Available">Available</option>
                  <option value="Sold">Sold</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            </div>
          </div>
          
          <div style={{display:'flex',gap:'1rem',marginTop:'2rem',paddingTop:'1.5rem',borderTop:'1px solid #eee'}}>
            <button type="submit" disabled={saving} style={{flex:1,padding:'0.75rem',background:saving?'#ccc':'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontWeight:'600',cursor:saving?'not-allowed':'pointer'}}>
              {saving ? 'Saving...' : (bus ? '💾 Update Bus' : '💾 Save Bus')}
            </button>
            <button type="button" onClick={onCancel} style={{flex:1,padding:'0.75rem',background:'#e0e0e0',color:'#333',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer'}}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============= SUPPLIER FORM =============
function SupplierForm({ onSave, onCancel }) {
  const [formData, setFormData] = useState({
    company_name: '',
    supplier_type: 'Dealer',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'US'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
      <div style={{background:'white',borderRadius:'8px',maxWidth:'600px',width:'100%',maxHeight:'90vh',overflow:'auto'}}>
        <div style={{padding:'1.5rem',borderBottom:'1px solid #ddd',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2 style={{margin:0}}>Add Supplier</h2>
          <button onClick={onCancel} style={{background:'none',border:'none',fontSize:'1.5rem',cursor:'pointer'}}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} style={{padding:'1.5rem'}}>
          <div style={{display:'grid',gap:'1rem'}}>
            <div>
              <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Company Name *</label>
              <input name="company_name" value={formData.company_name} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Type *</label>
                <select name="supplier_type" value={formData.supplier_type} onChange={handleChange} required style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}>
                <option value="Dealer">Dealer</option>
                <option value="Auction">Auction</option>
                <option value="Private Seller">Private Seller</option>
                <option value="Manufacturer">Manufacturer</option>
                <option value="School District">School District</option>
                <option value="Public School">Public School</option>
                <option value="City Government">City Government</option>
                <option value="County Government">County Government</option>
                <option value="State Government">State Government</option>
              </select>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Contact Person</label>
                <input name="contact_person" value={formData.contact_person} onChange={handleChange} style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Email</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange} style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Phone</label>
                <input name="phone" value={formData.phone} onChange={handleChange} style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
            </div>
            
            <div>
              <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Address</label>
              <input name="address" value={formData.address} onChange={handleChange} style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:'1rem'}}>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>City</label>
                <input name="city" value={formData.city} onChange={handleChange} style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>State</label>
                <input name="state" value={formData.state} onChange={handleChange} style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
              <div>
                <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>ZIP</label>
                <input name="zip_code" value={formData.zip_code} onChange={handleChange} style={{width:'100%',padding:'0.625rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
              </div>
            </div>
          </div>
          
          <div style={{display:'flex',gap:'1rem',marginTop:'2rem'}}>
            <button type="submit" disabled={saving} style={{flex:1,padding:'0.75rem',background:saving?'#ccc':'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontWeight:'600',cursor:saving?'not-allowed':'pointer'}}>
              {saving ? 'Saving...' : '💾 Save Supplier'}
            </button>
            <button type="button" onClick={onCancel} style={{flex:1,padding:'0.75rem',background:'#e0e0e0',color:'#333',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer'}}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============= MAIN INVENTORY APP =============
function InventoryApp() {
  const { user } = useAuth();
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showBusForm, setShowBusForm] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [showInspectionReport, setShowInspectionReport] = useState(false);
  const [showCreateInventoryModal, setShowCreateInventoryModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedBusForCosts, setSelectedBusForCosts] = useState(null);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(17.50);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    loadData();
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async () => {
    try {
      const rate = await api.getCurrentExchangeRate();
      setCurrentExchangeRate(rate.rate);
    } catch (error) {
      console.error('Error loading exchange rate:', error);
    }
  };

  const loadData = async () => {
    try {
      const [dashboardData, inventoryData, suppliersData, inspectionsData] = await Promise.all([
        api.getDashboard(),
        api.getInventory(),
        api.getSuppliers(),
        api.getPreInspections()
      ]);
      setStats(dashboardData);
      setInventory(inventoryData);
      setSuppliers(suppliersData);
      setInspections(inspectionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBus = async (data) => {
    try {
      if (editingBus) {
        await api.updateInventory(editingBus.inventory_id, data);
      } else {
        await api.createInventory(data);
      }
      await loadData();
      setShowBusForm(false);
      setEditingBus(null);
    } catch (error) {
      alert('Error saving: ' + error.message);
    }
  };

  const handleDeleteBus = async (bus) => {
    if (!window.confirm(`Delete ${bus.year} ${bus.make} ${bus.model}?`)) return;
    try {
      await api.deleteInventory(bus.inventory_id);
      await loadData();
      alert('Bus deleted successfully');
    } catch (error) {
      alert('Error deleting bus: ' + error.message);
    }
  };

  const handleSaveCosts = async (costData) => {
    try {
      await api.updateInventory(selectedBusForCosts.inventory_id, costData);
      await loadData();
      setShowCostModal(false);
      setSelectedBusForCosts(null);
      alert('✅ Costs saved successfully!');
    } catch (error) {
      throw new Error(error.message || 'Failed to save costs');
    }
  };

  const handleSaveSupplier = async (data) => {
    await api.createSupplier(data);
    await loadData();
    setShowSupplierForm(false);
    alert('Supplier added successfully!');
  };

  const filteredInventory = inventory.filter(bus => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      bus.stock_number?.toLowerCase().includes(s) ||
      bus.vin?.toLowerCase().includes(s) ||
      bus.make?.toLowerCase().includes(s) ||
      bus.model?.toLowerCase().includes(s) ||
      `${bus.year}`.includes(s)
    );
  });

  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f5'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🚌</div>
          <div style={{fontSize:'1.25rem',color:'#666'}}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',background:'#f5f5f5'}}>
      {/* Sidebar */}
      <div style={{width:'250px',background:'#1a1a1a',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'1.5rem',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
          <img src={window.LOGO_PATH||'./logo.png'} alt="Logo" style={{width:'50px',height:'50px',marginBottom:'0.75rem'}}/>
          <div style={{fontSize:'1.1rem',fontWeight:'700',color:'white'}}>Buses America</div>
          <div style={{fontSize:'0.75rem',color:'#FFD700'}}>Inventory System</div>
        </div>
        
        <nav style={{flex:1,padding:'1rem'}}>
          {[
            {id:'dashboard',label:'Dashboard',icon:'📊'},
            {id:'inventory',label:'Inventory',icon:'🚌'},  
            {id:'suppliers',label:'Suppliers',icon:'🏢'},
            {id:'pre-inspections',label:'Pre-Inspections',icon:'🔍'},
            {id:'sales-reports',label:'Sales Reports',icon:'💰'},
            {id:'accounting',label:'Accounting',icon:'💼'}
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                display:'block',
                width:'100%',
                padding:'0.75rem 1rem',
                marginBottom:'0.5rem',
                background: view === item.id ? 'rgba(255,215,0,0.2)' : 'transparent',
                border: view === item.id ? '1px solid #FFD700' : '1px solid transparent',
                borderRadius:'6px',
                color:'white',
                textAlign:'left',
                cursor:'pointer',
                fontSize:'0.95rem'
              }}
            >
              <span style={{marginRight:'0.75rem'}}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        
        <div style={{padding:'1rem',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
          <div style={{padding:'0.75rem',background:'rgba(255,255,255,0.05)',borderRadius:'6px',fontSize:'0.85rem',color:'white'}}>
            <div style={{color:'#999',fontSize:'0.75rem'}}>Logged in as</div>
            <div style={{fontWeight:'600',marginTop:'0.25rem'}}>{user.full_name}</div>
            <div style={{color:'#FFD700',fontSize:'0.75rem',marginTop:'0.25rem'}}>
              {user.role === 'admin' ? '👑 Admin' : '👔 Manager'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        <div style={{background:'white',padding:'1rem 2rem',borderBottom:'1px solid #ddd',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h1 style={{margin:0,fontSize:'1.5rem'}}>
            {view === 'dashboard' && 'Dashboard'}
            {view === 'inventory' && 'Inventory Management'}
            {view === 'sales-reports' && 'Sales Reports & Analytics'}
            {view === 'pre-inspections' && 'Pre-Inspections'}
            {view === 'suppliers' && 'Suppliers'}
            {view === 'accounting' && 'Accounting Dashboard'}
          </h1>
          <UserDropdown />
        </div>

        <div style={{flex:1,overflow:'auto',padding:'2rem'}}>
          {/* DASHBOARD VIEW */}
          {view === 'dashboard' && (
            <div style={{maxWidth:'1400px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:'1.5rem',marginBottom:'3rem'}}>
                <div style={{background:'white',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)',borderLeft:'4px solid #007bff'}}>
                  <div style={{fontSize:'0.875rem',color:'#666',marginBottom:'0.5rem'}}>🇺🇸 US Inventory</div>
                  <div style={{fontSize:'2rem',fontWeight:'700',color:'#333'}}>{stats?.us_inventory || 0}</div>
                  <div style={{fontSize:'0.875rem',color:'#666',marginTop:'0.5rem'}}>units in stock</div>
                </div>
                <div style={{background:'white',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)',borderLeft:'4px solid #dc3545'}}>
                  <div style={{fontSize:'0.875rem',color:'#666',marginBottom:'0.5rem'}}>🇲🇽 Mexico Inventory</div>
                  <div style={{fontSize:'2rem',fontWeight:'700',color:'#333'}}>{stats?.mexico_inventory || 0}</div>
                  <div style={{fontSize:'0.875rem',color:'#666',marginTop:'0.5rem'}}>units in stock</div>
                </div>
                <div style={{background:'white',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)',borderLeft:'4px solid #28a745'}}>
                  <div style={{fontSize:'0.875rem',color:'#666',marginBottom:'0.5rem'}}>✅ Available</div>
                  <div style={{fontSize:'2rem',fontWeight:'700',color:'#333'}}>{stats?.available_for_sale || 0}</div>
                  <div style={{fontSize:'0.875rem',color:'#666',marginTop:'0.5rem'}}>ready to sell</div>
                </div>
                <div style={{background:'white',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)',borderLeft:'4px solid #ffc107'}}>
                  <div style={{fontSize:'0.875rem',color:'#666',marginBottom:'0.5rem'}}>💰 Total Value</div>
                  <div style={{fontSize:'2rem',fontWeight:'700',color:'#333'}}>{formatCurrency(stats?.total_inventory_value || 0)}</div>
                  <div style={{fontSize:'0.875rem',color:'#666',marginTop:'0.5rem'}}>inventory value</div>
                </div>
              </div>
              
              <div style={{background:'white',padding:'2rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                  <h3 style={{margin:0}}>Recent Inventory</h3>
                  <button onClick={() => setView('inventory')} style={{padding:'0.5rem 1rem',background:'#007bff',color:'white',border:'none',borderRadius:'4px',cursor:'pointer'}}>
                    View All →
                  </button>
                </div>
                {inventory.length === 0 ? (
                  <div style={{textAlign:'center',padding:'3rem',color:'#666'}}>
                    <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🚌</div>
                    <div>No inventory yet</div>
                  </div>
                ) : (
                  <div style={{display:'grid',gap:'1rem'}}>
                    {inventory.slice(0, 5).map((bus) => (
                      <div key={bus.inventory_id} style={{padding:'1rem',border:'1px solid #ddd',borderRadius:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:'600',fontSize:'1.1rem'}}>{bus.year} {bus.make} {bus.model}</div>
                          <div style={{color:'#666',fontSize:'0.9rem',marginTop:'0.25rem'}}>
                            Stock: {bus.stock_number} | VIN: {bus.vin}
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontWeight:'600',color:'#28a745'}}>{formatCurrency(bus.purchase_price_usd)}</div>
                          <div style={{fontSize:'0.875rem',color:'#666',marginTop:'0.25rem'}}>{bus.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INVENTORY VIEW */}
          {view === 'inventory' && (
            <div style={{maxWidth:'1400px'}}>
              <div style={{background:'white',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)',marginBottom:'1.5rem'}}>
                <div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
                  <input
                    type="text"
                    placeholder="🔍 Search by stock#, VIN, make, model, year..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{flex:1,minWidth:'300px',padding:'0.75rem',border:'1px solid #ddd',borderRadius:'6px',fontSize:'1rem'}}
                  />
                  <button onClick={() => setShowBusForm(true)} style={{padding:'0.75rem 1.5rem',background:'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer',whiteSpace:'nowrap'}}>
                    ➕ Add New Bus
                  </button>
                </div>
              </div>

              <div style={{background:'white',padding:'2rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                <h3 style={{marginTop:0,marginBottom:'1.5rem'}}>
                  All Buses ({filteredInventory.length})
                </h3>
                {filteredInventory.length === 0 ? (
                  <div style={{textAlign:'center',padding:'3rem',color:'#666'}}>
                    <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🚌</div>
                    <div>{search ? 'No buses match your search' : 'No inventory yet'}</div>
                  </div>
                ) : (
                  <div style={{display:'grid',gap:'1rem'}}>
                    {filteredInventory.map((bus) => (
                      <div key={bus.inventory_id} style={{padding:'1.25rem',border:'1px solid #ddd',borderRadius:'6px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'0.75rem'}}>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:'700',fontSize:'1.2rem',marginBottom:'0.5rem'}}>
                              {bus.year} {bus.make} {bus.model}
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'0.5rem',color:'#666',fontSize:'0.9rem'}}>
                              <div>📋 Stock: <strong>{bus.stock_number}</strong></div>
                              <div>🔖 VIN: <strong>{bus.vin}</strong></div>
                              <div>👥 Capacity: <strong>{bus.passenger_capacity || 'N/A'}</strong></div>
                              <div>📍 Location: <strong>{bus.current_location}</strong></div>
                              <div>📅 Purchased: <strong>{formatDate(bus.purchase_date)}</strong></div>
                              <div>📊 Status: <strong style={{color:bus.status==='Available'?'#28a745':'#666'}}>{bus.status}</strong></div>
                            </div>
                          </div>
                          <div style={{textAlign:'right',marginLeft:'1rem'}}>
                            <div style={{fontSize:'1.5rem',fontWeight:'700',color:'#28a745',marginBottom:'0.5rem'}}>
                              {formatCurrency(bus.purchase_price_usd)}
                            </div>
                            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                              <button onClick={() => {setEditingBus(bus);setShowBusForm(true);}} style={{padding:'0.5rem 1rem',background:'#007bff',color:'white',border:'none',borderRadius:'4px',fontSize:'0.875rem',cursor:'pointer'}}>
                                ✏️ Edit
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedBusForCosts(bus);
                                  setShowCostModal(true);
                                }} 
                                style={{padding:'0.5rem 1rem',background:'#10b981',color:'white',border:'none',borderRadius:'4px',fontSize:'0.875rem',cursor:'pointer',fontWeight:'600'}}
                              >
                                💰 Costs
                              </button>
                              {user.role === 'admin' && (
                                <button onClick={() => handleDeleteBus(bus)} style={{padding:'0.5rem 1rem',background:'#dc3545',color:'white',border:'none',borderRadius:'4px',fontSize:'0.875rem',cursor:'pointer'}}>
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )} 

          {/* SUPPLIERS VIEW */}
          {view === 'suppliers' && (
            <div style={{maxWidth:'1400px'}}>
              <div style={{background:'white',padding:'2rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                  <h3 style={{margin:0}}>Suppliers ({suppliers.length})</h3>
                  <button onClick={() => setShowSupplierForm(true)} style={{padding:'0.75rem 1.5rem',background:'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer'}}>
                    ➕ Add Supplier
                  </button>
                </div>
                
                {suppliers.length === 0 ? (
                  <div style={{textAlign:'center',padding:'3rem',color:'#666'}}>
                    <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🏢</div>
                    <div>No suppliers yet</div>
                  </div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1.5rem'}}>
                    {suppliers.map((supplier) => (
                      <div key={supplier.supplier_id} style={{padding:'1.5rem',border:'1px solid #ddd',borderRadius:'8px',background:'#fafafa'}}>
                        <div style={{fontWeight:'700',fontSize:'1.1rem',marginBottom:'0.5rem'}}>{supplier.company_name}</div>
                        <div style={{fontSize:'0.875rem',color:'#666',marginBottom:'1rem'}}>
                          <span style={{background:'#e3f2fd',color:'#1976d2',padding:'0.25rem 0.5rem',borderRadius:'4px',fontSize:'0.75rem'}}>
                            {supplier.supplier_type}
                          </span>
                        </div>
                        {supplier.contact_person && (
                          <div style={{fontSize:'0.9rem',marginBottom:'0.25rem'}}>👤 {supplier.contact_person}</div>
                        )}
                        {supplier.email && (
                          <div style={{fontSize:'0.9rem',marginBottom:'0.25rem'}}>📧 {supplier.email}</div>
                        )}
                        {supplier.phone && (
                          <div style={{fontSize:'0.9rem',marginBottom:'0.25rem'}}>📞 {supplier.phone}</div>
                        )}
                        {supplier.city && supplier.state && (
                          <div style={{fontSize:'0.9rem',color:'#666'}}>📍 {supplier.city}, {supplier.state}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PRE-INSPECTIONS VIEW */}
          {view === 'pre-inspections' && (
            <div style={{maxWidth:'1400px'}}>
              <div style={{background:'white',padding:'2rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                  <h3 style={{margin:0}}>Pre-Purchase Inspections ({inspections.length})</h3>
                  <button onClick={() => setShowInspectionForm(true)} style={{padding:'0.75rem 1.5rem',background:'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer'}}>
                    ➕ New Inspection
                  </button>
                </div>
                
                {inspections.length === 0 ? (
                  <div style={{textAlign:'center',padding:'3rem',color:'#666'}}>
                    <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🔍</div>
                    <div>No inspections yet</div>
                    <div style={{fontSize:'0.875rem',marginTop:'0.5rem'}}>Start by creating a pre-purchase inspection</div>
                  </div>
                ) : (
                  <div style={{display:'grid',gap:'1rem'}}>
                    {inspections.map((insp) => (
                      <div key={insp.inspection_id} style={{padding:'1.5rem',border:'1px solid #ddd',borderRadius:'8px',background:'white'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:'700',fontSize:'1.2rem',marginBottom:'0.5rem'}}>
                              {insp.year} {insp.make} {insp.model}
                            </div>
                            <div style={{color:'#666',fontSize:'0.9rem',marginBottom:'0.75rem'}}>
                              VIN: {insp.vin}
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'0.5rem',fontSize:'0.875rem',color:'#666'}}>
                              <div>📅 Inspected: <strong>{formatDate(insp.inspection_date)}</strong></div>
                              <div>👤 Inspector: <strong>{insp.inspector_name || 'N/A'}</strong></div>
                              <div>⭐ Rating: <strong>{insp.overall_rating || 'N/A'}</strong></div>
                              <div>💰 Repair Est: <strong>{formatCurrency(insp.estimated_repair_cost_usd)}</strong></div>
                            </div>
                          </div>
                          <div style={{textAlign:'right',marginLeft:'1rem'}}>
                            <div style={{
                              padding:'0.5rem 1rem',
                              borderRadius:'0.5rem',
                              fontWeight:'600',
                              fontSize:'0.875rem',
                              background: insp.recommendation === 'Approve' ? '#10b981' : insp.recommendation === 'Reject' ? '#ef4444' : '#f59e0b',
                              color: 'white'
                            }}>
                              {insp.recommendation === 'Approve' ? '✅ Approved' : insp.recommendation === 'Reject' ? '❌ Rejected' : '⚠️ Conditional'}
                            </div>
                            {insp.purchased && (
                              <div style={{marginTop:'0.5rem',fontSize:'0.75rem',color:'#3730a3',background:'#e0e7ff',padding:'0.25rem 0.5rem',borderRadius:'0.25rem'}}>
                                ✓ Purchased
                              </div>
                            )}
                            <button 
                              onClick={() => {
                                setSelectedInspection(insp);
                                 setShowInspectionReport(true);
                              }}
                              style={{
                                width:'100%',
                                padding:'0.5rem 1rem',
                                background:'#3b82f6',
                                color:'white',
                                border:'none',
                                borderRadius:'4px',
                                cursor:'pointer',
                                fontSize:'0.875rem',
                                fontWeight:'600',
                                marginTop:'0.75rem'
                              }}
                           >
                              📄 View Report
                            </button>
                            {insp.recommendation === 'Approve' && !insp.purchased && (
                              <button 
                                onClick={() => {
                                  setSelectedInspection(insp);
                                  setShowCreateInventoryModal(true);
                                }}
                                style={{
                                  width:'100%',
                                  padding:'0.5rem 1rem',
                                  background:'#10b981',
                                  color:'white',
                                  border:'none',
                                  borderRadius:'4px',
                                  cursor:'pointer',
                                  fontSize:'0.875rem',
                                  fontWeight:'600',
                                  marginTop:'0.5rem'
                                }}
                              >
                                🚌 Create Inventory
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SALES MANAGEMENT VIEW */}
          {view === 'sales-reports' && <SalesManagement />}

          {/* ACCOUNTING VIEW */}
          {view === 'accounting' && <AccountingDashboard />} 
        </div>
      </div>

      {/* Modals */}
      {showBusForm && (
        <BusForm
          bus={editingBus}
          onSave={handleSaveBus}
          onCancel={() => {setShowBusForm(false);setEditingBus(null);}}
        />
      )}
      {showSupplierForm && (
        <SupplierForm
          onSave={handleSaveSupplier}
          onCancel={() => setShowSupplierForm(false)}
        />
      )}
      {showInspectionForm && (
        <PreInspectionForm
          onClose={() => setShowInspectionForm(false)}
          onSave={async (data) => {
  console.log('onSave called with data:', data);
  try {
    console.log('About to call API...');
    
    // Clean the data - convert empty strings to null
    const cleanedData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === '') {
        cleanedData[key] = null;
      } else {
        cleanedData[key] = value;
      }
    }
    
    console.log('Cleaned data:', cleanedData);
    await api.createPreInspection(cleanedData);
    console.log('API call succeeded!');
    setShowInspectionForm(false);
    
    // Try to reload data, but don't fail if it errors
    try {
      await loadData();
    } catch (reloadError) {
      console.warn('Could not reload data, but inspection was saved:', reloadError);
    }
    
    alert('✅ Inspection saved successfully! Refresh the page to see it.');
  } catch (error) {
    console.error('Error saving:', error);
    alert('Error: ' + error.message);
  }
}}
        />
      )}
      {showInspectionReport && selectedInspection && (
        <PreInspectionReport
          inspection={selectedInspection}
          onClose={() => {
            setShowInspectionReport(false);
            setSelectedInspection(null);
          }}
          onCreateInventory={(insp) => {
      setShowInspectionReport(false);
      setShowCreateInventoryModal(true);
    }}
  />
)}

        {showCreateInventoryModal && selectedInspection && (
    <CreateInventoryModal
      inspection={selectedInspection}
      suppliers={suppliers}
      onClose={() => {
        setShowCreateInventoryModal(false);
        setSelectedInspection(null);
      }}
      onSave={async (inventoryData) => {
        try {
          await api.createInventoryFromInspection(selectedInspection.inspection_id, inventoryData);
          setShowCreateInventoryModal(false);
          setSelectedInspection(null);
          await loadData();
          alert('✅ Inventory created successfully from inspection!');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }}
    />
  )}

  {showCostModal && selectedBusForCosts && (
    <CostManagementModal
      bus={selectedBusForCosts}
      currentExchangeRate={currentExchangeRate}
      onClose={() => {
        setShowCostModal(false);
        setSelectedBusForCosts(null);
      }}
      onSave={handleSaveCosts}
    />
  )}
    </div>
  );
}

// ============= ROOT =============
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1a1a',color:'#FFD700',fontSize:'1.5rem'}}>
        Cargando...
      </div>
    );
  }

  return user ? <InventoryApp /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

window.App = App;

