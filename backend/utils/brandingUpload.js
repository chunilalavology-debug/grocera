const fs = require("fs");
const path = require("path");
const streamifier = require("streamifier");
const { uploadsPublicPath } = require("./brandingPublicUrl");

function clientVisibleError(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}

function cloudinaryCreds() {
  const cloudName =
    process.env.CLOUDNARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey =
    process.env.CLOUDNARY_API_KEY || process.env.CLOUDINARY_API_KEY;
  const apiSecret =
    process.env.CLOUDNARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;
  return { cloudName, apiKey, apiSecret };
}

/**
 * After multer writes to disk: prefer Cloudinary when configured (Vercel /tmp is ephemeral).
 * Otherwise keep `/uploads/<file>` relative to the API host.
 *
 * @param {import("multer").File} file
 * @param {"logo"|"favicon"|"admin-avatar"} kind
 * @returns {Promise<string>} secure URL or `/uploads/...`
 */
async function finalizeBrandingUpload(file, kind) {
  if (!file || !file.path) return "";
  const isVercel = Boolean(process.env.VERCEL);
  const { cloudName, apiKey, apiSecret } = cloudinaryCreds();
  const useCloudinary = Boolean(cloudName && apiKey && apiSecret);

  if (useCloudinary) {
    try {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      const buf = fs.readFileSync(file.path);
      const folder =
        kind === "admin-avatar"
          ? "zippyyy-branding/admin-avatar"
          : `zippyyy-branding/${kind}`;
      const ext = path.extname(file.originalname || "").toLowerCase();
      const isSvg = ext === ".svg";
      let transformation;
      if (isSvg) {
        transformation = [];
      } else if (kind === "favicon") {
        transformation = [
          { width: 256, height: 256, crop: "limit" },
          { quality: "auto:good", fetch_format: "auto" },
        ];
      } else if (kind === "admin-avatar") {
        transformation = [
          { width: 512, height: 512, crop: "limit" },
          { quality: "auto:good", fetch_format: "auto" },
        ];
      } else {
        transformation = [
          { width: 800, height: 320, crop: "limit" },
          { quality: "auto:good", fetch_format: "auto" },
        ];
      }
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "image", transformation },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
        streamifier.createReadStream(buf).pipe(stream);
      });
      try {
        fs.unlinkSync(file.path);
      } catch (_) {
        /* ignore */
      }
      return uploadResult.secure_url;
    } catch (e) {
      console.error("Cloudinary branding upload failed:", e.message);
      if (isVercel) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {
          /* ignore */
        }
        throw clientVisibleError(
          `Cloudinary upload failed (${e.message || "unknown error"}). Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on Vercel, then redeploy.`,
        );
      }
      console.warn("Falling back to local /uploads (dev only).");
    }
  } else if (isVercel) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {
      /* ignore */
    }
    throw clientVisibleError(
      "Vercel has no persistent disk: logo, favicon, and profile photos must be stored on Cloudinary. In Vercel → Project → Settings → Environment Variables, add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (same as category images). Redeploy, then upload again.",
    );
  }

  return uploadsPublicPath(file.filename);
}

module.exports = { finalizeBrandingUpload };
