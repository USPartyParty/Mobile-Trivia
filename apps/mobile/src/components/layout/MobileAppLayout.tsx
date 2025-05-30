import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import {
  SignalIcon,
  SignalSlashIcon,
  ArrowLeftIcon,
  HomeIcon,
  QrCodeIcon,
  Cog6ToothIcon, // Example for a settings/admin link
} from '@heroicons/react/24/outline';

// Placeholder for a logo, replace with actual SVG or image component
const AppLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-indigo-600 dark:text-indigo-400">
    <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.522c0 .318.22.6.5.707a9.735 9.735 0 0 0 3.25.555 9.707 9.707 0 0 0 5.25-1.533V16.5a.75.75 0 0 0-.75-.75h-.75a.75.75 0 0 0-.75.75v.44a.75.75 0 0 0 .75.75h.75a.75.75 0 0 0 .75-.75V9.81a.75.75 0 0 0-.75-.75h-.75a.75.75 0 0 0-.75.75v.44a.75.75 0 0 0 .75.75h.75a.75.75 0 0 0 .75-.75V4.533Z" />
    <path d="M12.75 20.667V16.5a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v1.445a8.235 8.235 0 0 0 4.75-1.445V3.555a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 14.25 3V12a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75V6.81a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.44a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-3.417Z" />
  </svg>
);

interface MobileAppLayoutProps {
  children: ReactNode;
}

const MobileAppLayout: React.FC<MobileAppLayoutProps> = ({ children }) => {
  const { connectionState, lastError } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const appVersion = import.meta.env.VITE_APP_VERSION || '0.1.0';

  const getConnectionStatusIndicator = () => {
    if (connectionState === 'connected') {
      return (
        <div className="flex items-center text-emerald-500 dark:text-emerald-400" title="Connected">
          <SignalIcon className="w-5 h-5" />
        </div>
      );
    }
    if (connectionState === 'connecting' || connectionState === 'reconnecting') {
      return (
        <div className="flex items-center text-amber-500 dark:text-amber-400 animate-pulse" title={connectionState}>
          <SignalIcon className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="flex items-center text-red-500 dark:text-red-400" title={`Disconnected: ${lastError || 'No connection'}`}>
        <SignalSlashIcon className="w-5 h-5" />
      </div>
    );
  };

  // Determine if back button should be shown
  const canGoBack = location.key !== 'default' && location.pathname !== '/join' && location.pathname !== '/';
  const handleBack = () => navigate(-1);

  return (
    <div className="mobile-app-container bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Header: Fixed, handles safe area top via CSS */}
      <header className="mobile-header bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center h-full">
          {canGoBack ? (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-6 h-6" />
            </button>
          ) : (
            <Link to="/join" className="flex items-center gap-2" aria-label="Home">
              <AppLogo />
            </Link>
          )}
        </div>
        <div className="flex-1 text-center">
          {/* Centered Title (Optional) */}
          {/* <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">Taps Tokens Trivia</span> */}
        </div>
        <div className="flex items-center">
          {getConnectionStatusIndicator()}
          {/* Example for a settings/admin link if needed, hide if not for general users */}
          {/* {import.meta.env.DEV && (
            <Link to="/admin-mobile" className="p-2 ml-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full" aria-label="Admin Settings">
              <Cog6ToothIcon className="w-6 h-6" />
            </Link>
          )} */}
        </div>
      </header>

      {/* Main Content: Handles safe areas and scrolling */}
      <main className="mobile-content flex-grow w-full overflow-y-auto">
        {/* Optional: Error display for critical connection issues */}
        {connectionState === 'disconnected' && lastError && (
          <div className="p-2 text-xs text-center text-white bg-red-600">
            {lastError}
          </div>
        )}
        {children}
      </main>

      {/* Footer Navigation: Fixed, handles safe area bottom via CSS */}
      <footer className="mobile-footer bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <Link
          to="/join"
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-md transition-colors min-h-[var(--mobile-tap-target-size)] ${
            location.pathname.startsWith('/join') || location.pathname === '/'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-300'
          }`}
        >
          <QrCodeIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5 font-medium">Join Game</span>
        </Link>

        {/* Example of another navigation item - can be adapted or removed */}
        <Link
          to="/" // Could be a "Home" or "About" page if one exists for mobile
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-md transition-colors min-h-[var(--mobile-tap-target-size)] ${
            location.pathname === '/some-other-page' // Adjust condition
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-300'
          }`}
        >
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5 font-medium">Home</span>
        </Link>
        
        {/* App Version - subtle display */}
        <div className="absolute bottom-1 right-2 text-[10px] text-slate-400 dark:text-slate-500 opacity-50 select-none">
          v{appVersion}
        </div>
      </footer>
    </div>
  );
};

export default MobileAppLayout;
