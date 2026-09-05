// Buses America - Complete Business Management System
// Production-ready with full authentication and Pre-Inspection features
// Version: 2.0 Final - Fully Integrated

const { useState, useEffect } = React;

const API_BASE_URL = window.API_BASE_URL || 'https://buses-america.onrender.com';
const API_URL = `${API_BASE_URL}/api`;

// formatCurrency / formatDate now live in utils.js (loaded before this file
// in index.html) so every screen formats money and dates the same way.

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
      const newInventory = await res.json();
      
      // ADDED: Automatically record purchase payment if payment_account_id provided
      if (data.payment_account_id) {
        try {
          await fetch(`${API_URL}/inventory/${newInventory.inventory_id}/record-purchase-payment`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              payment_account_id: data.payment_account_id,
              payment_date: data.purchase_date
            })
          });
        } catch (err) {
          console.error('Failed to record purchase payment:', err);
          // Don't fail the whole operation if payment recording fails
        }
      }
      
      return newInventory;
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
      const newInventory = await res.json();

      // Automatically record purchase payment if payment_account_id provided.
      // A rejected payment (e.g. the record-purchase-payment currency-mismatch
      // guard) used to only be logged to the console - the caller's success
      // alert fired unconditionally, so nothing ever told the user the
      // payment wasn't actually recorded. Surface it on the returned object
      // instead so the caller can show an honest message.
      if (additionalData.payment_account_id) {
        try {
          const paymentRes = await fetch(`${API_URL}/inventory/${newInventory.inventory_id}/record-purchase-payment`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              payment_account_id: additionalData.payment_account_id,
              payment_date: additionalData.purchase_date
            })
          });
          if (!paymentRes.ok) {
            const err = await paymentRes.json().catch(() => ({}));
            newInventory.payment_recording_error = err.detail || 'Payment recording failed';
          }
        } catch (err) {
          newInventory.payment_recording_error = err.message || 'Payment recording failed';
        }
      }

      return newInventory;
    },
    getCurrentExchangeRate: async () => {
      const res = await fetch(`${API_URL}/exchange-rates/current`, { headers: headers() });
      if (!res.ok) throw new Error('Failed to fetch exchange rate');
      return res.json();
    },
    // CLIENT API METHODS
    getClients: async (filters = {}) => {
      try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`${API_URL}/clients?${params}`, { headers: headers() });
        return res.ok ? await res.json() : [];
      } catch (e) {
        console.error('Error fetching clients:', e);
        return [];
      }
    },
    getClientById: async (id) => {
      const res = await fetch(`${API_URL}/clients/${id}`, { headers: headers() });
      if (!res.ok) return null;
      return res.json();
    },
    createClient: async (data) => {
      const res = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create client');
      return res.json();
    },
    updateClient: async (id, data) => {
      const res = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update client');
      return res.json();
    },
    deleteClient: async (id) => {
      const res = await fetch(`${API_URL}/clients/${id}`, {
        method: 'DELETE',
        headers: headers()
      });
      if (!res.ok) throw new Error('Failed to delete client');
      return res.json();
    },
    getClientSales: async (clientId) => {
      const res = await fetch(`${API_URL}/clients/${clientId}/sales`, { headers: headers() });
      if (!res.ok) return [];
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

  const isMobile = useIsMobile();

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%)',padding:'1rem'}}>
      <div style={{background:'white',padding:isMobile?'2rem 1.5rem':'3rem',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <img src={window.LOGO_PATH||'./logo.png'} alt="Buses America" style={{width:'80px',height:'80px',marginBottom:'1rem'}}/>
          <h1 style={{fontSize:'1.75rem',fontWeight:'700',color:'#1a1a1a',margin:'0 0 0.5rem 0'}}>Buses America</h1>
          <p style={{color:'#666',fontSize:'0.95rem',margin:0}}>Business Management System</p>
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
          <button type="submit" disabled={loading} style={{...buttonStyle('primary','md',loading),width:'100%',padding:'0.875rem'}}>
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

// ============= SUPPLIER FORM =============
function SupplierForm({ onSave, onCancel }) {
  const isMobile = useIsMobile();
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
            
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:'1rem'}}>
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
            
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:'1rem'}}>
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
            
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr 1fr',gap:'1rem'}}>
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
            <button type="submit" disabled={saving} style={{...buttonStyle('primary','md',saving),flex:1}}>
              {saving ? 'Saving...' : '💾 Save Supplier'}
            </button>
            <button type="button" onClick={onCancel} style={{...buttonStyle('outline','md'),flex:1}}>
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
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBusForm, setShowBusForm] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [showInspectionReport, setShowInspectionReport] = useState(false);
  const [showCreateInventoryModal, setShowCreateInventoryModal] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(17.50);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    loadExchangeRate();
  }, []);

  // Refetch every time the Dashboard tab is shown (including the initial
  // mount, since 'dashboard' is the default view), not just once on load.
  // Sales Management and Inventory Management manage their own data and
  // never told this stats/inventory state to refresh, so recording a sale
  // or editing a unit elsewhere used to leave the dashboard showing
  // whatever was true when the app first loaded.
  useEffect(() => {
    if (view === 'dashboard') {
      loadData();
    }
  }, [view]);

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
      const [dashboardData, suppliersData, inspectionsData] = await Promise.all([
        api.getDashboard(),
        api.getSuppliers(),
        api.getPreInspections()
      ]);
      setStats(dashboardData);
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


  const handleSaveSupplier = async (data) => {
    await api.createSupplier(data);
    await loadData();
    setShowSupplierForm(false);
    alert('Supplier added successfully!');
  };

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

  // On mobile the sidebar is an off-canvas drawer (fixed, slid off-screen
  // until opened) instead of the permanent 250px column desktop/tablet get -
  // there was previously no toggle at all, so on a phone it just
  // permanently ate ~250px of a ~375-414px screen with no way to close it.
  const sidebarMobileStyle = isMobile ? {
    position:'fixed', top:0, left:0, bottom:0, zIndex:999,
    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition:'transform 0.25s ease',
    boxShadow: sidebarOpen ? '4px 0 16px rgba(0,0,0,0.35)' : 'none'
  } : {};

  const selectView = (id) => {
    setView(id);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',background:'#f5f5f5'}}>
      {/* Dark overlay behind the drawer on mobile - tapping it closes the
          menu, same click-outside-to-close pattern UserDropdown uses. */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:998}}/>
      )}
      {/* Sidebar */}
      <div style={{width:'250px',background:'#1a1a1a',minHeight:'100vh',display:'flex',flexDirection:'column',...sidebarMobileStyle}}>
        <div style={{padding:'1.5rem',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
          <img src={window.LOGO_PATH||'./logo.png'} alt="Logo" style={{width:'50px',height:'50px',marginBottom:'0.75rem'}}/>
          <div style={{fontSize:'1.1rem',fontWeight:'700',color:'white'}}>Buses America</div>
          <div style={{fontSize:'0.75rem',color:'#FFD700'}}>Business Management System</div>
        </div>

        <nav style={{flex:1,padding:'1rem'}}>
          {[
            {id:'dashboard',label:'Dashboard',icon:'📊'},
            {id:'inventory',label:'Inventory',icon:'🚌'},
            {id:'suppliers',label:'Suppliers',icon:'🏢'},
            {id:'pre-inspections',label:'Pre-Inspections',icon:'🔍'},
            {id:'sales',label:'Sales Management',icon:'💰'},
            {id:'clients',label:'Clients',icon:'👥'},
            {id:'quotes',label:'Quotes',icon:'📄'},
            {id:'accounting',label:'Accounting',icon:'💼'}
          ].map(item => (
            <button
              key={item.id}
              onClick={() => selectView(item.id)}
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
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        <div style={{background:'white',padding:isMobile?'1rem':'1rem 2rem',borderBottom:'1px solid #ddd',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.75rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem',minWidth:0}}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" style={{background:'none',border:'1px solid #ddd',borderRadius:'6px',fontSize:'1.25rem',lineHeight:1,padding:'0.4rem 0.65rem',cursor:'pointer',flexShrink:0}}>
                ☰
              </button>
            )}
            <h1 style={{margin:0,fontSize:'1.5rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {view === 'dashboard' && 'Dashboard'}
              {view === 'inventory' && 'Inventory Management'}
              {view === 'sales' && 'Sales Management'}
              {view === 'pre-inspections' && 'Pre-Inspections'}
              {view === 'suppliers' && 'Suppliers'}
              {view === 'clients' && 'Client Management'}
              {view === 'quotes' && 'Quotes'}
              {view === 'accounting' && 'Accounting Dashboard'}
            </h1>
          </div>
          <UserDropdown />
        </div>

        <div style={{flex:1,overflow:'auto',padding:isMobile?'1rem':'2rem'}}>
          {/* DASHBOARD VIEW */}
          {view === 'dashboard' && (
            <div style={{maxWidth:'1400px'}}>
              {/* Fixed column count, not auto-fit(minmax(250px,1fr)) - auto-fit
                  wrapped the 4th card to its own row below the other
                  three once the content area dropped under ~1080px. Below
                  1024px there isn't room for 4 fixed-width cards either, so
                  step down to 2 columns, then 1 on phones. */}
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':(isTablet?'repeat(2,1fr)':'repeat(4,1fr)'),gap:'1.5rem',marginBottom:'3rem'}}>
                <div style={statCardStyle('blue')}>
                  <div style={STAT_CARD_LABEL_STYLE}>🇺🇸 US Inventory</div>
                  <div style={statCardValueStyle(stats?.us_inventory || 0)}>{stats?.us_inventory || 0}</div>
                  <div style={STAT_CARD_SUBTEXT_STYLE}>units in stock</div>
                </div>
                <div style={statCardStyle('red')}>
                  <div style={STAT_CARD_LABEL_STYLE}>🇲🇽 Mexico Inventory</div>
                  <div style={statCardValueStyle(stats?.mexico_inventory || 0)}>{stats?.mexico_inventory || 0}</div>
                  <div style={STAT_CARD_SUBTEXT_STYLE}>units in stock</div>
                </div>
                <div style={statCardStyle('green')}>
                  <div style={STAT_CARD_LABEL_STYLE}>✅ Available</div>
                  <div style={statCardValueStyle(stats?.available_for_sale || 0)}>{stats?.available_for_sale || 0}</div>
                  <div style={STAT_CARD_SUBTEXT_STYLE}>ready to sell</div>
                </div>
                <div style={statCardStyle('orange')}>
                  <div style={STAT_CARD_LABEL_STYLE}>💰 Total Value</div>
                  <div style={statCardValueStyle(formatCurrency(stats?.total_inventory_value || 0))}>{formatCurrency(stats?.total_inventory_value || 0)}</div>
                  <div style={STAT_CARD_SUBTEXT_STYLE}>inventory value</div>
                </div>
              </div>
              
              <div style={{background:'white',padding:'2rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                  <h3 style={{margin:0}}>Recent Inventory</h3>
                  <button onClick={() => setView('inventory')} style={{...buttonStyle('blue','md'),padding:'0.5rem 1rem'}}>
                    View All →
                  </button>
                </div>
                {(stats?.recent_inventory || []).length === 0 ? (
                  <div style={{textAlign:'center',padding:'3rem',color:'#666'}}>
                    <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🚌</div>
                    <div>No inventory yet</div>
                  </div>
                ) : (
                  <div style={{display:'grid',gap:'1rem'}}>
                    {stats.recent_inventory.map((bus) => (
                      <div key={bus.inventory_id} style={{padding:'1rem',border:'1px solid #ddd',borderRadius:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:'600',fontSize:'1.1rem'}}>{bus.year} {bus.make} {bus.model}</div>
                          <div style={{color:'#666',fontSize:'0.9rem',marginTop:'0.25rem'}}>
                            Stock: {bus.stock_number} | VIN: {bus.vin}
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontWeight:'600',color:'#28a745'}}>{formatCurrency(bus.total_cost_usd)}</div>
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
          {view === 'inventory' && <InventoryManagement />}

          {/* QUOTES VIEW */}
          {view === 'quotes' && <QuoteManagement />}

          {/* SUPPLIERS VIEW */}
          {view === 'suppliers' && (
            <div style={{maxWidth:'1400px'}}>
              <div style={{background:'white',padding:'2rem',borderRadius:'8px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                  <h3 style={{margin:0}}>Suppliers ({suppliers.length})</h3>
                  <button onClick={() => setShowSupplierForm(true)} style={buttonStyle('primary','md')}>
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
                  <button onClick={() => setShowInspectionForm(true)} style={buttonStyle('primary','md')}>
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
                              style={{...buttonStyle('blue','md'),width:'100%',padding:'0.5rem 1rem',marginTop:'0.75rem'}}
                           >
                              📄 View Report
                            </button>
                            {insp.recommendation === 'Approve' && !insp.purchased && (
                              <button
                                onClick={() => {
                                  setSelectedInspection(insp);
                                  setShowCreateInventoryModal(true);
                                }}
                                style={{...buttonStyle('green','md'),width:'100%',padding:'0.5rem 1rem',marginTop:'0.5rem'}}
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

          {/* CLIENTS VIEW */}
          {view === 'clients' && <ClientManagement />}

          {/* SALES REPORTS VIEW */}
          {view === 'sales' && <SalesManagement />}

          {/* ACCOUNTING VIEW */}
          {view === 'accounting' && <AccountingDashboard />} 
        </div>
      </div>

      {/* Modals */}
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
          const created = await api.createInventoryFromInspection(selectedInspection.inspection_id, inventoryData);
          setShowCreateInventoryModal(false);
          setSelectedInspection(null);
          await loadData();
          alert(created.payment_recording_error
            ? `✅ Inventory created, but payment recording failed: ${created.payment_recording_error}. Record it manually from Inventory Management.`
            : '✅ Inventory created successfully from inspection!');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }}
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

