const mongoose = require("mongoose");
const { addTimeStamp } = require("../../utils/addTimeStamp");

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    image: {
        type: String
    },

    isActive: {
        type: Boolean,
        default: true
    },

    /** Featured strip tab: indian | american | chinese | turkish (omit/null = not on home strip) */
    main: {
        type: String,
        default: null,
        trim: true,
    },

    sortOrder: {
        type: Number,
        default: 0,
    },

    ...addTimeStamp()
});

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;