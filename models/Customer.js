// ============================================================
//  models/Customer.js — UPDATED with province field
// ============================================================

const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    ntn:          { type: String, required: true, unique: true },
    strn:         { type: String, default: '' },
    province:     { type: String, default: '' },  // NEW — FBR ke liye
    address:      { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },

    fbrCredentials: {
      username: { type: String, default: '' },
      password: { type: String, default: '' },
      posId:    { type: String, default: '' },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', CustomerSchema);
