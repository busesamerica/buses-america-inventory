// Buses America - Minimal Working Inventory with Auth
// Built incrementally to avoid infinite loops

const { useState, useEffect } = React;

const API_BASE_URL = window.API_BASE_URL || 'https://buses-america.onrender.com';
const API_URL = `${API_BASE_URL}/api`;

// ============= UTILITY FUNCTIONS =============
const formatCurrency = (amount, currency = 'USD') => {
  if (!amount && amount !== 0) return currency === 'USD' ? '$0.00' : 'MXN $0.00';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

// ============= AUTH CONTEXT =============
const AuthContext = React.createContext(null);

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be within AuthProvider');
  return context;
};

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
        console.error('Error loading saved session:', e);
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

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

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
      } catch (e) {
        console.error('Logout error:', e);
      }
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

// ============= API WITH AUTH =============
const createApi = () => {
  const getAuthHeaders = () => {
    const token = localStorage.getItem('session_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  return {
    async getDashboard() {
      const response = await fetch(`${API_URL}/reports/dashboard`);
      return response.json();
    },
    
    async getInventory(filters = {}) {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_URL}/inventory?${params}`);
      return response.json();
    },
    
    async createInventory(data) {
      const response = await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create');
      return response.json();
    }
  };
};

const api = createApi();

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
      <button onClick={()=>setIsOpen(!isOpen)} style={{display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.5rem 1rem',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'6px',color:'white',cursor:'pointer',fontSize:'0.9rem'}}>
        <span>👤</span>
        <span>{user.full_name}</span>
        <span style={{fontSize:'0.7rem'}}>▼</span>
      </button>

      {isOpen && (
        <div style={{position:'absolute',right:0,top:'100%',marginTop:'0.5rem',background:'white',borderRadius:'6px',boxShadow:'0 4px 12px rgba(0,0,0,0.15)',minWidth:'200px',zIndex:1000}}>
          <div style={{padding:'1rem',borderBottom:'1px solid #eee'}}>
            <div style={{fontSize:'0.9rem',fontWeight:'600',color:'#333'}}>{user.full_name}</div>
            <div style={{fontSize:'0.8rem',color:'#666',marginTop:'0.25rem'}}>{user.email}</div>
            <div style={{fontSize:'0.75rem',color:'#999',marginTop:'0.25rem',textTransform:'uppercase'}}>
              {user.role==='admin'?'👑 Administrador':'👔 Manager'}
            </div>
          </div>
          <button onClick={()=>{setIsOpen(false);logout();}} style={{width:'100%',padding:'0.75rem 1rem',background:'none',border:'none',color:'#c33',textAlign:'left',cursor:'pointer',fontSize:'0.9rem',fontWeight:'500'}}>
            🚪 Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}

// ============= MAIN INVENTORY APP =============
function InventoryApp() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashboardData, inventoryData] = await Promise.all([
        api.getDashboard(),
        api.getInventory()
      ]);
      setStats(dashboardData);
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f5'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'2rem',marginBottom:'1rem'}}>🚌</div>
          <div>Cargando datos...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f5f5'}}>
      {/* Header */}
      <div style={{background:'#1a1a1a',padding:'1rem 2rem',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'3px solid #FFD700'}}>
        <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
          <img src={window.LOGO_PATH||'./logo.png'} alt="Buses America" style={{width:'40px',height:'40px'}}/>
          <div>
            <h1 style={{color:'white',margin:0,fontSize:'1.25rem'}}>Buses America</h1>
            <p style={{color:'#FFD700',margin:0,fontSize:'0.75rem'}}>Sistema de Inventario</p>
          </div>
        </div>
        <UserDropdown />
      </div>

      {/* Main Content */}
      <div style={{padding:'2rem',maxWidth:'1400px',margin:'0 auto'}}>
        <h2 style={{marginBottom:'2rem'}}>Dashboard</h2>
        
        {/* Stats Grid */}
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
            <div style={{fontSize:'0.875rem',color:'#666',marginBottom:'0.5rem'}}>✅ Available for Sale</div>
            <div style={{fontSize:'2rem',fontWeight:'700',color:'#333'}}>{stats?.available_for_sale || 0}</div>
            <div style={{fontSize:'0.875rem',color:'#666',marginTop:'0.5rem'}}>ready to sell</div>
          </div>
          
          <div style={{background:'white',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)',borderLeft:'4px solid #ffc107'}}>
            <div style={{fontSize:'0.875rem',color:'#666',marginBottom:'0.5rem'}}>💰 Total Value</div>
            <div style={{fontSize:'2rem',fontWeight:'700',color:'#333'}}>{formatCurrency(stats?.total_inventory_value || 0)}</div>
            <div style={{fontSize:'0.875rem',color:'#666',marginTop:'0.5rem'}}>inventory value</div>
          </div>
        </div>

        {/* Inventory List */}
        <div style={{background:'white',padding:'2rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
            <h3 style={{margin:0}}>Recent Inventory</h3>
            <button 
              onClick={() => setShowAddForm(true)}
              style={{padding:'0.75rem 1.5rem',background:'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer'}}>
              ➕ Add New Bus
            </button>
          </div>
          
          {inventory.length === 0 ? (
            <div style={{textAlign:'center',padding:'3rem',color:'#666'}}>
              <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🚌</div>
              <div>No inventory yet. Click "Add New Bus" to get started!</div>
            </div>
          ) : (
            <div style={{display:'grid',gap:'1rem'}}>
              {inventory.slice(0, 10).map((bus) => (
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

        {/* Add Bus Modal */}
        {showAddForm && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <div style={{background:'white',padding:'2rem',borderRadius:'8px',maxWidth:'600px',width:'90%',maxHeight:'90vh',overflow:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                <h2 style={{margin:0}}>Add New Bus</h2>
                <button onClick={() => setShowAddForm(false)} style={{background:'none',border:'none',fontSize:'1.5rem',cursor:'pointer'}}>×</button>
              </div>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = {
                  stock_number: formData.get('stock_number'),
                  vin: formData.get('vin'),
                  year: parseInt(formData.get('year')),
                  make: formData.get('make'),
                  model: formData.get('model'),
                  passenger_capacity: parseInt(formData.get('passenger_capacity')) || null,
                  purchase_date: formData.get('purchase_date'),
                  purchase_price_usd: parseFloat(formData.get('purchase_price_usd')),
                  status: 'Available',
                  condition: 'Good',
                  current_location: formData.get('current_location') || 'US'
                };
                
                try {
                  await api.createInventory(data);
                  setShowAddForm(false);
                  loadData(); // Reload data
                  alert('Bus added successfully!');
                } catch (error) {
                  alert('Error adding bus: ' + error.message);
                }
              }}>
                <div style={{display:'grid',gap:'1rem'}}>
                  <div>
                    <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Stock Number *</label>
                    <input name="stock_number" required style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                  </div>
                  
                  <div>
                    <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>VIN *</label>
                    <input name="vin" required style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                  </div>
                  
                  <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 2fr',gap:'1rem'}}>
                    <div>
                      <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Year *</label>
                      <input name="year" type="number" required min="1990" max="2030" style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                    </div>
                    <div>
                      <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Make *</label>
                      <input name="make" required style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                    </div>
                    <div>
                      <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Model *</label>
                      <input name="model" required style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Passenger Capacity</label>
                    <input name="passenger_capacity" type="number" min="1" max="99" style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                  </div>
                  
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                    <div>
                      <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Purchase Date *</label>
                      <input name="purchase_date" type="date" required style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                    </div>
                    <div>
                      <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Purchase Price (USD) *</label>
                      <input name="purchase_price_usd" type="number" step="0.01" required min="0" style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}/>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{display:'block',marginBottom:'0.5rem',fontWeight:'500'}}>Location *</label>
                    <select name="current_location" required style={{width:'100%',padding:'0.5rem',border:'1px solid #ddd',borderRadius:'4px'}}>
                      <option value="US">United States</option>
                      <option value="Mexico">Mexico</option>
                    </select>
                  </div>
                </div>
                
                <div style={{display:'flex',gap:'1rem',marginTop:'2rem'}}>
                  <button type="submit" style={{flex:1,padding:'0.75rem',background:'#FFD700',color:'#1a1a1a',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer'}}>
                    💾 Save Bus
                  </button>
                  <button type="button" onClick={() => setShowAddForm(false)} style={{flex:1,padding:'0.75rem',background:'#e0e0e0',color:'#333',border:'none',borderRadius:'6px',fontWeight:'600',cursor:'pointer'}}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= MAIN APP =============
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
