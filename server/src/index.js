/**
 * Taps Tokens Trivia - Server Entry Point
 * 
 * This file initializes the Express server, Socket.IO for real-time 
 * communication, connects to MongoDB, and sets up all API routes.
 */

// Environment variables
require('dotenv').config();

// Core dependencies
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// Middleware
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Utilities
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://tablet.tapstoken.com', 'https://play.tapstoken.com', 'https://admin.tapstoken.com'] 
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configure logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Add logger to request object
app.use((req, res, next) => {
  req.logger = logger;
  next();
});

// Apply middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://tablet.tapstoken.com', 'https://play.tapstoken.com', 'https://admin.tapstoken.com'] 
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true
}));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Apply rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// Import route handlers
const healthRoutes = require('./routes/health');
const sessionRoutes = require('./routes/session');
const leaderboardRoutes = require('./routes/leaderboard');

// Apply routes
app.use('/api/health', healthRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Swagger API documentation setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Taps Tokens Trivia API',
      version: '1.0.0',
      description: 'API documentation for the Taps Tokens Trivia game server.',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerSpecs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../apps/tablet/dist')));
  app.use('/play', express.static(path.join(__dirname, '../../apps/mobile/dist')));
  app.use('/admin', express.static(path.join(__dirname, '../../apps/admin/dist')));
  
  // Handle SPA routing
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../apps/tablet/dist/index.html'));
  });
  
  app.get('/play/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../apps/mobile/dist/index.html'));
  });
  
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../apps/admin/dist/index.html'));
  });
}

// Import Socket.IO handlers
const { setupGameNamespace } = require('./sockets/gameNamespace');
const { setupAdminNamespace } = require('./sockets/adminNamespace');

// Setup Socket.IO namespaces
const gameNamespace = io.of('/game');
const adminNamespace = io.of('/admin');

setupGameNamespace(gameNamespace);
setupAdminNamespace(adminNamespace);

// Track active game sessions
const activeSessions = new Map();
global.activeSessions = activeSessions;

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`${err.name}: ${err.message}`, { 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/taps-tokens-trivia';

mongoose.connect(MONGO_URI)
  .then(() => {
    logger.info('Connected to MongoDB successfully');
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

// Start the server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`
    ====================================
    🎮 Taps Tokens Trivia Server Running
    ====================================
    🌐 Environment: ${process.env.NODE_ENV || 'development'}
    🔌 Port: ${PORT}
    📊 MongoDB: ${MONGO_URI.includes('localhost') ? 'Local' : 'Remote'}
    🔗 API: http://localhost:${PORT}/api
    ====================================
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };
