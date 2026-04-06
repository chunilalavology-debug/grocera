const express = require("express");
const Joi = require("joi");
const crypto = require("crypto");
const { authorize } = require("../middlewares/rbacMiddleware");
const AppSettings = require("../../db/models/AppSettings");
const ShippingApiClient = require("../../db/models/ShippingApiClient");
const redisClient = require("../services/serviceRedis-cli");
const { extractEasyshipRatesArray, easyshipRowChargeTotalUSD } = require("../../utils/easyshipRatesParse");
const {
  canUseCryptoSecret,
  encryptSecret,
  decryptSecret,
  hashClientApiKey,
  generateClientApiKey,
} = require("../../utils/shippingProxySecurity");

const router = express.Router();
const adminAuth = [authorize(["admin"])];
const route = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error("shipping-proxy route error:", error?.message || error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
    return undefined;
  }
};

const EASYSHIP_PROD_BASE = "https://public-api.easyship.com";
const EASYSHIP_SANDBOX_BASE = "https://public-api-sandbox.easyship.com";
const EASYSHIP_API_VERSION = "2024-09";

const partnerRateSchema = Joi.object({
  originAddress: Joi.string().trim().min(5).max(500).required(),
  originZip: Joi.string().trim().min(3).max(16).required(),
  destinationAddress: Joi.string().trim().min(5).max(500).required(),
  destinationZip: Joi.string().trim().min(3).max(16).required(),
  length: Joi.number().min(0.1).max(200).required(),
  width: Joi.number().min(0.1).max(200).required(),
  height: Joi.number().min(0.1).max(200).required(),
  weight: Joi.number().min(0.1).max(150).required(),
  destinationResidential: Joi.boolean().optional(),
  addInsurance: Joi.boolean().optional(),
  insuranceDeclaredValue: Joi.number().min(0).max(500000).optional().allow(0),
}).options({ stripUnknown: true, abortEarly: false });

const settingsSchema = Joi.object({
  enabled: Joi.boolean().required(),
  commissionPercent: Joi.number().min(0).max(200).required(),
  easyshipApiKey: Joi.string().trim().max(300).allow(""),
});

const createClientSchema = Joi.object({
  clientName: Joi.string().trim().min(2).max(160).required(),
  commissionPercent: Joi.number().min(0).max(200).optional().allow(null),
});

const updateClientSchema = Joi.object({
  clientName: Joi.string().trim().min(2).max(160).optional(),
  commissionPercent: Joi.number().min(0).max(200).optional().allow(null),
  status: Joi.string().valid("active", "inactive").optional(),
});

function parseAddress(fullAddress, postalCode) {
  const zip = String(postalCode || "").trim() || "10001";
  const parts = String(fullAddress || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  let line1 = parts[0] || "Address";
  let city = "City";
  let state = "NY";
  if (parts.length >= 3) {
    line1 = parts[0];
    city = parts[1];
    const st = parts[2].replace(/\s+/g, " ");
    const m = st.match(/\b([A-Za-z]{2})\b/);
    state = m ? m[1].toUpperCase() : st.slice(0, 2).toUpperCase() || "NY";
  } else if (parts.length === 2) {
    line1 = parts[0];
    city = parts[1];
  }
  return {
    line_1: line1.slice(0, 200),
    city: city.slice(0, 100),
    state: state.slice(0, 2),
    postal_code: zip.slice(0, 16),
  };
}

const lbToKg = (lb) => Number((Number(lb || 0) * 0.45359237).toFixed(3));

function easyshipBaseUrl(apiKey) {
  if (String(apiKey || "").startsWith("sand_")) return EASYSHIP_SANDBOX_BASE;
  return EASYSHIP_PROD_BASE;
}

function safeIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.ip ||
    ""
  );
}

async function enforceRateLimit(req, client) {
  const maxHits = Number(process.env.SHIPPING_PROXY_RATE_LIMIT_PER_MIN || 60);
  const ip = safeIp(req) || "unknown";
  const key = `rate:shippingProxy:${client.keyId}:${ip}`;
  try {
    const currentRaw = await redisClient.get(key);
    const current = Number(currentRaw || 0);
    if (current >= maxHits) {
      return { allowed: false };
    }
    if (current > 0) await redisClient.incr(key);
    else {
      await redisClient.set(key, 1);
      await redisClient.expire(key, 60);
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

function settingsView(doc) {
  const s = doc?.easyshipShare || {};
  return {
    enabled: s.enabled !== false,
    commissionPercent: Number.isFinite(Number(s.commissionPercent)) ? Number(s.commissionPercent) : 30,
    configured: Boolean(s.apiKeyEnc || process.env.EASYSHIP_API_KEY),
    keySource: s.apiKeyEnc ? "database_encrypted" : (process.env.EASYSHIP_API_KEY ? "env" : "none"),
  };
}

async function resolveEasyshipApiKey() {
  const doc = await AppSettings.findOne().select("+easyshipShare.apiKeyEnc +easyshipShare.apiKeyIv +easyshipShare.apiKeyTag").lean();
  const dbEncrypted = doc?.easyshipShare?.apiKeyEnc;
  if (dbEncrypted) {
    const plain = decryptSecret({
      encrypted: doc.easyshipShare.apiKeyEnc,
      iv: doc.easyshipShare.apiKeyIv,
      tag: doc.easyshipShare.apiKeyTag,
    });
    if (plain) return plain;
  }
  return String(process.env.EASYSHIP_API_KEY || "").trim();
}

async function requestEasyshipRates(body, easyshipApiKey) {
  const origin = parseAddress(body.originAddress, body.originZip);
  const dest = parseAddress(body.destinationAddress, body.destinationZip);
  const declaredVal = Math.max(1, Number(body.insuranceDeclaredValue) || 50);
  const payload = {
    origin_address: {
      line_1: origin.line_1,
      city: origin.city,
      state: origin.state,
      postal_code: origin.postal_code,
      country_alpha2: "US",
    },
    destination_address: {
      line_1: dest.line_1,
      city: dest.city,
      state: dest.state,
      postal_code: dest.postal_code,
      country_alpha2: "US",
    },
    set_as_residential: Boolean(body.destinationResidential),
    calculate_tax_and_duties: false,
    courier_settings: {
      apply_shipping_rules: String(process.env.EASYSHIP_APPLY_SHIPPING_RULES || "").trim() === "1",
    },
    shipping_settings: { output_currency: "USD" },
    parcels: [
      {
        total_actual_weight: lbToKg(body.weight),
        box: {
          slug: "custom",
          length: Number(body.length),
          width: Number(body.width),
          height: Number(body.height),
        },
        items: [
          {
            description: "Shipment item",
            hs_code: "49019900",
            quantity: 1,
            actual_weight: lbToKg(body.weight),
            declared_currency: "USD",
            declared_customs_value: declaredVal,
          },
        ],
      },
    ],
  };
  if (body.addInsurance && declaredVal > 0) {
    payload.insurance = {
      is_insured: true,
      insured_amount: declaredVal,
      insured_currency: "USD",
    };
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60000);
  let response;
  try {
    response = await fetch(`${easyshipBaseUrl(easyshipApiKey)}/${EASYSHIP_API_VERSION}/rates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${easyshipApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
  } finally {
    clearTimeout(t);
  }
  const text = await response.text();
  const parsed = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })()
    : null;
  if (!response.ok) {
    throw new Error(parsed?.error || parsed?.message || `Easyship error ${response.status}`);
  }
  return extractEasyshipRatesArray(parsed);
}

function mapRateForClient(row, commissionPercent) {
  const original = Number(easyshipRowChargeTotalUSD(row) || 0);
  if (!Number.isFinite(original) || original <= 0) return null;
  const finalRate = Number((original * (1 + commissionPercent / 100)).toFixed(2));
  const cs = row?.courier_service || {};
  return {
    carrier: row?.courier_name || cs?.umbrella_name || row?.courier_service_name || "Courier",
    service: row?.courier_service_name || cs?.name || row?.full_description || "",
    delivery_time:
      row?.min_delivery_time != null && row?.max_delivery_time != null
        ? `${row.min_delivery_time}-${row.max_delivery_time} business days`
        : row?.max_delivery_time != null
          ? `up to ${row.max_delivery_time} business days`
          : "N/A",
    original_rate: Number(original.toFixed(2)),
    final_rate: finalRate,
    currency: "USD",
    easyship_rate_id: row?.easyship_rate_id || row?.rate_id || row?.id || "",
  };
}

async function authClientFromHeader(req, res, next) {
  const raw = String(req.headers["x-api-key"] || "").trim();
  if (!raw) return res.status(401).json({ success: false, message: "x-api-key header is required" });
  const m = raw.match(/^zippy_([a-f0-9]{12})_(.+)$/i);
  if (!m) return res.status(401).json({ success: false, message: "Invalid API key format" });
  const keyId = String(m[1] || "").toLowerCase();
  const client = await ShippingApiClient.findOne({ keyId, status: "active" }).select("+keyHash").lean();
  if (!client) return res.status(401).json({ success: false, message: "Invalid API key" });
  const incomingHash = hashClientApiKey(raw);
  const a = Buffer.from(incomingHash, "utf8");
  const b = Buffer.from(String(client.keyHash || ""), "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: "Invalid API key" });
  }
  const gate = await enforceRateLimit(req, client);
  if (!gate.allowed) {
    return res.status(429).json({ success: false, message: "Rate limit exceeded. Try again in one minute." });
  }
  req.shippingApiClient = client;
  return next();
}

router.get("/admin/settings", adminAuth, route(async (req, res) => {
  const doc = await AppSettings.findOne().lean();
  return res.json({ success: true, data: settingsView(doc || {}) });
}));

router.put("/admin/settings", adminAuth, route(async (req, res) => {
  const { error, value } = settingsSchema.validate(req.body || {}, { abortEarly: false });
  if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join(", ") });

  const update = {
    "easyshipShare.enabled": Boolean(value.enabled),
    "easyshipShare.commissionPercent": Number(value.commissionPercent),
  };
  const hasKeyInput = Object.prototype.hasOwnProperty.call(value, "easyshipApiKey");
  if (hasKeyInput) {
    const keyRaw = String(value.easyshipApiKey || "").trim();
    if (!keyRaw) {
      update["easyshipShare.apiKeyEnc"] = "";
      update["easyshipShare.apiKeyIv"] = "";
      update["easyshipShare.apiKeyTag"] = "";
    } else {
      if (!canUseCryptoSecret()) {
        return res.status(500).json({
          success: false,
          message: "Missing EASYSHIP_SETTINGS_SECRET (or JWT_SECRET_KEY) for secure key encryption.",
        });
      }
      const enc = encryptSecret(keyRaw);
      update["easyshipShare.apiKeyEnc"] = enc.encrypted;
      update["easyshipShare.apiKeyIv"] = enc.iv;
      update["easyshipShare.apiKeyTag"] = enc.tag;
    }
  }

  const doc = await AppSettings.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return res.json({ success: true, message: "Easyship proxy settings updated", data: settingsView(doc) });
}));

router.get("/admin/clients", adminAuth, route(async (_req, res) => {
  const rows = await ShippingApiClient.find({}).sort({ createdAt: -1 }).lean();
  const data = rows.map((r) => ({
    _id: r._id,
    clientName: r.clientName,
    keyId: r.keyId,
    status: r.status,
    commissionPercent: r.commissionPercent,
    lastUsedAt: r.lastUsedAt,
    lastUsedIp: r.lastUsedIp,
    requestCount: Number(r.requestCount || 0),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return res.json({ success: true, data });
}));

router.post("/admin/clients", adminAuth, route(async (req, res) => {
  const { error, value } = createClientSchema.validate(req.body || {}, { abortEarly: false });
  if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join(", ") });
  const generated = generateClientApiKey();
  const created = await ShippingApiClient.create({
    clientName: value.clientName,
    keyId: generated.keyId,
    keyHash: hashClientApiKey(generated.apiKey),
    commissionPercent: value.commissionPercent ?? null,
    status: "active",
  });
  return res.status(201).json({
    success: true,
    message: "Client API key created. Store it now; it will not be shown again.",
    data: {
      _id: created._id,
      clientName: created.clientName,
      keyId: created.keyId,
      status: created.status,
      commissionPercent: created.commissionPercent,
      apiKey: generated.apiKey,
    },
  });
}));

router.patch("/admin/clients/:id", adminAuth, route(async (req, res) => {
  const { error, value } = updateClientSchema.validate(req.body || {}, { abortEarly: false });
  if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join(", ") });
  const updated = await ShippingApiClient.findByIdAndUpdate(req.params.id, { $set: value }, { new: true }).lean();
  if (!updated) return res.status(404).json({ success: false, message: "Client not found" });
  return res.json({
    success: true,
    message: "Client updated",
    data: {
      _id: updated._id,
      clientName: updated.clientName,
      keyId: updated.keyId,
      status: updated.status,
      commissionPercent: updated.commissionPercent,
      lastUsedAt: updated.lastUsedAt,
      lastUsedIp: updated.lastUsedIp,
      requestCount: Number(updated.requestCount || 0),
    },
  });
}));

router.post("/admin/clients/:id/rotate", adminAuth, route(async (req, res) => {
  const generated = generateClientApiKey();
  const updated = await ShippingApiClient.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        keyId: generated.keyId,
        keyHash: hashClientApiKey(generated.apiKey),
        status: "active",
      },
    },
    { new: true }
  ).lean();
  if (!updated) return res.status(404).json({ success: false, message: "Client not found" });
  return res.json({
    success: true,
    message: "Client API key rotated. Store it now; it will not be shown again.",
    data: {
      _id: updated._id,
      clientName: updated.clientName,
      keyId: updated.keyId,
      status: updated.status,
      commissionPercent: updated.commissionPercent,
      apiKey: generated.apiKey,
    },
  });
}));

router.post("/get-rates", authClientFromHeader, route(async (req, res) => {
  const { error, value } = partnerRateSchema.validate(req.body || {}, { abortEarly: false });
  if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join(", ") });

  const settingsDoc = await AppSettings.findOne().lean();
  const enabled = settingsDoc?.easyshipShare?.enabled !== false;
  if (!enabled) return res.status(503).json({ success: false, message: "Shipping proxy is currently disabled by admin." });

  const easyshipApiKey = await resolveEasyshipApiKey();
  if (!easyshipApiKey) {
    return res.status(503).json({ success: false, message: "Easyship is not configured on this server." });
  }

  const globalCommission = Number(settingsDoc?.easyshipShare?.commissionPercent ?? 30);
  const clientCommission = req.shippingApiClient?.commissionPercent;
  const commissionPercent = Number.isFinite(Number(clientCommission))
    ? Number(clientCommission)
    : (Number.isFinite(globalCommission) ? globalCommission : 30);

  let list;
  try {
    list = await requestEasyshipRates(value, easyshipApiKey);
  } catch (e) {
    return res.status(502).json({ success: false, message: e.message || "Failed to fetch Easyship rates" });
  }
  const mapped = (Array.isArray(list) ? list : [])
    .map((r) => mapRateForClient(r, commissionPercent))
    .filter(Boolean)
    .sort((a, b) => a.final_rate - b.final_rate);

  await ShippingApiClient.updateOne(
    { _id: req.shippingApiClient._id },
    {
      $set: { lastUsedAt: new Date(), lastUsedIp: safeIp(req) },
      $inc: { requestCount: 1 },
    }
  ).catch(() => {});

  if (!mapped.length) {
    return res.status(404).json({
      success: false,
      message: "No shipping rates available for the provided shipment details.",
      data: { rates: [], commissionPercent },
    });
  }

  return res.json({
    success: true,
    data: {
      commissionPercent,
      rates: mapped,
    },
  });
}));

module.exports = router;
