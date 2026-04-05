const express = require("express");
const router = express.Router();
const Joi = require("joi");
const { Message, Products, Orders, User, ContactUs, Voucher, HomeSliderSettings, AppSettings, EmailTemplate } = require("../../db");
const { authorize } = require("../middlewares/rbacMiddleware");
const multer = require("multer");
const Product = require("../../db/models/Product");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Deal = require("../../db/models/deals");
const Contact = require("../../db/models/Contact");
const Address = require("../../db/models/Address");
const { default: sendMail } = require("../../utils/sendEmail");
const { sendOrderStatusChangeEmail, loadOrderForMail } = require("../../utils/orderEmails");
const { verifySmtpConfig, sendMailWithOverrides } = require("../../utils/mailService");
const { VALID_ADMIN_TRANSITION_STATUSES, ORDER_STATUSES } = require("../../utils/orderStatuses");
const {
  ensureDefaultTemplates,
  applyVariables,
  buildOrderTemplateVars,
  buildContactTemplateVars,
  TEMPLATE_DEFAULTS,
} = require("../../utils/emailTemplateService");
const Category = require("../../db/models/categories");
const {
  coerceCategoryIsActiveFromRequest,
} = require("../../utils/categoryActivity");
const { finalizeCategoryImageUpload } = require("../../utils/categoryImageUpload");
const { coerceHomeSliderSlides } = require("../../utils/homeSliderSlides");
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

const ALLOWED_PRODUCT_BADGES = new Set(["hot", "sale", "new", "trending", ""]);

/** Stripe and imports typically set `paid`; legacy rows may use `completed`. */
const PAID_REVENUE_PAYMENT_STATUSES = { $in: ["paid", "completed"] };
const {
  getValuesForMain,
  inferMainForCategoryName,
} = require("../../utils/storefrontCategoryMeta");
const { safeApiMessage } = require("../../utils/safeApiMessage");
const {
  resolveContactAutoReplyMessage,
  DEFAULT_CONTACT_AUTO_REPLY_TEMPLATE,
} = require("../../utils/contactAutoAcknowledgment");
const { invalidateProductCatalogCache } = require("../../utils/invalidateProductCatalogCache");
const { connectDB } = require("../../lib/db");
const adminAuth = [authorize(['admin'])];

const formatJoiErrors = (error) => {
  if (!error.details) return '';
  const errors = error.details.map((detail) => {
    return detail.message.replace(/"/g, "");
  });
  return errors.join(', ')
};

const adminUploadsDest = () => {
  const dest = process.env.VERCEL
    ? "/tmp/uploads"
    : path.join(__dirname, "../../uploads");
  try {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  } catch (_) {
    /* ignore */
  }
  return dest;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, adminUploadsDest());
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5000000 },
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();

    const imageExtOk = /jpeg|jpg|png|webp/.test(fileExt.replace(/^\./, ""));
    const imageMimeOk =
      !file.mimetype ||
      /^image\//i.test(file.mimetype) ||
      /jpe?g|png|webp/i.test(file.mimetype);
    const isImage = imageExtOk && imageMimeOk;

    const isExcel =
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
      fileExt === ".xlsx";

    const isCsv =
      (file.mimetype === "text/csv" ||
        file.mimetype === "application/csv" ||
        file.mimetype === "application/vnd.ms-excel") &&
      fileExt === ".csv";

    if (isImage || isExcel || isCsv) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, xlsx or csv files are allowed'));
    }
  }
});

const uploadProductCsv = multer({
  storage,
  limits: { fileSize: 35 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (fileExt === ".csv") return cb(null, true);
    cb(new Error("Bulk import requires a .csv file"));
  },
});

const uploadProductCsvMulter = (req, res, next) => {
  uploadProductCsv.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "CSV too large (max 35MB). Split into smaller files if needed.",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid upload",
    });
  });
};

/** Multer errors (type, size) must return JSON or the admin UI shows a generic network message. */
const uploadCategoryImageMulter = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Image too large (max 5MB). Try a smaller JPG, PNG, or WebP.",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid upload",
    });
  });
};

const uploadBrandingLogo = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const okExt = [".jpeg", ".jpg", ".png", ".webp", ".svg"].includes(fileExt);
    const okMime =
      !file.mimetype ||
      /^image\//i.test(file.mimetype) ||
      /svg|jpeg|jpg|png|webp/i.test(file.mimetype);
    if (okExt && okMime) return cb(null, true);
    cb(new Error("Logo must be JPG, PNG, WebP, or SVG (max 5MB)."));
  },
});

const uploadBrandingFavicon = multer({
  storage,
  limits: { fileSize: 512 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const okExt = [".ico", ".png", ".svg", ".webp", ".jpg", ".jpeg"].includes(fileExt);
    const okMime =
      !file.mimetype ||
      /^image\//i.test(file.mimetype) ||
      /svg|ico|jpeg|jpg|png|webp|x-icon|vnd\.microsoft\.icon/i.test(file.mimetype);
    if (okExt && okMime) return cb(null, true);
    cb(new Error("Favicon must be ICO, PNG, SVG, or WebP (max 512KB)."));
  },
});

const uploadBrandingLogoMulter = (req, res, next) => {
  uploadBrandingLogo.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Logo file is too large (max 5MB).",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid logo upload",
    });
  });
};

const uploadBrandingFaviconMulter = (req, res, next) => {
  uploadBrandingFavicon.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Favicon file is too large (max 512KB).",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid favicon upload",
    });
  });
};

const {
  uploadsPublicPath,
  normalizeStoredUploadsUrl,
} = require("../../utils/brandingPublicUrl");

/**
 * Public path for a file under /uploads (always `/uploads/...`, no host).
 * Avoids broken images when the DB had localhost:5000 but the storefront loads from :3000 or another domain.
 */
function publicBrandingUrl(_req, filename) {
  return uploadsPublicPath(filename);
}

function adminProfilePayload(u) {
  const doc = u && typeof u.toObject === "function" ? u.toObject() : u;
  const username =
    (doc.name && String(doc.name).trim()) ||
    [doc.firstName, doc.lastName].filter(Boolean).join(" ").trim() ||
    "";
  const rawImg = doc.profileImageUrl != null ? String(doc.profileImageUrl).trim() : "";
  return {
    id: String(doc._id),
    email: doc.email || "",
    username,
    firstName: doc.firstName || "",
    lastName: doc.lastName || "",
    role: doc.role || "",
    profileImageUrl: normalizeStoredUploadsUrl(rawImg),
    profileAvatarKey: "",
  };
}

const uploadAdminAvatar = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const okExt = [".jpeg", ".jpg", ".png", ".webp"].includes(fileExt);
    const mime = String(file.mimetype || "").toLowerCase();
    const okMime =
      !mime ||
      /^image\/(jpeg|png|webp)/i.test(mime) ||
      mime === "application/octet-stream" ||
      /jpe?g|png|webp/i.test(mime);
    if (okExt && okMime) return cb(null, true);
    cb(new Error("Avatar must be JPG, PNG, or WebP (max 3MB)."));
  },
});

const uploadAdminAvatarMulter = (req, res, next) => {
  uploadAdminAvatar.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Image too large (max 3MB).",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid upload",
    });
  });
};

const getAdminProfile = async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, data: adminProfilePayload(u) });
  } catch (e) {
    console.error("getAdminProfile", e);
    return res.status(500).json({
      success: false,
      message: safeApiMessage(e),
    });
  }
};

const putAdminProfile = async (req, res) => {
  const schema = Joi.object({
    username: Joi.string().trim().min(1).max(120).optional(),
    removeAvatar: Joi.boolean().optional(),
  }).or("username", "removeAvatar");

  try {
    await schema.validateAsync(req.body, { abortEarly: true });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formatJoiErrors(error)}`,
        code: "VALIDATION_ERROR",
      });
    }
    throw error;
  }

  const { username, removeAvatar } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (username !== undefined) {
      user.name = String(username).trim();
    }
    if (removeAvatar === true) {
      user.profileImageUrl = "";
      user.profileAvatarKey = "";
    }

    await user.save();
    const fresh = await User.findById(req.user.id);
    return res.json({
      success: true,
      message: "Profile updated",
      data: adminProfilePayload(fresh || user),
    });
  } catch (e) {
    console.error("putAdminProfile", e);
    return res.status(500).json({
      success: false,
      message: safeApiMessage(e),
    });
  }
};

const putAdminChangePassword = async (req, res) => {
  const schema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        "string.pattern.base":
          "New password must include at least one uppercase letter, one lowercase letter, and one number.",
      }),
    confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
      "any.only": "Passwords do not match",
    }),
  });

  try {
    await schema.validateAsync(req.body, { abortEarly: true });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formatJoiErrors(error)}`,
        code: "VALIDATION_ERROR",
      });
    }
    throw error;
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
        code: "INVALID_CURRENT_PASSWORD",
      });
    }
    user.password = newPassword;
    await user.save();
    return res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (e) {
    console.error("putAdminChangePassword", e);
    return res.status(500).json({
      success: false,
      message: safeApiMessage(e),
    });
  }
};

const postAdminProfileUploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const url = normalizeStoredUploadsUrl(publicBrandingUrl(req, req.file.filename));
    user.profileImageUrl = url;
    user.profileAvatarKey = "";
    await user.save();
    const fresh = await User.findById(req.user.id);
    return res.json({
      success: true,
      message: "Avatar updated",
      data: adminProfilePayload(fresh || user),
    });
  } catch (e) {
    console.error("postAdminProfileUploadAvatar", e);
    return res.status(500).json({
      success: false,
      message: safeApiMessage(e),
    });
  }
};

const formatDateTime = (value) => {
  if (!value) return "";

  const d = new Date(value);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const idValidation = Joi.object({
  id: Joi.string()
    .length(24)
    .hex()
    .required()
});

const dashboardStats = async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(new Date().setDate(now.getDate() - 7));
    const startOfMonth = new Date(new Date().setMonth(now.getMonth() - 1));

    // =======================
    // SALES (day / week / month)
    // =======================
    const salesAgg = await Orders.aggregate([
      { $match: { paymentStatus: PAID_REVENUE_PAYMENT_STATUSES } },
      {
        $facet: {
          day: [
            { $match: { createdAt: { $gte: startOfDay } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ],
          week: [
            { $match: { createdAt: { $gte: startOfWeek } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ],
          month: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]
        }
      }
    ]);

    // =======================
    // PROFIT (query based)
    // =======================
    const profitAgg = await Orders.aggregate([
      { $match: { paymentStatus: PAID_REVENUE_PAYMENT_STATUSES } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $addFields: {
          profit: {
            $multiply: [
              { $subtract: ['$items.price', '$product.cost'] },
              '$items.quantity'
            ]
          }
        }
      },
      {
        $facet: {
          day: [
            { $match: { createdAt: { $gte: startOfDay } } },
            { $group: { _id: null, total: { $sum: '$profit' } } }
          ],
          week: [
            { $match: { createdAt: { $gte: startOfWeek } } },
            { $group: { _id: null, total: { $sum: '$profit' } } }
          ],
          month: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$profit' } } }
          ]
        }
      }
    ]);

    // =======================
    // ORDERS STATS
    // =======================
    const ordersByStatus = await Orders.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const totalOrders = await Orders.countDocuments();

    const pendingOrders = ordersByStatus
      .filter((o) => o._id === "pending" || o._id === "processing")
      .reduce((sum, o) => sum + (Number(o.count) || 0), 0);

    const deliveredOrders =
      ordersByStatus.find(o => o._id === 'delivered')?.count || 0;

    // =======================
    // PRODUCTS STATS
    // =======================
    const totalProducts = await Products.countDocuments({ ...PRODUCT_NOT_DELETED });
    const lowStockProducts = await Products.countDocuments({
      ...PRODUCT_NOT_DELETED,
      quantity: { $lt: 10 },
    });

    // =======================
    // RESPONSE (FRONTEND READY)
    // =======================
    res.json({
      success: true,
      sales: {
        day: salesAgg[0].day[0]?.total || 0,
        week: salesAgg[0].week[0]?.total || 0,
        month: salesAgg[0].month[0]?.total || 0,
      },
      profits: {
        day: profitAgg[0].day[0]?.total || 0,
        week: profitAgg[0].week[0]?.total || 0,
        month: profitAgg[0].month[0]?.total || 0,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders,
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts,
      },
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Dashboard fetch failed' });
  }
};

/**
 * Same filter semantics as admin orders list (status, search, date range).
 * @param {{ status?: string, searchRaw?: string, dateFrom?: string, dateTo?: string }} q
 */
const buildAdminOrdersListFilter = (q) => {
  const status = q.status || 'all';
  const searchRaw = q.searchRaw != null ? String(q.searchRaw).trim() : '';
  const dateFrom = q.dateFrom != null ? String(q.dateFrom).trim() : '';
  const dateTo = q.dateTo != null ? String(q.dateTo).trim() : '';

  const conditions = [];

  if (status === 'all') {
    conditions.push({ status: { $ne: 'session' } });
  } else {
    conditions.push({ status });
  }

  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    if (Object.keys(range).length) {
      conditions.push({ createdAt: range });
    }
  }

  if (searchRaw) {
    const esc = escapeRegex(searchRaw);
    const rx = new RegExp(esc, 'i');
    const or = [
      { orderNumber: rx },
      { customerEmail: rx },
      { 'guestShipping.name': rx },
      { 'guestShipping.email': rx },
      { 'guestShipping.fullAddress': rx },
      { 'guestShipping.phone': rx },
      { 'items.productName': rx },
    ];
    if (mongoose.Types.ObjectId.isValid(searchRaw)) {
      try {
        or.push({ _id: new mongoose.Types.ObjectId(searchRaw) });
      } catch (_) {
        /* ignore */
      }
    }
    conditions.push({ $or: or });
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions };
};

const getOrders = async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const searchRaw = req.query.search != null ? String(req.query.search).trim() : '';
    const dateFrom = req.query.dateFrom != null ? String(req.query.dateFrom).trim() : '';
    const dateTo = req.query.dateTo != null ? String(req.query.dateTo).trim() : '';

    let page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const filter = buildAdminOrdersListFilter({ status, searchRaw, dateFrom, dateTo });

    const totalCount = await Orders.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    page = Math.min(page, totalPages);
    const skip = (page - 1) * limit;

    const orders = await Orders.find(filter)
      .populate('items.product', 'name image')
      .populate('addressId', 'name phone fullAddress city state pincode addressType')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'orderNumber customerEmail paymentMethod paymentCards status paymentStatus subtotal taxAmount shippingAmount totalAmount remainingAmount requestedPaymentAmount requestedPaymentAt items createdAt estimatedDelivery deliveredAt addressId userId guestShipping'
      )
      .lean();

    res.status(200).json({
      success: true,
      data: orders,
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
          search: searchRaw || undefined,
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

const getAdminOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }
    const order = await Orders.findById(id)
      .populate('items.product', 'name image category')
      .populate('addressId', 'name phone fullAddress city state pincode addressType')
      .populate('userId', 'name email firstName lastName phone role isActive isDeleted')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('getAdminOrderById error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch order' });
  }
};

const exportOrdersCsv = async (req, res) => {
  try {
    const status = req.query.status || "all";
    const searchRaw = req.query.search != null ? String(req.query.search).trim() : "";
    const dateFrom = req.query.dateFrom != null ? String(req.query.dateFrom).trim() : "";
    const dateTo = req.query.dateTo != null ? String(req.query.dateTo).trim() : "";
    const exportSummary =
      String(req.query.summary || "").trim() === "1" ||
      String(req.query.format || "").toLowerCase() === "summary";
    if (dateFrom && dateTo) {
      const a = new Date(dateFrom);
      const b = new Date(dateTo);
      if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a > b) {
        return res.status(400).json({
          success: false,
          message: "Export failed: start date must be on or before end date.",
        });
      }
    }
    const filter = buildAdminOrdersListFilter({ status, searchRaw, dateFrom, dateTo });

    const orders = await Orders.find(filter)
      .populate('items.product', 'name image category')
      .populate('addressId', 'name phone fullAddress city state pincode addressType')
      .populate('userId', 'name email firstName lastName phone role isActive isDeleted')
      .sort({ createdAt: -1 })
      .lean();

    const escapeCsv = (value) => {
      const str = value == null ? "" : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    if (exportSummary) {
      const sumHeaders = [
        "orderId",
        "orderNumber",
        "customerName",
        "customerEmail",
        "date",
        "status",
        "totalAmount",
      ];
      const sumRows = orders.map((order) => {
        const customerName =
          order.userId?.name ||
          order.addressId?.name ||
          order.guestShipping?.name ||
          "";
        const customerEmail =
          order.customerEmail ||
          order.userId?.email ||
          order.guestShipping?.email ||
          "";
        return [
          order._id || "",
          order.orderNumber || "",
          customerName,
          customerEmail,
          order.createdAt ? new Date(order.createdAt).toISOString() : "",
          order.status || "",
          Number(order.totalAmount || 0),
        ]
          .map(escapeCsv)
          .join(",");
      });
      const sumCsv = [sumHeaders.join(","), ...sumRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders-summary-${Date.now()}.csv"`
      );
      return res.status(200).send(sumCsv);
    }

    const headers = [
      "orderId",
      "orderNumber",
      "userId",
      "addressId",
      "status",
      "paymentStatus",
      "paymentMethod",
      "subtotal",
      "taxAmount",
      "shippingAmount",
      "discountAmount",
      "tipAmount",
      "serviceFee",
      "totalAmount",
      "remainingAmount",
      "currency",
      "createdAt",
      "updatedAt",
      "paidAt",
      "estimatedDelivery",
      "deliveredAt",
      "actualDeliveryDate",
      "trackingNumber",
      "carrier",
      "shippingLabelUrl",
      "isShippingOrder",
      "notes",
      "deliveryInstructions",
      "orderSource",
      "customerType",
      "processingTime",
      "fulfillmentTime",
      "cancellationReason",
      "refundAmount",
      "refundDate",
      "refundReason",
      "stripePaymentIntentId",
      "stripePaymentMethodId",
      "stripeSessionId",
      "requestedPaymentAmount",
      "requestedPaymentAt",
      "customerName",
      "customerEmail",
      "customerPhone",
      "userSnapshotJson",
      "addressSnapshotJson",
      "couponJson",
      "paymentCardsJson",
      "statusHistoryJson",
      "itemsJson",
    ];

    const rows = orders.map((order) => {
      const userSnapshot = order.userId
        ? {
            _id: order.userId._id,
            firstName: order.userId.firstName,
            lastName: order.userId.lastName,
            name: order.userId.name,
            email: order.userId.email,
            phone: order.userId.phone,
            role: order.userId.role,
            isActive: order.userId.isActive,
            isDeleted: order.userId.isDeleted,
          }
        : null;

      const addressSnapshot = order.addressId
        ? {
            _id: order.addressId._id,
            name: order.addressId.name,
            phone: order.addressId.phone,
            fullAddress: order.addressId.fullAddress,
            city: order.addressId.city,
            state: order.addressId.state,
            pincode: order.addressId.pincode,
            addressType: order.addressId.addressType,
          }
        : null;

      const itemsJson = JSON.stringify(
        (order.items || []).map((item) => ({
          product: item.product?._id || item.product || null,
          productName: item.productName || item.product?.name || "",
          productImage: item.productImage || "",
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          subtotal: Number(item.subtotal || 0),
          productSku: item.productSku || "",
          productCategory: item.productCategory || item.product?.category || "",
          selectedWeight: item.selectedWeight ?? null,
          productSnapshot: item.product
            ? {
                _id: item.product._id || item.product,
                name: item.product.name || item.productName || "Restored Product",
                image: item.product.image || item.productImage || "",
                category: item.product.category || item.productCategory || "Daily Essentials",
              }
            : null,
        }))
      );

      return [
        order._id || "",
        order.orderNumber,
        order.userId?._id || "",
        order.addressId?._id || "",
        order.status || "",
        order.paymentStatus || "",
        order.paymentMethod || "",
        Number(order.subtotal || 0),
        Number(order.taxAmount || 0),
        Number(order.shippingAmount || 0),
        Number(order.discountAmount || 0),
        Number(order.tipAmount || 0),
        Number(order.serviceFee || 0),
        Number(order.totalAmount || 0),
        Number(order.remainingAmount || 0),
        order.currency || "USD",
        order.createdAt ? new Date(order.createdAt).toISOString() : "",
        order.updatedAt ? new Date(order.updatedAt).toISOString() : "",
        order.paidAt ? new Date(order.paidAt).toISOString() : "",
        order.estimatedDelivery ? new Date(order.estimatedDelivery).toISOString() : "",
        order.deliveredAt ? new Date(order.deliveredAt).toISOString() : "",
        order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toISOString() : "",
        order.trackingNumber || "",
        order.carrier || "",
        order.shippingLabelUrl || "",
        Boolean(order.isShippingOrder),
        order.notes || "",
        order.deliveryInstructions || "",
        order.orderSource || "web",
        order.customerType || "new",
        Number(order.processingTime || 0),
        Number(order.fulfillmentTime || 0),
        order.cancellationReason || "",
        Number(order.refundAmount || 0),
        order.refundDate ? new Date(order.refundDate).toISOString() : "",
        order.refundReason || "",
        order.stripePaymentIntentId || "",
        order.stripePaymentMethodId || "",
        order.stripeSessionId || "",
        Number(order.requestedPaymentAmount || 0),
        order.requestedPaymentAt ? new Date(order.requestedPaymentAt).toISOString() : "",
        order.userId?.name || order.addressId?.name || "",
        order.userId?.email || "",
        order.addressId?.phone || "",
        JSON.stringify(userSnapshot || {}),
        JSON.stringify(addressSnapshot || {}),
        JSON.stringify(order.coupon || {}),
        JSON.stringify(order.paymentCards || {}),
        JSON.stringify(order.statusHistory || []),
        itemsJson,
      ].map(escapeCsv).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders-export-${Date.now()}.csv"`
    );
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Export orders CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export orders CSV",
    });
  }
};

const importOrdersCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Upload a spreadsheet file",
      });
    }

    const importExt = path.extname(req.file.originalname || "").toLowerCase();
    if (![".csv", ".xlsx", ".xls"].includes(importExt)) {
      return res.status(400).json({
        success: false,
        message: "Upload a .csv, .xls, or .xlsx file",
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "File has no data rows",
      });
    }

    const validStatuses = ORDER_STATUSES.filter((s) => s !== "session");
    const validPaymentStatuses = ['pending', 'paid', 'completed', 'failed', 'refunded', 'partial_refund', 'partial'];
    const validPaymentMethods = ['stripe', 'otc', 'card', 'cash_on_delivery'];

    const safeParseJson = (value, fallback) => {
      try {
        if (value == null || value === "") return fallback;
        const parsed = JSON.parse(String(value));
        return parsed ?? fallback;
      } catch {
        return fallback;
      }
    };

    const normalizeName = (rawName) => {
      const name = String(rawName || "").trim();
      if (!name) return { firstName: "Customer", lastName: "Restored", name: "Customer Restored" };
      const parts = name.split(/\s+/);
      const firstName = (parts.shift() || "Customer").replace(/[^a-zA-Z]/g, "") || "Customer";
      const lastName = (parts.join(" ") || "Restored").replace(/[^a-zA-Z\s]/g, "") || "Restored";
      return { firstName, lastName, name: `${firstName} ${lastName}`.trim() };
    };

    const ensureUser = async (row, userSnapshot) => {
      const rawUserId = String(row.userId || "").trim();
      const candidateEmail =
        String(userSnapshot?.email || row.customerEmail || "").trim().toLowerCase() ||
        `restored+${rawUserId || Date.now()}@example.com`;
      const { firstName, lastName, name } = normalizeName(userSnapshot?.name || row.customerName || userSnapshot?.firstName);
      const role = ['customer', 'admin', 'co-admin', 'moderator'].includes(String(userSnapshot?.role || "").trim())
        ? String(userSnapshot.role).trim()
        : "customer";

      if (rawUserId && /^[a-fA-F0-9]{24}$/.test(rawUserId)) {
        let existing = await User.findById(rawUserId);
        if (existing) return existing._id;

        // create user with provided _id for stable relationship restore
        const created = await User.create({
          _id: new mongoose.Types.ObjectId(rawUserId),
          firstName,
          lastName,
          name,
          email: candidateEmail,
          password: "Restore@12345",
          phone: userSnapshot?.phone || row.customerPhone || "",
          role,
          isActive: userSnapshot?.isActive !== false,
          isDeleted: Boolean(userSnapshot?.isDeleted),
        });
        return created._id;
      }

      const byEmail = await User.findOne({ email: candidateEmail });
      if (byEmail) return byEmail._id;

      const created = await User.create({
        firstName,
        lastName,
        name,
        email: candidateEmail,
        password: "Restore@12345",
        phone: userSnapshot?.phone || row.customerPhone || "",
        role,
      });
      return created._id;
    };

    const ensureAddress = async (row, userId, addressSnapshot) => {
      const rawAddressId = String(row.addressId || "").trim();
      const baseAddress = {
        userId,
        name: addressSnapshot?.name || row.customerName || "Customer",
        phone: addressSnapshot?.phone || row.customerPhone || "0000000000",
        fullAddress: addressSnapshot?.fullAddress || "Restored address",
        city: addressSnapshot?.city || "City",
        state: addressSnapshot?.state || "State",
        pincode: addressSnapshot?.pincode || "000000",
        addressType: addressSnapshot?.addressType || "Home",
      };

      if (rawAddressId && /^[a-fA-F0-9]{24}$/.test(rawAddressId)) {
        const existing = await Address.findById(rawAddressId);
        if (existing) return existing._id;

        const created = await Address.create({
          _id: new mongoose.Types.ObjectId(rawAddressId),
          ...baseAddress,
        });
        return created._id;
      }

      const existing = await Address.findOne({
        userId,
        fullAddress: baseAddress.fullAddress,
        pincode: baseAddress.pincode,
      });
      if (existing) return existing._id;

      const created = await Address.create(baseAddress);
      return created._id;
    };

    const ensureProduct = async (item) => {
      const rawProductId = String(item.product || item.productSnapshot?._id || "").trim();
      const productName = String(item.productName || item.productSnapshot?.name || "Restored Product").trim() || "Restored Product";
      const category = String(item.productCategory || item.productSnapshot?.category || "Daily Essentials").trim() || "Daily Essentials";
      const price = Number(item.price || 0);

      if (rawProductId && /^[a-fA-F0-9]{24}$/.test(rawProductId)) {
        const existing = await Products.findById(rawProductId);
        if (existing) return existing._id;

        const created = await Products.create({
          _id: new mongoose.Types.ObjectId(rawProductId),
          name: productName,
          description: "Restored from orders CSV backup",
          price,
          salePrice: 0,
          category,
          image: item.productImage || item.productSnapshot?.image || "",
          quantity: 0,
          inStock: false,
          cost: 0,
        });
        return created._id;
      }

      const byName = await Products.findOne({ name: productName });
      if (byName) return byName._id;

      const created = await Products.create({
        name: productName,
        description: "Restored from orders CSV backup",
        price,
        salePrice: 0,
        category,
        image: item.productImage || item.productSnapshot?.image || "",
        quantity: 0,
        inStock: false,
        cost: 0,
      });
      return created._id;
    };

    const successRows = [];
    const failedRows = [];
    const seenOrderNumbers = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];

      try {
        const orderNumber = String(row.orderNumber || "").trim();
        if (!orderNumber) throw new Error("orderNumber is required");
        if (seenOrderNumbers.has(orderNumber)) {
          throw new Error(`Duplicate orderNumber in file: ${orderNumber}`);
        }
        seenOrderNumbers.add(orderNumber);

        const userSnapshot = safeParseJson(row.userSnapshotJson, {});
        const addressSnapshot = safeParseJson(row.addressSnapshotJson, {});
        const couponJson = safeParseJson(row.couponJson, {});
        const paymentCardsJson = safeParseJson(row.paymentCardsJson, {});
        const statusHistoryJson = safeParseJson(row.statusHistoryJson, []);
        const items = safeParseJson(row.itemsJson, []);
        if (!Array.isArray(items)) throw new Error("itemsJson must be a JSON array");

        const resolvedUserId = await ensureUser(row, userSnapshot || {});
        const resolvedAddressId = await ensureAddress(row, resolvedUserId, addressSnapshot || {});

        const normalizedItems = [];
        for (const rawItem of items) {
          const item = rawItem || {};
          const productId = await ensureProduct(item);
          normalizedItems.push({
            product: productId,
            productName: item.productName || item.productSnapshot?.name || "",
            productImage: item.productImage || item.productSnapshot?.image || "",
            price: Number(item.price || 0),
            quantity: Math.max(1, Number(item.quantity || 1)),
            subtotal: Number(item.subtotal || (Number(item.price || 0) * Number(item.quantity || 1))),
            productSku: item.productSku || "",
            productCategory: item.productCategory || item.productSnapshot?.category || "",
            selectedWeight: item.selectedWeight ?? undefined,
          });
        }

        const subtotal = Number(row.subtotal || 0);
        const taxAmount = Number(row.taxAmount || 0);
        const shippingAmount = Number(row.shippingAmount || 0);
        const discountAmount = Number(row.discountAmount || 0);
        const tipAmount = Number(row.tipAmount || 0);
        const serviceFee = Number(row.serviceFee || 0);
        const totalAmount = Number(row.totalAmount || 0);
        const remainingAmount = Number(row.remainingAmount || 0);

        const status = validStatuses.includes(String(row.status || "").trim())
          ? String(row.status).trim()
          : "pending";
        const paymentStatus = validPaymentStatuses.includes(String(row.paymentStatus || "").trim())
          ? String(row.paymentStatus).trim()
          : "pending";
        const paymentMethod = validPaymentMethods.includes(String(row.paymentMethod || "").trim())
          ? String(row.paymentMethod).trim()
          : "stripe";

        const orderSource = ['web', 'mobile', 'admin'].includes(String(row.orderSource || "").trim())
          ? String(row.orderSource || "").trim()
          : "web";
        const customerType = ['new', 'returning'].includes(String(row.customerType || "").trim())
          ? String(row.customerType || "").trim()
          : "new";

        const updateDoc = {
          userId: resolvedUserId,
          addressId: resolvedAddressId,
          status,
          paymentStatus,
          paymentMethod,
          subtotal,
          taxAmount,
          shippingAmount,
          discountAmount,
          tipAmount,
          serviceFee,
          totalAmount,
          remainingAmount,
          currency: String(row.currency || "USD"),
          items: normalizedItems,
          coupon: couponJson && typeof couponJson === "object" ? couponJson : {},
          paymentCards: paymentCardsJson && typeof paymentCardsJson === "object" ? paymentCardsJson : {},
          statusHistory: Array.isArray(statusHistoryJson) ? statusHistoryJson : [],
          paidAt: row.paidAt ? new Date(row.paidAt) : undefined,
          estimatedDelivery: row.estimatedDelivery ? new Date(row.estimatedDelivery) : undefined,
          deliveredAt: row.deliveredAt ? new Date(row.deliveredAt) : undefined,
          actualDeliveryDate: row.actualDeliveryDate ? new Date(row.actualDeliveryDate) : undefined,
          trackingNumber: String(row.trackingNumber || ""),
          carrier: String(row.carrier || ""),
          shippingLabelUrl: String(row.shippingLabelUrl || ""),
          isShippingOrder: String(row.isShippingOrder || "").toLowerCase() === "true",
          notes: String(row.notes || ""),
          deliveryInstructions: String(row.deliveryInstructions || ""),
          orderSource,
          customerType,
          processingTime: Number(row.processingTime || 0),
          fulfillmentTime: Number(row.fulfillmentTime || 0),
          cancellationReason: String(row.cancellationReason || ""),
          refundAmount: Number(row.refundAmount || 0),
          refundDate: row.refundDate ? new Date(row.refundDate) : undefined,
          refundReason: String(row.refundReason || ""),
          stripePaymentIntentId: String(row.stripePaymentIntentId || ""),
          stripePaymentMethodId: String(row.stripePaymentMethodId || ""),
          stripeSessionId: String(row.stripeSessionId || ""),
          requestedPaymentAmount: Number(row.requestedPaymentAmount || 0),
          requestedPaymentAt: row.requestedPaymentAt ? new Date(row.requestedPaymentAt) : undefined,
        };

        const rawOrderId = String(row.orderId || "").trim();
        const orderFilter = rawOrderId && /^[a-fA-F0-9]{24}$/.test(rawOrderId)
          ? { _id: rawOrderId }
          : { orderNumber };

        await Orders.updateOne(
          orderFilter,
          {
            $set: updateDoc,
            $setOnInsert: {
              ...(rawOrderId && /^[a-fA-F0-9]{24}$/.test(rawOrderId)
                ? { _id: new mongoose.Types.ObjectId(rawOrderId) }
                : {}),
              orderNumber,
              createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
            },
          },
          { upsert: true }
        );

        successRows.push(rowNum);
      } catch (err) {
        failedRows.push({ row: rowNum, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "CSV import completed",
      importedCount: successRows.length,
      failedCount: failedRows.length,
      failedRows,
    });
  } catch (error) {
    console.error("Import orders CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import orders CSV",
    });
  }
};

const cancelPaymentRequest = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.requestedPaymentAmount = undefined;
    order.requestedPaymentAt = undefined;
    await order.save();

    res.json({
      success: true,
      message: 'Payment request cancelled'
    });
  } catch (error) {
    console.error('Cancel payment request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling payment request'
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, carrier } = req.body;

    if (!VALID_ADMIN_TRANSITION_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Orders.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('addressId', 'name fullAddress city state pincode phone')
      .populate('items.product', 'name image');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    if (typeof trackingNumber === 'string') {
      order.trackingNumber = trackingNumber.trim();
    }
    if (typeof carrier === 'string') {
      order.carrier = carrier.trim();
    }
    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });

    const orderIdForMail = order._id;
    setImmediate(() => {
      loadOrderForMail(orderIdForMail)
        .then((fresh) => sendOrderStatusChangeEmail(fresh || order, status))
        .catch((err) => console.error('Order status email error:', err?.message || err));
    });

  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ success: false, message: 'Server error updating order status' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { role, search, status } = req.query;

    const and = [
      {
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      },
    ];

    if (role && role !== 'all') {
      if (role === 'admin') {
        and.push({ role: { $in: ['admin', 'co-admin', 'moderator'] } });
      } else if (role === 'customer') {
        and.push({ role: 'customer' });
      } else if (['co-admin', 'moderator'].includes(role)) {
        and.push({ role });
      }
    }

    const searchTrim = typeof search === 'string' ? search.trim() : '';
    if (searchTrim) {
      const esc = searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      and.push({
        $or: [
          { name: { $regex: esc, $options: 'i' } },
          { email: { $regex: esc, $options: 'i' } },
          { firstName: { $regex: esc, $options: 'i' } },
          { lastName: { $regex: esc, $options: 'i' } },
        ],
      });
    }

    const baseAnd = [...and];

    if (status === 'active') {
      and.push({ isActive: true });
    } else if (status === 'inactive') {
      and.push({ isActive: false });
    }

    const listQuery = { $and: and };
    const statsQuery = {
      $and: [
        ...baseAnd,
        { role: { $in: ['admin', 'co-admin', 'moderator'] } },
      ],
    };

    const skip = (page - 1) * limit;

    const [users, total, activeUsers, inactiveUsers, adminUsers] = await Promise.all([
      User.find(listQuery, '-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(listQuery),
      User.countDocuments({ $and: [...baseAnd, { isActive: true }] }),
      User.countDocuments({ $and: [...baseAnd, { isActive: false }] }),
      User.countDocuments(statsQuery),
    ]);

    res.json({
      users,
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
      totalUsers: total,
      stats: {
        activeUsers,
        inactiveUsers,
        adminUsers,
      },
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: !user.isActive } },
      { new: true }
    );

    res.json({
      status: true,
      message: updatedUser.isActive
        ? "User Unblocked Successfully"
        : "User Blocked Successfully",
      data: updatedUser
    });

  } catch (error) {
    console.error("Status update error:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.isDeleted = true
    await user.save()
    res.json({
      status: true,
      message: "User Delete Success!",
      data: user
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['customer', 'admin', 'co-admin', 'moderator'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent changing own role
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    user.role = role;
    await user.save();

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('User role update error:', error);
    res.status(500).json({ message: 'Server error updating user role' });
  }
};

const uploadBulkExcelProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: "Excel file required"
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({
        error: true,
        message: "Excel sheet is empty"
      });
    }

    const bulkOps = [];
    const failedRows = [];

    const safeTrim = (value) => {
      if (typeof value === "string") return value.trim();
      return value;
    };


    rows.forEach((row, index) => {
      try {
        if (!row.name || !row.category) {
          throw new Error("Name or Category missing");
        }

        const name = safeTrim(row.name);
        const category = safeTrim(row.category);
        const description = safeTrim(row.description);
        const image = safeTrim(row.image);
        const unit = safeTrim(row.unit);
        const tagsRaw = safeTrim(row.tags);

        const quantity =
          Number(
            safeTrim(row.quantity || row["quantity\n"])
          ) || 0;

        const cost = Number(safeTrim(row.cost)) || 0;
        const price = Number(safeTrim(row.price)) || 0;
        const salePrice = Number(safeTrim(row.salePrice ?? row.sale_price ?? row.finalPrice)) || 0;

        const inStock =
          String(safeTrim(row.inStock)).toLowerCase() === "yes" ||
          String(safeTrim(row.instock)).toLowerCase() === "yes"

        if (!name || !category) {
          throw new Error("Name or Category missing");
        }

        bulkOps.push({
          updateOne: {
            filter: { name: name },
            update: {
              $set: {
                name,
                description: description || "",
                price,
                salePrice,
                cost,
                category,
                image: image || "",
                quantity,
                inStock,
                unit: unit || "piece",
                tags: tagsRaw
                  ? tagsRaw.split(",").map(t => t.trim())
                  : [],
              }
            },
            upsert: true
          }
        });

      } catch (err) {
        failedRows.push({
          row: index + 2,
          error: err.message
        });
      }
    });

    if (bulkOps.length) {
      await Products.bulkWrite(bulkOps);
    }


    res.status(200).json({
      error: false,
      message: "Bulk upload completed",
      successCount: bulkOps.length,
      failedCount: failedRows.length,
      failedRows
    });
  } catch (error) {
    console.error('Bulk upload products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading bulk products'
    });
  }
}

const getProductAnalytics = async (req, res) => {
  try {
    const topProducts = await Orders.aggregate([
      { $unwind: '$items' },
      { $match: { paymentStatus: PAID_REVENUE_PAYMENT_STATUSES } },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          category: '$product.category',
          totalSold: 1,
          totalRevenue: 1
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // Products by category
    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          averagePrice: { $avg: '$price' },
          totalStock: { $sum: '$quantity' }
        }
      }
    ]);

    res.json({
      topProducts,
      categoryStats
    });
  } catch (error) {
    console.error('Product analytics error:', error);
    res.status(500).json({ message: 'Server error fetching product analytics' });
  }
};

const getAllMessages = async (req, res) => {
  try {
    const {
      page: pageRaw = 1,
      limit: limitRaw = 20,
      status: statusRaw,
      priority,
      search: searchRaw,
      folder: folderRaw,
      dateFrom: dateFromRaw,
      dateTo: dateToRaw,
      sortOrder: sortOrderRaw,
    } = req.query;

    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20));
    const query = {};

    const folder = String(folderRaw || 'inbox').toLowerCase();
    if (folder === 'trash') {
      query.inTrash = true;
    } else {
      query.inTrash = { $ne: true };
    }

    let status = statusRaw;
    if (folder !== 'trash' && status && status !== 'all') {
      if (status === 'replied') status = 'responded';
      if (status === 'resolved') status = 'closed';
      query.status = status;
    }

    if (folder !== 'trash' && priority && priority !== 'all') {
      query.priority = priority;
    }

    const dateFrom = dateFromRaw && String(dateFromRaw).trim();
    const dateTo = dateToRaw && String(dateToRaw).trim();
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!Number.isNaN(d.getTime())) query.createdAt.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          query.createdAt.$lte = d;
        }
      }
      if (query.createdAt && Object.keys(query.createdAt).length === 0) {
        delete query.createdAt;
      }
    }

    const searchTrim = searchRaw && String(searchRaw).trim();
    if (searchTrim) {
      const escaped = searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      query.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
        { subject: rx },
        { message: rx },
        { queryType: rx },
      ];
    }

    const sortDir = String(sortOrderRaw || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const total = await ContactUs.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    let effectivePage = Math.min(page, totalPages);

    const skip = (effectivePage - 1) * limit;

    const messages = await ContactUs.find(query)
      .sort({ createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      message: 'Success',
      data: messages,
      totalPages,
      currentPage: effectivePage,
      totalMessages: total,
    });
  } catch (error) {
    console.error('Admin messages fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching messages' });
  }
};

const createMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message, inquiryType } = req.body;
    const nameFromParts = [firstName, lastName].filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join(' ').trim();
    const displayName = nameFromParts || String(email || '').trim() || 'Unknown';

    let replyTpl = '';
    try {
      const s = await AppSettings.findOne().lean();
      replyTpl = s && s.contactAutoReplyMessage != null ? String(s.contactAutoReplyMessage).trim() : '';
    } catch {
      /* ignore */
    }
    const autoAcknowledgment = resolveContactAutoReplyMessage(replyTpl || null, displayName);

    const newMessage = new ContactUs({
      name: displayName,
      email: String(email || '').trim().toLowerCase(),
      subject: String(subject || '').trim(),
      message: String(message || '').trim(),
      queryType: inquiryType != null && String(inquiryType).trim() ? String(inquiryType).trim() : 'general',
      status: 'new',
      autoAcknowledgment,
    });

    await newMessage.save();

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Message creation error:', error);
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
};

const replyToMessage = async (req, res) => {
  const joiSchema = Joi.object({
    id: Joi.string().length(24).hex().required(),
    replyMessage: Joi.string().min(1).required()
  });
  try {
    await joiSchema.validateAsync(req.body, { abortEarly: true });
    const { replyMessage, id } = req.body;

    const message = await ContactUs.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.inTrash) {
      return res.status(400).json({ success: false, message: 'Restore this message from Trash before replying.' });
    }

    if (message.status === 'responded') {
      return res.status(400).json({ success: false, message: 'You are alredy send reply!' });
    }

    message.status = 'responded';
    message.response = replyMessage;
    await message.save()

    res.json({
      success: true,
      message: 'Reply sent successfully',
      data: message
    });

    setImmediate(async () => {

      const displayName = (message.name && String(message.name).trim()) || message.email || 'Customer';
      const userMailOptions = {
        to: message.email,
        subject: "Thank you for contacting Zippyy",
        html: `<h2>Response to your query</h2>
<p>Dear ${displayName},</p>
<p>Thank you for reaching out to us. Here is the response to your message:</p>
<br>
<div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px;">
    <p><strong>Your original message:</strong></p>
    <p><em>${message.subject}</em></p>
    <p>${message.message.replace(/\n/g, '<br>')}</p>
</div>
<br>
<div style="border-left: 4px solid #4f46e5; padding-left: 15px;">
    <p><strong>Admin Response:</strong></p>
    <p>${replyMessage.replace(/\n/g, '<br>')}</p>
</div>
<br>
<p>Best regards,<br> Zippyy Team</p>`
      };

      await sendMail(userMailOptions)
    })


  } catch (error) {
    if (error.isJoi) {
      const mapError = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('Message reply error:', error);
    res.status(500).json({ success: false, message: 'Server error sending reply' });
  }
};

const getMessageStats = async (req, res) => {
  try {
    const notTrash = { inTrash: { $ne: true } };
    const totalMessages = await ContactUs.countDocuments(notTrash);
    const trash = await ContactUs.countDocuments({ inTrash: true });
    const byStatus = await ContactUs.aggregate([
      { $match: notTrash },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusCounts = {
      unread: 0,
      read: 0,
      replied: 0,
      resolved: 0,
    };

    byStatus.forEach((stat) => {
      if (stat._id === 'new') statusCounts.unread = stat.count;
      else if (stat._id === 'read') statusCounts.read = stat.count;
      else if (stat._id === 'responded') statusCounts.replied = stat.count;
      else if (stat._id === 'closed') statusCounts.resolved = stat.count;
    });

    res.json({
      success: true,
      stats: {
        total: totalMessages,
        trash,
        ...statusCounts,
      },
    });
  } catch (error) {
    console.error('Message stats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching message statistics' });
  }
};

const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id' });
    }
    const message = await ContactUs.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    if (message.status === 'new') {
      message.status = 'read';
      await message.save();
    }
    res.json({ success: true, data: message });
  } catch (error) {
    console.error('getMessageById error:', error);
    res.status(500).json({ success: false, message: 'Server error loading message' });
  }
};

const deleteMessagesMany = async (req, res) => {
  const schema = Joi.object({
    ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  });
  try {
    const { ids } = await schema.validateAsync(req.body, { abortEarly: true });
    const result = await ContactUs.updateMany(
      { _id: { $in: ids }, inTrash: { $ne: true } },
      { $set: { inTrash: true, trashedAt: new Date() } }
    );
    res.json({
      success: true,
      movedCount: result.modifiedCount,
      deletedCount: result.modifiedCount,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array' });
    }
    console.error('deleteMessagesMany error:', error);
    res.status(500).json({ success: false, message: 'Server error moving messages to trash' });
  }
};

const restoreMessagesMany = async (req, res) => {
  const schema = Joi.object({
    ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  });
  try {
    const { ids } = await schema.validateAsync(req.body, { abortEarly: true });
    const result = await ContactUs.updateMany(
      { _id: { $in: ids }, inTrash: true },
      { $set: { inTrash: false }, $unset: { trashedAt: '' } }
    );
    res.json({ success: true, restoredCount: result.modifiedCount });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array' });
    }
    console.error('restoreMessagesMany error:', error);
    res.status(500).json({ success: false, message: 'Server error restoring messages' });
  }
};

const permanentDeleteMessagesMany = async (req, res) => {
  const schema = Joi.object({
    ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  });
  try {
    const { ids } = await schema.validateAsync(req.body, { abortEarly: true });
    const result = await ContactUs.deleteMany({ _id: { $in: ids }, inTrash: true });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array' });
    }
    console.error('permanentDeleteMessagesMany error:', error);
    res.status(500).json({ success: false, message: 'Server error permanently deleting messages' });
  }
};

/** Soft-delete one message (move to trash). Same behaviour as POST /messages/delete-many with one id. */
const deleteMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id' });
    }
    const result = await ContactUs.updateOne(
      { _id: id, inTrash: { $ne: true } },
      { $set: { inTrash: true, trashedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or already in Trash',
      });
    }
    res.json({ success: true, movedCount: result.modifiedCount, deletedCount: result.modifiedCount });
  } catch (error) {
    console.error('deleteMessageById error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting message' });
  }
};

const settingsResponse = (doc) => {
  const contactAutoReplyRaw =
    doc.contactAutoReplyMessage != null ? String(doc.contactAutoReplyMessage) : '';
  const contactAutoReplyTrim = contactAutoReplyRaw.trim();
  return {
  websiteName:
    doc.websiteName != null && String(doc.websiteName).trim() !== ''
      ? String(doc.websiteName).trim()
      : 'Zippyyy',
  websiteLogoUrl: normalizeStoredUploadsUrl(
    doc.websiteLogoUrl ? String(doc.websiteLogoUrl).trim() : '',
  ),
  websiteFaviconUrl: normalizeStoredUploadsUrl(
    doc.websiteFaviconUrl ? String(doc.websiteFaviconUrl).trim() : '',
  ),
  adminMail: doc.adminMail || '',
  contactFormToEmailPrimary: doc.contactFormToEmailPrimary || '',
  contactFormToEmailSecondary: doc.contactFormToEmailSecondary || '',
  homeFeaturedSectionTitle: doc.homeFeaturedSectionTitle || 'Featured Categories',
  contactAutoReplyMessage: contactAutoReplyRaw,
  contactAutoReplyPreview: resolveContactAutoReplyMessage(
    contactAutoReplyTrim ? contactAutoReplyTrim : null,
    'Alex',
  ),
  contactAutoReplyDefaultTemplate: DEFAULT_CONTACT_AUTO_REPLY_TEMPLATE,
  smtpHost: doc.smtpHost || '',
  smtpPort: doc.smtpPort ?? 587,
  smtpEncryption: doc.smtpEncryption || 'tls',
  smtpUser: doc.smtpUser || '',
  smtpPassSet: Boolean(doc.smtpPass && String(doc.smtpPass).length > 0),
  smtpFromEmail: doc.smtpFromEmail || '',
  smtpFromName: doc.smtpFromName || 'Zippyyy',
};
};

const getAdminSettings = async (req, res) => {
  try {
    let doc = await AppSettings.findOne();
    if (!doc) {
      doc = await AppSettings.create({});
    }
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.json({
      success: true,
      data: settingsResponse(doc),
    });
  } catch (error) {
    console.error('getAdminSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
};

const putAdminSettings = async (req, res) => {
  const schema = Joi.object({
    websiteName: Joi.string().trim().max(120).allow('').optional(),
    websiteLogoUrl: Joi.string().trim().max(2048).allow('', null).optional(),
    websiteFaviconUrl: Joi.string().trim().max(2048).allow('', null).optional(),
    adminMail: Joi.string().allow('').max(320).optional(),
    contactFormToEmailPrimary: Joi.string().allow('').max(320).optional(),
    contactFormToEmailSecondary: Joi.string().allow('').max(320).optional(),
    homeFeaturedSectionTitle: Joi.string().trim().max(120).allow('').optional(),
    contactAutoReplyMessage: Joi.string().allow('').max(8000).optional(),
    smtpHost: Joi.string().allow('').max(255).optional(),
    smtpPort: Joi.number().integer().min(1).max(65535).optional(),
    smtpEncryption: Joi.string().valid('tls', 'ssl', 'none').optional(),
    smtpUser: Joi.string().allow('').max(320).optional(),
    smtpPass: Joi.string().allow('').optional(),
    smtpFromEmail: Joi.string().allow('').max(320).optional(),
    smtpFromName: Joi.string().allow('').max(120).optional(),
  });
  try {
    const raw = req.body || {};
    const body = await schema.validateAsync(raw, { abortEarly: true });
    const $set = {};
    const has = (k) => Object.prototype.hasOwnProperty.call(raw, k);

    if (has('websiteName')) {
      $set.websiteName = String(body.websiteName ?? '').trim() || 'Zippyyy';
    }
    if (has('websiteLogoUrl')) {
      $set.websiteLogoUrl = normalizeStoredUploadsUrl(
        body.websiteLogoUrl == null ? '' : String(body.websiteLogoUrl).trim(),
      );
    }
    if (has('websiteFaviconUrl')) {
      $set.websiteFaviconUrl = normalizeStoredUploadsUrl(
        body.websiteFaviconUrl == null ? '' : String(body.websiteFaviconUrl).trim(),
      );
    }
    if (has('adminMail')) $set.adminMail = String(body.adminMail ?? '').trim();
    if (has('contactFormToEmailPrimary')) {
      $set.contactFormToEmailPrimary = String(body.contactFormToEmailPrimary ?? '').trim();
    }
    if (has('contactFormToEmailSecondary')) {
      $set.contactFormToEmailSecondary = String(body.contactFormToEmailSecondary ?? '').trim();
    }
    if (has('homeFeaturedSectionTitle')) {
      $set.homeFeaturedSectionTitle = String(body.homeFeaturedSectionTitle ?? '').trim() || 'Featured Categories';
    }
    if (has('contactAutoReplyMessage')) {
      $set.contactAutoReplyMessage = String(body.contactAutoReplyMessage ?? '').trim();
    }
    if (has('smtpHost')) $set.smtpHost = String(body.smtpHost ?? '').trim();
    if (has('smtpPort')) $set.smtpPort = body.smtpPort;
    if (has('smtpEncryption')) $set.smtpEncryption = body.smtpEncryption;
    if (has('smtpUser')) $set.smtpUser = String(body.smtpUser ?? '').trim();
    if (has('smtpFromEmail')) $set.smtpFromEmail = String(body.smtpFromEmail ?? '').trim();
    if (has('smtpFromName')) $set.smtpFromName = String(body.smtpFromName ?? '').trim();
    if (has('smtpPass') && String(body.smtpPass ?? '').length > 0) {
      $set.smtpPass = String(body.smtpPass);
    }

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const doc = await AppSettings.findOneAndUpdate({}, { $set }, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    });
    res.json({
      success: true,
      data: settingsResponse(doc),
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('putAdminSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
};

const postAdminSettingsUploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = publicBrandingUrl(req, req.file.filename);
    const doc = await AppSettings.findOneAndUpdate(
      {},
      { $set: { websiteLogoUrl: url } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    });
    res.json({ success: true, data: settingsResponse(doc) });
  } catch (error) {
    console.error('postAdminSettingsUploadLogo error:', error);
    res.status(500).json({ success: false, message: 'Failed to save logo' });
  }
};

const postAdminSettingsUploadFavicon = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = publicBrandingUrl(req, req.file.filename);
    const doc = await AppSettings.findOneAndUpdate(
      {},
      { $set: { websiteFaviconUrl: url } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    });
    res.json({ success: true, data: settingsResponse(doc) });
  } catch (error) {
    console.error('postAdminSettingsUploadFavicon error:', error);
    res.status(500).json({ success: false, message: 'Failed to save favicon' });
  }
};

const smtpOverrideSchema = Joi.object({
  smtpHost: Joi.string().allow('').optional(),
  smtpPort: Joi.number().integer().min(1).max(65535).optional(),
  smtpEncryption: Joi.string().valid('tls', 'ssl', 'none').optional(),
  smtpUser: Joi.string().allow('').optional(),
  smtpPass: Joi.string().allow('').optional(),
  smtpFromEmail: Joi.string().allow('').optional(),
  smtpFromName: Joi.string().allow('').optional(),
});

const postSmtpVerify = async (req, res) => {
  try {
    const body = await smtpOverrideSchema.validateAsync(req.body || {}, { abortEarly: true });
    await verifySmtpConfig(body);
    return res.json({ success: true, message: 'SMTP connection verified successfully.' });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(400).json({
      success: false,
      message: error.message || 'SMTP verification failed',
    });
  }
};

const postSmtpTestEmail = async (req, res) => {
  const schema = Joi.object({
    to: Joi.string().email().required(),
    smtpHost: Joi.string().allow('').optional(),
    smtpPort: Joi.number().integer().min(1).max(65535).optional(),
    smtpEncryption: Joi.string().valid('tls', 'ssl', 'none').optional(),
    smtpUser: Joi.string().allow('').optional(),
    smtpPass: Joi.string().allow('').optional(),
    smtpFromEmail: Joi.string().allow('').optional(),
    smtpFromName: Joi.string().allow('').optional(),
  });
  try {
    const body = await schema.validateAsync(req.body || {}, { abortEarly: true });
    const { to, ...overrides } = body;
    await verifySmtpConfig(overrides);
    await sendMailWithOverrides(overrides, {
      to,
      subject: 'Test email — Zippyyy Admin',
      html: `
        <div style="font-family:system-ui,sans-serif;padding:24px;">
          <h2 style="margin:0 0 12px;">SMTP test</h2>
          <p style="color:#444;">If you received this message, your outgoing mail settings are working.</p>
          <p style="color:#888;font-size:12px;">${new Date().toISOString()}</p>
        </div>`,
    });
    return res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to send test email',
    });
  }
};

const getEmailTemplatesAdmin = async (req, res) => {
  try {
    await ensureDefaultTemplates();
    const data = await EmailTemplate.find().sort({ key: 1 }).lean();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getEmailTemplatesAdmin", error);
    return res.status(500).json({ success: false, message: "Failed to load email templates" });
  }
};

const putEmailTemplateByKey = async (req, res) => {
  const schema = Joi.object({
    subject: Joi.string().allow("").max(998).required(),
    bodyHtml: Joi.string().allow("").required(),
    isActive: Joi.boolean().optional(),
  });
  try {
    const body = await schema.validateAsync(req.body || {}, { abortEarly: true });
    const { key } = req.params;
    const allowed = TEMPLATE_DEFAULTS.map((t) => t.key);
    if (!allowed.includes(key)) {
      return res.status(400).json({ success: false, message: "Unknown template key" });
    }
    await ensureDefaultTemplates();
    const doc = await EmailTemplate.findOneAndUpdate(
      { key },
      {
        $set: {
          subject: body.subject,
          bodyHtml: body.bodyHtml,
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        },
      },
      { new: true, lean: true }
    );
    if (!doc) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }
    return res.json({ success: true, data: doc });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("putEmailTemplateByKey", error);
    return res.status(500).json({ success: false, message: "Failed to save template" });
  }
};

const postEmailTemplatePreview = async (req, res) => {
  const schema = Joi.object({
    key: Joi.string().required(),
    subject: Joi.string().allow("").required(),
    bodyHtml: Joi.string().allow("").required(),
  });
  try {
    const body = await schema.validateAsync(req.body || {}, { abortEarly: true });
    let vars;
    if (body.key === "contact_form_admin") {
      vars = buildContactTemplateVars({
        name: "Jane Doe",
        email: "jane@example.com",
        queryType: "Support",
        subject: "Sample subject",
        message: "This is a sample message.\nSecond line.",
      });
    } else {
      let sampleOrder = await Orders.findOne({ status: { $ne: "session" } })
        .populate("userId", "email name")
        .populate("items.product", "name image")
        .populate("addressId", "name phone fullAddress city state pincode")
        .sort({ createdAt: -1 })
        .lean();
      if (!sampleOrder) {
        sampleOrder = {
          _id: "507f1f77bcf86cd799439011",
          orderNumber: "ORD-SAMPLE",
          status: "processing",
          totalAmount: 49.99,
          trackingNumber: "1Z999AA10123456784",
          carrier: "UPS",
          items: [
            {
              productName: "Sample product",
              quantity: 2,
              price: 12.5,
              product: { name: "Sample product" },
            },
          ],
          addressId: {
            name: "Alex Customer",
            fullAddress: "123 Main St",
            city: "Chicago",
            state: "IL",
            pincode: "60601",
            phone: "+1 555-0100",
          },
          userId: { name: "Alex Customer", email: "alex@example.com" },
          customerEmail: "alex@example.com",
        };
      }
      vars = buildOrderTemplateVars(sampleOrder, { status: sampleOrder.status || "processing" });
    }
    return res.json({
      success: true,
      data: {
        subject: applyVariables(body.subject, vars),
        html: applyVariables(body.bodyHtml, vars),
      },
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("postEmailTemplatePreview", error);
    return res.status(500).json({ success: false, message: "Preview failed" });
  }
};

const createProduct = async (req, res) => {
  const createProductSchema = Joi.object({
    name: Joi.string().trim().min(2).required(),
    description: Joi.string().trim().required(),
    price: Joi.number().min(0).required(),
    comparePrice: Joi.number().min(0).optional(),
    salePrice: Joi.number().min(0).optional(),
    category: Joi.string().trim().required(),
    image: Joi.string().allow("").optional(),
    sku: Joi.string().trim().allow("").optional(),
    badge: Joi.string().trim().allow("").optional(),
    isDeal: Joi.boolean().optional(),
    dealPrice: Joi.number().min(0).optional(),
    isDisable: Joi.boolean().optional(),
    adminPrice: Joi.number().min(0).optional(),
    cost: Joi.number().min(0).optional().default(0),
    quantity: Joi.number().min(0).optional().default(0),
    inStock: Joi.boolean().optional(),
    unit: Joi.string().trim().optional().default("piece"),
    discount: Joi.number().min(0).max(100).optional().default(0),
    dealId: Joi.string().hex().length(24).optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    nutritionInfo: Joi.object({
      calories: Joi.number().optional(),
      protein: Joi.number().optional(),
      carbs: Joi.number().optional(),
      fat: Joi.number().optional(),
      fiber: Joi.number().optional(),
    }).optional(),
  });
  try {
    await createProductSchema.validateAsync(req.body, { abortEarly: true });
    const productData = req.body;

    productData.price = Number(productData.price);
    productData.cost = Number(productData.cost || 0);
    productData.salePrice = Number(productData.salePrice || 0);
    productData.comparePrice = Number(productData.comparePrice || 0);
    productData.dealPrice = Number(productData.dealPrice || 0);
    productData.isDeal = Boolean(productData.isDeal);
    productData.isDisable = Boolean(productData.isDisable);
    productData.sku = String(productData.sku || "").trim();
    if (productData.badge !== undefined) {
      productData.badge = String(productData.badge || "")
        .trim()
        .toLowerCase();
      if (!ALLOWED_PRODUCT_BADGES.has(productData.badge)) productData.badge = "";
    }

    const quantity =
      Number(productData.quantity ??
        productData.stockQuantity ??
        0);

    productData.quantity = quantity;
    productData.stockQuantity = quantity;
    productData.inStock = quantity > 0;

    productData.discount = Number(productData.discount || 0);
    productData.image = productData.image || "";
    productData.unit = productData.unit || "piece";
    productData.tags = Array.isArray(productData.tags)
      ? productData.tags
      : [];

    const product = new Products(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    if (error.isJoi) {
      const mapError = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('Create product error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
};

const updateProduct = async (req, res) => {
  const updateProductSchema = Joi.object({
    name: Joi.string().trim().min(2).optional(),
    description: Joi.string().trim().optional(),
    price: Joi.number().min(0).optional(),
    comparePrice: Joi.number().min(0).optional(),
    salePrice: Joi.number().min(0).optional(),
    category: Joi.string().trim().optional(),
    image: Joi.string().allow("").optional(),
    sku: Joi.string().trim().allow("").optional(),
    badge: Joi.string().trim().allow("").optional(),
    isDeal: Joi.boolean().optional(),
    dealPrice: Joi.number().min(0).optional(),
    isDisable: Joi.boolean().optional(),
    adminPrice: Joi.number().min(0).optional(),
    cost: Joi.number().min(0).optional(),
    quantity: Joi.number().min(0).optional(),
    inStock: Joi.boolean().optional(),
    unit: Joi.string().trim().optional(),
    discount: Joi.number().min(0).max(100).optional(),
    dealId: Joi.string().hex().length(24).optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    nutritionInfo: Joi.object({
      calories: Joi.number().optional(),
      protein: Joi.number().optional(),
      carbs: Joi.number().optional(),
      fat: Joi.number().optional(),
      fiber: Joi.number().optional(),
    }).optional(),
  });
  try {
    await updateProductSchema.validateAsync(req.body, { abortEarly: true });
    const { id } = req.params;
    const updates = { ...req.body };
    if (updates.badge !== undefined) {
      updates.badge = String(updates.badge || "")
        .trim()
        .toLowerCase();
      if (!ALLOWED_PRODUCT_BADGES.has(updates.badge)) updates.badge = "";
    }
    if (updates.sku !== undefined) updates.sku = String(updates.sku || "").trim();
    if (updates.isDeal !== undefined) updates.isDeal = Boolean(updates.isDeal);
    if (updates.isDisable !== undefined) updates.isDisable = Boolean(updates.isDisable);
    if (updates.comparePrice !== undefined)
      updates.comparePrice = Number(updates.comparePrice || 0);
    if (updates.dealPrice !== undefined)
      updates.dealPrice = Number(updates.dealPrice || 0);

    const product = await Products.findByIdAndUpdate(
      { _id: id, isDeleted: false },
      updates,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product
      }
    });

  } catch (error) {
    if (error.isJoi) {
      const mapError = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product'
    });
  }
}

const deleteProduct = async (req, res) => {
  try {
    idValidation.validateAsync(req.params, { abortEarly: true });
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Products.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isDeleted = true;
    await product.save();

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        id: product._id,
        name: product.name
      }
    });

  } catch (error) {
    if (error.isJoi) {
      const mapError = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
}

const getAdminProducts = async (req, res) => {
  const validation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(500).optional(),
    search: Joi.string().max(100).allow(null, ""),
    category: Joi.string().max(160).allow(null, ""),
    stock: Joi.string().valid("", "all", "in", "out").optional(),
  }).unknown(true);
  try {
    await connectDB();
    await validation.validateAsync(req.query, { abortEarly: true });
    let { page = 1, limit = 20, search = '', category, stock = "all" } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    /** Match storefront / catalog: include docs where isDeleted is missing (legacy imports). */
    let query = {
      ...PRODUCT_NOT_DELETED,
    };

    const stockKey = String(stock || "all").toLowerCase();
    if (stockKey === "in") {
      query.inStock = true;
    } else if (stockKey === "out") {
      query.inStock = false;
    }

    if (search) {
      const esc = escapeRegex(String(search).trim());
      const rx = new RegExp(esc, 'i');
      query.$or = [
        { name: rx },
        { description: rx },
        { category: rx },
        { tags: rx },
      ];
    }

    if (category && String(category).trim()) {
      const c = String(category).trim();
      query.category = {
        $regex: new RegExp(`^${escapeRegex(c)}$`, "i"),
      };
    }

    const total = await Products.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const effectivePage = Math.min(Math.max(1, page), totalPages);
    const skip = (effectivePage - 1) * limit;

    const [products, inStockCount, outOfStockCount, valueAgg] = await Promise.all([
      Products.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Products.countDocuments({ ...query, inStock: true }),
      Products.countDocuments({ ...query, inStock: false }),
      Products.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$price", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
          },
        },
      ]),
    ]);
    const totalValue = valueAgg?.[0]?.totalValue ?? 0;
    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        totalPages,
        currentPage: effectivePage,
        limit,
      },
      stats: {
        inStock: inStockCount,
        outOfStock: outOfStockCount,
        totalValue,
      },
    });

  } catch (error) {
    const mapError = formatJoiErrors(error);
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('getAdminProducts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching products',
      error: error.message
    });
  }
};

const getAdminProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !String(id).match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }
    const product = await Products.findOne({
      _id: id,
      ...PRODUCT_NOT_DELETED,
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("getAdminProductById error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching product",
    });
  }
};

const createVoucher = async (req, res) => {
  try {

    if (!req.body.code || !req.body.discountType || !req.body.discountValue) {
      return res.json({ error: true, message: "Required fields missing" });
    }

    const exists = await Voucher.findOne({
      code: new RegExp(`^${req.body.code}$`, "i"),
      isDeleted: false,
    });

    if (exists) {
      return res.json({ error: true, message: "Voucher code already exists" });
    }

    const voucher = await Voucher.create(req.body);

    return res.json({
      error: false,
      message: "Voucher created successfully",
      data: voucher,
    });
  } catch (err) {
    console.error(err);
    return res.json({ error: true, message: "Something went wrong" });
  }
};

const getVouchers = async (req, res) => {
  try {
    const { pageNo = 1, size = 10, search, status } = req.query;
    const skip = (pageNo - 1) * size;
    const now = new Date();

    const filter = {
      isDeleted: false,
      ...(search && {
        code: new RegExp(search, "i"),
      }),
    };

    if (status === "active") {
      filter.isActive = true;
      filter.$or = [
        { endAt: { $gte: now } },
        { endAt: null }
      ];
    }

    if (status === "inactive") {
      filter.isActive = false;
    }

    if (status === "expired") {
      filter.endAt = { $lt: now };
    }

    if (status === "used") {
      filter.$expr = {
        $and: [
          { $ne: ["$totalUsageLimit", null] },
          { $gte: ["$usedCount", "$totalUsageLimit"] }
        ]
      };
    }

    const list = await Voucher.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean();

    if (!list || list.length === 0) {
      return res.json({
        success: false,
        message: "No vouchers found",
        data: {
          list: [],
          total: 0
        }
      });
    }

    const updatedList = list.map(voucher => {
      let isExpired = false;

      if (voucher.endAt && now > voucher.endAt) {
        isExpired = true;
      }

      return {
        ...voucher,
        isExpired,
      };
    });

    const total = await Voucher.countDocuments(filter);

    return res.json({
      success: true,
      message: 'success',
      data: { list: updatedList, total },
    });
  } catch (err) {
    console.error(err);
    return res.json({
      error: true,
      message: safeApiMessage(err, "Failed to fetch vouchers"),
    });
  }
};

const toggleVoucherStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.json({ error: true, message: "Voucher not found" });
    }

    voucher.isActive = !voucher.isActive;
    await voucher.save();

    return res.json({
      error: false,
      message: voucher.isActive
        ? "Voucher enabled successfully"
        : "Voucher disabled successfully",
    });
  } catch (err) {
    console.error(err);
    return res.json({ error: true, message: "Status update failed" });
  }
};

const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    await Voucher.findByIdAndUpdate(id, { isDeleted: true });

    return res.json({
      error: false,
      message: "Voucher deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.json({ error: true, message: "Delete failed" });
  }
};

const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = await Voucher.findByIdAndUpdate(id, req.body);

    return res.json({
      error: false,
      message: "Voucher deleted successfully",
      data: updateData
    });
  } catch (err) {
    console.error(err);
    return res.json({ error: true, message: "Delete failed" });
  }
};

const createDeal = async (req, res) => {
  const dealSchema = Joi.object({
    productId: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
    dealName: Joi.string().trim().min(2).required(),
    dealType: Joi.string().valid('Percentage', 'Fixed', 'BOGO').required(),
    discountValue: Joi.number().min(0).when('dealType', {
      is: Joi.valid('Percentage', 'Fixed'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    startAt: Joi.date().required(),
    endAt: Joi.date().required(),
    isActive: Joi.boolean().optional().default(true),
    showOnProductPage: Joi.boolean().optional().default(true)
  });
  try {
    await dealSchema.validateAsync(req.body, { abortEarly: true });
    const {
      productId,
      dealName,
      dealType,
      discountValue,
      startAt,
      endAt,
      isActive,
      showOnProductPage
    } = req.body;

    if (!Array.isArray(productId) || productId.length === 0) {
      return res.json({
        error: true,
        message: "At least one product is required"
      });
    }

    if (!dealName || !dealType || !startAt || !endAt) {
      return res.json({
        error: true,
        message: "Required fields missing"
      });
    }

    if (new Date(startAt) >= new Date(endAt)) {
      return res.json({
        error: true,
        message: "End date must be greater than start date"
      });
    }

    if (dealType !== 'BOGO' && (!discountValue || discountValue <= 0)) {
      return res.json({
        error: true,
        message: "Valid discount value required"
      });
    }

    const deal = await Deal.create({
      productId,
      dealName,
      dealType,
      discountValue,
      startAt,
      endAt,
      isActive,
      showOnProductPage
    });

    await Product.updateMany(
      { _id: { $in: productId } },
      { $set: { dealId: deal._id } }
    );

    return res.json({
      error: false,
      message: "Deal created successfully",
      data: deal
    });

  } catch (err) {
    if (err.isJoi) {
      return res.json({
        error: true,
        message: formatJoiErrors(err)
      });
    }
    console.error(err);
    return res.json({
      error: true,
      message: "Failed to create deal"
    });
  }
};

const getDeals = async (req, res) => {
  const idValidation = Joi.object({
    pageNo: Joi.number().integer().min(1).optional(),
    size: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).optional(),
    productId: Joi.string().optional(),
    status: Joi.string().valid("Active", "Inactive", "Expired", "Scheduled").optional()
  }).unknown(true);
  try {
    await idValidation.validateAsync(req.query, { abortEarly: true });
    let {
      pageNo = 1,
      size = 10,
      search,
      productId,
      status
    } = req.query;

    pageNo = parseInt(pageNo);
    size = parseInt(size);

    const skip = (pageNo - 1) * size;
    const now = new Date();

    let filter = {
      isDeleted: false
    };

    if (search) {
      filter.dealName = { $regex: search, $options: "i" };
    }

    if (productId) {
      filter.productId = { $in: productId.split(',') };
    }

    if (status === "Active") {
      filter.isActive = true;
      filter.startAt = { $lte: now };
      filter.endAt = { $gte: now };
    }

    if (status === "Inactive") {
      filter.isActive = false;
    }

    if (status === "Expired") {
      filter.endAt = { $lt: now };
    }

    if (status === "Scheduled") {
      filter.startAt = { $gt: now };
    }

    const list = await Deal.find(filter)
      .populate("productId", "name price image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean();

    const total = await Deal.countDocuments(filter);

    return res.json({
      error: false,
      data: {
        list,
        total,
        pageNo,
        size
      }
    });

  } catch (err) {
    if (err.isJoi) {
      return res.json({
        error: true,
        message: formatJoiErrors(err)
      });
    }
    console.error(err);
    return res.json({
      error: true,
      message: "Failed to fetch deals"
    });
  }
};

const toggleDealStatus = async (req, res) => {
  try {
    await idValidation.validateAsync(req.params, { abortEarly: true });
    const { id } = req.params;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.json({ error: true, message: "Deal not found" });
    }

    deal.isActive = !deal.isActive;
    await deal.save();

    return res.json({
      error: false,
      message: deal.isActive
        ? "Deal enabled successfully"
        : "Deal disabled successfully",
    });
  } catch (err) {
    if (err.isJoi) {
      return res.json({
        error: true,
        message: formatJoiErrors(err)
      });
    }
    console.error(err);
    return res.json({ error: true, message: "Status update failed" });
  }
};

const updateDeals = async (req, res) => {
  const dealUpdateSchema = Joi.object({
    productId: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
    dealName: Joi.string().trim().min(2).required(),
    dealType: Joi.string().valid('Percentage', 'Fixed', 'BOGO').required(),
    discountValue: Joi.number().min(0).when('dealType', {
      is: Joi.valid('Percentage', 'Fixed'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    startAt: Joi.date().required(),
    endAt: Joi.date().greater(Joi.ref('startAt')).required(),
    isActive: Joi.boolean().required(),
    showOnProductPage: Joi.boolean().required()
  });
  try {
    await dealUpdateSchema.validateAsync(req.body, { abortEarly: true });
    const { id } = req.params;
    const {
      productId,
      dealName,
      dealType,
      discountValue,
      startAt,
      endAt,
      isActive,
      showOnProductPage
    } = req.body;

    if (!Array.isArray(productId) || productId.length === 0) {
      return res.json({
        error: true,
        message: "At least one product is required"
      });
    }

    // 🔎 Find existing deal
    const existingDeal = await Deal.findById(id);
    if (!existingDeal) {
      return res.json({
        error: true,
        message: "Deal not found"
      });
    }

    const oldProductIds = existingDeal.productId.map(p => p.toString());
    const newProductIds = productId.map(p => p.toString());

    const addedProducts = newProductIds.filter(
      pid => !oldProductIds.includes(pid)
    );

    const removedProducts = oldProductIds.filter(
      pid => !newProductIds.includes(pid)
    );

    if (removedProducts.length > 0) {
      await Product.updateMany(
        { _id: { $in: removedProducts }, dealId: id },
        { $unset: { dealId: "" } }
      );
    }

    if (addedProducts.length > 0) {
      await Product.updateMany(
        { _id: { $in: addedProducts } },
        { $set: { dealId: id } }
      );
    }

    const updatedDeal = await Deal.findByIdAndUpdate(
      id,
      {
        productId,
        dealName,
        dealType,
        discountValue,
        startAt,
        endAt,
        isActive,
        showOnProductPage
      },
      { new: true }
    );

    return res.json({
      error: false,
      message: "Deal updated successfully",
      data: updatedDeal
    });

  } catch (err) {
    if (err.isJoi) {
      return res.json({
        error: true,
        message: formatJoiErrors(err)
      });
    }
    console.error(err);
    return res.json({
      error: true,
      message: "Failed to update deal"
    });
  }
};

const deleteDeal = async (req, res) => {
  try {
    await idValidation.validateAsync(req.params, { abortEarly: true });
    const { id } = req.params;

    await Deal.findByIdAndUpdate(id, { isDeleted: true });

    return res.json({
      error: false,
      message: "Deal deleted successfully",
    });
  } catch (err) {
    if (err.isJoi) {
      return res.json({
        error: true,
        message: formatJoiErrors(err)
      });
    }
    console.error(err);
    return res.json({ error: true, message: err.message });
  }
};

const getAllContacts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contact.countDocuments(query);

    res.json({
      contacts,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      totalContacts: total
    });
  } catch (error) {
    console.error('Contacts fetch error:', error);
    res.status(500).json({ message: 'Server error fetching contacts' });
  }
};

const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact submission not found' });
    }

    // Mark as read if it's new
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }

    res.json({ contact });
  } catch (error) {
    console.error('Contact fetch error:', error);
    res.status(500).json({ message: 'Server error fetching contact' });
  }
};

const categoryMainValues = ["indian", "american", "chinese", "turkish"];

const normalizeCategoryMain = (main) => {
  if (main == null || main === "") return null;
  const m = String(main).toLowerCase().trim();
  return categoryMainValues.includes(m) ? m : null;
};

const createCategory = async (req, res) => {
  const categorySchema = Joi.object({
    name: Joi.string().trim().min(2).required(),
    image: Joi.string().allow("", null),
    main: Joi.string().valid(...categoryMainValues).required(),
    sortOrder: Joi.number().integer().min(0).max(99999).optional(),
    isActive: Joi.alternatives()
      .try(Joi.boolean(), Joi.string().trim().lowercase().valid("true", "false", "1", "0"))
      .optional(),
    featuredOnHome: Joi.boolean().optional(),
    homeDisplayTitle: Joi.string().trim().max(80).allow("", null).optional(),
  });
  try {
    const { error, value } = categorySchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    value.main = normalizeCategoryMain(value.main);
    if (value.sortOrder == null) value.sortOrder = 0;

    const existing = await Category.findOne({ name: value.name, isDeleted: false });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Category already exists"
      });
    }

    const nextActive =
      value.isActive !== undefined
        ? coerceCategoryIsActiveFromRequest(value.isActive, true)
        : true;

    const featuredOnHome = value.featuredOnHome !== false;
    const homeDisplayTitle =
      value.homeDisplayTitle != null ? String(value.homeDisplayTitle).trim() : "";

    const category = await Category.create({
      name: value.name,
      image: value.image ?? "",
      main: value.main,
      sortOrder: value.sortOrder ?? 0,
      isActive: nextActive,
      featuredOnHome,
      homeDisplayTitle,
      updatedAt: Date.now(),
    });

    await invalidateProductCatalogCache();

    res.status(201).json({
      success: true,
      data: category
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: safeApiMessage(err, "Could not create category"),
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 100
    } = req.query;

    let pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);

    const searchTrim = String(search || "").trim();
    const filter = {
      isDeleted: false,
      ...(searchTrim && {
        name: { $regex: escapeRegex(searchTrim), $options: "i" },
      }),
    };

    const activeFilter = String(req.query.active || "").toLowerCase();
    if (activeFilter === "active") filter.isActive = true;
    if (activeFilter === "inactive") filter.isActive = false;

    const mainParam = String(req.query.main || "").toLowerCase().trim();
    const allowedMain = ["indian", "american", "chinese", "turkish"];
    if (mainParam && allowedMain.includes(mainParam)) {
      const storefrontNames = getValuesForMain(mainParam);
      filter.$or = [
        { main: mainParam },
        ...(storefrontNames.length ? [{ name: { $in: storefrontNames } }] : []),
      ];
    }

    const total = await Category.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limitNumber) || 1);
    pageNumber = Math.min(pageNumber, totalPages);
    const skip = (pageNumber - 1) * limitNumber;

    const categories = await Category.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    let mapAll = {};
    let mapInStock = {};
    let firstImgByKey = {};
    try {
      const maps = await buildProductCategoryMaps(Products);
      mapAll = maps.mapAll || {};
      mapInStock = maps.mapInStock || {};
    } catch (e) {
      console.error("getCategories buildProductCategoryMaps:", e.message);
    }
    try {
      firstImgByKey = await firstProductImageByCategoryKey(Products);
    } catch (e) {
      console.error("getCategories firstProductImageByCategoryKey:", e.message);
    }

    const data = categories.map((c) => {
      const nk = normCategoryKey(c.name);
      const shop = productCountForCategoryName(mapInStock, c.name);
      const all = productCountForCategoryName(mapAll, c.name);
      const saved = c.image && String(c.image).trim();
      const displayThumbnail = saved || firstImgByKey[nk] || null;

      const inferredMain = inferMainForCategoryName(c.name);
      const dbMain = c.main && allowedMain.includes(String(c.main).toLowerCase())
        ? String(c.main).toLowerCase()
        : null;
      const effectiveMain = dbMain || inferredMain || null;

      return {
        ...c,
        productCount: all,
        productCountInStock: shop,
        productCountAll: all,
        displayThumbnail,
        inferredMain,
        effectiveMain,
        mainIsInferred: !dbMain && Boolean(inferredMain),
      };
    });

    const needThumb = data
      .filter((row) => !row.displayThumbnail && Number(row.productCount) > 0)
      .map((r) => r.name);
    if (needThumb.length) {
      try {
        const byExact = await firstProductImageByExactCategoryNames(Products, needThumb);
        for (const row of data) {
          if (!row.displayThumbnail && row.productCount > 0 && byExact[row.name]) {
            row.displayThumbnail = byExact[row.name];
          }
        }
      } catch (e) {
        console.error("getCategories exact image fallback:", e.message);
      }
    }

    const stillThumb = data.filter((row) => !row.displayThumbnail && Number(row.productCount) > 0);
    if (stillThumb.length) {
      try {
        const col = Products.collection;
        const or = stillThumb.map((r) => ({
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
            if (row.displayThumbnail || !row.productCount) continue;
            if (normCategoryKey(row.name) !== pk) continue;
            row.displayThumbnail = img;
            break;
          }
        }
      } catch (e) {
        console.error("getCategories case-insensitive image fallback:", e.message);
      }
    }

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.json({
      success: true,
      data: category
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const updateCategory = async (req, res) => {
  const categorySchema = Joi.object({
    name: Joi.string().trim().min(2).required(),
    image: Joi.string().allow("", null),
    isActive: Joi.alternatives()
      .try(Joi.boolean(), Joi.string().trim().lowercase().valid("true", "false", "1", "0"))
      .optional(),
    main: Joi.string().valid(...categoryMainValues).required(),
    sortOrder: Joi.number().integer().min(0).max(99999).optional(),
    featuredOnHome: Joi.boolean().optional(),
    homeDisplayTitle: Joi.string().trim().max(80).allow("", null).optional(),
  });
  try {
    const { error, value } = categorySchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const prev = await Category.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!prev) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const oldName = prev.name;
    value.main = normalizeCategoryMain(value.main);
    value.updatedAt = Date.now();

    const nameTaken = await Category.findOne({
      name: value.name,
      isDeleted: false,
      _id: { $ne: req.params.id },
    });
    if (nameTaken) {
      return res.status(400).json({
        success: false,
        message: "Another category already uses this name",
      });
    }

    const nextIsActive =
      value.isActive !== undefined
        ? coerceCategoryIsActiveFromRequest(value.isActive, true)
        : coerceCategoryIsActiveFromRequest(prev.isActive, true);

    const $set = {
      name: value.name,
      image: value.image ?? "",
      main: value.main,
      sortOrder: value.sortOrder ?? 0,
      isActive: nextIsActive,
      updatedAt: Date.now(),
    };
    if (value.featuredOnHome !== undefined) {
      $set.featuredOnHome = Boolean(value.featuredOnHome);
    }
    if (value.homeDisplayTitle !== undefined) {
      $set.homeDisplayTitle = String(value.homeDisplayTitle).trim();
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { $set },
      { new: true, runValidators: true }
    );

    if (value.name !== oldName) {
      await Products.updateMany(
        { category: oldName, isDeleted: false },
        { $set: { category: value.name, updatedAt: Date.now() } }
      );
    }

    await invalidateProductCatalogCache();

    res.json({
      success: true,
      data: updated
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: safeApiMessage(err, "Could not update category"),
    });
  }
};

/** Toggle category visibility on the storefront (MongoDB `isActive` only). */
const patchCategoryActive = async (req, res) => {
  const bodySchema = Joi.object({
    isActive: Joi.alternatives()
      .try(Joi.boolean(), Joi.string().trim().lowercase().valid("true", "false", "1", "0"))
      .required(),
  });
  try {
    const { error, value } = bodySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }

    const prev = await Category.findOne({ _id: id, isDeleted: false });
    if (!prev) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const nextActive = coerceCategoryIsActiveFromRequest(value.isActive, true);
    const updated = await Category.findByIdAndUpdate(
      id,
      { $set: { isActive: nextActive, updatedAt: Date.now() } },
      { new: true, runValidators: true }
    );

    await invalidateProductCatalogCache();

    return res.json({
      success: true,
      data: updated,
      message: nextActive ? "Category activated" : "Category deactivated",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: safeApiMessage(err, "Could not update category status"),
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    await invalidateProductCatalogCache();

    res.json({
      success: true,
      message: "Category deactivated successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: safeApiMessage(err, "Could not delete category"),
    });
  }
};

const uploadCategoryImage = async (req, res) => {
  try {
    const imageUrl = await finalizeCategoryImageUpload(
      req.file,
      req,
      adminUploadsDest
    );
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    const categoryId = req.body?.categoryId;
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      await Category.findByIdAndUpdate(categoryId, {
        image: imageUrl,
        updatedAt: Date.now(),
      });
    }

    await invalidateProductCatalogCache();

    return res.json({
      success: true,
      message: "Image optimized and saved",
      data: { imageUrl },
    });
  } catch (err) {
    console.error("uploadCategoryImage:", err);
    return res.status(500).json({
      success: false,
      message: safeApiMessage(
        err,
        "Could not save image. Use JPG, PNG, or WebP under 5MB."
      ),
    });
  }
};

const bulkAssignProductsToCategory = async (req, res) => {
  const schema = Joi.object({
    categoryName: Joi.string().trim().min(2).required(),
    productIds: Joi.array()
      .items(Joi.string().length(24).hex())
      .min(1)
      .max(500)
      .required(),
  });
  try {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const cat = await Category.findOne({
      isDeleted: false,
      name: {
        $regex: new RegExp(
          `^${escapeRegex(value.categoryName.trim())}$`,
          "i"
        ),
      },
    });
    if (!cat) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const canonicalName = cat.name;
    const ids = value.productIds.map((id) => new mongoose.Types.ObjectId(id));
    const result = await Products.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      { $set: { category: canonicalName, updatedAt: Date.now() } }
    );

    await invalidateProductCatalogCache();

    return res.json({
      success: true,
      message: "Products updated",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: safeApiMessage(err, "Bulk assign failed"),
    });
  }
};

const bulkMoveProductsToCategory = async (req, res) => {
  const schema = Joi.object({
    productIds: Joi.array()
      .items(Joi.string().length(24).hex())
      .min(1)
      .max(500)
      .required(),
    targetCategoryName: Joi.string().trim().min(2).required(),
  });
  try {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const target = await Category.findOne({
      isDeleted: false,
      name: {
        $regex: new RegExp(
          `^${escapeRegex(value.targetCategoryName.trim())}$`,
          "i"
        ),
      },
    });
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target category not found",
      });
    }

    const ids = value.productIds.map((id) => new mongoose.Types.ObjectId(id));
    const result = await Products.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      { $set: { category: target.name, updatedAt: Date.now() } }
    );

    await invalidateProductCatalogCache();

    return res.json({
      success: true,
      message: "Products moved",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: safeApiMessage(err, "Move failed"),
    });
  }
};

const homeSliderSlideJoi = Joi.object({
  _id: Joi.string().hex().length(24).optional(),
  title: Joi.string().trim().max(120).allow("").default(""),
  subtitle: Joi.string().trim().max(220).allow("").optional().default(""),
  imageUrl: Joi.string().trim().max(2048).allow("").default(""),
  buttonText: Joi.string().trim().max(40).allow("").default("Shop Now"),
  buttonLink: Joi.string().trim().max(1024).allow("").default("/products"),
  cardBgColor: Joi.string()
    .trim()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .default("#f8fafc"),
  textColor: Joi.string()
    .trim()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .default("#1e293b"),
  buttonBgColor: Joi.string()
    .trim()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .default("#3090cf"),
  buttonTextColor: Joi.string()
    .trim()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .default("#ffffff"),
  isActive: Joi.boolean().default(true),
});

const homeSliderSettingsSchema = Joi.object({
  sectionBgColor: Joi.string().trim().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
  autoPlay: Joi.boolean().required(),
  autoPlayDelayMs: Joi.number().integer().min(1000).max(20000).required(),
  transitionDurationMs: Joi.number().integer().min(200).max(3000).required(),
  slidesPerViewDesktop: Joi.number().integer().min(1).max(4).required(),
  slidesPerViewTablet: Joi.number().integer().min(1).max(3).required(),
  slidesPerViewMobile: Joi.number().integer().min(1).max(2).required(),
  slides: Joi.array().items(homeSliderSlideJoi).min(0).max(24).required(),
});

function setSliderAdminNoCacheHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    Pragma: "no-cache",
    Expires: "0",
  });
}

/** Admin + PUT response: every slide in DB, sorted (including drafts missing title/image). */
const normalizeSliderSettings = (settingsDoc) => {
  if (!settingsDoc) return null;
  const slides = coerceHomeSliderSlides(settingsDoc.slides)
    .filter((s) => s && typeof s === "object")
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((s, idx) => ({
      _id: s._id != null ? String(s._id) : undefined,
      title: s.title != null ? String(s.title) : "",
      subtitle: s.subtitle != null ? String(s.subtitle).trim() : "",
      imageUrl: s.imageUrl != null ? String(s.imageUrl).trim() : "",
      buttonText: s.buttonText || "Shop Now",
      buttonLink: s.buttonLink || "/products",
      cardBgColor: s.cardBgColor || "#f8fafc",
      textColor: s.textColor || "#1e293b",
      buttonBgColor: s.buttonBgColor || "#3090cf",
      buttonTextColor: s.buttonTextColor || "#ffffff",
      isActive: s.isActive !== false,
      sortOrder: Number(s.sortOrder ?? idx),
    }));

  return {
    sectionBgColor: settingsDoc.sectionBgColor || "#ffffff",
    autoPlay: settingsDoc.autoPlay !== false,
    autoPlayDelayMs: Number(settingsDoc.autoPlayDelayMs || 3000),
    transitionDurationMs: Number(settingsDoc.transitionDurationMs || 700),
    slidesPerViewDesktop: Number(settingsDoc.slidesPerViewDesktop || 3),
    slidesPerViewTablet: Number(settingsDoc.slidesPerViewTablet || 2),
    slidesPerViewMobile: Number(settingsDoc.slidesPerViewMobile || 1),
    slides,
  };
};

const getHomeSliderSettingsAdmin = async (req, res) => {
  try {
    let settings = await HomeSliderSettings.findOne({ key: "home-main-slider" }).lean();

    if (!settings) {
      settings = await HomeSliderSettings.create({
        key: "home-main-slider",
        slides: [
          {
            title: "Everyday Fresh & Clean with Our Products",
            imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
            sortOrder: 0,
          },
        ],
      });
      settings = settings.toObject();
    }

    setSliderAdminNoCacheHeaders(res);
    return res.json({
      success: true,
      data: normalizeSliderSettings(settings),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load slider settings",
    });
  }
};

const updateHomeSliderSettingsAdmin = async (req, res) => {
  try {
    const { error, value } = homeSliderSettingsSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(error),
      });
    }

    const slides = value.slides.map((slide, index) => {
      const row = {
        title: slide.title || "",
        subtitle: slide.subtitle || "",
        imageUrl: slide.imageUrl || "",
        buttonText: slide.buttonText || "Shop Now",
        buttonLink: slide.buttonLink || "/products",
        cardBgColor: slide.cardBgColor || "#f8fafc",
        textColor: slide.textColor || "#1e293b",
        buttonBgColor: slide.buttonBgColor || "#3090cf",
        buttonTextColor: slide.buttonTextColor || "#ffffff",
        isActive: slide.isActive !== false,
        sortOrder: index,
      };
      if (slide._id && mongoose.Types.ObjectId.isValid(String(slide._id))) {
        row._id = new mongoose.Types.ObjectId(String(slide._id));
      }
      return row;
    });

    const payload = {
      sectionBgColor: value.sectionBgColor,
      autoPlay: value.autoPlay,
      autoPlayDelayMs: value.autoPlayDelayMs,
      transitionDurationMs: value.transitionDurationMs,
      slidesPerViewDesktop: value.slidesPerViewDesktop,
      slidesPerViewTablet: value.slidesPerViewTablet,
      slidesPerViewMobile: value.slidesPerViewMobile,
      slides,
    };

    const updated = await HomeSliderSettings.findOneAndUpdate(
      { key: "home-main-slider" },
      { $set: payload, $setOnInsert: { key: "home-main-slider" } },
      { new: true, upsert: true }
    ).lean();

    return res.json({
      success: true,
      message: "Slider settings updated",
      data: normalizeSliderSettings(updated),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update slider settings",
    });
  }
};

const uploadHomeSliderImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    const imageUrl = publicBrandingUrl(req, req.file.filename);

    return res.json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageUrl,
        fileName: req.file.originalname || req.file.filename,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Image upload failed",
    });
  }
};

// =========================
// Products CSV Export/Import
// =========================
const PRODUCT_CSV_SAMPLE =
  "\uFEFFtitle,description,price,comparePrice,category,stock,sku,imageUrl,status,badge,deal,dealPrice,tags\n" +
  '"Organic Basmati Rice 5 lb","Aromatic long-grain rice ideal for daily meals.",12.99,,Dry Goods,120,BAS-RICE-5LB,"https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400",active,new,false,,"pantry,staples,rice"\n' +
  '"Mediterranean Extra Virgin Olive Oil 1L","Cold-pressed olive oil for cooking and dressings.",18.99,24.99,American Sauces,45,OIL-EVO-1L,"https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400",active,sale,false,,"oil,cooking"\n' +
  '"Small-Batch Coffee Beans 12 oz","Single-origin medium roast whole bean.",14.99,19.99,American Breakfast,80,COF-DEAL-12,"https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400",active,hot,true,9.99,"coffee,beverages"';

const downloadProductsCsvSample = async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="grocera-products-sample.csv"'
    );
    return res.status(200).send(PRODUCT_CSV_SAMPLE);
  } catch (e) {
    console.error("downloadProductsCsvSample", e);
    return res.status(500).json({
      success: false,
      message: "Failed to build sample CSV",
    });
  }
};

const exportProductsCsv = async (req, res) => {
  try {
    const products = await Products.find({ ...PRODUCT_NOT_DELETED })
      .sort({ createdAt: -1 })
      .lean();

    const escapeCsv = (value) => {
      const str = value == null ? "" : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      "title",
      "description",
      "price",
      "comparePrice",
      "salePrice",
      "category",
      "stock",
      "sku",
      "imageUrl",
      "status",
      "badge",
      "deal",
      "dealPrice",
      "tags",
      "_id",
      "dealId",
      "cost",
      "unit",
      "discount",
      "nutritionInfoJson",
      "adminPrice",
      "isDisable",
      "isDeleted",
      "createdAt",
      "updatedAt",
    ];

    const rows = products.map((p) => {
      const tagsJoined = Array.isArray(p.tags) ? p.tags.join(",") : "";
      const nutritionInfoJson = JSON.stringify(p.nutritionInfo || {});
      const isDraft = Boolean(p.isDisable);
      const status = isDraft ? "draft" : "active";

      return [
        p.name,
        p.description,
        Number(p.price || 0),
        Number(p.comparePrice || 0),
        Number(p.salePrice || 0),
        p.category,
        Number(p.quantity || 0),
        p.sku || "",
        p.image || "",
        status,
        p.badge || "",
        Boolean(p.isDeal),
        Number(p.dealPrice || 0),
        tagsJoined,
        p._id,
        p.dealId || "",
        Number(p.cost || 0),
        p.unit || "piece",
        Number(p.discount || 0),
        nutritionInfoJson,
        p.adminPrice ?? "",
        Boolean(p.isDisable),
        Boolean(p.isDeleted),
        p.createdAt ? new Date(p.createdAt).toISOString() : p.date || "",
        p.updatedAt ? new Date(p.updatedAt).toISOString() : p.updatedAt || "",
      ]
        .map(escapeCsv)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="products-export-${Date.now()}.csv"`
    );
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Export products CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export products CSV",
    });
  }
};

function normalizeCsvHeaderKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeCsvRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    out[normalizeCsvHeaderKey(k)] = v;
  }
  return out;
}

function csvPick(r, ...candidates) {
  for (const c of candidates) {
    const key = normalizeCsvHeaderKey(c);
    const v = r[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function csvParseBool(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function csvParseTags(r) {
  const tagsJson = csvPick(r, "tagsjson", "tags_json");
  if (tagsJson) {
    try {
      const parsed = JSON.parse(String(tagsJson));
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch (_) {
      /* fall through */
    }
  }
  const raw = csvPick(r, "tags", "tagscsv", "tags_list");
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

const importProductsCsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "CSV file is required",
    });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rawRows.length) {
      return res.status(400).json({
        success: false,
        message: "CSV is empty",
      });
    }

    const isObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id || ""));

    const successRows = [];
    const failedRows = [];
    const bulkOps = [];
    const BATCH = 500;

    const safeParseJson = (value, fallback) => {
      try {
        if (value == null || value === "") return fallback;
        return JSON.parse(String(value));
      } catch {
        return fallback;
      }
    };

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2;
      const row = normalizeCsvRow(rawRows[i] || {});
      try {
        const _id = String(csvPick(row, "_id", "id") || "").trim();
        const name = String(csvPick(row, "title", "name") || "").trim();
        const description = String(csvPick(row, "description") || "").trim();
        const category = String(csvPick(row, "category") || "").trim();

        if (!name) throw new Error("title/name is required");
        if (!category) throw new Error("category is required");
        if (!description) throw new Error("description is required");

        const price = Number(csvPick(row, "price") || 0);
        if (!Number.isFinite(price) || price < 0) throw new Error("invalid price");

        const comparePrice = Number(csvPick(row, "compareprice", "compare_at_price") || 0);
        const salePrice = Number(csvPick(row, "saleprice", "sale_price") || 0);
        const image = String(
          csvPick(row, "imageurl", "image_url", "image") || ""
        ).trim();
        const quantity = Number(csvPick(row, "stock", "quantity", "qty") || 0);
        const cost = Number(csvPick(row, "cost") || 0);
        const unit = String(csvPick(row, "unit") || "piece").trim() || "piece";
        const discount = Number(csvPick(row, "discount") || 0);
        const adminPriceRaw = csvPick(row, "adminprice", "admin_price");
        const adminPrice =
          adminPriceRaw === "" || adminPriceRaw == null
            ? undefined
            : Number(adminPriceRaw || 0);

        const sku = String(csvPick(row, "sku") || "").trim();

        const statusRaw = String(csvPick(row, "status") || "active")
          .trim()
          .toLowerCase();
        const isDisable =
          statusRaw === "draft" || statusRaw === "disabled" || statusRaw === "hidden";

        let badge = String(csvPick(row, "badge") || "")
          .trim()
          .toLowerCase();
        if (!ALLOWED_PRODUCT_BADGES.has(badge)) badge = "";

        const isDeal = csvParseBool(csvPick(row, "deal", "isdeal", "is_deal"));
        let dealPrice = Number(csvPick(row, "dealprice", "deal_price") || 0);
        if (!isDeal) dealPrice = 0;
        if (!Number.isFinite(dealPrice) || dealPrice < 0) dealPrice = 0;

        const inStockRaw = String(csvPick(row, "instock", "in_stock") || "")
          .trim()
          .toLowerCase();
        const inStock =
          inStockRaw === "true"
            ? true
            : inStockRaw === "false"
              ? false
              : quantity > 0;

        const dealId = String(csvPick(row, "dealid", "deal_id") || "").trim();
        const normalizedDealId =
          dealId && isObjectId(dealId) ? dealId : undefined;

        const tags = csvParseTags(row);

        const nutritionInfoJson = safeParseJson(csvPick(row, "nutritioninfojson", "nutrition_info_json"), null);
        const nutritionInfo =
          nutritionInfoJson && typeof nutritionInfoJson === "object"
            ? nutritionInfoJson
            : {
                calories: row.calories ? Number(row.calories) : undefined,
                protein: row.protein ? Number(row.protein) : undefined,
                carbs: row.carbs ? Number(row.carbs) : undefined,
                fat: row.fat ? Number(row.fat) : undefined,
                fiber: row.fiber ? Number(row.fiber) : undefined,
              };

        const updateDoc = {
          name,
          description,
          price,
          comparePrice: Number.isFinite(comparePrice) && comparePrice >= 0 ? comparePrice : 0,
          salePrice: Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : 0,
          category,
          image,
          sku,
          badge,
          isDeal,
          dealPrice,
          inStock,
          quantity: quantity >= 0 ? quantity : 0,
          cost: cost >= 0 ? cost : 0,
          unit,
          discount: discount >= 0 ? discount : 0,
          adminPrice: adminPrice === undefined ? undefined : adminPrice,
          dealId: normalizedDealId,
          tags,
          nutritionInfo,
          isDisable,
          isDeleted: false,
        };

        let filter;
        if (_id && isObjectId(_id)) {
          filter = { _id: new mongoose.Types.ObjectId(_id) };
        } else if (sku) {
          filter = { sku };
        } else {
          filter = { name, category };
        }

        bulkOps.push({
          updateOne: {
            filter,
            update: {
              $set: updateDoc,
              $setOnInsert: { createdAt: Date.now() },
            },
            upsert: true,
          },
        });
        successRows.push(rowNum);
      } catch (err) {
        failedRows.push({ row: rowNum, error: err.message || String(err) });
      }
    }

    let batches = 0;
    for (let i = 0; i < bulkOps.length; i += BATCH) {
      const slice = bulkOps.slice(i, i + BATCH);
      if (!slice.length) continue;
      batches += 1;
      await Products.bulkWrite(slice, { ordered: false });
    }

    return res.status(200).json({
      success: true,
      message: "Products CSV import completed",
      importedCount: successRows.length,
      failedCount: failedRows.length,
      failedRows: failedRows.slice(0, 200),
      failedRowsTruncated: failedRows.length > 200,
      batches,
    });
  } catch (error) {
    console.error("Import products CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import products CSV",
    });
  } finally {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
    }
  }
};



router.get('/profile', adminAuth, getAdminProfile);
router.put('/profile', adminAuth, putAdminProfile);
router.put('/change-password', adminAuth, putAdminChangePassword);
router.post(
  '/profile/upload-avatar',
  adminAuth,
  uploadAdminAvatarMulter,
  postAdminProfileUploadAvatar,
);

router.get('/dashboard', adminAuth, dashboardStats);

router.get('/users', adminAuth, getAllUsers);
router.put('/user/status/:id', adminAuth, updateUserStatus);
router.delete('/user/delete/:id', adminAuth, deleteUser);
router.patch('/users/:id/role', adminAuth, updateUserRole);

router.post('/products', adminAuth, createProduct);
router.put('/products/:id', adminAuth, updateProduct);
router.get('/products', adminAuth, getAdminProducts);
router.get('/products/export-csv', adminAuth, exportProductsCsv);
router.get('/products/csv-sample', adminAuth, downloadProductsCsvSample);
router.get('/products/:id', adminAuth, getAdminProductById);
router.post('/products/import-csv', adminAuth, uploadProductCsvMulter, importProductsCsv);
router.delete('/products/:id', adminAuth, deleteProduct);
router.get('/analytics/products', adminAuth, getProductAnalytics);
router.post('/uploadBulkExcelProducts', adminAuth, upload.single('file'), uploadBulkExcelProducts);

router.post('/messages', adminAuth, createMessage);
router.get('/messages', adminAuth, getAllMessages);
router.post('/messages/reply', adminAuth, replyToMessage);
router.post('/messages/delete-many', adminAuth, deleteMessagesMany);
router.post('/messages/restore-many', adminAuth, restoreMessagesMany);
router.post('/messages/permanent-delete-many', adminAuth, permanentDeleteMessagesMany);
router.get('/messages/stats', adminAuth, getMessageStats);
router.delete('/messages/:id', adminAuth, deleteMessageById);
router.get('/messages/:id', adminAuth, getMessageById);

router.get('/settings', adminAuth, getAdminSettings);
router.put('/settings', adminAuth, putAdminSettings);
router.post(
  '/settings/upload-logo',
  adminAuth,
  uploadBrandingLogoMulter,
  postAdminSettingsUploadLogo,
);
router.post(
  '/settings/upload-favicon',
  adminAuth,
  uploadBrandingFaviconMulter,
  postAdminSettingsUploadFavicon,
);
router.post('/settings/smtp/verify', adminAuth, postSmtpVerify);
router.post('/settings/smtp/test', adminAuth, postSmtpTestEmail);

router.get('/email-templates', adminAuth, getEmailTemplatesAdmin);
router.put('/email-templates/:key', adminAuth, putEmailTemplateByKey);
router.post('/email-templates/preview', adminAuth, postEmailTemplatePreview);

router.get('/orders', adminAuth, getOrders);
router.get('/orders/export-csv', adminAuth, exportOrdersCsv);
router.get('/orders/:id', adminAuth, getAdminOrderById);
router.post('/orders/import-csv', adminAuth, upload.single('file'), importOrdersCsv);
router.patch('/orders/:id/cancel-payment-request', adminAuth, cancelPaymentRequest);
router.patch('/orders/:id/status', adminAuth, updateOrderStatus);

router.post('/vouchers', adminAuth, createVoucher);
router.get('/vouchers', adminAuth, getVouchers);
router.put('/vouchers/:id', adminAuth, updateVoucher);
router.patch('/vouchers/status/:id', adminAuth, toggleVoucherStatus);
router.delete('/vouchers/:id', adminAuth, deleteVoucher);

router.post('/deals', adminAuth, createDeal);
router.get('/deals', adminAuth, getDeals);
router.patch('/deals/status/:id', adminAuth, toggleDealStatus);
router.put('/deals/:id', adminAuth, updateDeals);
router.delete('/deals/:id', adminAuth, deleteDeal);

router.get('/contacts', adminAuth, getAllContacts);
router.get('/contacts/:id', adminAuth, getContactById);

router.post("/createCategory", adminAuth, createCategory);
router.get("/getCategories", adminAuth, getCategories);
router.get("/getCategory/:id", adminAuth, getCategory);
router.put("/updateCategory/:id", adminAuth, updateCategory);
router.patch("/category/:id/isActive", adminAuth, patchCategoryActive);
router.delete("/deleteCategory/:id", adminAuth, deleteCategory);
router.post(
  "/category/upload-image",
  adminAuth,
  uploadCategoryImageMulter,
  uploadCategoryImage
);
router.post("/bulkAssignCategoryProducts", adminAuth, bulkAssignProductsToCategory);
router.post("/bulkMoveProductsCategory", adminAuth, bulkMoveProductsToCategory);
router.get("/home-slider-settings", adminAuth, getHomeSliderSettingsAdmin);
router.put("/home-slider-settings", adminAuth, updateHomeSliderSettingsAdmin);
router.post("/home-slider-settings/upload", adminAuth, upload.single("file"), uploadHomeSliderImage);

module.exports = router;