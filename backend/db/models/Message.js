const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  inquiryType: {
    type: String,
    enum: ['general', 'order', 'delivery', 'product', 'complaint', 'compliment'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied', 'resolved'],
    default: 'unread',
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  adminNotes: {
    type: String,
    trim: true
  },
  repliedAt: {
    type: Date
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  replyMessage: {
    type: String,
    trim: true
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
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ email: 1 });
messageSchema.index({ inquiryType: 1 });
messageSchema.index({ priority: 1, status: 1 });

// Virtual for full name
messageSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Method to mark as read
messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  return this.save();
};

// Method to reply to message
messageSchema.methods.reply = function(replyText, adminId) {
  this.status = 'replied';
  this.replyMessage = replyText;
  this.repliedAt = new Date();
  this.repliedBy = adminId;
  return this.save();
};

// Static method for getting message statistics
messageSchema.statics.getMessageStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Message', messageSchema);