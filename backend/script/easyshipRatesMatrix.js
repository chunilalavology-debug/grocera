/**
 * Matrix test: POST Easyship /2024-09/rates for several US lanes and parcel sizes.
 *
 *   cd grocera/backend
 *   EASYSHIP_API_KEY=prod_... node script/easyshipRatesMatrix.js
 *
 * Expect multiple priced rows and usually 2+ umbrella carriers for a normal box.
 */

const {
  extractEasyshipRatesArray,
  easyshipRowChargeTotalUSD,
} = require("../utils/easyshipRatesParse");

function easyshipBaseUrl(apiKey) {
  const k = String(apiKey || "");
  if (k.startsWith("sand_")) return "https://public-api-sandbox.easyship.com";
  return "https://public-api.easyship.com";
}

function parcelKg(lb) {
  return Number((Number(lb) * 0.45359237).toFixed(3));
}

function buildBody({ oz, dz, destZip, destCity, destState, weightLb, L, W, H }) {
  const kg = parcelKg(weightLb);
  return {
    origin_address: {
      line_1: "123 Main St",
      city: "New York",
      state: "NY",
      postal_code: oz,
      country_alpha2: "US",
    },
    destination_address: {
      line_1: "456 Oak Ave",
      city: destCity,
      state: destState,
      postal_code: dz,
      country_alpha2: "US",
    },
    calculate_tax_and_duties: false,
    courier_settings: { apply_shipping_rules: false },
    shipping_settings: { output_currency: "USD" },
    parcels: [
      {
        total_actual_weight: kg,
        box: { slug: "custom", length: L, width: W, height: H },
        items: [
          {
            description: "Matrix item",
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

const SCENARIOS = [
  { name: "NYC→LA 2lb 12×10×8", oz: "10001", dz: "90001", destCity: "Los Angeles", destState: "CA", weightLb: 2, L: 12, W: 10, H: 8 },
  { name: "NYC→SF 5lb 12×10×8", oz: "10001", dz: "94105", destCity: "San Francisco", destState: "CA", weightLb: 5, L: 12, W: 10, H: 8 },
  { name: "MIA→SEA 8lb 14×12×10", oz: "33101", dz: "98101", destCity: "Seattle", destState: "WA", weightLb: 8, L: 14, W: 12, H: 10 },
];

async function runOne(apiKey, scenario) {
  const url = `${easyshipBaseUrl(apiKey)}/2024-09/rates`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildBody(scenario)),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, error: text.slice(0, 200) };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: json?.message || json?.error || text.slice(0, 200) };
  }
  const rows = extractEasyshipRatesArray(json);
  const priced = rows
    .filter((r) => easyshipRowChargeTotalUSD(r) > 0)
    .sort((a, b) => easyshipRowChargeTotalUSD(a) - easyshipRowChargeTotalUSD(b));
  const umbrellas = new Set(
    priced.map((r) => String(r.courier_name || r.courier_service?.umbrella_name || r.courier_service?.name || "?").trim()),
  );
  return {
    ok: true,
    status: res.status,
    rawRows: rows.length,
    pricedRows: priced.length,
    carriers: umbrellas.size,
    cheapest: priced[0] ? easyshipRowChargeTotalUSD(priced[0]) : null,
  };
}

async function main() {
  const key = process.env.EASYSHIP_API_KEY;
  if (!key) {
    console.error("Set EASYSHIP_API_KEY");
    process.exit(1);
  }
  console.log("Easyship rates matrix (apply_shipping_rules=false, tax/duties off for US)\n");
  for (const s of SCENARIOS) {
    const r = await runOne(key, s);
    console.log(`${s.name}:`, JSON.stringify(r));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
