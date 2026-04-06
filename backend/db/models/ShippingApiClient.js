const mongoose = require("mongoose");

const shippingApiClientSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true, maxlength: 160 },
    keyId: { type: String, required: true, trim: true, unique: true, index: true },
    keyHash: { type: String, required: true, trim: true, select: false },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    commissionPercent: { type: Number, min: 0, max: 200, default: null },
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, trim: true, default: "" },
    requestCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShippingApiClient", shippingApiClientSchema);
