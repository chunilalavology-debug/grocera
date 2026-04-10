const express = require("express");
const router = express.Router();
const Joi = require("joi");
const {
  Products,
  Subscription,
  Voucher,
  ContactUs,
  Orders,
  User,
  HomeSliderSettings,
  AppSettings,
  ComingSoonSubscriber,
} = require("../../db");
const Stripe = require("stripe");
const { sendTransactionalEmailIfEnabled } = require("../../utils/emailService");
const userSellRateLimiter = require("../middlewares/rateLimit");
const Product = require("../../db/models/Product");
const Address = require("../../db/models/Address");
const Order = require("../../db/models/Order");
const redisClient = require("../services/serviceRedis-cli");
const { setKeyWithTime, getKey } = require("../services/serviceRedis");
const { default: mongoose } = require("mongoose");
const {
  resolveOrderLineUnitPrice,
  computeVoucherDiscountAmount,
  validateVoucherForSubtotal,
} = require("../../utils/orderCheckoutPricing");
const { recordVoucherRedemptionOnce } = require("../../utils/voucherRedemption");
const Category = require("../../db/models/categories");
const {
  escapeRegex,
  buildProductCategoryMaps,
  productCountForCategoryName,
  categoryStringFromDoc,
  firstProductImageByCategoryKey,
  firstProductImageByExactCategoryNames,
  normCategoryKey,
  pickProductImage,
  PRODUCT_NOT_DELETED,
} = require("../../utils/categoryCounts");
const { isCategoryActiveInDatabase } = require("../../utils/categoryActivity");
const { getValuesForMain, inferMainForCategoryName } = require("../../utils/storefrontCategoryMeta");
const {
  normalizeProductForStorefrontList,
  applyDealIdToPricing,
  normalizeBadge,
} = require("../../utils/storefrontProductPrice");
const { connectDB } = require("../../lib/db");
const jwt = require("jsonwebtoken");
const getPublicSiteSettings = require("../publicSiteSettings");
const {
  getSiteBrandingLogo,
  getSiteBrandingFavicon,
  getSiteBrandingHeroBanner,
} = require("../siteBrandingPublicImages");
const { coerceHomeSliderSlides } = require("../../utils/homeSliderSlides");
const {
  extractEasyshipRatesArray,
  easyshipRowChargeTotalUSD,
} = require("../../utils/easyshipRatesParse");
const { generateNextOrderId } = require("../../utils/orderIdGenerator");
const logger = require("../middlewares/logger");

function orderViewJwtSecret() {
  const isProd = process.env.NODE_ENV === "production";
  return process.env.JWT_SECRET_KEY || (!isProd ? "fallback-secret-key" : null);
}

function signOrderViewToken(orderId) {
  const secret = orderViewJwtSecret();
  if (!secret) return null;
  return jwt.sign(
    { oid: String(orderId), typ: "order_view" },
    secret,
    { expiresIn: "48h" }
  );
}

const FEATURED_MAIN_IDS = ["indian", "american", "chinese", "turkish"];
const CATEGORY_STOREFRONT_QUERY = { isDeleted: { $ne: true }, isDisable: { $ne: true } };

function escapeRegexForSearch(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compressRepeatedChars(input) {
  return String(input || "").replace(/(.)\1+/g, "$1");
}

function oneCharDeletionVariants(input) {
  const s = String(input || "");
  const out = [];
  if (s.length < 4) return out;
  for (let i = 0; i < s.length; i += 1) {
    const v = `${s.slice(0, i)}${s.slice(i + 1)}`;
    if (v.length >= 3) out.push(v);
  }
  return [...new Set(out)];
}

/** Same region filter as admin GET /admin/getCategories?main=… (Categories dashboard table). */
function adminDashboardMainTabMongoFilter(main) {
  const storefrontNames = getValuesForMain(main);
  return {
    isDeleted: false,
    $or: [
      { main: main },
      ...(storefrontNames.length ? [{ name: { $in: storefrontNames } }] : []),
    ],
  };
}

function categoryMatchesFeaturedTabStrict(c, main, nameKeySet) {
  const rawMain =
    c.main != null && String(c.main).trim() !== "" ? String(c.main).toLowerCase().trim() : "";
  const validMain = FEATURED_MAIN_IDS.includes(rawMain) ? rawMain : null;

  if (validMain) {
    return validMain === main;
  }

  const nk = normCategoryKey(c.name);
  if (nameKeySet.has(nk)) return true;
  return inferMainForCategoryName(c.name) === main;
}

/** When strict matching yields nothing, align with admin “effective main” + canonical names for this tab. */
function categoryMatchesFeaturedTabRelaxed(c, main, nameKeySet) {
  const rawMain =
    c.main != null && String(c.main).trim() !== "" ? String(c.main).toLowerCase().trim() : "";
  const dbMain = FEATURED_MAIN_IDS.includes(rawMain) ? rawMain : null;
  const inferred = inferMainForCategoryName(c.name);
  const effectiveMain = dbMain || inferred;
  if (effectiveMain === main) return true;
  if (!dbMain && nameKeySet.has(normCategoryKey(c.name))) return true;
  return false;
}

let _stripeClient = null;
let _stripeInitAttempted = false;
function getStripe() {
  if (_stripeInitAttempted) return _stripeClient;
  _stripeInitAttempted = true;
  const k = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!k) return null;
  try {
    _stripeClient = new Stripe(k);
  } catch (e) {
    console.error("Stripe initialization failed:", e.message);
    _stripeClient = null;
  }
  return _stripeClient;
}
const EASYSHIP_API_KEY = process.env.EASYSHIP_API_KEY || "";

/** Browsers / proxies must not cache mutable storefront JSON (avoids stale categories after admin changes). */
function setCatalogNoCacheHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
}

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
  const voucher = await Voucher.findOne({
    code: new RegExp(`^${escapeRegex(String(code || "").trim())}$`, "i"),
    isDeleted: { $ne: true },
  });

  const baseErr = validateVoucherForSubtotal(voucher, cartTotal);
  if (baseErr) throw baseErr;

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
    !productIds.some((id) =>
      voucher.productIds.map((p) => p.toString()).includes(id.toString()),
    )
  ) {
    throw "Voucher not applicable on selected products";
  }

  const discount = computeVoucherDiscountAmount(voucher, cartTotal);

  return {
    voucherId: voucher._id,
    discount: +discount.toFixed(2),
  };
};

const getProducts = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      setCatalogNoCacheHeaders(res);
      return res.status(503).json({
        success: false,
        message:
          "Database not connected. Start MongoDB or fix DB_STRING in backend/.env, then restart the API.",
        data: [],
        totalCount: 0,
        nextCursor: null,
        hasNextPage: false,
      });
    }

    const {
      category = "All",
      search,
      minPrice,
      maxPrice,
      limit = 12,
      cursor,
      hotDealsOnly,
    } = req.query;

    const hotDeals =
      String(hotDealsOnly || "").toLowerCase() === "true" ||
      req.query.deals === "1";

    const limitParsed = parseInt(limit, 10) || 12;
    const limitNum = hotDeals
      ? Math.min(Math.max(limitParsed, 1), 5000)
      : Math.min(limitParsed, 50);

    const filter = {
      inStock: true,
      quantity: { $gt: 0 },
      isDisable: { $ne: true },
      ...PRODUCT_NOT_DELETED,
    };

    if (hotDeals) {
      filter.isDeal = true;
    }

    if (category !== "All") {
      filter.category = category;
    }

    // if (search) {
    //   filter.$text = { $search: search };
    // }

    const searchTrim = search != null ? String(search).trim() : "";
    if (searchTrim) {
      const direct = new RegExp(escapeRegexForSearch(searchTrim), "i");
      const compressed = compressRepeatedChars(searchTrim);
      const fuzzyPattern = compressed
        .split("")
        .map((ch) => escapeRegexForSearch(ch))
        .join(".*");
      const fuzzy = fuzzyPattern ? new RegExp(fuzzyPattern, "i") : null;
      const words = searchTrim.split(/\s+/).map((w) => w.trim()).filter(Boolean);
      const wordRegexes = words.map((w) => new RegExp(escapeRegexForSearch(w), "i"));
      const typoRegexes = oneCharDeletionVariants(searchTrim).map(
        (w) => new RegExp(escapeRegexForSearch(w), "i"),
      );

      const or = [
        { name: direct },
        { category: direct },
        { tags: direct },
      ];

      if (fuzzy) {
        or.push({ name: fuzzy });
        or.push({ category: fuzzy });
        or.push({ tags: fuzzy });
      }

      for (const wr of wordRegexes) {
        or.push({ name: wr });
        or.push({ category: wr });
        or.push({ tags: wr });
      }

      for (const tr of typoRegexes) {
        or.push({ name: tr });
        or.push({ category: tr });
        or.push({ tags: tr });
      }

      const priceToken = words.find((w) => /^(\d+(\.\d+)?)$/.test(w));
      if (priceToken) {
        const p = Number(priceToken);
        if (Number.isFinite(p) && p >= 0) {
          const delta = Math.max(0.5, p * 0.05);
          or.push({ price: { $gte: p - delta, $lte: p + delta } });
          or.push({ salePrice: { $gte: p - delta, $lte: p + delta } });
          or.push({ dealPrice: { $gte: p - delta, $lte: p + delta } });
        }
      }

      filter.$or = or;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const isFirstPage =
      !cursor && !search && !minPrice && !maxPrice && !hotDeals;
    const cacheKey = `products:${category}:v3-storefront`;
    /** Without REDIS_URL, catalog cache is off. REDIS_DISABLED=1 skips Redis entirely (no ECONNREFUSED on VPS). */
    const redisOff = ["1", "true", "yes"].includes(
      String(process.env.REDIS_DISABLED || process.env.SKIP_REDIS || "").trim().toLowerCase(),
    );
    const useRedisCatalogCache =
      Boolean(process.env.REDIS_URL && String(process.env.REDIS_URL).trim()) && !redisOff;

    if (isFirstPage && useRedisCatalogCache) {
      const cachedData = await Promise.race([
        getKey(cacheKey),
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: null }), 500)
        ),
      ]);
      if (cachedData.data) {
        try {
          const parsed = JSON.parse(cachedData.data);
          const list = parsed?.data;
          if (Array.isArray(list) && list.length === 0) {
            /* skip stale empty cache (e.g. DB was seeded after cache) */
          } else {
            setCatalogNoCacheHeaders(res);
            return res.json(parsed);
          }
        } catch (_) {
          /* ignore bad cache */
        }
      }
    }

    let total = null;
    /** All non-deleted SKUs for this category string (any stock). Featured strip / admin totals. */
    let totalCountAll = null;

    if (!cursor) {
      total = await Products.countDocuments(filter);
      if (category && category !== "All" && String(category).trim() !== "") {
        totalCountAll = await Products.countDocuments({
          ...PRODUCT_NOT_DELETED,
          category: String(category).trim(),
          quantity: { $gt: 0 },
          inStock: true,
        });
      }
    }


    const products = await Products.find(filter)
      .sort({ _id: -1 })
      .limit(limitNum)
      .select(
        "name price comparePrice salePrice dealPrice image category inStock quantity unit badge isDeal tags createdAt"
      )
      .lean();

    const normalizedProducts = products.map((p) =>
      normalizeProductForStorefrontList(p)
    );

    const response = {
      success: true,
      data: normalizedProducts,
      totalCount: total,
      totalCountAll: totalCountAll !== null ? totalCountAll : total,
      nextCursor: products.length
        ? products[products.length - 1]._id
        : null,
      hasNextPage: products.length === limitNum,
    };

    if (
      isFirstPage &&
      useRedisCatalogCache &&
      normalizedProducts.length > 0
    ) {
      await setKeyWithTime(cacheKey, JSON.stringify(response), 1);
    }

    setCatalogNoCacheHeaders(res);
    return res.json(response);

  } catch (error) {
    console.error("Get products error:", error);
    setCatalogNoCacheHeaders(res);
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

    if (product.isDeleted === true) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.isDisable === true) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const qty = Number(product.quantity || 0);
    if (qty <= 0 || product.inStock === false) {
      return res.status(404).json({
        success: false,
        message: 'Product is unavailable',
      });
    }

    const deal = product.dealId;
    const pricing = applyDealIdToPricing(product, deal);
    const { dealId: _dealPop, ...productRest } = product;

    res.json({
      success: true,
      data: {
        ...productRest,
        dealId: deal || null,
        price: pricing.finalPrice,
        badge: normalizeBadge(product),
        hasDeal: pricing.hasDeal,
        originalPrice: pricing.originalPrice,
        compareAtPrice: pricing.compareAtPrice,
        finalPrice: pricing.finalPrice,
        discountAmount: pricing.discountAmount,
        discountPercentage: pricing.discountPercentage,
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
    const raw = await Products.distinct("category");
    const names = (raw || []).map((c) => categoryStringFromDoc(c)).filter(Boolean);
    const inactiveRows = await Category.collection
      .find(CATEGORY_STOREFRONT_QUERY)
      .project({ name: 1, isActive: 1, isDisable: 1, isDeleted: 1 })
      .toArray();
    const inactiveKeys = new Set();
    for (const c of inactiveRows) {
      if (!isCategoryActiveInDatabase(c)) {
        inactiveKeys.add(normCategoryKey(c.name));
      }
    }
    const filtered = names.filter((n) => !inactiveKeys.has(normCategoryKey(n)));
    res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
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
      code: new RegExp(`^${escapeRegex(String(code).trim())}$`, "i"),
      isDeleted: { $ne: true },
    });

    const vErr = validateVoucherForSubtotal(coupon, subtotal);
    if (vErr) {
      return res.status(400).json({
        success: false,
        message: vErr,
      });
    }

    const discountAmount = computeVoucherDiscountAmount(coupon, subtotal);

    return res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
      },
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
  const nameRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
  const cityRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
  const phoneRegex = /^\d{1,20}$/;
  const zipRegex = /^\d{3,12}$/;
  const guestAddressSchema = Joi.object({
    name: Joi.string().trim().pattern(nameRegex).required(),
    phone: Joi.string().trim().pattern(phoneRegex).required(),
    email: Joi.string().trim().email().required(),
    fullAddress: Joi.string().trim().required(),
    city: Joi.string().trim().pattern(cityRegex).required(),
    state: Joi.string().trim().allow("", null).optional(),
    pincode: Joi.string().trim().pattern(zipRegex).required(),
    addressType: Joi.string().valid("Home", "Work", "Other").optional(),
  });

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

    addressId: Joi.string().optional().allow(null, ""),
    address: guestAddressSchema.optional(),

    tip: Joi.number().min(0).default(0),
    driverNote: Joi.string().allow(null, ""),
    couponCode: Joi.string().trim().allow(null, ""),

    paymentMethod: Joi.string()
      .valid("stripe", 'card', "otc", "split", "upi")
      .default("stripe"),

    cardNumber: Joi.when("paymentMethod", {
      is: Joi.valid("otc", "split"),
      then: Joi.string()
        .pattern(/^\d+$/)
        .required(),
      otherwise: Joi.forbidden()
    }),

    pin: Joi.when("paymentMethod", {
      is: Joi.valid("otc", "split"),
      then: Joi.string()
        .pattern(/^[0-9]{3,12}$/)
        .required(),
      otherwise: Joi.forbidden()
    }),

    name: Joi.when("paymentMethod", {
      is: Joi.valid("otc", "split"),
      then: Joi.string().trim().pattern(nameRegex).min(3).required(),
      otherwise: Joi.optional()
    }),
    splitCardAmount: Joi.when("paymentMethod", {
      is: "split",
      then: Joi.number().greater(0).required(),
      otherwise: Joi.forbidden(),
    }),
    splitOtcAmount: Joi.when("paymentMethod", {
      is: "split",
      then: Joi.number().greater(0).required(),
      otherwise: Joi.forbidden(),
    }),

    /** Sent by storefront for display / future use; pricing is recalculated server-side. */
    deliveryType: Joi.string().valid("standard", "express").optional(),
    /** Required for guests; for signed-in users falls back to account email when omitted. */
    customerEmail: Joi.string().trim().email().allow("", null).optional(),
    subtotal: Joi.number().optional(),
    deliveryFee: Joi.number().optional(),
    taxAndConvenienceFee: Joi.number().optional(),
    packagingFee: Joi.number().optional(),
    discountAmount: Joi.number().optional(),
    finalTotal: Joi.number().optional(),
  }).unknown(true);
  try {
    const { error, value } = checkoutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error)
      });
    }

    const userId = req.user?.id ? String(req.user.id) : null;
    const isGuestCheckout = !userId;

    if (isGuestCheckout && !value.address) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required for guest checkout.",
      });
    }
    if (!isGuestCheckout && !value.addressId) {
      return res.status(400).json({
        success: false,
        message: "Please select a saved address or add one.",
      });
    }
    if (!isGuestCheckout && value.address) {
      return res.status(400).json({
        success: false,
        message: "Use addressId when signed in, not a raw address object.",
      });
    }

    const {
      items,
      addressId,
      address: guestAddressPayload,
      tip = 0,
      couponCode,
      paymentMethod = 'card',
      driverNote,
      cardNumber, pin, name,
      splitCardAmount = 0,
      splitOtcAmount = 0,
    } = value;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "No items provided" });
    }

    let customerEmail = String(value.customerEmail || "").trim().toLowerCase();
    if (isGuestCheckout) {
      const guestEm =
        guestAddressPayload && String(guestAddressPayload.email || "").trim().toLowerCase();
      if (guestEm) customerEmail = guestEm;
      if (!customerEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is required for order confirmation and updates.",
        });
      }
    } else {
      if (!customerEmail) {
        const u = await User.findById(userId).select("email").lean();
        customerEmail = u && u.email ? String(u.email).trim().toLowerCase() : "";
      }
      if (!customerEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is required. Update your account email or enter it at checkout.",
        });
      }
    }

    const productIds = items.map(i => i.product);

    await connectDB();

    const products = await Product.find({
      _id: { $in: productIds },
      isDeleted: { $ne: true },
    })
      .populate("dealId")
      .lean();

    let stripeSubtotal = 0;
    let dbSubtotal = 0;
    let discountAmount = 0;
    let serviceFee = 5
    const TAX_RATE = 0.08875;
    let couponSnapshot = null;
    const pricingNow = new Date();

    const orderItems = items.map(item => {
      const product = products.find(
        p => p._id.toString() === item.product
      );

      if (!product) throw new Error("Product not found");

      const unitPrice = resolveOrderLineUnitPrice(product, pricingNow);
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

    const codeTrim = couponCode != null ? String(couponCode).trim() : "";
    if (codeTrim) {
      const coupon = await Voucher.findOne({
        code: new RegExp(`^${escapeRegex(codeTrim)}$`, "i"),
        isDeleted: { $ne: true },
      }).lean();

      const vMsg = validateVoucherForSubtotal(coupon, dbSubtotal, pricingNow);
      if (vMsg) {
        return res.status(400).json({
          success: false,
          message: vMsg,
        });
      }

      discountAmount = computeVoucherDiscountAmount(coupon, dbSubtotal);
      couponSnapshot = {
        couponId: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
      };
    }

    // Apply referral discount only for signed-in users (not guest checkout)
    if (!codeTrim && userId) {
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

    const clientDiscRaw = value.discountAmount;
    if (clientDiscRaw != null && clientDiscRaw !== "") {
      const cd = Number(clientDiscRaw);
      if (Number.isFinite(cd) && Math.abs(cd - discountAmount) > 0.02) {
        return res.status(400).json({
          success: false,
          message:
            "Discount no longer matches the current cart. Refresh checkout and try again.",
        });
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

    const stripeAmountCents =
      paymentMethod === "split" ? toCents(Number(splitCardAmount || 0)) : stripeTotal;
    const otcAmountDollars =
      paymentMethod === "split" ? +Number(splitOtcAmount || 0).toFixed(2) : 0;
    if (paymentMethod === "split") {
      const dbTotalCandidate = toDollars(stripeTotal);
      const recomputedOtc = +(dbTotalCandidate - toDollars(stripeAmountCents)).toFixed(2);
      if (recomputedOtc <= 0 || Math.abs(recomputedOtc - otcAmountDollars) > 0.01) {
        return res.status(400).json({
          success: false,
          message: "Split amount mismatch. Please review card and OTC amounts.",
        });
      }
    }

    /** Stripe minimum charge (USD cents). Avoid session creation errors. */
    if (
      (paymentMethod === "card" || paymentMethod === "stripe" || paymentMethod === "split") &&
      stripeAmountCents < 50
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Order total is below the minimum payment amount ($0.50). Adjust your cart, tip, or discount.",
      });
    }

    const dbTotal = toDollars(stripeTotal);

    const guestShippingDoc = isGuestCheckout && guestAddressPayload
      ? {
          name: guestAddressPayload.name,
          phone: guestAddressPayload.phone,
          email: customerEmail,
          fullAddress: guestAddressPayload.fullAddress,
          city: guestAddressPayload.city,
          state: guestAddressPayload.state || "",
          pincode: guestAddressPayload.pincode,
          addressType: guestAddressPayload.addressType || "Home",
        }
      : undefined;

    const brandedOrderId = await generateNextOrderId();
    const order = await Orders.create({
      orderId: brandedOrderId,
      orderNumber: brandedOrderId,
      userId: userId || null,
      customerEmail,
      items: orderItems,
      subtotal: dbSubtotal,
      taxAmount: dbTax,
      shippingAmount: dbShipping,
      tipAmount: dbTip,
      serviceFee,
      totalAmount: dbTotal,
      notes: driverNote,
      addressId: isGuestCheckout ? null : addressId,
      guestShipping: guestShippingDoc,
      coupon: couponSnapshot,
      paymentMethod,
      stripeAmount: paymentMethod === "split" ? toDollars(stripeAmountCents) : dbTotal,
      otcAmount: paymentMethod === "split" ? otcAmountDollars : 0,
      paymentStatus: "pending",
      status: "session"
    });

    const orderViewToken = signOrderViewToken(order._id);
    const successUrlBase = `${process.env.FRONTEND_URL}/order-success?order=${order._id}`;
    const successUrlWithToken =
      orderViewToken != null
        ? `${successUrlBase}&t=${encodeURIComponent(orderViewToken)}`
        : successUrlBase;

    const useStripeCheckout =
      paymentMethod === "card" ||
      paymentMethod === "stripe" ||
      paymentMethod === "upi" ||
      paymentMethod === "split";

    if (useStripeCheckout) {
      const stripe = getStripe();
      if (!stripe) {
        await Orders.findByIdAndDelete(order._id);
        return res.status(503).json({
          success: false,
          message: "Card payments are not configured. Use OTC or try again later.",
        });
      }
      const session = await stripe.checkout.sessions.create({
        mode: "payment",

        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Order ${order.orderNumber}`
              },
              unit_amount: stripeAmountCents
            },
            quantity: 1
          }
        ],

        customer_email: customerEmail || undefined,

        metadata: {
          orderId: order._id.toString(),
          paymentMethod,
        },

        payment_intent_data: {
          metadata: {
            orderId: order._id.toString(),
            paymentMethod,
          }
        },

        success_url: successUrlWithToken,
        cancel_url: `${process.env.FRONTEND_URL}/checkout`
      });

      order.stripeSessionId = session.id;
      if (paymentMethod === "split") {
        order.paymentCards.name = name;
        order.paymentCards.cardNumber = cardNumber;
        order.paymentCards.pin = pin;
      }
      await order.save();

      return res.json({
        success: true,
        url: session.url
      });
    }

    order.paymentMethod = "otc";
    order.status = "pending";
    order.paymentStatus = "paid";
    order.stripeAmount = 0;
    order.otcAmount = dbTotal;
    order.paidAt = new Date();
    order.paymentCards.name = name;
    order.paymentCards.cardNumber = cardNumber;
    order.paymentCards.pin = pin;

    await order.save();

    try {
      await recordVoucherRedemptionOnce(order._id);
    } catch (vrErr) {
      console.error("OTC recordVoucherRedemptionOnce:", vrErr?.message || vrErr);
    }

    setImmediate(() => {
      try {
        const { sendNewOrderEmails } = require("../../utils/orderEmails");
        sendNewOrderEmails(order._id).catch((e) => console.error("OTC sendNewOrderEmails:", e?.message || e));
      } catch (e) {
        console.error("OTC sendNewOrderEmails require:", e);
      }
    });

    return res.status(200).json({
      success: true,
      message: "Order Create Successfully",
      data: order,
      viewToken: orderViewToken,
    });

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
    name: Joi.string().trim().min(1).max(200).required(),
    email: Joi.string().trim().email().required(),
    phone: Joi.string().trim().allow('', null).max(40),
    queryType: Joi.string().trim().allow('', null),
    subject: Joi.string().trim().min(1).max(300).required(),
    message: Joi.string().trim().min(1).max(20000).required(),
  });
  try {
    await validate.validateAsync(req.body, { abortEarly: true });
    const { name, email, queryType, subject, message, phone } = req.body;

    const {
      resolveContactAutoReplyMessage,
      buildContactAutoAcknowledgmentHtml,
      escapeHtml,
    } = require("../../utils/contactAutoAcknowledgment");

    let replyTplTrim = "";
    try {
      const sdoc = await AppSettings.findOne().lean();
      replyTplTrim =
        sdoc?.contactAutoReplyMessage != null ? String(sdoc.contactAutoReplyMessage).trim() : "";
    } catch {
      /* ignore */
    }
    const autoAcknowledgment = resolveContactAutoReplyMessage(replyTplTrim || null, name);

    const contact = new ContactUs({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone != null && String(phone).trim() ? String(phone).trim() : '',
      queryType: queryType != null && String(queryType).trim() ? String(queryType).trim() : 'general',
      subject: String(subject).trim(),
      message: String(message).trim(),
      autoAcknowledgment,
    });

    await contact.save();

    res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon!',
      contactId: contact._id
    });

    setImmediate(async () => {
      try {
        let contactInboxEmail =
          (process.env.CONTACT_FORM_TO_EMAIL && String(process.env.CONTACT_FORM_TO_EMAIL).trim()) ||
          'contact@zippyyy.com';
        try {
          const settings = await AppSettings.findOne().lean();
          const primary = settings && String(settings.contactFormToEmailPrimary || '').trim();
          const secondary = settings && String(settings.contactFormToEmailSecondary || '').trim();
          const parts = [primary, secondary].filter(Boolean);
          if (parts.length) {
            contactInboxEmail = parts.join(',');
          }
        } catch {
          /* use env / default */
        }

        const contactFormAdminHtml = require("../../utils/template/contactFormAdmin");
        const { renderTemplateKey, buildContactTemplateVars } = require("../../utils/emailTemplateService");
        const cvars = buildContactTemplateVars({
          name,
          email,
          queryType,
          subject,
          message,
        });
        let adminSubject = `New contact: ${subject}`;
        let adminHtml = contactFormAdminHtml({
          name,
          email,
          queryType: queryType || "—",
          subject,
          message,
        });
        try {
          const rendered = await renderTemplateKey("contact_form_admin", cvars);
          if (rendered && rendered.html) {
            adminSubject = rendered.subject || adminSubject;
            adminHtml = rendered.html;
          }
        } catch (e) {
          console.error("contact_form_admin template:", e.message);
        }

        const ackHtml = buildContactAutoAcknowledgmentHtml(name, replyTplTrim || null);
        let userSubject = "Thank you for contacting Zippyyy";
        let userHtml = `
            <div style="font-family: system-ui, sans-serif; max-width: 560px; line-height: 1.5; color: #1e293b;">
              ${ackHtml}
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;"><strong>Your message (for your records)</strong></p>
              <p style="margin: 0 0 4px;"><em>${escapeHtml(subject)}</em></p>
              <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
            </div>
          `;
        try {
          const custRendered = await renderTemplateKey("contact_customer_ack", cvars);
          if (custRendered && custRendered.html) {
            userSubject = custRendered.subject || userSubject;
            userHtml = `${custRendered.html}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Your message (for your records)</strong></p>
              <p style="margin:0 0 4px;"><em>${escapeHtml(subject)}</em></p>
              <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>`;
          }
        } catch (e) {
          console.error("contact_customer_ack template:", e?.message || e);
        }

        await Promise.all([
          sendTransactionalEmailIfEnabled({
            emailType: "contactFormAdmin",
            to: contactInboxEmail,
            subject: adminSubject,
            html: adminHtml,
          }),
          sendTransactionalEmailIfEnabled({
            emailType: "contactFormCustomerAck",
            to: email,
            subject: userSubject,
            html: userHtml,
          }),
        ]);

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

const postComingSoonSubscribe = async (req, res) => {
  try {
    const schema = Joi.object({
      email: Joi.string().trim().email().max(320).required(),
      source: Joi.string().trim().valid("site_wide", "zippy_ships").optional(),
    });
    const body = await schema.validateAsync(req.body || {}, { abortEarly: true });
    const settings = await AppSettings.findOne().select("comingSoon.subscriptionEnabled").lean();
    if (settings?.comingSoon?.subscriptionEnabled === false) {
      return res.status(403).json({ success: false, message: "Email signup is disabled." });
    }
    const emailNorm = String(body.email).trim().toLowerCase();
    const source = body.source === "zippy_ships" ? "zippy_ships" : "site_wide";
    await ComingSoonSubscriber.findOneAndUpdate(
      { email: emailNorm, source },
      { $setOnInsert: { email: emailNorm, source } },
      { upsert: true, new: true },
    );
    return res.json({
      success: true,
      message: "Thanks — we will notify you when we launch.",
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error && error.code === 11000) {
      return res.json({
        success: true,
        message: "You are already on the list.",
      });
    }
    console.error("postComingSoonSubscribe error:", error);
    return res.status(500).json({ success: false, message: "Could not save your email." });
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

/** Public read for order-success page when user has no session (guest / OTC). Token from checkout response or Stripe success_url. */
const getOrderByViewToken = async (req, res) => {
  try {
    const raw = req.query.token;
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return res.status(400).json({ success: false, message: "token is required" });
    }
    const secret = orderViewJwtSecret();
    if (!secret) {
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }
    let decoded;
    try {
      decoded = jwt.verify(raw.trim(), secret);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired confirmation link. Sign in and open Orders to see your order.",
      });
    }
    if (decoded.typ !== "order_view" || !decoded.oid) {
      return res.status(400).json({ success: false, message: "Invalid token" });
    }

    await connectDB();
    const order = await Orders.findById(decoded.oid)
      .populate("items.product", "name image")
      .populate("userId", "name")
      .populate("addressId");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    console.error("getOrderByViewToken error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error loading order",
    });
  }
};

const getUserOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.query;

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
  const fullNameRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
  const cityRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
  const phoneRegex = /^\d{1,20}$/;
  const zipRegex = /^\d{3,12}$/;
  const schema = Joi.object({
    name: Joi.string().trim().pattern(fullNameRegex).required(),
    phone: Joi.string().trim().pattern(phoneRegex).required(),
    fullAddress: Joi.string().required(),
    city: Joi.string().trim().pattern(cityRegex).required(),
    state: Joi.string().required(),
    pincode: Joi.string().trim().pattern(zipRegex).required(),
    addressType: Joi.string().valid("Home", "Work", "Other").required(),
    isDefault: Joi.boolean(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }).optional(),
  });

  try {
    await schema.validateAsync(req.body, { abortEarly: true });

    const normalizedData = {
      name: String(req.body.name || "").trim(),
      phone: String(req.body.phone || "").replace(/\D/g, ""),
      fullAddress: normalize(req.body.fullAddress),
      city: normalize(req.body.city),
      state: normalize(req.body.state),
      pincode: String(req.body.pincode || "").replace(/\D/g, ""),
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
  const fullNameRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
  const cityRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
  const phoneRegex = /^\d{1,20}$/;
  const zipRegex = /^\d{3,12}$/;
  const schema = Joi.object({
    addressId: Joi.string().required(),
    name: Joi.string().trim().pattern(fullNameRegex),
    phone: Joi.string().trim().pattern(phoneRegex),
    fullAddress: Joi.string(),
    addressLine2: Joi.string().allow("", null),
    city: Joi.string().trim().pattern(cityRegex),
    state: Joi.string(),
    pincode: Joi.string().trim().pattern(zipRegex),
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

    const updatePayload = {
      ...req.body,
      name: req.body.name != null ? String(req.body.name).trim() : address.name,
      phone: req.body.phone != null ? String(req.body.phone).replace(/\D/g, "") : address.phone,
      pincode: req.body.pincode != null ? String(req.body.pincode).replace(/\D/g, "") : address.pincode,
      location: req.body.location
        ? { type: "Point", coordinates: req.body.location.coordinates }
        : address.location,
    };
    Object.assign(address, updatePayload);

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

    await Address.deleteOne({ _id: address._id, userId: req.user.id });

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
    /** Match admin “All” list: not deleted, same sort as dashboard (Sort column, then name). */
    const raw = await Category.collection
      .find({ isDeleted: false })
      .sort({ sortOrder: 1, name: 1 })
      .limit(120)
      .toArray();

    const categories = raw.filter(isCategoryActiveInDatabase);

    setCatalogNoCacheHeaders(res);
    return res.json({
      success: true,
      data: categories,
    });

  } catch (err) {
    setCatalogNoCacheHeaders(res);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const getFeaturedCategories = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      setCatalogNoCacheHeaders(res);
      return res.status(503).json({
        success: false,
        message: "Database temporarily unavailable. Retry in a moment.",
      });
    }

    const main = String(req.query.main || "indian").toLowerCase();
    if (!FEATURED_MAIN_IDS.includes(main)) {
      return res.status(400).json({
        success: false,
        message: "Invalid main filter",
      });
    }

    /**
     * Primary path: same Mongo filter + sort as admin Categories page for this region tab.
     * Fallback: broad read + JS tab rules, then product-derived names (legacy DB).
     */
    const storefrontNames = getValuesForMain(main);
    const nameKeySet = new Set(storefrontNames.map((n) => normCategoryKey(n)));

    let rawDocs = await Category.collection
      .find(adminDashboardMainTabMongoFilter(main))
      .sort({ sortOrder: 1, name: 1 })
      .limit(200)
      .toArray();

    let list = rawDocs.filter(isCategoryActiveInDatabase);

    if (list.length === 0) {
      rawDocs = await Category.collection
        .find(CATEGORY_STOREFRONT_QUERY)
        .sort({ sortOrder: 1, name: 1 })
        .limit(200)
        .toArray();
      const active = rawDocs.filter(isCategoryActiveInDatabase);
      list = active.filter((c) => categoryMatchesFeaturedTabStrict(c, main, nameKeySet));
      if (list.length === 0) {
        list = active.filter((c) => categoryMatchesFeaturedTabRelaxed(c, main, nameKeySet));
      }
    }

    /** Product.category fallback when no Category rows match this tab (legacy DB or missing Category docs). */
    if (list.length === 0) {
      try {
        const inactiveRows = await Category.collection
          .find(CATEGORY_STOREFRONT_QUERY)
          .project({ name: 1, isActive: 1, isDisable: 1, isDeleted: 1 })
          .toArray();
        const inactiveNameKeys = new Set();
        for (const c of inactiveRows) {
          if (!isCategoryActiveInDatabase(c)) {
            inactiveNameKeys.add(normCategoryKey(c.name));
          }
        }

        const agg = await Products.aggregate([
          {
            $match: {
              ...PRODUCT_NOT_DELETED,
              category: { $exists: true, $nin: [null, ""] },
              quantity: { $gt: 0 },
              inStock: true,
            },
          },
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]);
        const seen = new Set();
        const synthetic = [];
        for (const row of agg) {
          const name = categoryStringFromDoc(row._id);
          const nk = normCategoryKey(name);
          if (!nk || seen.has(nk)) continue;
          if (inactiveNameKeys.has(nk)) continue;
          if (nameKeySet.has(nk) || inferMainForCategoryName(name) === main) {
            seen.add(nk);
            synthetic.push({
              name,
              main: null,
              image: "",
              sortOrder: 0,
              isActive: true,
              isDeleted: false,
              isDisable: false,
            });
          }
        }
        synthetic.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        list = synthetic.slice(0, 32);
      } catch (e) {
        console.error("getFeaturedCategories product fallback:", e.message);
      }
    }

    list = list.filter((c) => c && c.featuredOnHome !== false);
    list = list.slice(0, 32);

    const { mapInStock, mapAll } = await buildProductCategoryMaps(Products);
    let firstImgByKey = {};
    try {
      firstImgByKey = await firstProductImageByCategoryKey(Products, {
        preferInStockFirst: true,
      });
    } catch (e) {
      console.error("getFeaturedCategories firstProductImageByCategoryKey:", e.message);
    }

    /** No synthetic list: only active DB categories for this `main` appear on the storefront. */

    const data = list.map((c) => {
      const shop = productCountForCategoryName(mapInStock, c.name);
      const all = productCountForCategoryName(mapAll, c.name);
      const saved = c.image && String(c.image).trim();
      const nk = normCategoryKey(c.name);
      const fromProduct = firstImgByKey[nk] || null;
      const displayTitle =
        c.homeDisplayTitle != null && String(c.homeDisplayTitle).trim()
          ? String(c.homeDisplayTitle).trim()
          : c.name;
      return {
        name: c.name,
        value: c.name,
        displayTitle,
        /** Total non-deleted SKUs in this category (stable; not “in-stock only”). */
        count: all,
        /** In-stock subset (storefront listing uses inStock). */
        inStockCount: shop,
        image: saved || fromProduct || null,
        sortOrder: c.sortOrder ?? 0,
        isActive: true,
      };
    });

    const needExact = data
      .filter((row) => !row.image && row.count > 0)
      .map((r) => r.name);
    if (needExact.length) {
      try {
        const byExact = await firstProductImageByExactCategoryNames(Products, needExact);
        for (const row of data) {
          if (!row.image && row.count > 0 && byExact[row.name]) {
            row.image = byExact[row.name];
          }
        }
      } catch (e) {
        console.error("getFeaturedCategories exact image fallback:", e.message);
      }
    }

    const stillNoImg = data.filter((row) => !row.image && row.count > 0);
    if (stillNoImg.length) {
      try {
        const col = Products.collection;
        const or = stillNoImg.map((r) => ({
          category: new RegExp(`^${escapeRegex(String(r.name).trim())}$`, "i"),
        }));
        const prods = await col
          .find(
            { ...PRODUCT_NOT_DELETED, $or: or },
            {
              projection: {
                category: 1,
                image: 1,
                images: 1,
                imageUrl: 1,
                thumbnail: 1,
                photo: 1,
              },
            }
          )
          .sort({ _id: -1 })
          .limit(1200)
          .toArray();
        for (const p of prods) {
          const img = pickProductImage(p);
          if (!img) continue;
          const pk = normCategoryKey(categoryStringFromDoc(p.category));
          for (const row of data) {
            if (row.image || !row.count) continue;
            if (normCategoryKey(row.name) !== pk) continue;
            row.image = img;
            break;
          }
        }
      } catch (e) {
        console.error("getFeaturedCategories case-insensitive image fallback:", e.message);
      }
    }

    let sectionTitle = "Featured Categories";
    try {
      const appS = await AppSettings.findOne().lean();
      const t = appS && String(appS.homeFeaturedSectionTitle || "").trim();
      if (t) sectionTitle = t;
    } catch (_) {
      /* ignore */
    }

    setCatalogNoCacheHeaders(res);
    return res.json({ success: true, sectionTitle, data });
  } catch (err) {
    setCatalogNoCacheHeaders(res);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load featured categories",
    });
  }
};

const getHomeSliderSettings = async (req, res) => {
  try {
    const settings = await HomeSliderSettings.findOne({ key: "home-main-slider" }).lean();

    if (!settings) {
      setCatalogNoCacheHeaders(res);
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

    const slides = coerceHomeSliderSlides(settings.slides)
      .filter(
        (s) =>
          s &&
          String(s.imageUrl || "").trim() &&
          String(s.title || "").trim() &&
          s.isActive !== false
      )
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((s, idx) => ({
        id: s._id != null ? String(s._id) : String(idx + 1),
        title: s.title,
        subtitle: s.subtitle != null ? String(s.subtitle).trim() : "",
        imageUrl: s.imageUrl,
        buttonText: s.buttonText || "Shop Now",
        buttonLink: s.buttonLink || "/products",
        cardBgColor: s.cardBgColor || "#f8fafc",
        textColor: s.textColor || "#1e293b",
        buttonBgColor: s.buttonBgColor || "#3090cf",
        buttonTextColor: s.buttonTextColor || "#ffffff",
      }));

    setCatalogNoCacheHeaders(res);
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
    setCatalogNoCacheHeaders(res);
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

/** Split a US-style "Street, City, ST" string for Easyship rate requests */
const parseAddressForEasyship = (fullAddress, postalCode) => {
  const zip = String(postalCode || "").trim() || "10001";
  const parts = String(fullAddress || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  let line1 = parts[0] || "Address";
  let city = "City";
  let state = "NY";
  if (parts.length >= 3) {
    line1 = parts[0];
    city = parts[1];
    const st = parts[2].replace(/\s+/g, " ");
    const m = st.match(/\b([A-Za-z]{2})\b/);
    state = m ? m[1].toUpperCase() : st.slice(0, 2).toUpperCase() || "NY";
  } else if (parts.length === 2) {
    line1 = parts[0];
    const m = parts[1].match(/^(.+?)\s+([A-Za-z]{2})$/);
    if (m) {
      city = m[1].trim();
      state = m[2].toUpperCase();
    } else {
      city = parts[1];
    }
  }
  return {
    line_1: line1.slice(0, 200),
    city: city.slice(0, 100),
    state: state.slice(0, 2),
    postal_code: zip.slice(0, 10),
  };
};

const mapEasyshipRateRow = (r) => {
  if (!r) return null;
  const total = easyshipRowChargeTotalUSD(r);
  const cs = r?.courier_service || {};
  const handover = Array.isArray(r?.available_handover_options) ? r.available_handover_options : [];
  return {
    total,
    courierName:
      r?.courier_name || cs?.umbrella_name || r?.courier?.name || cs?.name || r?.courier_service_name || "Courier",
    serviceName: r?.courier_service_name || cs?.name || r?.full_description || cs?.umbrella_name || "",
    easyshipRateId: r?.easyship_rate_id || r?.rate_id || r?.id || cs?.id || "",
    minDeliveryDays: r?.min_delivery_time != null ? Number(r.min_delivery_time) : null,
    maxDeliveryDays: r?.max_delivery_time != null ? Number(r.max_delivery_time) : null,
    description: String(r?.full_description || r?.description || "").trim(),
    availableHandoverOptions: handover,
    minimumPickupFee: Number(
      r?.minimum_pickup_fee ?? r?.rates_in_origin_currency?.minimum_pickup_fee ?? 0,
    ),
    insuranceFee: Number(r?.insurance_fee || 0),
  };
};

const handoverSummaryFromRate = (rate) => {
  const opts = rate?.availableHandoverOptions || [];
  const labeled = opts
    .map((o) => {
      if (o == null) return null;
      if (typeof o === "string") return o;
      return o.name || o.type || o.slug || o.handover_option || null;
    })
    .filter(Boolean);
  if (labeled.length) return `Available options: ${labeled.join(", ")}.`;
  if (Number(rate?.minimumPickupFee) > 0) {
    return "Pickup may be available (carrier pickup fees can apply). Drop-off at authorized locations is usually available.";
  }
  return "Typical service: drop your package at an authorized carrier location, or schedule pickup through the carrier after you receive your label.";
};

const deliverySummaryFromRate = (rate, internalFallback) => {
  if (internalFallback) {
    return "Estimated 3–7 business days domestically (approximate; carrier may vary).";
  }
  const minD = rate?.minDeliveryDays;
  const maxD = rate?.maxDeliveryDays;
  if (minD != null && maxD != null && Number.isFinite(minD) && Number.isFinite(maxD)) {
    return `Estimated ${minD}–${maxD} business days (carrier estimate).`;
  }
  if (maxD != null && Number.isFinite(maxD)) {
    return `Estimated up to ${maxD} business days (carrier estimate).`;
  }
  return "See carrier service details after payment for tracking and delivery updates.";
};

/** When no markup env vars are set: production uses this (30% client default). Dev stays 1× unless env is set. */
const EASYSHIP_QUOTE_DEFAULT_PRODUCTION_MULTIPLIER = 1.3;

/** Customer-facing multiplier on Easyship (or internal) base quote. Set EASYSHIP_QUOTE_MARKUP_PERCENT=30 or MULTIPLIER=1.3 */
function getShippingQuoteMarkupMultiplier() {
  const raw = String(process.env.EASYSHIP_QUOTE_MARKUP_MULTIPLIER || "").trim();
  if (raw) {
    const m = Number(raw);
    if (Number.isFinite(m) && m >= 1 && m <= 5) return m;
  }
  const pctRaw = process.env.EASYSHIP_QUOTE_MARKUP_PERCENT;
  if (pctRaw !== undefined && String(pctRaw).trim() !== "") {
    const pct = Number(pctRaw);
    if (Number.isFinite(pct) && pct >= 0 && pct <= 200) return 1 + pct / 100;
  }
  if (process.env.NODE_ENV === "production") return EASYSHIP_QUOTE_DEFAULT_PRODUCTION_MULTIPLIER;
  return 1;
}

function applyShippingCustomerQuote(amount) {
  const mult = getShippingQuoteMarkupMultiplier();
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * mult * 100) / 100;
}

function shippingQuoteRateJson(mapped, internalOnly) {
  const base = mapped.total;
  return {
    quoteAmount: applyShippingCustomerQuote(base),
    quoteAmountBase: base,
    currency: "USD",
    carrier: mapped.courierName,
    serviceName: mapped.serviceName,
    easyshipRateId: mapped.easyshipRateId || "",
    deliverySummary: deliverySummaryFromRate(mapped, internalOnly),
    handoverSummary: handoverSummaryFromRate(mapped),
    minDeliveryDays: mapped.minDeliveryDays ?? null,
    maxDeliveryDays: mapped.maxDeliveryDays ?? null,
    minimumPickupFee: mapped.minimumPickupFee ?? 0,
    insuranceFee: mapped.insuranceFee ?? 0,
  };
}

const requestEasyshipRates = async (body) => {
  const {
    length,
    width,
    height,
    weight,
    originAddress,
    originZip,
    destinationAddress,
    destinationZip,
    destinationResidential,
    addInsurance,
    insuranceDeclaredValue,
  } = body;

  if (!EASYSHIP_API_KEY) return { rates: [], cheapest: null };

  const origin = parseAddressForEasyship(originAddress, originZip);
  const dest = parseAddressForEasyship(destinationAddress, destinationZip);

  const declaredVal = Math.max(1, Number(insuranceDeclaredValue) || 50);

  /** Dashboard “shipping rules” default to on in Easyship and can collapse quotes to a single option. */
  const applyShippingRules = String(process.env.EASYSHIP_APPLY_SHIPPING_RULES || "").trim() === "1";

  const payload = {
    origin_address: {
      line_1: origin.line_1,
      city: origin.city,
      state: origin.state,
      postal_code: origin.postal_code,
      country_alpha2: "US",
    },
    destination_address: {
      line_1: dest.line_1,
      city: dest.city,
      state: dest.state,
      postal_code: dest.postal_code,
      country_alpha2: "US",
    },
    set_as_residential: Boolean(destinationResidential),
    calculate_tax_and_duties: false,
    courier_settings: {
      apply_shipping_rules: applyShippingRules,
    },
    shipping_settings: {
      output_currency: "USD",
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
            declared_customs_value: declaredVal,
          },
        ],
      },
    ],
  };

  if (addInsurance && declaredVal > 0) {
    payload.insurance = {
      is_insured: true,
      insured_amount: declaredVal,
      insured_currency: "USD",
    };
  }

  const url = `${getEasyshipBaseUrl()}/${EASYSHIP_API_VERSION}/rates`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60_000);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EASYSHIP_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error("Easyship rates request timed out");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }

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

  const list = extractEasyshipRatesArray(parsed);
  if (!list.length) return { rates: [], cheapest: null };

  const mapped = list
    .map((r) => mapEasyshipRateRow(r))
    .filter((r) => r && Number.isFinite(r.total) && r.total > 0)
    .sort((a, b) => a.total - b.total);

  if (String(process.env.EASYSHIP_RATES_DEBUG || "").trim() === "1") {
    const umbrellas = new Set(mapped.map((x) => String(x.courierName || "").split(/\s+/)[0]));
    logger.info(
      `[Easyship rates] ${JSON.stringify({
        rawRows: list.length,
        pricedRows: mapped.length,
        umbrellaPrefixes: [...umbrellas].slice(0, 12),
        cheapest: mapped[0] ? { carrier: mapped[0].courierName, total: mapped[0].total } : null,
      })}`,
    );
  }

  return { rates: mapped, cheapest: mapped[0] || null };
};

const computeShippingQuote = (input) => {
  const { length, width, height, weight, destinationResidential, addInsurance, insuranceDeclaredValue } = input || {};
  const l = Number(length);
  const w = Number(width);
  const h = Number(height);
  const wt = Number(weight);

  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(wt)) return 0;
  if (l <= 0 || w <= 0 || h <= 0 || wt <= 0) return 0;

  const volume = l * w * h;
  const dimWeight = volume / 166;
  const billedWeight = Math.max(wt, dimWeight);

  const base = 5.0;
  const perLb = 1.35;
  let quote = base + billedWeight * perLb;

  if (destinationResidential) quote += 4;

  if (addInsurance) {
    const declared = Math.max(0, Number(insuranceDeclaredValue) || 0);
    const ins = Math.max(2, Math.round(declared * 0.015 * 100) / 100);
    quote += ins;
  }

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

/** US ZippyyyShips parcel form — bounded to avoid abuse and Easyship rejects. */
const shippingFormSchema = Joi.object({
  length: Joi.number().min(0.1).max(200).required(),
  width: Joi.number().min(0.1).max(200).required(),
  height: Joi.number().min(0.1).max(200).required(),
  weight: Joi.number().min(0.1).max(150).required(),
  destinationZip: Joi.string().trim().min(3).max(16).required(),
  destinationAddress: Joi.string().trim().min(5).max(500).required(),
  originZip: Joi.string().trim().max(16).optional().allow(""),
  originAddress: Joi.string().trim().max(500).optional().allow(""),
  destinationResidential: Joi.boolean().optional(),
  addInsurance: Joi.boolean().optional(),
  insuranceDeclaredValue: Joi.number().min(0).max(500_000).optional().allow(0),
  /** Required when there is no Bearer user (guest label checkout). */
  guestName: Joi.string().trim().max(200).optional().allow(""),
  guestEmail: Joi.string().trim().email().optional().allow(""),
  guestPhone: Joi.string().trim().max(40).optional().allow(""),
  /** Optional ship-to contact; defaults to guest* when omitted. */
  recipientName: Joi.string().trim().max(200).optional().allow(""),
  recipientPhone: Joi.string().trim().max(40).optional().allow(""),
  recipientEmail: Joi.string().trim().max(200).optional().allow(""),
  easyshipRateId: Joi.string().trim().max(200).optional().allow(""),
}).options({ stripUnknown: true, abortEarly: false });

const getShippingQuote = async (req, res) => {
  try {
    const { error, value } = shippingFormSchema.validate(req.body ?? {});
    if (error) {
      setCatalogNoCacheHeaders(res);
      return res.status(400).json({ success: false, message: formatJoiErrors(error) });
    }

    let easyshipResult = { rates: [], cheapest: null };
    try {
      easyshipResult = await requestEasyshipRates(value);
    } catch (e) {
      logger.warn(`Easyship quote fallback: ${e?.message || e}`);
    }

    const easyRates = easyshipResult?.rates || [];
    const easyCheapest = easyshipResult?.cheapest || null;

    if (!easyRates.length) {
      const baseInternal = computeShippingQuote(value);
      if (baseInternal > 0) {
        const synthetic = {
          total: baseInternal,
          courierName: "ZippyyyShips",
          serviceName: "Estimated rate (carrier live rates unavailable)",
          easyshipRateId: "",
          minDeliveryDays: 3,
          maxDeliveryDays: 7,
          minimumPickupFee: 0,
          insuranceFee: 0,
        };
        const ratesPayload = [shippingQuoteRateJson(synthetic, true)];
        const first = ratesPayload[0];
        setCatalogNoCacheHeaders(res);
        return res.json({
          success: true,
          data: {
            quoteAmount: first.quoteAmount,
            quoteAmountBase: first.quoteAmountBase,
            markupMultiplier: getShippingQuoteMarkupMultiplier(),
            currency: "USD",
            rates: ratesPayload,
            carrier: first.carrier,
            serviceName: first.serviceName,
            easyshipRateId: "",
            source: "estimate",
            deliverySummary: first.deliverySummary,
            handoverSummary: first.handoverSummary,
            minDeliveryDays: first.minDeliveryDays,
            maxDeliveryDays: first.maxDeliveryDays,
            minimumPickupFee: first.minimumPickupFee,
            insuranceFee: first.insuranceFee,
          },
        });
      }
      setCatalogNoCacheHeaders(res);
      return res.status(502).json({
        success: false,
        message: "Live Easyship rates are currently unavailable. Please verify EASYSHIP_API_KEY and try again.",
        code: "EASYSHIP_RATES_UNAVAILABLE",
      });
    }

    const ratesPayload = easyRates.map((r) => shippingQuoteRateJson(r, false));

    const first = ratesPayload[0];
    const quoteAmount = first?.quoteAmount ?? 0;
    if (!quoteAmount || quoteAmount <= 0) {
      setCatalogNoCacheHeaders(res);
      return res.status(400).json({ success: false, message: "Invalid shipping inputs" });
    }

    setCatalogNoCacheHeaders(res);
    return res.json({
      success: true,
      data: {
        quoteAmount,
        quoteAmountBase: first.quoteAmountBase,
        markupMultiplier: getShippingQuoteMarkupMultiplier(),
        currency: "USD",
        rates: ratesPayload,
        carrier: first.carrier,
        serviceName: first.serviceName,
        easyshipRateId: first.easyshipRateId,
        source: "easyship",
        deliverySummary: first.deliverySummary,
        handoverSummary: first.handoverSummary,
        minDeliveryDays: first.minDeliveryDays,
        maxDeliveryDays: first.maxDeliveryDays,
        minimumPickupFee: first.minimumPickupFee,
        insuranceFee: first.insuranceFee,
      },
    });
  } catch (err) {
    setCatalogNoCacheHeaders(res);
    return res.status(500).json({ success: false, message: err.message || "Failed to get quote" });
  }
};

/** Stripe success/cancel URLs must be absolute; prefer browser Origin, else first FRONTEND_URL. */
function resolveStorefrontOrigin(req) {
  const origin = String(req.get("origin") || "").trim();
  if (origin && /^https?:\/\//i.test(origin)) {
    return origin.replace(/\/+$/, "");
  }
  const raw = String(process.env.FRONTEND_URL || "");
  const first = raw.split(",")[0].trim();
  if (first && /^https?:\/\//i.test(first)) {
    return first.replace(/\/+$/, "");
  }
  return null;
}

async function rollbackShippingCheckoutDraft(orderId, temporaryAddressId) {
  await Promise.all([
    orderId ? Orders.findByIdAndDelete(orderId) : Promise.resolve(),
    temporaryAddressId ? Address.findByIdAndDelete(temporaryAddressId) : Promise.resolve(),
  ]);
}

const createShippingCheckout = async (req, res) => {
  let temporaryAddressId = null;
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: "Stripe is not configured; shipping checkout is unavailable.",
      });
    }

    const { error, value } = shippingFormSchema.validate(req.body ?? {});
    if (error) return res.status(400).json({ success: false, message: formatJoiErrors(error) });

    let easyshipResult = { rates: [], cheapest: null };
    try {
      easyshipResult = await requestEasyshipRates(value);
    } catch (e) {
      console.error("Easyship checkout fallback:", e.message);
    }

    const easyRates = easyshipResult?.rates || [];
    const easyCheapest = easyshipResult?.cheapest || null;
    const wantedRateId = String(value.easyshipRateId || "").trim();

    let selectedMapped = null;
    if (easyRates.length) {
      selectedMapped = easyCheapest;
      if (wantedRateId) {
        const hit = easyRates.find((x) => String(x.easyshipRateId || "") === wantedRateId);
        if (hit) selectedMapped = hit;
      }
    }

    const quoteBase =
      selectedMapped && Number(selectedMapped.total) > 0
        ? Number(selectedMapped.total)
        : computeShippingQuote(value);
    const easyshipRate =
      selectedMapped && Number(selectedMapped.total) > 0 ? selectedMapped : null;

    const quoteAmount = applyShippingCustomerQuote(quoteBase);
    if (!quoteAmount || quoteAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid shipping inputs" });
    }

    const userId = req.user?.id ? String(req.user.id) : null;
    const isGuest = !userId;

    const { city, state } = parseCityStateFromAddress(value.destinationAddress);
    const pincode = String(value.destinationZip).trim();

    let customerEmail = "";
    let addressId = null;
    let guestShippingDoc = undefined;

    if (isGuest) {
      const guestName = String(value.guestName || "").trim();
      const guestPhone = String(value.guestPhone || "").trim();
      const guestEmail = String(value.guestEmail || "").trim().toLowerCase();
      if (!guestName || !guestPhone || !guestEmail) {
        return res.status(400).json({
          success: false,
          message: "guestName, guestEmail, and guestPhone are required for guest checkout.",
        });
      }
      customerEmail = guestEmail;
      const rName = String(value.recipientName || "").trim() || guestName;
      const rPhone = String(value.recipientPhone || "").trim() || guestPhone;
      const rEmail =
        String(value.recipientEmail || "").trim().toLowerCase() || guestEmail;
      guestShippingDoc = {
        name: rName,
        phone: rPhone,
        email: rEmail,
        fullAddress: value.destinationAddress,
        city,
        state,
        pincode,
        addressType: value.destinationResidential ? "Home" : "Work",
      };
    } else {
      const dbUser = await User.findById(userId).select("name firstName lastName phone email").lean();
      if (!dbUser) return res.status(404).json({ success: false, message: "User not found" });

      const address = await Address.create({
        userId,
        name: dbUser.name || `${dbUser.firstName || "Customer"} ${dbUser.lastName || ""}`.trim() || "Customer",
        phone: dbUser.phone || "0000000000",
        fullAddress: value.destinationAddress,
        city,
        state,
        pincode,
        addressType: value.destinationResidential ? "Home" : "Work",
        isDefault: false,
      });
      addressId = address._id;
      temporaryAddressId = address._id;
      customerEmail = String(dbUser.email || "").trim().toLowerCase();
      if (!customerEmail) {
        return res.status(400).json({
          success: false,
          message: "Your account has no email on file. Add an email to your profile or use guest checkout.",
        });
      }
    }

    const trackingNumber = `TRK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const shipMeta = {
      res: Boolean(value.destinationResidential),
      ins: Boolean(value.addInsurance),
      insVal: Number(value.insuranceDeclaredValue) || 0,
      src: easyshipRate ? "easyship" : "internal",
      rateId: easyshipRate?.easyshipRateId || "",
    };
    const notesStr = `ZippyyyShips | ${JSON.stringify(shipMeta)}`.slice(0, 1000);

    const brandedOrderId = await generateNextOrderId();
    const order = await Orders.create({
      orderId: brandedOrderId,
      orderNumber: brandedOrderId,
      userId: userId || null,
      addressId,
      customerEmail,
      guestShipping: guestShippingDoc,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      shippingAmount: quoteAmount,
      discountAmount: 0,
      tipAmount: 0,
      serviceFee: 0,
      totalAmount: quoteAmount,
      notes: notesStr,
      paymentStatus: "pending",
      paymentMethod: "stripe",
      status: "session",
      carrier: easyshipRate?.courierName || "ZippyyyShips",
      trackingNumber,
      orderSource: "web",
      isShippingOrder: true,
    });

    const baseUrl = resolveStorefrontOrigin(req);
    if (!baseUrl) {
      await rollbackShippingCheckoutDraft(order._id, temporaryAddressId);
      return res.status(400).json({
        success: false,
        message:
          "Cannot build checkout URLs: send a valid Origin header or set FRONTEND_URL (e.g. https://yoursite.com) in the API environment.",
      });
    }

    const orderViewToken = signOrderViewToken(order._id);
    const successQuery =
      isGuest && orderViewToken != null
        ? `order=${order._id}&shipping=1&t=${encodeURIComponent(orderViewToken)}`
        : `order=${order._id}&shipping=1`;
    const successUrl = `${baseUrl}/order-success?${successQuery}`;
    const cancelUrl = `${baseUrl}/zippyyy-ships`;

    const stripeTotalCents = Math.round(quoteAmount * 100);
    if (!Number.isFinite(stripeTotalCents) || stripeTotalCents < 50) {
      await rollbackShippingCheckoutDraft(order._id, temporaryAddressId);
      return res.status(400).json({
        success: false,
        message: "Quote amount is too small for Stripe checkout (minimum US$0.50).",
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      await rollbackShippingCheckoutDraft(order._id, temporaryAddressId);
      return res.status(503).json({
        success: false,
        message: "Card payments are not configured. Try again later or contact support.",
      });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
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
        customer_email: customerEmail || undefined,
        metadata: {
          orderId: order._id.toString(),
          isShippingOrder: "true",
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
    } catch (stripeErr) {
      await rollbackShippingCheckoutDraft(order._id, temporaryAddressId);
      console.error("createShippingCheckout Stripe error:", stripeErr.message);
      return res.status(502).json({
        success: false,
        message: stripeErr.message || "Stripe could not start checkout. Try again later.",
      });
    }

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
router.get("/orderByViewToken", getOrderByViewToken);
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
router.get('/featured-categories', getFeaturedCategories);
router.get('/referral/discount', getReferralDiscount);
router.get('/home-slider-settings', getHomeSliderSettings);
router.get('/site-branding/logo', getSiteBrandingLogo);
router.get('/site-branding/favicon', getSiteBrandingFavicon);
router.get('/site-branding/hero-banner', getSiteBrandingHeroBanner);
router.get('/site-settings', getPublicSiteSettings);
router.post('/coming-soon/subscribe', userSellRateLimiter, postComingSoonSubscribe);
router.post('/shipping/quote', getShippingQuote);
router.post('/shipping/checkout', createShippingCheckout);

module.exports = router;
