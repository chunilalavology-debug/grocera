/**
 * Zippyyy Ships + Easyship smoke tests.
 * - Always: Zod QuoteRequestSchema (same shape as QuoteEngine.tsx).
 * - If EASYSHIP_API_KEY in env: real GET item_categories + POST rates (uses network).
 *
 * Run from repo:  cd backend/zippyyy-ships-server && node script/smokeEasyshipFlow.mjs
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createEasyshipClient } from "../src/easyship.js";
import { QuoteRequestSchema } from "../src/schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

for (const p of [path.join(root, ".env"), path.join(root, "..", ".env")]) {
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const sampleQuoteBody = {
  from: {
    name: "Quote",
    phone: "0000000000",
    address_line_1: "N/A",
    city: "N/A",
    state: "NY",
    postal_code: "10001",
    country_alpha2: "US",
  },
  to: {
    name: "Quote",
    phone: "0000000000",
    address_line_1: "N/A",
    city: "N/A",
    state: "CA",
    postal_code: "94105",
    country_alpha2: "US",
  },
  parcel: { length: 13.58, width: 9.84, height: 0.25, weight: 54 },
  currency: "USD",
  declared_customs_value: 50,
  set_as_residential: true,
};

function log(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

const parsed = QuoteRequestSchema.safeParse(sampleQuoteBody);
log({
  step: "zod_quote_request",
  ok: parsed.success,
  error: parsed.success ? null : parsed.error.flatten(),
});

if (!parsed.success) process.exit(1);

const key = String(process.env.EASYSHIP_API_KEY || "").trim();
if (!key) {
  log({
    step: "easyship_live",
    skipped: true,
    reason: "EASYSHIP_API_KEY not set (add to zippyyy-ships-server/.env or backend/.env)",
  });
  process.exit(0);
}

const client = createEasyshipClient({ apiKey: key });

try {
  const cats = await client.listItemCategories();
  const list =
    cats?.item_categories ??
    cats?.data?.item_categories ??
    cats?.itemCategories ??
    cats?.data ??
    cats;
  const n = Array.isArray(list) ? list.length : 0;
  log({ step: "easyship_item_categories", ok: true, count: n });

  const hs =
    (list?.[0]?.hs_code && String(list[0].hs_code)) ||
    (list?.[0]?.hsCode && String(list[0].hsCode)) ||
    "49019900";

  const kg = Math.max(0.01, Number(sampleQuoteBody.parcel.weight) * 0.45359237);
  const payload = {
    origin_address: {
      line_1: sampleQuoteBody.from.address_line_1,
      state: sampleQuoteBody.from.state || undefined,
      city: sampleQuoteBody.from.city,
      postal_code: sampleQuoteBody.from.postal_code,
      country_alpha2: sampleQuoteBody.from.country_alpha2,
    },
    destination_address: {
      line_1: sampleQuoteBody.to.address_line_1,
      state: sampleQuoteBody.to.state || undefined,
      city: sampleQuoteBody.to.city,
      postal_code: sampleQuoteBody.to.postal_code,
      country_alpha2: sampleQuoteBody.to.country_alpha2,
    },
    parcels: [
      {
        total_actual_weight: kg,
        box: {
          slug: "custom",
          length: sampleQuoteBody.parcel.length,
          width: sampleQuoteBody.parcel.width,
          height: sampleQuoteBody.parcel.height,
        },
        items: [
          {
            description: "Shipment item",
            hs_code: hs,
            quantity: 1,
            actual_weight: kg,
            declared_currency: "USD",
            declared_customs_value: 50,
          },
        ],
      },
    ],
    set_as_residential: true,
  };

  const ratesRes = await client.requestRates(payload);
  const rates = ratesRes?.rates ?? ratesRes?.data?.rates ?? [];
  const pickTotal = (r) => {
    const ric = r?.rates_in_origin_currency;
    const candidates = [
      r?.shipment_charge_total,
      r?.total_charge,
      r?.shipment_charge?.total,
      typeof r?.shipment_charge === "number" ? r.shipment_charge : null,
      ric?.shipment_charge_total,
      ric?.total_charge,
      ric?.shipment_charge?.total,
      typeof ric?.shipment_charge === "number" ? ric.shipment_charge : null,
    ];
    for (const v of candidates) {
      if (v == null || v === "") continue;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };
  const withPrice = Array.isArray(rates) ? rates.filter((r) => pickTotal(r) > 0) : [];
  log({
    step: "easyship_rates",
    ok: true,
    rawRateCount: Array.isArray(rates) ? rates.length : 0,
    positiveTotalCount: withPrice.length,
  });
  if (withPrice.length === 0) {
    const warn = {
      step: "easyship_rates",
      warning: "No rates with positive total — check addresses or Easyship account mode (sand vs prod).",
    };
    if (Array.isArray(rates) && rates.length > 0) {
      warn.firstRateKeys = rates[0] && typeof rates[0] === "object" ? Object.keys(rates[0]) : [];
      warn.firstRateSample = rates[0];
    }
    log(warn);
  }
} catch (e) {
  log({
    step: "easyship_live",
    ok: false,
    message: e.message,
    status: e.status ?? null,
  });
  process.exit(1);
}
