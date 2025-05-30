import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState, PlayerInfo } from '../../context/GameStateContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import {
  TrophyIcon,
  ArrowPathIcon,
  ShareIcon,
  HomeIcon,
  PlusCircleIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  ArrowUpTrayIcon, // For submit score
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface PlayerStats {
  correctAnswers: number;
  questionsAnswered: number;
  accuracy: number;
  averageTimePerAnswer?: number; // Optional
}

const ResultsPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state, dispatch, leaveSession } = useGameState();
  const { isConnected } = useSocket(); // Check connection status
  const { addToast } = useToast();

  const [isSubmittingGlobalScore, setIsSubmittingGlobalScore] = useState<boolean>(false);
  const [showGlobalSubmitForm, setShowGlobalSubmitForm] = useState<boolean>(false);
  const [aliasForGlobal, setAliasForGlobal] = useState<string>(state.playerName || '');
  const [phoneForGlobal, setPhoneForGlobal] = useState<string>('');

  // Redirect if critical data is missing or not connected (unless results are already loaded)
  useEffect(() => {
    if (!sessionId) {
      navigate('/join', { replace: true });
      return;
    }
    if (state.gameStatus !== 'results' && !state.finalScores) {
        // If not in results state and no final scores, means game didn't complete properly or user landed here directly
        addToast({ type: 'warning', message: 'No game results found. Redirecting...', duration: 2000 });
        navigate('/join', { replace: true });
    }
  }, [sessionId, state.gameStatus, state.finalScores, navigate, addToast]);


  const playerStats = useMemo((): PlayerStats => {
    if (!state.playerAnswers || state.totalQuestions === 0) {
      return { correctAnswers: 0, questionsAnswered: 0, accuracy: 0 };
    }
    const correct = state.playerAnswers.filter(a => a.correct).length;
    const answered = state.playerAnswers.length;
    const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return {
      correctAnswers: correct,
      questionsAnswered: answered,
      accuracy: acc,
    };
  }, [state.playerAnswers, state.totalQuestions]);

  const sortedFinalScores = useMemo(() => {
    return state.finalScores ? [...state.finalScores].sort((a, b) => b.score - a.score) : [];
  }, [state.finalScores]);

  const currentPlayerRank = useMemo(() => {
    return sortedFinalScores.findIndex(p => p.playerId === state.playerId) + 1;
  }, [sortedFinalScores, state.playerId]);


  const handleShareResults = async () => {
    if (!navigator.share) {
      addToast({ type: 'warning', title: 'Not Supported', message: 'Sharing is not supported on this browser.' });
      return;
    }
    try {
      const shareText = `I scored ${state.playerScore} points in Taps Tokens Trivia! My accuracy was ${playerStats.accuracy}%. Think you can beat me?`;
      await navigator.share({
        title: 'My Trivia Score!',
        text: shareText,
        url: window.location.origin, // Share the main app URL
      });
      addToast({ type: 'success', message: 'Results shared!' });
    } catch (error) {
      // Don't show error if user cancels share
      if (error instanceof Error && error.name !== 'AbortError') {
        addToast({ type: 'error', title: 'Share Failed', message: 'Could not share results.' });
      }
    }
  };

  const handleJoinNewGame = () => {
    leaveSession(); // Disconnects socket and resets game state via context
    navigate('/join', { replace: true });
  };
  
  const handleGoHome = () => {
    leaveSession();
    navigate('/', { replace: true }); // Or '/join' if that's the effective home
  };

  const handleSubmitToGlobalLeaderboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasForGlobal.trim()) {
      addToast({ type: 'warning', message: 'Please enter a name for the leaderboard.' });
      return;
    }
    setIsSubmittingGlobalScore(true);
    try {
      const response = await fetch('/api/leaderboard', { // Assuming this endpoint exists
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: aliasForGlobal,
          phone: phoneForGlobal || undefined,
          score: state.playerScore,
          sessionId: state.sessionId,
          metadata: {
            questionCount: state.totalQuestions,
            correctAnswers: playerStats.correctAnswers,
            totalQuestions: playerStats.questionsAnswered,
            device: 'mobile', // Identify source
          },
        }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        addToast({ type: 'success', title: 'Submitted!', message: `Your score is on the global leaderboard! Rank: ${data.data.rank}` });
        setShowGlobalSubmitForm(false);
      } else {
        throw new Error(data.message || 'Failed to submit score.');
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Submission Failed', message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsSubmittingGlobalScore(false);
    }
  };
  
  // If results are not yet loaded, show a loading or placeholder state
  if (state.gameStatus !== 'results' || !state.finalScores) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
        <ArrowPathIcon className="w-10 h-10 text-indigo-500 animate-spin" />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Loading Results...</h2>
         <p className="text-sm text-slate-500 dark:text-slate-400">Session ID: {sessionId?.substring(0,8)}...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col p-4 space-y-5 overflow-y-auto pb-20"> {/* Added pb for footer */}
      {/* Header */}
      <div className="text-center">
        <TrophyIcon className="w-12 h-12 text-amber-500 mx-auto mb-2 animate-pulse-once" />
        <h1 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">Game Over!</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">Here's how you did in session <span className="font-mono text-xs">{sessionId?.substring(0,8)}...</span></p>
      </div>

      {/* Player's Score & Rank */}
      <div className="mobile-card p-4 text-center bg-indigo-50 dark:bg-indigo-800/30 border border-indigo-200 dark:border-indigo-700 shadow-lg">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Your Score</p>
        <p className="text-5xl font-extrabold text-indigo-600 dark:text-indigo-400 my-1">{state.playerScore}</p>
        {currentPlayerRank > 0 && (
          <p className="text-sm text-indigo-500 dark:text-indigo-400">
            You ranked #{currentPlayerRank} in this session!
          </p>
        )}
      </div>

      {/* Player Statistics */}
      <div className="mobile-card p-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" />
          Your Stats
        </h2>
        <div className="space-y-2 text-sm">
          <div className="results-stat-item">
            <span className="text-slate-600 dark:text-slate-300">Correct Answers:</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{playerStats.correctAnswers} / {playerStats.questionsAnswered}</span>
          </div>
          <div className="results-stat-item">
            <span className="text-slate-600 dark:text-slate-300">Accuracy:</span>
            <span className="font-medium text-sky-600 dark:text-sky-400">{playerStats.accuracy}%</span>
          </div>
          {/* Add more stats like average time if available */}
        </div>
      </div>

      {/* Session Leaderboard */}
      <div className="mobile-card">
        <div className="mobile-card-header bg-slate-50 dark:bg-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Session Leaderboard</h2>
        </div>
        <div className="mobile-card-body p-0 max-h-60 overflow-y-auto"> {/* Scrollable leaderboard */}
          {sortedFinalScores.length > 0 ? (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {sortedFinalScores.map((player, index) => (
                <li key={player.playerId} className={clsx(
                  "flex items-center justify-between p-3",
                  player.playerId === state.playerId && "bg-indigo-50 dark:bg-indigo-800/20"
                )}>
                  <div className="flex items-center">
                    <span className={clsx(
                      "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-2.5",
                      index === 0 ? "bg-amber-400 text-white" :
                      index === 1 ? "bg-slate-400 text-white" :
                      index === 2 ? "bg-yellow-600 text-white" :
                      "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                    )}>
                      {index + 1}
                    </span>
                    <span className={clsx(
                      "font-medium text-sm",
                      player.playerId === state.playerId ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200"
                    )}>
                      {player.name}
                      {player.playerId === state.playerId && " (You)"}
                    </span>
                  </div>
                  <span className="font-bold text-sm text-amber-600 dark:text-amber-400">{player.score}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">No scores recorded for this session.</p>
          )}
        </div>
      </div>
      
      {/* Submit to Global Leaderboard Section */}
      {!showGlobalSubmitForm ? (
        <button
          onClick={() => setShowGlobalSubmitForm(true)}
          className="btn btn-outline btn-full flex items-center justify-center"
        >
          <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
          Submit to Global Leaderboard
        </button>
      ) : (
        <div className="mobile-card p-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">Submit Globally</h2>
          <form onSubmit={handleSubmitToGlobalLeaderboard} className="space-y-3">
            <div>
              <label htmlFor="aliasGlobal" className="form-label">Your Name</label>
              <input
                type="text"
                id="aliasGlobal"
                value={aliasForGlobal}
                onChange={(e) => setAliasForGlobal(e.target.value)}
                className="form-input"
                maxLength={20}
                required
              />
            </div>
            <div>
              <label htmlFor="phoneGlobal" className="form-label">Phone (Optional - for prizes)</label>
              <input
                type="tel"
                id="phoneGlobal"
                value={phoneForGlobal}
                onChange={(e) => setPhoneForGlobal(e.target.value)}
                className="form-input"
                placeholder="e.g., +15551234567"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowGlobalSubmitForm(false)} className="btn btn-outline flex-1">Cancel</button>
              <button type="submit" disabled={isSubmittingGlobalScore} className="btn btn-primary flex-1">
                {isSubmittingGlobalScore ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Action Buttons */}
      <div className="mt-auto pt-4 space-y-3"> {/* Pushes buttons to bottom if content is short */}
        <button
          onClick={handleShareResults}
          className="btn btn-secondary btn-full flex items-center justify-center"
          disabled={!navigator.share}
        >
          <ShareIcon className="w-5 h-5 mr-2" />
          Share My Score
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGoHome}
            className="btn btn-outline btn-full"
          >
            <HomeIcon className="w-5 h-5 mr-2" />
            Home
          </button>
          <button
            onClick={handleJoinNewGame}
            className="btn btn-primary btn-full"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            New Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
