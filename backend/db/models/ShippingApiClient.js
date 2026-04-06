const mongoose = require("mongoose");

const shippingApiClientSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true, maxlength: 160 },
    keyId: { type: String, required: true, trim: true, unique: true, index: true },
    keyHash: { type: String, required: true, trim: true, select: false },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    /** Unset = use global default from settings. Avoid `min`/`max` on Number so `null` never fails validation. */
    commissionPercent: {
      type: Number,
      required: false,
      validate: {
        validator(v) {
          return v === undefined || v === null || (typeof v === "number" && !Number.isNaN(v) && v >= 0 && v <= 200);
        },
        message: "commissionPercent must be between 0 and 200 or unset",
      },
    },
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, trim: true, default: "" },
    requestCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShippingApiClient", shippingApiClientSchema);
