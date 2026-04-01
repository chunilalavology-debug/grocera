const mongoose = require("mongoose");
const Users = require("./models/Users");
const Contact = require("./models/Contact");
const Deal = require("./models/deals");
const Message = require("./models/Message");
const Order = require("./models/Order");
const Product = require("./models/Product");
const subscription = require("./models/subscription");
const Voucher = require("./models/voucher");
const HomeSliderSettings = require("./models/HomeSliderSettings");

const { DB_STRING } = process.env;

/** Serverless (Vercel): reuse one connection per warm instance; avoid exhausting Atlas connections. */
const mongooseOpts = {
  serverSelectionTimeoutMS: 25_000,
  connectTimeoutMS: 25_000,
  socketTimeoutMS: 45_000,
  maxPoolSize: 10,
};

let cached = global.__groceraMongoose;
if (!cached) {
  cached = global.__groceraMongoose = { promise: null };
}

/**
 * Await before DB operations. Safe to call on every request (fast when already connected).
 */
async function connectMongoose() {
  const uri = DB_STRING && String(DB_STRING).trim();
  if (!uri) {
    throw new Error("DB_STRING is not set");
  }
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, mongooseOpts).then(() => mongoose.connection);
  }
  try {
    await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return mongoose.connection;
}

if (DB_STRING && String(DB_STRING).trim()) {
  connectMongoose().catch((err) => {
    console.error("MongoDB initial connect failed:", err.message);
  });
} else {
  console.error(
    "MongoDB: DB_STRING is missing. Set DB_STRING in Vercel (backend project) to your mongodb+srv:// URI."
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
};
