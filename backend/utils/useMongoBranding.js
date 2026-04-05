/**
 * Store logo / favicon / admin avatar in MongoDB instead of local disk.
 * - Vercel and most production hosts have no durable filesystem for uploads.
 * - Local `npm start` (NODE_ENV=development) keeps disk + `/uploads` unless you set NODE_ENV=production.
 *
 * Opt out: BRANDING_DISK_UPLOAD=1|true → always use disk (advanced / self-hosted with persistent disk).
 */
function useMongoForBranding() {
  const disk = String(process.env.BRANDING_DISK_UPLOAD || "").trim().toLowerCase();
  if (disk === "1" || disk === "true" || disk === "yes") return false;
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

module.exports = { useMongoForBranding };
