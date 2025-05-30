import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useGameState } from '../context/GameStateContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  ArrowPathIcon,
  PlayIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

const QRDisplayPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state, joinSession, resetGame } = useGameState();
  const { isConnected, connectionState } = useSocket();
  const { addToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  
  // Fetch session details and join session
  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }
    
    const fetchSessionDetails = async () => {
      try {
        setIsLoading(true);
        
        // Fetch session details from API
        const response = await fetch(`/api/session/${sessionId}`, {
          headers: {
            'x-admin-token': localStorage.getItem('adminToken') || 'taps-tokens-admin-secret'
          }
        });
        
        if (!response.ok) {
          throw new Error('Session not found or expired');
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
          setSessionDetails(data.data);
          
          // Join the session via socket
          await joinSession(sessionId);
        } else {
          throw new Error(data.message || 'Failed to join session');
        }
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Error',
          message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
        
        // Navigate back to home on error
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSessionDetails();
    
    // Cleanup on unmount
    return () => {
      resetGame();
    };
  }, [sessionId, joinSession, navigate, addToast, resetGame]);
  
  // Navigate to game page when game starts
  useEffect(() => {
    if (state.status === 'active' && sessionId) {
      navigate(`/game/${sessionId}`);
    }
  }, [state.status, sessionId, navigate]);
  
  // Handle starting the game
  const handleStartGame = async () => {
    if (!sessionId || state.players.length === 0) {
      addToast({
        type: 'warning',
        title: 'Cannot Start Game',
        message: 'At least one player must join before starting the game'
      });
      return;
    }
    
    try {
      setIsStartingGame(true);
      
      // Call admin API to start the game
      const response = await fetch(`/api/session/${sessionId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('adminToken') || 'taps-tokens-admin-secret'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to start game');
      }
      
      // Game will start via socket events
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsStartingGame(false);
    }
  };
  
  // Handle resetting the session
  const handleResetSession = async () => {
    if (!sessionId) return;
    
    try {
      setIsResettingSession(true);
      
      // Call admin API to reset the session
      const response = await fetch(`/api/session/${sessionId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('adminToken') || 'taps-tokens-admin-secret'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset session');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addToast({
          type: 'success',
          title: 'Session Reset',
          message: 'Session has been reset successfully'
        });
        
        // Navigate to the new session QR page
        navigate(`/qr/${data.data.newSessionId}`);
      } else {
        throw new Error(data.message || 'Failed to reset session');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsResettingSession(false);
    }
  };
  
  // Format session creation time
  const formatSessionTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Loading session...</p>
      </div>
    );
  }
  
  // Connection error state
  if (!isConnected && connectionState === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <XMarkIcon className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-red-600 mb-2">Connection Error</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">
          Unable to connect to the game server. Please check your internet connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          <ArrowPathIcon className="w-5 h-5 mr-2" />
          Retry Connection
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 py-8">
      {/* Session Header */}
      <div className="w-full mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
          Scan to Join the Game
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Session ID: <span className="font-mono font-medium">{sessionId}</span>
        </p>
        <div className="flex items-center justify-center mt-2 text-sm text-slate-500 dark:text-slate-400">
          <ClockIcon className="w-4 h-4 mr-1" />
          Created at {sessionDetails?.createdAt && formatSessionTime(sessionDetails.createdAt)}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {/* QR Code Section */}
        <div className="md:col-span-2">
          <div className="qr-container bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
            {state.qrCodeUrl ? (
              <div className="qr-code p-4 bg-white rounded-lg">
                <QRCode
                  value={state.qrCodeUrl}
                  size={280}
                  level="H"
                  className="mx-auto"
                />
              </div>
            ) : (
              <div className="w-64 h-64 md:w-80 md:h-80 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mx-auto"></div>
            )}
            
            <div className="qr-instructions mt-6">
              <p className="text-slate-700 dark:text-slate-300">
                Scan this QR code with your phone camera to join the trivia game
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Or go to <span className="font-medium">play.tapstoken.com</span> and enter session code:
              </p>
              <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xl mt-1">
                {sessionId?.substring(0, 8)}
              </p>
            </div>
          </div>
        </div>
        
        {/* Players & Controls Section */}
        <div className="md:col-span-1 flex flex-col gap-6">
          {/* Players List */}
          <div className="card p-5">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
              <UserGroupIcon className="w-5 h-5 mr-2" />
              Players
              <span className="ml-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-sm rounded-full">
                {state.players.length}
              </span>
            </h2>
            
            {state.players.length === 0 ? (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                <p>Waiting for players to join...</p>
                <div className="mt-2 flex justify-center">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {state.players.map((player) => (
                  <li 
                    key={player.playerId}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      player.isConnected
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center">
                      {player.isConnected ? (
                        <CheckCircleIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400 mr-2" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-slate-400 mr-2" />
                      )}
                      <span className={`font-medium ${
                        player.isConnected
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {player.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {player.isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Game Controls */}
          <div className="card p-5">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">
              Game Controls
            </h2>
            
            <div className="space-y-3">
              <button
                onClick={handleStartGame}
                disabled={isStartingGame || state.players.length === 0}
                className={`btn w-full ${
                  state.players.length === 0
                    ? 'bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed'
                    : 'btn-success'
                }`}
              >
                {isStartingGame ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting...
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-5 h-5 mr-2" />
                    Start Game
                  </>
                )}
              </button>
              
              <button
                onClick={handleResetSession}
                disabled={isResettingSession}
                className="btn btn-outline w-full"
              >
                {isResettingSession ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-600 dark:text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="w-5 h-5 mr-2" />
                    Reset Session
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Instructions */}
          <div className="card p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
            <div className="flex items-start">
              <InformationCircleIcon className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-800 dark:text-blue-300">Instructions</h3>
                <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Wait for all riders to join</li>
                  <li>• Press "Start Game" when ready</li>
                  <li>• Players answer on their phones</li>
                  <li>• Reset for new riders</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRDisplayPage;
