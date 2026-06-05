// ============================================================
//  models/Customer.js
//  Each "Customer" is one of your clients (a business you
//  manage invoices for). Their FBR credentials are stored here.
// ============================================================

const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    // Basic business info
    businessName: { type: String, required: true },
    ntn:          { type: String, required: true, unique: true }, // National Tax Number
    strn:         { type: String },                               // Sales Tax Registration No
    address:      { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },

    // FBR credentials — each customer has their own login
    fbrCredentials: {
      username: { type: String },
      password: { type: String },  // TODO: encrypt this in production
      posId:    { type: String },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt
);

module.exports = mongoose.model('Customer', CustomerSchema);
