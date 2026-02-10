// Buses America - Main Application Component
// Professional inventory management system

import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = window.API_BASE_URL || 'https://buses-america.onrender.com';
const API_URL = `${API_URL}/api`;

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  async updateInventory(id, data) {
    const response = await fetch(`${API_URL}/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
export default App;
// Buses America - Inventory & Supplier Components
// Part 2 - Add this to App.jsx after the PreInspectionForm component

// ============= INVENTORY LIST =============
function InventoryList({ setCurrentView, setSelectedInventory, exchangeRate }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    current_location: '',
    is_sold: '',
  });

  useEffect(() => {
    loadInventory();
  }, [filters]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      );
      const data = await api.getInventory(cleanFilters);
      setInventory(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = (item) => {
    setSelectedInventory(item);
    setCurrentView('inventory-detail');
  };

  const getStatusColor = (status) => {
    const colors = {
      'Purchased - In Transit to Stock': '#3498db',
      'In Stock (US)': '#27ae60',
      'Sold - Pending Import': '#f39c12',
      'Import/Customs Processing': '#e67e22',
      'In Stock (Mexico)': '#16a085',
      'In Preventive Maintenance': '#9b59b6',
      'Ready for Delivery': '#2ecc71',
      'In Transit to Client': '#3498db',
      'Delivered': '#95a5a6',
    };
    return colors[status] || '#7f8c8d';
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading inventory...</p></div>;

  return (
    <div className="inventory-page">
      <div className="page-header">
        <div>
          <h2>Inventory Management</h2>
          <p className="page-subtitle">{inventory.length} total units</p>
        </div>
        <button className="btn-primary" onClick={() => setCurrentView('add-inventory')}>
          ➕ Add Purchased Unit
        </button>
      </div>

      <div className="filters-bar">
        <select 
          value={filters.status} 
          onChange={(e) => setFilters({...filters, status: e.target.value})}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          <option value="In Stock (US)">In Stock (US)</option>
          <option value="Sold - Pending Import">Sold - Pending Import</option>
          <option value="Import/Customs Processing">Import/Customs Processing</option>
          <option value="In Stock (Mexico)">In Stock (Mexico)</option>
          <option value="In Preventive Maintenance">In Preventive Maintenance</option>
          <option value="Delivered">Delivered</option>
        </select>

        <select 
          value={filters.current_location} 
          onChange={(e) => setFilters({...filters, current_location: e.target.value})}
          className="filter-select"
        >
          <option value="">All Locations</option>
          <option value="US Stock">US Stock</option>
          <option value="Mexico Stock">Mexico Stock</option>
          <option value="In Transit">In Transit</option>
          <option value="Client">Client</option>
        </select>

        <select 
          value={filters.is_sold} 
          onChange={(e) => setFilters({...filters, is_sold: e.target.value})}
          className="filter-select"
        >
          <option value="">Sold & Available</option>
          <option value="false">Available Only</option>
          <option value="true">Sold Only</option>
        </select>
      </div>

      <div className="inventory-grid">
        {inventory.map(item => (
          <div key={item.inventory_id} className="inventory-card" onClick={() => viewDetails(item)}>
            <div className="card-header">
              <div className="stock-badge">{item.stock_number}</div>
              <div 
                className="status-badge" 
                style={{ backgroundColor: getStatusColor(item.status) }}
              >
                {item.status}
              </div>
            </div>

            <div className="card-body">
              <h3 className="vehicle-title">{item.year} {item.make} {item.model}</h3>
              
              <div className="vehicle-specs">
                <div className="spec-item">
                  <span className="spec-icon">🔑</span>
                  <span className="spec-value">{item.vin}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">👥</span>
                  <span className="spec-value">{item.passenger_capacity || 'N/A'} pass</span>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">📏</span>
                  <span className="spec-value">{item.odometer?.toLocaleString() || 'N/A'} mi</span>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">📍</span>
                  <span className="spec-value">{item.current_location}</span>
                </div>
              </div>

              {item.is_sold && (
                <div className="client-info">
                  <div className="client-badge">SOLD</div>
                  <div className="client-name">{item.client_name}</div>
                </div>
              )}
            </div>

            <div className="card-footer">
              <div className="pricing-row">
                <div className="price-group">
                  <span className="price-label">Cost</span>
                  <span className="price-value">{formatCurrency(item.cost_in_us_stock_usd, 'USD')}</span>
                </div>
                {item.asking_price && (
                  <div className="price-group">
                    <span className="price-label">Asking</span>
                    <span className="price-value highlight">{formatCurrency(item.asking_price, item.asking_currency)}</span>
                  </div>
                )}
              </div>
              <div className="meta-info">
                {item.days_in_inventory} days in inventory
              </div>
            </div>
          </div>
        ))}
      </div>

      {inventory.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🚌</div>
          <h3>No inventory found</h3>
          <p>Adjust your filters or add a new unit</p>
        </div>
      )}
    </div>
  );
}

// ============= INVENTORY DETAIL =============
function InventoryDetail({ inventory, setCurrentView, exchangeRate }) {
  const [activeTab, setActiveTab] = useState('details');
  const [workPlans, setWorkPlans] = useState([]);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (inventory) {
      loadWorkPlans();
      loadPhotos();
    }
  }, [inventory]);

  const loadWorkPlans = async () => {
    try {
      const data = await api.getWorkPlans(inventory.inventory_id);
      setWorkPlans(data);
    } catch (error) {
      console.error('Error loading work plans:', error);
    }
  };

  const loadPhotos = async () => {
    try {
      const data = await api.getPhotos(inventory.inventory_id);
      setPhotos(data);
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('photo_type', 'Exterior');

    try {
      await api.uploadPhoto(inventory.inventory_id, formData);
      loadPhotos();
      alert('Photo uploaded successfully!');
    } catch (error) {
      alert('Failed to upload photo');
      console.error(error);
    }
  };

  if (!inventory) return null;

  const getStatusColor = (status) => {
    const colors = {
      'Purchased - In Transit to Stock': '#3498db',
      'In Stock (US)': '#27ae60',
      'Sold - Pending Import': '#f39c12',
      'Import/Customs Processing': '#e67e22',
      'In Stock (Mexico)': '#16a085',
      'In Preventive Maintenance': '#9b59b6',
      'Ready for Delivery': '#2ecc71',
      'In Transit to Client': '#3498db',
      'Delivered': '#95a5a6',
    };
    return colors[status] || '#7f8c8d';
  };

  return (
    <div className="inventory-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={() => setCurrentView('inventory')}>
          ← Back to Inventory
        </button>
        <div className="header-info">
          <h1>{inventory.year} {inventory.make} {inventory.model}</h1>
          <div className="header-meta">
            <span className="stock-number">{inventory.stock_number}</span>
            <span 
              className="status-badge large" 
              style={{ backgroundColor: getStatusColor(inventory.status) }}
            >
              {inventory.status}
            </span>
            {inventory.is_sold && <span className="sold-badge">SOLD</span>}
          </div>
        </div>
      </div>

      <div className="detail-tabs">
        <button 
          className={activeTab === 'details' ? 'active' : ''} 
          onClick={() => setActiveTab('details')}
        >
          📋 Details
        </button>
        <button 
          className={activeTab === 'photos' ? 'active' : ''} 
          onClick={() => setActiveTab('photos')}
        >
          📸 Photos ({photos.length})
        </button>
        <button 
          className={activeTab === 'work-plans' ? 'active' : ''} 
          onClick={() => setActiveTab('work-plans')}
        >
          🗺️ Work Plans ({workPlans.length})
        </button>
        <button 
          className={activeTab === 'financial' ? 'active' : ''} 
          onClick={() => setActiveTab('financial')}
        >
          💰 Financial
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'details' && (
          <div className="details-view">
            <div className="detail-grid">
              <DetailSection title="Vehicle Information">
                <DetailRow label="VIN" value={inventory.vin} />
                <DetailRow label="Year" value={inventory.year} />
                <DetailRow label="Make" value={inventory.make} />
                <DetailRow label="Model" value={inventory.model} />
                <DetailRow label="Bus Type" value={inventory.bus_type} />
                <DetailRow label="Passenger Capacity" value={inventory.passenger_capacity} />
                <DetailRow label="Odometer" value={`${inventory.odometer?.toLocaleString()} miles`} />
                <DetailRow label="Condition" value={inventory.condition} />
                <DetailRow label="Exterior Color" value={inventory.exterior_color} />
                <DetailRow label="Title Status" value={inventory.title_status} />
              </DetailSection>

              <DetailSection title="Purchase Information">
                <DetailRow label="Purchase Date" value={formatDate(inventory.purchase_date)} />
                <DetailRow label="Purchase Price" value={formatCurrency(inventory.purchase_price_usd, 'USD')} />
                <DetailRow label="Purchase Location" value={inventory.purchase_location} />
                <DetailRow label="Cost in US Stock" value={formatCurrency(inventory.cost_in_us_stock_usd, 'USD')} highlight />
                <DetailRow label="Days in Inventory" value={`${inventory.days_in_inventory} days`} />
              </DetailSection>

              {inventory.is_sold && (
                <DetailSection title="Sale Information">
                  <DetailRow label="Client" value={inventory.client_name} />
                  <DetailRow label="Client Location" value={inventory.client_location} />
                  <DetailRow label="Sale Date" value={formatDate(inventory.sale_date)} />
                  <DetailRow label="Sale Price" value={formatCurrency(inventory.sale_price, inventory.sale_currency)} />
                  <DetailRow label="Deposit" value={formatCurrency(inventory.deposit_amount, inventory.deposit_currency)} />
                  <DetailRow label="Payment Status" value={inventory.payment_status} />
                </DetailSection>
              )}

              {inventory.border_crossing && (
                <DetailSection title="Import/Customs">
                  <DetailRow label="Border Crossing" value={inventory.border_crossing} />
                  <DetailRow label="Customs Broker" value={inventory.customs_broker} />
                  <DetailRow label="Import Started" value={formatDate(inventory.import_started_date)} />
                  <DetailRow label="Import Completed" value={formatDate(inventory.import_completed_date)} />
                  <DetailRow label="Import Cost" value={formatCurrency(inventory.import_cost_mxn, 'MXN')} />
                  <DetailRow label="Customs Cost" value={formatCurrency(inventory.customs_cost_mxn, 'MXN')} />
                </DetailSection>
              )}

              {inventory.delivery_date && (
                <DetailSection title="Delivery & Warranty">
                  <DetailRow label="Delivery Date" value={formatDate(inventory.delivery_date)} />
                  <DetailRow label="Delivery Method" value={inventory.delivery_method} />
                  <DetailRow label="Warranty Status" value={inventory.warranty_status} />
                  <DetailRow label="Warranty End Date" value={formatDate(inventory.warranty_end_date)} />
                  {inventory.days_in_warranty > 0 && (
                    <DetailRow label="Days Remaining" value={`${inventory.days_in_warranty} days`} highlight />
                  )}
                </DetailSection>
              )}
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="photos-view">
            <div className="upload-section">
              <input 
                type="file" 
                id="photo-upload" 
                accept="image/*" 
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
              <label htmlFor="photo-upload" className="btn-upload">
                📸 Upload Photo
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="photos-grid">
                {photos.map(photo => (
                  <div key={photo.photo_id} className="photo-item">
                    <img 
                      src={`http://localhost:8000/uploads/inventory/${inventory.inventory_id}/${photo.file_name}`} 
                      alt={photo.caption || 'Bus photo'} 
                    />
                    {photo.is_primary && <div className="primary-badge">Primary</div>}
                    {photo.caption && <div className="photo-caption">{photo.caption}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📸</div>
                <h3>No photos yet</h3>
                <p>Upload photos to showcase this unit</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'work-plans' && (
          <div className="work-plans-view">
            {workPlans.length > 0 ? (
              <div className="work-plans-list">
                {workPlans.map(plan => (
                  <div key={plan.plan_id} className="work-plan-card">
                    <div className="plan-header">
                      <h4>{plan.plan_type} Plan</h4>
                      {plan.completed && <span className="completed-badge">✓ Completed</span>}
                    </div>
                    <div className="plan-details">
                      <DetailRow label="Origin" value={plan.origin_location} />
                      <DetailRow label="Destination" value={plan.destination_location} />
                      <DetailRow label="Distance" value={`${plan.estimated_distance_km} km`} />
                      <DetailRow label="Estimated Days" value={plan.estimated_days} />
                      <DetailRow label="Estimated Cost" value={formatCurrency(plan.estimated_cost, plan.cost_currency)} />
                      {plan.completed && (
                        <>
                          <DetailRow label="Actual Days" value={plan.actual_days} />
                          <DetailRow label="Actual Cost" value={formatCurrency(plan.actual_cost, plan.cost_currency)} />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🗺️</div>
                <h3>No work plans yet</h3>
                <p>Create acquisition or delivery plans</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="financial-view">
            <div className="financial-summary">
              <h3>Cost Breakdown</h3>
              <div className="cost-items">
                <CostRow label="Purchase Price" amount={inventory.purchase_price_usd} currency="USD" />
                <CostRow label="Transport to US Stock" amount={inventory.transport_to_stock_cost_usd} currency="USD" />
                <CostRow label="Initial Reconditioning" amount={inventory.initial_reconditioning_cost_usd} currency="USD" />
                <div className="cost-divider"></div>
                <CostRow label="Cost in US Stock" amount={inventory.cost_in_us_stock_usd} currency="USD" bold />
                
                {inventory.is_sold && (
                  <>
                    <div className="cost-divider"></div>
                    <CostRow label="Preventive Maintenance" amount={inventory.preventive_maintenance_cost} currency={inventory.preventive_maintenance_currency || 'USD'} />
                    <CostRow label="Import Costs" amount={inventory.import_cost_mxn} currency="MXN" />
                    <CostRow label="Customs Costs" amount={inventory.customs_cost_mxn} currency="MXN" />
                    <CostRow label="Transport to Client" amount={inventory.transport_to_client_cost_mxn} currency="MXN" />
                    
                    <div className="cost-divider"></div>
                    <CostRow label="Sale Price" amount={inventory.sale_price} currency={inventory.sale_currency} bold highlight />
                  </>
                )}
              </div>
              
              {exchangeRate && inventory.is_sold && (
                <div className="exchange-note">
                  Exchange Rate Used: 1 USD = {inventory.exchange_rate_used || exchangeRate.rate} MXN
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="detail-section">
      <h3>{title}</h3>
      <div className="section-content">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className={`detail-row ${highlight ? 'highlight' : ''}`}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || 'N/A'}</span>
    </div>
  );
}

function CostRow({ label, amount, currency, bold, highlight }) {
  return (
    <div className={`cost-row ${bold ? 'bold' : ''} ${highlight ? 'highlight' : ''}`}>
      <span className="cost-label">{label}</span>
      <span className="cost-amount">{formatCurrency(amount, currency)}</span>
    </div>
  );
}

// ============= ADD INVENTORY FORM =============
function AddInventoryForm({ setCurrentView }) {
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState({
    stock_number: '',
    vin: '',
    year: new Date().getFullYear(),
    make: '',
    model: '',
    passenger_capacity: '',
    odometer: '',
    condition: 'Used',
    exterior_color: '',
    title_status: 'Clean',
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price_usd: '',
    purchase_location: '',
    asking_price: '',
    asking_currency: 'USD',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const data = await api.getSuppliers();
    setSuppliers(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createInventory(formData);
      alert('Unit added successfully!');
      setCurrentView('inventory');
    } catch (error) {
      alert('Error adding unit');
      console.error(error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="add-inventory-page">
      <div className="page-header">
        <div>
          <h2>Add Purchased Unit</h2>
          <p className="page-subtitle">Record a bus you've already purchased</p>
        </div>
        <button className="btn-secondary" onClick={() => setCurrentView('inventory')}>
          Cancel
        </button>
      </div>

      <form className="inventory-form" onSubmit={handleSubmit}>
        <div className="form-card">
          <h3>Basic Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Stock Number *</label>
              <input name="stock_number" value={formData.stock_number} onChange={handleChange} required />
            </div>
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
              <label>Passenger Capacity</label>
              <input type="number" name="passenger_capacity" value={formData.passenger_capacity} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Odometer</label>
              <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Exterior Color</label>
              <input name="exterior_color" value={formData.exterior_color} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="form-card">
          <h3>Purchase Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Supplier *</label>
              <select name="supplier_id" value={formData.supplier_id} onChange={handleChange} required>
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Purchase Date *</label>
              <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Purchase Price (USD) *</label>
              <input type="number" step="0.01" name="purchase_price_usd" value={formData.purchase_price_usd} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Purchase Location</label>
              <input name="purchase_location" value={formData.purchase_location} onChange={handleChange} placeholder="City, State" />
            </div>
            <div className="form-group">
              <label>Asking Price</label>
              <input type="number" step="0.01" name="asking_price" value={formData.asking_price} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Asking Currency</label>
              <select name="asking_currency" value={formData.asking_currency} onChange={handleChange}>
                <option value="USD">USD</option>
                <option value="MXN">MXN</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => setCurrentView('inventory')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Add Unit
          </button>
        </div>
      </form>
    </div>
  );
}

// ============= SUPPLIERS LIST =============
function SuppliersList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading suppliers...</p></div>;

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <div>
          <h2>Suppliers</h2>
          <p className="page-subtitle">{suppliers.length} total suppliers</p>
        </div>
      </div>

      <div className="suppliers-grid">
        {suppliers.map(supplier => (
          <div key={supplier.supplier_id} className="supplier-card">
            <div className="supplier-header">
              <h3>{supplier.company_name}</h3>
              <span className="supplier-type">{supplier.supplier_type}</span>
            </div>
            <div className="supplier-details">
              {supplier.contact_person && (
                <div className="detail-item">
                  <span className="icon">👤</span>
                  <span>{supplier.contact_person}</span>
                </div>
              )}
              {supplier.email && (
                <div className="detail-item">
                  <span className="icon">📧</span>
                  <span>{supplier.email}</span>
                </div>
              )}
              {supplier.phone && (
                <div className="detail-item">
                  <span className="icon">📞</span>
                  <span>{supplier.phone}</span>
                </div>
              )}
              {supplier.city && supplier.state && (
                <div className="detail-item">
                  <span className="icon">📍</span>
                  <span>{supplier.city}, {supplier.state}</span>
                </div>
              )}
              {supplier.payment_terms && (
                <div className="detail-item">
                  <span className="icon">💳</span>
                  <span>{supplier.payment_terms}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// NOTE: Add these components to the App.jsx file after the PreInspectionForm component
// Make sure to also add the formatCurrency and formatDate functions if they're not already present
