// ============================================================
//  models/User.js
//  Har user ka account — Admin ya Client
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    
    // Admin = sab dekhe, Client = sirf apna data
    role: {
      type: String,
      enum: ['admin', 'client'],
      default: 'client',
    },

    // Agar role = client hai toh yeh customer linked hoga
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Password save karne se pehle encrypt karo
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Password check karne ka function
UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);
