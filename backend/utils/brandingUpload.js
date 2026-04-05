const fs = require("fs");
const path = require("path");
const streamifier = require("streamifier");
const { uploadsPublicPath } = require("./brandingPublicUrl");

function clientVisibleError(message, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

function readBrandingFileBuffer(file) {
  if (!file) return null;
  if (file.buffer && Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    return file.buffer;
  }
  if (file.path) {
    try {
      return fs.readFileSync(file.path);
    } catch (readErr) {
      throw clientVisibleError(
        `Could not read uploaded file (${readErr.message || "disk read failed"}). Try a smaller image or another format.`,
        400,
      );
    }
  }
  return null;
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
  const isVercel = Boolean(process.env.VERCEL);
  const buf = readBrandingFileBuffer(file);
  if (!buf || !buf.length) {
    if (!file) return "";
    if (isVercel) {
      throw clientVisibleError(
        'No file bytes received. Use field name "file", JPG/PNG/WebP/SVG under 5MB (logo), and try again.',
        400,
      );
    }
    return "";
  }

  const { cloudName, apiKey, apiSecret } = cloudinaryCreds();
  const useCloudinary = Boolean(cloudName && apiKey && apiSecret);

  const unlinkDiskIfAny = () => {
    if (file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {
        /* ignore */
      }
    }
  };

  if (useCloudinary) {
    try {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
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
      unlinkDiskIfAny();
      return uploadResult.secure_url;
    } catch (e) {
      console.error("Cloudinary branding upload failed:", e.message);
      if (isVercel) {
        unlinkDiskIfAny();
        throw clientVisibleError(
          `Cloudinary upload failed (${e.message || "unknown error"}). On the API Vercel project set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (correct spelling; redeploy after saving).`,
          502,
        );
      }
      console.warn("Falling back to local /uploads (dev only).");
    }
  } else if (isVercel) {
    unlinkDiskIfAny();
    throw clientVisibleError(
      "Logo uploads on Vercel require Cloudinary (no persistent disk). On project grocera-k45u (API): Settings → Environment Variables → add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Redeploy, then upload again.",
      503,
    );
  }

  const fname =
    file.filename ||
    `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || "") || ".jpg"}`;
  return uploadsPublicPath(fname);
}

module.exports = { finalizeBrandingUpload };
