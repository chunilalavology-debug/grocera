const fs = require("fs");
const path = require("path");
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

function unlinkBrandingDiskIfAny(file) {
  if (file && file.path) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {
      /* ignore */
    }
  }
}

function contentTypeFromFile(file) {
  const m = String(file?.mimetype || "").trim().toLowerCase();
  if (m && m !== "application/octet-stream") return m;
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".gif": "image/gif",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * Local / non-Vercel: multer wrote the file to disk — return `/uploads/<name>`.
 * @param {import("multer").File} file
 * @returns {Promise<string>}
 */
async function finalizeBrandingUpload(file) {
  if (!file) return "";
  if (file.path) {
    return uploadsPublicPath(path.basename(file.path));
  }
  const buf = readBrandingFileBuffer(file);
  if (!buf || !buf.length) {
    throw clientVisibleError(
      'No file bytes received. Use field name "file" and a supported image type.',
      400,
    );
  }
  throw clientVisibleError(
    "Upload has no disk path (unexpected). Restart the API or try again.",
    500,
  );
}

module.exports = {
  finalizeBrandingUpload,
  readBrandingFileBuffer,
  contentTypeFromFile,
  unlinkBrandingDiskIfAny,
  clientVisibleError,
};
