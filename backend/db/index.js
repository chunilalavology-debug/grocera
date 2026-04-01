const mongoose = require("mongoose");
const { connectDB } = require("../lib/db");
const Users = require("./models/Users");
const Contact = require("./models/Contact");
const Deal = require("./models/deals");
const Message = require("./models/Message");
const Order = require("./models/Order");
const Product = require("./models/Product");
const subscription = require("./models/subscription");
const Voucher = require("./models/voucher");
const HomeSliderSettings = require("./models/HomeSliderSettings");

const { getMongoUri } = require("../lib/db");

/** Backwards-compatible name used across controllers / app middleware */
async function connectMongoose() {
  return connectDB();
}

if (getMongoUri()) {
  connectMongoose().catch((err) => {
    console.error("MongoDB initial connect failed:", err.message);
  });
} else {
  console.error(
    "MongoDB: set MONGO_URI or DB_STRING (include database name in URI path, e.g. .../dbname?...)."
  );
}

mongoose.Promise = global.Promise;

module.exports = {
  User: Users,
  ContactUs: Contact,
  Deals: Deal,
  Message,
  Orders: Order,
  Products: Product,
  Subscription: subscription,
  Voucher,
  HomeSliderSettings,
  connectMongoose,
  connectDB,
};
