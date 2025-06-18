/**
 * Health Check Routes
 * 
 * Provides system status information including uptime, database connection,
 * active sessions, memory usage, and environment details.
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');

// Start time to calculate uptime
const startTime = Date.now();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: API for system health checks
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get system health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: Taps Tokens Trivia API
 *                 uptime:
 *                   type: object
 *                   properties:
 *                     seconds:
 *                       type: integer
 *                     formatted:
 *                       type: string
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     statusCode:
 *                       type: integer
 *                 activeSessions:
 *                   type: integer
 *                 memory:
 *                   type: object
 *                 environment:
 *                   type: object
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    // Calculate uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000); // in seconds
    
    // Format uptime in a readable format
    const uptimeFormatted = formatUptime(uptime);
    
    // Get database connection status
    const dbStatus = mongoose.connection.readyState;
    const dbStatusText = getDbStatusText(dbStatus);
    
    // Get active sessions count
    const activeSessionsCount = global.activeSessions ? global.activeSessions.size : 0;
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const formattedMemory = {
      rss: formatBytes(memoryUsage.rss),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      heapUsed: formatBytes(memoryUsage.heapUsed),
      external: formatBytes(memoryUsage.external)
    };
    
    // Get environment info
    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      env: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      service: 'Taps Tokens Trivia API',
      uptime: {
        seconds: uptime,
        formatted: uptimeFormatted
      },
      database: {
        status: dbStatusText,
        statusCode: dbStatus
      },
      activeSessions: activeSessionsCount,
      memory: formattedMemory,
      environment
    });
  } catch (err) {
    req.logger.error('Health check error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve health information',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
});

/**
 * @swagger
 * /health/db:
 *   get:
 *     summary: Get detailed database status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed database status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     statusCode:
 *                       type: integer
 *                     uri:
 *                       type: string
 *                     name:
 *                       type: string
 *                     collections:
 *                       type: integer
 *                     documents:
 *                       type: integer
 *                     dataSize:
 *                       type: string
 *                     storageSize:
 *                       type: string
 *                     indexes:
 *                       type: integer
 *                     indexSize:
 *                       type: string
 *       500:
 *         description: Server error
 */
router.get('/db', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const dbStatusText = getDbStatusText(dbStatus);
    
    // Get more detailed DB info if connected
    let dbDetails = {};
    
    if (dbStatus === 1) {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      
      dbDetails = {
        name: db.databaseName,
        collections: stats.collections,
        documents: stats.objects,
        dataSize: formatBytes(stats.dataSize),
        storageSize: formatBytes(stats.storageSize),
        indexes: stats.indexes,
        indexSize: formatBytes(stats.indexSize)
      };
    }
    
    res.json({
      status: 'success',
      database: {
        status: dbStatusText,
        statusCode: dbStatus,
        uri: sanitizeMongoUri(mongoose.connection.host),
        ...dbDetails
      }
    });
  } catch (err) {
    req.logger.error('Database health check error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve database health information',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
});

/**
 * Format uptime in days, hours, minutes, seconds
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get readable database connection status
 * @param {number} status - Mongoose connection status code
 * @returns {string} Human-readable status
 */
function getDbStatusText(status) {
  switch (status) {
    case 0: return 'Disconnected';
    case 1: return 'Connected';
    case 2: return 'Connecting';
    case 3: return 'Disconnecting';
    default: return 'Unknown';
  }
}

/**
 * Sanitize MongoDB URI for safe display
 * @param {string} uri - MongoDB connection URI
 * @returns {string} Sanitized URI with credentials removed
 */
function sanitizeMongoUri(uri) {
  if (!uri) return 'unknown';
  
  // For security, don't show credentials
  if (uri.includes('@')) {
    return uri.split('@')[1];
  }
  
  return uri;
}

module.exports = router;
