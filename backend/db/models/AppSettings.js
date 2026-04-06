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

    marquee: {
      enabled: { type: Boolean, default: true },
      bgColor: { type: String, trim: true, maxlength: 32, default: '#e9aa42' },
      textColor: { type: String, trim: true, maxlength: 32, default: '#ffffff' },
      /** Seconds per loop (smaller = faster). */
      speed: { type: Number, min: 8, max: 120, default: 35 },
      slides: {
        type: [String],
        default: [
          '🥦 Fresh groceries delivered to your door – shop with ease 🥕',
          '🥦 Free delivery on orders over $50 – order now! 🥕',
          '🥦 Best quality, best prices – Zippyyy has it all 🥕',
        ],
      },
    },

    header: {
      isFixed: { type: Boolean, default: false },
    },

    heroBanner: {
      /** Public URL or /user/site-branding/hero-banner for Mongo-hosted image. */
      image: { type: String, trim: true, maxlength: 2048, default: '' },
      imageBinary: { type: Buffer, select: false },
      imageContentType: { type: String, trim: true, maxlength: 120, default: '', select: false },
      /** CSS rgba(...) string for overlay tint. */
      overlayColor: { type: String, trim: true, maxlength: 64, default: 'rgba(0,0,0,0.45)' },
    },

    socialLinks: {
      facebook: { type: String, trim: true, maxlength: 2048, default: '' },
      instagram: { type: String, trim: true, maxlength: 2048, default: '' },
      linkedin: { type: String, trim: true, maxlength: 2048, default: '' },
      twitter: { type: String, trim: true, maxlength: 2048, default: '' },
      snapchat: { type: String, trim: true, maxlength: 2048, default: '' },
      whatsapp: { type: String, trim: true, maxlength: 2048, default: '' },
    },

    /**
     * Contact form automatic thank-you (email + message thread). Empty = use built-in default.
     * Supports {{name}} or {name}.
     */
    contactAutoReplyMessage: { type: String, trim: true, maxlength: 8000, default: '' },

    /** Easyship proxy share settings (admin-managed; secrets are encrypted at rest). */
    easyshipShare: {
      enabled: { type: Boolean, default: true },
      commissionPercent: { type: Number, min: 0, max: 200, default: 30 },
      apiKeyEnc: { type: String, default: '', select: false },
      apiKeyIv: { type: String, default: '', select: false },
      apiKeyTag: { type: String, default: '', select: false },
    },
  },
  { timestamps: true }
);

appSettingsSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.websiteLogoBinary;
    delete ret.websiteFaviconBinary;
    delete ret.websiteLogoContentType;
    delete ret.websiteFaviconContentType;
    if (ret.heroBanner) {
      delete ret.heroBanner.imageBinary;
      delete ret.heroBanner.imageContentType;
    }
    if (ret.easyshipShare) {
      delete ret.easyshipShare.apiKeyEnc;
      delete ret.easyshipShare.apiKeyIv;
      delete ret.easyshipShare.apiKeyTag;
    }
    return ret;
  },
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);
