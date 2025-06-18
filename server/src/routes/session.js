/**
 * Session Management Routes
 * 
 * Handles creation, retrieval, and management of game sessions
 * for the Taps Tokens Trivia application.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { Session } = require('../models/session');

/**
 * @swagger
 * tags:
 *   name: Session
 *   description: API for managing game sessions
 */

// Validation schemas
const createSessionSchema = Joi.object({
  driverId: Joi.string().trim().optional(),
  maxPlayers: Joi.number().integer().min(1).max(10).default(4),
  questionCount: Joi.number().integer().min(1).max(30).default(10),
  categories: Joi.array().items(Joi.string()).optional(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard', 'mixed').default('mixed'),
  timeLimit: Joi.number().integer().min(10).max(60).default(30)
});

const adminTokenSchema = Joi.object({
  adminToken: Joi.string().required()
});

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'] || req.query.adminToken;
  
  if (!adminToken) {
    return res.status(401).json({
      status: 'error',
      message: 'Admin token is required'
    });
  }

  // Validate against environment variable or stored token
  const validToken = process.env.ADMIN_TOKEN || 'taps-tokens-admin-secret';
  
  if (adminToken !== validToken) {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid admin token'
    });
  }

  next();
};

/**
 * @swagger
 * /session:
 *   post:
 *     summary: Create a new game session
 *     tags: [Session]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               driverId:
 *                 type: string
 *               maxPlayers:
 *                 type: integer
 *                 default: 4
 *               questionCount:
 *                 type: integer
 *                 default: 10
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard, mixed]
 *                 default: mixed
 *               timeLimit:
 *                 type: integer
 *                 default: 30
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createSessionSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details[0].message
      });
    }

    // Generate unique session ID
    const sessionId = uuidv4();
    
    // Create QR code URL for this session
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BASE_URL || 'https://play.tapstoken.com'
      : 'http://localhost:5174';
    
    const qrCodeUrl = `${baseUrl}/join/${sessionId}`;
    
    // Create session in database (for persistence)
    const newSession = new Session({
      sessionId,
      createdAt: new Date(),
      status: 'waiting',
      players: [],
      currentQuestion: 0,
      settings: value
    });
    
    await newSession.save();
    
    // Add to active sessions in memory
    global.activeSessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      status: 'waiting', // waiting, active, completed
      players: [],
      currentQuestion: 0,
      questions: [], // Will be populated when game starts
      settings: value,
      qrCodeUrl
    });
    
    // Return session details
    res.status(201).json({
      status: 'success',
      data: {
        sessionId,
        qrCodeUrl,
        status: 'waiting',
        createdAt: new Date(),
        settings: value
      }
    });
  } catch (err) {
    req.logger.error('Error creating session:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create session'
    });
  }
});

/**
 * @swagger
 * /session/{id}:
 *   get:
 *     summary: Get session details
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID
 *       - in: header
 *         name: x-admin-token
 *         schema:
 *           type: string
 *         description: Admin token for full details
 *     responses:
 *       200:
 *         description: Session details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.headers['x-admin-token'] === (process.env.ADMIN_TOKEN || 'taps-tokens-admin-secret');
    
    // Check if session exists in memory
    const sessionInMemory = global.activeSessions.get(id);
    
    if (!sessionInMemory) {
      // Try to find in database
      const sessionInDb = await Session.findOne({ sessionId: id });
      
      if (!sessionInDb) {
        return res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
      }
      
      // Return limited info from database
      return res.json({
        status: 'success',
        data: {
          sessionId: sessionInDb.sessionId,
          status: sessionInDb.status,
          createdAt: sessionInDb.createdAt,
          playerCount: sessionInDb.players.length,
          // Only include sensitive data for admin
          ...(isAdmin && {
            players: sessionInDb.players,
            currentQuestion: sessionInDb.currentQuestion,
            settings: sessionInDb.settings
          })
        }
      });
    }
    
    // Return active session from memory
    res.json({
      status: 'success',
      data: {
        sessionId: sessionInMemory.id,
        status: sessionInMemory.status,
        createdAt: sessionInMemory.createdAt,
        playerCount: sessionInMemory.players.length,
        qrCodeUrl: sessionInMemory.qrCodeUrl,
        // Only include sensitive data for admin
        ...(isAdmin && {
          players: sessionInMemory.players,
          currentQuestion: sessionInMemory.currentQuestion,
          questions: sessionInMemory.questions,
          settings: sessionInMemory.settings
        })
      }
    });
  } catch (err) {
    req.logger.error(`Error retrieving session ${req.params.id}:`, err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve session'
    });
  }
});

/**
 * @swagger
 * /session/{id}:
 *   delete:
 *     summary: End a session (admin only)
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID
 *       - in: header
 *         name: x-admin-token
 *         schema:
 *           type: string
 *         required: true
 *         description: Admin token
 *     responses:
 *       200:
 *         description: Session ended successfully
 *       401:
 *         description: Admin token is required
 *       403:
 *         description: Invalid admin token
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if session exists
    const session = global.activeSessions.get(id);
    
    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found'
      });
    }
    
    // Update session in database
    await Session.findOneAndUpdate(
      { sessionId: id },
      { 
        status: 'completed',
        endedAt: new Date()
      }
    );
    
    // Remove from active sessions
    global.activeSessions.delete(id);
    
    // Emit socket event to all connected clients in this session
    const io = req.app.get('io');
    if (io) {
      io.of('/game').to(id).emit('session:ended', { 
        sessionId: id,
        message: 'This session has been ended by the driver'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Session ended successfully'
    });
  } catch (err) {
    req.logger.error(`Error ending session ${req.params.id}:`, err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to end session'
    });
  }
});

/**
 * @swagger
 * /session/{id}/reset:
 *   post:
 *     summary: Reset a session for new players (admin only)
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID to reset
 *       - in: header
 *         name: x-admin-token
 *         schema:
 *           type: string
 *         required: true
 *         description: Admin token
 *     responses:
 *       200:
 *         description: Session reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 oldSessionId:
 *                   type: string
 *                 newSessionId:
 *                   type: string
 *                 qrCodeUrl:
 *                   type: string
 *       401:
 *         description: Admin token is required
 *       403:
 *         description: Invalid admin token
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.post('/:id/reset', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if session exists
    const session = global.activeSessions.get(id);
    
    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found'
      });
    }
    
    // Archive current session in database
    await Session.findOneAndUpdate(
      { sessionId: id },
      { 
        status: 'completed',
        endedAt: new Date()
      }
    );
    
    // Create new session with same settings
    const newSessionId = uuidv4();
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
      settings: session.settings
    });
    
    await newSession.save();
    
    // Remove old session from memory
    global.activeSessions.delete(id);
    
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
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Notify old session participants
      io.of('/game').to(id).emit('session:reset', { 
        oldSessionId: id,
        newSessionId: newSessionId,
        message: 'This session has been reset by the driver'
      });
      
      // Notify admin
      io.of('/admin').emit('session:created', {
        sessionId: newSessionId,
        qrCodeUrl,
        status: 'waiting',
        createdAt: new Date()
      });
    }
    
    res.json({
      status: 'success',
      data: {
        oldSessionId: id,
        newSessionId,
        qrCodeUrl,
        message: 'Session reset successfully'
      }
    });
  } catch (err) {
    req.logger.error(`Error resetting session ${req.params.id}:`, err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset session'
    });
  }
});

/**
 * @swagger
 * /session/{id}/qr:
 *   get:
 *     summary: Get QR code URL for a session
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID
 *     responses:
 *       200:
 *         description: QR code URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 qrCodeUrl:
 *                   type: string
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.get('/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if session exists
    const session = global.activeSessions.get(id);
    
    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found'
      });
    }
    
    res.json({
      status: 'success',
      data: {
        sessionId: id,
        qrCodeUrl: session.qrCodeUrl
      }
    });
  } catch (err) {
    req.logger.error(`Error retrieving QR code for session ${req.params.id}:`, err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve QR code'
    });
  }
});

/**
 * @swagger
 * /session/active:
 *   get:
 *     summary: Get all active sessions (admin only)
 *     tags: [Session]
 *     parameters:
 *       - in: header
 *         name: x-admin-token
 *         schema:
 *           type: string
 *         required: true
 *         description: Admin token
 *     responses:
 *       200:
 *         description: List of active sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SessionSummary'
 *       401:
 *         description: Admin token is required
 *       403:
 *         description: Invalid admin token
 *       500:
 *         description: Server error
 */
router.get('/active', authenticateAdmin, async (req, res) => {
  try {
    const activeSessions = Array.from(global.activeSessions.values()).map(session => ({
      sessionId: session.id,
      status: session.status,
      createdAt: session.createdAt,
      playerCount: session.players.length,
      qrCodeUrl: session.qrCodeUrl
    }));
    
    res.json({
      status: 'success',
      data: {
        count: activeSessions.length,
        sessions: activeSessions
      }
    });
  } catch (err) {
    req.logger.error('Error retrieving active sessions:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve active sessions'
    });
  }
});

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     SessionSettings:
 *       type: object
 *       properties:
 *         driverId:
 *           type: string
 *         maxPlayers:
 *           type: integer
 *         questionCount:
 *           type: integer
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *         difficulty:
 *           type: string
 *         timeLimit:
 *           type: integer
 *     Player:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         score:
 *           type: integer
 *         isActive:
 *           type: boolean
 *     Question:
 *       type: object
 *       # Define Question properties here if needed for detailed session response
 *     Session:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *         qrCodeUrl:
 *           type: string
 *         status:
 *           type: string
 *           enum: [waiting, active, completed, error]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         playerCount:
 *           type: integer
 *         players:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Player'
 *         currentQuestion:
 *           # Could be an object or integer index depending on your data structure
 *           type: object # or integer
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Question' # If you define Question schema
 *         settings:
 *           $ref: '#/components/schemas/SessionSettings'
 *     SessionSummary:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *         status:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         playerCount:
 *           type: integer
 *         qrCodeUrl:
 *           type: string
 */
