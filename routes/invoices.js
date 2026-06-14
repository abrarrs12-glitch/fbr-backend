// ============================================================
//  routes/invoices.js — UPDATED
// ============================================================

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const mongoose = require('mongoose');
const Invoice  = require('../models/Invoice');
const Customer = require('../models/Customer');
const { parseExcelFile } = require('../services/excelParser');
const auth     = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Sirf Excel files (.xlsx, .xls) allowed hain'));
  },
});

// ── GET invoices ──────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { customerId, status, page = 1, limit = 100 } = req.query;

    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (status)     filter.status     = status;

    // Client sirf apna data dekhe
    if (req.user.role === 'client' && req.user.customerId) {
      filter.customerId = req.user.customerId;
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('customerId', 'businessName ntn strn province');

    const total = await Invoice.countDocuments(filter);

    res.json({ invoices, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET stats ─────────────────────────────────────────────────
router.get('/stats/:customerId', auth, async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      { $match: { customerId: new mongoose.Types.ObjectId(req.params.customerId) } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } },
    ]);

    const result = { pending: 0, submitted: 0, accepted: 0, rejected: 0 };
    stats.forEach(s => { result[s._id] = s.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPLOAD Excel ──────────────────────────────────────────────
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) return res.status(400).json({ error: 'customerId zaroori hai' });
    if (!req.file)   return res.status(400).json({ error: 'Excel file upload karo' });

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer nahi mila' });

    // Excel parse karo — customer ka data seller ke tor pe
    const { invoices, errors, total } = parseExcelFile(
      req.file.buffer,
      {
        ntn:          customer.ntn,
        businessName: customer.businessName,
        province:     customer.province || '',
        address:      customer.address  || '',
      }
    );

    if (invoices.length === 0) {
      return res.status(400).json({
        error: 'Koi valid invoice nahi mili file mein',
        parseErrors: errors,
      });
    }

    // Database mein save karo
    const toSave = invoices.map(inv => ({ ...inv, customerId, sourceFile: req.file.originalname }));

    let inserted = 0;
    let duplicates = 0;

    for (const inv of toSave) {
      try {
        await Invoice.create(inv);
        inserted++;
      } catch (err) {
        if (err.code === 11000) duplicates++;
        else errors.push({ error: err.message });
      }
    }

    res.json({
      message:     `Import complete`,
      total,
      inserted,
      duplicates,
      parseErrors: errors.length,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE invoice ────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice nahi mili' });
    if (invoice.status === 'accepted') return res.status(400).json({ error: 'Accepted invoice delete nahi ho sakti' });
    await invoice.deleteOne();
    res.json({ message: 'Invoice delete ho gayi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
