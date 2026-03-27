const mongoose = require("mongoose");

const slideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    imageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    buttonText: { type: String, trim: true, maxlength: 40, default: "Shop Now" },
    buttonLink: { type: String, trim: true, maxlength: 1024, default: "/products" },
    cardBgColor: { type: String, trim: true, maxlength: 20, default: "#f8fafc" },
    textColor: { type: String, trim: true, maxlength: 20, default: "#1e293b" },
    buttonBgColor: { type: String, trim: true, maxlength: 20, default: "#3090cf" },
    buttonTextColor: { type: String, trim: true, maxlength: 20, default: "#ffffff" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const homeSliderSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "home-main-slider" },
    sectionBgColor: { type: String, trim: true, maxlength: 20, default: "#ffffff" },
    autoPlay: { type: Boolean, default: true },
    autoPlayDelayMs: { type: Number, default: 3000, min: 1000, max: 20000 },
    transitionDurationMs: { type: Number, default: 700, min: 200, max: 3000 },
    slidesPerViewDesktop: { type: Number, default: 3, min: 1, max: 4 },
    slidesPerViewTablet: { type: Number, default: 2, min: 1, max: 3 },
    slidesPerViewMobile: { type: Number, default: 1, min: 1, max: 2 },
    slides: { type: [slideSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomeSliderSettings", homeSliderSettingsSchema);
