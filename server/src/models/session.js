/**
 * Session Model
 * 
 * Defines the schema for game sessions in the Taps Tokens Trivia application.
 * Tracks session state, connected players, and game progress.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Player sub-schema for participants in a session
const PlayerSchema = new Schema({
  playerId: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 20
  },
  socketId: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0,
    min: 0
  },
  answers: [{
    questionIndex: Number,
    choiceIndex: Number,
    correct: Boolean,
    timeToAnswer: Number, // in milliseconds
    points: Number
  }],
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  device: {
    type: String,
    trim: true
  },
  isConnected: {
    type: Boolean,
    default: true
  }
});

// Main session schema
const SessionSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'paused', 'completed'],
    default: 'waiting'
  },
  players: [PlayerSchema],
  currentQuestion: {
    type: Number,
    default: 0,
    min: 0
  },
  questions: [{
    index: Number,
    questionId: String,
    category: String,
    difficulty: String,
    text: String,
    choices: [String],
    correctAnswerIndex: Number,
    timeLimit: Number,
    points: Number,
    askedAt: Date
  }],
  settings: {
    maxPlayers: {
      type: Number,
      default: 4,
      min: 1,
      max: 10
    },
    questionCount: {
      type: Number,
      default: 10,
      min: 1,
      max: 30
    },
    categories: [String],
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'mixed'],
      default: 'mixed'
    },
    timeLimit: {
      type: Number,
      default: 30,
      min: 10,
      max: 60
    },
    pointsPerQuestion: {
      type: Number,
      default: 100,
      min: 10
    },
    bonusTimePoints: {
      type: Boolean,
      default: true
    }
  },
  qrCodeUrl: {
    type: String,
    trim: true
  },
  driverId: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  startedAt: Date,
  endedAt: Date,
  lastActivity: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  timestamps: true,
  // Add virtual properties when converting to JSON/objects
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating session duration
SessionSchema.virtual('duration').get(function() {
  if (!this.startedAt) return 0;
  const end = this.endedAt || new Date();
  return (end - this.startedAt) / 1000; // in seconds
});

// Virtual for calculating player count
SessionSchema.virtual('playerCount').get(function() {
  return this.players.length;
});

// Virtual for calculating active player count
SessionSchema.virtual('activePlayerCount').get(function() {
  return this.players.filter(player => player.isConnected).length;
});

// Create indexes for efficient queries
SessionSchema.index({ 'createdAt': 1 });
SessionSchema.index({ 'status': 1, 'createdAt': -1 });
SessionSchema.index({ 'driverId': 1, 'status': 1 });

// Pre-save hook to update lastActivity
SessionSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Static method to find active sessions
SessionSchema.statics.findActiveSessions = function() {
  return this.find({
    status: { $in: ['waiting', 'active', 'paused'] }
  }).sort({ createdAt: -1 });
};

// Static method to find sessions by driver
SessionSchema.statics.findByDriver = function(driverId) {
  return this.find({ driverId }).sort({ createdAt: -1 });
};

// Static method to find expired sessions (inactive for more than 24 hours)
SessionSchema.statics.findExpiredSessions = function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.find({
    status: { $ne: 'completed' },
    lastActivity: { $lt: oneDayAgo }
  });
};

// Create the model
const Session = mongoose.model('Session', SessionSchema);

module.exports = { Session, SessionSchema };
