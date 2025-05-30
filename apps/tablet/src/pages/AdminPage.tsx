import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  Cog6ToothIcon,
  UserGroupIcon,
  TrophyIcon,
  ChartBarIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
  CheckCircleIcon,
  PlayIcon,
  StopIcon,
  ArrowRightOnRectangleIcon,
  LockClosedIcon,
  LockOpenIcon,
  QrCodeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

// Tab types
type AdminTab = 'sessions' | 'leaderboard' | 'stats' | 'settings';

// Session types
interface Session {
  sessionId: string;
  status: 'waiting' | 'active' | 'paused' | 'completed';
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  playerCount: number;
  currentQuestion?: number;
  totalQuestions?: number;
  qrCodeUrl?: string;
}

// Leaderboard types
interface LeaderboardEntry {
  rank: number;
  alias: string;
  score: number;
  date: string;
  metadata?: {
    questionCount?: number;
    correctAnswers?: number;
    totalQuestions?: number;
  };
}

// Stats types
interface SystemStats {
  sessions: {
    active: number;
    total: number;
    today: number;
  };
  players: {
    total: number;
  };
  leaderboard: {
    entries: number;
    submittedToday: number;
  };
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // State
  const [activeTab, setActiveTab] = useState<AdminTab>('sessions');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  
  // Sessions state
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [isLoadingSessionDetails, setIsLoadingSessionDetails] = useState<boolean>(false);
  
  // Leaderboard state
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<string>('all-time');
  const [leaderboardLimit, setLeaderboardLimit] = useState<number>(20);
  
  // Stats state
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  
  // Session creation state
  const [sessionSettings, setSessionSettings] = useState({
    maxPlayers: 4,
    questionCount: 10,
    difficulty: 'mixed',
    timeLimit: 30,
  });
  
  // Check for saved admin token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      setAdminToken(savedToken);
      handleAuthenticate(savedToken);
    }
  }, []);
  
  // Authentication handler
  const handleAuthenticate = async (token: string = adminToken) => {
    if (!token.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Token',
        message: 'Please enter an admin token',
      });
      return;
    }
    
    try {
      setIsAuthenticating(true);
      
      // Validate token with a simple API call
      const response = await fetch('/api/session/active', {
        headers: {
          'x-admin-token': token,
        },
      });
      
      if (!response.ok) {
        throw new Error('Invalid admin token');
      }
      
      // Store token and set authenticated
      localStorage.setItem('adminToken', token);
      setIsAuthenticated(true);
      
      addToast({
        type: 'success',
        title: 'Authenticated',
        message: 'Admin access granted',
      });
      
      // Load initial data
      fetchSessions();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Authentication Failed',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      
      // Clear token
      localStorage.removeItem('adminToken');
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setAdminToken('');
    
    addToast({
      type: 'info',
      title: 'Logged Out',
      message: 'Admin session ended',
    });
  };
  
  // Fetch sessions
  const fetchSessions = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoadingSessions(true);
      
      const response = await fetch('/api/session/active', {
        headers: {
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setActiveSessions(data.data.sessions || []);
        
        // Also fetch recent completed sessions
        try {
          const recentResponse = await fetch('/api/session/recent', {
            headers: {
              'x-admin-token': localStorage.getItem('adminToken') || '',
            },
          });
          
          if (recentResponse.ok) {
            const recentData = await recentResponse.json();
            if (recentData.status === 'success') {
              setRecentSessions(recentData.data.sessions || []);
            }
          }
        } catch (error) {
          console.error('Error fetching recent sessions:', error);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch sessions');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoadingSessions(false);
    }
  };
  
  // Fetch session details
  const fetchSessionDetails = async (sessionId: string) => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoadingSessionDetails(true);
      
      const response = await fetch(`/api/session/${sessionId}`, {
        headers: {
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch session details');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setSessionDetails(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch session details');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoadingSessionDetails(false);
    }
  };
  
  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoadingLeaderboard(true);
      
      const response = await fetch(`/api/leaderboard/top/${leaderboardLimit}?period=${leaderboardPeriod}`, {
        headers: {
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setLeaderboardEntries(data.data.scores || []);
      } else {
        throw new Error(data.message || 'Failed to fetch leaderboard');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };
  
  // Fetch stats
  const fetchStats = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoadingStats(true);
      
      // Fetch basic stats from health endpoint
      const response = await fetch('/api/health', {
        headers: {
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const data = await response.json();
      
      // Also fetch leaderboard stats
      const leaderboardResponse = await fetch('/api/leaderboard/stats', {
        headers: {
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      let leaderboardData = { data: { entries: 0, submittedToday: 0 } };
      
      if (leaderboardResponse.ok) {
        leaderboardData = await leaderboardResponse.json();
      }
      
      // Combine stats
      setSystemStats({
        sessions: {
          active: activeSessions.length,
          total: data.activeSessions || 0,
          today: data.activeSessions || 0, // This is a placeholder, actual API would return this
        },
        players: {
          total: data.totalPlayers || 0,
        },
        leaderboard: {
          entries: leaderboardData.data.entries || 0,
          submittedToday: leaderboardData.data.submittedToday || 0,
        },
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoadingStats(false);
    }
  };
  
  // Create new session
  const handleCreateSession = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsCreatingSession(true);
      
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
        body: JSON.stringify(sessionSettings),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addToast({
          type: 'success',
          title: 'Session Created',
          message: 'New game session created successfully!',
        });
        
        // Refresh sessions list
        fetchSessions();
      } else {
        throw new Error(data.message || 'Failed to create session');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsCreatingSession(false);
    }
  };
  
  // Session control handlers
  const handleStartGame = async (sessionId: string) => {
    if (!isAuthenticated) return;
    
    try {
      const response = await fetch(`/api/session/${sessionId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to start game');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addToast({
          type: 'success',
          title: 'Game Started',
          message: 'Game started successfully!',
        });
        
        // Refresh sessions list
        fetchSessions();
        
        // Refresh session details if this is the selected session
        if (selectedSession?.sessionId === sessionId) {
          fetchSessionDetails(sessionId);
        }
      } else {
        throw new Error(data.message || 'Failed to start game');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };
  
  const handleEndSession = async (sessionId: string) => {
    if (!isAuthenticated) return;
    
    try {
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to end session');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addToast({
          type: 'success',
          title: 'Session Ended',
          message: 'Session ended successfully!',
        });
        
        // Refresh sessions list
        fetchSessions();
        
        // Refresh session details if this is the selected session
        if (selectedSession?.sessionId === sessionId) {
          fetchSessionDetails(sessionId);
        }
      } else {
        throw new Error(data.message || 'Failed to end session');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };
  
  const handleResetSession = async (sessionId: string) => {
    if (!isAuthenticated) return;
    
    try {
      const response = await fetch(`/api/session/${sessionId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset session');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addToast({
          type: 'success',
          title: 'Session Reset',
          message: 'Session reset successfully!',
        });
        
        // Refresh sessions list
        fetchSessions();
        
        // Clear selected session
        if (selectedSession?.sessionId === sessionId) {
          setSelectedSession(null);
          setSessionDetails(null);
        }
      } else {
        throw new Error(data.message || 'Failed to reset session');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };
  
  // View session in QR display
  const handleViewSession = (sessionId: string) => {
    navigate(`/qr/${sessionId}`);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  
  // Format duration
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m 0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  // Authentication form
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-xl dark:bg-slate-800">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 bg-indigo-100 rounded-full dark:bg-indigo-900/30">
            <LockClosedIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          
          <h2 className="mb-6 text-2xl font-bold text-center text-slate-800 dark:text-slate-200">
            Admin Authentication
          </h2>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleAuthenticate();
          }}>
            <div className="mb-4">
              <label htmlFor="adminToken" className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Admin Token
              </label>
              <input
                type="password"
                id="adminToken"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                placeholder="Enter admin token"
                required
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Default token for development: taps-tokens-admin-secret
              </p>
            </div>
            
            <button
              type="submit"
              disabled={isAuthenticating || !adminToken.trim()}
              className="w-full px-4 py-2 font-medium text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isAuthenticating ? (
                <>
                  <svg className="inline w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  <LockOpenIcon className="inline w-4 h-4 mr-2 -ml-1" />
                  Authenticate
                </>
              )}
            </button>
          </form>
          
          <p className="mt-6 text-sm text-center text-slate-500 dark:text-slate-400">
            This area is restricted to authorized personnel only.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Admin Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center">
          <Cog6ToothIcon className="w-8 h-8 mr-2" />
          Admin Dashboard
        </h1>
        
        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center px-3 py-1.5 text-sm font-medium text-red-600 transition-colors bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 mr-1" />
            Logout
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="flex items-center px-3 py-1.5 text-sm font-medium transition-colors bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Exit Admin
          </button>
        </div>
      </div>
      
      {/* Admin Tabs */}
      <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 ${
              activeTab === 'sessions'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <UserGroupIcon className="w-5 h-5 mr-2" />
            Sessions
          </button>
          
          <button
            onClick={() => {
              setActiveTab('leaderboard');
              fetchLeaderboard();
            }}
            className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 ${
              activeTab === 'leaderboard'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <TrophyIcon className="w-5 h-5 mr-2" />
            Leaderboard
          </button>
          
          <button
            onClick={() => {
              setActiveTab('stats');
              fetchStats();
            }}
            className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 ${
              activeTab === 'stats'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <ChartBarIcon className="w-5 h-5 mr-2" />
            Statistics
          </button>
        </nav>
      </div>
      
      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div>
          {/* Split View: Sessions List and Session Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sessions List Panel */}
            <div className="lg:col-span-1">
              {/* Quick Actions */}
              <div className="card p-4 mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
                  Quick Actions
                </h3>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={handleCreateSession}
                    disabled={isCreatingSession}
                    className="btn btn-primary"
                  >
                    {isCreatingSession ? (
                      <>
                        <svg className="inline w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusCircleIcon className="w-5 h-5 mr-2" />
                        Create New Session
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={fetchSessions}
                    disabled={isLoadingSessions}
                    className="btn btn-outline"
                  >
                    {isLoadingSessions ? (
                      <>
                        <svg className="inline w-4 h-4 mr-2 -ml-1 text-slate-600 dark:text-slate-300 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className="w-5 h-5 mr-2" />
                        Refresh Sessions
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Active Sessions */}
              <div className="card p-4 mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-emerald-500" />
                  Active Sessions
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full">
                    {activeSessions.length}
                  </span>
                </h3>
                
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <svg className="w-8 h-8 text-indigo-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : activeSessions.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                    <p>No active sessions found</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {activeSessions.map((session) => (
                      <div 
                        key={session.sessionId}
                        className={`p-3 rounded-lg border ${
                          selectedSession?.sessionId === session.sessionId
                            ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700'
                            : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                        } cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors`}
                        onClick={() => {
                          setSelectedSession(session);
                          fetchSessionDetails(session.sessionId);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-sm font-medium text-slate-600 dark:text-slate-300">
                            {session.sessionId.substring(0, 8)}...
                          </div>
                          <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            session.status === 'waiting'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : session.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : session.status === 'paused'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center text-slate-600 dark:text-slate-400">
                            <UserGroupIcon className="w-4 h-4 mr-1" />
                            {session.playerCount} players
                          </div>
                          
                          <div className="text-slate-500 dark:text-slate-400">
                            {formatDate(session.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Recent Sessions */}
              <div className="card p-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-slate-500" />
                  Recent Sessions
                </h3>
                
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <svg className="w-8 h-8 text-indigo-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : recentSessions.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                    <p>No recent sessions found</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {recentSessions.map((session) => (
                      <div 
                        key={session.sessionId}
                        className={`p-3 rounded-lg border ${
                          selectedSession?.sessionId === session.sessionId
                            ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700'
                            : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                        } cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors`}
                        onClick={() => {
                          setSelectedSession(session);
                          fetchSessionDetails(session.sessionId);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-sm font-medium text-slate-600 dark:text-slate-300">
                            {session.sessionId.substring(0, 8)}...
                          </div>
                          <div className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                            Completed
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center text-slate-600 dark:text-slate-400">
                            <UserGroupIcon className="w-4 h-4 mr-1" />
                            {session.playerCount} players
                          </div>
                          
                          <div className="text-slate-500 dark:text-slate-400">
                            {formatDate(session.endedAt || session.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Session Details Panel */}
            <div className="lg:col-span-2">
              {selectedSession ? (
                <div className="card">
                  {/* Session Header */}
                  <div className="card-header bg-indigo-600 text-white">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold flex items-center">
                        Session Details
                      </h3>
                      
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            setSelectedSession(null);
                            setSessionDetails(null);
                          }}
                          className="p-1 text-white rounded hover:bg-indigo-700"
                          aria-label="Close"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {isLoadingSessionDetails ? (
                    <div className="flex items-center justify-center py-16">
                      <svg className="w-12 h-12 text-indigo-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : (
                    <>
                      {/* Session Info */}
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Session ID</p>
                            <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                              {selectedSession.sessionId}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                            <p className={`font-medium ${
                              selectedSession.status === 'waiting'
                                ? 'text-blue-600 dark:text-blue-400'
                                : selectedSession.status === 'active'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : selectedSession.status === 'paused'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-600 dark:text-slate-400'
                            }`}>
                              {selectedSession.status.charAt(0).toUpperCase() + selectedSession.status.slice(1)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Created</p>
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {formatDate(selectedSession.createdAt)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Players</p>
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {sessionDetails?.players?.length || selectedSession.playerCount || 0}
                            </p>
                          </div>
                          
                          {selectedSession.status !== 'waiting' && (
                            <>
                              <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Current Question</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {sessionDetails?.currentQuestion || selectedSession.currentQuestion || 0} / {sessionDetails?.questions?.length || selectedSession.totalQuestions || 0}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Duration</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {sessionDetails?.startedAt && (sessionDetails?.endedAt || new Date()) ? 
                                    formatDuration(Math.round((new Date(sessionDetails.endedAt || new Date()).getTime() - new Date(sessionDetails.startedAt).getTime()) / 1000)) : 
                                    'N/A'
                                  }
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Session Controls */}
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3">
                          Session Controls
                        </h4>
                        
                        <div className="flex flex-wrap gap-2">
                          {selectedSession.status === 'waiting' && (
                            <button
                              onClick={() => handleStartGame(selectedSession.sessionId)}
                              className="btn btn-sm btn-success"
                              disabled={!sessionDetails?.players?.length}
                            >
                              <PlayIcon className="w-4 h-4 mr-1" />
                              Start Game
                            </button>
                          )}
                          
                          {selectedSession.status !== 'completed' && (
                            <>
                              <button
                                onClick={() => handleEndSession(selectedSession.sessionId)}
                                className="btn btn-sm btn-danger"
                              >
                                <StopIcon className="w-4 h-4 mr-1" />
                                End Session
                              </button>
                              
                              <button
                                onClick={() => handleResetSession(selectedSession.sessionId)}
                                className="btn btn-sm btn-secondary"
                              >
                                <ArrowPathIcon className="w-4 h-4 mr-1" />
                                Reset Session
                              </button>
                            </>
                          )}
                          
                          <button
                            onClick={() => handleViewSession(selectedSession.sessionId)}
                            className="btn btn-sm btn-outline"
                          >
                            <EyeIcon className="w-4 h-4 mr-1" />
                            View Session
                          </button>
                          
                          {selectedSession.qrCodeUrl && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedSession.qrCodeUrl);
                                addToast({
                                  type: 'success',
                                  title: 'Copied',
                                  message: 'QR URL copied to clipboard',
                                });
                              }}
                              className="btn btn-sm btn-outline"
                            >
                              <QrCodeIcon className="w-4 h-4 mr-1" />
                              Copy QR URL
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Players List */}
                      <div className="p-4">
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                          <UserGroupIcon className="w-5 h-5 mr-2" />
                          Players
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full">
                            {sessionDetails?.players?.length || 0}
                          </span>
                        </h4>
                        
                        {!sessionDetails?.players?.length ? (
                          <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                            <p>No players have joined yet</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                            {sessionDetails.players.map((player: any) => (
                              <div 
                                key={player.playerId}
                                className={`p-3 rounded-lg border ${
                                  player.isConnected
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                                    {player.isConnected ? (
                                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 mr-1.5" />
                                    ) : (
                                      <XMarkIcon className="w-4 h-4 text-slate-400 mr-1.5" />
                                    )}
                                    {player.name}
                                  </div>
                                  
                                  <div className="text-amber-600 dark:text-amber-400 font-medium">
                                    {player.score || 0}
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                  <div>
                                    Joined: {formatDate(player.joinedAt)}
                                  </div>
                                  
                                  <div>
                                    {player.isConnected ? 'Connected' : 'Disconnected'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8">
                  <QuestionMarkCircleIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                    No Session Selected
                  </h3>
                  <p className="text-center text-slate-500 dark:text-slate-400 mb-6">
                    Select a session from the list to view details or create a new session to get started.
                  </p>
                  <button
                    onClick={handleCreateSession}
                    disabled={isCreatingSession}
                    className="btn btn-primary"
                  >
                    {isCreatingSession ? (
                      <>
                        <svg className="inline w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusCircleIcon className="w-5 h-5 mr-2" />
                        Create New Session
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div>
          {/* Leaderboard Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div>
                <label htmlFor="leaderboardPeriod" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Time Period
                </label>
                <select
                  id="leaderboardPeriod"
                  value={leaderboardPeriod}
                  onChange={(e) => setLeaderboardPeriod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="all-time">All Time</option>
                  <option value="day">Last 24 Hours</option>
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="year">Last Year</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="leaderboardLimit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Entries
                </label>
                <select
                  id="leaderboardLimit"
                  value={leaderboardLimit}
                  onChange={(e) => setLeaderboardLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="10">Top 10</option>
                  <option value="20">Top 20</option>
                  <option value="50">Top 50</option>
                  <option value="100">Top 100</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={fetchLeaderboard}
              disabled={isLoadingLeaderboard}
              className="btn btn-primary"
            >
              {isLoadingLeaderboard ? (
                <>
                  <svg className="inline w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2" />
                  Refresh Leaderboard
                </>
              )}
            </button>
          </div>
          
          {/* Leaderboard Table */}
          <div className="card overflow-hidden">
            <div className="card-header bg-indigo-600 text-white">
              <h3 className="text-xl font-bold flex items-center">
                <TrophyIcon className="w-6 h-6 mr-2" />
                Leaderboard {leaderboardPeriod !== 'all-time' && `(${leaderboardPeriod.charAt(0).toUpperCase() + leaderboardPeriod.slice(1)})`}
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              {isLoadingLeaderboard ? (
                <div className="flex items-center justify-center py-16">
                  <svg className="w-12 h-12 text-indigo-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : leaderboardEntries.length === 0 ? (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                  <p>No leaderboard entries found for this time period</p>
                </div>
              ) : (
                <table className="w-full leaderboard">
                  <thead>
                    <tr>
                      <th className="w-16">Rank</th>
                      <th>Player</th>
                      <th>Date</th>
                      <th className="text-right">Score</th>
                      <th className="text-right hidden md:table-cell">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardEntries.map((entry) => (
                      <tr key={`${entry.alias}-${entry.score}-${entry.date}`}>
                        <td className="text-center">
                          {entry.rank <= 3 ? (
                            <span className="text-2xl" aria-label={`Rank ${entry.rank}`}>
                              {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="w-7 h-7 inline-flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 font-bold">
                              {entry.rank}
                            </span>
                          )}
                        </td>
                        <td className="font-medium text-slate-800 dark:text-slate-200">
                          {entry.alias}
                        </td>
                        <td className="text-slate-600 dark:text-slate-400">
                          {formatDate(entry.date)}
                        </td>
                        <td className="text-right font-bold text-amber-600 dark:text-amber-400">
                          {entry.score}
                        </td>
                        <td className="text-right hidden md:table-cell">
                          {entry.metadata?.correctAnswers && entry.metadata?.totalQuestions ? (
                            <span>
                              {Math.round((entry.metadata.correctAnswers / entry.metadata.totalQuestions) * 100)}%
                              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                                ({entry.metadata.correctAnswers}/{entry.metadata.totalQuestions})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div>
          {/* Stats Controls */}
          <div className="flex justify-end mb-6">
            <button
              onClick={fetchStats}
              disabled={isLoadingStats}
              className="btn btn-primary"
            >
              {isLoadingStats ? (
                <>
                  <svg className="inline w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2" />
                  Refresh Stats
                </>
              )}
            </button>
          </div>
          
          {isLoadingStats ? (
            <div className="flex items-center justify-center py-16">
              <svg className="w-12 h-12 text-indigo-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : !systemStats ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <p>No statistics available. Click "Refresh Stats" to load data.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Session Stats */}
              <div className="card p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                  <UserGroupIcon className="w-6 h-6 mr-2 text-indigo-500" />
                  Session Stats
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Active Sessions</p>
                      <p className="font-bold text-indigo-600 dark:text-indigo-400">{systemStats.sessions.active}</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${Math.min(100, (systemStats.sessions.active / 10) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Sessions Today</p>
                      <p className="font-bold text-indigo-600 dark:text-indigo-400">{systemStats.sessions.today}</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${Math.min(100, (systemStats.sessions.today / 50) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Total Sessions</p>
                      <p className="font-bold text-indigo-600 dark:text-indigo-400">{systemStats.sessions.total}</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${Math.min(100, (systemStats.sessions.total / 1000) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Player Stats */}
              <div className="card p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                  <UserGroupIcon className="w-6 h-6 mr-2 text-emerald-500" />
                  Player Stats
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Total Players</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">{systemStats.players.total}</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${Math.min(100, (systemStats.players.total / 5000) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Players per Session (Avg)</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">
                        {systemStats.sessions.total > 0 
                          ? (systemStats.players.total / systemStats.sessions.total).toFixed(1) 
                          : '0'}
                      </p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${Math.min(100, (systemStats.sessions.total > 0 
                          ? (systemStats.players.total / systemStats.sessions.total / 4) * 100 
                          : 0))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Leaderboard Stats */}
              <div className="card p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                  <TrophyIcon className="w-6 h-6 mr-2 text-amber-500" />
                  Leaderboard Stats
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Total Entries</p>
                      <p className="font-bold text-amber-600 dark:text-amber-400">{systemStats.leaderboard.entries}</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500" 
                        style={{ width: `${Math.min(100, (systemStats.leaderboard.entries / 5000) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Submissions Today</p>
                      <p className="font-bold text-amber-600 dark:text-amber-400">{systemStats.leaderboard.submittedToday}</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500" 
                        style={{ width: `${Math.min(100, (systemStats.leaderboard.submittedToday / 100) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-600 dark:text-slate-400">Submission Rate</p>
                      <p className="font-bold text-amber-600 dark:text-amber-400">
                        {systemStats.players.total > 0 
                          ? `${Math.round((systemStats.leaderboard.entries / systemStats.players.total) * 100)}%` 
                          : '0%'}
                      </p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500" 
                        style={{ width: `${systemStats.players.total > 0 
                          ? Math.min(100, (systemStats.leaderboard.entries / systemStats.players.total) * 100) 
                          : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
