// ============================================================
//  models/Customer.js — UPDATED
//  POSID/username/password ki jagah sirf Security Token
// ============================================================

const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    ntn:          { type: String, required: true, unique: true },
    strn:         { type: String, default: '' },
    province:     { type: String, default: '' },
    address:      { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },

    // FBR Digital Invoicing — sirf token chahiye!
    fbrCredentials: {
      token: { type: String, default: '' },   // Security Token (5 saal valid)
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', CustomerSchema);
