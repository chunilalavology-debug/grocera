/**
 * Quick sanity checks for email notification normalization and shell wrapping.
 * Run: node script/emailSystem.smoke.js
 */
/* eslint-disable no-console */
const path = require("path");

process.env.NODE_ENV = process.env.NODE_ENV || "test";

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  normalizeEmailNotificationsFromDoc,
  isNotificationEnabled,
} = require("../utils/emailService");
const { applyEmailShellIfNeeded } = require("../utils/emailShell");
const { buildEmailCatalog } = require("../utils/emailCatalog");
const { listAllTemplateKeys } = require("../utils/emailTemplateDefaults");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

async function main() {
  const n0 = normalizeEmailNotificationsFromDoc(null);
  assert(n0.orderConfirmationUser === true, "defaults on");
  assert(n0.orderStatusEmail.shipped === true, "per-status default from legacy buckets");

  const n1 = normalizeEmailNotificationsFromDoc({
    emailNotifications: {
      orderStatusShipped: false,
      orderStatusEmail: { shipped: true },
    },
  });
  assert(isNotificationEnabled(n1, "orderStatus:shipped") === true, "explicit per-status wins over legacy bucket");

  const n2 = normalizeEmailNotificationsFromDoc({
    emailNotifications: {
      orderStatusShipped: false,
    },
  });
  assert(isNotificationEnabled(n2, "orderStatus:shipped") === false, "legacy bucket off disables shipped");

  const inner = "<p>Hello</p>";
  const wrapped = await applyEmailShellIfNeeded(inner, { preheader: "Hi" });
  assert(wrapped.includes("data-zippyyy-email-shell"), "shell marker present");
  assert(wrapped.includes("Hello"), "body preserved");

  const catalog = buildEmailCatalog();
  assert(catalog.rows.length > 5, "catalog has rows");
  const keys = listAllTemplateKeys();
  assert(keys.includes("order_customer_new"), "template keys include order_customer_new");
  assert(keys.includes("order_status_shipped"), "per-status template key exists");

  console.log("emailSystem.smoke: OK");
}

main().catch((e) => {
  console.error("emailSystem.smoke: FAIL", e.message || e);
  process.exit(1);
});
