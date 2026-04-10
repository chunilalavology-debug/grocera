/**
 * Clears Redis first-page product list cache so storefront matches admin category/product changes.
 * Keys match controllerUser getProducts: `products:${category}:v1`
 * (TTL is 60×time seconds with time=1 → ~60s if this flush is skipped.)
 * Featured categories are not cached in Redis — they always read MongoDB.
 */
const client = require("../routes/services/redisClient");

function redisDisabled() {
  const v = String(process.env.REDIS_DISABLED || process.env.SKIP_REDIS || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function invalidateProductCatalogCache() {
  const url = process.env.REDIS_URL && String(process.env.REDIS_URL).trim();
  if (redisDisabled() || !url) return;
  try {
    const keys = await client.keys("products:*:v1");
    if (keys && keys.length) await client.del(keys);
  } catch (e) {
    console.warn("invalidateProductCatalogCache:", e.message);
  }
}

module.exports = { invalidateProductCatalogCache };
