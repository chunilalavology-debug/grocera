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

    ...addTimeStamp()
});

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;