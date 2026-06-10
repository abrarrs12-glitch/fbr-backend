// ============================================================
//  routes/auth.js
//  Login system — Admin aur Client dono ke liye
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

// ── Login ─────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Pehle database mein user dhundo
    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      return res.status(401).json({ error: 'Email ya password galat hai' });
    }

    // Password check karo
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ya password galat hai' });
    }

    // Token banao
    const token = jwt.sign(
      {
        id:         user._id,
        email:      user.email,
        role:       user.role,
        customerId: user.customerId,
        name:       user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id:         user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        customerId: user.customerId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Verify token ──────────────────────────────────────────────
router.get('/verify', require('../middleware/auth'), (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
