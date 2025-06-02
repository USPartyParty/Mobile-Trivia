import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import './styles/index.css';

// Import context providers
import { SocketProvider } from './context/SocketContext';
import { GameStateProvider } from './context/GameStateContext';
import { ToastProvider } from './context/ToastContext';

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
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </BrowserRouter>
        </GameStateProvider>
      </SocketProvider>
    </ToastProvider>
  </StrictMode>
);
