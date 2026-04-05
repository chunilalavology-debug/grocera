const mongoose = require("mongoose");
const Orders = require("../db/models/Order");
const AppSettings = require("../db/models/AppSettings");
const { sendMail } = require("./mailService");
const { getCustomerEmail } = require("./orderEmailUtils");
const OrderConform = require("./template/userOrderConform");
const AdminNotification = require("./template/AdminNotification");
const userOrderStatusUpdate = require("./template/userOrderStatusUpdate");
const OrderDelivered = require("./template/userOrderDeliverd");
const OrderCancelled = require("./template/userOrderCancelled");
const {
  renderTemplateKey,
  buildOrderTemplateVars,
} = require("./emailTemplateService");

async function getAdminOrderNotificationEmail() {
  try {
    const s = await AppSettings.findOne().lean();
    const a = s && String(s.adminMail || "").trim();
    if (a) return a;
  } catch {
    /* ignore */
  }
  return String(
    process.env.ADMIN_ORDER_EMAIL ||
      process.env.CONTACT_FORM_TO_EMAIL ||
      process.env.EMAIL_USER ||
      ""
  ).trim();
}

async function loadOrderForMail(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return null;
  return Orders.findById(orderId)
    .populate("userId", "email name")
    .populate("items.product", "name image")
    .populate("addressId", "name phone fullAddress city state pincode addressType")
    .lean();
}

async function renderCustomerNew(order) {
  const vars = buildOrderTemplateVars(order);
  const r = await renderTemplateKey("order_customer_new", vars);
  if (r && r.html) return r;
  return {
    subject: `Order confirmation – #${order.orderNumber}`,
    html: OrderConform(order),
  };
}

async function renderAdminNew(order) {
  const vars = buildOrderTemplateVars(order);
  const r = await renderTemplateKey("order_admin_new", vars);
  if (r && r.html) return r;
  return {
    subject: `New order – #${order.orderNumber}`,
    html: AdminNotification(order),
  };
}

async function sendNewOrderEmails(orderId, { force = false } = {}) {
  const order = await loadOrderForMail(orderId);
  if (!order) return { ok: false, reason: "not_found" };
  if (order.isShippingOrder && !force) return { ok: true, skipped: true, reason: "shipping_order" };
  if (order.emailSent === true && !force) return { ok: true, skipped: true };

  const customerEmail = getCustomerEmail(order);
  const adminTo = await getAdminOrderNotificationEmail();

  let custRendered;
  let adminRendered;
  try {
    custRendered = await renderCustomerNew(order);
  } catch (e) {
    console.error("renderCustomerNew", e);
    custRendered = {
      subject: `Order confirmation – #${order.orderNumber}`,
      html: OrderConform(order),
    };
  }
  try {
    adminRendered = await renderAdminNew(order);
  } catch (e) {
    console.error("renderAdminNew", e);
    adminRendered = {
      subject: `New order – #${order.orderNumber}`,
      html: AdminNotification(order),
    };
  }

  const results = await Promise.allSettled([
    customerEmail
      ? sendMail({
          to: customerEmail,
          subject: custRendered.subject,
          html: custRendered.html,
        })
      : Promise.resolve(null),
    adminTo
      ? sendMail({
          to: adminTo,
          subject: adminRendered.subject,
          html: adminRendered.html,
        })
      : Promise.resolve(null),
  ]);

  const customerFailed = results[0].status === "rejected";
  const adminFailed = results[1].status === "rejected";
  if (customerFailed) console.error("sendNewOrderEmails customer:", results[0].reason);
  if (adminFailed) console.error("sendNewOrderEmails admin:", results[1].reason);

  if (!customerFailed || !adminTo) {
    await Orders.updateOne({ _id: orderId }, { $set: { emailSent: true } });
  }

  return {
    ok: !customerFailed,
    customerEmail: customerEmail || null,
    adminTo: adminTo || null,
    customerFailed,
    adminFailed,
  };
}

function subjectForStatus(orderNumber, status) {
  const n = orderNumber || "";
  const map = {
    pending: `Order pending – #${n}`,
    confirmed: `Order confirmed – #${n}`,
    processing: `Order processing – #${n}`,
    on_hold: `Order on hold – #${n}`,
    packed: `Order packed – #${n}`,
    shipped: `Order shipped – #${n}`,
    on_the_way: `Order on the way – #${n}`,
    delivered: `Order delivered – #${n}`,
    completed: `Order completed – #${n}`,
    cancelled: `Order cancelled – #${n}`,
    refunded: `Order refunded – #${n}`,
    failed: `Order update – #${n}`,
  };
  return map[status] || `Order update – #${n}`;
}

function htmlForStatus(order, status) {
  if (status === "delivered" || status === "completed") return OrderDelivered(order);
  if (status === "cancelled") return OrderCancelled(order);
  return userOrderStatusUpdate(order, status);
}

/** Try keys in order: status-specific → shared → generic fallback. */
function templateKeysForStatus(status) {
  const s = String(status || "").toLowerCase();
  const keys = [];
  if (s === "delivered" || s === "completed") {
    keys.push("order_completed");
  } else if (s === "cancelled") {
    keys.push("order_cancelled");
  } else if (s) {
    keys.push(`order_status_${s}`);
  }
  keys.push("order_status_update");
  return [...new Set(keys)];
}

async function sendOrderStatusChangeEmail(orderDocOrLean, status) {
  let order =
    orderDocOrLean && typeof orderDocOrLean.toObject === "function"
      ? orderDocOrLean.toObject()
      : orderDocOrLean;

  const oid = order && order._id;
  if (oid) {
    try {
      const fresh = await loadOrderForMail(oid);
      if (fresh) order = fresh;
    } catch (e) {
      console.warn("sendOrderStatusChangeEmail: reload order failed", e?.message || e);
    }
  }

  const to = getCustomerEmail(order);
  if (!to) {
    console.warn("sendOrderStatusChangeEmail: no customer email for order", order?.orderNumber);
    return { ok: false, reason: "no_email" };
  }

  const vars = buildOrderTemplateVars(order, { status });
  const keys = templateKeysForStatus(status);

  for (const key of keys) {
    try {
      const r = await renderTemplateKey(key, vars);
      if (r && r.html && String(r.subject || "").trim()) {
        await sendMail({ to, subject: r.subject, html: r.html });
        return { ok: true, templateKey: key };
      }
    } catch (e) {
      console.error("sendOrderStatusChangeEmail template", key, e);
    }
  }

  const subject = subjectForStatus(order.orderNumber, status);
  const html = htmlForStatus(order, status);
  await sendMail({ to, subject, html });
  return { ok: true, templateKey: "legacy_html" };
}

module.exports = {
  sendNewOrderEmails,
  sendOrderStatusChangeEmail,
  getAdminOrderNotificationEmail,
  loadOrderForMail,
};
