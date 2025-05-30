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
 * @route   POST /api/leaderboard
 * @desc    Submit a new score to the leaderboard
 * @access  Public
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
 * @route   GET /api/leaderboard/top/:n
 * @desc    Get top N scores from the leaderboard
 * @access  Public
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
 * @route   GET /api/leaderboard/recent
 * @desc    Get recent scores with pagination
 * @access  Public
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
 * @route   GET /api/leaderboard/session/:id
 * @desc    Get scores for a specific session
 * @access  Public
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
 * @route   GET /api/leaderboard/stats
 * @desc    Get leaderboard statistics
 * @access  Public
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
