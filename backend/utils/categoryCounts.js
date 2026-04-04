/**
 * Product.category is a free-form string; match Category.name with robust normalization.
 */

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize for comparison: Unicode NFKC, trim, lowercase, NBSP→space, collapse whitespace.
 * Avoids “same name” mismatches between Category documents and product.category strings.
 */
function normCategoryKey(s) {
  return String(s == null ? "" : s)
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Products that are not soft-deleted (includes docs with no isDeleted field — matches legacy data). */
const PRODUCT_NOT_DELETED = { isDeleted: { $ne: true } };

function categoryStringFromDoc(raw) {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length && typeof raw[0] === "string") return raw[0];
  if (raw != null && typeof raw !== "object") return String(raw);
  return "";
}

/**
 * Two maps from one DB pass:
 * - mapAll: non-deleted products (any stock) — "linked" count for admin
 * - mapInStock: same but inStock === true — matches storefront /user/products filter
 */
async function buildProductCategoryMaps(Products) {
  const docs = await Products.find({
    ...PRODUCT_NOT_DELETED,
    category: { $exists: true, $nin: [null, ""] },
  })
    .select({ category: 1, inStock: 1 })
    .lean();

  const mapAll = {};
  const mapInStock = {};
  for (const doc of docs) {
    const key = normCategoryKey(categoryStringFromDoc(doc.category));
    if (!key) continue;
    mapAll[key] = (mapAll[key] || 0) + 1;
    if (doc.inStock) mapInStock[key] = (mapInStock[key] || 0) + 1;
  }
  return { mapAll, mapInStock };
}

/** @deprecated use buildProductCategoryMaps */
async function normalizedProductCountMap(Products) {
  const { mapAll } = await buildProductCategoryMaps(Products);
  return mapAll;
}

function productCountForCategoryName(map, name) {
  const key = normCategoryKey(name);
  if (!key) return 0;
  return map[key] || 0;
}

function pickProductImage(p) {
  if (!p) return "";
  const s = (v) => {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
    return "";
  };
  return (
    s(p.image) ||
    (Array.isArray(p.images) && p.images.length && s(p.images[0])) ||
    s(p.imageUrl) ||
    s(p.thumbnail) ||
    s(p.photo) ||
    ""
  );
}

/**
 * First product image per normalized category key (newest product wins per key).
 * @param {object} options
 * @param {boolean} [options.preferInStockFirst=false] — storefront: prefer an in-stock product’s image, else any product in that category.
 */
async function firstProductImageByCategoryKey(Products, options = {}) {
  const { preferInStockFirst = false, maxScan = 15000 } = options;
  const baseMatch = {
    ...PRODUCT_NOT_DELETED,
    category: { $exists: true, $nin: [null, ""] },
  };
  const col = Products.collection;
  const prods = await col
    .find(baseMatch, {
      projection: {
        category: 1,
        image: 1,
        images: 1,
        imageUrl: 1,
        thumbnail: 1,
        photo: 1,
        inStock: 1,
      },
    })
    .sort({ _id: -1 })
    .limit(Math.min(Number(maxScan) || 15000, 25000))
    .toArray();

  if (!preferInStockFirst) {
    const byKey = {};
    for (const p of prods) {
      const key = normCategoryKey(categoryStringFromDoc(p.category));
      if (!key || byKey[key]) continue;
      const img = pickProductImage(p);
      if (!img) continue;
      byKey[key] = img;
    }
    return byKey;
  }

  const preferred = {};
  const anyImg = {};
  for (const p of prods) {
    const key = normCategoryKey(categoryStringFromDoc(p.category));
    if (!key) continue;
    const img = pickProductImage(p);
    if (!img) continue;
    if (!anyImg[key]) anyImg[key] = img;
    if (p.inStock && !preferred[key]) preferred[key] = img;
  }
  const byKey = {};
  for (const k of new Set([...Object.keys(anyImg), ...Object.keys(preferred)])) {
    byKey[k] = preferred[k] || anyImg[k];
  }
  return byKey;
}

/**
 * For category display names that must match product.category exactly (storefront / list filter).
 * Newest product with a usable image wins per exact category string.
 */
async function firstProductImageByExactCategoryNames(Products, categoryNames) {
  const names = [...new Set((categoryNames || []).map((n) => String(n || "").trim()).filter(Boolean))];
  if (!names.length) return {};
  /** Raw collection so legacy fields (e.g. images[]) are not stripped by Mongoose strict schema. */
  const col = Products.collection;
  const prods = await col
    .find(
      { ...PRODUCT_NOT_DELETED, category: { $in: names } },
      {
        projection: {
          category: 1,
          image: 1,
          images: 1,
          imageUrl: 1,
          thumbnail: 1,
          photo: 1,
        },
      }
    )
    .sort({ _id: -1 })
    .limit(Math.min(names.length * 40, 2000))
    .toArray();

  const byExact = {};
  for (const p of prods) {
    const cat = String(p.category || "").trim();
    if (!cat || byExact[cat]) continue;
    const img = pickProductImage(p);
    if (img) byExact[cat] = img;
  }
  return byExact;
}

module.exports = {
  escapeRegex,
  normCategoryKey,
  categoryStringFromDoc,
  PRODUCT_NOT_DELETED,
  buildProductCategoryMaps,
  normalizedProductCountMap,
  productCountForCategoryName,
  firstProductImageByCategoryKey,
  firstProductImageByExactCategoryNames,
  pickProductImage,
};
