/**
 * Storefront pricing: Shopify-style (price = sell, comparePrice = MSRP),
 * legacy (price = list, salePrice = promo sell), and optional isDeal + dealPrice.
 */

function computeListSellAndDealPrice(product) {
  const price = Number(product.price ?? 0);
  const compare = Number(product.comparePrice ?? 0);
  const legacySale = Number(product.salePrice ?? 0);
  const csvDealPrice =
    product.isDeal && Number(product.dealPrice) > 0 ? Number(product.dealPrice) : 0;

  let sell = price;
  let list = price;

  if (csvDealPrice > 0) {
    sell = csvDealPrice;
    if (compare > 0 && compare > sell) list = compare;
    else if (price > sell) list = price;
    else list = Math.max(compare, price, sell);
  } else if (compare > 0 && compare > price) {
    list = compare;
    sell = price;
  } else if (legacySale > 0 && legacySale < price) {
    list = price;
    sell = legacySale;
  }

  return { listPrice: list, sellPrice: sell };
}

function discountMeta(listPrice, sellPrice) {
  const hasDeal = listPrice > sellPrice && listPrice > 0;
  const discountPercentage =
    hasDeal && listPrice > 0
      ? Math.round(((listPrice - sellPrice) / listPrice) * 100)
      : 0;
  return {
    finalPrice: sellPrice,
    originalPrice: hasDeal ? listPrice : null,
    hasDeal,
    discountPercentage,
  };
}

function normalizeBadge(product) {
  const raw = product.badge != null ? String(product.badge).trim().toLowerCase() : '';
  return ['hot', 'sale', 'new', 'trending'].includes(raw) ? raw : '';
}

/** List / card API: lean product doc (no populated dealId). */
function normalizeProductForStorefrontList(product) {
  const { listPrice, sellPrice } = computeListSellAndDealPrice(product);
  const meta = discountMeta(listPrice, sellPrice);
  return {
    ...product,
    price: meta.finalPrice,
    finalPrice: meta.finalPrice,
    originalPrice: meta.originalPrice,
    compareAtPrice: meta.originalPrice,
    hasDeal: meta.hasDeal,
    discountPercentage: meta.discountPercentage,
    badge: normalizeBadge(product),
    isDeal: Boolean(product.isDeal),
  };
}

/** Detail: apply active dealId discount on top of list anchor. */
function applyDealIdToPricing(product, deal) {
  const { listPrice, sellPrice } = computeListSellAndDealPrice(product);
  const listAnchor = listPrice;
  let finalPrice = sellPrice;

  if (deal && deal.isActive !== false) {
    let candidate = Number.POSITIVE_INFINITY;
    if (deal.dealType === 'FLAT') {
      candidate = Math.max(0, listAnchor - (Number(deal.discountValue) || 0));
    } else if (deal.dealType === 'PERCENT' || deal.dealType === 'Percentage') {
      candidate = Math.max(0, listAnchor * (1 - (Number(deal.discountValue) || 0) / 100));
    }
    if (Number.isFinite(candidate)) {
      finalPrice = Math.min(finalPrice, candidate);
    }
  }

  const hasStrike = listAnchor > finalPrice && listAnchor > 0;
  const originalPrice = hasStrike ? listAnchor : null;
  const discountAmount = originalPrice != null ? Math.max(0, originalPrice - finalPrice) : 0;
  const discountPercentage =
    originalPrice != null && originalPrice > 0
      ? Math.round((discountAmount / originalPrice) * 100)
      : 0;

  return {
    originalPrice,
    finalPrice,
    discountAmount,
    hasDeal: discountAmount > 0,
    discountPercentage,
    compareAtPrice: originalPrice,
  };
}

module.exports = {
  computeListSellAndDealPrice,
  discountMeta,
  normalizeProductForStorefrontList,
  applyDealIdToPricing,
  normalizeBadge,
};
