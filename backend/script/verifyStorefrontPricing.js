/**
 * Quick sanity checks for storefront pricing helper (no DB).
 * Run: node script/verifyStorefrontPricing.js
 */
const {
  computeListSellAndDealPrice,
  discountMeta,
  normalizeProductForStorefrontList,
} = require("../utils/storefrontProductPrice");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// Compare price discount (800 / 1000 => 20% off)
const cmp = computeListSellAndDealPrice({ price: 800, comparePrice: 1000 });
assert(cmp.listPrice === 1000 && cmp.sellPrice === 800, "compare vs price");
const m1 = discountMeta(cmp.listPrice, cmp.sellPrice);
assert(m1.hasDeal && m1.discountPercentage === 20, "discount %");

// Normal product
const norm = normalizeProductForStorefrontList({
  price: 10,
  comparePrice: 0,
  salePrice: 0,
  name: "x",
  isDeal: false,
});
assert(!norm.hasDeal && norm.price === 10, "no discount");

// Deal price
const deal = normalizeProductForStorefrontList({
  price: 15,
  comparePrice: 20,
  isDeal: true,
  dealPrice: 9.99,
});
assert(deal.price === 9.99 && deal.hasDeal, "deal price sell");

console.log("verifyStorefrontPricing: OK");
