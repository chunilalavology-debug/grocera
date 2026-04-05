/**
 * Discount % for product *cards* — only when the API marked a real deal (`hasDeal`).
 * Avoids showing "0%" or fake ribbons when price is unchanged.
 */
export function getProductCardDiscountPercent(product) {
  if (!product || !product.hasDeal) return 0;
  const fromApi = Number(product.discountPercentage);
  if (Number.isFinite(fromApi) && fromApi > 0) {
    return Math.min(100, Math.round(fromApi));
  }
  const orig = Number(product.originalPrice ?? product.compareAtPrice);
  const final = Number(
    product.finalPrice != null ? product.finalPrice : product.price,
  );
  if (
    !Number.isFinite(orig) ||
    orig <= 0 ||
    !Number.isFinite(final) ||
    final >= orig
  ) {
    return 0;
  }
  return Math.min(100, Math.round((1 - final / orig) * 100));
}
