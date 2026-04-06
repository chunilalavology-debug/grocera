/**
 * Stored in DB as `websiteLogoUrl` / `websiteFaviconUrl` / `profileImageUrl` when bytes live in MongoDB.
 * Clients resolve with API origin (same as `/user/site-settings`).
 */
const BRANDING_LOGO_API_PATH = "/user/site-branding/logo";
const BRANDING_FAVICON_API_PATH = "/user/site-branding/favicon";
const BRANDING_HERO_BANNER_API_PATH = "/user/site-branding/hero-banner";
const ADMIN_PROFILE_AVATAR_API_PATH = "/admin/profile/avatar-image";

module.exports = {
  BRANDING_LOGO_API_PATH,
  BRANDING_FAVICON_API_PATH,
  BRANDING_HERO_BANNER_API_PATH,
  ADMIN_PROFILE_AVATAR_API_PATH,
};
