const crypto = require("crypto");

function secretMaterial() {
  const s = String(
    process.env.EASYSHIP_SETTINGS_SECRET || process.env.JWT_SECRET_KEY || ""
  ).trim();
  return s;
}

function canUseCryptoSecret() {
  return Boolean(secretMaterial());
}

function deriveAesKey() {
  const s = secretMaterial();
  if (!s) return null;
  return crypto.createHash("sha256").update(s).digest();
}

function encryptSecret(raw) {
  const plain = String(raw || "").trim();
  const key = deriveAesKey();
  if (!plain || !key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decryptSecret(payload) {
  const key = deriveAesKey();
  if (!key || !payload || !payload.encrypted || !payload.iv || !payload.tag) return "";
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(payload.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(payload.encrypted, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

function hashClientApiKey(key) {
  const pepper = secretMaterial() || "dev-shipping-key-pepper";
  return crypto.createHmac("sha256", pepper).update(String(key || "")).digest("hex");
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function generateClientApiKey() {
  const keyId = crypto.randomBytes(6).toString("hex");
  const secret = randomToken(24);
  return {
    keyId,
    apiKey: `zippy_${keyId}_${secret}`,
  };
}

module.exports = {
  canUseCryptoSecret,
  encryptSecret,
  decryptSecret,
  hashClientApiKey,
  generateClientApiKey,
};
