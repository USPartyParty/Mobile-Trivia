import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Define event types for better type safety
export interface ServerToClientEvents {
  // Game flow events
  'player:joined': (data: { playerId: string; name: string; sessionId: string; playerCount: number; status: string }) => void;
  'player:new': (data: { playerId: string; name: string; playerCount: number }) => void;
  'player:left': (data: { playerId: string; name: string; remainingPlayers: number }) => void;
  'game:countdown': (data: { seconds: number; message: string }) => void;
  'game:started': (data: { sessionId: string; playerCount: number; totalQuestions: number }) => void;
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
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'player:join': (data: { name: string; device?: string }) => void;
  'answer:submit': (data: { playerId: string; choiceIndex: number }) => void;
  'game:state': (data: { playerId: string }) => void;
  'song:request': (data: { playerId: string; songRequest: string }) => void;
}

// Socket connection states
export type SocketConnectionState = 'connected' | 'connecting' | 'disconnected';

// Context interface
interface SocketContextValue {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connectionState: SocketConnectionState;
  lastError: string | null;
  connect: (sessionId: string) => void;
  disconnect: () => void;
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
  reconnect: () => void;
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
});

// Props for the provider component
interface SocketProviderProps {
  children: ReactNode;
  url?: string;
}

/**
 * Socket.IO Provider Component
 * Manages socket connection and provides methods for interaction
 */
export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000',
}) => {
  // Socket instance state
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Connect to socket with session ID
  const connect = useCallback((sid: string) => {
    if (socket) {
      // Already connected or connecting
      if (sid === sessionId) return;
      
      // Disconnect from previous session if connecting to a new one
      socket.disconnect();
    }

    setSessionId(sid);
    setConnectionState('connecting');
    
    // Create socket instance with namespace and query params
    const socketInstance = io(`${url}/game`, {
      query: { sessionId: sid },
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    // Set up event listeners for connection status
    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setConnectionState('connected');
      setLastError(null);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnectionState('disconnected');
      setLastError(`Connection error: ${err.message}`);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionState('disconnected');
      if (reason === 'io server disconnect') {
        // Server disconnected us, need to manually reconnect
        setLastError('Disconnected by server');
      } else {
        // Socket will automatically try to reconnect
        setLastError(`Disconnected: ${reason}`);
      }
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      setConnectionState('connecting');
      setLastError(`Reconnecting (attempt ${attemptNumber})`);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Failed to reconnect');
      setConnectionState('disconnected');
      setLastError('Failed to reconnect after multiple attempts');
    });

    socketInstance.on('error', (data) => {
      console.error('Socket error:', data);
      setLastError(`Error: ${data.message}`);
    });

    // Store socket instance
    setSocket(socketInstance);
  }, [socket, url, sessionId]);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setSessionId(null);
      setConnectionState('disconnected');
    }
  }, [socket]);

  // Reconnect to socket
  const reconnect = useCallback(() => {
    if (sessionId) {
      connect(sessionId);
    } else {
      setLastError('Cannot reconnect: No session ID');
    }
  }, [connect, sessionId]);

  // Emit event with type safety
  const emit = useCallback<SocketContextValue['emit']>(
    (event, ...args) => {
      if (socket && socket.connected) {
        socket.emit(event, ...args);
      } else {
        console.warn(`Cannot emit ${String(event)}: Socket not connected`);
        setLastError(`Cannot emit ${String(event)}: Socket not connected`);
      }
    },
    [socket]
  );

  // Register event listener with type safety
  const on = useCallback<SocketContextValue['on']>(
    (event, callback) => {
      if (socket) {
        socket.on(event, callback);
      }
    },
    [socket]
  );

  // Remove event listener with type safety
  const off = useCallback<SocketContextValue['off']>(
    (event, callback) => {
      if (socket) {
        if (callback) {
          socket.off(event, callback);
        } else {
          socket.off(event);
        }
      }
    },
    [socket]
  );

  // Clean up socket connection on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
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

// Export both the context and provider
export default SocketContext;
