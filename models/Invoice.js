// ============================================================
//  models/Invoice.js
//  Each invoice row from the Excel file becomes one document.
//  Linked to a Customer via customerId.
// ============================================================

const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    // Which customer this invoice belongs to
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },

    // ── Fields from FBR Excel format ───────────────────────
    invoiceNumber:    { type: String, required: true },
    invoiceDate:      { type: Date, required: true },
    buyerName:        { type: String },
    buyerNtn:         { type: String },
    buyerCnic:        { type: String },  // For individuals without NTN
    buyerAddress:     { type: String },

    // Amounts (all in PKR)
    saleValue:        { type: Number, default: 0 },  // Total sale value before tax
    taxAmount:        { type: Number, default: 0 },  // Sales tax amount
    furtherTax:       { type: Number, default: 0 },  // Further tax (if applicable)
    discount:         { type: Number, default: 0 },
    totalAmount:      { type: Number, default: 0 },  // Final amount with tax

    invoiceType:      { type: String, default: 'SI' }, // SI = Standard Invoice

    // ── FBR submission tracking ────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'submitted', 'accepted', 'rejected'],
      default: 'pending',
    },

    irn:           { type: String },   // Invoice Registration Number — returned by FBR
    fbrResponse:   { type: Object },   // Full response from FBR API (for debugging)
    submittedAt:   { type: Date },
    rejectionNote: { type: String },   // Reason if FBR rejected it

    // Which Excel file this came from (for traceability)
    sourceFile:    { type: String },
  },
  { timestamps: true }
);

// Prevent duplicate invoice numbers per customer
InvoiceSchema.index({ customerId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
