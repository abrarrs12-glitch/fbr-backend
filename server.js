// ============================================================
//  server.js — Updated with Users route
// ============================================================

const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const dotenv  = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));      // NEW
app.use('/api/customers', require('./routes/customers'));
app.use('/api/invoices',  require('./routes/invoices'));
app.use('/api/fbr',       require('./routes/fbr'));

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'FBR Invoice Server running ✓' });
});

// ── Connect MongoDB then start ────────────────────────────────
const PORT     = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fbr_invoices';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✓ MongoDB connected');
    app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
