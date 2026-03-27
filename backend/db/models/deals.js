const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
    productId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }],

    dealName: String,
    dealType: { type: String },

    discountValue: String,

    startAt: Date,
    endAt: Date,

    perUserLimit: Number,

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    showOnProductPage: { type: Boolean, default: true },

    viewsCount: { type: Number, default: 0 },
    appliedCount: { type: Number, default: 0 },

}, { timestamps: true });


const Deal = mongoose.model('product_deals', dealSchema);
module.exports = Deal