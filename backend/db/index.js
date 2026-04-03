const mongoose = require('mongoose');
const Users = require('./models/Users');
const Contact = require('./models/Contact');
const Deal = require('./models/deals');
const Message = require('./models/Message');
const Order = require('./models/Order');
const Product = require('./models/Product');
const subscription = require('./models/subscription');
const Voucher = require('./models/voucher');
const HomeSliderSettings = require('./models/HomeSliderSettings');

const { DB_STRING } = process.env;
mongoose
  .connect(DB_STRING, {
    serverSelectionTimeoutMS: 30000,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection failed (server will keep running):", err.message);
  });
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
    HomeSliderSettings
};