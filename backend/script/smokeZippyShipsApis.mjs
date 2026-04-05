/**
 * Smoke tests for Zippyyy Ships APIs (no auth required for quote).
 *
 * Prerequisites:
 *   1) Main API: cd grocera/backend && npm start  (default http://127.0.0.1:5000/api)
 *   2) Ships server (optional): cd grocera/backend/zippyyy-ships-server && npm start  (default PORT 3001)
 *
 * Usage:
 *   GROCERA_API_BASE=http://127.0.0.1:5000/api SHIPS_API_BASE=http://127.0.0.1:3001 node script/smokeZippyShipsApis.mjs
 */

const GROCERA = String(process.env.GROCERA_API_BASE || "http://127.0.0.1:5000/api").replace(/\/+$/, "");
const SHIPS = String(process.env.SHIPS_API_BASE || "http://127.0.0.1:3001").replace(/\/+$/, "");

const validQuoteBody = {
  length: 12,
  width: 10,
  height: 8,
  weight: 5,
  destinationZip: "10001",
  destinationAddress: "123 Main St, New York, NY",
  originZip: "90210",
  originAddress: "456 Oak Ave, Los Angeles, CA",
  destinationResidential: false,
};

async function run(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log(`Grocera API: ${GROCERA}`);
  console.log(`Ships API:   ${SHIPS}\n`);

  await run("POST /user/shipping/quote — valid body", async () => {
    const r = await fetch(`${GROCERA}/user/shipping/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validQuoteBody),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(`${r.status} ${JSON.stringify(j)}`);
    if (!(Number(j.data?.quoteAmount) > 0)) throw new Error("missing quoteAmount");
  });

  await run("POST /user/shipping/quote — empty body → 400", async () => {
    const r = await fetch(`${GROCERA}/user/shipping/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
  });

  await run("POST /user/shipping/quote — nonsense types → 400", async () => {
    const r = await fetch(`${GROCERA}/user/shipping/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validQuoteBody, weight: "heavy" }),
    });
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
  });

  await run("POST /user/shipping/checkout — guest without contact → 400", async () => {
    const r = await fetch(`${GROCERA}/user/shipping/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validQuoteBody),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status} ${JSON.stringify(j)}`);
    if (!String(j.message || "").toLowerCase().includes("guest")) {
      throw new Error(`unexpected message: ${j.message}`);
    }
  });

  await run("GET ships /api/health", async () => {
    const r = await fetch(`${SHIPS}/api/health`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(JSON.stringify(j));
  });

  await run("POST ships /api/quotes — empty → 400 or 501", async () => {
    const r = await fetch(`${SHIPS}/api/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (r.status !== 400 && r.status !== 501) {
      throw new Error(`expected 400 or 501, got ${r.status}`);
    }
  });
}

main();
