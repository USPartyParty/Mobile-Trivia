import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SocketProvider } from './context/SocketContext';
import { GameStateProvider } from './context/GameStateContext';
import { ToastProvider } from './context/ToastContext';
// …etc…

// Pages
import HomePage from './pages/HomePage';
import QRDisplayPage from './pages/QRDisplayPage';
import GamePage from './pages/GamePage';
import ResultsPage from './pages/ResultsPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminPage from './pages/AdminPage';

// Layout
import AppLayout from './components/layout/AppLayout';

// Styles
import './styles/index.css';

// Environment variables
const isDevelopment = import.meta.env.DEV;

// Global error handler for uncaught exceptions
if (!isDevelopment) {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Could send to error tracking service here
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Could send to error tracking service here
  });
}

// Root element
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found. Make sure there is a div with id "root" in your HTML.');
}

// Create root using React 18's new API
const root = createRoot(container);

// Render app
root.render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <SocketProvider>
          <GameStateProvider>
            <BrowserRouter>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/qr/:sessionId" element={<QRDisplayPage />} />
                  <Route path="/game/:sessionId" element={<GamePage />} />
                  <Route path="/results/:sessionId" element={<ResultsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/404" element={<NotFoundPage />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </AppLayout>
            </BrowserRouter>
          </GameStateProvider>
        </SocketProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Register service worker for production builds
if ('serviceWorker' in navigator && !isDevelopment) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
