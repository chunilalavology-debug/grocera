const mongoose = require("mongoose");
const Orders = require("../db/models/Order");
const AppSettings = require("../db/models/AppSettings");
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
const { sendTransactionalEmailIfEnabled } = require("./emailService");

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
  const isOtcStyle =
    String(order?.paymentMethod || "").toLowerCase() === "otc" ||
    String(order?.paymentMethod || "").toLowerCase() === "split";
  const adminTemplateKey = isOtcStyle ? "order_admin_otc" : "order_admin_new";
  const r = await renderTemplateKey(adminTemplateKey, vars);
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

  const needCustomer = force || order.emailSent !== true;
  const needAdmin = force || order.adminNewOrderEmailHandled !== true;

  if (!needCustomer && !needAdmin) {
    return { ok: true, skipped: true, reason: "already_handled" };
  }

  const customerEmail = getCustomerEmail(order);
  const adminTo = await getAdminOrderNotificationEmail();

  let custRendered;
  let adminRendered;
  if (needCustomer) {
    try {
      custRendered = await renderCustomerNew(order);
    } catch (e) {
      console.error("renderCustomerNew", e);
      custRendered = {
        subject: `Order confirmation – #${order.orderNumber}`,
        html: OrderConform(order),
      };
    }
  }
  if (needAdmin) {
    try {
      adminRendered = await renderAdminNew(order);
    } catch (e) {
      console.error("renderAdminNew", e);
      adminRendered = {
        subject: `New order – #${order.orderNumber}`,
        html: AdminNotification(order),
      };
    }
  }

  let customerFailed = false;
  let adminFailed = false;

  if (needCustomer) {
    if (!customerEmail) {
      await Orders.updateOne({ _id: orderId }, { $set: { emailSent: true } });
    } else {
      try {
        const r = await sendTransactionalEmailIfEnabled({
          emailType: "orderConfirmationUser",
          to: customerEmail,
          subject: custRendered.subject,
          html: custRendered.html,
        });
        if (r.sent || (r.skipped && (r.reason === "disabled" || r.reason === "no_recipient"))) {
          await Orders.updateOne({ _id: orderId }, { $set: { emailSent: true } });
        }
      } catch (e) {
        customerFailed = true;
        console.error("sendNewOrderEmails customer:", e?.message || e);
      }
    }
  }

  if (needAdmin) {
    if (!adminTo) {
      await Orders.updateOne({ _id: orderId }, { $set: { adminNewOrderEmailHandled: true } });
    } else {
      try {
        const r = await sendTransactionalEmailIfEnabled({
          emailType: "adminNewOrder",
          to: adminTo,
          subject: adminRendered.subject,
          html: adminRendered.html,
        });
        if (r.sent || (r.skipped && (r.reason === "disabled" || r.reason === "no_recipient"))) {
          await Orders.updateOne({ _id: orderId }, { $set: { adminNewOrderEmailHandled: true } });
        }
      } catch (e) {
        adminFailed = true;
        console.error("sendNewOrderEmails admin:", e?.message || e);
      }
    }
  }

  return {
    ok: !customerFailed && !adminFailed,
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
  const s = String(status || "").toLowerCase();
  return map[s] || `Order update – #${n}`;
}

function htmlForStatus(order, status) {
  if (status === "delivered" || status === "completed") return OrderDelivered(order);
  if (status === "cancelled") return OrderCancelled(order);
  return userOrderStatusUpdate(order, status);
}

/** Prefer specific status template, then delivered/cancelled variants, then generic. */
function templateKeysForStatus(status) {
  const s = String(status || "").toLowerCase();
  const keys = [];
  if (s) keys.push(`order_status_${s}`);
  if (s === "delivered" || s === "completed") keys.push("order_completed");
  if (s === "cancelled") keys.push("order_cancelled");
  keys.push("order_status_update");
  return [...new Set(keys)];
}

async function markOrderStatusEmailed(orderId, status) {
  const s = String(status || "").toLowerCase();
  if (!mongoose.Types.ObjectId.isValid(orderId) || !s) return;
  await Orders.updateOne({ _id: orderId }, { $addToSet: { emailedOrderStatuses: s } });
}

async function sendOrderStatusChangeEmail(orderDocOrLean, status) {
  const s = String(status || "").toLowerCase();
  if (!s || s === "session") {
    return { ok: true, skipped: true, reason: "no_status" };
  }

  let order =
    orderDocOrLean && typeof orderDocOrLean.toObject === "function"
      ? orderDocOrLean.toObject()
      : orderDocOrLean;

  const oid = order && order._id;
  if (!oid) {
    return { ok: false, reason: "no_id" };
  }

  let fresh;
  try {
    fresh = await loadOrderForMail(oid);
    if (fresh) order = fresh;
  } catch (e) {
    console.warn("sendOrderStatusChangeEmail: reload order failed", e?.message || e);
  }

  const emailed = Array.isArray(order.emailedOrderStatuses) ? order.emailedOrderStatuses.map(String) : [];
  if (emailed.includes(s)) {
    return { ok: true, skipped: true, reason: "duplicate_status" };
  }

  const to = getCustomerEmail(order);
  if (!to) {
    console.warn("sendOrderStatusChangeEmail: no customer email for order", order?.orderNumber);
    return { ok: false, reason: "no_email" };
  }

  const emailType = `orderStatus:${s}`;
  const vars = buildOrderTemplateVars(order, { status: s });
  const keys = templateKeysForStatus(s);

  for (const key of keys) {
    try {
      const r = await renderTemplateKey(key, vars);
      if (r && r.html && String(r.subject || "").trim()) {
        try {
          const out = await sendTransactionalEmailIfEnabled({
            emailType,
            to,
            subject: r.subject,
            html: r.html,
          });
          if (out.skipped && out.reason === "disabled") {
            return { ok: true, skipped: true, reason: "disabled", templateKey: key };
          }
          if (out.sent) {
            await markOrderStatusEmailed(oid, s);
            return { ok: true, templateKey: key };
          }
        } catch (e) {
          console.error("sendOrderStatusChangeEmail send", key, e?.message || e);
          return { ok: false, reason: "send_failed", templateKey: key };
        }
      }
    } catch (e) {
      console.error("sendOrderStatusChangeEmail template", key, e);
    }
  }

  const subject = subjectForStatus(order.orderNumber, s);
  const html = htmlForStatus(order, s);
  try {
    const out = await sendTransactionalEmailIfEnabled({
      emailType,
      to,
      subject,
      html,
    });
    if (out.skipped && out.reason === "disabled") {
      return { ok: true, skipped: true, reason: "disabled", templateKey: "legacy_html" };
    }
    if (out.sent) {
      await markOrderStatusEmailed(oid, s);
      return { ok: true, templateKey: "legacy_html" };
    }
  } catch (e) {
    console.error("sendOrderStatusChangeEmail legacy send", e?.message || e);
    return { ok: false, reason: "send_failed", templateKey: "legacy_html" };
  }

  return { ok: false, reason: "send_not_completed", templateKey: "legacy_html" };
}

module.exports = {
  sendNewOrderEmails,
  sendOrderStatusChangeEmail,
  getAdminOrderNotificationEmail,
  loadOrderForMail,
};
