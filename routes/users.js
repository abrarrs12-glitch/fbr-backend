// ============================================================
//  routes/users.js
//  Admin users manage kare — client accounts banaye
// ============================================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { adminOnly } = require('../middleware/auth');

// ── GET all users (Admin only) ────────────────────────────────
router.get('/', adminOnly, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('-password')
      .populate('customerId', 'businessName ntn')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE new user (Admin only) ─────────────────────────────
// POST /api/users
// Body: { name, email, password, role, customerId }
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, customerId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Naam, email aur password zaroori hain' });
    }

    // Check duplicate email
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: 'Yeh email already registered hai' });
    }

    const user = new User({
      name,
      email,
      password,
      role:       role || 'client',
      customerId: customerId || null,
    });

    await user.save();

    res.status(201).json({
      message: 'User ban gaya!',
      user: {
        id:         user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        customerId: user.customerId,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── UPDATE user (Admin only) ──────────────────────────────────
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, customerId, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User nahi mila' });

    if (name)       user.name       = name;
    if (email)      user.email      = email;
    if (role)       user.role       = role;
    if (customerId) user.customerId = customerId;
    if (isActive !== undefined) user.isActive = isActive;

    // Password sirf tab update karo jab diya ho
    if (password && password.trim() !== '') {
      user.password = password; // pre-save hook encrypt kar dega
    }

    await user.save();

    res.json({
      message: 'User update ho gaya',
      user: {
        id:         user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        customerId: user.customerId,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE user (Admin only) ──────────────────────────────────
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User remove ho gaya' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
