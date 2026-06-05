// ============================================================
//  routes/auth.js
//  Admin login endpoint. Returns a JWT token on success.
//  POST /api/auth/login  { email, password }
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simple single-admin login (stored in .env)
// For multiple admin users, store them in a database instead
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Check against environment variables
  if (
    email    !== process.env.ADMIN_EMAIL ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Create a token that expires in 8 hours
  const token = jwt.sign(
    { email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    message: 'Login successful',
    token,
    expiresIn: '8h',
  });
});

// Check if token is still valid
router.get('/verify', require('../middleware/auth'), (req, res) => {
  res.json({ valid: true, admin: req.admin });
});

module.exports = router;
