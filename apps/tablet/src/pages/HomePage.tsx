import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusCircleIcon, 
  ArrowRightCircleIcon, 
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { useGameState } from '../context/GameStateContext';
import { useToast } from '../context/ToastContext';

interface Stats {
  activeSessions: number;
  totalPlayers: number;
  topScore: {
    score: number;
    alias: string;
  } | null;
  recentGames: number;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { resetGame } = useGameState();
  const { addToast } = useToast();
  
  const [sessionId, setSessionId] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isJoiningSession, setIsJoiningSession] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  
  // Reset game state when visiting home page
  useEffect(() => {
    resetGame();
  }, [resetGame]);
  
  // Fetch quick stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        
        // Fetch active sessions
        const sessionsResponse = await fetch('/api/session/active', {
          headers: {
            'x-admin-token': localStorage.getItem('adminToken') || 'taps-tokens-admin-secret'
          }
        });
        
        // Fetch leaderboard stats
        const leaderboardResponse = await fetch('/api/leaderboard/stats');
        
        if (!sessionsResponse.ok || !leaderboardResponse.ok) {
          throw new Error('Failed to fetch stats');
        }
        
        const sessionsData = await sessionsResponse.json();
        const leaderboardData = await leaderboardResponse.json();
        
        setStats({
          activeSessions: sessionsData.data?.count || 0,
          totalPlayers: leaderboardData.data?.totalEntries || 0,
          topScore: leaderboardData.data?.topScore || null,
          recentGames: leaderboardData.data?.activity?.daily || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Don't show error toast for stats, just log it
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    fetchStats();
  }, []);
  
  // Create a new game session
  const handleCreateSession = async () => {
    try {
      setIsCreatingSession(true);
      
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('adminToken') || 'taps-tokens-admin-secret'
        },
        body: JSON.stringify({
          maxPlayers: 4,
          questionCount: 10,
          difficulty: 'mixed',
          timeLimit: 30
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addToast({
          type: 'success',
          title: 'Session Created',
          message: 'New game session created successfully!'
        });
        
        // Navigate to QR display page
        navigate(`/qr/${data.data.sessionId}`);
      } else {
        throw new Error(data.message || 'Failed to create session');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsCreatingSession(false);
    }
  };
  
  // Join an existing session
  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionId.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Session ID',
        message: 'Please enter a session ID to join'
      });
      return;
    }
    
    try {
      setIsJoiningSession(true);
      
      // Validate session exists
      const response = await fetch(`/api/session/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Session not found');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Navigate to QR display page
        navigate(`/qr/${sessionId}`);
      } else {
        throw new Error(data.message || 'Failed to join session');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsJoiningSession(false);
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">
          Welcome to Taps Tokens Trivia
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          The ultimate ride-share trivia experience. Create a new game session or join an existing one.
        </p>
      </div>
      
      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Create Session */}
        <div className="card p-6 hover-lift">
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center">
            <PlusCircleIcon className="w-7 h-7 mr-2" />
            Create New Session
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Start a new trivia game session for your passengers. They'll be able to join using a QR code.
          </p>
          <button
            onClick={handleCreateSession}
            disabled={isCreatingSession}
            className="btn btn-primary w-full"
          >
            {isCreatingSession ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              <>Create New Game</>
            )}
          </button>
        </div>
        
        {/* Join Session */}
        <div className="card p-6 hover-lift">
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center">
            <ArrowRightCircleIcon className="w-7 h-7 mr-2" />
            Join Existing Session
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Enter a session ID to join an existing game that's already in progress.
          </p>
          <form onSubmit={handleJoinSession} className="flex flex-col gap-4">
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter Session ID"
              className="px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              disabled={isJoiningSession}
            />
            <button
              type="submit"
              disabled={isJoiningSession || !sessionId.trim()}
              className="btn btn-secondary"
            >
              {isJoiningSession ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Joining...
                </>
              ) : (
                <>Join Session</>
              )}
            </button>
          </form>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center">
          <ChartBarIcon className="w-7 h-7 mr-2" />
          Quick Stats
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Sessions */}
          <div className="card p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Active Sessions</p>
                {isLoadingStats ? (
                  <div className="h-8 w-16 bg-blue-200 dark:bg-blue-700 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats?.activeSessions || 0}</p>
                )}
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-full">
                <ClockIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
              </div>
            </div>
          </div>
          
          {/* Total Players */}
          <div className="card p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Players</p>
                {isLoadingStats ? (
                  <div className="h-8 w-16 bg-emerald-200 dark:bg-emerald-700 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{stats?.totalPlayers || 0}</p>
                )}
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-800 rounded-full">
                <UserGroupIcon className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
              </div>
            </div>
          </div>
          
          {/* Top Score */}
          <div className="card p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Top Score</p>
                {isLoadingStats ? (
                  <div className="h-8 w-16 bg-amber-200 dark:bg-amber-700 rounded animate-pulse mt-1"></div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{stats?.topScore?.score || 0}</p>
                    {stats?.topScore?.alias && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 truncate max-w-[120px]">by {stats.topScore.alias}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-800 rounded-full">
                <TrophyIcon className="w-6 h-6 text-amber-500 dark:text-amber-400" />
              </div>
            </div>
          </div>
          
          {/* Recent Games */}
          <div className="card p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Games Today</p>
                {isLoadingStats ? (
                  <div className="h-8 w-16 bg-purple-200 dark:bg-purple-700 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">{stats?.recentGames || 0}</p>
                )}
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-800 rounded-full">
                <ChartBarIcon className="w-6 h-6 text-purple-500 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Driver Instructions */}
      <div className="card p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
          Driver Instructions
        </h2>
        <div className="space-y-4 text-slate-600 dark:text-slate-300">
          <p>
            <span className="font-semibold">1.</span> Create a new game session at the start of each ride.
          </p>
          <p>
            <span className="font-semibold">2.</span> The tablet will display a QR code for passengers to scan.
          </p>
          <p>
            <span className="font-semibold">3.</span> Passengers join the game on their phones and answer trivia questions.
          </p>
          <p>
            <span className="font-semibold">4.</span> When the ride is complete, you can view scores and reset for the next passenger.
          </p>
          <p>
            <span className="font-semibold">5.</span> Use the admin panel to manage sessions and view leaderboards.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
