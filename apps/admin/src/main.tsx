import { StrictMode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import './styles/index.css';

// Import context providers
import { SocketProvider } from './context/SocketContext';
import { GameStateProvider } from './context/GameStateContext';
import { ToastProvider } from './context/ToastContext';

// AuthGuard component to protect routes
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Check if admin token exists in localStorage
    const adminToken = localStorage.getItem('adminToken');
    
    // If no token and not already on login page, redirect to login
    if (!adminToken && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [navigate, location]);
  
  return <>{children}</>;
};

// Create root element
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render app with context providers and routing
root.render(
  <StrictMode>
    <ToastProvider>
      <SocketProvider>
        <GameStateProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={
                <AuthGuard>
                  <AdminPage />
                </AuthGuard>
              } />
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </BrowserRouter>
        </GameStateProvider>
      </SocketProvider>
    </ToastProvider>
  </StrictMode>
);
