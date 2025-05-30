import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState } from '../context/GameStateContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  TrophyIcon,
  ArrowPathIcon,
  ShareIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  FireIcon,
  XCircleIcon,
  HomeIcon,
  PlusCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

interface LeaderboardSubmission {
  alias: string;
  phone: string;
  score: number;
}

const ResultsPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state, resetGame } = useGameState();
  const { isConnected } = useSocket();
  const { addToast } = useToast();
  
  // Local state
  const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);
  const [isResettingSession, setIsResettingSession] = useState<boolean>(false);
  const [showSubmitForm, setShowSubmitForm] = useState<boolean>(false);
  const [leaderboardSubmission, setLeaderboardSubmission] = useState<LeaderboardSubmission>({
    alias: '',
    phone: '',
    score: 0,
  });
  const [isSharing, setIsSharing] = useState<boolean>(false);
  
  // Redirect if no session or not connected
  useEffect(() => {
    if (!sessionId || (!isConnected && !state.finalScores)) {
      navigate('/');
    }
  }, [sessionId, isConnected, state.finalScores, navigate]);
  
  // Set initial score from game state
  useEffect(() => {
    if (state.playerScore && state.playerName) {
      setLeaderboardSubmission({
        alias: state.playerName,
        phone: '',
        score: state.playerScore,
      });
    }
  }, [state.playerScore, state.playerName]);
  
  // Calculate game statistics
  const calculateStats = () => {
    if (!state.playerAnswers || !state.totalQuestions) {
      return {
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracy: 0,
        questionsAnswered: 0,
        averageTime: 0,
      };
    }
    
    const correctAnswers = state.playerAnswers.filter(a => a.correct).length;
    const questionsAnswered = state.playerAnswers.length;
    const incorrectAnswers = questionsAnswered - correctAnswers;
    const accuracy = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;
    
    // Calculate average time to answer in seconds
    const totalTime = state.playerAnswers.reduce((sum, answer) => sum + answer.timeToAnswer, 0);
    const averageTime = questionsAnswered > 0 ? Math.round((totalTime / questionsAnswered) / 1000) : 0;
    
    return {
      correctAnswers,
      incorrectAnswers,
      accuracy,
      questionsAnswered,
      averageTime,
    };
  };
  
  const stats = calculateStats();
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLeaderboardSubmission(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Submit score to leaderboard
  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionId || !leaderboardSubmission.alias.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please enter a name to submit your score',
      });
      return;
    }
    
    try {
      setIsSubmittingScore(true);
      
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alias: leaderboardSubmission.alias,
          phone: leaderboardSubmission.phone || undefined,
          score: leaderboardSubmission.score || state.playerScore,
          sessionId,
          metadata: {
            questionCount: state.totalQuestions,
            correctAnswers: stats.correctAnswers,
            totalQuestions: stats.questionsAnswered,
            timeSpent: state.endedAt && state.startedAt 
              ? Math.round((new Date(state.endedAt).getTime() - new Date(state.startedAt).getTime()) / 1000)
              : undefined,
            device: 'tablet',
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit score');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addToast({
          type: 'success',
          title: 'Score Submitted',
          message: `Your score has been added to the leaderboard! Rank: ${data.data.rank}`,
        });
        
        setShowSubmitForm(false);
      } else {
        throw new Error(data.message || 'Failed to submit score');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsSubmittingScore(false);
    }
  };
  
  // Reset session and start new game
  const handleResetSession = async () => {
    if (!sessionId) return;
    
    try {
      setIsResettingSession(true);
      
      // Call admin API to reset the session
      const response = await fetch(`/api/session/${sessionId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('adminToken') || 'taps-tokens-admin-secret',
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
          message: 'New game session created successfully',
        });
        
        // Reset game state
        resetGame();
        
        // Navigate to the new session QR page
        navigate(`/qr/${data.data.newSessionId}`);
      } else {
        throw new Error(data.message || 'Failed to reset session');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsResettingSession(false);
    }
  };
  
  // Share results
  const handleShareResults = async () => {
    if (!navigator.share) {
      addToast({
        type: 'warning',
        title: 'Sharing Not Available',
        message: 'Web Share API is not supported in your browser',
      });
      return;
    }
    
    try {
      setIsSharing(true);
      
      // Create share text
      const shareText = `I just scored ${state.playerScore} points in Taps Tokens Trivia! ${stats.correctAnswers}/${stats.questionsAnswered} correct answers (${stats.accuracy}% accuracy).`;
      
      await navigator.share({
        title: 'My Taps Tokens Trivia Score',
        text: shareText,
        url: window.location.href,
      });
      
      addToast({
        type: 'success',
        title: 'Shared Successfully',
        message: 'Your results have been shared',
      });
    } catch (error) {
      // User cancelled or share failed
      if (error instanceof Error && error.name !== 'AbortError') {
        addToast({
          type: 'error',
          title: 'Share Failed',
          message: error.message || 'Failed to share results',
        });
      }
    } finally {
      setIsSharing(false);
    }
  };
  
  // Format duration time
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m 0s';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  // Get game duration
  const getGameDuration = () => {
    if (!state.startedAt || !state.endedAt) return 0;
    
    const start = new Date(state.startedAt).getTime();
    const end = new Date(state.endedAt).getTime();
    
    return Math.round((end - start) / 1000);
  };
  
  // Calculate medal for position
  const getMedalForPosition = (position: number) => {
    switch (position) {
      case 0:
        return <span className="text-2xl" aria-label="Gold medal">🥇</span>;
      case 1:
        return <span className="text-2xl" aria-label="Silver medal">🥈</span>;
      case 2:
        return <span className="text-2xl" aria-label="Bronze medal">🥉</span>;
      default:
        return <span className="w-7 h-7 inline-flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 font-bold">{position + 1}</span>;
    }
  };
  
  // Loading state
  if (!state.finalScores && state.status === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Loading results...</p>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Results Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
          Game Complete!
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Final results for session: <span className="font-mono font-medium">{sessionId?.substring(0, 8)}</span>
        </p>
      </div>
      
      {/* Game Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Total Questions</p>
              <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-300">{state.totalQuestions}</p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-800 rounded-full">
              <ChartBarIcon className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Players</p>
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{state.players.length}</p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-800 rounded-full">
              <UserCircleIcon className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Duration</p>
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{formatDuration(getGameDuration())}</p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-800 rounded-full">
              <ClockIcon className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Leaderboard */}
      <div className="card mb-8">
        <div className="card-header bg-indigo-600 text-white">
          <h2 className="text-xl font-bold flex items-center">
            <TrophyIcon className="w-6 h-6 mr-2" />
            Final Leaderboard
          </h2>
        </div>
        
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="w-full leaderboard">
              <thead>
                <tr>
                  <th className="w-16">Rank</th>
                  <th>Player</th>
                  <th className="text-right">Score</th>
                  <th className="text-right hidden md:table-cell">Accuracy</th>
                  <th className="text-right hidden md:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {state.finalScores?.map((player, index) => {
                  // Highlight current player
                  const isCurrentPlayer = player.playerId === state.currentPlayerId;
                  const playerStats = player.stats || { questionsAnswered: 0, correctAnswers: 0, accuracy: 0, averageTimeToAnswer: 0 };
                  
                  return (
                    <tr key={player.playerId} className={isCurrentPlayer ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}>
                      <td className="text-center">
                        {getMedalForPosition(index)}
                      </td>
                      <td className="font-medium">
                        <div className="flex items-center">
                          {isCurrentPlayer && (
                            <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                          )}
                          {player.name}
                          {isCurrentPlayer && (
                            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right font-bold text-amber-600 dark:text-amber-400">
                        {player.score}
                      </td>
                      <td className="text-right hidden md:table-cell">
                        {playerStats.accuracy}%
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                          ({playerStats.correctAnswers}/{playerStats.questionsAnswered})
                        </span>
                      </td>
                      <td className="text-right hidden md:table-cell">
                        {playerStats.averageTimeToAnswer ? `${playerStats.averageTimeToAnswer}s` : '-'}
                      </td>
                    </tr>
                  );
                })}
                
                {(!state.finalScores || state.finalScores.length === 0) && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No scores available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Your Performance */}
      <div className="card mb-8">
        <div className="card-header bg-indigo-600 text-white">
          <h2 className="text-xl font-bold flex items-center">
            <ChartBarIcon className="w-6 h-6 mr-2" />
            Your Performance
          </h2>
        </div>
        
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Score & Accuracy */}
            <div>
              <div className="flex flex-col items-center justify-center mb-6">
                <div className="w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2">
                  <TrophyIcon className="w-12 h-12 text-amber-500" />
                </div>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {state.playerScore}
                </p>
                <p className="text-slate-600 dark:text-slate-400">Total Points</p>
              </div>
              
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                    <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.correctAnswers}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Correct</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
                    <XCircleIcon className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {stats.incorrectAnswers}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Incorrect</p>
                </div>
              </div>
            </div>
            
            {/* Statistics */}
            <div>
              <div className="space-y-4">
                {/* Accuracy */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">Accuracy</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold">{stats.accuracy}%</p>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500" 
                      style={{ width: `${stats.accuracy}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Questions Answered */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">Questions Answered</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold">{stats.questionsAnswered}/{state.totalQuestions}</p>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500" 
                      style={{ width: `${(stats.questionsAnswered / state.totalQuestions) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Average Time */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">Average Answer Time</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold">{stats.averageTime} seconds</p>
                  </div>
                  <div className="flex items-center">
                    <FireIcon className="w-5 h-5 text-amber-500 mr-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {stats.averageTime < 10 ? 'Lightning fast!' : stats.averageTime < 15 ? 'Pretty quick!' : 'Good thinking!'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Submit to Leaderboard */}
      {!showSubmitForm ? (
        <div className="card p-6 mb-8 text-center">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">
            Submit to Global Leaderboard
          </h3>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Add your score to the global leaderboard to see how you rank against other players!
          </p>
          <button 
            onClick={() => setShowSubmitForm(true)}
            className="btn btn-primary"
          >
            <ArrowTopRightOnSquareIcon className="w-5 h-5 mr-2" />
            Submit My Score
          </button>
        </div>
      ) : (
        <div className="card mb-8">
          <div className="card-header bg-indigo-600 text-white">
            <h3 className="text-xl font-bold">Submit to Leaderboard</h3>
          </div>
          
          <div className="card-body">
            <form onSubmit={handleSubmitScore}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="alias" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="alias"
                    name="alias"
                    value={leaderboardSubmission.alias}
                    onChange={handleInputChange}
                    required
                    maxLength={20}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    placeholder="Enter your name"
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number <span className="text-slate-500 dark:text-slate-400 text-xs">(Optional, for rewards)</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={leaderboardSubmission.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    placeholder="Enter phone number (optional)"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    We'll only use this to notify you if you win a prize.
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSubmitForm(false)}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isSubmittingScore || !leaderboardSubmission.alias.trim()}
                    className="btn btn-primary"
                  >
                    {isSubmittingScore ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>Submit Score</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/')}
          className="btn btn-outline"
        >
          <HomeIcon className="w-5 h-5 mr-2" />
          Home
        </button>
        
        <button
          onClick={handleShareResults}
          disabled={isSharing || !navigator.share}
          className="btn btn-secondary"
        >
          {isSharing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sharing...
            </>
          ) : (
            <>
              <ShareIcon className="w-5 h-5 mr-2" />
              Share Results
            </>
          )}
        </button>
        
        <button
          onClick={handleResetSession}
          disabled={isResettingSession}
          className="btn btn-primary"
        >
          {isResettingSession ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </>
          ) : (
            <>
              <PlusCircleIcon className="w-5 h-5 mr-2" />
              New Game
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ResultsPage;
