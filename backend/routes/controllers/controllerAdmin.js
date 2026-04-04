const express = require("express");
const router = express.Router();
const Joi = require("joi");
const { Message, Products, Orders, User, ContactUs, Voucher, HomeSliderSettings } = require("../../db");
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
const OrderConform = require("../../utils/template/userOrderConform");
const OrderDelivered = require("../../utils/template/userOrderDeliverd");
const OrderCancelled = require("../../utils/template/userOrderCancelled");
const userOrderStatusUpdate = require("../../utils/template/userOrderStatusUpdate");
const Category = require("../../db/models/categories");
const {
  coerceCategoryIsActiveFromRequest,
} = require("../../utils/categoryActivity");
const { finalizeCategoryImageUpload } = require("../../utils/categoryImageUpload");
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
const {
  getValuesForMain,
  inferMainForCategoryName,
} = require("../../utils/storefrontCategoryMeta");
const { safeApiMessage } = require("../../utils/safeApiMessage");
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
      { $match: { paymentStatus: 'completed' } },
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
      { $match: { paymentStatus: 'completed' } },
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

    const pendingOrders =
      ordersByStatus.find(o => ['pending', 'processing'].includes(o._id))?.count || 0;

    const deliveredOrders =
      ordersByStatus.find(o => o._id === 'delivered')?.count || 0;

    // =======================
    // PRODUCTS STATS
    // =======================
    const totalProducts = await Products.countDocuments();
    const lowStockProducts = await Products.countDocuments({ quantity: { $lt: 10 } });

    // =======================
    // RESPONSE (FRONTEND READY)
    // =======================
    res.json({
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
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Dashboard fetch failed' });
  }
};

const getOrders = async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    // Filter
    const filter = {};
    if (status === 'all') {
      filter.status = { $ne: "session" };
    } else {
      filter.status = status;
    }

    const [orders, totalCount] = await Promise.all([
      Orders.find(filter)
        .populate('items.product', 'name image')
        .populate('addressId', 'name phone fullAddress city state pincode addressType')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'orderNumber paymentMethod paymentCards status paymentStatus subtotal taxAmount shippingAmount totalAmount remainingAmount requestedPaymentAmount requestedPaymentAt items createdAt estimatedDelivery deliveredAt addressId userId'
        )
        .lean(),

      Orders.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

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

const exportOrdersCsv = async (req, res) => {
  try {
    const status = req.query.status || "all";
    const filter = status === "all" ? { status: { $ne: "session" } } : { status };

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
        message: "CSV file is required",
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "CSV is empty",
      });
    }

    const validStatuses = ['session', 'pending', 'confirmed', 'processing', 'packed', 'shipped', 'on_the_way', 'delivered', 'cancelled', 'refunded'];
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

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];

      try {
        const orderNumber = String(row.orderNumber || "").trim();
        if (!orderNumber) throw new Error("orderNumber is required");

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
    const validStatuses = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'on_the_way', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Orders.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('addressId', 'name fullAddress city state pincode phone');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    if (status === 'confirmed') {
      order.paymentStatus = 'paid'
    }
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

    setImmediate(() => {
      (async () => {
        try {
          const subjectMap = {
            pending: `Zippyyy Order Pending – #${order.orderNumber}`,
            confirmed: `Zippyyy Order Confirmed – #${order.orderNumber}`,
            processing: `Zippyyy Order Processed – #${order.orderNumber}`,
            packed: `Zippyyy Order Packed – #${order.orderNumber}`,
            shipped: `Zippyyy Order Shipped – #${order.orderNumber}`,
            on_the_way: `Zippyyy Order On The Way – #${order.orderNumber}`,
            delivered: `Zippyyy Order Delivered – #${order.orderNumber}`,
            cancelled: `Zippyyy Order Cancelled – #${order.orderNumber}`,
          };
          const subject = subjectMap[status];
          if (!subject) return;

          // Keep legacy rich templates for delivered/cancelled/confirmed, and use a generic
          // status template for all remaining states.
          let htmlTemplate = userOrderStatusUpdate(order, status);
          if (status === 'confirmed') htmlTemplate = OrderConform(order);
          if (status === 'delivered') htmlTemplate = OrderDelivered(order);
          if (status === 'cancelled') htmlTemplate = OrderCancelled(order);

          const userMailOptions = {
            to: order?.userId?.email,
            subject,
            html: htmlTemplate
          };

          await sendMail(userMailOptions);
        } catch (err) {
          console.error("User mail error:", err);
        }
      })();
    });

  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ success: false, message: 'Server error updating order status' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const query = {
      $or: [
        { isDeleted: false },
        { isDeleted: { $exists: false } }
      ]
    };

    if (role && role !== 'all') {
      query.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query, '-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      totalUsers: total
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
      { $match: { paymentStatus: 'completed' } },
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
    const { page = 1, limit = 20, status: statusRaw, priority } = req.query;
    const query = {};

    let status = statusRaw;
    if (status && status !== 'all') {
      if (status === 'replied') status = 'responded';
      if (status === 'resolved') status = 'closed';
      query.status = status;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await ContactUs.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ContactUs.countDocuments(query);

    res.json({
      success: true,
      message: "Success",
      data: messages,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      totalMessages: total
    });
  } catch (error) {
    console.error('Admin messages fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching messages' });
  }
};

const createMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message, inquiryType } = req.body;

    const newMessage = new ContactUs({
      firstName,
      lastName,
      email,
      subject,
      message,
      inquiryType,
      status: 'unread'
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

      const userMailOptions = {
        to: message.email,
        subject: "Thank you for contacting Zippyy",
        html: `<h2>Response to your query</h2>
<p>Dear ${message.name},</p>
<p>Thank you for reaching out to us. Here is the response to your message:</p>
<br>
<div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px;">
    <p><strong>Your original message:</strong></p>
    <p><em>${message.subject}</em></p>
    <p>${message.message.replace(/\n/g, '<br>')}}</p>
</div>
<br>
<div style="border-left: 4px solid #4f46e5; padding-left: 15px;">
    <p><strong>Admin Response:</strong></p>
    <p>${replyMessage.replace(/\n/g, '<br>')}}</p>
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
    const totalMessages = await ContactUs.countDocuments();
    const byStatus = await ContactUs.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusCounts = {
      unread: 0,
      read: 0,
      replied: 0,
      resolved: 0
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
        ...statusCounts
      }
    });
  } catch (error) {
    console.error('Message stats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching message statistics' });
  }
};

const createProduct = async (req, res) => {
  const createProductSchema = Joi.object({
    name: Joi.string().trim().min(2).required(),
    description: Joi.string().trim().required(),
    price: Joi.number().min(0).required(),
    salePrice: Joi.number().min(0).optional(),
    category: Joi.string().trim().required(),
    image: Joi.string().allow("").optional(),
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

    console.log("📦 Normalized productData:", productData);

    const product = new Products(productData);
    await product.save();

    console.log(`✅ Product created: ${product.name} by ${req.user.role}: ${req.user.email}`);

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
    salePrice: Joi.number().min(0).optional(),
    category: Joi.string().trim().optional(),
    image: Joi.string().allow("").optional(),
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
    const updates = req.body;

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
    category: Joi.string().max(160).allow(null, "")
  }).unknown(true);
  try {
    await connectDB();
    await validation.validateAsync(req.query, { abortEarly: true });
    let { page = 1, limit = 20, search = '', category } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    /** Match storefront / catalog: include docs where isDeleted is missing (legacy imports). */
    let query = {
      ...PRODUCT_NOT_DELETED,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    if (category && String(category).trim()) {
      const c = String(category).trim();
      query.category = {
        $regex: new RegExp(`^${escapeRegex(c)}$`, "i"),
      };
    }

    const [products, total, inStockCount, outOfStockCount, valueAgg] = await Promise.all([
      Products.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Products.countDocuments(query),
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
        totalPages: Math.ceil(total / limit),
        currentPage: page,
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
      .populate("productId", "name price")
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

    const category = await Category.create({
      name: value.name,
      image: value.image ?? "",
      main: value.main,
      sortOrder: value.sortOrder ?? 0,
      isActive: nextActive,
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

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = Math.min(parseInt(limit, 10) || 100, 200);
    const skip = (pageNumber - 1) * limitNumber;

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
        totalPages: Math.ceil(total / limitNumber) || 1
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

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name: value.name,
          image: value.image ?? "",
          main: value.main,
          sortOrder: value.sortOrder ?? 0,
          isActive: nextIsActive,
          updatedAt: Date.now(),
        },
      },
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

const homeSliderSettingsSchema = Joi.object({
  sectionBgColor: Joi.string().trim().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
  autoPlay: Joi.boolean().required(),
  autoPlayDelayMs: Joi.number().integer().min(1000).max(20000).required(),
  transitionDurationMs: Joi.number().integer().min(200).max(3000).required(),
  slidesPerViewDesktop: Joi.number().integer().min(1).max(4).required(),
  slidesPerViewTablet: Joi.number().integer().min(1).max(3).required(),
  slidesPerViewMobile: Joi.number().integer().min(1).max(2).required(),
  slides: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().max(120).required(),
        imageUrl: Joi.string().trim().uri().max(2048).required(),
        buttonText: Joi.string().trim().max(40).allow("").default("Shop Now"),
        buttonLink: Joi.string().trim().max(1024).allow("").default("/products"),
        cardBgColor: Joi.string().trim().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
        textColor: Joi.string().trim().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
        buttonBgColor: Joi.string().trim().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
        buttonTextColor: Joi.string().trim().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
        isActive: Joi.boolean().required(),
      })
    )
    .min(1)
    .max(12)
    .required(),
});

const normalizeSliderSettings = (settingsDoc) => {
  if (!settingsDoc) return null;
  const slides = (settingsDoc.slides || [])
    .filter((s) => s && s.imageUrl && s.title)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((s, idx) => ({
      title: s.title,
      imageUrl: s.imageUrl,
      buttonText: s.buttonText || "Shop Now",
      buttonLink: s.buttonLink || "/products",
      cardBgColor: s.cardBgColor || "#f8fafc",
      textColor: s.textColor || "#1e293b",
      buttonBgColor: s.buttonBgColor || "#3090cf",
      buttonTextColor: s.buttonTextColor || "#ffffff",
      isActive: s.isActive !== false,
      sortOrder: Number(s.sortOrder || idx),
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

    const slides = value.slides.map((slide, index) => ({
      ...slide,
      sortOrder: index,
    }));

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

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    return res.json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageUrl,
        fileName: req.file.originalname,
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
      "_id",
      "name",
      "description",
      "price",
      "salePrice",
      "category",
      "image",
      "inStock",
      "quantity",
      "cost",
      "unit",
      "discount",
      "dealId",
      "tagsJson",
      "nutritionInfoJson",
      "adminPrice",
      "isDisable",
      "isDeleted",
      "createdAt",
      "updatedAt",
    ];

    const rows = products.map((p) => {
      const tagsJson = JSON.stringify(Array.isArray(p.tags) ? p.tags : []);
      const nutritionInfoJson = JSON.stringify(p.nutritionInfo || {});

      return [
        p._id,
        p.name,
        p.description,
        Number(p.price || 0),
        Number(p.salePrice || 0),
        p.category,
        p.image || "",
        Boolean(p.inStock),
        Number(p.quantity || 0),
        Number(p.cost || 0),
        p.unit || "piece",
        Number(p.discount || 0),
        p.dealId || "",
        tagsJson,
        nutritionInfoJson,
        p.adminPrice || "",
        Boolean(p.isDisable),
        Boolean(p.isDeleted),
        p.createdAt ? new Date(p.createdAt).toISOString() : (p.date || ""),
        p.updatedAt ? new Date(p.updatedAt).toISOString() : (p.updatedAt || ""),
      ].map(escapeCsv).join(",");
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

const importProductsCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "CSV is empty",
      });
    }

    const safeParseJson = (value, fallback) => {
      try {
        if (value == null || value === "") return fallback;
        return JSON.parse(String(value));
      } catch {
        return fallback;
      }
    };

    const isObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id || ""));

    const successRows = [];
    const failedRows = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i] || {};
      try {
        const _id = String(row._id || "").trim();
        const name = String(row.name || "").trim();
        const description = String(row.description || "").trim();
        const category = String(row.category || "").trim();

        if (!name) throw new Error("name is required");
        if (!category) throw new Error("category is required");
        if (!description) throw new Error("description is required");

        const price = Number(row.price || 0);
        const salePrice = Number(row.salePrice || 0);
        const image = String(row.image || "").trim();
        const quantity = Number(row.quantity || 0);
        const cost = Number(row.cost || 0);
        const unit = String(row.unit || "piece").trim() || "piece";
        const discount = Number(row.discount || 0);
        const adminPrice = row.adminPrice === "" ? undefined : Number(row.adminPrice || 0);

        const inStockRaw = String(row.inStock || "").trim().toLowerCase();
        const inStock =
          inStockRaw === "true" ? true : inStockRaw === "false" ? false : quantity > 0;

        const dealId = String(row.dealId || "").trim();
        const normalizedDealId = dealId && isObjectId(dealId) ? dealId : undefined;

        const tagsJson = safeParseJson(row.tagsJson, null);
        const tagsRaw = row.tags || row.tagsCsv || row.tags_list;
        const tags =
          Array.isArray(tagsJson)
            ? tagsJson
            : typeof tagsRaw === "string" && tagsRaw
              ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
              : [];

        const nutritionInfoJson = safeParseJson(row.nutritionInfoJson, null);
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

        const isDisableRaw = String(row.isDisable || "").trim().toLowerCase();
        const isDisable = isDisableRaw === "true" ? true : isDisableRaw === "false" ? false : false;

        const updateDoc = {
          name,
          description,
          price: price >= 0 ? price : 0,
          salePrice: salePrice >= 0 ? salePrice : 0,
          category,
          image,
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

        if (_id && isObjectId(_id)) {
          await Products.updateOne(
            { _id: new mongoose.Types.ObjectId(_id) },
            { $set: updateDoc, $setOnInsert: { _id: new mongoose.Types.ObjectId(_id) } },
            { upsert: true }
          );
        } else {
          await Products.updateOne(
            { name, category },
            { $set: updateDoc },
            { upsert: true }
          );
        }

        successRows.push(rowNum);
      } catch (err) {
        failedRows.push({ row: rowNum, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Products CSV import completed",
      importedCount: successRows.length,
      failedCount: failedRows.length,
      failedRows,
    });
  } catch (error) {
    console.error("Import products CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import products CSV",
    });
  }
};



router.get('/dashboard', adminAuth, dashboardStats);

router.get('/users', adminAuth, getAllUsers);
router.put('/user/status/:id', adminAuth, updateUserStatus);
router.delete('/user/delete/:id', adminAuth, deleteUser);
router.patch('/users/:id/role', adminAuth, updateUserRole);

router.post('/products', adminAuth, createProduct);
router.put('/products/:id', adminAuth, updateProduct);
router.get('/products', adminAuth, getAdminProducts);
router.get('/products/export-csv', adminAuth, exportProductsCsv);
router.post('/products/import-csv', adminAuth, upload.single('file'), importProductsCsv);
router.delete('/products/:id', adminAuth, deleteProduct);
router.get('/analytics/products', adminAuth, getProductAnalytics);
router.post('/uploadBulkExcelProducts', adminAuth, upload.single('file'), uploadBulkExcelProducts);

router.post('/messages', adminAuth, createMessage);
router.get('/messages', adminAuth, getAllMessages);
router.post('/messages/reply', adminAuth, replyToMessage);
router.get('/messages/stats', adminAuth, getMessageStats);

router.get('/orders', adminAuth, getOrders);
router.get('/orders/export-csv', adminAuth, exportOrdersCsv);
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