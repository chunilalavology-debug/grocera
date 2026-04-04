/**
 * Shared parser for GET /user/featured-categories (axios interceptor returns body, not AxiosResponse).
 * Returns `null` if the payload looks like HTML (wrong API base URL).
 */
export function featuredCategoriesListFromResponse(res) {
  if (res == null) return [];
  if (Array.isArray(res)) return res;
  if (typeof res === 'string') {
    if (/<!DOCTYPE|<html[\s>]/i.test(res)) return null;
    return [];
  }
  if (typeof res !== 'object') return [];
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.categories)) return res.categories;
  const inner = res.data;
  if (inner && typeof inner === 'object') {
    if (Array.isArray(inner.data)) return inner.data;
    if (Array.isArray(inner.categories)) return inner.categories;
  }
  return [];
}

export function featuredRowsToSubOptions(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && r.name)
    .filter((r) => {
      if (r.isActive === false || r.isActive === 0) return false;
      if (typeof r.isActive === 'string' && ['false', '0', 'no'].includes(String(r.isActive).trim().toLowerCase())) {
        return false;
      }
      return true;
    })
    .map((r) => ({
      name: r.name,
      value: r.value || r.name,
    }));
}
