import Fuse from "fuse.js";

const KEYS = ["name", "description", "category", "tags"];

const baseOptions = {
  keys: KEYS,
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

/**
 * Client-side fuzzy filter for local lists only (e.g. admin tables).
 * For storefront search, use API `search` — do not use the old "return all on no match" behavior.
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
  if (out.length === 0) return [];
  return out;
}
