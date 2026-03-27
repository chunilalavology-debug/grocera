const express = require("express");
const router = express.Router();
const Joi = require("joi");
const { Products, Subscription, Voucher, ContactUs, Orders, User, HomeSliderSettings } = require("../../db");
const Stripe = require("stripe");
const { default: sendMail } = require("../../utils/sendEmail");
const userSellRateLimiter = require("../middlewares/rateLimit");
const Product = require("../../db/models/Product");
const Address = require("../../db/models/Address");
const Order = require("../../db/models/Order");
const redisClient = require("../services/serviceRedis-cli");
const { setKeyWithTime, getKey } = require("../services/serviceRedis");
const { default: mongoose } = require("mongoose");
const Category = require("../../db/models/categories");
const createStripeClient = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== "string" || key.trim().length === 0) {
    console.error("STRIPE_SECRET_KEY is missing. Stripe checkout endpoints are disabled.");
    return null;
  }
  try {
    return new Stripe(key);
  } catch (err) {
    console.error("Invalid STRIPE_SECRET_KEY configuration:", err.message);
    return null;
  }
};
const stripe = createStripeClient();
const EASYSHIP_API_KEY = process.env.EASYSHIP_API_KEY || "";

require("dotenv").config();

const formatJoiErrors = (error) => {
  if (!error.details) return '';
  const errors = error.details.map((detail) => {
    return detail.message.replace(/"/g, "");
  });
  return errors.join(', ')
};

const idValidation = Joi.object({
  id: Joi.string()
    .length(24)
    .hex()
    .required()
});


const applyVoucher = async ({
  code,
  cartTotal,
  productIds,
  paymentMethod,
  userVoucherUsageCount,
}) => {
  const now = new Date();

  const voucher = await Voucher.findOne({
    code: new RegExp(`^${code}$`, "i"),
    isActive: true,
    isDeleted: false,
    startAt: { $lte: now },
    endAt: { $gte: now },
  });

  if (!voucher) throw "Invalid or expired voucher";

  if (
    voucher.totalUsageLimit &&
    voucher.usedCount >= voucher.totalUsageLimit
  ) {
    throw "Voucher usage limit reached";
  }

  if (
    voucher.perUserLimit &&
    userVoucherUsageCount >= voucher.perUserLimit
  ) {
    throw "Voucher already used by user";
  }

  if (
    voucher.paymentMethods?.length &&
    !voucher.paymentMethods.includes(paymentMethod)
  ) {
    throw "Payment method not allowed";
  }

  if (
    voucher.productIds?.length &&
    !productIds.some(id =>
      voucher.productIds.map(p => p.toString()).includes(id.toString())
    )
  ) {
    throw "Voucher not applicable on selected products";
  }

  let discount = 0;

  if (voucher.discountType === "PERCENT") {
    discount = (cartTotal * voucher.discountValue) / 100;
    if (voucher.maxDiscountAmount) {
      discount = Math.min(discount, voucher.maxDiscountAmount);
    }
  } else {
    discount = voucher.discountValue;
  }

  return {
    voucherId: voucher._id,
    discount: Math.round(discount),
  };
};

const getProducts = async (req, res) => {
  try {
    const {
      category = "All",
      search,
      minPrice,
      maxPrice,
      limit = 12,
      cursor
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 12, 50);

    const filter = {
      inStock: true,
      isDeleted: false,
    };

    if (category !== "All") {
      filter.category = category;
    }

    // if (search) {
    //   filter.$text = { $search: search };
    // }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const isFirstPage = !cursor && !search && !minPrice && !maxPrice;
    const cacheKey = `products:${category}:v1`;

    if (isFirstPage) {
      console.log("chase recived ")
      const cachedData = await getKey(cacheKey);
      if (cachedData.data) {
        return res.json(JSON.parse(cachedData.data));
      }
    }

    let total = null;

    if (!cursor) {
      total = await Products.countDocuments(filter);
    }


    const products = await Products.find(filter)
      .sort({ _id: -1 })
      .limit(limitNum)
      .select("name price salePrice image category inStock quantity unit")
      .lean();

    const normalizedProducts = products.map((p) => {
      const basePrice = Number(p.price || 0);
      const salePrice = Number(p.salePrice || 0);
      const hasDiscount = salePrice > 0 && salePrice < basePrice;
      const finalPrice = hasDiscount ? salePrice : basePrice;
      const discountPercentage = hasDiscount
        ? Math.round(((basePrice - finalPrice) / basePrice) * 100)
        : 0;

      return {
        ...p,
        price: finalPrice,
        salePrice,
        hasDeal: hasDiscount,
        originalPrice: hasDiscount ? basePrice : null,
        finalPrice,
        discountPercentage,
      };
    });

    const response = {
      success: true,
      data: normalizedProducts,
      totalCount: total,
      nextCursor: products.length
        ? products[products.length - 1]._id
        : null,
      hasNextPage: products.length === limitNum,
    };

    if (isFirstPage) {
      await setKeyWithTime(cacheKey, JSON.stringify(response), 1);
    }

    return res.json(response);

  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// const getProducts = async (req, res) => {
//   const validationSchema = Joi.object({
//     category: Joi.string().allow(null, ''),
//     search: Joi.string().allow(null, ''),
//     minPrice: Joi.number().min(0).allow(null, ''),
//     maxPrice: Joi.number().min(0).allow(null, ''),
//     sortBy: Joi.string().valid('price', 'createdAt', 'name').allow(null, ''),
//     sortOrder: Joi.string().valid('asc', 'desc').allow(null, ''),
//     page: Joi.number().min(1).required(),
//     limit: Joi.number().min(1).max(100).required(),
//     inStockOnly: Joi.boolean().optional()
//   });

//   try {
//     await validationSchema.validateAsync(req.query);
//     const {
//       category,
//       search,
//       minPrice,
//       maxPrice,
//       sortBy = 'createdAt',
//       sortOrder = 'desc',
//       page = 1,
//       limit = 20,
//     } = req.query;

//     const filter = {
//       inStock: true,
//       isDeleted: false,
//     };

//     if (category && category !== 'All') {
//       filter.category = category;
//     }

//     if (search) {
//       filter.$text = { $search: search };
//     }

//     if (minPrice !== undefined || maxPrice !== undefined) {
//       filter.price = {};
//       if (minPrice) filter.price.$gte = parseFloat(minPrice);
//       if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
//     }

//     const skip = (parseInt(page) - 1) * parseInt(limit);

//     const [products, total] = await Promise.all([
//       Products.find(filter)
//         .sort('-createdAt')
//         .skip(skip)
//         .limit(parseInt(limit)).lean()
//         .select("name price image category inStock quantity unit"),
//       Products.countDocuments(filter)
//     ])

//     res.send({
//       success: true,
//       data: products,
//       pagination: {
//         currentPage: parseInt(page),
//         totalCount: total,
//         hasNextPage: skip + products.length < total,
//         hasPrevPage: parseInt(page) > 1
//       }
//     });
//   } catch (error) {
//     if (error.isJoi) {
//       return res.status(400).json({
//         success: false,
//         message: `Validation error: ${formatJoiErrors(error)}`,
//         code: 'VALIDATION_ERROR'
//       });
//     }
//     console.error('Get products error:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message || 'Error fetching products'
//     });
//   }
// }

const getProductById = async (req, res) => {
  try {
    await idValidation.validateAsync(req.query, { abortEarly: true })
    const { id } = req.query;
    const now = new Date();

    let product = await Products.findById(id)
      .populate({
        path: 'dealId',
        select: 'dealName dealType discountValue startAt endAt',
        match: {
          isDeleted: false,
          isActive: true,
          startAt: { $lte: now },
          endAt: { $gte: now }
        }
      }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const basePrice = Number(product.price || 0);
    const salePrice = Number(product.salePrice || 0);

    let originalPrice = basePrice;
    let finalPrice = (salePrice > 0 && salePrice < originalPrice) ? salePrice : originalPrice;
    let discountAmount = Math.max(originalPrice - finalPrice, 0);
    let hasDeal = discountAmount > 0;

    const deal = product.dealId;

    if (deal) {
      // FLAT discount
      if (deal.dealType === 'FLAT') {
        const dealDiscount = Number(deal.discountValue) || 0;
        const dealFinalPrice = Math.max(originalPrice - dealDiscount, 0);
        if (dealFinalPrice < finalPrice) {
          finalPrice = dealFinalPrice;
        }
      }

      // PERCENT discount
      if (deal.dealType === 'PERCENT') {
        const percentDiscount = (originalPrice * Number(deal.discountValue)) / 100;
        const dealFinalPrice = Math.max(originalPrice - percentDiscount, 0);
        if (dealFinalPrice < finalPrice) {
          finalPrice = dealFinalPrice;
        }
      }

      discountAmount = Math.max(originalPrice - finalPrice, 0);
      hasDeal = discountAmount > 0;
    }

    res.json({
      success: true,
      data: {
        ...product,
        hasDeal,
        originalPrice,
        finalPrice,
        discountAmount
      }
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formatJoiErrors(error)}`,
        code: 'VALIDATION_ERROR'
      });
    }
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product'
    });
  }
}

const categories = async (req, res) => {
  try {
    const categories = await Products.distinct('category');
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
};

const createSubscription = async (req, res) => {
  const schema = Joi.object({
    productId: Joi.string().required(),

    quantity: Joi.number()
      .integer()
      .min(1)
      .required(),

    frequency: Joi.string()
      .valid("DAILY", "WEEKLY")
      .required(),

    days: Joi.when("frequency", {
      is: "WEEKLY",
      then: Joi.array()
        .items(Joi.string())
        .min(1)
        .required()
        .messages({
          "array.min": "Please select days for weekly subscription",
          "any.required": "Please select days for weekly subscription",
        }),
      otherwise: Joi.array()
        .items(Joi.string())
        .optional()
        .default([]),
    }),

    startDate: Joi.date().required(),

    stripeCustomerId: Joi.string().allow(null, ""),
    stripePaymentMethodId: Joi.string().allow(null, "")
  });
  try {
    schema.validateAsync(req.body, { abortEarly: true })
    const {
      productId,
      quantity,
      frequency,
      days,
      startDate,
      stripeCustomerId,
      stripePaymentMethodId,
    } = req.body;

    if (frequency === "WEEKLY" && (!days || days.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Please select days for weekly subscription",
      });
    }

    const existingSubscription = await Subscription.findOne({
      userId: req.user.id,
      productId,
    });

    if (existingSubscription?.isActive) {
      return res.status(409).json({
        success: false,
        message: "You already have an active subscription for this product",
      });
    }

    if (existingSubscription && !existingSubscription.isActive) {
      existingSubscription.quantity = quantity;
      existingSubscription.frequency = frequency;
      existingSubscription.days = days;
      existingSubscription.startDate = startDate;
      existingSubscription.isActive = true;
      existingSubscription.stripeCustomerId = stripeCustomerId;
      existingSubscription.stripePaymentMethodId =
        stripePaymentMethodId;

      await existingSubscription.save();

      return res.status(200).json({
        success: true,
        message: "Subscription created successfully",
        subscription: existingSubscription,
      });
    }

    const subscription = await Subscription.create({
      userId: req.user.id,
      productId,
      quantity,
      frequency,
      days,
      startDate,
      stripeCustomerId,
      stripePaymentMethodId,
    });

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      subscription,
    });

  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error)
      });
    }
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create subscription",
    });
  }
};

const toggleSubscription = async (req, res) => {
  try {
    idValidation.validateAsync(req.body, { abortEarly: true })
    const { id } = req.body;

    const subscription = await Subscription.findOne({
      _id: id,
      userId: req.user.id,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    subscription.isActive = false;
    await subscription.save();

    res.json({
      success: true,
      message: subscription.isActive
        ? "Subscription resumed"
        : "Subscription paused",
    });

  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formatJoiErrors(error)}`,
        code: 'VALIDATION_ERROR'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const checkSubscription = async (req, res) => {
  const id = Joi.object({
    productId: Joi.string().required(),
  })
  try {
    await id.validateAsync(req.query, { abortEarly: true })
    const subscription = await Subscription.findOne({
      userId: req.user.id,
      productId: req.query.productId,
    });

    if (!subscription) {
      return res.status(200).json({
        success: false,
        message: "Subscription not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription available",
      data: subscription,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error)
      });
    }
    console.error("checkSubscription Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create subscription",
    });
  }
};

const subscriptionProducts = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({
      userId: req.user.id,
      isActive: true,
    })
      .populate("productId")
      .sort({ createdAt: -1 });

    if (!subscriptions.length) {
      return res.status(200).json({
        success: true,
        message: "No active subscriptions found",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription products fetched successfully",
      data: subscriptions,
    });

  } catch (error) {
    console.error("subscriptionProducts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription products",
    });
  }
};

const validateCoupon = async (req, res) => {
  const schema = Joi.object({
    code: Joi.string().trim().required(),
    subtotal: Joi.number().min(0).required()
  });

  try {
    const { error, value } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error)
      });
    }

    const { code, subtotal } = value;

    const coupon = await Voucher.findOne({
      code: code.toUpperCase(),
      isActive: true,
      isDeleted: false
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon code"
      });
    }

    const now = new Date();

    if (coupon.startAt && coupon.startAt > now) {
      return res.status(400).json({
        success: false,
        message: "Coupon not started yet"
      });
    }

    if (coupon.endAt && coupon.endAt < now) {
      return res.status(400).json({
        success: false,
        message: "Coupon expired"
      });
    }

    if (
      coupon.totalUsageLimit &&
      coupon.usedCount >= coupon.totalUsageLimit
    ) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit reached"
      });
    }

    if (coupon.minPurchase && subtotal < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum order should be $${coupon.minPurchase}`
      });
    }

    let discountAmount = 0;

    if (coupon.discountType === "percentage") {
      discountAmount = (subtotal * coupon.discountValue) / 100;

      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(
          discountAmount,
          coupon.maxDiscountAmount
        );
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    discountAmount = +discountAmount.toFixed(2);

    return res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount
      }
    });

  } catch (err) {
    console.error("validateCoupon error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

function calculateReferralDiscount(subtotal) {
  const amount = Number(subtotal) || 0;
  if (amount >= 100) return { code: 'REF10', discountAmount: 10 };
  if (amount >= 50) return { code: 'REF5', discountAmount: 5 };
  return { code: null, discountAmount: 0 };
}

const getReferralDiscount = async (req, res) => {
  const schema = Joi.object({
    subtotal: Joi.number().min(0).required(),
  });

  try {
    const { value, error } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error),
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId).select('referralDiscountEligible').lean();
    const eligible = Boolean(user?.referralDiscountEligible);

    if (!eligible) {
      return res.json({
        success: true,
        data: { eligible: false, code: null, discountAmount: 0 },
      });
    }

    const { code, discountAmount } = calculateReferralDiscount(value.subtotal);
    return res.json({
      success: true,
      data: { eligible: true, code, discountAmount },
    });
  } catch (err) {
    console.error('getReferralDiscount error:', err);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
};

const orderPayment = async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: "Stripe is not configured on server",
    });
  }

  const checkoutSchema = Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          product: Joi.string().required(),
          quantity: Joi.number().integer().min(1).required()
        })
      )
      .min(1)
      .required(),

    addressId: Joi.string().required(),

    tip: Joi.number().min(0).default(0),
    driverNote: Joi.string().allow(null, ""),
    couponCode: Joi.string().trim().allow(null, ""),

    paymentMethod: Joi.string()
      .valid("stripe", 'card', "otc", "upi")
      .default("stripe"),

    cardNumber: Joi.when("paymentMethod", {
      is: "otc",
      then: Joi.string()
        .required(),
      otherwise: Joi.forbidden()
    }),

    pin: Joi.when("paymentMethod", {
      is: "otc",
      then: Joi.string()
        .pattern(/^[0-9]{4}$/)
        .required(),
      otherwise: Joi.forbidden()
    }),

    name: Joi.when("paymentMethod", {
      is: "otc",
      then: Joi.string().min(3).required(),
      otherwise: Joi.optional()
    })
  });
  try {
    const { error, value } = checkoutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error)
      });
    }
    const userId = req.user.id;
    const {
      items, addressId,
      tip = 0,
      couponCode,
      paymentMethod = 'card',
      driverNote,
      cardNumber, pin, name
    } = value;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "No items provided" });
    }

    const productIds = items.map(i => i.product);

    const products = await Product.find({
      _id: { $in: productIds }
    }).lean();

    let stripeSubtotal = 0;
    let dbSubtotal = 0;
    let discountAmount = 0;
    let serviceFee = 5
    const TAX_RATE = 0.08875;
    let couponSnapshot = null;

    if (couponCode) {
      const coupon = await Voucher.findOne({
        code: couponCode,
        isActive: true
      });

      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired coupon"
        });
      }

      if (coupon.discountType === "percentage") {
        discountAmount = (dbSubtotal * coupon.discountValue) / 100;

        if (coupon.maxDiscount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscount);
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      discountAmount = +discountAmount.toFixed(2);

      couponSnapshot = {
        couponId: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount
      };
    }

    const orderItems = items.map(item => {
      const product = products.find(
        p => p._id.toString() === item.product
      );

      if (!product) throw new Error("Product not found");

      const unitPrice = product.price;
      const unitPriceCents = Math.round(unitPrice * 100);
      const quantity = item.quantity;

      const itemSubtotal = +(unitPrice * quantity).toFixed(2);

      stripeSubtotal += unitPriceCents * quantity;
      dbSubtotal += itemSubtotal;

      return {
        product: product._id,
        productName: product.name,
        productImage: product.image,
        price: unitPrice,
        quantity,
        subtotal: itemSubtotal
      };
    });

    // Apply referral discount automatically (only when no voucher/coupon code is used)
    if (!couponCode) {
      const user = await User.findById(userId).select('referralDiscountEligible').lean();
      const eligible = Boolean(user?.referralDiscountEligible);
      if (eligible) {
        const { code, discountAmount: referralDiscount } = calculateReferralDiscount(dbSubtotal);
        if (referralDiscount > 0) {
          discountAmount = referralDiscount;
          couponSnapshot = {
            couponId: null,
            code,
            discountType: 'fixed',
            discountValue: referralDiscount,
            discountAmount: referralDiscount,
          };
        }
      }
    }

    const toCents = (amount) => Math.round(amount * 100);
    const toDollars = (amount) => +(amount / 100).toFixed(2);

    const stripeTax = toCents(dbSubtotal * TAX_RATE);
    const stripeShipping = stripeSubtotal < 3500 ? 1000 : 0;
    const stripeTip = toCents(tip || 0);
    const stripeServiceFee = toCents(serviceFee);
    const stripeDiscount = toCents(discountAmount);

    const dbTax = toDollars(stripeTax);
    const dbShipping = toDollars(stripeShipping);
    const dbTip = tip || 0;

    const stripeTotal =
      stripeSubtotal +
      stripeTax +
      stripeShipping +
      stripeTip +
      stripeServiceFee -
      stripeDiscount;

    const dbTotal = toDollars(stripeTotal);

    const order = await Orders.create({
      userId,
      items: orderItems,
      subtotal: dbSubtotal,
      taxAmount: dbTax,
      shippingAmount: dbShipping,
      tipAmount: dbTip,
      serviceFee,
      totalAmount: dbTotal,
      notes: driverNote,
      addressId,
      serviceFee: stripeServiceFee,
      coupon: couponSnapshot,
      paymentStatus: "pending",
      status: "session"
    });

    if (paymentMethod === 'card') {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",

        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Order ${order.orderNumber}`
              },
              unit_amount: stripeTotal
            },
            quantity: 1
          }
        ],

        customer_email: req.user.email,

        metadata: {
          orderId: order._id.toString()
        },

        payment_intent_data: {
          metadata: {
            orderId: order._id.toString()
          }
        },

        success_url: `${process.env.FRONTEND_URL}/order-success?order=${order._id}`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout`
      });

      order.stripeSessionId = session.id;
      await order.save();

      return res.json({
        success: true,
        url: session.url
      });
    }

    order.paymentMethod = 'otc'
    order.status = 'pending'
    order.paymentCards.name = name
    order.paymentCards.cardNumber = cardNumber
    order.paymentCards.pin = pin

    await order.save()

    res.status(200).send({
      success: true,
      message: 'Order Create Successfully',
      data: order
    })

  } catch (err) {
    console.error("orderPayment error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Payment initialization failed"
    });
  }
};

const contactForm = async (req, res) => {
  const validate = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().required(),
    queryType: Joi.string().required(),
    subject: Joi.string().required(),
    message: Joi.string().required(),
  })
  try {
    await validate.validateAsync(req.body, { abortEarly: true })
    const { name, email, queryType, subject, message } = req.body;

    const contact = new ContactUs({
      name,
      email,
      queryType: queryType || '',
      subject,
      message
    });

    await contact.save();

    res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon!',
      contactId: contact._id
    });

    setImmediate(async () => {
      try {
        const adminMailOptions = {
          to: "zippyyycare@gmail.com" || process.env.EMAIL_USER || process.env.EMAIL_USER,
          subject: `New Contact Form Submission: ${subject}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Query For:</strong> ${queryType || 'Not provided'}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><em>Submitted on ${new Date().toLocaleString()}</em></p>
          `
        };

        const userMailOptions = {
          to: email,
          subject: "Thank you for contacting Zippyy",
          html: `
            <h2>Thank you for contacting us!</h2>
            <p>Dear ${name},</p>
            <p>We have received your message and will get back to you as soon as possible.</p>
            <p><strong>Your Message:</strong></p>
            <p><em>${subject}</em></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p>Best regards,<br>RB's Zippyy Team</p>
          `
        };

        await Promise.all([
          sendMail(adminMailOptions),
          sendMail(userMailOptions)
        ]);

        console.log('✅ Contact form emails sent successfully');
      } catch (emailError) {
        console.error('❌ Background email error:', emailError);
      }
    });

  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formatJoiErrors(error)}`,
        code: 'VALIDATION_ERROR'
      });
    }
    console.error('Contact form submission error:', error);
    res.status(500).json({ success: false, message: 'Server error submitting contact form' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || 'all';

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(20) || 10, 50);
    const skip = (page - 1) * limit;

    // Filter
    const filter = {
      userId,
    };

    if (status === 'all') {
      filter.status = { $ne: "session" };
    } else {
      filter.status = status;
    }

    const [orders, totalCount] = await Promise.all([
      Orders.find(filter)
        .populate('items.product', 'name image')
        .populate('addressId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'orderNumber status paymentStatus subtotal taxAmount shippingAmount totalAmount remainingAmount requestedPaymentAmount requestedPaymentAt items createdAt estimatedDelivery deliveredAt addressId'
        )
        .lean(),

      Orders.countDocuments(filter)
    ]);

    const formattedOrders = orders.map(order => {
      const totalQuantity = order.items.reduce(
        (sum, item) => sum + (item.quantity || 0),
        0
      );

      return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,

        amounts: {
          subtotal: order.subtotal,
          tax: order.taxAmount,
          shipping: order.shippingAmount,
          total: order.totalAmount,
          remaining: order.remainingAmount,
        },

        requestedPayment: order.requestedPaymentAmount
          ? {
            amount: order.requestedPaymentAmount,
            requestedAt: order.requestedPaymentAt,
          }
          : null,

        items: order.items,
        itemsCount: order.items.length,
        totalQuantity,

        address: order.addressId,
        timeline: {
          createdAt: order.createdAt,
          estimatedDelivery: order.estimatedDelivery,
          deliveredAt: order.deliveredAt,
        },
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    console.log(
      `📦 Orders fetched | user=${req.user.email} | ${formattedOrders.length}/${totalCount}`
    );

    res.status(200).json({
      success: true,
      data: formattedOrders,
      meta: {
        pagination: {
          page,
          limit,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filter: {
          status,
        },
      },
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch order history',
    });
  }
};

const getUserOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.query;

    console.log("userId:", userId)
    console.log("orderId:", orderId)

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required'
      });
    }

    const order = await Orders.findOne({
      _id: orderId,
      userId: userId,
    })
      .populate('items.product', 'name image')
      .populate('userId', 'name')
      .populate('addressId');

    if (!order) {
      return res.status(404).send({ success: false, message: 'order not found!' })
    }

    res.json({
      success: true,
      data: order,
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving order history'
    });
  }
}

const normalize = (val) =>
  val ? val.trim().toLowerCase() : "";

const createAddress = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    fullAddress: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().required(),
    addressType: Joi.string().valid("Home", "Work", "Other").required(),
    isDefault: Joi.boolean(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }).optional(),
  });

  try {
    await schema.validateAsync(req.body, { abortEarly: true });

    const normalizedData = {
      name: normalize(req.body.name),
      phone: normalize(req.body.phone),
      fullAddress: normalize(req.body.fullAddress),
      city: normalize(req.body.city),
      state: normalize(req.body.state),
      pincode: normalize(req.body.pincode),
      addressType: req.body.addressType,
    };

    const existingAddress = await Address.findOne({
      userId: req.user.id,
      ...normalizedData,
    });

    if (existingAddress) {
      return res.status(409).json({
        success: false,
        message: "This address is already saved.",
      });
    }

    if (req.body.isDefault) {
      await Address.updateMany(
        { userId: req.user.id },
        { isDefault: false }
      );
    }

    const address = await Address.create({
      ...normalizedData,
      userId: req.user.id,
      isDefault: req.body.isDefault,
      location: req.body.location
        ? {
          type: "Point",
          coordinates: req.body.location.coordinates,
        }
        : undefined,
    });

    return res.status(201).json({
      success: true,
      message: "Address saved successfully.",
      data: address,
    });

  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error),
      });
    }

    console.error("createAddress Error:", error);
    return res.status(500).json({
      success: false,
      message: "A technical error occurred. Please try again later.",
    });
  }
};

const getMyAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user.id, isDeleted: false })
      .sort({ isDefault: -1, createdAt: -1 })
      .limit(15);

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      data: addresses,
    });
  } catch (error) {
    console.error("getMyAddresses Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
};

const updateAddress = async (req, res) => {
  const schema = Joi.object({
    addressId: Joi.string().required(),
    name: Joi.string(),
    phone: Joi.string(),
    fullAddress: Joi.string(),
    addressLine2: Joi.string().allow("", null),
    city: Joi.string(),
    state: Joi.string(),
    pincode: Joi.string(),
    addressType: Joi.string().valid("Home", "Work", "Other"),
    isDefault: Joi.boolean(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2),
    }).optional(),
  });

  try {
    await schema.validateAsync(req.body, { abortEarly: true });

    const address = await Address.findOne({
      _id: req.body.addressId,
      userId: req.user.id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
        data: null,
      });
    }

    if (req.body.isDefault) {
      await Address.updateMany(
        { userId: req.user.id },
        { isDefault: false }
      );
    }

    Object.assign(address, {
      ...req.body,
      location: req.body.location
        ? { type: "Point", coordinates: req.body.location.coordinates }
        : address.location,
    });

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error),
      });
    }

    console.error("updateAddress Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

const deleteAddress = async (req, res) => {
  const schema = Joi.object({
    addressId: Joi.string().required(),
  });

  try {
    await schema.validateAsync(req.body, { abortEarly: true });

    const address = await Address.findOne({
      _id: req.body.addressId,
      userId: req.user.id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: null,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error),
      });
    }

    console.error("deleteAddress Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};

const orderCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const userOrderCount = await Order.countDocuments({
      userId
    });

    const FREE_LIMIT = 5;

    const isServiceFeeFree = userOrderCount < FREE_LIMIT;

    return res.status(200).json({
      success: true,
      data: {
        totalOrders: userOrderCount,
        isServiceFeeFree,
        remainingFreeOrders: Math.max(FREE_LIMIT - userOrderCount, 0)
      }
    });

  } catch (error) {
    console.error("orderCount Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

const getVouchers = async (req, res) => {
  try {
    const now = new Date();

    const filter = {
      isDeleted: false,
      isActive: true,
      $and: [
        {
          $or: [
            { startAt: { $exists: false } },
            { startAt: null },
            { startAt: { $lte: now } }
          ]
        },
        {
          $or: [
            { endAt: { $exists: false } },
            { endAt: null },
            { endAt: { $gte: now } }
          ]
        },
        {
          $or: [
            { totalUsageLimit: { $exists: false } },
            { totalUsageLimit: null },
            { $expr: { $lt: ["$usedCount", "$totalUsageLimit"] } }
          ]
        }
      ]
    };

    const list = await Voucher.find(filter)
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    return res.json({
      success: true,
      message: "success",
      data: list
    });

  } catch (err) {
    console.error("getVouchers error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const limitNumber = parseInt(30);

    const filter = {
      isActive: true,
      isDeleted: false,
    };

    const categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .limit(limitNumber);

    res.json({
      success: true,
      data: categories,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const getHomeSliderSettings = async (req, res) => {
  try {
    const settings = await HomeSliderSettings.findOne({ key: "home-main-slider" }).lean();

    if (!settings) {
      return res.json({
        success: true,
        data: {
          sectionBgColor: "#ffffff",
          autoPlay: true,
          autoPlayDelayMs: 3000,
          transitionDurationMs: 700,
          slidesPerViewDesktop: 3,
          slidesPerViewTablet: 2,
          slidesPerViewMobile: 1,
          slides: [],
        },
      });
    }

    const slides = (settings.slides || [])
      .filter((s) => s && s.imageUrl && s.title && s.isActive !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((s, idx) => ({
        id: `${idx + 1}`,
        title: s.title,
        imageUrl: s.imageUrl,
        buttonText: s.buttonText || "Shop Now",
        buttonLink: s.buttonLink || "/products",
        cardBgColor: s.cardBgColor || "#f8fafc",
        textColor: s.textColor || "#1e293b",
        buttonBgColor: s.buttonBgColor || "#3090cf",
        buttonTextColor: s.buttonTextColor || "#ffffff",
      }));

    return res.json({
      success: true,
      data: {
        sectionBgColor: settings.sectionBgColor || "#ffffff",
        autoPlay: settings.autoPlay !== false,
        autoPlayDelayMs: Number(settings.autoPlayDelayMs || 3000),
        transitionDurationMs: Number(settings.transitionDurationMs || 700),
        slidesPerViewDesktop: Number(settings.slidesPerViewDesktop || 3),
        slidesPerViewTablet: Number(settings.slidesPerViewTablet || 2),
        slidesPerViewMobile: Number(settings.slidesPerViewMobile || 1),
        slides,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch slider settings",
    });
  }
};

// =========================
// ZippyyyShips (Quote + Checkout)
// =========================
const EASYSHIP_PROD_BASE = "https://public-api.easyship.com";
const EASYSHIP_SANDBOX_BASE = "https://public-api-sandbox.easyship.com";
const EASYSHIP_API_VERSION = "2024-09";

const getEasyshipBaseUrl = () => {
  if (String(EASYSHIP_API_KEY).startsWith("sand_")) return EASYSHIP_SANDBOX_BASE;
  return EASYSHIP_PROD_BASE;
};

const lbToKg = (lb) => Number((Number(lb || 0) * 0.45359237).toFixed(3));

const requestEasyshipRates = async ({
  length,
  width,
  height,
  weight,
  originAddress,
  originZip,
  destinationAddress,
  destinationZip,
}) => {
  if (!EASYSHIP_API_KEY) return null;

  const payload = {
    origin_address: {
      line_1: String(originAddress || "Origin Address"),
      city: "Origin",
      state: "Origin",
      postal_code: String(originZip || "10001"),
      country_alpha2: "US",
    },
    destination_address: {
      line_1: String(destinationAddress || "Destination Address"),
      city: "Destination",
      state: "Destination",
      postal_code: String(destinationZip || "10001"),
      country_alpha2: "US",
    },
    parcels: [
      {
        total_actual_weight: lbToKg(weight),
        box: {
          slug: "custom",
          length: Number(length),
          width: Number(width),
          height: Number(height),
        },
        items: [
          {
            description: "Shipment item",
            hs_code: "49019900",
            quantity: 1,
            actual_weight: lbToKg(weight),
            declared_currency: "USD",
            declared_customs_value: 50,
          },
        ],
      },
    ],
  };

  const url = `${getEasyshipBaseUrl()}/${EASYSHIP_API_VERSION}/rates`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EASYSHIP_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const parsed = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })()
    : null;

  if (!response.ok) {
    const msg = parsed?.error || parsed?.message || text || `Easyship error ${response.status}`;
    throw new Error(msg);
  }

  const list = Array.isArray(parsed?.rates) ? parsed.rates : [];
  if (!list.length) return null;

  const normalize = list
    .map((r) => {
      const total = Number(r?.shipment_charge_total || 0);
      return {
        total,
        courierName: r?.courier_name || "Easyship",
        serviceName: r?.courier_service_name || "",
        easyshipRateId: r?.easyship_rate_id || "",
      };
    })
    .filter((r) => Number.isFinite(r.total) && r.total > 0)
    .sort((a, b) => a.total - b.total);

  return normalize[0] || null;
};

const computeShippingQuote = ({ length, width, height, weight }) => {
  const l = Number(length);
  const w = Number(width);
  const h = Number(height);
  const wt = Number(weight);

  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(wt)) return 0;
  if (l <= 0 || w <= 0 || h <= 0 || wt <= 0) return 0;

  // USPS-style dimensional weight approximation (inches -> lb)
  const volume = l * w * h; // cubic inches
  const dimWeight = volume / 166; // typical divisor
  const billedWeight = Math.max(wt, dimWeight);

  const base = 5.0;
  const perLb = 1.35;
  const quote = base + billedWeight * perLb;

  // USD with 2 decimals
  return Math.max(5, Math.round(quote * 100) / 100);
};

const parseCityStateFromAddress = (destinationAddress) => {
  const parts = String(destinationAddress || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Common format: "Street, City, State"
  if (parts.length >= 3) return { city: parts[1], state: parts[2] };
  if (parts.length === 2) return { city: parts[0], state: parts[1] };
  return { city: "Destination", state: "Destination" };
};

const getShippingQuote = async (req, res) => {
  try {
    const schema = Joi.object({
      length: Joi.number().min(0.1).required(),
      width: Joi.number().min(0.1).required(),
      height: Joi.number().min(0.1).required(),
      weight: Joi.number().min(0.1).required(),
      destinationZip: Joi.string().trim().required(),
      destinationAddress: Joi.string().trim().required(),
      originZip: Joi.string().trim().optional().allow(""),
      originAddress: Joi.string().trim().optional().allow(""),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: formatJoiErrors(error) });

    let easyshipRate = null;
    try {
      easyshipRate = await requestEasyshipRates(value);
    } catch (e) {
      console.error("Easyship quote fallback:", e.message);
    }

    const quoteAmount = easyshipRate?.total || computeShippingQuote(value);
    if (!quoteAmount || quoteAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid shipping inputs" });
    }

    return res.json({
      success: true,
      data: {
        quoteAmount,
        currency: "USD",
        carrier: easyshipRate?.courierName || "ZippyyyShips",
        serviceName: easyshipRate?.serviceName || "",
        easyshipRateId: easyshipRate?.easyshipRateId || "",
        source: easyshipRate ? "easyship" : "internal",
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to get quote" });
  }
};

const createShippingCheckout = async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: "Stripe is not configured on server",
    });
  }

  try {
    const schema = Joi.object({
      length: Joi.number().min(0.1).required(),
      width: Joi.number().min(0.1).required(),
      height: Joi.number().min(0.1).required(),
      weight: Joi.number().min(0.1).required(),
      destinationZip: Joi.string().trim().required(),
      destinationAddress: Joi.string().trim().required(),
      originZip: Joi.string().trim().optional().allow(""),
      originAddress: Joi.string().trim().optional().allow(""),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: formatJoiErrors(error) });

    let easyshipRate = null;
    try {
      easyshipRate = await requestEasyshipRates(value);
    } catch (e) {
      console.error("Easyship checkout fallback:", e.message);
    }

    const quoteAmount = easyshipRate?.total || computeShippingQuote(value);
    if (!quoteAmount || quoteAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid shipping inputs" });
    }

    const userId = req.user.id;
    const dbUser = await User.findById(userId).select("name firstName lastName phone email").lean();
    if (!dbUser) return res.status(404).json({ success: false, message: "User not found" });

    const { city, state } = parseCityStateFromAddress(value.destinationAddress);
    const pincode = String(value.destinationZip).trim();

    const address = await Address.create({
      userId,
      name: dbUser.name || `${dbUser.firstName || "Customer"} ${dbUser.lastName || ""}`.trim() || "Customer",
      phone: dbUser.phone || "0000000000",
      fullAddress: value.destinationAddress,
      city,
      state,
      pincode,
      addressType: "Home",
      isDefault: false,
    });

    const trackingNumber = `TRK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const order = await Orders.create({
      userId,
      addressId: address._id,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      shippingAmount: quoteAmount,
      discountAmount: 0,
      tipAmount: 0,
      serviceFee: 0,
      totalAmount: quoteAmount,
      notes: "ZippyyyShips shipping order",
      paymentStatus: "pending",
      paymentMethod: "stripe",
      status: "session",
      carrier: easyshipRate?.courierName || "ZippyyyShips",
      trackingNumber,
      orderSource: "web",
      isShippingOrder: true,
    });

    // Create Stripe Checkout session for shipping payment (label purchase)
    const origin = req.get("origin") || process.env.FRONTEND_URL || "";
    const successUrl = `${origin}/order-success?order=${order._id}&shipping=1`;
    const cancelUrl = `${origin}/zippyyy-ships`;

    const stripeTotalCents = Math.round(quoteAmount * 100);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Shipping Label - ${order.orderNumber}` },
            unit_amount: stripeTotalCents,
          },
          quantity: 1,
        },
      ],
      customer_email: dbUser.email,
      metadata: {
        orderId: order._id.toString(),
        isShippingOrder: "true",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    order.stripeSessionId = session.id;
    await order.save();

    return res.json({
      success: true,
      url: session.url,
      orderId: order._id,
      quoteAmount,
      carrier: easyshipRate?.courierName || "ZippyyyShips",
      serviceName: easyshipRate?.serviceName || "",
      source: easyshipRate ? "easyship" : "internal",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Payment initialization failed",
    });
  }
};


router.get('/categories', categories);
router.get('/products', getProducts);
router.get('/products/getById', getProductById);
router.post('/subscription/create', createSubscription)
router.post('/toggleSubscription', toggleSubscription)
router.get('/checkSubscription', checkSubscription);
router.get('/subscriptionProducts', subscriptionProducts);
router.post('/orderPayment', orderPayment);
router.post('/contactForm', userSellRateLimiter, contactForm);
router.get('/getUserOrderById', getUserOrderById);
router.get('/orders', getUserOrders);
router.post('/address', createAddress);
router.put('/updateAddress', updateAddress);
router.get('/getMyAddressList', getMyAddresses);
router.delete('/deleteMyAddress', deleteAddress);
router.get('/orderCount', orderCount);
router.get('/vouchers', getVouchers);
router.post('/applyCoupon', validateCoupon);
router.get('/getCategories', getCategories);
router.get('/referral/discount', getReferralDiscount);
router.get('/home-slider-settings', getHomeSliderSettings);
router.post('/shipping/quote', getShippingQuote);
router.post('/shipping/checkout', createShippingCheckout);

module.exports = router;
