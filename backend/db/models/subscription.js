const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
        },
        frequency: {
            type: String,
            enum: ["DAILY", "WEEKLY"],
            required: true,
        },
        days: {
            type: [String],
            default: [],
        },
        startDate: {
            type: Date,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        stripeCustomerId: String,
        stripePaymentMethodId: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
