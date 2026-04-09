const mongoose = require("mongoose");

const comingSoonSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
      index: true,
    },
    source: {
      type: String,
      trim: true,
      maxlength: 64,
      default: "site_wide",
    },
  },
  { timestamps: true },
);

comingSoonSubscriberSchema.index({ email: 1, source: 1 }, { unique: true });

module.exports = mongoose.model("ComingSoonSubscriber", comingSoonSubscriberSchema);
