/**
 * Admin Namespace Socket.IO Handler
 * 
 * Manages real-time communication for the admin/driver interface including:
 * - Session monitoring and control
 * - Player activity tracking
 * - Game state observation
 * - Song request management
 * - System notifications
 */

const { Session } = require('../models/session');
const { Leaderboard } = require('../models/leaderboard');

/**
 * Setup the admin namespace with all event handlers
 * @param {SocketIO.Namespace} namespace - The Socket.IO admin namespace
 */
function setupAdminNamespace(namespace) {
  // Middleware for admin authentication
  namespace.use((socket, next) => {
    const { adminToken } = socket.handshake.auth;
    
    // Validate admin token
    const validToken = process.env.ADMIN_TOKEN || 'taps-tokens-admin-secret';
    
    if (!adminToken || adminToken !== validToken) {
      return next(new Error('Unauthorized: Invalid admin token'));
    }
    
    // Authentication successful
    next();
  });
  
  // Connection handler
  namespace.on('connection', (socket) => {
    const logger = socket.request.app.locals.logger || console;
    
    logger.info(`Admin connected: ${socket.id}`);
    
    // Send initial active sessions data
    sendActiveSessions(socket);
    
    // Handle admin requesting session list
    socket.on('sessions:list', async () => {
      try {
        await sendActiveSessions(socket);
      } catch (err) {
        logger.error('Error fetching session list:', err);
        socket.emit('error', { 
          message: 'Failed to fetch session list' 
        });
      }
    });
    
    // Handle admin joining a specific session for monitoring
    socket.on('session:join', async (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Join the session room
        socket.join(sessionId);
        
        // Get session details
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          // Try to find in database
          const sessionFromDb = await Session.findOne({ sessionId });
          
          if (!sessionFromDb) {
            return socket.emit('error', { 
              message: 'Session not found' 
            });
          }
          
          // Send historical session data
          return socket.emit('session:details', {
            sessionId,
            status: sessionFromDb.status,
            createdAt: sessionFromDb.createdAt,
            startedAt: sessionFromDb.startedAt,
            endedAt: sessionFromDb.endedAt,
            players: sessionFromDb.players,
            currentQuestion: sessionFromDb.currentQuestion,
            questions: sessionFromDb.questions,
            settings: sessionFromDb.settings,
            isHistorical: true
          });
        }
        
        // Send active session data
        socket.emit('session:details', {
          sessionId,
          status: session.status,
          createdAt: session.createdAt,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          players: session.players,
          currentQuestion: session.currentQuestion,
          questions: session.questions,
          settings: session.settings,
          isHistorical: false
        });
        
        logger.info(`Admin joined session ${sessionId}`);
      } catch (err) {
        logger.error(`Error joining session: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to join session' 
        });
      }
    });
    
    // Handle admin leaving a session
    socket.on('session:leave', (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Leave the session room
        socket.leave(sessionId);
        
        logger.info(`Admin left session ${sessionId}`);
      } catch (err) {
        logger.error(`Error leaving session: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to leave session' 
        });
      }
    });
    
    // Handle admin ending a session
    socket.on('session:end', async (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found or already ended' 
          });
        }
        
        // Update session status
        session.status = 'completed';
        session.endedAt = new Date();
        
        // Update in memory
        global.activeSessions.set(sessionId, session);
        
        // Update in database
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
          logger.error(`Database error ending session: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Notify all clients in this session
        const gameNamespace = socket.server.of('/game');
        gameNamespace.to(sessionId).emit('session:ended', {
          sessionId,
          message: 'This session has been ended by the driver'
        });
        
        // Notify all admins
        namespace.emit('session:ended', {
          sessionId,
          endedAt: session.endedAt
        });
        
        logger.info(`Admin ended session ${sessionId}`);
      } catch (err) {
        logger.error(`Error ending session: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to end session' 
        });
      }
    });
    
    // Handle admin resetting a session
    socket.on('session:reset', async (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found' 
          });
        }
        
        // Create a new session with same settings
        const { v4: uuidv4 } = require('uuid');
        const newSessionId = uuidv4();
        
        // Generate QR code URL
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? process.env.BASE_URL || 'https://play.tapstoken.com'
          : 'http://localhost:5174';
        
        const qrCodeUrl = `${baseUrl}/join/${newSessionId}`;
        
        // Create new session in database
        const newSession = new Session({
          sessionId: newSessionId,
          createdAt: new Date(),
          status: 'waiting',
          players: [],
          currentQuestion: 0,
          settings: session.settings,
          qrCodeUrl
        });
        
        await newSession.save();
        
        // Archive old session
        session.status = 'completed';
        session.endedAt = new Date();
        global.activeSessions.set(sessionId, session);
        
        // Update old session in database
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
          logger.error(`Database error archiving old session: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Add new session to memory
        global.activeSessions.set(newSessionId, {
          id: newSessionId,
          createdAt: new Date(),
          status: 'waiting',
          players: [],
          currentQuestion: 0,
          questions: [],
          settings: session.settings,
          qrCodeUrl
        });
        
        // Notify all clients in old session
        const gameNamespace = socket.server.of('/game');
        gameNamespace.to(sessionId).emit('session:reset', {
          oldSessionId: sessionId,
          newSessionId,
          message: 'This session has been reset by the driver'
        });
        
        // Notify all admins
        namespace.emit('session:reset', {
          oldSessionId: sessionId,
          newSessionId,
          qrCodeUrl
        });
        
        logger.info(`Admin reset session ${sessionId} to new session ${newSessionId}`);
      } catch (err) {
        logger.error(`Error resetting session: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to reset session' 
        });
      }
    });
    
    // Handle admin starting a game manually
    socket.on('game:start', async (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found' 
          });
        }
        
        if (session.status !== 'waiting') {
          return socket.emit('error', { 
            message: 'Game already started or completed' 
          });
        }
        
        if (session.players.length === 0) {
          return socket.emit('error', { 
            message: 'Cannot start game with no players' 
          });
        }
        
        // Update session status
        session.status = 'active';
        session.startedAt = new Date();
        session.currentQuestion = 0;
        
        // Update in memory
        global.activeSessions.set(sessionId, session);
        
        // Update in database
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
          logger.error(`Database error starting game: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Notify game namespace to start the game
        const gameNamespace = socket.server.of('/game');
        gameNamespace.to(sessionId).emit('game:started', {
          sessionId,
          playerCount: session.players.length,
          message: 'Game started by driver'
        });
        
        // Notify all admins
        namespace.emit('game:started', {
          sessionId,
          startedAt: session.startedAt,
          playerCount: session.players.length
        });
        
        logger.info(`Admin started game for session ${sessionId}`);
        
        // Trigger first question after a short delay
        setTimeout(() => {
          // This will be handled by the game namespace
          gameNamespace.to(sessionId).emit('admin:next_question');
        }, 3000);
      } catch (err) {
        logger.error(`Error starting game: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to start game' 
        });
      }
    });
    
    // Handle admin pausing a game
    socket.on('game:pause', async (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found' 
          });
        }
        
        if (session.status !== 'active') {
          return socket.emit('error', { 
            message: 'Game is not active' 
          });
        }
        
        // Update session status
        session.status = 'paused';
        
        // Update in memory
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
          logger.error(`Database error pausing game: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Notify all clients in this session
        const gameNamespace = socket.server.of('/game');
        gameNamespace.to(sessionId).emit('game:paused', {
          sessionId,
          message: 'Game paused by driver'
        });
        
        // Notify all admins
        namespace.emit('game:paused', {
          sessionId
        });
        
        logger.info(`Admin paused game for session ${sessionId}`);
      } catch (err) {
        logger.error(`Error pausing game: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to pause game' 
        });
      }
    });
    
    // Handle admin resuming a game
    socket.on('game:resume', async (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found' 
          });
        }
        
        if (session.status !== 'paused') {
          return socket.emit('error', { 
            message: 'Game is not paused' 
          });
        }
        
        // Update session status
        session.status = 'active';
        
        // Update in memory
        global.activeSessions.set(sessionId, session);
        
        // Update in database
        try {
          await Session.findOneAndUpdate(
            { sessionId },
            { 
              status: 'active',
              lastActivity: new Date()
            }
          );
        } catch (dbErr) {
          logger.error(`Database error resuming game: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Notify all clients in this session
        const gameNamespace = socket.server.of('/game');
        gameNamespace.to(sessionId).emit('game:resumed', {
          sessionId,
          message: 'Game resumed by driver'
        });
        
        // Notify all admins
        namespace.emit('game:resumed', {
          sessionId
        });
        
        logger.info(`Admin resumed game for session ${sessionId}`);
      } catch (err) {
        logger.error(`Error resuming game: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to resume game' 
        });
      }
    });
    
    // Handle admin skipping to next question
    socket.on('question:skip', async (data) => {
      try {
        if (!data || !data.sessionId) {
          return socket.emit('error', { 
            message: 'Session ID is required' 
          });
        }
        
        const { sessionId } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found' 
          });
        }
        
        if (session.status !== 'active') {
          return socket.emit('error', { 
            message: 'Game is not active' 
          });
        }
        
        // Notify game namespace to skip to next question
        const gameNamespace = socket.server.of('/game');
        gameNamespace.to(sessionId).emit('admin:next_question', {
          forced: true,
          message: 'Question skipped by driver'
        });
        
        logger.info(`Admin skipped to next question in session ${sessionId}`);
      } catch (err) {
        logger.error(`Error skipping question: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to skip question' 
        });
      }
    });
    
    // Handle admin responding to song request
    socket.on('song:response', async (data) => {
      try {
        if (!data || !data.sessionId || !data.playerId || !data.status) {
          return socket.emit('error', { 
            message: 'Missing required fields' 
          });
        }
        
        const { sessionId, playerId, status, message } = data;
        
        // Get session from memory
        const session = global.activeSessions.get(sessionId);
        
        if (!session) {
          return socket.emit('error', { 
            message: 'Session not found' 
          });
        }
        
        // Find player in session
        const player = session.players.find(p => p.playerId === playerId);
        
        if (!player) {
          return socket.emit('error', { 
            message: 'Player not found in session' 
          });
        }
        
        // Update song request status in session metadata
        if (session.metadata && session.metadata.songRequests) {
          const request = session.metadata.songRequests.find(r => r.playerId === playerId);
          
          if (request) {
            request.status = status;
            request.adminResponse = message || '';
            request.respondedAt = new Date();
          }
        }
        
        // Update in memory
        global.activeSessions.set(sessionId, session);
        
        // Try to update in database
        try {
          await Session.findOneAndUpdate(
            { sessionId, 'metadata.songRequests.playerId': playerId },
            { 
              $set: { 
                'metadata.songRequests.$.status': status,
                'metadata.songRequests.$.adminResponse': message || '',
                'metadata.songRequests.$.respondedAt': new Date()
              }
            }
          );
        } catch (dbErr) {
          logger.error(`Database error updating song request: ${dbErr.message}`);
          // Continue even if DB update fails
        }
        
        // Notify player about response
        const gameNamespace = socket.server.of('/game');
        const playerSocket = Array.from(gameNamespace.sockets.values())
          .find(s => s.id === player.socketId);
        
        if (playerSocket) {
          playerSocket.emit('song:response', {
            status,
            message: message || (status === 'approved' 
              ? 'Your song request has been approved!' 
              : 'Your song request could not be played at this time.')
          });
        }
        
        // Notify all admins
        namespace.emit('song:response:sent', {
          sessionId,
          playerId,
          playerName: player.name,
          status,
          message: message || ''
        });
        
        logger.info(`Admin responded to song request from player ${playerId} with status: ${status}`);
      } catch (err) {
        logger.error(`Error responding to song request: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to respond to song request' 
        });
      }
    });
    
    // Handle admin requesting leaderboard data
    socket.on('leaderboard:get', async (data) => {
      try {
        const limit = data?.limit || 10;
        const period = data?.period || 'all-time';
        
        // Get leaderboard data
        const timeFilter = {};
        
        if (period !== 'all-time') {
          const now = new Date();
          
          switch (period) {
            case 'day':
              timeFilter.createdAt = { $gte: new Date(now.setDate(now.getDate() - 1)) };
              break;
            case 'week':
              timeFilter.createdAt = { $gte: new Date(now.setDate(now.getDate() - 7)) };
              break;
            case 'month':
              timeFilter.createdAt = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
              break;
            case 'year':
              timeFilter.createdAt = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
              break;
          }
        }
        
        // Get top scores
        const topScores = await Leaderboard.find(timeFilter)
          .sort({ score: -1, createdAt: 1 })
          .limit(limit)
          .select('alias score gameDate createdAt metadata phone -_id')
          .lean();
        
        // Format the response
        const formattedScores = topScores.map((entry, index) => ({
          rank: index + 1,
          alias: entry.alias,
          score: entry.score,
          date: entry.gameDate || entry.createdAt,
          phone: entry.phone,
          metadata: entry.metadata
        }));
        
        socket.emit('leaderboard:data', {
          period,
          scores: formattedScores
        });
        
        logger.info(`Sent leaderboard data to admin (period: ${period}, limit: ${limit})`);
      } catch (err) {
        logger.error(`Error fetching leaderboard: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to fetch leaderboard data' 
        });
      }
    });
    
    // Handle admin requesting system stats
    socket.on('stats:get', async () => {
      try {
        // Get various statistics
        const activeSessions = global.activeSessions.size;
        const totalSessions = await Session.countDocuments();
        const totalPlayers = await Session.aggregate([
          { $unwind: '$players' },
          { $group: { _id: null, count: { $sum: 1 } } }
        ]);
        const totalLeaderboardEntries = await Leaderboard.countDocuments();
        
        // Get recent activity
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const sessionsToday = await Session.countDocuments({ 
          createdAt: { $gte: dayAgo } 
        });
        
        const scoresSubmittedToday = await Leaderboard.countDocuments({ 
          createdAt: { $gte: dayAgo } 
        });
        
        // Get system uptime and memory usage
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        socket.emit('stats:data', {
          sessions: {
            active: activeSessions,
            total: totalSessions,
            today: sessionsToday
          },
          players: {
            total: totalPlayers.length > 0 ? totalPlayers[0].count : 0
          },
          leaderboard: {
            entries: totalLeaderboardEntries,
            submittedToday: scoresSubmittedToday
          },
          system: {
            uptime,
            memory: {
              rss: Math.round(memoryUsage.rss / 1024 / 1024),
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024)
            }
          }
        });
        
        logger.info('Sent system stats to admin');
      } catch (err) {
        logger.error(`Error fetching system stats: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to fetch system statistics' 
        });
      }
    });
    
    // Handle admin creating a new session
    socket.on('session:create', async (data) => {
      try {
        // Validate session settings
        const settings = {
          maxPlayers: data?.maxPlayers || 4,
          questionCount: data?.questionCount || 10,
          categories: data?.categories || [],
          difficulty: data?.difficulty || 'mixed',
          timeLimit: data?.timeLimit || 30,
          pointsPerQuestion: data?.pointsPerQuestion || 100,
          bonusTimePoints: data?.bonusTimePoints !== undefined ? data.bonusTimePoints : true
        };
        
        // Generate session ID
        const { v4: uuidv4 } = require('uuid');
        const sessionId = uuidv4();
        
        // Generate QR code URL
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? process.env.BASE_URL || 'https://play.tapstoken.com'
          : 'http://localhost:5174';
        
        const qrCodeUrl = `${baseUrl}/join/${sessionId}`;
        
        // Create session in database
        const newSession = new Session({
          sessionId,
          createdAt: new Date(),
          status: 'waiting',
          players: [],
          currentQuestion: 0,
          settings,
          qrCodeUrl
        });
        
        await newSession.save();
        
        // Add to active sessions in memory
        global.activeSessions.set(sessionId, {
          id: sessionId,
          createdAt: new Date(),
          status: 'waiting',
          players: [],
          currentQuestion: 0,
          questions: [],
          settings,
          qrCodeUrl
        });
        
        // Notify all admins
        namespace.emit('session:created', {
          sessionId,
          qrCodeUrl,
          createdAt: new Date(),
          settings
        });
        
        // Send specific confirmation to requesting admin
        socket.emit('session:created:confirm', {
          sessionId,
          qrCodeUrl,
          createdAt: new Date(),
          settings
        });
        
        logger.info(`Admin created new session ${sessionId}`);
      } catch (err) {
        logger.error(`Error creating session: ${err.message}`, err);
        socket.emit('error', { 
          message: 'Failed to create session' 
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Admin disconnected: ${socket.id}`);
    });
  });
  
  return namespace;
}

/**
 * Send active sessions list to admin
 * @param {SocketIO.Socket} socket - The admin socket
 */
async function sendActiveSessions(socket) {
  try {
    // Get active sessions from memory
    const activeSessions = Array.from(global.activeSessions.entries()).map(([id, session]) => ({
      sessionId: id,
      status: session.status,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      playerCount: session.players.length,
      currentQuestion: session.currentQuestion,
      totalQuestions: session.questions.length,
      qrCodeUrl: session.qrCodeUrl
    }));
    
    // Get recent completed sessions from database
    const recentCompletedSessions = await Session.find({
      status: 'completed',
      endedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .sort({ endedAt: -1 })
    .limit(5)
    .select('sessionId status createdAt startedAt endedAt players questions')
    .lean();
    
    const formattedCompletedSessions = recentCompletedSessions.map(session => ({
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      playerCount: session.players.length,
      currentQuestion: session.currentQuestion,
      totalQuestions: session.questions.length,
      isHistorical: true
    }));
    
    // Send to admin
    socket.emit('sessions:list', {
      active: activeSessions,
      recent: formattedCompletedSessions
    });
  } catch (err) {
    console.error('Error sending active sessions:', err);
    socket.emit('error', { 
      message: 'Failed to retrieve session list' 
    });
  }
}

module.exports = { setupAdminNamespace };
