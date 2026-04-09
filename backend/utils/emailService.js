const { sendMail } = require("./mailService");
const AppSettings = require("../db/models/AppSettings");
const { applyEmailShellIfNeeded } = require("./emailShell");
const { ORDER_STATUSES } = require("./orderStatuses");

const FLAT_DEFAULTS = {
  orderConfirmationUser: true,
  adminNewOrder: true,
  contactFormAdmin: true,
  contactFormCustomerAck: true,
  passwordReset: true,
  messageAdminReply: true,
  orderStatusProcessing: true,
  orderStatusShipped: true,
  orderStatusDelivered: true,
  orderStatusCancelled: true,
};

/** @type {{ at: number, payload: object } | null} */
let notificationCache = null;
const NOTIFICATION_CACHE_MS = Number(process.env.EMAIL_SETTINGS_CACHE_MS || 3000);

function invalidateEmailNotificationCache() {
  notificationCache = null;
}

function orderStatusToLegacyBucket(status) {
  const s = String(status || "").toLowerCase();
  if (["confirmed", "processing", "on_hold", "packed", "pending"].includes(s)) return "processing";
  if (["shipped", "on_the_way"].includes(s)) return "shipped";
  if (["delivered", "completed"].includes(s)) return "delivered";
  if (s === "cancelled") return "cancelled";
  return null;
}

function legacyBucketToggleKey(bucket) {
  const m = {
    processing: "orderStatusProcessing",
    shipped: "orderStatusShipped",
    delivered: "orderStatusDelivered",
    cancelled: "orderStatusCancelled",
  };
  return m[bucket] || null;
}

function mapToPlainObject(maybeMap) {
  if (!maybeMap) return {};
  if (maybeMap instanceof Map) {
    const o = {};
    maybeMap.forEach((v, k) => {
      o[String(k)] = v;
    });
    return o;
  }
  if (typeof maybeMap === "object") return { ...maybeMap };
  return {};
}

/**
 * Normalize AppSettings.emailNotifications for API + sending logic.
 */
function normalizeEmailNotificationsFromDoc(doc) {
  const raw = (doc && doc.emailNotifications) || {};
  const flat = { ...FLAT_DEFAULTS };
  for (const k of Object.keys(FLAT_DEFAULTS)) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) {
      flat[k] = raw[k] !== false;
    }
  }
  const orderStatusEmail = {};
  const statusKeys = ORDER_STATUSES.filter((s) => s !== "session");
  const rawMap = mapToPlainObject(raw.orderStatusEmail);
  for (const s of statusKeys) {
    if (Object.prototype.hasOwnProperty.call(rawMap, s)) {
      orderStatusEmail[s] = rawMap[s] !== false;
    } else {
      const bucket = orderStatusToLegacyBucket(s);
      const legacyKey = bucket ? legacyBucketToggleKey(bucket) : null;
      const legacyOn = legacyKey ? flat[legacyKey] !== false : true;
      orderStatusEmail[s] = legacyOn;
    }
  }
  return { ...flat, orderStatusEmail };
}

async function loadEmailNotifications() {
  const now = Date.now();
  if (notificationCache && now - notificationCache.at < NOTIFICATION_CACHE_MS) {
    return notificationCache.payload;
  }
  let payload = normalizeEmailNotificationsFromDoc(null);
  try {
    const doc = await AppSettings.findOne().select("emailNotifications").lean();
    payload = normalizeEmailNotificationsFromDoc(doc);
  } catch (e) {
    console.error("[emailService] loadEmailNotifications:", e?.message || e);
  }
  notificationCache = { at: now, payload };
  return payload;
}

function isOrderStatusEmailEnabled(notifications, status) {
  const s = String(status || "").toLowerCase();
  if (!s || s === "session") return false;
  const per = notifications.orderStatusEmail && notifications.orderStatusEmail[s];
  if (per === false) return false;
  if (per === true) return true;
  const bucket = orderStatusToLegacyBucket(s);
  const lk = bucket ? legacyBucketToggleKey(bucket) : null;
  if (lk && notifications[lk] === false) return false;
  return true;
}

function isNotificationEnabled(notifications, emailType) {
  if (!emailType) return true;
  if (String(emailType).startsWith("orderStatus:")) {
    const st = String(emailType).slice("orderStatus:".length);
    return isOrderStatusEmailEnabled(notifications, st);
  }
  if (Object.prototype.hasOwnProperty.call(FLAT_DEFAULTS, emailType)) {
    return notifications[emailType] !== false;
  }
  return true;
}

const queue = [];
let draining = false;
const MAX_ATTEMPTS = Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS || 2);
const RETRY_DELAY_MS = Number(process.env.EMAIL_QUEUE_RETRY_MS || 2500);

async function drainQueue() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      const result = await sendMail(job.payload);
      job.resolve({ sent: true, result });
    } catch (err) {
      const attempts = (job.attempts || 0) + 1;
      console.error(
        "[emailService] send failed",
        job.meta?.emailType || "",
        `attempt ${attempts}/${MAX_ATTEMPTS}`,
        err?.message || err,
      );
      if (attempts < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        queue.unshift({ ...job, attempts });
      } else {
        job.reject(err);
      }
    }
  }
  draining = false;
}

function enqueueMail(payload, meta = {}) {
  return new Promise((resolve, reject) => {
    queue.push({ payload, meta, resolve, reject, attempts: 0 });
    setImmediate(() => {
      drainQueue().catch((e) => console.error("[emailService] drainQueue:", e?.message || e));
    });
  });
}

/**
 * Queue outbound mail only if this notification class is enabled in AppSettings.
 * Wraps HTML with the global store shell (logo + footer) unless already wrapped / full HTML.
 */
async function sendTransactionalEmailIfEnabled({ emailType, to, subject, html, text }) {
  if (!to) {
    return { skipped: true, reason: "no_recipient" };
  }
  const notifications = await loadEmailNotifications();
  if (!isNotificationEnabled(notifications, emailType)) {
    console.info("[emailService] skipped (disabled in admin):", emailType);
    return { skipped: true, reason: "disabled" };
  }
  const htmlOut = html ? await applyEmailShellIfNeeded(html, { preheader: subject }) : html;
  await enqueueMail({ to, subject, html: htmlOut, text }, { emailType });
  return { sent: true };
}

/**
 * @deprecated Use orderStatus:status emailType + isNotificationEnabled; kept for imports.
 */
function orderStatusToEmailBucket(status) {
  return orderStatusToLegacyBucket(status);
}

function emailNotificationKeyForBucket(bucket) {
  const m = {
    processing: "orderStatusProcessing",
    shipped: "orderStatusShipped",
    delivered: "orderStatusDelivered",
    cancelled: "orderStatusCancelled",
  };
  return m[bucket] || null;
}

module.exports = {
  sendTransactionalEmailIfEnabled,
  loadEmailNotifications,
  invalidateEmailNotificationCache,
  normalizeEmailNotificationsFromDoc,
  isNotificationEnabled,
  isOrderStatusEmailEnabled,
  orderStatusToEmailBucket,
  emailNotificationKeyForBucket,
  FLAT_DEFAULTS,
};
