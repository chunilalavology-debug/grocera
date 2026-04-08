import express from "express";
import cors from "cors";
import { createRequire } from "module";
import { env } from "./env.js";
import { createEasyshipClient } from "./easyship.js";
import { createStripe } from "./stripeClient.js";
import { CheckoutSessionRequestSchema, QuoteRequestSchema } from "./schemas.js";
import { getShipmentBySessionId, setShipmentStatus, upsertDraft } from "./db.js";
import crypto from "crypto";

const require = createRequire(import.meta.url);
const {
  extractEasyshipRatesArray,
  easyshipRowChargeTotalUSD,
} = require("../../utils/easyshipRatesParse.js");

const app = express();

function shipsCheckoutUrl(pathAndQuery) {
  const origin = env.APP_URL.replace(/\/$/, "");
  const seg = env.ZIPPYYY_UI_BASE_PATH.trim();
  const prefix = seg ? `/${seg}` : "";
  const rest = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  return `${origin}${prefix}${rest}`;
}

const easyship = env.EASYSHIP_API_KEY ? createEasyshipClient({ apiKey: env.EASYSHIP_API_KEY }) : null;
const stripe = env.STRIPE_SECRET_KEY ? createStripe({ secretKey: env.STRIPE_SECRET_KEY }) : null;

const corsAllowedOrigins = new Set(
  [
    env.APP_URL,
    ...(env.CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ].filter(Boolean),
);

let cachedItemCategories = null;
let cachedItemCategoriesAt = 0;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsAllowedOrigins.has(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: false,
  }),
);

// JSON for normal routes
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "zippyyy-ships-api",
    health: "/api/health",
    healthAlt: "/health",
    hint: "Use /api/health and /api/quotes from the storefront (SHIPS_API_BASE).",
  });
});

function sendShipsHealth(_req, res) {
  const easyshipMode = getEasyshipMode();
  const easyshipBaseUrl = easyshipMode === "sandbox" ? "https://public-api-sandbox.easyship.com" : "https://public-api.easyship.com";
  res.json({
    ok: true,
    easyshipConfigured: Boolean(env.EASYSHIP_API_KEY),
    easyshipMode,
    easyshipBaseUrl,
    commissionPercent: env.ZIPPYYY_COMMISSION_PERCENT,
    stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
    stripeWebhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
  });
}

app.get("/api/health", sendShipsHealth);
app.get("/health", sendShipsHealth);

app.post("/api/quotes", async (req, res) => {
  if (!easyship) return res.status(501).json({ error: "EASYSHIP_NOT_CONFIGURED" });
  const easyshipMode = getEasyshipMode();
  if (easyshipMode === "sandbox" && !env.EASYSHIP_ALLOW_SANDBOX) {
    return res.status(400).json({
      error: "EASYSHIP_SANDBOX_KEY_NOT_ALLOWED",
      message:
        "Sandbox Easyship key detected. Use a live key (prod_...) or set EASYSHIP_ALLOW_SANDBOX=1 for test environments.",
    });
  }
  const parsed = QuoteRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const pricingMeta = {
      // Final rate already includes backend commission; frontend must not add extra markup.
      markupMultiplier: 1,
      listPriceMultiplier: env.ZIPPYYY_LIST_PRICE_MULTIPLIER,
      commissionPercent: env.ZIPPYYY_COMMISSION_PERCENT,
    };
    const cats = await getItemCategories();
    const chosen = cats?.[0];
    const hsCode = chosen?.hs_code ? String(chosen.hs_code) : "49019900";

    const kg = lbToKg(parsed.data.parcel.weight);
    const declaredVal = parsed.data.declared_customs_value ?? 50;
    const domesticUS =
      String(parsed.data.from.country_alpha2 || "").toUpperCase() === "US" &&
      String(parsed.data.to.country_alpha2 || "").toUpperCase() === "US";
    const applyShippingRules = String(process.env.EASYSHIP_APPLY_SHIPPING_RULES || "").trim() === "1";
    const outCurrency = String(parsed.data.currency || "USD")
      .trim()
      .slice(0, 3)
      .toUpperCase() || "USD";

    const payload = {
      origin_address: {
        line_1: parsed.data.from.address_line_1,
        line_2: parsed.data.from.address_line_2 ?? undefined,
        state: normalizeOptional(parsed.data.from.state),
        city: parsed.data.from.city,
        postal_code: parsed.data.from.postal_code,
        country_alpha2: parsed.data.from.country_alpha2,
      },
      destination_address: {
        line_1: parsed.data.to.address_line_1,
        line_2: parsed.data.to.address_line_2 ?? undefined,
        state: normalizeOptional(parsed.data.to.state),
        city: parsed.data.to.city,
        postal_code: parsed.data.to.postal_code,
        country_alpha2: parsed.data.to.country_alpha2,
      },
      calculate_tax_and_duties: !domesticUS,
      courier_settings: {
        apply_shipping_rules: applyShippingRules,
      },
      shipping_settings: {
        output_currency: outCurrency,
      },
      parcels: [
        {
          total_actual_weight: kg,
          box: {
            slug: "custom",
            length: parsed.data.parcel.length,
            width: parsed.data.parcel.width,
            height: parsed.data.parcel.height,
          },
          items: [
            {
              description: "Shipment item",
              hs_code: hsCode,
              quantity: 1,
              actual_weight: kg,
              declared_currency: parsed.data.currency,
              declared_customs_value: declaredVal,
            },
          ],
        },
      ],
    };

    if (typeof parsed.data.set_as_residential === "boolean") {
      payload.set_as_residential = parsed.data.set_as_residential;
    }

    const ins = parsed.data.insurance;
    if (ins?.is_insured) {
      payload.insurance = {
        is_insured: true,
        insured_amount: ins.insured_amount ?? declaredVal,
        insured_currency: ins.insured_currency ?? String(parsed.data.currency || "USD"),
      };
    }

    const result = await easyship.requestRates(payload);
    const rates = normalizeEasyshipRates(result);
    res.json({
      rates,
      pricing: pricingMeta,
      live: true,
      easyshipMode,
      requestedAt: new Date().toISOString(),
      requestEcho: {
        from: payload.origin_address,
        to: payload.destination_address,
        parcel: payload.parcels?.[0]?.box,
        total_actual_weight: payload.parcels?.[0]?.total_actual_weight,
        set_as_residential: payload.set_as_residential === true,
      },
    });
  } catch (e) {
    const status = e.status ?? null;
    const details = e.details;
    const subscriptionInactive =
      status === 403 &&
      details &&
      (details.code === "subscription_inactive" ||
        String(details.type || "").includes("subscription"));
    const message = subscriptionInactive
      ? "Easyship subscription is not active. Update billing in the Easyship dashboard so the Rates API is enabled; then redeploy is not required."
      : e.message || "Rates request failed";
    res.status(subscriptionInactive ? 403 : 502).json({
      error: subscriptionInactive
        ? "EASYSHIP_SUBSCRIPTION_INACTIVE"
        : "EASYSHIP_RATES_FAILED",
      message,
      upstreamStatus: status,
      upstreamUrl: e.url ?? null,
      details: details ?? null,
    });
  }
});

app.get("/api/easyship/item-categories", async (_req, res) => {
  if (!easyship) return res.status(501).json({ error: "EASYSHIP_NOT_CONFIGURED" });
  try {
    const data = await getItemCategories();
    res.json({ itemCategories: data });
  } catch (e) {
    res.status(502).json({ error: "EASYSHIP_ITEM_CATEGORIES_FAILED", message: e.message, upstreamUrl: e.url ?? null });
  }
});

app.post("/api/checkout/promotion-code", async (req, res) => {
  if (!stripe) return res.status(501).json({ error: "STRIPE_NOT_CONFIGURED" });
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) return res.status(400).json({ error: "EMPTY_CODE" });
  try {
    const pc = await findActivePromotionCodeByCode(stripe, code);
    if (!pc) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "That promotion code is not valid or is no longer active.",
      });
    }
    return res.json({ ok: true, code: pc.code });
  } catch (e) {
    return res.status(502).json({ error: "STRIPE_ERROR", message: e.message });
  }
});

app.post("/api/checkout/session", async (req, res) => {
  if (!stripe) return res.status(501).json({ error: "STRIPE_NOT_CONFIGURED" });
  const parsed = CheckoutSessionRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { draft, selectedRate, promotionCode } = parsed.data;

    // Server-side price confirmation (trust but verify)
    const payableRate = Number(
      selectedRate.final_rate ?? selectedRate.shipment_charge_total ?? selectedRate.original_rate ?? 0,
    );
    const amountCents = Math.round(payableRate * 100) + env.ZIPPYYY_FEE_CENTS;
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: "INVALID_AMOUNT" });
    }

    const currency = selectedRate.shipment_charge_total_currency.toLowerCase();

    let discounts;
    if (promotionCode?.trim()) {
      const pc = await findActivePromotionCodeByCode(stripe, promotionCode.trim());
      if (!pc) {
        return res.status(400).json({
          error: "INVALID_PROMOTION_CODE",
          message: "Promotion code is invalid or no longer active.",
        });
      }
      discounts = [{ promotion_code: pc.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: shipsCheckoutUrl("/checkout/success?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: shipsCheckoutUrl("/checkout/cancel"),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            product_data: {
              name: `Zippyyy Shipping (${selectedRate.courier_name})`,
              description: selectedRate.courier_service_name ?? "Shipping label",
            },
            unit_amount: amountCents,
          },
        },
      ],
      ...(discounts ? { discounts } : {}),
      metadata: {
        easyship_rate_id: selectedRate.easyship_rate_id ?? "",
      },
    });

    upsertDraft({
      checkoutSessionId: session.id,
      draft,
      selectedRate,
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    const msg = e && typeof e.message === "string" ? e.message : "Checkout session failed";
    return res.status(502).json({ error: "STRIPE_CHECKOUT_FAILED", message: msg });
  }
});

// Stripe webhook needs raw body
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return res.status(501).send("Stripe webhook not configured");
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("Missing stripe-signature");

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const sessionId = session.id;
      try {
        await fulfillPaidSession({ sessionId });
      } catch (e) {
        setShipmentStatus(sessionId, "error", { lastError: e.message });
      }
    }

    res.json({ received: true });
  },
);

app.get("/api/shipments/:checkoutSessionId", (req, res) => {
  const shipment = getShipmentBySessionId(req.params.checkoutSessionId);
  if (!shipment) return res.status(404).json({ error: "NOT_FOUND" });

  res.json({
    checkoutSessionId: shipment.checkoutSessionId,
    status: shipment.status,
    trackingNumber: shipment.trackingNumber,
    labelReady: Boolean(shipment.labelUrl || shipment.labelPdfBase64),
    lastError: shipment.lastError,
  });
});

app.get("/api/shipments/:checkoutSessionId/label", async (req, res) => {
  const shipment = getShipmentBySessionId(req.params.checkoutSessionId);
  if (!shipment) return res.status(404).json({ error: "NOT_FOUND" });
  if (!shipment.labelUrl && !shipment.labelPdfBase64) return res.status(409).json({ error: "LABEL_NOT_READY" });

  if (shipment.labelPdfBase64) {
    const buf = Buffer.from(shipment.labelPdfBase64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="zippyyy-label-${shipment.checkoutSessionId}.pdf"`);
    return res.send(buf);
  }

  // Fallback: redirect (safe + simple) to label URL
  return res.redirect(shipment.labelUrl);
});

async function fulfillPaidSession({ sessionId }) {
  const shipment = getShipmentBySessionId(sessionId);
  if (!shipment) throw new Error("Missing shipment draft for session");

  if (shipment.status === "fulfilled") return;
  if (shipment.status === "fulfilling") return;

  setShipmentStatus(sessionId, "fulfilling");

  const { draft, selectedRate } = shipment;

  // 1) Create shipment in Easyship (draft mirrors QuoteRequestSchema)
  const shipmentBody = {
    ship_from: draft.from,
    ship_to: draft.to,
    parcels: [draft.parcel],
  };
  if (typeof draft.set_as_residential === "boolean") {
    shipmentBody.set_as_residential = draft.set_as_residential;
  }
  if (draft.insurance?.is_insured) {
    shipmentBody.insurance = {
      is_insured: true,
      insured_amount: draft.insurance.insured_amount ?? draft.declared_customs_value ?? 50,
      insured_currency: draft.insurance.insured_currency ?? String(draft.currency || "USD"),
    };
  }

  const createPayload = {
    buy_label: true,
    buy_label_synchronous: true,
    courier_service_id:
      selectedRate?.courier_service_id ??
      selectedRate?.raw?.courier_service_id ??
      selectedRate?.raw?.courier_service?.id ??
      undefined,
    shipment: shipmentBody,
  };

  const created = await easyship.createShipment(createPayload);
  const easyshipShipmentId = extractEasyshipShipmentId(created);
  if (!easyshipShipmentId) throw new Error("Easyship shipment id missing in response");

  setShipmentStatus(sessionId, "fulfilling", { easyshipShipmentId });

  // 2) Label should be returned as part of v2024 shipment creation when synchronous buying is enabled.
  const { labelUrl, trackingNumber, labelId, labelPdfBase64 } = extractLabelInfo(created);

  setShipmentStatus(sessionId, "fulfilled", {
    easyshipLabelId: labelId ?? null,
    labelUrl: labelUrl ?? null,
    trackingNumber: trackingNumber ?? null,
    labelPdfBase64: labelPdfBase64 ?? null,
  });
}

async function findActivePromotionCodeByCode(stripe, customerCode) {
  const target = customerCode.trim().toLowerCase();
  if (!target) return null;
  let startingAfter;
  for (let page = 0; page < 15; page++) {
    const list = await stripe.promotionCodes.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const found = list.data.find(
      (pc) => pc.active && typeof pc.code === "string" && pc.code.toLowerCase() === target,
    );
    if (found) return found;
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data[list.data.length - 1].id;
  }
  return null;
}

function normalizeEasyshipRates(result) {
  const commissionMultiplier = 1 + Number(env.ZIPPYYY_COMMISSION_PERCENT || 0) / 100;
  const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
  const rates = extractEasyshipRatesArray(result);
  return rates
    .map((r) => {
      const original = round2(easyshipRowChargeTotalUSD(r));
      const final = round2(original * commissionMultiplier);
      const ric = r?.rates_in_origin_currency;
      const currency =
        (typeof r?.shipment_charge_total_currency === "string" && r.shipment_charge_total_currency) ||
        (typeof r?.currency === "string" && r.currency) ||
        (typeof ric?.currency === "string" && ric.currency) ||
        "USD";
      const cs = r?.courier_service;
      return {
        courier_name:
          r?.courier_name || cs?.umbrella_name || r?.courier?.name || cs?.name || "Courier",
        courier_service_name:
          r?.courier_service_name || r?.service_name || cs?.name || r?.full_description || "",
        courier_service_id: r?.courier_service_id || cs?.id || r?.courier_id || undefined,
        original_rate: original,
        final_rate: final,
        // Backward compatible field used by UI + checkout payload; now reflects commission-inclusive final amount.
        shipment_charge_total: final,
        shipment_charge_total_currency: currency,
        easyship_rate_id: r?.easyship_rate_id || r?.rate_id || r?.id || cs?.id || "",
        min_delivery_time: r?.min_delivery_time ?? null,
        max_delivery_time: r?.max_delivery_time ?? null,
        minimum_pickup_fee:
          typeof r?.minimum_pickup_fee === "number"
            ? r.minimum_pickup_fee
            : typeof ric?.minimum_pickup_fee === "number"
              ? ric.minimum_pickup_fee
              : typeof r?.pickup_fee === "number"
                ? r.pickup_fee
                : null,
        rate_description: r?.full_description || r?.description || "",
        raw: r,
      };
    })
    .filter((r) => r.original_rate > 0 && r.final_rate > 0);
}

function lbToKg(lb) {
  // Easyship rate items use metric weight in docs; convert lb -> kg.
  return Math.max(0.01, Number(lb) * 0.45359237);
}

function getEasyshipMode() {
  const key = String(env.EASYSHIP_API_KEY || "").trim().toLowerCase();
  if (!key) return "none";
  if (key.startsWith("sand_")) return "sandbox";
  if (key.startsWith("prod_")) return "production";
  return "production";
}

function stableHash(obj) {
  return crypto.createHash("sha256").update(stableStringify(obj)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",")}}`;
}

async function getItemCategories() {
  const now = Date.now();
  if (cachedItemCategories && now - cachedItemCategoriesAt < 1000 * 60 * 10) {
    return cachedItemCategories;
  }
  const resp = await easyship.listItemCategories();
  const list = resp?.item_categories ?? resp?.data?.item_categories ?? resp?.itemCategories ?? resp?.data ?? resp;
  cachedItemCategories = Array.isArray(list) ? list : [];
  cachedItemCategoriesAt = now;
  return cachedItemCategories;
}

function normalizeOptional(s) {
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return t.length ? t : undefined;
}

async function getDefaultItemCategoryId() {
  const cats = await getItemCategories();
  // Try to find a generic bucket. Fallback to first available.
  const preferred = cats.find((c) => String(c?.name || "").toLowerCase().includes("other"));
  const chosen = preferred ?? cats[0];
  const id = chosen?.id ?? chosen?.item_category_id ?? chosen?._id ?? null;
  if (!id) throw new Error("No item categories available to build a rate request");
  return id;
}

function extractEasyshipShipmentId(created) {
  return (
    created?.shipment?.easyship_shipment_id ||
    created?.easyship_shipment_id ||
    created?.data?.shipment?.easyship_shipment_id ||
    null
  );
}

function extractLabelInfo(labelResult) {
  const label =
    labelResult?.label ||
    labelResult?.data?.label ||
    labelResult?.shipment?.label ||
    labelResult?.data?.shipment?.label ||
    labelResult?.labels?.[0] ||
    labelResult?.data?.labels?.[0] ||
    null;

  return {
    labelId: label?.easyship_label_id || label?.label_id || null,
    labelUrl: label?.label_url || label?.url || null,
    trackingNumber: label?.tracking_number || label?.tracking?.tracking_number || null,
    labelPdfBase64: label?.label_pdf_base64 || label?.label_base64 || null,
  };
}

if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT}`);
    // eslint-disable-next-line no-console
    console.log(
      `[Easyship] ${env.EASYSHIP_API_KEY ? "API key loaded" : "EASYSHIP_API_KEY missing — /api/quotes returns 501"}`,
    );
  });
}

// Warm item-category cache so first /api/quotes after cold start avoids an extra Easyship round trip.
if (easyship) {
  queueMicrotask(() => {
    getItemCategories().catch(() => {});
  });
}

export default app;
