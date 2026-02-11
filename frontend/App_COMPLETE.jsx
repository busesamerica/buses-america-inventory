// Buses America - Complete Authenticated Inventory System
// Full inventory management with user authentication

const { useState, useEffect } = React;

const API_BASE_URL = window.API_BASE_URL || 'https://buses-america.onrender.com';
const API_URL = `${API_BASE_URL}/api`;

// ============= AUTH CONTEXT =============
const AuthContext = React.createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('session_token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
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
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    setToken(data.session_token);
    setUser(data.user);
    localStorage.setItem('session_token', data.session_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
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
};

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// ============= LOGIN PAGE =============
const LoginPage = () => {
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
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src={window.LOGO_PATH || './logo.png'} 
            alt="Buses America" 
            style={{ width: '80px', height: '80px', marginBottom: '1rem' }}
          />
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 0.5rem 0'
          }}>
            Buses America
          </h1>
          <p style={{ 
            color: '#666',
            fontSize: '0.95rem',
            margin: 0
          }}>
            Sistema de Inventario
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: '#fee',
              color: '#c33',
              padding: '0.75rem',
              borderRadius: '6px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: '#333',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#FFD700'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: '#333',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#FFD700'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#ccc' : '#FFD700',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = '#FFC700')}
            onMouseLeave={(e) => !loading && (e.target.style.background = '#FFD700')}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #eee',
          textAlign: 'center'
        }}>
          <p style={{
            color: '#999',
            fontSize: '0.85rem',
            margin: 0
          }}>
            Juntos Movemos América 🚌
          </p>
        </div>
      </div>
    </div>
  );
};

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

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('session_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// ============= API SERVICE =============
const api = {
  async getExchangeRate() {
    const response = await fetch(`${API_URL}/exchange-rates/current`);
    return response.json();
  },
  
  async getSuppliers() {
    const response = await fetch(`${API_URL}/suppliers`);
    return response.json();
  },
  
  async getInventory(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_URL}/inventory?${params}`);
    return response.json();
  },
  
  async getInventoryItem(id) {
    const response = await fetch(`${API_URL}/inventory/${id}`);
    return response.json();
  },
  
  async createInventory(data) {
    const response = await fetch(`${API_URL}/inventory`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  async updateInventory(id, data) {
    const response = await fetch(`${API_URL}/inventory/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  async getPreInspections() {
    const response = await fetch(`${API_URL}/inspections/pre-purchase`);
    return response.json();
  },
  
  async createPreInspection(data) {
    const response = await fetch(`${API_URL}/inspections/pre-purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  async getWorkPlans(inventoryId) {
    const response = await fetch(`${API_URL}/inventory/${inventoryId}/work-plans`);
    return response.json();
  },
  
  async createWorkPlan(inventoryId, data) {
    const response = await fetch(`${API_URL}/inventory/${inventoryId}/work-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  async getPhotos(inventoryId) {
    const response = await fetch(`${API_URL}/inventory/${inventoryId}/photos`);
    return response.json();
  },
  
  async uploadPhoto(inventoryId, formData) {
    const response = await fetch(`${API_URL}/inventory/${inventoryId}/photos`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },
  
  async getDashboard() {
    const response = await fetch(`${API_URL}/reports/dashboard`);
    return response.json();
  },
  
  async getWarrantyActive() {
    const response = await fetch(`${API_URL}/reports/warranty-active`);
    return response.json();
  }
};

// ============= MAIN APP =============
function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);

  useEffect(() => {
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async () => {
    try {
      const rate = await api.getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error('Error loading exchange rate:', error);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setCurrentView={setCurrentView} exchangeRate={exchangeRate} />;
      case 'inspections':
        return <PreInspectionsList setCurrentView={setCurrentView} />;
      case 'inventory':
        return <InventoryList setCurrentView={setCurrentView} setSelectedInventory={setSelectedInventory} exchangeRate={exchangeRate} />;
      case 'inventory-detail':
        return <InventoryDetail inventory={selectedInventory} setCurrentView={setCurrentView} exchangeRate={exchangeRate} />;
      case 'add-inventory':
        return <AddInventoryForm setCurrentView={setCurrentView} />;
      case 'suppliers':
        return <SuppliersList />;
      default:
        return <Dashboard setCurrentView={setCurrentView} exchangeRate={exchangeRate} />;
    }
  };

  return (
    <div className="app">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} exchangeRate={exchangeRate} />
      <main className="main-content">
        <Header exchangeRate={exchangeRate} />
        {renderView()}
      </main>
    </div>
  );
}

// ============= HEADER =============
function Header({ exchangeRate }) {
  return (
    <div className="app-header">
      <div className="header-brand">
        <span className="brand-flag">🇲🇽</span>
        <div>
          <h1>Buses America</h1>
          <p className="tagline">30 Years of Excellence</p>
        </div>
      </div>
      {exchangeRate && (
        <div className="exchange-rate-display">
          <div className="rate-label">Exchange Rate</div>
          <div className="rate-value">
            1 USD = {parseFloat(exchangeRate.rate).toFixed(2)} MXN
          </div>
          <div className="rate-date">{formatDate(exchangeRate.effective_date)}</div>
        </div>
      )}
    </div>
  );
}

// ============= SIDEBAR =============
function Sidebar({ currentView, setCurrentView, exchangeRate }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'inspections', label: 'Pre-Inspections', icon: '🔍' },
    { id: 'inventory', label: 'Inventory', icon: '🚌' },
    { id: 'add-inventory', label: 'Add Unit', icon: '➕' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏢' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={window.LOGO_PATH || './logo.png'} alt="Buses America" className="logo-image" />
        <div className="logo-text">
          <div className="logo-title">Buses America</div>
          <div className="logo-subtitle">Inventory System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => setCurrentView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-info">
          <div className="info-label">System Status</div>
          <div className="status-indicator">
            <span className="status-dot active"></span>
            <span>Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============= DASHBOARD =============
function Dashboard({ setCurrentView, exchangeRate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading dashboard...</p></div>;

  return (
    <div className="dashboard">
      <div className="page-title">
        <h2>Dashboard Overview</h2>
        <p className="page-subtitle">Real-time inventory and business metrics</p>
      </div>

      <div className="stats-grid">
        <StatCard
          title="US Inventory"
          value={stats?.us_inventory || 0}
          subtitle="units in stock"
          icon="🇺🇸"
          color="--color-us"
          trend="+2 this week"
        />
        <StatCard
          title="Mexico Inventory"
          value={stats?.mexico_inventory || 0}
          subtitle="units in stock"
          icon="🇲🇽"
          color="--color-mexico"
        />
        <StatCard
          title="Available for Sale"
          value={stats?.available_for_sale || 0}
          subtitle="ready to sell"
          icon="✅"
          color="--color-success"
        />
        <StatCard
          title="Sold Pending Delivery"
          value={stats?.sold_pending_delivery || 0}
          subtitle="in transit"
          icon="🚚"
          color="--color-warning"
        />
        <StatCard
          title="Delivered"
          value={stats?.delivered || 0}
          subtitle="completed sales"
          icon="🎯"
          color="--color-delivered"
        />
        <StatCard
          title="Under Warranty"
          value={stats?.under_warranty || 0}
          subtitle="active 60-day coverage"
          icon="🛡️"
          color="--color-warranty"
        />
      </div>

      <div className="dashboard-cards">
        <div className="card financial-card">
          <h3>Financial Overview</h3>
          <div className="financial-stats">
            <div className="financial-item">
              <span className="financial-label">US Inventory Value</span>
              <span className="financial-value">{formatCurrency(stats?.us_inventory_value, 'USD')}</span>
            </div>
            <div className="financial-item">
              <span className="financial-label">Avg Days in Inventory</span>
              <span className="financial-value">{Math.round(stats?.avg_days_in_inventory || 0)} days</span>
            </div>
          </div>
        </div>

        <div className="card quick-actions-card">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button className="action-btn primary" onClick={() => setCurrentView('inspections')}>
              🔍 New Inspection
            </button>
            <button className="action-btn" onClick={() => setCurrentView('add-inventory')}>
              ➕ Add Purchase
            </button>
            <button className="action-btn" onClick={() => setCurrentView('inventory')}>
              📋 View Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color, trend }) {
  return (
    <div className="stat-card" style={{ '--card-color': `var(${color})` }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-subtitle">{subtitle}</div>
        {trend && <div className="stat-trend">{trend}</div>}
      </div>
    </div>
  );
}

// ============= PRE-INSPECTIONS LIST =============
function PreInspectionsList({ setCurrentView }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadInspections();
  }, []);

  const loadInspections = async () => {
    try {
      const data = await api.getPreInspections();
      setInspections(data);
    } catch (error) {
      console.error('Error loading inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading inspections...</p></div>;

  return (
    <div className="inspections-page">
      <div className="page-header">
        <div>
          <h2>Pre-Purchase Inspections</h2>
          <p className="page-subtitle">Inspection reports before purchasing units</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '➕ New Inspection'}
        </button>
      </div>

      {showForm && <PreInspectionForm onSuccess={() => { setShowForm(false); loadInspections(); }} />}

      <div className="inspections-grid">
        {inspections.map(insp => (
          <div key={insp.inspection_id} className={`inspection-card ${insp.recommendation?.toLowerCase()}`}>
            <div className="inspection-header">
              <div className="inspection-date">{formatDate(insp.inspection_date)}</div>
              <div className={`recommendation-badge ${insp.recommendation?.toLowerCase().replace(/\s+/g, '-')}`}>
                {insp.recommendation}
              </div>
            </div>
            <div className="inspection-vehicle">
              <h3>{insp.year} {insp.make} {insp.model}</h3>
              <div className="vehicle-details">
                <span>VIN: {insp.vin}</span>
                <span>{insp.odometer?.toLocaleString()} miles</span>
              </div>
            </div>
            <div className="inspection-ratings">
              <div className="rating-item">
                <span className="rating-label">Engine</span>
                <span className={`rating-value ${insp.engine_condition?.toLowerCase()}`}>
                  {insp.engine_condition}
                </span>
              </div>
              <div className="rating-item">
                <span className="rating-label">Transmission</span>
                <span className={`rating-value ${insp.transmission_condition?.toLowerCase()}`}>
                  {insp.transmission_condition}
                </span>
              </div>
              <div className="rating-item">
                <span className="rating-label">Overall</span>
                <span className={`rating-value ${insp.overall_rating?.toLowerCase()}`}>
                  {insp.overall_rating}
                </span>
              </div>
            </div>
            <div className="inspection-footer">
              <span className="inspector">Inspector: {insp.inspector_name}</span>
              {insp.decision && (
                <span className={`decision-badge ${insp.decision?.toLowerCase()}`}>
                  {insp.decision}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {inspections.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No inspections yet</h3>
          <p>Start by creating a pre-purchase inspection</p>
        </div>
      )}
    </div>
  );
}

// ============= PRE-INSPECTION FORM =============
function PreInspectionForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    vin: '',
    year: new Date().getFullYear() - 5,
    make: '',
    model: '',
    odometer: '',
    inspection_date: new Date().toISOString().split('T')[0],
    inspector_name: '',
    inspection_location: '',
    engine_condition: 'Good',
    engine_starts: true,
    transmission_condition: 'Good',
    transmission_shifts_properly: true,
    overall_rating: 'Good',
    recommendation: 'Approve for Purchase'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createPreInspection(formData);
      alert('Inspection created successfully!');
      onSuccess();
    } catch (error) {
      alert('Error creating inspection');
      console.error(error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <form className="inspection-form card" onSubmit={handleSubmit}>
      <h3>New Pre-Purchase Inspection</h3>
      
      <div className="form-grid">
        <div className="form-group">
          <label>VIN *</label>
          <input name="vin" value={formData.vin} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Year *</label>
          <input type="number" name="year" value={formData.year} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Make *</label>
          <input name="make" value={formData.make} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Model *</label>
          <input name="model" value={formData.model} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Odometer</label>
          <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Inspection Date *</label>
          <input type="date" name="inspection_date" value={formData.inspection_date} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Inspector Name</label>
          <input name="inspector_name" value={formData.inspector_name} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Location</label>
          <input name="inspection_location" value={formData.inspection_location} onChange={handleChange} placeholder="Auction, dealer, etc." />
        </div>
      </div>

      <div className="form-section">
        <h4>Inspection Results</h4>
        <div className="form-grid">
          <div className="form-group">
            <label>Engine Condition</label>
            <select name="engine_condition" value={formData.engine_condition} onChange={handleChange}>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Transmission Condition</label>
            <select name="transmission_condition" value={formData.transmission_condition} onChange={handleChange}>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Overall Rating</label>
            <select name="overall_rating" value={formData.overall_rating} onChange={handleChange}>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Recommendation</label>
            <select name="recommendation" value={formData.recommendation} onChange={handleChange}>
              <option value="Approve for Purchase">Approve for Purchase</option>
              <option value="Conditional">Conditional</option>
              <option value="Reject">Reject</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">Create Inspection</button>
      </div>
    </form>
  );
}

// Export component
// Render the app

// ============= AUTH WRAPPER =============
function AppWithAuth() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1a1a',color:'#FFD700',fontSize:'1.5rem'}}>
        Cargando...
      </div>
    );
  }
  
  return user ? <App /> : <LoginPage />;
}

function Root() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

window.App = Root;
