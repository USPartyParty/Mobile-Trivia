import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { useSocket } from './SocketContext';

// Define TypeScript interfaces for game data
export interface Player {
  playerId: string;
  name: string;
  score: number;
  isConnected: boolean;
  hasAnswered?: boolean;
  answerCorrect?: boolean;
  joinedAt: Date;
}

export interface Answer {
  questionIndex: number;
  choiceIndex: number;
  correct: boolean;
  timeToAnswer: number;
  points: number;
}

export interface Question {
  index: number;
  text: string;
  category: string;
  difficulty: string;
  choices: string[];
  correctAnswerIndex?: number; // Only available after answering or time expires
  timeLimit: number;
  askedAt: Date;
  explanation?: string | null;
}

export interface GameSettings {
  maxPlayers: number;
  questionCount: number;
  categories: string[];
  difficulty: string;
  timeLimit: number;
  pointsPerQuestion: number;
  bonusTimePoints: boolean;
}

export type GameStatus = 'waiting' | 'countdown' | 'active' | 'paused' | 'completed';

export interface GameState {
  // Session information
  sessionId: string | null;
  qrCodeUrl: string | null;
  createdAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  
  // Player state
  currentPlayerId: string | null;
  playerName: string | null;
  players: Player[];
  
  // Game state
  status: GameStatus;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  countdownSeconds: number;
  
  // Score tracking
  playerScore: number;
  playerAnswers: Answer[];
  finalScores: Player[] | null;
  
  // Settings
  settings: GameSettings | null;
  
  // UI state
  isAnswerRevealed: boolean;
  selectedAnswerIndex: number | null;
  error: string | null;
  isLoading: boolean;
}

// Action types for the reducer
type GameAction =
  | { type: 'SET_SESSION', payload: { sessionId: string, qrCodeUrl: string } }
  | { type: 'SET_PLAYER', payload: { playerId: string, name: string } }
  | { type: 'GAME_COUNTDOWN', payload: { seconds: number } }
  | { type: 'GAME_STARTED', payload: { totalQuestions: number, startedAt: Date } }
  | { type: 'SET_QUESTION', payload: Question }
  | { type: 'SELECT_ANSWER', payload: { choiceIndex: number } }
  | { type: 'ANSWER_RESULT', payload: { correct: boolean, points: number, totalScore: number, correctAnswer: number } }
  | { type: 'REVEAL_ANSWER', payload: { correctAnswerIndex: number, explanation?: string | null } }
  | { type: 'UPDATE_SCORES', payload: { playerScores: Player[], isComplete?: boolean } }
  | { type: 'GAME_COMPLETED', payload: { finalScores: Player[], gameDuration: number } }
  | { type: 'PLAYER_JOINED', payload: Player }
  | { type: 'PLAYER_LEFT', payload: { playerId: string } }
  | { type: 'GAME_PAUSED' }
  | { type: 'GAME_RESUMED' }
  | { type: 'SESSION_ENDED' }
  | { type: 'SESSION_RESET', payload: { newSessionId: string, qrCodeUrl: string } }
  | { type: 'SET_ERROR', payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING', payload: boolean }
  | { type: 'UPDATE_GAME_STATE', payload: Partial<GameState> }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: GameState = {
  sessionId: null,
  qrCodeUrl: null,
  createdAt: null,
  startedAt: null,
  endedAt: null,
  
  currentPlayerId: null,
  playerName: null,
  players: [],
  
  status: 'waiting',
  currentQuestion: null,
  currentQuestionIndex: -1,
  totalQuestions: 0,
  countdownSeconds: 0,
  
  playerScore: 0,
  playerAnswers: [],
  finalScores: null,
  
  settings: null,
  
  isAnswerRevealed: false,
  selectedAnswerIndex: null,
  error: null,
  isLoading: false
};

// Reducer function
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        sessionId: action.payload.sessionId,
        qrCodeUrl: action.payload.qrCodeUrl,
        createdAt: new Date(),
        status: 'waiting'
      };
      
    case 'SET_PLAYER':
      return {
        ...state,
        currentPlayerId: action.payload.playerId,
        playerName: action.payload.name
      };
      
    case 'GAME_COUNTDOWN':
      return {
        ...state,
        status: 'countdown',
        countdownSeconds: action.payload.seconds
      };
      
    case 'GAME_STARTED':
      return {
        ...state,
        status: 'active',
        startedAt: action.payload.startedAt,
        totalQuestions: action.payload.totalQuestions,
        currentQuestionIndex: 0,
        playerAnswers: [],
        finalScores: null
      };
      
    case 'SET_QUESTION':
      return {
        ...state,
        currentQuestion: action.payload,
        currentQuestionIndex: action.payload.index,
        isAnswerRevealed: false,
        selectedAnswerIndex: null
      };
      
    case 'SELECT_ANSWER':
      return {
        ...state,
        selectedAnswerIndex: action.payload.choiceIndex
      };
      
    case 'ANSWER_RESULT':
      // Find the current player and update their score
      const updatedPlayers = state.players.map(player => {
        if (player.playerId === state.currentPlayerId) {
          return {
            ...player,
            score: action.payload.totalScore,
            hasAnswered: true,
            answerCorrect: action.payload.correct
          };
        }
        return player;
      });
      
      // Add to player answers
      const newAnswer: Answer = {
        questionIndex: state.currentQuestionIndex,
        choiceIndex: state.selectedAnswerIndex || 0,
        correct: action.payload.correct,
        timeToAnswer: state.currentQuestion ? 
          (new Date().getTime() - new Date(state.currentQuestion.askedAt).getTime()) : 0,
        points: action.payload.points
      };
      
      return {
        ...state,
        playerScore: action.payload.totalScore,
        playerAnswers: [...state.playerAnswers, newAnswer],
        players: updatedPlayers,
        currentQuestion: state.currentQuestion ? {
          ...state.currentQuestion,
          correctAnswerIndex: action.payload.correctAnswer
        } : null
      };
      
    case 'REVEAL_ANSWER':
      return {
        ...state,
        isAnswerRevealed: true,
        currentQuestion: state.currentQuestion ? {
          ...state.currentQuestion,
          correctAnswerIndex: action.payload.correctAnswerIndex,
          explanation: action.payload.explanation
        } : null
      };
      
    case 'UPDATE_SCORES':
      return {
        ...state,
        players: action.payload.playerScores
      };
      
    case 'GAME_COMPLETED':
      return {
        ...state,
        status: 'completed',
        finalScores: action.payload.finalScores,
        endedAt: new Date(),
        currentQuestion: null
      };
      
    case 'PLAYER_JOINED':
      // Check if player already exists
      const playerExists = state.players.some(p => p.playerId === action.payload.playerId);
      
      if (playerExists) {
        // Update existing player
        return {
          ...state,
          players: state.players.map(p => 
            p.playerId === action.payload.playerId ? { ...p, ...action.payload } : p
          )
        };
      } else {
        // Add new player
        return {
          ...state,
          players: [...state.players, action.payload]
        };
      }
      
    case 'PLAYER_LEFT':
      return {
        ...state,
        players: state.players.map(player => 
          player.playerId === action.payload.playerId 
            ? { ...player, isConnected: false } 
            : player
        )
      };
      
    case 'GAME_PAUSED':
      return {
        ...state,
        status: 'paused'
      };
      
    case 'GAME_RESUMED':
      return {
        ...state,
        status: 'active'
      };
      
    case 'SESSION_ENDED':
      return {
        ...state,
        status: 'completed',
        endedAt: new Date()
      };
      
    case 'SESSION_RESET':
      return {
        ...initialState,
        sessionId: action.payload.newSessionId,
        qrCodeUrl: action.payload.qrCodeUrl,
        createdAt: new Date(),
        status: 'waiting'
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
      
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
      
    case 'UPDATE_GAME_STATE':
      return {
        ...state,
        ...action.payload
      };
      
    case 'RESET_STATE':
      return initialState;
      
    default:
      return state;
  }
}

// Create context
interface GameStateContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  joinSession: (sessionId: string) => Promise<void>;
  joinGame: (playerName: string) => void;
  submitAnswer: (choiceIndex: number) => void;
  requestSong: (songRequest: string) => void;
  resetGame: () => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

// Provider props
interface GameStateProviderProps {
  children: ReactNode;
}

// Provider component
export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { socket, connect, emit, on, off, isConnected } = useSocket();
  
  // Join a session
  const joinSession = async (sessionId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Connect to socket for this session
      connect(sessionId);
      
      // Fetch session details from API
      const response = await fetch(`/api/session/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to join session');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        dispatch({ 
          type: 'SET_SESSION', 
          payload: { 
            sessionId: data.data.sessionId, 
            qrCodeUrl: data.data.qrCodeUrl || '' 
          } 
        });
        
        // Update settings if available
        if (data.data.settings) {
          dispatch({ 
            type: 'UPDATE_GAME_STATE', 
            payload: { settings: data.data.settings } 
          });
        }
      } else {
        throw new Error(data.message || 'Failed to join session');
      }
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };
  
  // Join game as a player
  const joinGame = (playerName: string) => {
    if (!state.sessionId || !isConnected) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Cannot join game: Not connected to session' 
      });
      return;
    }
    
    // Send join request
    emit('player:join', { 
      name: playerName,
      device: 'tablet'
    });
  };
  
  // Submit an answer to the current question
  const submitAnswer = (choiceIndex: number) => {
    if (!state.currentPlayerId || !state.currentQuestion) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Cannot submit answer: No active question or player' 
      });
      return;
    }
    
    // Update local state
    dispatch({ type: 'SELECT_ANSWER', payload: { choiceIndex } });
    
    // Send answer to server
    emit('answer:submit', { 
      playerId: state.currentPlayerId,
      choiceIndex
    });
  };
  
  // Request a song
  const requestSong = (songRequest: string) => {
    if (!state.currentPlayerId) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Cannot request song: Not joined as a player' 
      });
      return;
    }
    
    emit('song:request', {
      playerId: state.currentPlayerId,
      songRequest
    });
  };
  
  // Reset game state
  const resetGame = () => {
    dispatch({ type: 'RESET_STATE' });
  };
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;
    
    // Player events
    on('player:joined', (data) => {
      dispatch({ 
        type: 'SET_PLAYER', 
        payload: { 
          playerId: data.playerId, 
          name: data.name 
        } 
      });
      
      // Add self to players list
      dispatch({ 
        type: 'PLAYER_JOINED', 
        payload: {
          playerId: data.playerId,
          name: data.name,
          score: 0,
          isConnected: true,
          joinedAt: new Date()
        } 
      });
    });
    
    on('player:new', (data) => {
      dispatch({ 
        type: 'PLAYER_JOINED', 
        payload: {
          playerId: data.playerId,
          name: data.name,
          score: 0,
          isConnected: true,
          joinedAt: new Date()
        } 
      });
    });
    
    on('player:left', (data) => {
      dispatch({ 
        type: 'PLAYER_LEFT', 
        payload: { 
          playerId: data.playerId 
        } 
      });
    });
    
    // Game flow events
    on('game:countdown', (data) => {
      dispatch({ 
        type: 'GAME_COUNTDOWN', 
        payload: { 
          seconds: data.seconds 
        } 
      });
    });
    
    on('game:started', (data) => {
      dispatch({ 
        type: 'GAME_STARTED', 
        payload: { 
          totalQuestions: data.totalQuestions,
          startedAt: new Date()
        } 
      });
    });
    
    on('game:paused', () => {
      dispatch({ type: 'GAME_PAUSED' });
    });
    
    on('game:resumed', () => {
      dispatch({ type: 'GAME_RESUMED' });
    });
    
    on('game:complete', (data) => {
      dispatch({ 
        type: 'GAME_COMPLETED', 
        payload: { 
          finalScores: data.finalScores,
          gameDuration: data.gameDuration
        } 
      });
    });
    
    // Question and answer events
    on('question', (data) => {
      dispatch({ 
        type: 'SET_QUESTION', 
        payload: {
          index: data.index,
          text: data.text,
          category: data.category,
          difficulty: data.difficulty,
          choices: data.choices,
          timeLimit: data.timeLimit,
          askedAt: new Date(data.askedAt)
        } 
      });
    });
    
    on('answer:result', (data) => {
      dispatch({ 
        type: 'ANSWER_RESULT', 
        payload: {
          correct: data.correct,
          points: data.points,
          totalScore: data.totalScore,
          correctAnswer: data.correctAnswer
        } 
      });
    });
    
    on('answer:reveal', (data) => {
      dispatch({ 
        type: 'REVEAL_ANSWER', 
        payload: {
          correctAnswerIndex: data.correctAnswerIndex,
          explanation: data.explanation
        } 
      });
    });
    
    on('scores:update', (data) => {
      dispatch({ 
        type: 'UPDATE_SCORES', 
        payload: {
          playerScores: data.playerScores,
          isComplete: data.isComplete
        } 
      });
    });
    
    // Session management events
    on('session:ended', () => {
      dispatch({ type: 'SESSION_ENDED' });
    });
    
    on('session:reset', (data) => {
      dispatch({ 
        type: 'SESSION_RESET', 
        payload: {
          newSessionId: data.newSessionId,
          qrCodeUrl: data.qrCodeUrl || ''
        } 
      });
    });
    
    // Game state updates
    on('game:state:update', (data) => {
      // Complex state update based on full game state
      if (data.status) {
        dispatch({ 
          type: 'UPDATE_GAME_STATE', 
          payload: { status: data.status as GameStatus } 
        });
      }
      
      if (data.players) {
        dispatch({ 
          type: 'UPDATE_SCORES', 
          payload: { playerScores: data.players } 
        });
      }
      
      if (data.question) {
        dispatch({ 
          type: 'SET_QUESTION', 
          payload: data.question 
        });
      }
      
      if (data.playerScore !== undefined) {
        dispatch({ 
          type: 'UPDATE_GAME_STATE', 
          payload: { playerScore: data.playerScore } 
        });
      }
    });
    
    // Error handling
    on('error', (data) => {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: data.message 
      });
    });
    
    // Clean up event listeners on unmount
    return () => {
      off('player:joined');
      off('player:new');
      off('player:left');
      off('game:countdown');
      off('game:started');
      off('game:paused');
      off('game:resumed');
      off('game:complete');
      off('question');
      off('answer:result');
      off('answer:reveal');
      off('scores:update');
      off('session:ended');
      off('session:reset');
      off('game:state:update');
      off('error');
    };
  }, [socket, on, off]);
  
  // Context value
  const value = {
    state,
    dispatch,
    joinSession,
    joinGame,
    submitAnswer,
    requestSong,
    resetGame
  };
  
  return (
    <GameStateContext.Provider value={value}>
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
