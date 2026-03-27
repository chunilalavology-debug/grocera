const mongoose = require("mongoose");
const { addTimeStamp } = require("../../utils/addTimeStamp");

const addressSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
        },

        fullAddress: {
            type: String,
            required: true,
        },

        addressLine2: {
            type: String,
        },

        city: {
            type: String,
            required: true,
        },

        state: {
            type: String,
            required: true,
        },

        pincode: {
            type: String,
            required: true,
        },

        location: {
            type: {
                type: String,
                enum: ["Point"],
                required: function () {
                    return this.location?.coordinates?.length;
                }
            },
            coordinates: {
                type: [Number],
                required: false,
            },
        },


        addressType: {
            type: String,
            enum: ["Home", "Work", "Other"],
            default: "Home",
        },

        isDefault: {
            type: Boolean,
            default: false,
        },
        ...addTimeStamp()
    }
);

addressSchema.index({ location: "2dsphere" });

const Address = mongoose.model("Address", addressSchema);
module.exports = Address
