// ============================================================
//  middleware/auth.js
//  Protects routes — only requests with a valid login token
//  are allowed through. Add this to any route you want to
//  protect: router.get('/path', authMiddleware, handler)
// ============================================================

const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  // Token comes in the request header: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // Attach admin info to the request
    next();              // Continue to the actual route handler
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};
