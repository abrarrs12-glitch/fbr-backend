// ============================================================
//  routes/customers.js
//  Add, list, update, delete your client businesses
//  All routes require the admin to be logged in (authMiddleware)
// ============================================================

const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const auth = require('../middleware/auth');

// ── GET all customers ─────────────────────────────────────────
// GET /api/customers
router.get('/', auth, async (req, res) => {
  try {
    const customers = await Customer.find({ isActive: true }).sort({ businessName: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET a single customer ─────────────────────────────────────
// GET /api/customers/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE a new customer ─────────────────────────────────────
// POST /api/customers
// Body: { businessName, ntn, strn, address, contactEmail, contactPhone, fbrCredentials }
router.post('/', auth, async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json({ message: 'Customer created', customer });
  } catch (err) {
    // Handle duplicate NTN
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A customer with this NTN already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ── UPDATE a customer ─────────────────────────────────────────
// PUT /api/customers/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer updated', customer });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE (soft delete) a customer ──────────────────────────
// DELETE /api/customers/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Customer removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
