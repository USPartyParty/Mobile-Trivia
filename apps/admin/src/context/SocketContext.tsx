import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from './ToastContext';

// Define types for socket events
interface ServerToAdminEvents {
  'state:update': (data: { fullState: GameState }) => void;
  'session:created': (data: { sessionId: string, qrCodeUrl: string }) => void;
  'error': (data: { message: string }) => void;
}

interface AdminToServerEvents {
  'session:reset': (data: { sessionId: string }) => void;
  'session:create': () => void;
  'session:end': (data: { sessionId: string }) => void;
  'game:start': (data: { sessionId: string }) => void;
  'game:pause': (data: { sessionId: string }) => void;
  'game:resume': (data: { sessionId: string }) => void;
}

// Game state interface
interface GameState {
  sessionId: string;
  status: 'waiting' | 'active' | 'paused' | 'completed';
  players: {
    id: string;
    name: string;
    score: number;
    isActive: boolean;
  }[];
  currentQuestion?: {
    index: number;
    total: number;
    text: string;
    category: string;
    difficulty: string;
    choices: string[];
    timeRemaining?: number;
  };
  leaderboard?: {
    playerName: string;
    score: number;
  }[];
}

// Connection state type
type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

// Socket context interface
interface SocketContextType {
  socket: Socket<ServerToAdminEvents, AdminToServerEvents> | null;
  connectionState: ConnectionState;
  lastError: string | null;
  sessionId: string | null;
  createSession: () => void;
  resetSession: (sessionId: string) => void;
  endSession: (sessionId: string) => void;
  startGame: (sessionId: string) => void;
  pauseGame: (sessionId: string) => void;
  resumeGame: (sessionId: string) => void;
}

// Create context with default values
const SocketContext = createContext<SocketContextType>({
  socket: null,
  connectionState: 'disconnected',
  lastError: null,
  sessionId: null,
  createSession: () => {},
  resetSession: () => {},
  endSession: () => {},
  startGame: () => {},
  pauseGame: () => {},
  resumeGame: () => {},
});

// Provider component
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket<ServerToAdminEvents, AdminToServerEvents> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { showToast } = useToast();

  // Initialize socket connection
  useEffect(() => {
    // Get API URL from environment variable
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    // Create socket connection to admin namespace
    const socketInstance = io(`${API_URL}/admin`, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      auth: {
        // In a real app, you would include admin authentication here
        token: localStorage.getItem('adminToken') || ''
      }
    });

    // Set socket instance
    setSocket(socketInstance);
    setConnectionState('connecting');

    // Connection event handlers
    socketInstance.on('connect', () => {
      setConnectionState('connected');
      showToast('Connected to server', 'success');
    });

    socketInstance.on('disconnect', () => {
      setConnectionState('disconnected');
      showToast('Disconnected from server', 'warning');
    });

    socketInstance.on('connect_error', (err) => {
      setConnectionState('disconnected');
      setLastError(`Connection error: ${err.message}`);
      showToast(`Connection error: ${err.message}`, 'error');
    });

    socketInstance.io.on('reconnect', () => {
      setConnectionState('connected');
      showToast('Reconnected to server', 'success');
    });

    socketInstance.io.on('reconnect_attempt', () => {
      setConnectionState('reconnecting');
    });

    socketInstance.io.on('reconnect_failed', () => {
      setConnectionState('disconnected');
      setLastError('Failed to reconnect');
      showToast('Failed to reconnect to server', 'error');
    });

    // Admin-specific event handlers
    socketInstance.on('session:created', (data) => {
      setSessionId(data.sessionId);
      showToast(`New session created: ${data.sessionId}`, 'success');
    });

    socketInstance.on('error', (data) => {
      setLastError(data.message);
      showToast(`Error: ${data.message}`, 'error');
    });

    // Clean up on unmount
    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [showToast]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (socket && socket.disconnected) {
        socket.connect();
        showToast('Back online, reconnecting...', 'info');
      }
    };

    const handleOffline = () => {
      showToast('Network connection lost', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [socket, showToast]);

  // Admin functions
  const createSession = () => {
    if (socket && connectionState === 'connected') {
      socket.emit('session:create');
    } else {
      showToast('Cannot create session: not connected to server', 'error');
    }
  };

  const resetSession = (sessionId: string) => {
    if (socket && connectionState === 'connected') {
      socket.emit('session:reset', { sessionId });
      showToast(`Resetting session ${sessionId}`, 'info');
    } else {
      showToast('Cannot reset session: not connected to server', 'error');
    }
  };

  const endSession = (sessionId: string) => {
    if (socket && connectionState === 'connected') {
      socket.emit('session:end', { sessionId });
      showToast(`Ending session ${sessionId}`, 'info');
    } else {
      showToast('Cannot end session: not connected to server', 'error');
    }
  };

  const startGame = (sessionId: string) => {
    if (socket && connectionState === 'connected') {
      socket.emit('game:start', { sessionId });
      showToast(`Starting game for session ${sessionId}`, 'info');
    } else {
      showToast('Cannot start game: not connected to server', 'error');
    }
  };

  const pauseGame = (sessionId: string) => {
    if (socket && connectionState === 'connected') {
      socket.emit('game:pause', { sessionId });
      showToast(`Pausing game for session ${sessionId}`, 'info');
    } else {
      showToast('Cannot pause game: not connected to server', 'error');
    }
  };

  const resumeGame = (sessionId: string) => {
    if (socket && connectionState === 'connected') {
      socket.emit('game:resume', { sessionId });
      showToast(`Resuming game for session ${sessionId}`, 'info');
    } else {
      showToast('Cannot resume game: not connected to server', 'error');
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connectionState,
        lastError,
        sessionId,
        createSession,
        resetSession,
        endSession,
        startGame,
        pauseGame,
        resumeGame,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook for using the socket context
export const useSocket = () => useContext(SocketContext);
