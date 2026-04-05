/**
 * Smoke tests for production readiness (no secrets in repo).
 *
 * Usage (PowerShell):
 *   $env:MONGO_URI="mongodb+srv://..."; $env:EASYSHIP_API_KEY="prod_..."; node script/smokeProductionChecks.js
 *
 * Test 1: Count products the same way admin list does (isDeleted != true).
 * Test 2: POST Easyship /2024-09/rates and report how many rates have a positive total.
 */

const mongoose = require("mongoose");

const ADMIN_PRODUCT_QUERY = { isDeleted: { $ne: true } };

async function testMongo(uri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 25_000,
    connectTimeoutMS: 20_000,
  });
  const col = mongoose.connection.db.collection("products");
  const total = await col.countDocuments(ADMIN_PRODUCT_QUERY);
  const sample = await col
    .find(ADMIN_PRODUCT_QUERY)
    .sort({ createdAt: -1 })
    .limit(5)
    .project({ name: 1, price: 1, inStock: 1, quantity: 1 })
    .toArray();
  await mongoose.disconnect();
  return {
    database: mongoose.connection?.name,
    adminListableProductCount: total,
    sampleNames: sample.map((s) => s.name || "(no name)"),
  };
}

function easyshipBaseUrl(apiKey) {
  const k = String(apiKey || "");
  if (k.startsWith("sand_")) return "https://public-api-sandbox.easyship.com";
  return "https://public-api.easyship.com";
}

/** Minimal domestic US parcel — mirrors ships-server /api/quotes payload shape. */
function sampleRatesPayload() {
  const kg = Number((2 * 0.45359237).toFixed(3));
  return {
    origin_address: {
      line_1: "123 Main St",
      city: "New York",
      state: "NY",
      postal_code: "10001",
      country_alpha2: "US",
    },
    destination_address: {
      line_1: "456 Oak Ave",
      city: "Los Angeles",
      state: "CA",
      postal_code: "90001",
      country_alpha2: "US",
    },
    parcels: [
      {
        total_actual_weight: kg,
        box: { slug: "custom", length: 12, width: 10, height: 8 },
        items: [
          {
            description: "Smoke test item",
            hs_code: "49019900",
            quantity: 1,
            actual_weight: kg,
            declared_currency: "USD",
            declared_customs_value: 25,
          },
        ],
      },
    ],
  };
}

function extractRatesArray(json) {
  if (!json || typeof json !== "object") return [];
  const r = json.rates ?? json.data?.rates;
  return Array.isArray(r) ? r : [];
}

function rateTotal(r) {
  if (!r) return 0;
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
}

async function testEasyship(apiKey) {
  const base = easyshipBaseUrl(apiKey);
  const url = `${base}/2024-09/rates`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(sampleRatesPayload()),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: json?.message || json?.error || text.slice(0, 400),
    };
  }
  const rates = extractRatesArray(json);
  const priced = rates.filter((r) => rateTotal(r) > 0);
  const first = priced[0];
  const uniqueCouriers = new Set(
    priced.map(
      (r) =>
        String(r.courier_name || r.courier?.name || r.courier_service?.umbrella_name || r.courier_service?.name || "")
          .trim() || "unknown",
    ),
  );
  const sampleRates = priced.slice(0, 8).map((r) => ({
    courier: r.courier_name || r.courier_service?.umbrella_name || r.courier_service?.name || "?",
    service: r.courier_service_name || r.full_description || "",
    total: rateTotal(r),
  }));
  return {
    ok: true,
    status: res.status,
    rateRowsReturned: rates.length,
    ratesWithPositiveTotal: priced.length,
    uniqueCarrierNames: uniqueCouriers.size,
    firstCourier: first
      ? first.courier_name || first.courier?.name || first.courier_service?.name
      : null,
    firstTotal: first ? rateTotal(first) : null,
    firstCurrency:
      first?.shipment_charge_total_currency || first?.currency || "USD",
    sampleRates,
  };
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.DB_STRING;
  const easyKey = process.env.EASYSHIP_API_KEY;

  console.log("--- Test 1: Admin-style product visibility (MongoDB) ---");
  if (!mongoUri) {
    console.log("SKIP: set MONGO_URI or DB_STRING");
  } else {
    try {
      const r1 = await testMongo(mongoUri);
      console.log("PASS:", JSON.stringify(r1, null, 2));
      if (r1.adminListableProductCount === 0) {
        console.log(
          "NOTE: Count is 0 — admin product table will be empty unless products exist with isDeleted != true."
        );
      }
    } catch (e) {
      console.log("FAIL:", e.message || e);
    }
  }

  console.log("\n--- Test 2: Easyship rates (Zippyyy Ships pricing source) ---");
  if (!easyKey) {
    console.log("SKIP: set EASYSHIP_API_KEY");
    return;
  }
  try {
    const r2 = await testEasyship(easyKey);
    console.log(r2.ok ? "PASS:" : "FAIL:", JSON.stringify(r2, null, 2));
    if (r2.ok && r2.ratesWithPositiveTotal === 0) {
      console.log(
        "NOTE: API OK but no positive totals — check Easyship response shape vs normalizeEasyshipRates in zippyyy-ships-server."
      );
    }
  } catch (e) {
    console.log("FAIL:", e.message || e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
