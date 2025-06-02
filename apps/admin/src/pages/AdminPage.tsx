import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useGameState } from '../context/GameStateContext';
import { useToast } from '../context/ToastContext';
import AppLayout from '../components/layout/AppLayout';
import {
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  PlusIcon,
  QrCodeIcon,
  UserGroupIcon,
  ClockIcon,
  TrophyIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const AdminPage = () => {
  const navigate = useNavigate();
  const { 
    socket, 
    connectionState, 
    sessionId, 
    createSession, 
    resetSession, 
    endSession, 
    startGame, 
    pauseGame, 
    resumeGame 
  } = useSocket();
  const { gameState, adminStats, isLoading, fetchGameState, fetchAdminStats } = useGameState();
  const { showToast } = useToast();
  const [qrCodeVisible, setQrCodeVisible] = useState(false);

  // Fetch admin stats on component mount
  useEffect(() => {
    fetchAdminStats();
    
    // Refresh stats every 30 seconds
    const intervalId = setInterval(() => {
      fetchAdminStats();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [fetchAdminStats]);

  // Fetch game state when session ID changes
  useEffect(() => {
    if (sessionId) {
      fetchGameState(sessionId);
    }
  }, [sessionId, fetchGameState]);

  // Handle creating a new session
  const handleCreateSession = () => {
    if (connectionState !== 'connected') {
      showToast('Cannot create session: not connected to server', 'error');
      return;
    }
    
    createSession();
    showToast('Creating new game session...', 'info');
  };

  // Handle resetting the current session
  const handleResetSession = () => {
    if (!gameState.sessionId) {
      showToast('No active session to reset', 'warning');
      return;
    }
    
    resetSession(gameState.sessionId);
  };

  // Handle ending the current session
  const handleEndSession = () => {
    if (!gameState.sessionId) {
      showToast('No active session to end', 'warning');
      return;
    }
    
    endSession(gameState.sessionId);
  };

  // Handle starting the game
  const handleStartGame = () => {
    if (!gameState.sessionId) {
      showToast('No active session to start', 'warning');
      return;
    }
    
    if (gameState.players.length === 0) {
      showToast('Cannot start game: no players have joined', 'warning');
      return;
    }
    
    startGame(gameState.sessionId);
  };

  // Handle pausing/resuming the game
  const handlePauseResumeGame = () => {
    if (!gameState.sessionId) {
      showToast('No active session to pause/resume', 'warning');
      return;
    }
    
    if (gameState.status === 'paused') {
      resumeGame(gameState.sessionId);
    } else if (gameState.status === 'active') {
      pauseGame(gameState.sessionId);
    } else {
      showToast(`Cannot pause/resume game in ${gameState.status} state`, 'warning');
    }
  };

  // Toggle QR code visibility
  const toggleQrCode = () => {
    setQrCodeVisible(!qrCodeVisible);
  };

  // Get status badge based on game state
  const getStatusBadge = () => {
    switch (gameState.status) {
      case 'waiting':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">Waiting for Players</span>;
      case 'active':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Game Active</span>;
      case 'paused':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">Game Paused</span>;
      case 'completed':
        return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">Game Completed</span>;
      case 'error':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">Error</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">Initializing</span>;
    }
  };

  return (
    <AppLayout title="Admin Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Control Panel */}
        <div className="admin-card lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Session Control</h3>
            {getStatusBadge()}
          </div>
          
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={handleCreateSession}
              className="admin-button-primary flex items-center"
              disabled={connectionState !== 'connected'}
            >
              <PlusIcon className="h-5 w-5 mr-1" />
              Create New Session
            </button>
            
            <button
              onClick={handleResetSession}
              className="admin-button-secondary flex items-center"
              disabled={!gameState.sessionId || gameState.status === 'initializing'}
            >
              <ArrowPathIcon className="h-5 w-5 mr-1" />
              Reset Session
            </button>
            
            <button
              onClick={handleEndSession}
              className="admin-button-danger flex items-center"
              disabled={!gameState.sessionId || gameState.status === 'initializing'}
            >
              <StopIcon className="h-5 w-5 mr-1" />
              End Session
            </button>
            
            {gameState.status === 'waiting' && (
              <button
                onClick={handleStartGame}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center"
                disabled={!gameState.sessionId || gameState.players.length === 0}
              >
                <PlayIcon className="h-5 w-5 mr-1" />
                Start Game
              </button>
            )}
            
            {(gameState.status === 'active' || gameState.status === 'paused') && (
              <button
                onClick={handlePauseResumeGame}
                className={clsx(
                  "font-medium py-2 px-4 rounded-md transition-colors flex items-center",
                  gameState.status === 'paused' 
                    ? "bg-green-600 hover:bg-green-700 text-white" 
                    : "bg-yellow-600 hover:bg-yellow-700 text-white"
                )}
                disabled={!gameState.sessionId}
              >
                {gameState.status === 'paused' ? (
                  <>
                    <PlayIcon className="h-5 w-5 mr-1" />
                    Resume Game
                  </>
                ) : (
                  <>
                    <PauseIcon className="h-5 w-5 mr-1" />
                    Pause Game
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Session Info */}
          {gameState.sessionId && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-lg font-medium">Session Information</h4>
                <button
                  onClick={toggleQrCode}
                  className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                >
                  <QrCodeIcon className="h-4 w-4 mr-1" />
                  {qrCodeVisible ? 'Hide QR Code' : 'Show QR Code'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-700">
                    <span className="font-medium">Session ID:</span>{' '}
                    <span className="font-mono">{gameState.sessionId}</span>
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Status:</span>{' '}
                    {gameState.status}
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Players:</span>{' '}
                    {gameState.connectedPlayers} / {gameState.maxPlayers}
                  </p>
                  {gameState.currentQuestion && (
                    <p className="text-gray-700">
                      <span className="font-medium">Current Question:</span>{' '}
                      {gameState.currentQuestion.index + 1} of {gameState.currentQuestion.total}
                    </p>
                  )}
                </div>
                
                {qrCodeVisible && gameState.qrCodeUrl && (
                  <div className="flex justify-center items-center p-2 bg-white rounded-lg border border-gray-200">
                    <img 
                      src={gameState.qrCodeUrl} 
                      alt="Session QR Code" 
                      className="max-w-full h-auto max-h-40" 
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Current Question Display */}
          {gameState.currentQuestion && (
            <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center mb-2">
                <QuestionMarkCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
                <h4 className="text-lg font-medium">Current Question</h4>
              </div>
              <p className="text-gray-800 mb-2">{gameState.currentQuestion.text}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                {gameState.currentQuestion.choices.map((choice, index) => (
                  <div 
                    key={index}
                    className={clsx(
                      "p-2 rounded border",
                      gameState.status === 'revealed' && gameState.currentQuestion?.correctAnswerIndex === index
                        ? "bg-green-100 border-green-300"
                        : "bg-gray-50 border-gray-200"
                    )}
                  >
                    {choice}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Category: {gameState.currentQuestion.category}</span>
                <span>Difficulty: {gameState.currentQuestion.difficulty}</span>
                {gameState.currentQuestion.timeRemaining !== undefined && (
                  <span className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    Time: {gameState.currentQuestion.timeRemaining}s
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Stats Overview */}
        <div className="admin-card">
          <h3 className="text-xl font-semibold mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600 mb-1">Active Sessions</p>
              <p className="text-2xl font-bold">{adminStats.activeSessions}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 mb-1">Total Players</p>
              <p className="text-2xl font-bold">{adminStats.totalPlayers}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 mb-1">Top Score</p>
              <p className="text-2xl font-bold">{adminStats.topScore}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-600 mb-1">Games Today</p>
              <p className="text-2xl font-bold">{adminStats.sessionsToday}</p>
            </div>
          </div>
          
          {/* Popular Categories */}
          <h4 className="text-lg font-medium mb-2">Popular Categories</h4>
          <div className="space-y-2 mb-6">
            {adminStats.popularCategories.length > 0 ? (
              adminStats.popularCategories.slice(0, 3).map((category, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-700">{category.category}</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                    {category.count} games
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm italic">No category data available</p>
            )}
          </div>
        </div>
        
        {/* Connected Players */}
        <div className="admin-card lg:col-span-3">
          <div className="flex items-center mb-4">
            <UserGroupIcon className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-xl font-semibold">Connected Players</h3>
          </div>
          
          {gameState.players && gameState.players.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {gameState.players.map((player) => (
                    <tr key={player.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-800 font-medium">
                              {player.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{player.name}</div>
                            <div className="text-xs text-gray-500">{player.id.substring(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <TrophyIcon className="h-4 w-4 text-yellow-500 mr-1" />
                          <span className="text-sm text-gray-900">{player.score}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={clsx(
                          "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                          player.isActive 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        )}>
                          {player.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.lastActive 
                          ? new Date(player.lastActive).toLocaleTimeString() 
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No players have joined this session yet</p>
              {gameState.qrCodeUrl && (
                <button
                  onClick={toggleQrCode}
                  className="mt-2 text-blue-600 hover:text-blue-800 flex items-center mx-auto"
                >
                  <QrCodeIcon className="h-4 w-4 mr-1" />
                  {qrCodeVisible ? 'Hide QR Code' : 'Show QR Code to Players'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminPage;
