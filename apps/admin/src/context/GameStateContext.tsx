import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';

// Game state interfaces
interface Player {
  id: string;
  name: string;
  score: number;
  isActive: boolean;
  lastActive?: Date;
  answers?: {
    questionIndex: number;
    correct: boolean;
    timeToAnswer: number;
  }[];
}

interface Question {
  index: number;
  total: number;
  text: string;
  category: string;
  difficulty: string;
  choices: string[];
  correctAnswerIndex?: number;
  timeLimit: number;
  timeRemaining?: number;
  explanation?: string;
}

interface LeaderboardEntry {
  playerName: string;
  playerId: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
}

interface GameState {
  sessionId: string | null;
  status: 'initializing' | 'waiting' | 'active' | 'paused' | 'completed' | 'error';
  error?: string;
  players: Player[];
  connectedPlayers: number;
  maxPlayers: number;
  currentQuestion?: Question;
  questions: {
    total: number;
    answered: number;
    categories: string[];
  };
  leaderboard: LeaderboardEntry[];
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  qrCodeUrl?: string;
}

// Admin statistics interface
interface AdminStats {
  totalSessions: number;
  activeSessions: number;
  totalPlayers: number;
  topScore: number;
  averageScore: number;
  popularCategories: {
    category: string;
    count: number;
  }[];
  sessionsToday: number;
}

// Game state context interface
interface GameStateContextType {
  gameState: GameState;
  adminStats: AdminStats;
  isLoading: boolean;
  fetchGameState: (sessionId: string) => void;
  fetchAdminStats: () => void;
  resetGameState: () => void;
}

// Default values for game state
const defaultGameState: GameState = {
  sessionId: null,
  status: 'initializing',
  players: [],
  connectedPlayers: 0,
  maxPlayers: 8,
  questions: {
    total: 0,
    answered: 0,
    categories: [],
  },
  leaderboard: [],
};

// Default values for admin stats
const defaultAdminStats: AdminStats = {
  totalSessions: 0,
  activeSessions: 0,
  totalPlayers: 0,
  topScore: 0,
  averageScore: 0,
  popularCategories: [],
  sessionsToday: 0,
};

// Create context with default values
const GameStateContext = createContext<GameStateContextType>({
  gameState: defaultGameState,
  adminStats: defaultAdminStats,
  isLoading: true,
  fetchGameState: () => {},
  fetchAdminStats: () => {},
  resetGameState: () => {},
});

// Provider component
export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const [adminStats, setAdminStats] = useState<AdminStats>(defaultAdminStats);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { socket, connectionState, sessionId } = useSocket();
  const { showToast } = useToast();

  // Listen for game state updates from the socket
  useEffect(() => {
    if (!socket || connectionState !== 'connected') return;

    // Handle state updates from server
    const handleStateUpdate = (data: { fullState: any }) => {
      setGameState(prevState => ({
        ...prevState,
        ...data.fullState,
        status: data.fullState.status || prevState.status,
        players: data.fullState.players || prevState.players,
        currentQuestion: data.fullState.currentQuestion || prevState.currentQuestion,
        leaderboard: data.fullState.leaderboard || prevState.leaderboard,
      }));
      setIsLoading(false);
    };

    // Listen for state updates
    socket.on('state:update', handleStateUpdate);

    // Listen for session creation
    socket.on('session:created', (data) => {
      setGameState(prevState => ({
        ...prevState,
        sessionId: data.sessionId,
        status: 'waiting',
        qrCodeUrl: data.qrCodeUrl,
        players: [],
        connectedPlayers: 0,
      }));
      setIsLoading(false);
    });

    // Clean up listeners on unmount or when socket changes
    return () => {
      socket.off('state:update', handleStateUpdate);
      socket.off('session:created');
    };
  }, [socket, connectionState]);

  // Update session ID when it changes in the socket context
  useEffect(() => {
    if (sessionId) {
      setGameState(prevState => ({
        ...prevState,
        sessionId,
      }));
      
      // Fetch game state for the session
      fetchGameState(sessionId);
    }
  }, [sessionId]);

  // Fetch game state for a specific session
  const fetchGameState = async (sessionId: string) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/session/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }
      
      const data = await response.json();
      setGameState(prevState => ({
        ...prevState,
        ...data,
        sessionId,
      }));
    } catch (error) {
      console.error('Error fetching game state:', error);
      showToast(`Error fetching game state: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setGameState(prevState => ({
        ...prevState,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch admin statistics
  const fetchAdminStats = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch admin stats: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAdminStats(data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      showToast(`Error fetching admin stats: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // Reset game state to defaults
  const resetGameState = () => {
    setGameState(defaultGameState);
    setIsLoading(true);
  };

  return (
    <GameStateContext.Provider
      value={{
        gameState,
        adminStats,
        isLoading,
        fetchGameState,
        fetchAdminStats,
        resetGameState,
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
};

// Custom hook for using the game state context
export const useGameState = () => useContext(GameStateContext);
