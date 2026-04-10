const mongoose = require("mongoose");

// Production-ready Order Schema with comprehensive tracking
const orderSchema = new mongoose.Schema({
  // Order Identification
  orderId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  /** Backward-compatible alias used across existing admin/front-end/email code paths. */
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
  },

  addressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    required: false,
    default: null,
  },

  /** Canonical email for order notifications (guest or overrides). */
  customerEmail: { type: String, trim: true, lowercase: true, default: '' },

  /** Guest checkout: delivery snapshot when userId/addressId are not used */
  guestShipping: {
    name: String,
    phone: String,
    email: String,
    fullAddress: String,
    city: String,
    state: String,
    pincode: String,
    addressType: String,
  },

  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: { type: String, required: true },
    productImage: String,
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    productSku: String,
    productCategory: String,
    selectedWeight: { type: Number }
  }],

  subtotal: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  shippingAmount: { type: Number, default: 0, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  tipAmount: { type: Number, default: 0, min: 0 },
  serviceFee: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },

  coupon: {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
    code: String,
    discountType: String,
    discountValue: Number,
    discountAmount: Number,
  },

  /** Prevents double-counting voucher.usedCount on replayed webhooks */
  voucherRedemptionRecorded: { type: Boolean, default: false },

  status: {
    type: String,
    enum: [
      'session',
      'pending',
      'confirmed',
      'processing',
      'on_hold',
      'packed',
      'shipped',
      'on_the_way',
      'delivered',
      'completed',
      'cancelled',
      'refunded',
      'failed',
    ],
    default: 'pending',
  },

  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'completed', 'failed', 'refunded', 'partial_refund', 'partial'],
    default: 'pending',
  },

  paymentMethod: {
    type: String,
    enum: ['stripe', 'otc', 'card', 'split', 'cash_on_delivery'],
    default: 'stripe'
  },

  stripeAmount: { type: Number, default: 0, min: 0 },
  otcAmount: { type: Number, default: 0, min: 0 },

  paymentCards: {
    name: String,
    cardNumber: String,
    pin: String,
  },

  paidAt: Date,

  stripePaymentIntentId: {
    type: String,
  },
  stripePaymentMethodId: String,
  stripeSessionId: {
    type: String,
    index: true
  },

  estimatedDelivery: Date,
  actualDeliveryDate: Date,
  trackingNumber: String,
  carrier: String,
  // Used by ZippyyyShips flow to generate/download a shipping label after Stripe payment.
  shippingLabelUrl: { type: String, default: '' },
  isShippingOrder: { type: Boolean, default: false },
  deliveryInstructions: { type: String, maxlength: 500 },

  notes: { type: String, maxlength: 1000 },

  orderSource: {
    type: String,
    enum: ['web', 'mobile', 'admin'],
    default: 'web'
  },
  customerType: {
    type: String,
    enum: ['new', 'returning'],
    default: 'new'
  },

  processingTime: Number,
  fulfillmentTime: Number,
  cancellationReason: String,

  refundAmount: { type: Number, default: 0, min: 0 },
  refundDate: Date,
  emailSent: Boolean,
  /** Set when admin new-order notification is sent or intentionally skipped (toggle off). */
  adminNewOrderEmailHandled: { type: Boolean, default: false },
  /**
   * Milestone buckets for customer status emails: processing | shipped | delivered | cancelled.
   * Prevents duplicate emails when multiple internal statuses map to the same bucket.
   */
  emailedOrderStatusBuckets: { type: [String], default: [] },
  /** Exact order.status values a customer notification was already sent for (primary dedupe). */
  emailedOrderStatuses: { type: [String], default: [] },
  refundReason: String
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      if (!ret.userId && ret.user) ret.userId = ret.user;
      delete ret.__v;
      return ret;
    }
  }
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });
/** ZippyyyShips / admin filters for label orders */
orderSchema.index({ isShippingOrder: 1, createdAt: -1 });

orderSchema.index({ userId: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });

orderSchema.pre('save', function (next) {
  if (!this.orderId && this.orderNumber) this.orderId = this.orderNumber;
  if (!this.orderNumber && this.orderId) this.orderNumber = this.orderId;

  if (this.user && !this.userId) this.userId = this.user;
  if (this.userId && !this.user) this.user = this.userId;

  this.subtotal = this.items.reduce((total, item) => {
    if (!item.subtotal) item.subtotal = item.price * item.quantity;
    return total + item.subtotal;
  }, 0);

  if (!this.totalAmount) {
    this.totalAmount = this.subtotal + this.taxAmount + this.shippingAmount + (this.tipAmount || 0) - this.discountAmount;
  }

  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  next();
});

orderSchema.methods.calculateEstimatedDelivery = function () {
  const businessDays = 3;
  const now = new Date();
  const delivery = new Date(now);
  delivery.setDate(now.getDate() + businessDays);

  this.estimatedDelivery = delivery;
  return delivery;
};

orderSchema.methods.updateStatus = function (newStatus, note = '', updatedBy = null) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note,
    updatedBy
  });

  return this.save();
};

orderSchema.statics.getOrderStats = function (userId = null) {
  const match = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Order', orderSchema);