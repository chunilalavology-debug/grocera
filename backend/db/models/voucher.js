const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },

    description: String,

    discountType: { type: String, required: true },
    discountValue: { type: Number, required: true },
    maxDiscountAmount: Number,

    // productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    startAt: Date,
    endAt: Date,

    totalUsageLimit: Number,
    usedCount: { type: Number, default: 0 },
    minPurchase: { type: Number },

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },

}, { timestamps: true });

const Voucher = mongoose.model('vouchers', voucherSchema);
module.exports = Voucher