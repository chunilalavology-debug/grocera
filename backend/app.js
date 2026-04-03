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
const fs = require("fs");
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
const server = http.createServer(app);
const Stripe = require("stripe");
const { default: sendMail } = require("./utils/sendEmail");
const OrderConform = require("./utils/template/userOrderConform");
const AdminNotification = require("./utils/template/AdminNotification");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 5000;
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
app.get(`${API_END_POINT_V1}/health`, (_req, res) => {
  const rs = mongoose.connection.readyState;
  const labels = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  const mongoOk = rs === 1;
  res.status(mongoOk ? 200 : 503).json({
    ok: mongoOk,
    mongo: labels[rs] ?? rs,
    apiBase: API_END_POINT_V1,
    hint: mongoOk
      ? undefined
      : "Set DB_STRING in backend/.env and ensure MongoDB is reachable (local service or Atlas).",
  });
});

/** Stripe / checkout: must stay before JWT (path is not under /api). */
app.get("/verify-session/:id", async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.params.id);
  const order = await Order.findOne({
    stripeSessionId: session.id,
  });
  res.json({
    paid: session.payment_status === "paid",
    orderNumber: order?.orderNumber,
  });
});

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
      const signature = req.headers['stripe-signature'];

      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

    } catch (err) {
      console.error("❌ Invalid webhook signature:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Unhandled event: ${event.type}`)
    try {
      switch (event.type) {

        case 'checkout.session.completed': {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;
          if (!orderId) break;

          await markPaidAndSendMail(orderId, session, req);
          console.log("✅ Payment confirmed:", orderId);
          break;
        }

        case 'payment_intent.succeeded': {
          const pi = event.data.object;
          const orderId = pi.metadata?.orderId;
          if (!orderId) break;

          await markPaidAndSendMail(orderId, {
            payment_intent: pi.id
          }, req);

          console.log("✅ PaymentIntent succeeded:", orderId);
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
          console.log("✅ Async payment success:", orderId);
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

          console.log("❌ Async payment failed");
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

          console.log("⌛ Checkout abandoned:", orderId);
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

            console.log("💸 Order refunded:", order.orderNumber);
          }

          break;
        }

        default:
          console.log(`Unhandled event: ${event.type}`);
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
for (const [route, controller] of Object.entries(controllers)) {
  app.use(`${API_END_POINT_V1}/${route}`, controller);
}

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

app.post("/api/v1/uploadImage", async (req, res) => {
  console.log(req.files[0]);
  if (!req.files[0]) {
    return apiErrorRes(req, res, "No file uploaded.", null);
  }

  const mimeType = req.files[0].mimetype;
  let resourceType = "image"; // Default resource type

  // Determine resource type based on mime type
  if (mimeType === "application/pdf") {
    resourceType = "raw"; // Use 'raw' for non-image files like PDFs
  }

  try {
    const result = await uploadToCloudinary(req.files[0].buffer, resourceType);

    return apiSuccessRes(req, res, "SUCCESS.", {
      imageName: req.files[0].originalname,
      imageUrl: result.secure_url,
    });
  } catch (error) {
    return apiErrorRes(req, res, "Error uploading image.", null);
  }
});

app.post("/api/v1/uploadMultipleImages", async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return apiErrorRes(req, res, "No files uploaded.", null);
  }

  try {
    const uploadResults = await Promise.all(
      req.files.map(async (file) => {
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
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: { $ne: 'paid' }
    },
    {
      paymentStatus: 'paid',
      status: 'confirmed',
      stripePaymentIntentId: session.payment_intent,
      paidAt: new Date()
    },
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

  if (order && !order.isShippingOrder && order.emailSent !== true) {
    const userMail = {
      to: order.userId?.email,
      subject: `Zippyyy Order Confirmation – #${order.orderNumber}`,
      html: OrderConform(order)
    }

    const adminMail = {
      to: process.env.EMAIL_USER || "admin@zippyyy.com",
      subject: `New Order Alert! 🚨 – #${order.orderNumber}`,
      html: AdminNotification(order)
    };

    setImmediate(() => {
      sendMail(userMail)
      sendMail(adminMail)
    });

    await Order.findByIdAndUpdate(order._id, { emailSent: true });
  }
}

app.use(errorHandler);

/**
 * Only bind HTTP when this file is the entrypoint (`node app.js`).
 * Vercel loads `app` via `api/index.js` — there `require.main` is not this module, so we must not listen.
 * Do not gate on `process.env.VERCEL` alone: some dev shells set VERCEL=1 and would skip listen incorrectly.
 */
if (require.main === module) {
  server
    .listen(PORT, () => {
      console.log(`Server is up and running on port ${PORT}.`);
      console.log(`Health check: http://localhost:${PORT}${API_END_POINT_V1}/health`);
    })
    .on("error", (err) => {
      console.error("Could not start the HTTP server:", err.message);
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. On Windows, 5000 is often taken by "Air Play Receiver" or another app.`
        );
        console.error(
          `Fix: set PORT=5001 in backend/.env, then set REACT_APP_API_URL=http://localhost:5001/api in frontend/.env.development (or .env.local), restart both.`
        );
      }
      process.exit(1);
    });
}

module.exports = app;
