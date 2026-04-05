import { getApiOrigin, getUploadsOrigin } from '../config/apiBase';

/**
 * Turn stored logo/favicon URLs into absolute URLs the browser can load.
 * Relative `/uploads/...` must hit the API host (split deploy / dev proxy).
 */
export function resolveBrandingAssetUrl(href) {
  const s = String(href || '').trim();
  if (!s) return '';
  if (/^data:/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const p = (u.pathname || '').split('?')[0] || '';
      if (p.startsWith('/uploads/')) {
        return `${getUploadsOrigin()}${p}`;
      }
    } catch {
      /* fall through */
    }
    return s;
  }
  if (s.startsWith('//')) {
    return typeof window !== 'undefined' ? `${window.location.protocol}${s}` : `https:${s}`;
  }
  if (s.startsWith('/')) {
    try {
      const base = s.startsWith('/uploads/') ? getUploadsOrigin() : getApiOrigin();
      return `${base}${s}`;
    } catch {
      return s;
    }
  }
  return s;
}

/** Append cache-buster so replaced files / favicon updates are not stuck in HTTP or browser icon cache. */
export function withAssetCacheBust(url, revision) {
  if (!url || /^data:/i.test(url)) return url;
  const rev = revision != null ? String(revision) : String(Date.now());
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    u.searchParams.set('v', rev);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(rev)}`;
  }
}
