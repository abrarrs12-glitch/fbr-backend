// ============================================================
//  routes/fbr.js
//  Routes for submitting invoices to FBR portal
//  POST /api/fbr/sync/:customerId   — sync all pending invoices
//  POST /api/fbr/submit/:invoiceId  — submit a single invoice
// ============================================================

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const { submitInvoice, submitBatch } = require('../services/fbrApi');
const auth = require('../middleware/auth');

// ── Sync ALL pending invoices for a customer ──────────────────
// POST /api/fbr/sync/:customerId
router.post('/sync/:customerId', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Find all pending invoices for this customer
    const pendingInvoices = await Invoice.find({
      customerId: req.params.customerId,
      status: 'pending',
    });

    if (pendingInvoices.length === 0) {
      return res.json({ message: 'No pending invoices to sync', results: [] });
    }

    // Submit to FBR one by one
    const results = await submitBatch(pendingInvoices, customer);

    // Update each invoice's status based on FBR response
    const updatePromises = results.map(async (result) => {
      const updateData = result.success
        ? {
            status:      'submitted',
            irn:         result.irn,
            fbrResponse: result.fbrResponse,
            submittedAt: new Date(),
          }
        : {
            status:        'rejected',
            fbrResponse:   result.fbrResponse,
            rejectionNote: result.error,
          };

      return Invoice.findByIdAndUpdate(result.invoiceId, updateData);
    });

    await Promise.all(updatePromises);

    const succeeded = results.filter(r => r.success).length;
    const failed    = results.filter(r => !r.success).length;

    res.json({
      message: `Sync complete: ${succeeded} submitted, ${failed} failed`,
      total:     results.length,
      succeeded,
      failed,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Submit a single invoice to FBR ───────────────────────────
// POST /api/fbr/submit/:invoiceId
router.post('/submit/:invoiceId', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId).populate('customerId');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (invoice.status === 'accepted') {
      return res.status(400).json({ error: 'Invoice already accepted by FBR' });
    }

    const customer = invoice.customerId;
    const result = await submitInvoice(invoice, customer);

    // Update invoice status
    const updateData = result.success
      ? { status: 'submitted', irn: result.irn, fbrResponse: result.fbrResponse, submittedAt: new Date() }
      : { status: 'rejected', fbrResponse: result.fbrResponse, rejectionNote: result.error };

    const updated = await Invoice.findByIdAndUpdate(invoice._id, updateData, { new: true });

    res.json({
      message: result.success ? 'Invoice submitted to FBR' : 'FBR rejected the invoice',
      invoice: updated,
      fbrResponse: result.fbrResponse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Check status of a submitted invoice on FBR ───────────────
// GET /api/fbr/status/:invoiceId
// (FBR async verification — sometimes takes minutes)
router.get('/status/:invoiceId', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId).populate('customerId');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.irn)  return res.status(400).json({ error: 'Invoice not submitted yet — no IRN' });

    // TODO: Query FBR API with the IRN to check verification status
    // const fbrStatus = await checkFbrStatus(invoice.irn, invoice.customerId.fbrCredentials);

    // For now, return what we have stored
    res.json({
      invoiceNumber: invoice.invoiceNumber,
      status:        invoice.status,
      irn:           invoice.irn,
      submittedAt:   invoice.submittedAt,
      fbrResponse:   invoice.fbrResponse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
