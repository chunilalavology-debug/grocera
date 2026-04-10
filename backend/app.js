require("dotenv").config();
const express = require("express");
const cors = require("cors");
const errorHandler = require("./utils/errorHandler");
const controllers = require("./routes");
const { apiSuccessRes, apiErrorRes } = require("./utils/globalFunction");
const jwt = require("./routes/middlewares/jwt");
const http = require("http");
const cloudinary = require("cloudinary").v2;
const path = require("path");
/** Vercel serverless: only /tmp is writable; local uses backend folders */
const isVercel = Boolean(process.env.VERCEL);
const dir = isVercel ? path.join("/tmp", "upload") : path.join(__dirname, "upload");
const uploadsDir = isVercel ? path.join("/tmp", "uploads") : path.join(__dirname, "uploads");
const streamifier = require("streamifier");
const multer = require("multer");
const fs = require("fs");

const cloudinaryUploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function handleCloudinaryMulter(mw) {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return apiErrorRes(req, res, "File too large (max 15MB).", null);
      }
      return apiErrorRes(req, res, err.message || "Upload failed", null);
    });
  };
}
const shippingLabelsDir = path.join(uploadsDir, "labels");
if (isVercel) {
  [dir, uploadsDir, shippingLabelsDir].forEach((p) => {
    try {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    } catch (e) {
      console.error("mkdir upload dirs:", e.message);
    }
  });
}
const { morganMiddleware } = require("./routes/middlewares/morgan");
const Order = require("./db/models/Order");
const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const Stripe = require("stripe");
const Joi = require("joi");
const { sendNewOrderEmails } = require("./utils/orderEmails");
const { recordVoucherRedemptionOnce } = require("./utils/voucherRedemption");
const AppSettings = require("./db/models/AppSettings");
const stripeSecret = String(process.env.STRIPE_SECRET_KEY || "").trim();
let stripe = null;
if (stripeSecret) {
  try {
    stripe = new Stripe(stripeSecret);
  } catch (e) {
    console.error("Stripe initialization failed:", e.message);
  }
}
const PORT = process.env.PORT || 5000;
/** Optional: bind only to this host (e.g. 127.0.0.1 behind nginx). Unset = all interfaces. */
const LISTEN_HOST = String(process.env.LISTEN_HOST || "").trim();
/** Absolute or path relative to this file’s directory; when set and build exists, serve CRA production build. */
const FRONTEND_BUILD_PATH = String(process.env.FRONTEND_BUILD_PATH || "").trim();
const serveProductionSpa = Boolean(FRONTEND_BUILD_PATH);
/** Set STRIPE_WEBHOOK_DEBUG=1 to log Stripe event handling (off in production by default). */
const stripeWhLog = (...args) => {
  if (String(process.env.STRIPE_WEBHOOK_DEBUG || "").trim() === "1") {
    console.log("[stripe webhook]", ...args);
  }
};
const API_END_POINT_V1 =
  String(process.env.API_END_POINT_V1 || "/api").replace(/\/+$/, "") || "/api";
const {
  FRONTEND_URL,
  CLOUDNARY_CLOUD_NAME,
  CLOUDNARY_API_KEY,
  CLOUDNARY_API_SECRET,
} = process.env;

const corsOrigins = [];
const addCors = (origin) => {
  const o = origin && String(origin).trim();
  if (o && !corsOrigins.includes(o)) corsOrigins.push(o);
};
if (FRONTEND_URL) {
  String(FRONTEND_URL)
    .split(",")
    .forEach((x) => addCors(x));
}
if (process.env.FRONTEND_URLS) {
  String(process.env.FRONTEND_URLS)
    .split(",")
    .forEach((x) => addCors(x));
}
if (process.env.VERCEL_URL) addCors(`https://${process.env.VERCEL_URL}`);
addCors("http://localhost:3000");
addCors("http://127.0.0.1:3000");

function isPrivateLanOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  } catch (_) {
    return false;
  }
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== "production" && isPrivateLanOrigin(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static("public"));
// app.use(multer().any());

const mongoose = require("mongoose");

if (!serveProductionSpa) {
  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "grocera-api",
      health: `${API_END_POINT_V1}/health`,
      note: "Root is public; most /api/* routes require a Bearer token.",
    });
  });
}

app.get(`${API_END_POINT_V1}/health`, async (_req, res) => {
  const labels = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  const uri = (process.env.MONGO_URI || process.env.DB_STRING || "").trim();
  if (!uri) {
    return res.status(503).json({
      ok: false,
      mongo: "no_uri",
      apiBase: API_END_POINT_V1,
      hint: "Set MONGO_URI or DB_STRING on Vercel (Production). Whitespace/newlines in pasted values break the URI.",
    });
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      await Promise.race([
        mongoose.connection.readyState === 2
          ? mongoose.connection.asPromise()
          : mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Mongo selection timeout")), 8500),
        ),
      ]);
    }
  } catch (e) {
    const rs = mongoose.connection.readyState;
    return res.status(503).json({
      ok: false,
      mongo: labels[rs] ?? rs,
      apiBase: API_END_POINT_V1,
      detail: process.env.NODE_ENV !== "production" ? e.message : undefined,
      hint:
        "Atlas: Network Access allow 0.0.0.0/0 (or Vercel); verify DB user/password; URL-encode @ # : / ? in password; URI must include db name before ?.",
    });
  }
  const rs = mongoose.connection.readyState;
  const mongoOk = rs === 1;
  res.status(mongoOk ? 200 : 503).json({
    ok: mongoOk,
    mongo: mongoOk ? "connected" : labels[rs] ?? rs,
    apiBase: API_END_POINT_V1,
    hint: mongoOk ? undefined : "Mongo did not reach connected state. Check Atlas cluster and connection string.",
  });
});

/** Stripe / checkout: must stay before JWT (path is not under /api). */
app.get("/verify-session/:id", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      paid: false,
      orderNumber: null,
      error: "Stripe is not configured (missing STRIPE_SECRET_KEY).",
    });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id);
    const order = await Order.findOne({
      stripeSessionId: session.id,
    });
    return res.json({
      paid: session.payment_status === "paid",
      orderNumber: order?.orderNumber,
    });
  } catch (e) {
    return res.status(400).json({
      paid: false,
      orderNumber: null,
      error: e.message || "Invalid session",
    });
  }
});

app.use(jwt.attachUserFromBearerForOrderPayment);
app.use(jwt());
app.use("/upload", express.static(dir));
app.use("/uploads", express.static(uploadsDir));
app.use(morganMiddleware);

app.post(
  '/api/orders/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event;

    try {
      if (!stripe) {
        console.error("Stripe webhook ignored: STRIPE_SECRET_KEY not set");
        return res.status(200).json({ received: true, skipped: "stripe_not_configured" });
      }
      const signature = req.headers['stripe-signature'];
      const whSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
      if (!whSecret) {
        console.error("Stripe webhook ignored: STRIPE_WEBHOOK_SECRET not set");
        return res.status(200).json({ received: true, skipped: "webhook_secret_not_configured" });
      }

      event = stripe.webhooks.constructEvent(req.body, signature, whSecret);
    } catch (err) {
      console.error("❌ Invalid webhook signature:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {

        case 'checkout.session.completed': {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;
          if (!orderId) break;

          await markPaidAndSendMail(orderId, session, req);
          stripeWhLog("checkout.session.completed", orderId);
          break;
        }

        case 'payment_intent.succeeded': {
          const pi = event.data.object;
          const orderId = pi.metadata?.orderId;
          if (!orderId) break;

          await markPaidAndSendMail(orderId, {
            payment_intent: pi.id
          }, req);

          stripeWhLog("payment_intent.succeeded", orderId);
          break;
        }

        /**
         Async success (BNPL / ACH)
        */
        case 'checkout.session.async_payment_succeeded': {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;
          if (!orderId) break;

          await markPaidAndSendMail(orderId, session, req);
          stripeWhLog("checkout.session.async_payment_succeeded", orderId);
          break;
        }

        /**
         REAL payment failure
        */
        case 'checkout.session.async_payment_failed': {
          const session = event.data.object;

          await Order.findOneAndUpdate(
            {
              _id: session.metadata?.orderId,
              paymentStatus: 'pending'
            },
            {
              paymentStatus: 'failed',
              status: 'failed',
              failureReason: 'Async payment failed',
              failedAt: new Date()
            }
          );

          console.error("Stripe async payment failed:", session.metadata?.orderId);
          break;
        }

        /**
         User closed tab / didn’t pay
         ❌ NOT a failure
        */
        case 'checkout.session.expired': {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;
          if (!orderId) break;

          await Order.findOneAndUpdate(
            {
              _id: orderId,
              paymentStatus: 'pending'
            },
            {
              paymentStatus: 'expired',
              status: 'abandoned',
              expiredAt: new Date()
            }
          );

          stripeWhLog("checkout.session.expired", orderId);
          break;
        }

        /**
         Refunds
        */
        case 'charge.refunded': {
          const charge = event.data.object;

          const order = await Order.findOne({
            stripePaymentIntentId: charge.payment_intent
          });

          if (order) {
            order.paymentStatus = 'refunded';
            order.status = 'refunded';
            order.refundAmount = charge.amount_refunded / 100;
            order.refundDate = new Date();
            await order.save();

            stripeWhLog("charge.refunded", order.orderNumber);
          }

          break;
        }

        default:
          stripeWhLog("ignored event", event.type);
      }

      // ✅ ALWAYS ACK STRIPE FAST
      res.json({ received: true });

    } catch (err) {
      console.error("❌ Webhook processing error:", err);

      // ❗ Stripe retry se bachne ke liye 200 hi return
      res.status(200).json({ received: true });
    }
  }
);

app.use(express.json({ limit: "10mb" }));
const { comingSoonApiGate } = require("./routes/middlewares/comingSoonApiGate");
app.use(comingSoonApiGate);
for (const [route, controller] of Object.entries(controllers)) {
  app.use(`${API_END_POINT_V1}/${route}`, controller);
}

const getPublicSiteSettings = require("./routes/publicSiteSettings");
const putSiteBrandingSettings = require("./routes/putSiteBrandingSettings");
const { invalidateComingSoonCache } = require("./routes/middlewares/comingSoonApiGate");
const { authorize } = require("./routes/middlewares/rbacMiddleware");
app.get(`${API_END_POINT_V1}/settings`, getPublicSiteSettings);
app.put(`${API_END_POINT_V1}/settings`, authorize(["admin"]), putSiteBrandingSettings);
app.get(`${API_END_POINT_V1}/settings/zippy-coming-soon`, async (_req, res) => {
  try {
    const doc = await AppSettings.findOne().select("comingSoon").lean();
    const payload = {
      enabled: Boolean(doc?.comingSoon?.zippyShipsPageEnabled),
      headline:
        doc?.comingSoon?.headline != null && String(doc.comingSoon.headline).trim() !== ""
          ? String(doc.comingSoon.headline).trim()
          : "Zippy Ships is coming soon",
      message:
        doc?.comingSoon?.message != null && String(doc.comingSoon.message).trim() !== ""
          ? String(doc.comingSoon.message).trim()
          : "We're working hard to bring fast and reliable shipping to you.",
      subscriptionEnabled: doc?.comingSoon?.subscriptionEnabled !== false,
    };
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      Pragma: "no-cache",
      Expires: "0",
    });
    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error("get zippy-coming-soon error:", error);
    return res.status(500).json({ success: false, message: "Failed to load Zippy Ships setting" });
  }
});
app.post(`${API_END_POINT_V1}/settings/zippy-coming-soon`, authorize(["admin"]), async (req, res) => {
  try {
    const schema = Joi.object({
      enabled: Joi.boolean().required(),
      headline: Joi.string().trim().max(200).allow("").optional(),
      message: Joi.string().trim().max(2000).allow("").optional(),
      subscriptionEnabled: Joi.boolean().optional(),
    });
    const body = await schema.validateAsync(req.body || {}, { abortEarly: true });
    const headline = String(body.headline ?? "").trim() || "Zippy Ships is coming soon";
    const message =
      String(body.message ?? "").trim() ||
      "We're working hard to bring fast and reliable shipping to you.";
    const doc = await AppSettings.findOneAndUpdate(
      {},
      {
        $set: {
          "comingSoon.zippyShipsPageEnabled": Boolean(body.enabled),
          "comingSoon.headline": headline,
          "comingSoon.message": message,
          "comingSoon.subscriptionEnabled": body.subscriptionEnabled !== false,
          "comingSoon.siteWideEnabled": false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    invalidateComingSoonCache();
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      Pragma: "no-cache",
      Expires: "0",
    });
    return res.json({
      success: true,
      message: "Zippy Ships coming soon setting saved",
      data: {
        enabled: Boolean(doc?.comingSoon?.zippyShipsPageEnabled),
        headline: String(doc?.comingSoon?.headline || "Zippy Ships is coming soon"),
        message: String(
          doc?.comingSoon?.message || "We're working hard to bring fast and reliable shipping to you.",
        ),
        subscriptionEnabled: doc?.comingSoon?.subscriptionEnabled !== false,
      },
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("post zippy-coming-soon error:", error);
    return res.status(500).json({ success: false, message: "Failed to save Zippy Ships setting" });
  }
});

cloudinary.config({
  cloud_name: CLOUDNARY_CLOUD_NAME,
  api_key: CLOUDNARY_API_KEY,
  api_secret: CLOUDNARY_API_SECRET,
});

function uploadToCloudinary(buffer, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

app.post(
  "/api/v1/uploadImage",
  handleCloudinaryMulter(cloudinaryUploadMulter.any()),
  async (req, res) => {
    const file = req.files?.[0];
    if (!file || !file.buffer) {
      return apiErrorRes(req, res, "No file uploaded.", null);
    }

    const mimeType = file.mimetype;
    let resourceType = "image";

    if (mimeType === "application/pdf") {
      resourceType = "raw";
    }

    try {
      const result = await uploadToCloudinary(file.buffer, resourceType);

      return apiSuccessRes(req, res, "SUCCESS.", {
        imageName: file.originalname,
        imageUrl: result.secure_url,
      });
    } catch (error) {
      return apiErrorRes(req, res, "Error uploading image.", null);
    }
  }
);

app.post(
  "/api/v1/uploadMultipleImages",
  handleCloudinaryMulter(cloudinaryUploadMulter.any()),
  async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return apiErrorRes(req, res, "No files uploaded.", null);
  }

  try {
    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const mimeType = file.mimetype;
        let resourceType = "image"; // default

        if (mimeType === "application/pdf") {
          resourceType = "raw"; // For PDFs
        }

        const result = await uploadToCloudinary(file.buffer, resourceType);

        return {
          imageName: file.originalname,
          imageUrl: result.secure_url,
        };
      })
    );

    return apiSuccessRes(req, res, "SUCCESS.", uploadResults);
  } catch (error) {
    console.error(error);
    return apiErrorRes(req, res, "Error uploading multiple files.", null);
  }
});

async function markPaidAndSendMail(orderId, session, webhookReq) {
  const sessionEmailRaw =
    (session.customer_details && session.customer_details.email) ||
    session.customer_email ||
    (session.customer && session.customer.email) ||
    "";
  const sessionEmail = sessionEmailRaw ? String(sessionEmailRaw).trim().toLowerCase() : "";

  const currentOrder = await Order.findById(orderId).select("paymentMethod otcAmount");
  const isSplit = String(currentOrder?.paymentMethod || "") === "split";
  const splitOtcAmount = Number(currentOrder?.otcAmount || 0);
  const updatePayload = {
    paymentStatus: isSplit && splitOtcAmount > 0 ? "partial" : "paid",
    status: "confirmed",
    stripePaymentIntentId: session.payment_intent,
    paidAt: new Date(),
  };
  if (sessionEmail) {
    updatePayload.customerEmail = sessionEmail;
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: { $ne: "paid" },
    },
    { $set: updatePayload },
    { new: true }
  )
    .populate('userId', 'email name')
    .populate('items.product', 'name image')
    .populate('addressId', 'name phone fullAddress city state pincode');

  if (order && order.isShippingOrder) {
    try {
      // For shipping-only orders, show them under "processing" in My Orders UI.
      if (order.status !== 'processing') {
        order.status = 'processing';
        await order.save();
      }

      if (!order.shippingLabelUrl) {
        if (!fs.existsSync(shippingLabelsDir)) {
          fs.mkdirSync(shippingLabelsDir, { recursive: true });
        }

        const fileName = `shipping-label-${order.orderNumber}.html`;
        const filePath = path.join(shippingLabelsDir, fileName);

        const destination = order.addressId?.fullAddress || '';
        const city = order.addressId?.city || '';
        const state = order.addressId?.state || '';
        const pincode = order.addressId?.pincode || '';

        const protocol = webhookReq?.protocol || 'http';
        const host = webhookReq?.get?.('host') || `localhost:${process.env.PORT || 5000}`;
        const labelUrl = `${protocol}://${host}/uploads/labels/${fileName}`;

        const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ZippyyyShips Label</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}
      .box{border:2px solid #3090cf;border-radius:12px;padding:18px}
      .row{display:flex;gap:24px;flex-wrap:wrap}
      .col{flex:1;min-width:240px}
      h1{font-size:20px;margin:0 0 12px}
      .small{font-size:12px;color:#444}
      .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
      .tag{display:inline-block;padding:6px 10px;border-radius:999px;background:#eff6ff;color:#1e40af;font-weight:700;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      td{border-top:1px solid #eee;padding:8px 0;font-size:14px}
      .right{text-align:right}
      .footer{margin-top:16px;font-size:12px;color:#555}
      @media print{body{margin:0}.box{border:0}}
    </style>
  </head>
  <body>
    <div class="box">
      <div class="row">
        <div class="col">
          <h1>ZippyyyShips Shipping Label</h1>
          <div class="small">Carrier: <span class="tag">${order.carrier || 'ZippyyyShips'}</span></div>
          <div class="small">Tracking: <span class="mono">${order.trackingNumber || ''}</span></div>
        </div>
        <div class="col">
          <h1 style="margin-bottom:6px">Order #${order.orderNumber}</h1>
          <div class="small">Amount Paid: <b>$${Number(order.shippingAmount || 0).toFixed(2)}</b></div>
          ${order.notes ? `<div class="small" style="margin-top:8px">Notes: ${order.notes}</div>` : ''}
        </div>
      </div>

      <div style="margin-top:16px" class="row">
        <div class="col">
          <div class="small" style="font-weight:700;margin-bottom:8px">Ship To</div>
          <div style="font-size:14px;font-weight:700">${order.addressId?.name || ''}</div>
          <div style="font-size:13px;color:#333;margin-top:4px">${destination}</div>
          <div style="font-size:13px;color:#333;margin-top:4px">${city}${city && state ? ', ' : ''}${state} ${pincode}</div>
          <div class="small" style="margin-top:4px">Phone: ${order.addressId?.phone || ''}</div>
        </div>
      </div>

      <table>
        <tr><td>Service</td><td class="right">ZippyyyShips</td></tr>
        <tr><td>Status</td><td class="right">${order.status || 'processing'}</td></tr>
        <tr><td>Tracking</td><td class="right mono">${order.trackingNumber || ''}</td></tr>
      </table>

      <div class="footer">Generated automatically by ZippyyyShips (demo label until provider integration is connected).</div>
    </div>
  </body>
</html>
        `.trim();

        fs.writeFileSync(filePath, html, "utf8");
        order.shippingLabelUrl = labelUrl;
        await order.save();
      }
    } catch (labelErr) {
      console.error("Shipping label generation error:", labelErr);
    }
  }

  if (order) {
    try {
      await recordVoucherRedemptionOnce(order._id);
    } catch (vrErr) {
      console.error("recordVoucherRedemptionOnce:", vrErr?.message || vrErr);
    }
    setImmediate(() => {
      sendNewOrderEmails(order._id).catch((e) => console.error("sendNewOrderEmails:", e?.message || e));
    });
  }
}

if (serveProductionSpa) {
  const buildPath = path.isAbsolute(FRONTEND_BUILD_PATH)
    ? path.normalize(FRONTEND_BUILD_PATH)
    : path.resolve(__dirname, FRONTEND_BUILD_PATH);
  const indexHtml = path.join(buildPath, "index.html");
  if (fs.existsSync(indexHtml)) {
    const staticMaxAge = process.env.NODE_ENV === "production" ? "7d" : 0;
    app.use(
      express.static(buildPath, {
        maxAge: staticMaxAge,
        index: "index.html",
        fallthrough: true,
      }),
    );
    app.get("*", (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      const p = req.path || "";
      if (p.startsWith(API_END_POINT_V1)) return next();
      if (p.startsWith("/upload") || p.startsWith("/uploads")) return next();
      if (p.startsWith("/verify-session")) return next();
      res.sendFile(indexHtml);
    });
  } else {
    console.warn(
      `[grocera] FRONTEND_BUILD_PATH is set but index.html is missing: ${indexHtml}. ` +
        "Build the frontend (npm run build --prefix frontend) or unset FRONTEND_BUILD_PATH.",
    );
  }
}

app.use(errorHandler);

/**
 * Only bind HTTP when this file is the entrypoint (`node app.js`).
 * Vercel loads `app` via `api/index.js` — there `require.main` is not this module, so we must not listen.
 * Do not gate on `process.env.VERCEL` alone: some dev shells set VERCEL=1 and would skip listen incorrectly.
 */
if (require.main === module) {
  const onListen = () => {
    const hostLabel = LISTEN_HOST || "0.0.0.0 (all interfaces)";
    console.log(`Server is up on ${hostLabel}, port ${PORT}.`);
    console.log(`Health check: http://localhost:${PORT}${API_END_POINT_V1}/health`);
    if (serveProductionSpa) {
      console.log("Serving production SPA from FRONTEND_BUILD_PATH.");
    }
  };
  const listener = LISTEN_HOST
    ? server.listen(PORT, LISTEN_HOST, onListen)
    : server.listen(PORT, onListen);
  listener
    .on("error", (err) => {
      console.error("Could not start the HTTP server:", err.message);
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. On Windows, 5000 is often taken by "Air Play Receiver" or another app.`
        );
        console.error(
          `Fix: set PORT=5001 in backend/.env, then set REACT_APP_API_URL=http://localhost:5001/api in frontend/.env.local and restart npm start (dev proxy reads that URL).`
        );
      }
      process.exit(1);
    });
}

module.exports = app;
