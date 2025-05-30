/**
 * Game Namespace Socket.IO Handler
 * 
 * Manages real-time communication for the game experience including:
 * - Player joining/leaving sessions
 * - Serving trivia questions
 * - Processing player answers
 * - Updating scores in real-time
 * - Synchronizing game state across devices
 */

const { v4: uuidv4 } = require('uuid');
const { Session } = require('../models/session');
const { Leaderboard } = require('../models/leaderboard');
const { getTriviaQuestions } = require('../utils/triviaService');

// Store active timers for cleanup
const questionTimers = new Map();

/**
 * Setup the game namespace with all event handlers
 * @param {SocketIO.Namespace} namespace - The Socket.IO game namespace
 */
function setupGameNamespace(namespace) {
  // Middleware for session validation
  namespace.use((socket, next) => {
    const { sessionId } = socket.handshake.query;
    
    if (!sessionId) {
      return next(new Error('Session ID is required'));
    }
    
    // Check if session exists
    const session = global.activeSessions.get(sessionId);
    
    if (!session) {
      return next(new Error('Invalid or expired session'));
    }
    
    // Attach session to socket for later use
    socket.sessionId = sessionId;
    next();
  });
  
  // Connection handler
  namespace.on('connection', (socket) => {
    const { sessionId } = socket;
    const logger = socket.request.app.locals.logger || console;
    
    logger.info(`Socket connected to game namespace: ${socket.id} (Session: ${sessionId})`);
    
    // Join the session room
    socket.join(sessionId);
    
    // Handle player joining the game
    socket.on('player:join', async (data) => {
      try {
        // Validate player data
        if (!data || !data.name || data.name.trim().length < 1) {
          return socket.emit('error', { 
            message: 'Player name is required' 
          });
        }
        
        const playerName = data.name.trim().substring(0, 20); // Limit name length
        const playerId = uuidv4();
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found or expired' 
          });
        }
        
        // Check if session is full
        if (session.players.length >= session.settings.maxPlayers) {
          return socket.emit('error', { 
            message: 'Session is full' 
          });
        }
        
        // Check if game already started
        if (session.status === 'active' && session.currentQuestion > 0) {
          return socket.emit('error', { 
            message: 'Game already in progress' 
          });
        }
        
        // Add player to session
        const player = {
          playerId,
          name: playerName,
          socketId: socket.id,
          score: 0,
          answers: [],
          joinedAt: new Date(),
          lastActive: new Date(),
          device: data.device || 'unknown',
          isConnected: true
        };
        
        session.players.push(player);
        
        // Update session in database
        try {
          await Session.findOneAndUpdate(
            { sessionId },
            { 
              $push: { players: player },
              lastActivity: new Date()
            }
          );
        } catch (dbErr) {
          logger.error(`Database error updating session ${sessionId}:`, dbErr);
          // Continue even if DB update fails - we have the memory copy
        }
        
        // Notify player they've joined successfully
        socket.emit('player:joined', {
          playerId,
          name: playerName,
          sessionId,
          playerCount: session.players.length,
          status: session.status
        });
        
        // Notify all clients in the session about the new player
        namespace.to(sessionId).emit('player:new', {
          playerId,
          name: playerName,
          playerCount: session.players.length
        });
        
        // Notify admin namespace about player count change
        const adminNamespace = socket.server.of('/admin');
        adminNamespace.emit('session:updated', {
          sessionId,
          playerCount: session.players.length,
          status: session.status
        });
        
        // If this is the first player and auto-start is enabled, prepare the game
        if (session.players.length === 1 && !session.questions.length) {
          prepareGame(sessionId, namespace);
        }
        
        // If enough players have joined, start the game
        if (session.status === 'waiting' && 
            session.players.length >= 1 && // For testing, start with just 1 player
            !session.startedAt) {
          startGameCountdown(sessionId, namespace);
        }
        
        logger.info(`Player joined session ${sessionId}: ${playerName} (${playerId})`);
      } catch (err) {
        logger.error(`Error in player:join handler: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to join game' 
        });
      }
    });
    
    // Handle player submitting an answer
    socket.on('answer:submit', async (data) => {
      try {
        if (!data || typeof data.choiceIndex !== 'number' || !data.playerId) {
          return socket.emit('error', { 
            message: 'Invalid answer submission' 
          });
        }
        
        const { choiceIndex, playerId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found or expired' 
          });
        }
        
        // Validate session state
        if (session.status !== 'active') {
          return socket.emit('error', { 
            message: 'Game is not active' 
          });
        }
        
        // Find player in session
        const playerIndex = session.players.findIndex(p => p.playerId === playerId);
        
        if (playerIndex === -1) {
          return socket.emit('error', { 
            message: 'Player not found in this session' 
          });
        }
        
        // Get current question
        const currentQuestionIndex = session.currentQuestion - 1;
        if (currentQuestionIndex < 0 || currentQuestionIndex >= session.questions.length) {
          return socket.emit('error', { 
            message: 'No active question' 
          });
        }
        
        const currentQuestion = session.questions[currentQuestionIndex];
        
        // Check if player already answered this question
        const alreadyAnswered = session.players[playerIndex].answers.some(
          a => a.questionIndex === currentQuestionIndex
        );
        
        if (alreadyAnswered) {
          return socket.emit('error', { 
            message: 'You already answered this question' 
          });
        }
        
        // Check if answer is valid
        if (choiceIndex < 0 || choiceIndex >= currentQuestion.choices.length) {
          return socket.emit('error', { 
            message: 'Invalid answer choice' 
          });
        }
        
        // Calculate time to answer
        const now = new Date();
        const timeToAnswer = now - currentQuestion.askedAt;
        
        // Calculate points
        const isCorrect = choiceIndex === currentQuestion.correctAnswerIndex;
        let points = 0;
        
        if (isCorrect) {
          // Base points
          points = currentQuestion.points || session.settings.pointsPerQuestion || 100;
          
          // Bonus points for fast answers if enabled
          if (session.settings.bonusTimePoints) {
            const timeLimit = currentQuestion.timeLimit || session.settings.timeLimit || 30;
            const timeRatio = Math.max(0, 1 - (timeToAnswer / (timeLimit * 1000)));
            const timeBonus = Math.floor(points * 0.5 * timeRatio); // Up to 50% bonus for instant answers
            points += timeBonus;
          }
        }
        
        // Record the answer
        const answerRecord = {
          questionIndex: currentQuestionIndex,
          choiceIndex,
          correct: isCorrect,
          timeToAnswer,
          points
        };
        
        // Update player score
        session.players[playerIndex].answers.push(answerRecord);
        session.players[playerIndex].score += points;
        session.players[playerIndex].lastActive = now;
        
        // Update session in memory
        global.activeSessions.set(sessionId, session);
        
        // Try to update in database (non-blocking)
        try {
          await Session.findOneAndUpdate(
            { 
              sessionId, 
              'players.playerId': playerId 
            },
            { 
              $push: { 'players.$.answers': answerRecord },
              $inc: { 'players.$.score': points },
              $set: { 
                'players.$.lastActive': now,
                lastActivity: now
              }
            }
          );
        } catch (dbErr) {
          logger.error(`Database error updating player answer: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Send result to the player
        socket.emit('answer:result', {
          correct: isCorrect,
          points,
          totalScore: session.players[playerIndex].score,
          correctAnswer: currentQuestion.correctAnswerIndex
        });
        
        // Send updated scores to all players (without revealing correct answer yet)
        const playerScores = session.players.map(p => ({
          playerId: p.playerId,
          name: p.name,
          score: p.score,
          hasAnswered: p.answers.some(a => a.questionIndex === currentQuestionIndex)
        }));
        
        namespace.to(sessionId).emit('scores:update', {
          playerScores,
          questionIndex: currentQuestionIndex
        });
        
        // Check if all players have answered
        const allAnswered = session.players.every(p => 
          p.answers.some(a => a.questionIndex === currentQuestionIndex) || !p.isConnected
        );
        
        if (allAnswered) {
          // Clear the timer if all players answered early
          const timerId = questionTimers.get(sessionId);
          if (timerId) {
            clearTimeout(timerId);
            questionTimers.delete(sessionId);
          }
          
          // Reveal answer to everyone
          revealAnswer(sessionId, namespace);
        }
        
        logger.info(`Player ${playerId} answered question ${currentQuestionIndex} with choice ${choiceIndex} (correct: ${isCorrect}, points: ${points})`);
      } catch (err) {
        logger.error(`Error in answer:submit handler: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to process answer' 
        });
      }
    });
    
    // Handle player requesting current game state
    socket.on('game:state', async (data) => {
      try {
        if (!data || !data.playerId) {
          return socket.emit('error', { 
            message: 'Player ID is required' 
          });
        }
        
        const { playerId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found or expired' 
          });
        }
        
        // Find player in session
        const player = session.players.find(p => p.playerId === playerId);
        
        if (!player) {
          return socket.emit('error', { 
            message: 'Player not found in this session' 
          });
        }
        
        // Update player's socket ID if it changed
        if (player.socketId !== socket.id) {
          player.socketId = socket.id;
          player.isConnected = true;
          player.lastActive = new Date();
          
          // Update session in memory
          global.activeSessions.set(sessionId, session);
          
          // Try to update in database (non-blocking)
          try {
            await Session.findOneAndUpdate(
              { 
                sessionId, 
                'players.playerId': playerId 
              },
              { 
                $set: { 
                  'players.$.socketId': socket.id,
                  'players.$.isConnected': true,
                  'players.$.lastActive': new Date()
                }
              }
            );
          } catch (dbErr) {
            logger.error(`Database error updating player socket: ${dbErr.message}`);
            // Continue even if DB update fails
          }
        }
        
        // Build game state response
        const gameState = {
          sessionId,
          status: session.status,
          playerCount: session.players.length,
          currentQuestion: session.currentQuestion,
          totalQuestions: session.questions.length,
          playerScore: player.score,
          playerAnswers: player.answers,
          players: session.players.map(p => ({
            playerId: p.playerId,
            name: p.name,
            score: p.score,
            isConnected: p.isConnected
          }))
        };
        
        // Include current question if game is active
        if (session.status === 'active' && session.currentQuestion > 0) {
          const currentQuestionIndex = session.currentQuestion - 1;
          const currentQuestion = session.questions[currentQuestionIndex];
          
          // Check if player already answered
          const playerAnswered = player.answers.some(
            a => a.questionIndex === currentQuestionIndex
          );
          
          gameState.question = {
            index: currentQuestionIndex,
            text: currentQuestion.text,
            category: currentQuestion.category,
            difficulty: currentQuestion.difficulty,
            choices: currentQuestion.choices,
            timeLimit: currentQuestion.timeLimit || session.settings.timeLimit,
            askedAt: currentQuestion.askedAt,
            // Only include correct answer if player already answered or time expired
            ...(playerAnswered && { 
              correctAnswerIndex: currentQuestion.correctAnswerIndex 
            })
          };
          
          // Include player's answer if they've answered
          if (playerAnswered) {
            const answer = player.answers.find(a => a.questionIndex === currentQuestionIndex);
            gameState.playerAnswer = {
              choiceIndex: answer.choiceIndex,
              correct: answer.correct,
              points: answer.points
            };
          }
        }
        
        socket.emit('game:state:update', gameState);
        logger.info(`Sent game state to player ${playerId} in session ${sessionId}`);
      } catch (err) {
        logger.error(`Error in game:state handler: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to retrieve game state' 
        });
      }
    });
    
    // Handle player song request
    socket.on('song:request', async (data) => {
      try {
        if (!data || !data.playerId || !data.songRequest || !data.songRequest.trim()) {
          return socket.emit('error', { 
            message: 'Invalid song request' 
          });
        }
        
        const { playerId, songRequest } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found or expired' 
          });
        }
        
        // Find player in session
        const player = session.players.find(p => p.playerId === playerId);
        
        if (!player) {
          return socket.emit('error', { 
            message: 'Player not found in this session' 
          });
        }
        
        // Add song request to session metadata
        if (!session.metadata) {
          session.metadata = new Map();
        }
        
        if (!session.metadata.songRequests) {
          session.metadata.songRequests = [];
        }
        
        session.metadata.songRequests.push({
          playerId,
          playerName: player.name,
          request: songRequest.trim(),
          requestedAt: new Date()
        });
        
        // Update session in memory
        global.activeSessions.set(sessionId, session);
        
        // Try to update in database (non-blocking)
        try {
          await Session.findOneAndUpdate(
            { sessionId },
            { 
              $push: { 
                'metadata.songRequests': {
                  playerId,
                  playerName: player.name,
                  request: songRequest.trim(),
                  requestedAt: new Date()
                }
              }
            }
          );
        } catch (dbErr) {
          logger.error(`Database error updating song request: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Notify player their request was received
        socket.emit('song:request:received', {
          message: 'Your song request has been sent to the driver'
        });
        
        // Notify admin namespace about the song request
        const adminNamespace = socket.server.of('/admin');
        adminNamespace.emit('song:request:new', {
          sessionId,
          playerId,
          playerName: player.name,
          request: songRequest.trim(),
          requestedAt: new Date()
        });
        
        logger.info(`Song request from player ${playerId} in session ${sessionId}: "${songRequest}"`);
      } catch (err) {
        logger.error(`Error in song:request handler: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to process song request' 
        });
      }
    });
    
    // Handle player disconnection
    socket.on('disconnect', async () => {
      try {
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return; // Session already ended or expired
        }
        
        // Find player with this socket ID
        const playerIndex = session.players.findIndex(p => p.socketId === socket.id);
        
        if (playerIndex === -1) {
          return; // Player not found
        }
        
        const player = session.players[playerIndex];
        
        // Mark player as disconnected
        session.players[playerIndex].isConnected = false;
        session.players[playerIndex].lastActive = new Date();
        
        // Update session in memory
        global.activeSessions.set(sessionId, session);
        
        // Try to update in database (non-blocking)
        try {
          await Session.findOneAndUpdate(
            { 
              sessionId, 
              'players.socketId': socket.id 
            },
            { 
              $set: { 
                'players.$.isConnected': false,
                'players.$.lastActive': new Date()
              }
            }
          );
        } catch (dbErr) {
          logger.error(`Database error updating player disconnect: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Notify other players about disconnection
        namespace.to(sessionId).emit('player:left', {
          playerId: player.playerId,
          name: player.name,
          remainingPlayers: session.players.filter(p => p.isConnected).length
        });
        
        // Notify admin namespace
        const adminNamespace = socket.server.of('/admin');
        adminNamespace.emit('player:disconnected', {
          sessionId,
          playerId: player.playerId,
          name: player.name,
          remainingPlayers: session.players.filter(p => p.isConnected).length
        });
        
        logger.info(`Player disconnected from session ${sessionId}: ${player.name} (${player.playerId})`);
        
        // Check if all players disconnected
        const allDisconnected = session.players.every(p => !p.isConnected);
        
        if (allDisconnected && session.status !== 'completed') {
          // Auto-pause the game if all players disconnected
          session.status = 'paused';
          global.activeSessions.set(sessionId, session);
          
          // Update in database
          try {
            await Session.findOneAndUpdate(
              { sessionId },
              { 
                status: 'paused',
                lastActivity: new Date()
              }
            );
          } catch (dbErr) {
            logger.error(`Database error pausing session: ${dbErr.message}`);
          }
          
          logger.info(`Session ${sessionId} auto-paused due to all players disconnecting`);
          
          // Set a timer to end the session if no one reconnects
          setTimeout(async () => {
            try {
              // Check if session still exists and is still paused
              const currentSession = global.activeSessions.get(sessionId);
              
              if (currentSession && currentSession.status === 'paused') {
                // Check if any players reconnected
                const anyConnected = currentSession.players.some(p => p.isConnected);
                
                if (!anyConnected) {
                  // End the session
                  currentSession.status = 'completed';
                  currentSession.endedAt = new Date();
                  global.activeSessions.set(sessionId, currentSession);
                  
                  // Update in database
                  try {
                    await Session.findOneAndUpdate(
                      { sessionId },
                      { 
                        status: 'completed',
                        endedAt: new Date()
                      }
                    );
                  } catch (dbErr) {
                    logger.error(`Database error ending session: ${dbErr.message}`);
                  }
                  
                  logger.info(`Session ${sessionId} auto-ended due to inactivity`);
                }
              }
            } catch (err) {
              logger.error(`Error in session auto-end timer: ${err.message}`, err);
            }
          }, 15 * 60 * 1000); // 15 minutes
        }
      } catch (err) {
        logger.error(`Error in disconnect handler: ${err.message}`, err);
      }
    });
  });
  
  return namespace;
}

/**
 * Prepare a game session by loading trivia questions
 * @param {string} sessionId - The session ID
 * @param {SocketIO.Namespace} namespace - The Socket.IO namespace
 */
async function prepareGame(sessionId, namespace) {
  try {
    // Get session from memory
    const session = global.activeSessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    // Skip if questions are already loaded
    if (session.questions.length > 0) {
      return;
    }
    
    // Load trivia questions based on session settings
    const questionCount = session.settings.questionCount || 10;
    const difficulty = session.settings.difficulty || 'mixed';
    const categories = session.settings.categories || [];
    
    const questions = await getTriviaQuestions(questionCount, difficulty, categories);
    
    // Format questions for the game
    const formattedQuestions = questions.map((q, index) => ({
      index,
      questionId: q.id || uuidv4(),
      category: q.category,
      difficulty: q.difficulty,
      text: q.question,
      choices: q.choices,
      correctAnswerIndex: q.correctAnswerIndex,
      timeLimit: q.timeLimit || session.settings.timeLimit || 30,
      points: q.points || session.settings.pointsPerQuestion || 100
    }));
    
    // Update session with questions
    session.questions = formattedQuestions;
    global.activeSessions.set(sessionId, session);
    
    // Try to update in database (non-blocking)
    try {
      await Session.findOneAndUpdate(
        { sessionId },
        { 
          questions: formattedQuestions,
          lastActivity: new Date()
        }
      );
    } catch (dbErr) {
      console.error(`Database error updating session questions: ${dbErr.message}`);
      // Continue even if DB update fails
    }
    
    console.info(`Loaded ${formattedQuestions.length} questions for session ${sessionId}`);
  } catch (err) {
    console.error(`Error preparing game for session ${sessionId}: ${err.message}`, err);
    
    // Notify players about the error
    namespace.to(sessionId).emit('error', {
      message: 'Failed to prepare game questions'
    });
  }
}

/**
 * Start a countdown to begin the game
 * @param {string} sessionId - The session ID
 * @param {SocketIO.Namespace} namespace - The Socket.IO namespace
 */
function startGameCountdown(sessionId, namespace) {
  // Get session from memory
  const session = global.activeSessions.get(sessionId);
  
  if (!session || session.status !== 'waiting') {
    return;
  }
  
  // Set countdown duration
  const countdownSeconds = 5;
  
  // Notify players that game will start soon
  namespace.to(sessionId).emit('game:countdown', {
    seconds: countdownSeconds,
    message: `Game starting in ${countdownSeconds} seconds...`
  });
  
  // Start the countdown
  let remainingSeconds = countdownSeconds;
  const countdownInterval = setInterval(() => {
    remainingSeconds--;
    
    if (remainingSeconds > 0) {
      // Update countdown
      namespace.to(sessionId).emit('game:countdown', {
        seconds: remainingSeconds,
        message: `Game starting in ${remainingSeconds} seconds...`
      });
    } else {
      // Clear interval
      clearInterval(countdownInterval);
      
      // Start the game
      startGame(sessionId, namespace);
    }
  }, 1000);
}

/**
 * Start a game session
 * @param {string} sessionId - The session ID
 * @param {SocketIO.Namespace} namespace - The Socket.IO namespace
 */
async function startGame(sessionId, namespace) {
  try {
    // Get session from memory
    const session = global.activeSessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    // Make sure questions are loaded
    if (!session.questions || session.questions.length === 0) {
      await prepareGame(sessionId, namespace);
      
      // Re-get session after preparing game
      const updatedSession = global.activeSessions.get(sessionId);
      
      if (!updatedSession || !updatedSession.questions || updatedSession.questions.length === 0) {
        throw new Error('Failed to load questions');
      }
      
      // Update our local reference
      session.questions = updatedSession.questions;
    }
    
    // Update session status
    session.status = 'active';
    session.startedAt = new Date();
    session.currentQuestion = 0; // Will be incremented in serveNextQuestion
    
    // Update session in memory
    global.activeSessions.set(sessionId, session);
    
    // Try to update in database (non-blocking)
    try {
      await Session.findOneAndUpdate(
        { sessionId },
        { 
          status: 'active',
          startedAt: new Date(),
          currentQuestion: 0,
          lastActivity: new Date()
        }
      );
    } catch (dbErr) {
      console.error(`Database error updating session start: ${dbErr.message}`);
      // Continue even if DB update fails
    }
    
    // Notify players that game is starting
    namespace.to(sessionId).emit('game:started', {
      sessionId,
      playerCount: session.players.length,
      totalQuestions: session.questions.length
    });
    
    // Notify admin namespace
    const adminNamespace = namespace.server.of('/admin');
    adminNamespace.emit('game:started', {
      sessionId,
      playerCount: session.players.length,
      totalQuestions: session.questions.length
    });
    
    console.info(`Game started for session ${sessionId} with ${session.players.length} players`);
    
    // Serve first question after a short delay
    setTimeout(() => {
      serveNextQuestion(sessionId, namespace);
    }, 2000);
  } catch (err) {
    console.error(`Error starting game for session ${sessionId}: ${err.message}`, err);
    
    // Notify players about the error
    namespace.to(sessionId).emit('error', {
      message: 'Failed to start game'
    });
  }
}

/**
 * Serve the next question in the game
 * @param {string} sessionId - The session ID
 * @param {SocketIO.Namespace} namespace - The Socket.IO namespace
 */
async function serveNextQuestion(sessionId, namespace) {
  try {
    // Get session from memory
    const session = global.activeSessions.get(sessionId);
    
    if (!session || session.status !== 'active') {
      return;
    }
    
    // Increment current question
    session.currentQuestion++;
    
    // Check if we've reached the end of questions
    if (session.currentQuestion > session.questions.length) {
      // End the game
      endGame(sessionId, namespace);
      return;
    }
    
    // Get the current question
    const currentQuestionIndex = session.currentQuestion - 1;
    const currentQuestion = session.questions[currentQuestionIndex];
    
    // Set the time this question was asked
    currentQuestion.askedAt = new Date();
    
    // Update session in memory
    global.activeSessions.set(sessionId, session);
    
    // Try to update in database (non-blocking)
    try {
      await Session.findOneAndUpdate(
        { sessionId },
        { 
          currentQuestion: session.currentQuestion,
          [`questions.${currentQuestionIndex}.askedAt`]: currentQuestion.askedAt,
          lastActivity: new Date()
        }
      );
    } catch (dbErr) {
      console.error(`Database error updating current question: ${dbErr.message}`);
      // Continue even if DB update fails
    }
    
    // Send question to all players
    namespace.to(sessionId).emit('question', {
      index: currentQuestionIndex,
      totalQuestions: session.questions.length,
      text: currentQuestion.text,
      category: currentQuestion.category,
      difficulty: currentQuestion.difficulty,
      choices: currentQuestion.choices,
      timeLimit: currentQuestion.timeLimit || session.settings.timeLimit || 30,
      askedAt: currentQuestion.askedAt
    });
    
    console.info(`Serving question ${session.currentQuestion}/${session.questions.length} to session ${sessionId}`);
    
    // Set a timer to reveal the answer after time limit
    const timeLimit = (currentQuestion.timeLimit || session.settings.timeLimit || 30) * 1000;
    
    // Clear any existing timer for this session
    const existingTimer = questionTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timerId = setTimeout(() => {
      revealAnswer(sessionId, namespace);
    }, timeLimit);
    
    // Store timer ID for cleanup
    questionTimers.set(sessionId, timerId);
  } catch (err) {
    console.error(`Error serving next question for session ${sessionId}: ${err.message}`, err);
    
    // Notify players about the error
    namespace.to(sessionId).emit('error', {
      message: 'Failed to serve next question'
    });
  }
}

/**
 * Reveal the answer to the current question
 * @param {string} sessionId - The session ID
 * @param {SocketIO.Namespace} namespace - The Socket.IO namespace
 */
async function revealAnswer(sessionId, namespace) {
  try {
    // Get session from memory
    const session = global.activeSessions.get(sessionId);
    
    if (!session || session.status !== 'active') {
      return;
    }
    
    // Get the current question
    const currentQuestionIndex = session.currentQuestion - 1;
    
    if (currentQuestionIndex < 0 || currentQuestionIndex >= session.questions.length) {
      return;
    }
    
    const currentQuestion = session.questions[currentQuestionIndex];
    
    // Send answer reveal to all players
    namespace.to(sessionId).emit('answer:reveal', {
      questionIndex: currentQuestionIndex,
      correctAnswerIndex: currentQuestion.correctAnswerIndex,
      explanation: currentQuestion.explanation || null
    });
    
    // Send updated scores
    const playerScores = session.players.map(p => ({
      playerId: p.playerId,
      name: p.name,
      score: p.score,
      hasAnswered: p.answers.some(a => a.questionIndex === currentQuestionIndex),
      answerCorrect: p.answers.find(a => a.questionIndex === currentQuestionIndex)?.correct
    }));
    
    namespace.to(sessionId).emit('scores:update', {
      playerScores,
      questionIndex: currentQuestionIndex,
      isComplete: true
    });
    
    console.info(`Revealed answer for question ${currentQuestionIndex + 1} in session ${sessionId}`);
    
    // Wait a moment before serving the next question
    setTimeout(() => {
      serveNextQuestion(sessionId, namespace);
    }, 5000);
  } catch (err) {
    console.error(`Error revealing answer for session ${sessionId}: ${err.message}`, err);
  }
}

/**
 * End the game session and calculate final scores
 * @param {string} sessionId - The session ID
 * @param {SocketIO.Namespace} namespace - The Socket.IO namespace
 */
async function endGame(sessionId, namespace) {
  try {
    // Get session from memory
    const session = global.activeSessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    // Update session status
    session.status = 'completed';
    session.endedAt = new Date();
    
    // Calculate final scores and stats
    const finalScores = session.players.map(player => {
      // Calculate stats
      const totalAnswered = player.answers.length;
      const correctAnswers = player.answers.filter(a => a.correct).length;
      const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : 0;
      
      return {
        playerId: player.playerId,
        name: player.name,
        score: player.score,
        stats: {
          questionsAnswered: totalAnswered,
          correctAnswers,
          accuracy: Math.round(accuracy),
          averageTimeToAnswer: totalAnswered > 0 
            ? Math.round(player.answers.reduce((sum, a) => sum + a.timeToAnswer, 0) / totalAnswered / 1000)
            : null
        }
      };
    });
    
    // Sort by score (highest first)
    finalScores.sort((a, b) => b.score - a.score);
    
    // Update session in memory
    global.activeSessions.set(sessionId, session);
    
    // Try to update in database (non-blocking)
    try {
      await Session.findOneAndUpdate(
        { sessionId },
        { 
          status: 'completed',
          endedAt: new Date(),
          lastActivity: new Date()
        }
      );
    } catch (dbErr) {
      console.error(`Database error updating session end: ${dbErr.message}`);
      // Continue even if DB update fails
    }
    
    // Send game completion to all players
    namespace.to(sessionId).emit('game:complete', {
      sessionId,
      finalScores,
      totalQuestions: session.questions.length,
      gameDuration: Math.round((session.endedAt - session.startedAt) / 1000) // in seconds
    });
    
    // Notify admin namespace
    const adminNamespace = namespace.server.of('/admin');
    adminNamespace.emit('game:complete', {
      sessionId,
      finalScores,
      totalQuestions: session.questions.length,
      gameDuration: Math.round((session.endedAt - session.startedAt) / 1000)
    });
    
    console.info(`Game completed for session ${sessionId}`);
    
    // Save scores to leaderboard
    for (const player of finalScores) {
      try {
        // Only save scores if player answered at least one question
        if (player.stats.questionsAnswered > 0) {
          const playerObj = session.players.find(p => p.playerId === player.playerId);
          
          await new Leaderboard({
            alias: player.name,
            score: player.score,
            sessionId,
            gameDate: session.startedAt,
            metadata: {
              questionCount: session.questions.length,
              difficulty: session.settings.difficulty,
              categories: session.settings.categories,
              timeSpent: Math.round((session.endedAt - session.startedAt) / 1000),
              correctAnswers: player.stats.correctAnswers,
              totalQuestions: player.stats.questionsAnswered,
              device: playerObj?.device
            }
          }).save();
        }
      } catch (leaderboardErr) {
        console.error(`Error saving leaderboard entry for player ${player.playerId}: ${leaderboardErr.message}`);
        // Continue with other players even if one fails
      }
    }
  } catch (err) {
    console.error(`Error ending game for session ${sessionId}: ${err.message}`, err);
    
    // Notify players about the error
    namespace.to(sessionId).emit('error', {
      message: 'Failed to complete game'
    });
  }
}

module.exports = { setupGameNamespace };
