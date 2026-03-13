/**
 * Main categories and subcategories for the grocery store.
 * Subcategory "value" matches API category names for filtering.
 * Used by: Navbar browse card, Products page two-row filter, Home Shop by category, Footer.
 */

export const MAIN_CATEGORIES = [
  { id: 'all', name: 'All', slug: 'all' },
  { id: 'indian', name: 'Indian', slug: 'indian' },
  { id: 'american', name: 'American', slug: 'american' },
  { id: 'chinese', name: 'Chinese', slug: 'chinese' },
  { id: 'turkish', name: 'Turkish', slug: 'turkish' },
];

/** Subcategories per main (value = API category name for /user/products?category=). count = item count for Featured Categories. */
export const SUBCATEGORIES_BY_MAIN = {
  indian: [
    { name: 'Daily Essentials', value: 'Daily Essentials', count: 124 },
    { name: 'Spices & Masalas', value: 'Spices & Masalas', count: 89 },
    { name: 'Fresh Vegetables', value: 'Fresh Vegetables', count: 156 },
    { name: 'Fresh Fruits', value: 'Fresh Fruits', count: 98 },
    { name: 'Rice & Grains', value: 'Rice & Grains', count: 67 },
    { name: 'Lentils & Pulses', value: 'Lentils & Pulses', count: 72 },
    { name: 'Snacks & Sweets', value: 'Snacks & Sweets', count: 134 },
    { name: 'Frozen Foods', value: 'Frozen Foods', count: 45 },
    { name: 'Pooja Items', value: 'Pooja Items', count: 28 },
    { name: 'God Idols', value: 'God Idols', count: 19 },
  ],
  american: [
    { name: 'American Breakfast', value: 'American Breakfast Fusions', count: 42 },
    { name: 'Breakfast & Cereals', value: 'Breakfast & Cereals', count: 78 },
    { name: 'Sauces & Canned', value: 'Sauces & Canned', count: 56 },
    { name: 'Sauces & Condiments', value: 'Sauces & Condiments', count: 63 },
    { name: 'Beverages', value: 'Beverages', count: 91 },
    { name: 'Breads & Staples', value: 'Breads & Staples', count: 34 },
  ],
  chinese: [
    { name: 'Chinese Noodles', value: 'Chinese Noodles', count: 38 },
    { name: 'Snacks & Teas', value: 'Snacks & Teas', count: 52 },
    { name: 'Rice & Grains', value: 'Rice & Grains', count: 41 },
    { name: 'Frozen Foods', value: 'Frozen Foods', count: 29 },
  ],
  turkish: [
    { name: 'Turkish Desserts', value: 'Turkish Desserts', count: 24 },
    { name: 'Coffee & Drinks', value: 'Coffee & Drinks', count: 47 },
    { name: 'Sauces & Condiments', value: 'Sauces & Condiments', count: 31 },
    { name: 'Snacks & Sweets', value: 'Snacks & Sweets', count: 36 },
  ],
};

/** All subcategory values (for flat list when main is "all") */
export const ALL_SUBCATEGORY_VALUES = [
  ...SUBCATEGORIES_BY_MAIN.indian,
  ...SUBCATEGORIES_BY_MAIN.american,
  ...SUBCATEGORIES_BY_MAIN.chinese,
  ...SUBCATEGORIES_BY_MAIN.turkish,
]
  .map((s) => s.value)
  .filter((v, i, a) => a.indexOf(v) === i);

/** Get subcategories for a main category id */
export function getSubcategories(mainId) {
  if (!mainId || mainId === 'all') return [];
  return SUBCATEGORIES_BY_MAIN[mainId] || [];
}

/** Find which main a category value belongs to */
export function getMainForCategory(categoryValue) {
  if (!categoryValue) return 'all';
  for (const main of MAIN_CATEGORIES) {
    if (main.id === 'all') continue;
    const subs = SUBCATEGORIES_BY_MAIN[main.id] || [];
    if (subs.some((s) => s.value === categoryValue)) return main.id;
  }
  return 'all';
}
