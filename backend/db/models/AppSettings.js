const mongoose = require('mongoose');

/** Singleton-style dashboard settings (one document). */
const appSettingsSchema = new mongoose.Schema(
  {
    /** Storefront / browser tab branding (singleton). */
    websiteName: { type: String, trim: true, maxlength: 120, default: 'Zippyyy' },
    /** Public URL to header logo (uploaded to /uploads). */
    websiteLogoUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    /** Public URL to favicon (.ico / png / svg). */
    websiteFaviconUrl: { type: String, trim: true, maxlength: 2048, default: '' },

    /** Admin-facing email (new order + system alerts). */
    adminMail: { type: String, trim: true, default: '' },
    /** Primary inbox for contact form admin notifications. */
    contactFormToEmailPrimary: { type: String, trim: true, default: '' },
    /** Secondary inbox (e.g. backup or second SMTP route when you go live). */
    contactFormToEmailSecondary: { type: String, trim: true, default: '' },

    smtpHost: { type: String, trim: true, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpEncryption: {
      type: String,
      enum: ['tls', 'ssl', 'none'],
      default: 'tls',
    },
    smtpUser: { type: String, trim: true, default: '' },
    /** Stored in DB for convenience; restrict server access in production. */
    smtpPass: { type: String, default: '' },
    smtpFromEmail: { type: String, trim: true, default: '' },
    smtpFromName: { type: String, trim: true, default: 'Zippyyy' },

    /** Homepage featured categories block heading (storefront). */
    homeFeaturedSectionTitle: { type: String, trim: true, maxlength: 120, default: 'Featured Categories' },

    /**
     * Contact form automatic thank-you (email + message thread). Empty = use built-in default.
     * Supports {{name}} or {name}.
     */
    contactAutoReplyMessage: { type: String, trim: true, maxlength: 8000, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
