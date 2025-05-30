import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from './ToastContext'; // Assuming ToastContext is available

// Define event types for better type safety (can be shared with tablet or mobile-specific)
export interface ServerToClientEvents {
  // Game flow events
  'player:joined': (data: { playerId: string; name: string; sessionId: string; playerCount: number; status: string; isReconnect?: boolean }) => void;
  'player:new': (data: { playerId: string; name: string; playerCount: number }) => void;
  'player:left': (data: { playerId: string; name: string; remainingPlayers: number }) => void;
  'game:countdown': (data: { seconds: number; message: string }) => void;
  'game:started': (data: { sessionId: string; playerCount: number; totalQuestions: number; settings: any }) => void;
  'game:paused': (data: { sessionId: string; message: string }) => void;
  'game:resumed': (data: { sessionId: string; message: string }) => void;
  'game:complete': (data: { sessionId: string; finalScores: any[]; totalQuestions: number; gameDuration: number }) => void;
  'question': (data: { index: number; totalQuestions: number; text: string; category: string; difficulty: string; choices: string[]; timeLimit: number; askedAt: Date }) => void;
  'answer:result': (data: { correct: boolean; points: number; totalScore: number; correctAnswer: number }) => void;
  'answer:reveal': (data: { questionIndex: number; correctAnswerIndex: number; explanation: string | null }) => void;
  'scores:update': (data: { playerScores: any[]; questionIndex: number; isComplete?: boolean }) => void;
  'game:state:update': (data: any) => void;
  'session:ended': (data: { sessionId: string; message: string }) => void;
  'session:reset': (data: { oldSessionId: string; newSessionId: string; message: string }) => void;
  'song:response': (data: { status: string; message: string }) => void;
  'error': (data: { message: string; code?: string }) => void; // Added error code
  'reconnect_attempt': (attemptNumber: number) => void;
  'reconnect_failed': () => void;
  'reconnect': (attemptNumber: number) => void;
}

export interface ClientToServerEvents {
  'player:join': (data: { name: string; device?: string; existingPlayerId?: string }) => void;
  'answer:submit': (data: { playerId: string; choiceIndex: number }) => void;
  'game:state': (data: { playerId: string }) => void; // Request current game state
  'song:request': (data: { playerId: string; songRequest: string }) => void;
  'player:ping': (data: { playerId: string; timestamp: number }) => void; // For keep-alive
}

// Socket connection states
export type SocketConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

// Context interface
interface SocketContextValue {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connectionState: SocketConnectionState;
  lastError: string | null;
  connect: (sessionId: string, existingPlayerId?: string) => void;
  disconnect: (notifyServer?: boolean) => void;
  isConnected: boolean;
  emit: <Ev extends keyof ClientToServerEvents>(
    event: Ev,
    ...args: Parameters<ClientToServerEvents[Ev]>
  ) => void;
  on: <Ev extends keyof ServerToClientEvents>(
    event: Ev,
    callback: ServerToClientEvents[Ev]
  ) => void;
  off: <Ev extends keyof ServerToClientEvents>(
    event: Ev,
    callback?: ServerToClientEvents[Ev]
  ) => void;
  reconnect: () => void; // Manual reconnect attempt
  sessionId: string | null;
  playerId: string | null;
  setPlayerId: (playerId: string | null) => void;
}

// Create context with default values
const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connectionState: 'disconnected',
  lastError: null,
  connect: () => {},
  disconnect: () => {},
  isConnected: false,
  emit: () => {},
  on: () => {},
  off: () => {},
  reconnect: () => {},
  sessionId: null,
  playerId: null,
  setPlayerId: () => {},
});

// Props for the provider component
interface SocketProviderProps {
  children: ReactNode;
  url?: string;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

/**
 * Mobile-Optimized Socket.IO Provider Component
 */
export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  url = SOCKET_URL,
}) => {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const { addToast } = useToast();

  const connect = useCallback((sid: string, existingPlayerId?: string) => {
    if (socket?.connected && socket.io.opts.query?.sessionId === sid) {
      console.log('Already connected to this session:', sid);
      // If already connected to the same session, ensure player ID is set and emit game:state if needed
      if (existingPlayerId && currentPlayerId !== existingPlayerId) {
        setCurrentPlayerId(existingPlayerId);
      }
      if (currentPlayerId) {
        socket.emit('game:state', { playerId: currentPlayerId });
      }
      return;
    }

    // If a socket exists, disconnect it before creating a new one
    if (socket) {
      socket.disconnect();
    }

    console.log(`Attempting to connect to session: ${sid}, player: ${existingPlayerId || 'new'}`);
    setCurrentSessionId(sid);
    if (existingPlayerId) setCurrentPlayerId(existingPlayerId);
    setConnectionState('connecting');
    setLastError(null);

    const newSocket = io(`${url}/game`, {
      query: { sessionId: sid, playerId: existingPlayerId },
      transports: ['websocket'], // Prioritize WebSocket for mobile
      reconnectionAttempts: 5,
      reconnectionDelay: 2000, // Slightly longer delay for mobile networks
      reconnectionDelayMax: 10000,
      timeout: 15000, // Longer timeout for potentially slower mobile networks
      autoConnect: true, // Will connect on instantiation
      forceNew: true, // Ensures a new connection if parameters change
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id, 'Session:', sid);
      setConnectionState('connected');
      setLastError(null);
      addToast({ type: 'success', message: 'Connected to game!', duration: 2000 });
      // If we have a player ID, request current game state upon connection/reconnection
      if (currentPlayerId) {
        newSocket.emit('game:state', { playerId: currentPlayerId });
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setConnectionState('disconnected');
      setLastError(`Connection error: ${err.message}. Please check your internet.`);
      addToast({ type: 'error', title: 'Connection Failed', message: err.message });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionState('disconnected');
      if (reason === 'io server disconnect') {
        setLastError('Disconnected by server.');
        addToast({ type: 'warning', title: 'Disconnected', message: 'Server closed connection.' });
      } else if (reason === 'io client disconnect') {
        setLastError('Disconnected manually.');
         // Potentially do not show toast for manual disconnects unless desired
      } else {
        setLastError(`Disconnected: ${reason}. Attempting to reconnect...`);
        addToast({ type: 'warning', title: 'Connection Lost', message: `Disconnected: ${reason}. Reconnecting...` });
      }
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      setConnectionState('reconnecting');
      setLastError(`Reconnecting (attempt ${attemptNumber})...`);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Failed to reconnect after multiple attempts');
      setConnectionState('disconnected');
      setLastError('Failed to reconnect. Please check your connection and try again.');
      addToast({ type: 'error', title: 'Reconnect Failed', message: 'Could not reconnect to the server.' });
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`Successfully reconnected after ${attemptNumber} attempts.`);
      setConnectionState('connected');
      setLastError(null);
      addToast({ type: 'success', message: 'Reconnected successfully!', duration: 2000 });
      // Request game state on successful reconnect
      if (currentPlayerId) {
        newSocket.emit('game:state', { playerId: currentPlayerId });
      }
    });

    newSocket.on('error', (data) => {
      console.error('Socket error received:', data);
      setLastError(`Server error: ${data.message}`);
      addToast({ type: 'error', title: 'Game Error', message: data.message });
    });

    setSocket(newSocket);
  }, [socket, url, addToast, currentPlayerId]); // Added currentPlayerId dependency

  const disconnect = useCallback((notifyServer = true) => {
    if (socket) {
      console.log('Disconnecting socket manually.');
      if (notifyServer && socket.connected) {
        // Optionally notify server of graceful disconnect if needed by backend logic
      }
      socket.disconnect();
      setSocket(null); // Clear the socket instance
      setCurrentSessionId(null); // Clear session ID
      // setCurrentPlayerId(null); // Optionally clear player ID or persist for quick rejoin
      setConnectionState('disconnected');
      setLastError(null); // Clear error on manual disconnect
    }
  }, [socket]);

  const reconnect = useCallback(() => {
    if (socket && !socket.connected) {
      console.log('Attempting manual reconnect...');
      socket.connect();
    } else if (!socket && currentSessionId) {
      // If socket is null but we have a session ID (e.g., after backgrounding), try to connect
      console.log('Socket instance was null, re-initiating connection for session:', currentSessionId);
      connect(currentSessionId, currentPlayerId);
    } else {
      console.log('Socket already connected or no session ID to reconnect to.');
    }
  }, [socket, currentSessionId, connect, currentPlayerId]);

  // Mobile network change handling
  useEffect(() => {
    const handleOnline = () => {
      addToast({ type: 'info', message: 'Back online. Attempting to reconnect...', duration: 3000 });
      console.log('Network came online.');
      if (socket && !socket.connected) {
        socket.connect();
      } else if (!socket && currentSessionId) {
        // If socket was cleared (e.g. due to backgrounding), re-initiate connection
        connect(currentSessionId, currentPlayerId);
      }
    };
    const handleOffline = () => {
      addToast({ type: 'warning', title: 'Offline', message: 'Network connection lost.' });
      console.log('Network went offline.');
      // Socket.IO handles offline scenarios and attempts reconnection by default,
      // but we might want to update UI or take specific actions.
      if (socket?.connected) {
        // Socket.IO might not immediately detect this, but we can update state
        setConnectionState('reconnecting');
        setLastError('Network connection lost. Attempting to reconnect...');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [socket, addToast, currentSessionId, connect, currentPlayerId]);

  // Background/foreground app state handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('App went to background.');
        // Optionally disconnect or reduce activity. For a real-time game,
        // it might be better to stay connected but inform the user.
        // If disconnecting:
        // if (socket?.connected) {
        //   socket.disconnect();
        //   addToast({ type: 'info', message: 'Disconnected due to app backgrounding.', duration: 2000 });
        // }
      } else if (document.visibilityState === 'visible') {
        console.log('App came to foreground.');
        if (socket && !socket.connected) {
          addToast({ type: 'info', message: 'Reconnecting...', duration: 2000 });
          socket.connect();
        } else if (!socket && currentSessionId) {
          // If socket was fully cleared, re-initiate
          connect(currentSessionId, currentPlayerId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, addToast, currentSessionId, connect, currentPlayerId]);

  // Emit event with type safety
  const emit = useCallback<SocketContextValue['emit']>(
    (event, ...args) => {
      if (socket?.connected) {
        socket.emit(event, ...args);
      } else {
        const errorMsg = `Cannot emit "${String(event)}": Socket not connected. State: ${connectionState}`;
        console.warn(errorMsg);
        setLastError(errorMsg);
        addToast({ type: 'error', title: 'Not Connected', message: 'Cannot send data. Connection lost.' });
      }
    },
    [socket, connectionState, addToast]
  );

  // Register event listener with type safety
  const on = useCallback<SocketContextValue['on']>(
    (event, callback) => {
      socket?.on(event, callback);
    },
    [socket]
  );

  // Remove event listener with type safety
  const off = useCallback<SocketContextValue['off']>(
    (event, callback) => {
      socket?.off(event, callback);
    },
    [socket]
  );

  // Clean up socket connection on unmount
  useEffect(() => {
    return () => {
      socket?.disconnect();
      setSocket(null);
    };
  }, [socket]);

  // Context value
  const value: SocketContextValue = {
    socket,
    connectionState,
    lastError,
    connect,
    disconnect,
    isConnected: connectionState === 'connected',
    emit,
    on,
    off,
    reconnect,
    sessionId: currentSessionId,
    playerId: currentPlayerId,
    setPlayerId: setCurrentPlayerId,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// Custom hook for using the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
