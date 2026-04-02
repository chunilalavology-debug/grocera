const Fuse = require("fuse.js");

const FUSE_KEYS = ["name", "description", "category", "tags"];

const DEFAULT_OPTIONS = {
  keys: FUSE_KEYS,
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 1,
  includeScore: true,
  shouldSort: true,
};

const LOOSE_OPTIONS = {
  ...DEFAULT_OPTIONS,
  threshold: 0.52,
};

function escapeRegex(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rank products by fuzzy match to query. If nothing matches, returns the original
 * list so the UI never shows an empty grid for a category that has products.
 */
function rankProductsBySearch(products, query) {
  const q = (query || "").trim();
  if (!q || !products.length) {
    return { items: products, total: products.length, usedFallback: false };
  }

  const fuse = new Fuse(products, DEFAULT_OPTIONS);
  let results = fuse.search(q);
  let items = results.map((r) => r.item);

  if (items.length === 0) {
    const loose = new Fuse(products, LOOSE_OPTIONS);
    results = loose.search(q);
    items = results.map((r) => r.item);
  }

  if (items.length === 0) {
    return {
      items: products.slice(),
      total: products.length,
      usedFallback: true,
    };
  }

  return { items, total: items.length, usedFallback: false };
}

module.exports = {
  escapeRegex,
  rankProductsBySearch,
};
