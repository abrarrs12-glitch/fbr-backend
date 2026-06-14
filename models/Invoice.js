// ============================================================
//  models/Invoice.js — UPDATED with FBR JSON fields
// ============================================================

const mongoose = require('mongoose');

// Item schema — har invoice mein multiple items ho sakte hain
const ItemSchema = new mongoose.Schema({
  hsCode:                          { type: String, default: '' },
  productDescription:              { type: String, default: '' },
  rate:                            { type: String, default: '0%' },
  uoM:                             { type: String, default: '' },
  quantity:                        { type: Number, default: 0 },
  totalValues:                     { type: Number, default: 0 },
  valueSalesExcludingST:           { type: Number, default: 0 },
  fixedNotifiedValueOrRetailPrice: { type: Number, default: 0 },
  salesTaxApplicable:              { type: Number, default: 0 },
  salesTaxWithheldAtSource:        { type: Number, default: 0 },
  extraTax:                        { type: String, default: '' },
  furtherTax:                      { type: Number, default: 0 },
  sroScheduleNo:                   { type: String, default: '' },
  fedPayable:                      { type: Number, default: 0 },
  discount:                        { type: Number, default: 0 },
  saleType:                        { type: String, default: '' },
  sroItemSerialNo:                 { type: String, default: '' },
}, { _id: false });

const InvoiceSchema = new mongoose.Schema(
  {
    // Customer link
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Customer',
      required: true,
    },

    // Invoice tracking
    invoiceNumber: { type: String, required: true },
    invoiceDate:   { type: String, required: true },
    invoiceType:   { type: String, default: 'Sale Invoice' },
    invoiceRefNo:  { type: String, default: '' },
    scenarioId:    { type: String, default: 'SN000' },

    // Seller info
    sellerNTNCNIC:       { type: String, default: '' },
    sellerBusinessName:  { type: String, default: '' },
    sellerProvince:      { type: String, default: '' },
    sellerAddress:       { type: String, default: '' },

    // Buyer info
    buyerNTNCNIC:            { type: String, default: '' },
    buyerBusinessName:       { type: String, default: '' },
    buyerProvince:           { type: String, default: '' },
    buyerAddress:            { type: String, default: '' },
    buyerRegistrationType:   { type: String, default: 'Un-Registered' },

    // Items
    items: [ItemSchema],

    // Totals — easy access ke liye
    totalAmount: { type: Number, default: 0 },
    taxAmount:   { type: Number, default: 0 },
    saleValue:   { type: Number, default: 0 },

    // FBR Status tracking
    status: {
      type: String,
      enum: ['pending', 'submitted', 'accepted', 'rejected'],
      default: 'pending',
    },
    irn:           { type: String, default: '' },
    fbrResponse:   { type: Object },
    submittedAt:   { type: Date },
    rejectionNote: { type: String, default: '' },

    // Source file
    sourceFile: { type: String, default: '' },
  },
  { timestamps: true }
);

// Duplicate invoice prevent karo
InvoiceSchema.index({ customerId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
