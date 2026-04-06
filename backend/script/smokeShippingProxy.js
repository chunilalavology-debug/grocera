/**
 * Smoke checks for secure shipping proxy API.
 *
 * Usage:
 *   node script/smokeShippingProxy.js
 *   SHIPPING_PROXY_TEST_API_KEY="zippy_xxx_yyy" node script/smokeShippingProxy.js
 */
const BASE = String(process.env.API_BASE || "http://127.0.0.1:5000/api").replace(/\/+$/, "");
const TEST_KEY = String(process.env.SHIPPING_PROXY_TEST_API_KEY || "").trim();

const body = {
  originAddress: "123 Main St, New York, NY",
  originZip: "10001",
  destinationAddress: "456 Oak Ave, Los Angeles, CA",
  destinationZip: "90001",
  length: 12,
  width: 10,
  height: 8,
  weight: 5,
  destinationResidential: false,
};

async function hit(name, headers, expected) {
  const r = await fetch(`${BASE}/shipping/get-rates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  const ok = expected.includes(r.status);
  console.log(`${ok ? "OK " : "FAIL"} ${name}: ${r.status} ${text.slice(0, 220)}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("API Base:", BASE);
  await hit("missing x-api-key", {}, [401]);
  await hit("invalid x-api-key format", { "x-api-key": "bad" }, [401]);
  await hit("unknown x-api-key", { "x-api-key": "zippy_abcdef123456_notreal" }, [401]);
  if (TEST_KEY) {
    await hit("configured client key", { "x-api-key": TEST_KEY }, [200, 404, 429, 502, 503]);
  } else {
    console.log("SKIP configured key test: set SHIPPING_PROXY_TEST_API_KEY");
  }
}

main().catch((e) => {
  console.error("FAIL fatal:", e.message || e);
  process.exit(1);
});
