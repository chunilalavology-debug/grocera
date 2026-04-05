const BADGE_LABELS = {
  hot: 'Hot',
  sale: 'Sale',
  new: 'New',
  trending: 'Trending',
};

/**
 * Storefront badge from API `badge` field (hot | sale | new | trending).
 */
export function productCardBadgeFromApi(product) {
  const b = String(product?.badge || '').trim().toLowerCase();
  if (!BADGE_LABELS[b]) return null;
  return { key: b, label: BADGE_LABELS[b] };
}
