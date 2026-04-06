import { getApiBaseUrl, getApiOrigin, getUploadsOrigin } from '../config/apiBase';

function joinOriginPath(base, pathWithLeadingSlash) {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(pathWithLeadingSlash || '');
  if (!p.startsWith('/')) return `${b}/${p}`;
  return `${b}${p}`;
}

/**
 * Turn stored logo/favicon URLs into absolute URLs the browser can load.
 * - `/uploads/...` → uploads host (often API origin without `/api`; static is mounted at `/uploads`).
 * - `/user/...`, `/admin/...` → **API base** including `/api` (Express mounts routers at `/api/user`, `/api/admin`).
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
        return joinOriginPath(getUploadsOrigin(), p);
      }
      if (p.startsWith('/user/') || p.startsWith('/admin/')) {
        return joinOriginPath(getApiBaseUrl(), p);
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
      if (s.startsWith('/uploads/')) {
        return joinOriginPath(getUploadsOrigin(), s);
      }
      if (s.startsWith('/user/') || s.startsWith('/admin/')) {
        return joinOriginPath(getApiBaseUrl(), s);
      }
      return joinOriginPath(getApiOrigin(), s);
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
    const u = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://example.invalid');
    u.searchParams.set('v', rev);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(rev)}`;
  }
}
