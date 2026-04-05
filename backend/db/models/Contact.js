const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
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
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  queryType: {
    type: String,
    trim: true
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
  status: {
    type: String,
    enum: ['new', 'read', 'responded', 'closed'],
    default: 'new'
  },
  response: {
    type: String,
    default: ''
  },
  /** Auto thank-you shown in admin + sent by email; does not block a later staff reply. */
  autoAcknowledgment: {
    type: String,
    default: '',
    trim: true,
  },
  respondedAt: {
    type: Date
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  /** Soft-delete: message stays in DB until permanently removed from Trash */
  inTrash: {
    type: Boolean,
    default: false,
  },
  trashedAt: {
    type: Date,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema);