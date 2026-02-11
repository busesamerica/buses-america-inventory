// Buses America - CLEAN Authenticated System
// Minimal auth wrapper that should work

const { useState, useEffect } = React;

const API_BASE_URL = window.API_BASE_URL || 'https://buses-america.onrender.com';
const API_URL = `${API_BASE_URL}/api`;

// ============= AUTH =============
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

// ============= PLACEHOLDER APP (NO INFINITE LOOP) =============
function InventoryApp() {
  const { user } = useAuth();
  
  console.log('InventoryApp rendering for user:', user?.username);
  
  return (
    <div>
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

      <div style={{padding:'2rem'}}>
        <h2>¡Bienvenido, {user?.full_name}!</h2>
        <p>Tu rol: <strong>{user?.role}</strong></p>
        <div style={{marginTop:'2rem',padding:'2rem',background:'#f5f5f5',borderRadius:'8px'}}>
          <h3>Sistema de Inventario</h3>
          <p>El sistema completo de inventario se integrará aquí.</p>
          <p>Por ahora, la autenticación está funcionando perfectamente:</p>
          <ul>
            <li>✅ Login funcional</li>
            <li>✅ Sesiones guardadas</li>
            <li>✅ Logout funcional</li>
            <li>✅ Información de usuario</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============= MAIN APP =============
function AppContent() {
  const { user, loading } = useAuth();

  console.log('AppContent rendering - user:', user?.username, 'loading:', loading);

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
  console.log('App (Root) rendering');
  
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

window.App = App;
