// ============================================================
//  middleware/auth.js
//  Token verify karo — role bhi check karo
// ============================================================

const jwt = require('jsonwebtoken');

// Basic auth — sirf token check
module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Login karein pehle' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token expire ho gaya — dobara login karein' });
  }
};

// Sirf Admin access
module.exports.adminOnly = function (req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Login karein pehle' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Sirf Admin yeh kar sakta hai' });
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token expire ho gaya' });
  }
};
