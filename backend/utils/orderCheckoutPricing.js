/**
 * Server-side checkout line pricing + voucher math aligned with storefront and /user/applyCoupon.
 */

const {
  computeListSellAndDealPrice,
  applyDealIdToPricing,
} = require("./storefrontProductPrice");

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDealDocumentActive(deal, now = new Date()) {
  if (!deal || deal.isDeleted) return false;
  if (deal.isActive === false) return false;
  const t = now.getTime();
  if (deal.startAt && new Date(deal.startAt).getTime() > t) return false;
  if (deal.endAt && new Date(deal.endAt).getTime() < t) return false;
  return true;
}

/** Map admin deal types to applyDealIdToPricing expectations */
function dealForPricingEngine(deal) {
  if (!deal) return null;
  const raw = String(deal.dealType || "");
  let dealType = raw;
  if (raw === "Fixed") dealType = "FLAT";
  if (raw === "Percentage") dealType = "Percentage";
  const discountValue = Number(deal.discountValue);
  return { ...deal, dealType, discountValue };
}

/**
 * Unit sell price for one item (matches cart / storefront: dealId + isDeal/dealPrice/compare/sale).
 * @param {object} product — lean product, optionally with populated dealId object
 */
function resolveOrderLineUnitPrice(product, now = new Date()) {
  const dealDoc =
    product.dealId && typeof product.dealId === "object" && product.dealId._id
      ? product.dealId
      : null;
  const active = dealDoc && isDealDocumentActive(dealDoc, now) ? dealForPricingEngine(dealDoc) : null;

  const { sellPrice } = computeListSellAndDealPrice(product);
  if (!active || String(active.dealType || "") === "BOGO") {
    return +Number(sellPrice || 0).toFixed(2);
  }

  const priced = applyDealIdToPricing(product, active);
  return +Number(priced.finalPrice || sellPrice || 0).toFixed(2);
}

function normalizeVoucherDiscountType(t) {
  const s = String(t || "").toLowerCase().trim();
  if (s === "percent" || s === "percentage") return "percentage";
  if (s === "fixed" || s === "flat") return "fixed";
  return s;
}

function computeVoucherDiscountAmount(coupon, eligibleSubtotal) {
  const sub = Math.max(0, Number(eligibleSubtotal) || 0);
  const dt = normalizeVoucherDiscountType(coupon.discountType);
  let discount = 0;
  if (dt === "percentage") {
    discount = (sub * Number(coupon.discountValue || 0)) / 100;
    if (coupon.maxDiscountAmount != null && coupon.maxDiscountAmount !== "") {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
  } else {
    discount = Number(coupon.discountValue || 0);
  }
  discount = +discount.toFixed(2);
  if (discount > sub) discount = sub;
  if (discount < 0) discount = 0;
  return discount;
}

/** @returns {string|null} error message or null if OK */
function validateVoucherForSubtotal(coupon, eligibleSubtotal, now = new Date()) {
  if (!coupon) return "Invalid coupon code";
  if (!coupon.isActive || coupon.isDeleted) {
    return "This voucher is not active or is no longer available.";
  }
  if (coupon.startAt && new Date(coupon.startAt) > now) return "Coupon not started yet";
  if (coupon.endAt && new Date(coupon.endAt) < now) return "Coupon expired";
  if (
    coupon.totalUsageLimit != null &&
    coupon.totalUsageLimit !== "" &&
    Number(coupon.usedCount || 0) >= Number(coupon.totalUsageLimit)
  ) {
    return "Coupon usage limit reached";
  }
  const minP = coupon.minPurchase;
  if (minP != null && minP !== "" && Number(eligibleSubtotal) < Number(minP)) {
    return `Minimum order should be $${Number(minP).toFixed(2)}`;
  }
  return null;
}

module.exports = {
  escapeRegex,
  isDealDocumentActive,
  resolveOrderLineUnitPrice,
  computeVoucherDiscountAmount,
  validateVoucherForSubtotal,
  normalizeVoucherDiscountType,
};
