import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState, Question } from '../context/GameStateContext'; // Assuming Question type is exported
import { useSocket } from '../context/SocketContext';
import { useToast } from '../ontext/ToastContext';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon, // Fallback for category
  TrophyIcon,
  ChartBarIcon,
  PauseCircleIcon,
  ArrowPathIcon,
  UserGroupIcon, // For waiting state
} from '@heroicons/react/24/outline';
import clsx from 'clsx'; // For conditional classes

// Helper for difficulty colors
const difficultyColors: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-700/30 dark:text-amber-300',
  hard: 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300',
  mixed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-700/30 dark:text-indigo-300',
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300',
};

// Helper for category icons
const getCategoryIcon = (category?: string): React.ReactNode => {
  switch (category?.toLowerCase()) {
    case 'science': return <LightBulbIcon className="w-4 h-4" />;
    case 'history': return <ClockIcon className="w-4 h-4" />;
    case 'general knowledge': return <QuestionMarkCircleIcon className="w-4 h-4" />;
    // Add more cases as needed from triviaService.js
    case 'entertainment': return <span className="text-base">🎬</span>;
    case 'geography': return <span className="text-base">🌍</span>;
    case 'sports': return <span className="text-base">⚽</span>;
    case 'music': return <span className="text-base">🎵</span>;
    case 'food & drink': return <span className="text-base">🍔</span>;
    case 'technology': return <span className="text-base">💻</span>;
    case 'movies': return <span className="text-base">🍿</span>;
    default: return <QuestionMarkCircleIcon className="w-4 h-4" />;
  }
};

const GamePlayPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state, submitAnswer, dispatch, requestGameStateRecovery } = useGameState();
  const { isConnected, connectionState } = useSocket();
  const { addToast } = useToast();

  const [timeLeft, setTimeLeft] = useState(0);
  const [timerPercentage, setTimerPercentage] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Redirect if session ID is missing or critical connection issues
  useEffect(() => {
    if (!sessionId) {
      navigate('/join', { replace: true });
      return;
    }
    // If not connected and not already in an error/idle/results state, prompt for recovery
    if (!isConnected && !['error', 'idle', 'results', 'connecting', 'joining'].includes(state.gameStatus)) {
        addToast({ type: 'error', title: 'Connection Lost', message: 'Attempting to recover game state...' });
        // Attempt to recover state if player ID and session ID exist from a previous connection
        if(state.playerId && state.sessionId) {
            requestGameStateRecovery();
        } else {
            // If no prior state to recover, navigate to join
            navigate('/join', { replace: true });
        }
    }
  }, [sessionId, isConnected, state.gameStatus, state.playerId, state.sessionId, navigate, addToast, requestGameStateRecovery]);

  // Navigate to results page on game completion
  useEffect(() => {
    if (state.gameStatus === 'results' && sessionId) {
      navigate(`/results/${sessionId}`, { replace: true });
    }
  }, [state.gameStatus, sessionId, navigate]);

  // Timer logic for current question
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (state.gameStatus === 'active' && state.currentQuestion && state.currentQuestion.timeLimit > 0) {
      const questionAskedTime = new Date(state.currentQuestion.askedAt).getTime();
      const timeLimitMs = state.currentQuestion.timeLimit * 1000;
      
      const updateTimer = () => {
        const now = Date.now();
        const elapsedMs = now - questionAskedTime;
        const remainingMs = Math.max(0, timeLimitMs - elapsedMs);
        
        setTimeLeft(Math.ceil(remainingMs / 1000));
        setTimerPercentage((remainingMs / timeLimitMs) * 100);

        if (remainingMs <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Server should ideally send REVEAL_ANSWER when time is up.
          // Client-side timeout can be a fallback but might lead to inconsistencies.
          // For now, rely on server to manage question state transitions.
        }
      };

      updateTimer(); // Initial call
      timerRef.current = setInterval(updateTimer, 250); // Update more frequently for smoother bar
    } else {
      // Reset timer visuals if not active or no question or no time limit
      setTimeLeft(state.currentQuestion?.timeLimit || 0);
      setTimerPercentage(100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.gameStatus, state.currentQuestion]);


  const handleAnswerClick = (choiceIndex: number) => {
    if (state.gameStatus === 'active' && state.selectedAnswerIndex === null && state.currentQuestion) {
      submitAnswer(choiceIndex);
    }
  };

  // Render different UI based on game status
  const renderGameContent = () => {
    switch (state.gameStatus) {
      case 'connecting':
      case 'joining':
        return (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
            <ArrowPathIcon className="w-10 h-10 text-indigo-500 animate-spin" />
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              {state.gameStatus === 'connecting' ? 'Connecting to Session...' : 'Joining Game...'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Hold tight!</p>
          </div>
        );
      case 'waiting':
        return (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
            <UserGroupIcon className="w-10 h-10 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Waiting for Game to Start</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">The game will begin shortly.</p>
          </div>
        );
      case 'countdown':
        return (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-700/30 flex items-center justify-center">
              <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-300">
                {state.currentQuestion?.timeLimit || state.gameSettings?.timeLimitPerQuestion || '...'} 
                {/* Assuming countdown seconds might come from GameState or a specific countdown field */}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Game Starting Soon!</h2>
          </div>
        );
      case 'active':
      case 'revealed':
        if (!state.currentQuestion) {
          return (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
              <ArrowPathIcon className="w-10 h-10 text-indigo-500 animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading next question...</p>
            </div>
          );
        }
        const q = state.currentQuestion;
        return (
          <div className="flex-grow flex flex-col p-4 space-y-3 md:space-y-4">
            {/* Question Info: Category & Difficulty - smaller for mobile */}
            <div className="flex justify-between items-center text-xs">
              <span className={clsx(
                "px-2 py-0.5 rounded-full font-medium flex items-center gap-1 text-[10px] sm:text-xs", // Smaller text
                difficultyColors[q.difficulty] || difficultyColors.default
              )}>
                {getCategoryIcon(q.category)}
                {q.category}
              </span>
              <span className={clsx(
                "px-2 py-0.5 rounded-full font-semibold text-[10px] sm:text-xs", // Smaller text
                difficultyColors[q.difficulty] || difficultyColors.default
              )}>
                {q.difficulty.toUpperCase()}
              </span>
            </div>

            {/* Question Text Card */}
            <div className="mobile-card p-3 sm:p-4 shadow-sm flex-shrink-0 bg-white dark:bg-slate-800">
              <p className="text-md sm:text-lg font-semibold text-slate-800 dark:text-slate-100 text-center leading-snug">
                {q.text}
              </p>
            </div>

            {/* Answer Options Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:gap-3 mt-1">
              {q.choices.map((choice, index) => {
                const isSelectedByPlayer = state.selectedAnswerIndex === index;
                const isCorrectAnswer = q.correctAnswerIndex === index;
                const isRevealed = state.gameStatus === 'revealed';

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerClick(index)}
                    disabled={isRevealed || state.selectedAnswerIndex !== null}
                    className={clsx(
                      "btn text-left justify-start w-full py-2.5 px-3 text-sm sm:text-base font-medium break-words whitespace-normal h-auto min-h-[40px] sm:min-h-[var(--mobile-tap-target-size)] transition-all duration-150 ease-in-out",
                      {
                        // Default state (not selected, not revealed)
                        'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700': !isSelectedByPlayer && !isRevealed,
                        // Player selected this answer (before reveal)
                        'bg-indigo-500 border-indigo-500 text-white ring-2 ring-indigo-300 dark:ring-indigo-600': isSelectedByPlayer && !isRevealed,
                        // Correct answer after reveal
                        'bg-emerald-500 border-emerald-500 text-white font-bold': isRevealed && isCorrectAnswer,
                        // Player selected this, and it was incorrect (after reveal)
                        'bg-red-500 border-red-500 text-white': isRevealed && isSelectedByPlayer && !isCorrectAnswer,
                        // Not selected by player, and was not the correct answer (dimmed after reveal)
                        'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 opacity-60 cursor-not-allowed': isRevealed && !isSelectedByPlayer && !isCorrectAnswer,
                        'cursor-not-allowed opacity-80': state.selectedAnswerIndex !== null && !isSelectedByPlayer && !isRevealed, // Other options dimmed once an answer is selected
                      }
                    )}
                  >
                    <span className="mr-2 w-5 h-5 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-semibold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1">{choice}</span>
                    {isRevealed && isCorrectAnswer && <CheckCircleIcon className="w-5 h-5 text-white ml-auto" />}
                    {isRevealed && isSelectedByPlayer && !isCorrectAnswer && <XCircleIcon className="w-5 h-5 text-white ml-auto" />}
                  </button>
                );
              })}
            </div>

            {/* Feedback and Explanation (after reveal) */}
            {isRevealed && (
              <div className="mt-3 p-3 mobile-card bg-opacity-80 dark:bg-opacity-80 shadow-sm text-sm">
                {state.isAnswerCorrect !== null && (
                  <div className={clsx("flex items-center font-semibold mb-1.5",
                    state.isAnswerCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {state.isAnswerCorrect ? <CheckCircleIcon className="w-5 h-5 mr-1.5" /> : <XCircleIcon className="w-5 h-5 mr-1.5" />}
                    {state.isAnswerCorrect ? `Correct! You earned ${state.pointsEarned || 0} points.` : "Incorrect!"}
                  </div>
                )}
                {q.explanation && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Explanation:</span> {q.explanation}
                  </p>
                )}
                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 animate-pulse">Waiting for next question...</p>
              </div>
            )}
          </div>
        );
      case 'paused':
        return (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
            <PauseCircleIcon className="w-10 h-10 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Game Paused</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">The host has paused the game. Please wait.</p>
          </div>
        );
      case 'error':
        return (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
            <XCircleIcon className="w-10 h-10 text-red-500" />
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">An Error Occurred</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{state.lastError || "Something went wrong."}</p>
            <button onClick={() => { dispatch({ type: 'RESET_STATE' }); navigate('/join', { replace: true }); }} className="btn btn-primary btn-sm">
              Back to Join Page
            </button>
          </div>
        );
      default: // idle or other unhandled states
        return (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 space-y-3">
            <ArrowPathIcon className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Preparing your game...</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Status: {state.gameStatus}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header Area: Score, Question Progress, Timer Bar */}
      {(state.gameStatus === 'active' || state.gameStatus === 'revealed') && state.currentQuestion && (
        <div className="p-3 sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-1.5 text-xs sm:text-sm">
            <span className="flex items-center font-medium text-slate-600 dark:text-slate-300">
              <ChartBarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-indigo-500" />
              Q {state.currentQuestionIndex + 1} / {state.totalQuestions}
            </span>
            <span className="flex items-center font-bold text-amber-500 dark:text-amber-400">
              <TrophyIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
              {state.playerScore}
            </span>
          </div>
          <div className="mobile-timer-bar h-1.5"> {/* Ensure consistent height */}
            <div
              className={clsx("mobile-timer-progress",
                timerPercentage < 20 ? "bg-red-500" : timerPercentage < 50 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${timerPercentage}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Main Game Content Area */}
      <div className="flex-grow overflow-y-auto custom-scrollbar"> {/* Added custom-scrollbar if defined */}
        {renderGameContent()}
      </div>
    </div>
  );
};

export default GamePlayPage;
