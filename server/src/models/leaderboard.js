/**
 * Leaderboard Model
 * 
 * Defines the schema for leaderboard entries in the Taps Tokens Trivia application.
 * Stores player scores, contact information, and game metadata for ranking and rewards.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LeaderboardSchema = new Schema({
  // Player information
  alias: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 20,
    match: /^[a-zA-Z0-9_\- ]+$/
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return v === '' || /^\+?[0-9]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    },
    default: null
  },
  
  // Game results
  score: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  gameDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Game metadata
  metadata: {
    questionCount: {
      type: Number,
      min: 1
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'mixed']
    },
    categories: [String],
    timeSpent: {
      type: Number,
      min: 0
    },
    correctAnswers: {
      type: Number,
      min: 0
    },
    totalQuestions: {
      type: Number,
      min: 0
    },
    device: String,
    location: String
  },
  
  // Reward tracking
  rewardClaimed: {
    type: Boolean,
    default: false
  },
  rewardClaimedAt: Date,
  rewardType: String,
  
  // System fields
  verified: {
    type: Boolean,
    default: false
  },
  ipAddress: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating accuracy percentage
LeaderboardSchema.virtual('accuracy').get(function() {
  if (!this.metadata || !this.metadata.correctAnswers || !this.metadata.totalQuestions) {
    return null;
  }
  
  if (this.metadata.totalQuestions === 0) {
    return 0;
  }
  
  return Math.round((this.metadata.correctAnswers / this.metadata.totalQuestions) * 100);
});

// Indexes for efficient querying
LeaderboardSchema.index({ score: -1, createdAt: 1 }); // For top scores
LeaderboardSchema.index({ createdAt: -1 }); // For recent scores
LeaderboardSchema.index({ sessionId: 1, score: -1 }); // For session leaderboards
LeaderboardSchema.index({ 'metadata.difficulty': 1, score: -1 }); // For difficulty-based leaderboards
LeaderboardSchema.index({ alias: 1, createdAt: -1 }); // For player history

// Static method to get top scores
LeaderboardSchema.statics.getTopScores = function(limit = 10, period = null) {
  const query = {};
  
  if (period) {
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
    }
    
    if (startDate) {
      query.createdAt = { $gte: startDate };
    }
  }
  
  return this.find(query)
    .sort({ score: -1, createdAt: 1 })
    .limit(limit)
    .select('alias score gameDate createdAt metadata');
};

// Static method to get scores by session
LeaderboardSchema.statics.getSessionScores = function(sessionId) {
  return this.find({ sessionId })
    .sort({ score: -1, createdAt: 1 })
    .select('alias score gameDate createdAt metadata');
};

// Static method to get player history
LeaderboardSchema.statics.getPlayerHistory = function(alias, limit = 10) {
  return this.find({ alias })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('score gameDate sessionId metadata');
};

// Static method to calculate rank for a score
LeaderboardSchema.statics.calculateRank = async function(score) {
  const higherScores = await this.countDocuments({ score: { $gt: score } });
  return higherScores + 1;
};

// Create the model
const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);

module.exports = { Leaderboard, LeaderboardSchema };
