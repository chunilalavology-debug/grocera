const mongoose = require('mongoose');

/** Singleton-style dashboard settings (one document). */
const appSettingsSchema = new mongoose.Schema(
  {
    /** Storefront / browser tab branding (singleton). */
    websiteName: { type: String, trim: true, maxlength: 120, default: 'Zippyyy' },
    /** Public URL to header logo (/uploads/..., Cloudinary, or /user/site-branding/logo when stored in DB). */
    websiteLogoUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    /** Raw logo bytes when hosted from MongoDB (e.g. Vercel; not exposed in JSON). */
    websiteLogoBinary: { type: Buffer, select: false },
    websiteLogoContentType: { type: String, trim: true, maxlength: 120, default: '', select: false },

    /** Public URL to favicon (.ico / png / svg). */
    websiteFaviconUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    websiteFaviconBinary: { type: Buffer, select: false },
    websiteFaviconContentType: { type: String, trim: true, maxlength: 120, default: '', select: false },

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

appSettingsSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.websiteLogoBinary;
    delete ret.websiteFaviconBinary;
    delete ret.websiteLogoContentType;
    delete ret.websiteFaviconContentType;
    return ret;
  },
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);
