const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const constants = require('../../utils/constants');

// User Schema with production security features
const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters'],
    validate: {
      validator: function (v) {
        return /^[a-zA-Z\s]+$/.test(v);
      },
      message: 'First name can only contain letters and spaces'
    }
  },
  lastName: {
    type: String,
    // required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters'],
    validate: {
      validator: function (v) {
        return /^[a-zA-Z\s]+$/.test(v);
      },
      message: 'Last name can only contain letters and spaces'
    }
  },
  // Keep legacy name field for backward compatibility
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    },
    index: true // Index for faster queries
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },

  // Contact Information
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return !v || /^\+?[\d\s\-\(\)]+$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },

  // Address Information
  address: {
    street: { type: String, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 50 },
    state: { type: String, trim: true, maxlength: 50 },
    zipCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 50, default: 'USA' }
  },

  // User Status and Role
  role: {
    type: String,
    enum: ['customer', 'admin', 'co-admin', 'moderator'],
    default: 'customer',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },

  // Referral program
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  referralDiscountEligible: {
    type: Boolean,
    default: false,
  },

  // Security Features
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    deviceInfo: String
  }],

  // Login Security
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    success: Boolean
  }],

  // Stripe Integration
  stripeCustomerId: {
    type: String,
  },
  paymentMethods: [{
    stripePaymentMethodId: String,
    type: String, // 'card', 'bank_account'
    last4: String,
    brand: String,
    isDefault: Boolean,
    createdAt: { type: Date, default: Date.now }
  }],

  // Shopping Preferences
  preferences: {
    newsletter: { type: Boolean, default: false },
    smsNotifications: { type: Boolean, default: false },
    currency: { type: String, default: 'USD' },
    language: { type: String, default: 'en' },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' }
  },

  // Performance Optimization
  lastActivity: { type: Date, default: Date.now },
  sessionCount: { type: Number, default: 0 }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: {
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

// Compound Indexes for Performance (100k+ users)
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });

userSchema.virtual('fullName').get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.name;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

function generateReferralCode(length = constants.REFERRAL_CODE_LENGTH) {
  // Example: 4 letters + 4 digits (uppercase)
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    if (i < 4) code += letters.charAt(Math.floor(Math.random() * letters.length));
    else code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

// Pre-save middleware for password hashing
userSchema.pre('save', async function (next) {
  // Auto-populate name field for backward compatibility
  if (!this.name && this.firstName && this.lastName) {
    this.name = `${this.firstName} ${this.lastName}`;
  }

  // Ensure every user has a stable referral code
  if (!this.referralCode) {
    let code;
    do {
      code = generateReferralCode();
    } while (await this.constructor.findOne({ referralCode: code }).lean());
    this.referralCode = code;
  }

  // Only hash password if it's modified
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12 for production security
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function () {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET_KEY || 'fallback-secret-key',
    {
      issuer: 'rbs-grocery-app',
      audience: 'rbs-grocery-users'
    }
  );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function (deviceInfo = 'Unknown') {
  const refreshToken = jwt.sign(
    { id: this._id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    { expiresIn: '30d' }
  );

  // Add to user's refresh tokens
  this.refreshTokens.push({
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    deviceInfo
  });

  // Keep only last 5 refresh tokens per user
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }

  return refreshToken;
};

// Method to handle failed login attempts
userSchema.methods.incLoginAttempts = function () {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1, loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() },
    $inc: { sessionCount: 1 }
  });
};

// Method to create Stripe customer
userSchema.methods.createStripeCustomer = async function (stripe) {
  if (this.stripeCustomerId) return this.stripeCustomerId;

  try {
    const customer = await stripe.customers.create({
      email: this.email,
      name: this.fullName || this.name,
      phone: this.phone,
      metadata: {
        userId: this._id.toString(),
        environment: process.env.NODE_ENV || 'development'
      }
    });

    this.stripeCustomerId = customer.id;
    await this.save();

    return customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

// Static method to find user by email with password
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email }).select('+password');
};

// Static method for secure user lookup
userSchema.statics.findActiveUser = function (criteria) {
  return this.findOne({ ...criteria, isActive: true });
};

module.exports = mongoose.model('User', userSchema);