// ============================================================
//  routes/invoices.js
//  - Upload Excel file → parse → save invoices to DB
//  - List, filter, delete invoices per customer
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const { parseExcelFile } = require('../services/excelParser');
const auth = require('../middleware/auth');

// multer stores the uploaded file in memory (as a Buffer)
// For large files, use disk storage instead
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

// ── GET invoices for a customer ───────────────────────────────
// GET /api/invoices?customerId=xxx&status=pending&page=1
router.get('/', auth, async (req, res) => {
  try {
    const { customerId, status, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (status)     filter.status = status;

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })          // Newest first
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('customerId', 'businessName ntn strn'); // Include customer name

    const total = await Invoice.countDocuments(filter);

    res.json({ invoices, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET summary stats for a customer ─────────────────────────
// GET /api/invoices/stats/:customerId
router.get('/stats/:customerId', auth, async (req, res) => {
  try {
    const { customerId } = req.params;

    const stats = await Invoice.aggregate([
      { $match: { customerId: require('mongoose').Types.ObjectId(customerId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTax:    { $sum: '$taxAmount' },
        },
      },
    ]);

    // Convert array to an object keyed by status
    const result = { pending: 0, submitted: 0, accepted: 0, rejected: 0 };
    stats.forEach(s => { result[s._id] = s.count; });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPLOAD Excel file ─────────────────────────────────────────
// POST /api/invoices/upload
// Form data: file (Excel), customerId
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    // Verify the customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Parse the Excel file
    const { invoices, errors, total } = parseExcelFile(
      req.file.buffer,
      req.file.originalname
    );

    if (invoices.length === 0) {
      return res.status(400).json({
        error: 'No valid invoices found in the file',
        parseErrors: errors,
      });
    }

    // Add customerId to each invoice and save to DB
    // insertMany with ordered:false continues even if some duplicates fail
    const toSave = invoices.map(inv => ({ ...inv, customerId }));
    const result = await Invoice.insertMany(toSave, { ordered: false }).catch(err => {
      // Extract successfully inserted docs even when some fail (duplicate invoice numbers)
      if (err.writeErrors) {
        return { insertedDocs: err.insertedDocs || [], writeErrors: err.writeErrors };
      }
      throw err;
    });

    const inserted = Array.isArray(result) ? result.length : (result.insertedDocs?.length || 0);
    const duplicates = total - inserted - errors.length;

    res.json({
      message: `Import complete`,
      total,
      inserted,
      duplicates,
      parseErrors: errors.length,
      errors: errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE an invoice ─────────────────────────────────────────
// DELETE /api/invoices/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'accepted') {
      return res.status(400).json({ error: 'Cannot delete an accepted invoice' });
    }
    await invoice.deleteOne();
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
