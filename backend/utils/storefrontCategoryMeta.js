/**
 * Mirrors frontend src/config/categories.js — used to infer parent "main" and filter admin list
 * when Category.main is unset in MongoDB.
 */
const { normCategoryKey } = require("./categoryCounts");

const SUBCATEGORIES_BY_MAIN = {
  indian: [
    { name: "Daily Essentials", value: "Daily Essentials", count: 124 },
    { name: "Spices & Masalas", value: "Spices & Masalas", count: 89 },
    { name: "Fresh Vegetables", value: "Fresh Vegetables", count: 156 },
    { name: "Fresh Fruits", value: "Fresh Fruits", count: 98 },
    { name: "Rice & Grains", value: "Rice & Grains", count: 67 },
    { name: "Lentils & Pulses", value: "Lentils & Pulses", count: 72 },
    { name: "Snacks & Sweets", value: "Snacks & Sweets", count: 134 },
    { name: "Frozen Foods", value: "Frozen Foods", count: 45 },
    { name: "Pooja Items", value: "Pooja Items", count: 28 },
    { name: "God Idols", value: "God Idols", count: 19 },
  ],
  american: [
    { name: "American Breakfast", value: "American Breakfast Fusions", count: 42 },
    { name: "Breakfast & Cereals", value: "Breakfast & Cereals", count: 78 },
    { name: "Sauces & Canned", value: "Sauces & Canned", count: 56 },
    { name: "Sauces & Condiments", value: "Sauces & Condiments", count: 63 },
    { name: "Beverages", value: "Beverages", count: 91 },
    { name: "Breads & Staples", value: "Breads & Staples", count: 34 },
  ],
  chinese: [
    { name: "Chinese Noodles", value: "Chinese Noodles", count: 38 },
    { name: "Snacks & Teas", value: "Snacks & Teas", count: 52 },
    { name: "Rice & Grains", value: "Rice & Grains", count: 41 },
    { name: "Frozen Foods", value: "Frozen Foods", count: 29 },
  ],
  turkish: [
    { name: "Turkish Desserts", value: "Turkish Desserts", count: 24 },
    { name: "Coffee & Drinks", value: "Coffee & Drinks", count: 47 },
    { name: "Sauces & Condiments", value: "Sauces & Condiments", count: 31 },
    { name: "Snacks & Sweets", value: "Snacks & Sweets", count: 36 },
  ],
};

const MAINS = ["indian", "american", "chinese", "turkish"];

function getValuesForMain(mainId) {
  if (!mainId || mainId === "all") return [];
  const subs = SUBCATEGORIES_BY_MAIN[mainId] || [];
  return subs.map((s) => s.value);
}

/**
 * Infer storefront parent tab from category name (matches sub.value or sub.name, normalized).
 */
function inferMainForCategoryName(name) {
  const nk = normCategoryKey(name);
  if (!nk) return null;
  for (const mainId of MAINS) {
    const subs = SUBCATEGORIES_BY_MAIN[mainId] || [];
    for (const s of subs) {
      if (normCategoryKey(s.value) === nk || normCategoryKey(s.name) === nk) {
        return mainId;
      }
    }
  }
  return null;
}

module.exports = {
  SUBCATEGORIES_BY_MAIN,
  getValuesForMain,
  inferMainForCategoryName,
  STOREFRONT_MAINS: MAINS,
};
