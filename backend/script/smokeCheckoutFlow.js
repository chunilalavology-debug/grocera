/**
 * Local smoke: DB product count + Joi-style checkout body validation (mirrors orderPayment).
 * Run: node script/smokeCheckoutFlow.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Joi = require("joi");
const Product = require("../db/models/Product");

const guestAddressSchema = Joi.object({
  name: Joi.string().trim().required(),
  phone: Joi.string().trim().required(),
  fullAddress: Joi.string().trim().required(),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().allow("", null).optional(),
  pincode: Joi.string().trim().required(),
  addressType: Joi.string().valid("Home", "Work", "Other").optional(),
});

const checkoutSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
  addressId: Joi.string().optional().allow(null, ""),
  address: guestAddressSchema.optional(),
  tip: Joi.number().min(0).default(0),
  driverNote: Joi.string().allow(null, ""),
  couponCode: Joi.string().trim().allow(null, ""),
  paymentMethod: Joi.string().valid("stripe", "card", "otc", "upi").default("stripe"),
  cardNumber: Joi.when("paymentMethod", {
    is: "otc",
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
  pin: Joi.when("paymentMethod", {
    is: "otc",
    then: Joi.string().pattern(/^[0-9]{4}$/).required(),
    otherwise: Joi.forbidden(),
  }),
  name: Joi.when("paymentMethod", {
    is: "otc",
    then: Joi.string().min(3).required(),
    otherwise: Joi.optional(),
  }),
  deliveryType: Joi.string().valid("standard", "express").optional(),
  subtotal: Joi.number().optional(),
  deliveryFee: Joi.number().optional(),
  taxAndConvenienceFee: Joi.number().optional(),
  packagingFee: Joi.number().optional(),
  discountAmount: Joi.number().optional(),
  finalTotal: Joi.number().optional(),
}).unknown(true);

async function main() {
  const uri = (process.env.MONGO_URI || process.env.DB_STRING || "").trim();
  if (!uri) {
    console.log(JSON.stringify({ step: "mongo", ok: false, error: "no MONGO_URI" }));
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const filter = { isDeleted: { $ne: true } };
  const total = await Product.countDocuments(filter);
  const one = await Product.findOne(filter).select("_id name price").lean();

  console.log(
    JSON.stringify(
      {
        step: "mongo",
        ok: true,
        productCount: total,
        sampleProductId: one ? String(one._id) : null,
      },
      null,
      2,
    ),
  );

  const fakeId = one ? String(one._id) : "000000000000000000000000";
  const guestBody = {
    items: [{ product: fakeId, quantity: 1 }],
    tip: 0,
    driverNote: "",
    paymentMethod: "card",
    deliveryType: "standard",
    subtotal: 10,
    deliveryFee: 4.99,
    taxAndConvenienceFee: 1,
    packagingFee: 2,
    discountAmount: 0,
    finalTotal: 20,
    address: {
      name: "Test User",
      phone: "5551234567",
      fullAddress: "123 Main St",
      city: "Springfield",
      state: "IL",
      pincode: "62704",
      addressType: "Home",
    },
  };

  const { error: gErr } = checkoutSchema.validate(guestBody);
  console.log(
    JSON.stringify(
      {
        step: "joi_guest_card_extra_fields",
        ok: !gErr,
        error: gErr ? gErr.message : null,
      },
      null,
      2,
    ),
  );

  const otcBody = {
    ...guestBody,
    paymentMethod: "otc",
    cardNumber: "123456789",
    pin: "1234",
    name: "Test Cardholder",
  };
  const { error: oErr } = checkoutSchema.validate(otcBody);
  console.log(
    JSON.stringify(
      {
        step: "joi_guest_otc",
        ok: !oErr,
        error: oErr ? oErr.message : null,
      },
      null,
      2,
    ),
  );

  const badPin = { ...otcBody, pin: "123" };
  const { error: bpErr } = checkoutSchema.validate(badPin);
  console.log(
    JSON.stringify(
      {
        step: "joi_otc_bad_pin_expect_fail",
        ok: Boolean(bpErr),
        error: bpErr ? bpErr.message : null,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
  const allOk = !gErr && !oErr && bpErr;
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ step: "fatal", ok: false, error: e.message }));
  process.exit(1);
});
