/**
 * Authentication middleware for admin routes
 * Verifies that requests include a valid admin token in the Authorization header
 */

/**
 * Middleware to verify admin token in Authorization header
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
export function verifyAdmin(req, res, next) {
  // Extract token from Authorization header (Bearer token format)
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Check if token exists and matches the environment variable
  if (token && token === process.env.ADMIN_TOKEN) {
    // Token is valid, proceed to the next middleware or route handler
    return next();
  }
  
  // Token is missing or invalid, return 401 Unauthorized
  return res.status(401).json({ 
    error: 'Unauthorized: Invalid admin token'
  });
}

/**
 * Socket.IO middleware to verify admin token in handshake auth
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} next - Socket.IO next middleware function
 * @returns {void}
 */
export function verifySocketAdmin(socket, next) {
  const token = socket.handshake.auth?.token;
  
  if (token && token === process.env.ADMIN_TOKEN) {
    return next();
  }
  
  return next(new Error('Unauthorized: Invalid admin token'));
}
