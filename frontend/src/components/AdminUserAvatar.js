import React, { useEffect, useState } from 'react';
import { resolveBrandingAssetUrl, withAssetCacheBust } from '../utils/brandingAssets';

/**
 * Renders admin avatar: uploaded image or initial letter fallback.
 * @param {object} props
 * @param {object} props.user – auth user (name, email, profileImageUrl)
 * @param {string} props.className – frame class (e.g. admin-sidebar__user-avatar)
 */
export default function AdminUserAvatar({ user, className = '', ...rest }) {
  const raw = user?.profileImageUrl != null ? String(user.profileImageUrl).trim() : '';
  const baseUrl = raw ? resolveBrandingAssetUrl(raw) || raw : '';
  const url = baseUrl ? withAssetCacheBust(baseUrl, raw) : '';
  const letter = (user?.name || user?.email || 'A').charAt(0).toUpperCase();
  const [imgFailed, setImgFailed] = useState(false);

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
