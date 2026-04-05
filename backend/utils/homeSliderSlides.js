/**
 * Normalize `slides` from MongoDB or legacy JSON into a plain array.
 * If slides were stored as an object with numeric keys, order by key index.
 */
function coerceHomeSliderSlides(slides) {
  if (slides == null) return [];
  if (Array.isArray(slides)) return slides;
  if (typeof slides !== "object") return [];
  const keys = Object.keys(slides);
  const numeric = keys.filter((k) => /^\d+$/.test(k));
  if (numeric.length > 0) {
    return numeric
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => slides[k])
      .filter((s) => s != null);
  }
  if ("title" in slides || "imageUrl" in slides || "subtitle" in slides) {
    return [slides];
  }
  return [];
}

module.exports = { coerceHomeSliderSlides };
