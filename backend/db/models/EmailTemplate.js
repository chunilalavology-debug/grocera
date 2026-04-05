const mongoose = require("mongoose");

/**
 * Editable transactional email templates (HTML body + subject).
 * `key` is stable for code integration (e.g. order_customer_new).
 */
const emailTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    subject: { type: String, required: true, default: "" },
    bodyHtml: { type: String, required: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
