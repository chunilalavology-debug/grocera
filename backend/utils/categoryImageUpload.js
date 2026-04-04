const fs = require("fs");
const path = require("path");
const streamifier = require("streamifier");

/**
 * Resize/compress a category image for fast storefront loads.
 * Prefers Cloudinary (when configured) for CDN + auto quality; otherwise Sharp → JPEG in /uploads.
 */
async function finalizeCategoryImageUpload(file, req, adminUploadsDest) {
  if (!file || !file.path) return null;

  const destDir = adminUploadsDest();
  /** Support both spellings (typo CLOUDNARY_* in older .env and correct CLOUDINARY_*). */
  const cloudName =
    process.env.CLOUDNARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const cloudKey =
    process.env.CLOUDNARY_API_KEY || process.env.CLOUDINARY_API_KEY;
  const cloudSecret =
    process.env.CLOUDNARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;

  const useCloudinary = cloudName && cloudKey && cloudSecret;

  if (useCloudinary) {
    try {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: cloudName,
        api_key: cloudKey,
        api_secret: cloudSecret,
      });
      let buf;
      try {
        buf = fs.readFileSync(file.path);
      } catch (readErr) {
        throw new Error(
          "Could not read the uploaded file (try again or use a different image)."
        );
      }
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "zippyyy-categories",
            transformation: [
              { width: 720, height: 720, crop: "limit" },
              { quality: "auto:low", fetch_format: "auto" },
            ],
          },
          (error, result) => (error ? reject(error) : resolve(result))
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
      console.warn("Cloudinary category upload failed, using local:", e.message);
    }
  }

  const finalName = `cat-${Date.now()}.jpg`;
  const finalPath = path.join(destDir, finalName);
  try {
    const sharp = require("sharp");
    await sharp(file.path)
      .rotate()
      .resize(720, 720, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true })
      .toFile(finalPath);
    try {
      fs.unlinkSync(file.path);
    } catch (_) {
      /* ignore */
    }
  } catch (e) {
    const ext = path.extname(file.originalname) || ".jpg";
    const fallbackName = `cat-${Date.now()}${ext}`;
    const fallbackPath = path.join(destDir, fallbackName);
    try {
      fs.renameSync(file.path, fallbackPath);
    } catch (_) {
      fs.copyFileSync(file.path, fallbackPath);
      try {
        fs.unlinkSync(file.path);
      } catch (_) {
        /* ignore */
      }
    }
    /** Relative URL so the admin (any origin) resolves images via API host from getApiBaseUrl() */
    return `/uploads/${fallbackName}`;
  }

  return `/uploads/${finalName}`;
}

module.exports = { finalizeCategoryImageUpload };
