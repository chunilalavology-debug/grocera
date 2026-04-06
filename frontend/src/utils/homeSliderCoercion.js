/**
 * Normalize slider `slides` from API (array, object map, or single slide object).
 * Matches backend `coerceHomeSliderSlides` and admin UI handling.
 */
export function coerceSlidesFromApi(slides) {
  if (slides == null) return [];
  if (Array.isArray(slides)) return slides;
  if (typeof slides === "object") {
    const keys = Object.keys(slides).filter((k) => /^\d+$/.test(k));
    if (keys.length > 0) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => slides[k])
        .filter((s) => s != null);
    }
    if ("title" in slides || "imageUrl" in slides || "subtitle" in slides) return [slides];
  }
  return [];
}
