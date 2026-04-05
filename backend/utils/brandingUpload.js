const fs = require("fs");
const path = require("path");
const streamifier = require("streamifier");
const { uploadsPublicPath } = require("./brandingPublicUrl");

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
 * @param {"logo"|"favicon"} kind
 * @returns {Promise<string>} secure URL or `/uploads/...`
 */
async function finalizeBrandingUpload(file, kind) {
  if (!file || !file.path) return "";
  const { cloudName, apiKey, apiSecret } = cloudinaryCreds();
  const useCloudinary = cloudName && apiKey && apiSecret;

  if (useCloudinary) {
    try {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      const buf = fs.readFileSync(file.path);
      const folder = `zippyyy-branding/${kind}`;
      const ext = path.extname(file.originalname || "").toLowerCase();
      const isSvg = ext === ".svg";
      const transformation = isSvg
        ? []
        : kind === "favicon"
          ? [
              { width: 256, height: 256, crop: "limit" },
              { quality: "auto:good", fetch_format: "auto" },
            ]
          : [
              { width: 800, height: 320, crop: "limit" },
              { quality: "auto:good", fetch_format: "auto" },
            ];
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
      console.warn("Cloudinary branding upload failed, using local disk:", e.message);
    }
  }

  return uploadsPublicPath(file.filename);
}

module.exports = { finalizeBrandingUpload };
