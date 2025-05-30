import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { useSocket, ServerToClientEvents } from './SocketContext'; // Assuming SocketContext is in the same directory
import { useToast } from './ToastContext'; // Assuming ToastContext is available

// Define TypeScript interfaces for game data (mobile-focused)
export interface PlayerInfo {
  playerId: string;
  name: string;
  score: number;
}

export interface Question {
  index: number;
  text: string;
  category: string;
  difficulty: string;
  choices: string[];
  correctAnswerIndex?: number; // Revealed after answer or timeout
  timeLimit: number;
  askedAt: Date; // Timestamp when question was served
  explanation?: string | null;
}

export interface GameSettings {
  questionCount: number;
  timeLimitPerQuestion: number;
  // Add other relevant settings if needed
}

export type GameStatus =
  | 'idle'          // Initial state, not in a session
  | 'connecting'    // Connecting to socket for a session
  | 'joining'       // Attempting to join a game session
  | 'waiting'       // Joined session, waiting for game to start
  | 'countdown'     // Game starting soon
  | 'active'        // Game in progress, question active
  | 'revealed'      // Answer revealed, waiting for next question
  | 'paused'        // Game paused by admin
  | 'results'       // Game completed, viewing results
  | 'error';        // An error occurred

export interface GameState {
  sessionId: string | null;
  playerId: string | null;
  playerName: string | null;
  gameStatus: GameStatus;
  currentQuestion: Question | null;
  currentQuestionIndex: number; // 0-based index
  totalQuestions: number;
  playerScore: number;
  selectedAnswerIndex: number | null; // Player's chosen answer for current question
  isAnswerCorrect: boolean | null;    // Was the last answer correct?
  pointsEarned: number | null;        // Points earned for last answer
  finalScores: PlayerInfo[] | null;   // Scores at the end of the game
  gameSettings: GameSettings | null;  // Settings for the current game
  lastError: string | null;
  isLoading: boolean;                 // For async operations like joining
}

// Action types for the reducer
type GameAction =
  | { type: 'CONNECT_SESSION_START'; payload: { sessionId: string } }
  | { type: 'CONNECT_SESSION_SUCCESS' }
  | { type: 'JOIN_GAME_START'; payload: { playerName: string } }
  | { type: 'PLAYER_JOINED'; payload: { playerId: string; name: string; isReconnect?: boolean } }
  | { type: 'GAME_COUNTDOWN'; payload: { seconds: number } }
  | { type: 'GAME_STARTED'; payload: { totalQuestions: number; settings: GameSettings } }
  | { type: 'SET_QUESTION'; payload: Question }
  | { type: 'SELECT_ANSWER'; payload: { choiceIndex: number } }
  | { type: 'ANSWER_RESULT'; payload: { correct: boolean; points: number; totalScore: number; correctAnswer: number } }
  | { type: 'REVEAL_ANSWER'; payload: { correctAnswerIndex: number; explanation?: string | null } }
  | { type: 'SCORES_UPDATE'; payload: { playerScores: PlayerInfo[] } } // For live score updates if needed
  | { type: 'GAME_COMPLETED'; payload: { finalScores: PlayerInfo[] } }
  | { type: 'GAME_PAUSED' }
  | { type: 'GAME_RESUMED' }
  | { type: 'SESSION_ENDED'; payload?: { message?: string } }
  | { type: 'SESSION_RESET'; payload: { newSessionId: string } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET_STATE' } // Full reset to initial state
  | { type: 'REHYDRATE_STATE'; payload: { sessionId: string | null; playerId: string | null; playerName: string | null } }
  | { type: 'GAME_STATE_UPDATE'; payload: Partial<GameState> }; // For full state sync from server

// Local storage keys
const LOCAL_STORAGE_SESSION_ID = 'ttt_sessionId';
const LOCAL_STORAGE_PLAYER_ID = 'ttt_playerId';
const LOCAL_STORAGE_PLAYER_NAME = 'ttt_playerName';

// Initial state
const initialState: GameState = {
  sessionId: null,
  playerId: null,
  playerName: null,
  gameStatus: 'idle',
  currentQuestion: null,
  currentQuestionIndex: -1,
  totalQuestions: 0,
  playerScore: 0,
  selectedAnswerIndex: null,
  isAnswerCorrect: null,
  pointsEarned: null,
  finalScores: null,
  gameSettings: null,
  lastError: null,
  isLoading: false,
};

// Reducer function
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'CONNECT_SESSION_START':
      return {
        ...state,
        sessionId: action.payload.sessionId,
        gameStatus: 'connecting',
        isLoading: true,
        lastError: null,
      };
    case 'CONNECT_SESSION_SUCCESS':
      return { ...state, gameStatus: 'joining', isLoading: false }; // Ready to join with name
    case 'JOIN_GAME_START':
      return {
        ...state,
        playerName: action.payload.playerName,
        gameStatus: 'joining',
        isLoading: true,
        lastError: null,
      };
    case 'PLAYER_JOINED':
      localStorage.setItem(LOCAL_STORAGE_PLAYER_ID, action.payload.playerId);
      localStorage.setItem(LOCAL_STORAGE_PLAYER_NAME, action.payload.name);
      if (state.sessionId) localStorage.setItem(LOCAL_STORAGE_SESSION_ID, state.sessionId);
      return {
        ...state,
        playerId: action.payload.playerId,
        playerName: action.payload.name, // Ensure name is updated if server provides it
        gameStatus: 'waiting',
        isLoading: false,
        playerScore: action.payload.isReconnect ? state.playerScore : 0, // Keep score on reconnect
        currentQuestion: action.payload.isReconnect ? state.currentQuestion : null, // Keep question on reconnect
      };
    case 'GAME_COUNTDOWN':
      return { ...state, gameStatus: 'countdown' };
    case 'GAME_STARTED':
      return {
        ...state,
        gameStatus: 'active',
        totalQuestions: action.payload.totalQuestions,
        gameSettings: action.payload.settings,
        currentQuestionIndex: -1, // Will be updated by first SET_QUESTION
        playerScore: 0, // Reset score at game start
        finalScores: null,
        selectedAnswerIndex: null,
        isAnswerCorrect: null,
        pointsEarned: null,
      };
    case 'SET_QUESTION':
      return {
        ...state,
        currentQuestion: action.payload,
        currentQuestionIndex: action.payload.index,
        gameStatus: 'active',
        selectedAnswerIndex: null,
        isAnswerCorrect: null,
        pointsEarned: null,
      };
    case 'SELECT_ANSWER':
      return { ...state, selectedAnswerIndex: action.payload.choiceIndex };
    case 'ANSWER_RESULT':
      return {
        ...state,
        playerScore: action.payload.totalScore,
        isAnswerCorrect: action.payload.correct,
        pointsEarned: action.payload.points,
        // Keep gameStatus as 'active' until REVEAL_ANSWER
      };
    case 'REVEAL_ANSWER':
      return {
        ...state,
        gameStatus: 'revealed',
        currentQuestion: state.currentQuestion
          ? {
              ...state.currentQuestion,
              correctAnswerIndex: action.payload.correctAnswerIndex,
              explanation: action.payload.explanation,
            }
          : null,
      };
    case 'SCORES_UPDATE': // If live scores are pushed (less common for player view)
      // Find this player in the scores update and update their score if different
      const thisPlayerScore = action.payload.playerScores.find(p => p.playerId === state.playerId)?.score;
      return {
        ...state,
        playerScore: typeof thisPlayerScore === 'number' ? thisPlayerScore : state.playerScore,
      };
    case 'GAME_COMPLETED':
      return {
        ...state,
        gameStatus: 'results',
        finalScores: action.payload.finalScores,
        currentQuestion: null,
      };
    case 'GAME_PAUSED':
      return { ...state, gameStatus: 'paused' };
    case 'GAME_RESUMED':
      return { ...state, gameStatus: 'active' }; // Or 'waiting' if no question yet
    case 'SESSION_ENDED':
      localStorage.removeItem(LOCAL_STORAGE_SESSION_ID);
      localStorage.removeItem(LOCAL_STORAGE_PLAYER_ID);
      localStorage.removeItem(LOCAL_STORAGE_PLAYER_NAME);
      return {
        ...initialState, // Reset most state
        lastError: action.payload?.message || 'The session has ended.',
        gameStatus: 'error', // Or a specific 'ended' status
      };
    case 'SESSION_RESET':
      // Player needs to rejoin the new session
      localStorage.removeItem(LOCAL_STORAGE_SESSION_ID);
      localStorage.removeItem(LOCAL_STORAGE_PLAYER_ID);
      localStorage.removeItem(LOCAL_STORAGE_PLAYER_NAME);
      return {
        ...initialState,
        lastError: 'The game was reset by the host. Please join the new session.',
        gameStatus: 'error', // Or 'idle' to prompt rejoining
      };
    case 'SET_ERROR':
      return { ...state, lastError: action.payload, isLoading: false, gameStatus: 'error' };
    case 'CLEAR_ERROR':
      return { ...state, lastError: null, gameStatus: state.sessionId ? 'joining' : 'idle' }; // Revert to a sensible state
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'RESET_STATE':
      localStorage.removeItem(LOCAL_STORAGE_SESSION_ID);
      localStorage.removeItem(LOCAL_STORAGE_PLAYER_ID);
      localStorage.removeItem(LOCAL_STORAGE_PLAYER_NAME);
      return initialState;
    case 'REHYDRATE_STATE':
      return {
        ...state, // Keep current gameStatus, etc. if already in a game
        sessionId: action.payload.sessionId,
        playerId: action.payload.playerId,
        playerName: action.payload.playerName,
      };
    case 'GAME_STATE_UPDATE': // For full state sync from server
      const updatedState = { ...state, ...action.payload };
      // Persist critical items if they changed
      if (action.payload.sessionId) localStorage.setItem(LOCAL_STORAGE_SESSION_ID, action.payload.sessionId);
      if (action.payload.playerId) localStorage.setItem(LOCAL_STORAGE_PLAYER_ID, action.payload.playerId);
      if (action.payload.playerName) localStorage.setItem(LOCAL_STORAGE_PLAYER_NAME, action.payload.playerName);
      return updatedState;
    default:
      return state;
  }
}

// Create context
interface GameStateContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  connectAndJoinSession: (sessionId: string, playerName: string, existingPlayerId?: string) => void;
  submitAnswer: (choiceIndex: number) => void;
  requestSong: (songRequest: string) => void;
  leaveSession: () => void;
  requestGameStateRecovery: () => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

// Provider props
interface GameStateProviderProps {
  children: ReactNode;
}

// Provider component
export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { socket, connect, disconnect, emit, on, off, isConnected, sessionId: socketSessionId, setPlayerId: setSocketPlayerId } = useSocket();
  const { addToast } = useToast();

  // Rehydrate state from local storage on initial load
  useEffect(() => {
    const storedSessionId = localStorage.getItem(LOCAL_STORAGE_SESSION_ID);
    const storedPlayerId = localStorage.getItem(LOCAL_STORAGE_PLAYER_ID);
    const storedPlayerName = localStorage.getItem(LOCAL_STORAGE_PLAYER_NAME);

    if (storedSessionId && storedPlayerId && storedPlayerName) {
      dispatch({ type: 'REHYDRATE_STATE', payload: { sessionId: storedSessionId, playerId: storedPlayerId, playerName: storedPlayerName } });
      // Attempt to reconnect to this session
      dispatch({ type: 'CONNECT_SESSION_START', payload: { sessionId: storedSessionId } });
      connect(storedSessionId, storedPlayerId); // Pass player ID for potential reconnect
    }
  }, [connect]); // connect is stable from useSocket

  const connectAndJoinSession = useCallback((sessionIdToJoin: string, playerName: string, existingPlayerId?: string) => {
    dispatch({ type: 'CONNECT_SESSION_START', payload: { sessionId: sessionIdToJoin } });
    connect(sessionIdToJoin, existingPlayerId || state.playerId || undefined); // Connect socket
    // Player join will be emitted after successful socket connection
    // Store playerName temporarily until socket connects and emits player:join
    dispatch({ type: 'JOIN_GAME_START', payload: { playerName } });
  }, [connect, state.playerId]);

  const submitAnswer = useCallback((choiceIndex: number) => {
    if (state.playerId && state.currentQuestion && state.selectedAnswerIndex === null) {
      dispatch({ type: 'SELECT_ANSWER', payload: { choiceIndex } });
      emit('answer:submit', { playerId: state.playerId, choiceIndex });
    } else {
      addToast({ type: 'warning', message: 'Cannot submit answer now.', duration: 2000 });
    }
  }, [state.playerId, state.currentQuestion, state.selectedAnswerIndex, emit, addToast]);

  const requestSong = useCallback((songRequest: string) => {
    if (state.playerId) {
      emit('song:request', { playerId: state.playerId, songRequest });
      addToast({ type: 'info', message: 'Song request sent!', duration: 2000 });
    }
  }, [state.playerId, emit, addToast]);

  const leaveSession = useCallback(() => {
    disconnect(); // Disconnect socket
    dispatch({ type: 'RESET_STATE' }); // Reset local game state
  }, [disconnect]);

  const requestGameStateRecovery = useCallback(() => {
    if (state.playerId && isConnected && socketSessionId === state.sessionId) {
      emit('game:state', { playerId: state.playerId });
      dispatch({ type: 'SET_LOADING', payload: true });
    } else if (state.sessionId && state.playerName && state.playerId) {
      // If not connected, try to connect and join
      addToast({ type: 'info', message: 'Attempting to rejoin session...', duration: 2000 });
      connectAndJoinSession(state.sessionId, state.playerName, state.playerId);
    } else {
      addToast({ type: 'error', message: 'Cannot recover game state. Please join a new game.', duration: 3000 });
    }
  }, [state.playerId, state.sessionId, state.playerName, isConnected, socketSessionId, emit, addToast, connectAndJoinSession]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    // This handles the case where socket connects *after* JOIN_GAME_START was dispatched
    if (state.gameStatus === 'joining' && state.playerName && state.sessionId === socketSessionId) {
      emit('player:join', { name: state.playerName, device: 'mobile', existingPlayerId: state.playerId || undefined });
    }

    const handlePlayerJoined: ServerToClientEvents['player:joined'] = (data) => {
      setSocketPlayerId(data.playerId); // Inform SocketContext about the player ID
      dispatch({ type: 'PLAYER_JOINED', payload: { playerId: data.playerId, name: data.name, isReconnect: data.isReconnect } });
      if (data.isReconnect) {
        addToast({ type: 'success', message: 'Rejoined session successfully!', duration: 2000 });
      } else {
        addToast({ type: 'success', message: `Joined as ${data.name}!`, duration: 2000 });
      }
    };

    const handleGameCountdown: ServerToClientEvents['game:countdown'] = (data) => {
      dispatch({ type: 'GAME_COUNTDOWN', payload: { seconds: data.seconds } });
    };

    const handleGameStarted: ServerToClientEvents['game:started'] = (data) => {
      dispatch({ type: 'GAME_STARTED', payload: { totalQuestions: data.totalQuestions, settings: data.settings as GameSettings } });
    };

    const handleSetQuestion: ServerToClientEvents['question'] = (data) => {
      dispatch({ type: 'SET_QUESTION', payload: data as Question });
    };

    const handleAnswerResult: ServerToClientEvents['answer:result'] = (data) => {
      dispatch({ type: 'ANSWER_RESULT', payload: data });
    };

    const handleRevealAnswer: ServerToClientEvents['answer:reveal'] = (data) => {
      dispatch({ type: 'REVEAL_ANSWER', payload: data });
    };

    const handleGameCompleted: ServerToClientEvents['game:complete'] = (data) => {
      dispatch({ type: 'GAME_COMPLETED', payload: { finalScores: data.finalScores as PlayerInfo[] } });
    };

    const handleGamePaused: ServerToClientEvents['game:paused'] = () => {
      dispatch({ type: 'GAME_PAUSED' });
      addToast({ type: 'info', message: 'Game paused by host.', duration: 3000 });
    };

    const handleGameResumed: ServerToClientEvents['game:resumed'] = () => {
      dispatch({ type: 'GAME_RESUMED' });
      addToast({ type: 'info', message: 'Game resumed!', duration: 2000 });
    };

    const handleSessionEnded: ServerToClientEvents['session:ended'] = (data) => {
      dispatch({ type: 'SESSION_ENDED', payload: { message: data.message } });
      addToast({ type: 'warning', title: 'Session Ended', message: data.message, duration: 5000 });
      disconnect(); // Ensure socket is cleaned up
    };
    
    const handleSessionReset: ServerToClientEvents['session:reset'] = (data) => {
      dispatch({ type: 'SESSION_RESET', payload: { newSessionId: data.newSessionId } });
      addToast({ type: 'warning', title: 'Session Reset', message: data.message + " Please join the new session if prompted.", duration: 5000 });
      disconnect();
    };

    const handleErrorEvent: ServerToClientEvents['error'] = (data) => {
      dispatch({ type: 'SET_ERROR', payload: data.message });
      // Toast is handled by SocketContext for general socket errors, or here for game-specific ones
    };

    const handleGameStateUpdate: ServerToClientEvents['game:state:update'] = (data) => {
      dispatch({ type: 'GAME_STATE_UPDATE', payload: data as Partial<GameState> });
      dispatch({ type: 'SET_LOADING', payload: false }); // Stop loading after state sync
      addToast({ type: 'info', message: 'Game state synced.', duration: 1500 });
    };

    on('player:joined', handlePlayerJoined);
    on('game:countdown', handleGameCountdown);
    on('game:started', handleGameStarted);
    on('question', handleSetQuestion);
    on('answer:result', handleAnswerResult);
    on('answer:reveal', handleRevealAnswer);
    on('game:complete', handleGameCompleted);
    on('game:paused', handleGamePaused);
    on('game:resumed', handleGameResumed);
    on('session:ended', handleSessionEnded);
    on('session:reset', handleSessionReset);
    on('error', handleErrorEvent); // Listen for game-specific errors
    on('game:state:update', handleGameStateUpdate);

    // If socket just connected and we have a session ID, tell GameStateContext
    if (socketSessionId === state.sessionId && state.gameStatus === 'connecting') {
        dispatch({ type: 'CONNECT_SESSION_SUCCESS' });
    }


    return () => {
      off('player:joined', handlePlayerJoined);
      off('game:countdown', handleGameCountdown);
      off('game:started', handleGameStarted);
      off('question', handleSetQuestion);
      off('answer:result', handleAnswerResult);
      off('answer:reveal', handleRevealAnswer);
      off('game:complete', handleGameCompleted);
      off('game:paused', handleGamePaused);
      off('game:resumed', handleGameResumed);
      off('session:ended', handleSessionEnded);
      off('session:reset', handleSessionReset);
      off('error', handleErrorEvent);
      off('game:state:update', handleGameStateUpdate);
    };
  }, [socket, isConnected, state.gameStatus, state.playerName, state.sessionId, socketSessionId, state.playerId, emit, on, off, addToast, setSocketPlayerId, disconnect]);

  const contextValue = {
    state,
    dispatch,
    connectAndJoinSession,
    submitAnswer,
    requestSong,
    leaveSession,
    requestGameStateRecovery,
  };

  return (
    <GameStateContext.Provider value={contextValue}>
      {children}
    </GameStateContext.Provider>
  );
};

// Custom hook for using the game state context
export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};

export default GameStateContext;
