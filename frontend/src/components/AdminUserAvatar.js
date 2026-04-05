import React from 'react';
import { resolveBrandingAssetUrl } from '../utils/brandingAssets';

/**
 * Renders admin avatar: uploaded image or initial letter fallback.
 * @param {object} props
 * @param {object} props.user – auth user (name, email, profileImageUrl)
 * @param {string} props.className – frame class (e.g. admin-sidebar__user-avatar)
 */
export default function AdminUserAvatar({ user, className = '', ...rest }) {
  const raw = user?.profileImageUrl;
  const url = raw
    ? resolveBrandingAssetUrl(String(raw).trim()) || String(raw).trim()
    : '';
  const letter = (user?.name || user?.email || 'A').charAt(0).toUpperCase();

  if (url) {
    return (
      <div
        className={`${className} admin-user-avatar admin-user-avatar--has-image`.trim()}
        {...rest}
      >
        <img key={url} src={url} alt="" decoding="async" />
      </div>
    );
  }

  return (
    <div className={`${className} admin-user-avatar`.trim()} {...rest}>
      {letter}
    </div>
  );
}
