import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ToastContainer, useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { useGameState } from '../../context/GameStateContext';
import { 
  ArrowPathIcon, 
  SignalIcon, 
  SignalSlashIcon, 
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  HomeIcon,
  ChartBarIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

const AppLayout = ({ children, title = 'Admin Panel' }: AppLayoutProps) => {
  const { connectionState, lastError } = useSocket();
  const { gameState, isLoading } = useGameState();
  const { showToast } = useToast();

  // Handle refresh button click
  const handleRefresh = () => {
    if (gameState.sessionId) {
      showToast('Refreshing game state...', 'info');
      window.location.reload();
    } else {
      showToast('No active session to refresh', 'warning');
    }
  };

  // Determine connection status indicator
  const getConnectionStatus = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <div className="flex items-center text-green-500">
            <SignalIcon className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Connected</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center text-yellow-500">
            <SignalIcon className="h-5 w-5 mr-1 animate-pulse" />
            <span className="text-sm font-medium">Connecting...</span>
          </div>
        );
      case 'reconnecting':
        return (
          <div className="flex items-center text-yellow-500">
            <ArrowPathIcon className="h-5 w-5 mr-1 animate-spin" />
            <span className="text-sm font-medium">Reconnecting...</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center text-red-500">
            <SignalSlashIcon className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Disconnected</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="admin-header">
        <div className="flex items-center">
          <QrCodeIcon className="h-8 w-8 mr-2" />
          <h1 className="text-2xl font-bold text-white">Taps Tokens Trivia</h1>
        </div>
        <div className="flex items-center space-x-4">
          {getConnectionStatus()}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-blue-700 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="h-5 w-5 text-white" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md">
          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <Link
                  to="/admin"
                  className="flex items-center p-2 rounded-md hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors"
                >
                  <HomeIcon className="h-5 w-5 mr-2" />
                  <span>Dashboard</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/sessions"
                  className="flex items-center p-2 rounded-md hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors"
                >
                  <QrCodeIcon className="h-5 w-5 mr-2" />
                  <span>Game Sessions</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/stats"
                  className="flex items-center p-2 rounded-md hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors"
                >
                  <ChartBarIcon className="h-5 w-5 mr-2" />
                  <span>Statistics</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/settings"
                  className="flex items-center p-2 rounded-md hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors"
                >
                  <Cog6ToothIcon className="h-5 w-5 mr-2" />
                  <span>Settings</span>
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Content area */}
        <main className="flex-1 p-6">
          {/* Page title */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-blue-800">{title}</h2>
            {gameState.sessionId && (
              <p className="text-gray-600">
                Session ID: <span className="font-mono">{gameState.sessionId}</span>
              </p>
            )}
          </div>

          {/* Error message */}
          {lastError && (
            <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                <span>{lastError}</span>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            // Main content
            <div className={clsx('transition-opacity duration-300', isLoading ? 'opacity-0' : 'opacity-100')}>
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Taps Tokens Trivia
          </p>
          <p className="text-sm text-gray-600">
            {gameState.connectedPlayers ?? 0} active {gameState.connectedPlayers === 1 ? 'player' : 'players'}
          </p>
        </div>
      </footer>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
};

export default AppLayout;
