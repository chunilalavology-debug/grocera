const mongoose = require('mongoose');

// Cart Schema for persistent shopping carts
const cartSchema = new mongoose.Schema({
  // User Reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    unique: true // One cart per user
  },
  
  // Cart Items
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99
    },
    // Store price when added to cart to handle price changes
    addedPrice: {
      type: Number,
      required: true,
      min: 0
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Cart Metadata
  lastModified: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Session tracking for analytics
  sessionId: String,
  
  // Cart expiration for cleanup
  expiresAt: {
    type: Date,
    default: function() {
      // Cart expires after 30 days of inactivity
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    },
    index: true
  },
  
  // Cart totals (calculated)
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Guest cart support (for logged-out users)
  isGuest: {
    type: Boolean,
    default: false
  },
  guestId: {
    type: String,
    sparse: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
cartSchema.index({ userId: 1 }, { unique: true });
cartSchema.index({ guestId: 1 }, { sparse: true });
cartSchema.index({ lastModified: 1 });
cartSchema.index({ expiresAt: 1 }); // For TTL cleanup

// TTL index for automatic cart cleanup
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  // Update last modified
  this.lastModified = new Date();
  
  // Calculate totals
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.subtotal = this.items.reduce((total, item) => total + (item.addedPrice * item.quantity), 0);
  
  // Update expiration
  this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = function(productId, quantity, price) {
  const existingItemIndex = this.items.findIndex(
    item => item.productId.toString() === productId.toString()
  );
  
  if (existingItemIndex > -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].addedAt = new Date();
    // Update price if it changed
    this.items[existingItemIndex].addedPrice = price;
  } else {
    // Add new item
    this.items.push({
      productId,
      quantity,
      addedPrice: price,
      addedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(productId, quantity) {
  const item = this.items.find(
    item => item.productId.toString() === productId.toString()
  );
  
  if (item) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      this.items = this.items.filter(
        item => item.productId.toString() !== productId.toString()
      );
    } else {
      item.quantity = quantity;
      item.addedAt = new Date();
    }
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(
    item => item.productId.toString() !== productId.toString()
  );
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

// Method to merge guest cart with user cart
cartSchema.methods.mergeGuestCart = function(guestCart) {
  if (!guestCart || !guestCart.items) return this.save();
  
  guestCart.items.forEach(guestItem => {
    const existingItemIndex = this.items.findIndex(
      item => item.productId.toString() === guestItem.productId.toString()
    );
    
    if (existingItemIndex > -1) {
      // Merge quantities
      this.items[existingItemIndex].quantity += guestItem.quantity;
      this.items[existingItemIndex].addedAt = new Date();
    } else {
      // Add guest item
      this.items.push({
        productId: guestItem.productId,
        quantity: guestItem.quantity,
        addedPrice: guestItem.addedPrice,
        addedAt: new Date()
      });
    }
  });
  
  return this.save();
};

// Static method to find or create cart
cartSchema.statics.findOrCreateCart = async function(userId, guestId = null) {
  let cart = await this.findOne({ userId });
  
  if (!cart) {
    cart = new this({
      userId,
      items: [],
      isGuest: false
    });
    
    // If guest cart exists, merge it
    if (guestId) {
      const guestCart = await this.findOne({ guestId });
      if (guestCart) {
        await cart.mergeGuestCart(guestCart);
        // Remove guest cart after merging
        await this.deleteOne({ guestId });
      }
    }
    
    await cart.save();
  }
  
  return cart;
};

// Static method to create guest cart
cartSchema.statics.createGuestCart = function(guestId) {
  return this.create({
    userId: new mongoose.Types.ObjectId(), // Temporary user ID for guests
    guestId,
    items: [],
    isGuest: true
  });
};

// Static method to clean expired carts
cartSchema.statics.cleanExpiredCarts = function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    lastModified: { $lt: thirtyDaysAgo }
  });
};

// Static method to get cart statistics
cartSchema.statics.getCartStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalCarts: { $sum: 1 },
        activeCarts: {
          $sum: {
            $cond: [
              { $gt: ['$totalItems', 0] },
              1,
              0
            ]
          }
        },
        averageItemsPerCart: { $avg: '$totalItems' },
        averageCartValue: { $avg: '$subtotal' },
        guestCarts: {
          $sum: {
            $cond: [{ $eq: ['$isGuest', true] }, 1, 0]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Cart', cartSchema);