// ============================================================
//  setup.js
//  Pehli baar run karo — Admin user database mein banao
//  Command: node setup.js
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function setup() {
  try {
    console.log('MongoDB se connect ho raha hoon...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fbr_invoices');
    console.log('✓ Connected!');

    // Check karo admin already hai?
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('✓ Admin already exists:', adminExists.email);
      process.exit(0);
    }

    // Admin banao
    const admin = new User({
      name:     'Admin',
      email:    process.env.ADMIN_EMAIL    || 'admin@yourdomain.com',
      password: process.env.ADMIN_PASSWORD || 'YourStrongPassword123',
      role:     'admin',
    });

    await admin.save();
    console.log('✓ Admin ban gaya!');
    console.log('  Email:   ', admin.email);
    console.log('  Password:', process.env.ADMIN_PASSWORD || 'YourStrongPassword123');
    console.log('');
    console.log('Ab npm run dev se server start karo!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

setup();
