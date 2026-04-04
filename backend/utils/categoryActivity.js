/**
 * Admin payloads sometimes send isActive as the string "false".
 * `Boolean("false")` is true in JS — never use that for persistence.
 */
function coerceCategoryIsActiveFromRequest(value, defaultWhenMissing = true) {
  if (value === undefined) return defaultWhenMissing;
  if (value === null) return false;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no" || s === "") return false;
  }
  return false;
}

function truthyMongoFlag(v) {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

/**
 * Storefront: hide only when admin explicitly turned the category off.
 * Missing `isActive` in Mongo = legacy / schema default → treat as active (same as Mongoose default).
 * Treats string/number "deleted" / "disabled" flags from legacy imports.
 */
function isCategoryActiveInDatabase(doc) {
  if (!doc) return false;
  if (truthyMongoFlag(doc.isDeleted)) return false;
  if (truthyMongoFlag(doc.isDisable)) return false;
  const a = doc.isActive;
  if (a === false || a === 0) return false;
  if (typeof a === "string") {
    const s = a.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "no" || s === "") return false;
  }
  return true;
}

module.exports = {
  coerceCategoryIsActiveFromRequest,
  isCategoryActiveInDatabase,
};
