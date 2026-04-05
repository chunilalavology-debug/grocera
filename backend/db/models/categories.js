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

    /** When false, category is hidden from the homepage featured strip (still usable in catalog/admin). */
    featuredOnHome: {
        type: Boolean,
        default: true,
    },

    /** Optional label on the homepage strip; empty = use category name. */
    homeDisplayTitle: {
        type: String,
        trim: true,
        maxlength: 80,
        default: '',
    },

    ...addTimeStamp()
});

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;