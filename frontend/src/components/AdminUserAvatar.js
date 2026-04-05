import React, { useEffect, useState } from 'react';
import { resolveBrandingAssetUrl, withAssetCacheBust } from '../utils/brandingAssets';

/**
 * Avatar bytes on Vercel are served from GET /api/admin/profile/avatar-image (Bearer required).
 * Plain &lt;img src&gt; cannot send Authorization, so we fetch with the token and use a blob URL.
 */
function profileImageUrlNeedsAuthFetch(resolvedUrl) {
  const s = String(resolvedUrl || '').trim();
  if (!s || s.startsWith('blob:')) return false;
  try {
    const u = new URL(s, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    return u.pathname.endsWith('/admin/profile/avatar-image');
  } catch {
    return false;
  }
}

/**
 * Renders admin avatar: uploaded image or initial letter fallback.
 * @param {object} props
 * @param {object} props.user – auth user (name, email, profileImageUrl)
 * @param {string} props.className – frame class (e.g. admin-sidebar__user-avatar)
 */
export default function AdminUserAvatar({ user, className = '', ...rest }) {
  const raw = user?.profileImageUrl != null ? String(user.profileImageUrl).trim() : '';
  const baseUrl = raw ? resolveBrandingAssetUrl(raw) || raw : '';
  const needsAuthFetch = profileImageUrlNeedsAuthFetch(baseUrl);
  const [blobUrl, setBlobUrl] = useState(null);
  const letter = (user?.name || user?.email || 'A').charAt(0).toUpperCase();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!needsAuthFetch || !baseUrl) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return undefined;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(baseUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });
        if (!res.ok) throw new Error('avatar fetch failed');
        const blob = await res.blob();
        const u = URL.createObjectURL(blob);
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return u;
        });
      } catch {
        if (!ac.signal.aborted) {
          setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      }
    })();
    return () => {
      ac.abort();
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [needsAuthFetch, baseUrl]);

  const displayUrl = needsAuthFetch ? blobUrl : baseUrl;
  const url =
    displayUrl && !String(displayUrl).startsWith('blob:')
      ? withAssetCacheBust(displayUrl, raw)
      : displayUrl;

  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  if (url && !imgFailed) {
    return (
      <div
        className={`${className} admin-user-avatar admin-user-avatar--has-image`.trim()}
        {...rest}
      >
        <img
          key={url}
          src={url}
          alt=""
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${className} admin-user-avatar`.trim()} {...rest}>
      {letter}
    </div>
  );
}
