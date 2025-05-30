import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState } from '../context/GameStateContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
  ArrowPathIcon,
  TrophyIcon,
  FireIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

// Difficulty badge colors
const difficultyColors = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  mixed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

// Category icon mapping
const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'science':
      return <LightBulbIcon className="w-5 h-5" />;
    case 'history':
      return <ClockIcon className="w-5 h-5" />;
    case 'geography':
      return <div className="w-5 h-5">🌍</div>;
    case 'entertainment':
      return <div className="w-5 h-5">🎬</div>;
    case 'sports':
      return <div className="w-5 h-5">⚽</div>;
    case 'music':
      return <div className="w-5 h-5">🎵</div>;
    case 'food & drink':
      return <div className="w-5 h-5">🍔</div>;
    case 'technology':
      return <div className="w-5 h-5">💻</div>;
    default:
      return <QuestionMarkCircleIcon className="w-5 h-5" />;
  }
};

const GamePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state, submitAnswer } = useGameState();
  const { isConnected } = useSocket();
  const { addToast } = useToast();
  
  // Local state
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timerPercentage, setTimerPercentage] = useState<number>(100);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Redirect if no session or not connected
  useEffect(() => {
    if (!sessionId || !isConnected) {
      navigate('/');
    }
  }, [sessionId, isConnected, navigate]);
  
  // Redirect to results page when game completes
  useEffect(() => {
    if (state.status === 'completed' && sessionId) {
      navigate(`/results/${sessionId}`);
    }
  }, [state.status, sessionId, navigate]);
  
  // Handle timer countdown
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Don't start timer if no current question or game is not active
    if (!state.currentQuestion || state.status !== 'active' || state.isAnswerRevealed) {
      return;
    }
    
    // Calculate time left based on question asked time and time limit
    const questionAskedTime = new Date(state.currentQuestion.askedAt).getTime();
    const timeLimit = state.currentQuestion.timeLimit * 1000; // convert to ms
    const now = Date.now();
    const elapsed = now - questionAskedTime;
    const remaining = Math.max(0, timeLimit - elapsed);
    
    // Set initial time left
    setTimeLeft(Math.ceil(remaining / 1000));
    setTimerPercentage((remaining / timeLimit) * 100);
    
    // Start countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          // Clear timer when time is up
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prevTime - 1;
      });
      
      setTimerPercentage((prev) => {
        const newPercentage = Math.max(0, prev - (100 / timeLimit) * 100);
        return newPercentage;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.currentQuestion, state.status, state.isAnswerRevealed]);
  
  // Handle answer selection
  const handleAnswerSelect = (choiceIndex: number) => {
    // Prevent selecting if answer already selected or revealed
    if (state.selectedAnswerIndex !== null || state.isAnswerRevealed) {
      return;
    }
    
    submitAnswer(choiceIndex);
    
    // Show toast for answer submission
    addToast({
      type: 'info',
      title: 'Answer Submitted',
      message: 'Your answer has been submitted!',
      duration: 2000,
    });
  };
  
  // Toggle explanation visibility
  const toggleExplanation = () => {
    setShowExplanation((prev) => !prev);
  };
  
  // Render loading state
  if (!state.currentQuestion && state.status === 'active') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Loading question...</p>
      </div>
    );
  }
  
  // Render waiting state
  if (state.status === 'waiting' || state.status === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="card p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">
            {state.status === 'countdown' 
              ? `Game starting in ${state.countdownSeconds} seconds...` 
              : 'Waiting for game to start'}
          </h2>
          
          {state.status === 'countdown' && (
            <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {state.countdownSeconds}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-center mb-6">
            <UserGroupIcon className="w-6 h-6 text-indigo-500 mr-2" />
            <span className="text-lg text-slate-700 dark:text-slate-300">
              {state.players.length} {state.players.length === 1 ? 'player' : 'players'} joined
            </span>
          </div>
          
          {state.status === 'waiting' && (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Render paused state
  if (state.status === 'paused') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="card p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-4">
            Game Paused
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The game has been paused by the driver. Please wait for the game to resume.
          </p>
          <div className="flex justify-center">
            <ArrowPathIcon className="w-8 h-8 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Game Progress Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <ChartBarIcon className="w-5 h-5 text-indigo-500 mr-2" />
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Question {state.currentQuestionIndex + 1} of {state.totalQuestions}
          </span>
        </div>
        
        <div className="flex items-center">
          <TrophyIcon className="w-5 h-5 text-amber-500 mr-2" />
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Score: {state.playerScore}
          </span>
        </div>
      </div>
      
      {/* Timer Bar */}
      <div className="timer-bar mb-6">
        <div 
          className={`timer-progress ${
            timeLeft < 5 ? 'bg-red-500' : timeLeft < 10 ? 'bg-amber-500' : 'bg-emerald-500'
          }`} 
          style={{ width: `${timerPercentage}%` }}
        ></div>
      </div>
      
      {/* Question Card */}
      <div className="question-card mb-8">
        {/* Question Header */}
        <div className="question-header">
          <div className="flex items-center">
            {state.currentQuestion && getCategoryIcon(state.currentQuestion.category)}
            <span className="ml-2 font-medium">
              {state.currentQuestion?.category || 'General Knowledge'}
            </span>
          </div>
          
          <div className="flex items-center">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              state.currentQuestion?.difficulty
                ? difficultyColors[state.currentQuestion.difficulty as keyof typeof difficultyColors]
                : difficultyColors.mixed
            }`}>
              {state.currentQuestion?.difficulty?.toUpperCase() || 'MIXED'}
            </span>
            
            <div className="ml-3 flex items-center">
              <ClockIcon className="w-4 h-4 mr-1 text-white" />
              <span>{timeLeft}s</span>
            </div>
          </div>
        </div>
        
        {/* Question Text */}
        <div className="question-body">
          <p>{state.currentQuestion?.text}</p>
        </div>
        
        {/* Answer Choices */}
        <div className="answer-grid">
          {state.currentQuestion?.choices.map((choice, index) => {
            // Determine answer button styling
            let buttonClass = 'answer-button';
            
            if (state.isAnswerRevealed) {
              if (index === state.currentQuestion?.correctAnswerIndex) {
                buttonClass += ' correct';
              } else if (index === state.selectedAnswerIndex) {
                buttonClass += ' incorrect';
              }
            } else if (index === state.selectedAnswerIndex) {
              buttonClass += ' selected';
            }
            
            return (
              <button
                key={index}
                className={buttonClass}
                onClick={() => handleAnswerSelect(index)}
                disabled={state.selectedAnswerIndex !== null || state.isAnswerRevealed}
              >
                <span className="mr-3 w-6 h-6 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-medium">
                  {String.fromCharCode(65 + index)} {/* A, B, C, D */}
                </span>
                <span>{choice}</span>
                
                {/* Show correct/incorrect icon when answer is revealed */}
                {state.isAnswerRevealed && (
                  <span className="ml-auto">
                    {index === state.currentQuestion?.correctAnswerIndex ? (
                      <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                    ) : index === state.selectedAnswerIndex ? (
                      <XCircleIcon className="w-6 h-6 text-red-500" />
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Answer Explanation (shown after answer is revealed) */}
        {state.isAnswerRevealed && state.currentQuestion?.explanation && (
          <div className="p-4 md:p-6">
            <button
              onClick={toggleExplanation}
              className="flex items-center text-indigo-600 dark:text-indigo-400 font-medium mb-2"
            >
              <LightBulbIcon className="w-5 h-5 mr-2" />
              {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
            </button>
            
            {showExplanation && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg text-slate-700 dark:text-slate-300">
                {state.currentQuestion.explanation}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Players Status */}
      <div className="card p-4 md:p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
          <UserGroupIcon className="w-5 h-5 mr-2" />
          Players
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {state.players.map((player) => (
            <div 
              key={player.playerId}
              className={`p-3 rounded-lg border ${
                player.isConnected
                  ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                  {player.name}
                </span>
                {player.hasAnswered && (
                  <span className={`w-4 h-4 rounded-full ${
                    player.answerCorrect 
                      ? 'bg-emerald-500' 
                      : 'bg-red-500'
                  }`}></span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrophyIcon className="w-4 h-4 text-amber-500 mr-1" />
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {player.score}
                  </span>
                </div>
                
                {player.hasAnswered ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                    Answered
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                    Thinking...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Answer Result (shown after answering) */}
      {state.selectedAnswerIndex !== null && !state.isAnswerRevealed && (
        <div className="fixed bottom-[var(--footer-height)] left-0 right-0 p-4 bg-indigo-600 text-white text-center">
          <p className="text-lg font-medium">Answer submitted! Waiting for other players...</p>
        </div>
      )}
      
      {/* Answer Result (shown after answer is revealed) */}
      {state.isAnswerRevealed && state.selectedAnswerIndex !== null && (
        <div className={`fixed bottom-[var(--footer-height)] left-0 right-0 p-4 text-white text-center ${
          state.selectedAnswerIndex === state.currentQuestion?.correctAnswerIndex
            ? 'bg-emerald-600'
            : 'bg-red-600'
        }`}>
          <div className="flex items-center justify-center">
            {state.selectedAnswerIndex === state.currentQuestion?.correctAnswerIndex ? (
              <>
                <CheckCircleIcon className="w-6 h-6 mr-2" />
                <p className="text-lg font-medium">Correct! +{state.playerAnswers[state.playerAnswers.length - 1]?.points || 0} points</p>
                {timeLeft > 0 && (
                  <span className="ml-2 flex items-center text-emerald-200">
                    <FireIcon className="w-4 h-4 mr-1" />
                    Speed bonus!
                  </span>
                )}
              </>
            ) : (
              <>
                <XCircleIcon className="w-6 h-6 mr-2" />
                <p className="text-lg font-medium">
                  Incorrect! The correct answer was {String.fromCharCode(65 + (state.currentQuestion?.correctAnswerIndex || 0))}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePage;
