/**
 * Leaderboard Routes
 * 
 * Handles score submission and retrieval for the Taps Tokens Trivia
 * leaderboard system. Includes duplicate prevention and data validation.
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { Leaderboard } = require('../models/leaderboard');

/**
 * @swagger
 * tags:
 *   name: Leaderboard
 *   description: API for managing game leaderboards
 */

// Validation schemas
const submitScoreSchema = Joi.object({
  alias: Joi.string().trim().min(2).max(20).required()
    .pattern(/^[a-zA-Z0-9_\- ]+$/)
    .messages({
      'string.pattern.base': 'Alias can only contain letters, numbers, spaces, underscores, and hyphens',
      'string.min': 'Alias must be at least 2 characters long',
      'string.max': 'Alias cannot exceed 20 characters',
      'any.required': 'Alias is required'
    }),
  phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).allow('').optional()
    .messages({
      'string.pattern.base': 'Phone number must be a valid format (10-15 digits, optional + prefix)'
    }),
  score: Joi.number().integer().min(0).max(100000).required()
    .messages({
      'number.base': 'Score must be a number',
      'number.integer': 'Score must be an integer',
      'number.min': 'Score cannot be negative',
      'number.max': 'Score exceeds maximum allowed value',
      'any.required': 'Score is required'
    }),
  sessionId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Session ID must be a valid UUID',
      'any.required': 'Session ID is required'
    }),
  gameDate: Joi.date().default(Date.now),
  metadata: Joi.object({
    questionCount: Joi.number().integer().min(1).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard', 'mixed').optional(),
    categories: Joi.array().items(Joi.string()).optional(),
    timeSpent: Joi.number().min(0).optional(),
    device: Joi.string().optional()
  }).optional()
});

const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10),
  page: Joi.number().integer().min(1).default(1)
});

/**
 * @swagger
 * /leaderboard:
 *   post:
 *     summary: Submit a new score to the leaderboard
 *     tags: [Leaderboard]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScoreSubmission'
 *     responses:
 *       201:
 *         description: Score submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScoreResponse'
 *       400:
 *         description: Invalid request body
 *       409:
 *         description: Duplicate submission with higher or equal score
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = submitScoreSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details[0].message
      });
    }
    
    // Check for duplicate submission (same alias within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existingEntry = await Leaderboard.findOne({
      alias: value.alias,
      createdAt: { $gte: oneHourAgo }
    });
    
    if (existingEntry) {
      // If duplicate has lower score, update it instead of creating new
      if (existingEntry.score < value.score) {
        existingEntry.score = value.score;
        existingEntry.updatedAt = new Date();
        if (value.metadata) existingEntry.metadata = value.metadata;
        
        await existingEntry.save();
        
        return res.json({
          status: 'success',
          message: 'Score updated successfully',
          data: {
            id: existingEntry._id,
            alias: existingEntry.alias,
            score: existingEntry.score,
            rank: await calculateRank(existingEntry.score)
          }
        });
      }
      
      // If duplicate has higher or equal score, reject new submission
      return res.status(409).json({
        status: 'success', // Still 200 to not confuse clients
        message: 'A higher or equal score was already submitted with this alias',
        data: {
          id: existingEntry._id,
          alias: existingEntry.alias,
          score: existingEntry.score,
          rank: await calculateRank(existingEntry.score)
        }
      });
    }
    
    // Create new leaderboard entry
    const newEntry = new Leaderboard({
      alias: value.alias,
      phone: value.phone || null,
      score: value.score,
      sessionId: value.sessionId,
      gameDate: value.gameDate || new Date(),
      metadata: value.metadata || {},
      createdAt: new Date()
    });
    
    await newEntry.save();
    
    // Calculate rank for this score
    const rank = await calculateRank(value.score);
    
    res.status(201).json({
      status: 'success',
      message: 'Score submitted successfully',
      data: {
        id: newEntry._id,
        alias: newEntry.alias,
        score: newEntry.score,
        rank
      }
    });
  } catch (err) {
    req.logger.error('Error submitting score:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit score'
    });
  }
});

/**
 * @swagger
 * /leaderboard/top/{n}:
 *   get:
 *     summary: Get top N scores from the leaderboard
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: path
 *         name: n
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         required: true
 *         description: Number of top scores to retrieve
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year, all-time]
 *         description: Time period for the leaderboard (e.g., day, week)
 *     responses:
 *       200:
 *         description: Top N scores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                 scores:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaderboardEntry'
 *       400:
 *         description: Invalid parameter n
 *       500:
 *         description: Server error
 */
router.get('/top/:n', async (req, res) => {
  try {
    // Validate and parse limit parameter
    const limit = parseInt(req.params.n, 10);
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'Parameter n must be a number between 1 and 100'
      });
    }
    
    // Optional time range filtering
    const timeFilter = {};
    
    if (req.query.period) {
      const now = new Date();
      
      switch (req.query.period) {
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
        // Default: all-time, no filter
      }
    }
    
    // Get top scores
    const topScores = await Leaderboard.find(timeFilter)
      .sort({ score: -1, createdAt: 1 }) // Highest score first, then earliest date
      .limit(limit)
      .select('alias score gameDate createdAt metadata -_id')
      .lean();
    
    // Format the response
    const formattedScores = topScores.map((entry, index) => ({
      rank: index + 1,
      alias: entry.alias,
      score: entry.score,
      date: entry.gameDate || entry.createdAt,
      metadata: entry.metadata
    }));
    
    res.json({
      status: 'success',
      data: {
        period: req.query.period || 'all-time',
        scores: formattedScores
      }
    });
  } catch (err) {
    req.logger.error('Error retrieving top scores:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve top scores'
    });
  }
});

/**
 * @swagger
 * /leaderboard/recent:
 *   get:
 *     summary: Get recent scores with pagination
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of scores per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Recent scores with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 scores:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaderboardEntry'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Invalid pagination parameters
 *       500:
 *         description: Server error
 */
router.get('/recent', async (req, res) => {
  try {
    // Validate pagination parameters
    const { error, value } = paginationSchema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details[0].message
      });
    }
    
    const { limit, page } = value;
    const skip = (page - 1) * limit;
    
    // Get recent scores
    const recentScores = await Leaderboard.find()
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .select('alias score gameDate createdAt metadata -_id')
      .lean();
    
    // Get total count for pagination
    const totalCount = await Leaderboard.countDocuments();
    
    // Format the response
    const formattedScores = await Promise.all(recentScores.map(async (entry) => ({
      alias: entry.alias,
      score: entry.score,
      date: entry.gameDate || entry.createdAt,
      rank: await calculateRank(entry.score),
      metadata: entry.metadata
    })));
    
    res.json({
      status: 'success',
      data: {
        scores: formattedScores,
        pagination: {
          page,
          limit,
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (err) {
    req.logger.error('Error retrieving recent scores:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve recent scores'
    });
  }
});

/**
 * @swagger
 * /leaderboard/session/{id}:
 *   get:
 *     summary: Get scores for a specific session
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Scores for the session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 playerCount:
 *                   type: integer
 *                 scores:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaderboardEntry'
 *       500:
 *         description: Server error
 */
router.get('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get scores for this session
    const sessionScores = await Leaderboard.find({ sessionId: id })
      .sort({ score: -1, createdAt: 1 })
      .select('alias score gameDate createdAt metadata -_id')
      .lean();
    
    // Format the response
    const formattedScores = sessionScores.map((entry, index) => ({
      rank: index + 1,
      alias: entry.alias,
      score: entry.score,
      date: entry.gameDate || entry.createdAt,
      metadata: entry.metadata
    }));
    
    res.json({
      status: 'success',
      data: {
        sessionId: id,
        playerCount: sessionScores.length,
        scores: formattedScores
      }
    });
  } catch (err) {
    req.logger.error(`Error retrieving scores for session ${req.params.id}:`, err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve session scores'
    });
  }
});

/**
 * @swagger
 * /leaderboard/stats:
 *   get:
 *     summary: Get leaderboard statistics
 *     tags: [Leaderboard]
 *     responses:
 *       200:
 *         description: Leaderboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeaderboardStats'
 *       500:
 *         description: Server error
 */
router.get('/stats', async (req, res) => {
  try {
    // Get various statistics
    const totalEntries = await Leaderboard.countDocuments();
    const topScore = await Leaderboard.findOne().sort({ score: -1 }).select('score alias -_id');
    const averageScore = await Leaderboard.aggregate([
      { $group: { _id: null, avg: { $avg: '$score' } } }
    ]);
    
    // Get scores by time period
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyCount = await Leaderboard.countDocuments({ createdAt: { $gte: dayAgo } });
    const weeklyCount = await Leaderboard.countDocuments({ createdAt: { $gte: weekAgo } });
    const monthlyCount = await Leaderboard.countDocuments({ createdAt: { $gte: monthAgo } });
    
    res.json({
      status: 'success',
      data: {
        totalEntries,
        topScore: topScore ? {
          score: topScore.score,
          alias: topScore.alias
        } : null,
        averageScore: averageScore.length > 0 ? Math.round(averageScore[0].avg) : 0,
        activity: {
          daily: dailyCount,
          weekly: weeklyCount,
          monthly: monthlyCount
        }
      }
    });
  } catch (err) {
    req.logger.error('Error retrieving leaderboard stats:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve leaderboard statistics'
    });
  }
});

/**
 * Calculate the rank for a given score
 * @param {number} score - The score to calculate rank for
 * @returns {Promise<number>} - The rank (1-based)
 */
async function calculateRank(score) {
  try {
    // Count how many scores are higher than this one
    const higherScores = await Leaderboard.countDocuments({ score: { $gt: score } });
    
    // Rank is higher scores + 1 (1-based ranking)
    return higherScores + 1;
  } catch (err) {
    console.error('Error calculating rank:', err);
    return null;
  }
}

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     ScoreSubmission:
 *       type: object
 *       required:
 *         - alias
 *         - score
 *         - sessionId
 *       properties:
 *         alias:
 *           type: string
 *           minLength: 2
 *           maxLength: 20
 *           pattern: "^[a-zA-Z0-9_\\- ]+$"
 *         phone:
 *           type: string
 *           pattern: "^\\+?[0-9]{10,15}$"
 *         score:
 *           type: integer
 *           minimum: 0
 *           maximum: 100000
 *         sessionId:
 *           type: string
 *           format: uuid
 *         gameDate:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *           properties:
 *             questionCount:
 *               type: integer
 *             difficulty:
 *               type: string
 *               enum: [easy, medium, hard, mixed]
 *             categories:
 *               type: array
 *               items:
 *                 type: string
 *             timeSpent:
 *               type: number
 *             device:
 *               type: string
 *     ScoreResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         alias:
 *           type: string
 *         score:
 *           type: integer
 *         rank:
 *           type: integer
 *     LeaderboardEntry:
 *       type: object
 *       properties:
 *         rank:
 *           type: integer
 *         alias:
 *           type: string
 *         score:
 *           type: integer
 *         date:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         totalItems:
 *           type: integer
 *         totalPages:
 *           type: integer
 *         hasNextPage:
 *           type: boolean
 *         hasPrevPage:
 *           type: boolean
 *     LeaderboardStats:
 *       type: object
 *       properties:
 *         totalEntries:
 *           type: integer
 *         topScore:
 *           type: object
 *           properties:
 *             score:
 *               type: integer
 *             alias:
 *               type: string
 *         averageScore:
 *           type: integer
 *         activity:
 *           type: object
 *           properties:
 *             daily:
 *               type: integer
 *             weekly:
 *               type: integer
 *             monthly:
 *               type: integer
 */
