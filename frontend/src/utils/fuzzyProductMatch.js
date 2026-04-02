import Fuse from "fuse.js";

const KEYS = ["name", "description", "category", "tags"];

const baseOptions = {
  keys: KEYS,
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

/**
 * Returns products best matching the search query (typo-tolerant).
 * If nothing scores above the threshold, falls back to a looser pass, then to all products.
 */
export function filterProductsBySearch(products, query) {
  const list = Array.isArray(products) ? products : [];
  const q = (query || "").trim();
  if (!q || !list.length) return list;

  const fuse = new Fuse(list, baseOptions);
  let out = fuse.search(q).map((r) => r.item);
  if (out.length === 0) {
    const loose = new Fuse(list, { ...baseOptions, threshold: 0.52 });
    out = loose.search(q).map((r) => r.item);
  }
  if (out.length === 0) return list.slice();
  return out;
}
