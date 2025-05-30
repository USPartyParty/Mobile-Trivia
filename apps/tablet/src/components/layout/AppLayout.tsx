import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { 
  SignalIcon, 
  SignalSlashIcon, 
  Cog6ToothIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Main layout component for the tablet app
 * Provides consistent header, footer, and responsive container
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { connectionState, lastError } = useSocket();
  
  // Get current year for copyright
  const currentYear = new Date().getFullYear();
  
  // Get app version from environment variables
  const appVersion = import.meta.env.VITE_APP_VERSION || '0.1.0';
  
  // Determine connection status indicator
  const getConnectionStatus = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <div className="flex items-center text-emerald-600 dark:text-emerald-400">
            <SignalIcon className="w-5 h-5 mr-1" />
            <span className="text-sm font-medium">Connected</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center text-amber-600 dark:text-amber-400">
            <SignalIcon className="w-5 h-5 mr-1 animate-pulse" />
            <span className="text-sm font-medium">Connecting...</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center text-red-600 dark:text-red-400" title={lastError || 'Disconnected'}>
            <SignalSlashIcon className="w-5 h-5 mr-1" />
            <span className="text-sm font-medium">Disconnected</span>
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="flex items-center">
          <Link to="/" className="flex items-center">
            <img 
              src="/logo.svg" 
              alt="Taps Tokens Trivia" 
              className="w-8 h-8 mr-2"
              onError={(e) => {
                // Fallback if logo image is missing
                e.currentTarget.style.display = 'none';
              }}
            />
            <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              Taps Tokens Trivia
            </h1>
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection status */}
          {getConnectionStatus()}
          
          {/* Admin link - hidden in production */}
          {import.meta.env.DEV && (
            <Link 
              to="/admin" 
              className="flex items-center text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
              title="Admin Panel"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </Link>
          )}
          
          {/* Help button */}
          <button 
            className="flex items-center text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
            title="Help"
            onClick={() => {
              // Could show help modal here
              alert('Help functionality coming soon!');
            }}
          >
            <QuestionMarkCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      {/* Main content */}
      <main className="app-content">
        {/* Error display if there's a connection error */}
        {lastError && connectionState === 'disconnected' && (
          <div className="fixed top-[var(--header-height)] left-0 right-0 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-4 py-2 text-sm text-center">
            {lastError}
          </div>
        )}
        
        {/* Page content */}
        {children}
      </main>
      
      {/* Footer */}
      <footer className="app-footer">
        <div className="flex flex-col items-center justify-center w-full text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            &copy; {currentYear} Taps Tokens Trivia. All rights reserved.
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Version {appVersion}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
