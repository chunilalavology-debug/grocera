/**
 * Unified API smoke/audit runner for local + production-like checks.
 *
 * Usage:
 *   node script/smokeApiFull.js
 *   API_BASE=https://api.example.com/api node script/smokeApiFull.js
 *   ADMIN_TOKEN="Bearer ..." USER_TOKEN="Bearer ..." SHIPPING_PROXY_TEST_API_KEY="zippy_..." node script/smokeApiFull.js
 *
 * Outputs:
 *   script/reports/smoke-api-full-report.json
 */
const fs = require("fs");
const path = require("path");

const API_BASE = String(process.env.API_BASE || "http://127.0.0.1:5000/api").replace(/\/+$/, "");
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || "").trim();
const USER_TOKEN = String(process.env.USER_TOKEN || "").trim();
const SHIPPING_PROXY_TEST_API_KEY = String(process.env.SHIPPING_PROXY_TEST_API_KEY || "").trim();

const shippingBody = {
  length: 12,
  width: 10,
  height: 8,
  weight: 5,
  destinationZip: "10001",
  destinationAddress: "123 Main St, New York, NY",
  originZip: "90210",
  originAddress: "456 Oak Ave, Los Angeles, CA",
  destinationResidential: false,
  addInsurance: false,
  insuranceDeclaredValue: 50,
};

function nowIso() {
  return new Date().toISOString();
}

async function requestJson(method, route, { headers = {}, body } = {}) {
  const url = `${API_BASE}${route.startsWith("/") ? route : `/${route}`}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { url, status: res.status, ok: res.ok, text, json };
}

function shortBody(raw) {
  const t = String(raw || "");
  return t.length > 260 ? `${t.slice(0, 260)}...` : t;
}

async function runCheck(name, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    return {
      name,
      pass: true,
      durationMs: Date.now() - startedAt,
      ...result,
    };
  } catch (error) {
    return {
      name,
      pass: false,
      durationMs: Date.now() - startedAt,
      status: null,
      error: error?.message || String(error),
    };
  }
}

function expectStatus(resp, allowed) {
  if (!allowed.includes(resp.status)) {
    throw new Error(`Expected status ${allowed.join("/")} got ${resp.status}; body=${shortBody(resp.text)}`);
  }
}

function expectJsonFlag(resp, key, expected) {
  const got = resp?.json?.[key];
  if (got !== expected) {
    throw new Error(`Expected json.${key}=${expected}, got ${got}; body=${shortBody(resp.text)}`);
  }
}

async function main() {
  const checks = [];
  const add = async (name, fn) => {
    const r = await runCheck(name, fn);
    checks.push(r);
    const icon = r.pass ? "OK  " : "FAIL";
    const statusPart = r.status != null ? ` status=${r.status}` : "";
    const detail = r.error ? ` ${r.error}` : "";
    console.log(`${icon} ${name}${statusPart}${detail}`);
  };

  // Public/Core
  await add("health", async () => {
    const resp = await requestJson("GET", "/health");
    expectStatus(resp, [200]);
    return { status: resp.status };
  });
  await add("public products list", async () => {
    const resp = await requestJson("GET", "/user/products?page=1&limit=5");
    expectStatus(resp, [200]);
    expectJsonFlag(resp, "success", true);
    return { status: resp.status, items: Array.isArray(resp.json?.data) ? resp.json.data.length : null };
  });
  await add("public categories list", async () => {
    const resp = await requestJson("GET", "/user/categories");
    expectStatus(resp, [200]);
    expectJsonFlag(resp, "success", true);
    return { status: resp.status };
  });
  await add("public featured categories", async () => {
    const resp = await requestJson("GET", "/user/featured-categories");
    expectStatus(resp, [200]);
    return { status: resp.status };
  });
  await add("public site settings", async () => {
    const resp = await requestJson("GET", "/settings");
    expectStatus(resp, [200]);
    expectJsonFlag(resp, "success", true);
    return { status: resp.status };
  });
  await add("public slider settings", async () => {
    const resp = await requestJson("GET", "/user/home-slider-settings");
    expectStatus(resp, [200]);
    expectJsonFlag(resp, "success", true);
    return { status: resp.status };
  });

  // Validation checks
  await add("auth login invalid payload -> 400", async () => {
    const resp = await requestJson("POST", "/auth/login", { body: { email: "bad", password: "" } });
    expectStatus(resp, [400]);
    return { status: resp.status };
  });
  await add("contact form invalid payload -> 400", async () => {
    const resp = await requestJson("POST", "/user/contactForm", {
      body: { name: "", email: "x", queryType: "", subject: "", message: "" },
    });
    expectStatus(resp, [400]);
    return { status: resp.status };
  });
  await add("shipping quote valid", async () => {
    const resp = await requestJson("POST", "/user/shipping/quote", { body: shippingBody });
    expectStatus(resp, [200]);
    expectJsonFlag(resp, "success", true);
    return { status: resp.status, source: resp.json?.data?.source || null };
  });
  await add("shipping quote invalid payload -> 400", async () => {
    const resp = await requestJson("POST", "/user/shipping/quote", { body: {} });
    expectStatus(resp, [400]);
    return { status: resp.status };
  });

  // Protected endpoints (without token)
  await add("admin settings unauthorized -> 401", async () => {
    const resp = await requestJson("GET", "/admin/settings");
    expectStatus(resp, [401]);
    return { status: resp.status };
  });
  await add("auth profile unauthorized -> 401", async () => {
    const resp = await requestJson("GET", "/auth/profile");
    expectStatus(resp, [401]);
    return { status: resp.status };
  });

  // Optional auth checks when tokens are supplied
  if (USER_TOKEN) {
    await add("auth profile with USER_TOKEN", async () => {
      const resp = await requestJson("GET", "/auth/profile", {
        headers: { Authorization: USER_TOKEN },
      });
      expectStatus(resp, [200]);
      return { status: resp.status };
    });
  }

  if (ADMIN_TOKEN) {
    await add("admin settings with ADMIN_TOKEN", async () => {
      const resp = await requestJson("GET", "/admin/settings", {
        headers: { Authorization: ADMIN_TOKEN },
      });
      expectStatus(resp, [200]);
      return { status: resp.status };
    });
    await add("admin orders list with ADMIN_TOKEN", async () => {
      const resp = await requestJson("GET", "/admin/orders?page=1&limit=5", {
        headers: { Authorization: ADMIN_TOKEN },
      });
      expectStatus(resp, [200]);
      return { status: resp.status };
    });
    await add("admin products csv sample with ADMIN_TOKEN", async () => {
      const url = `${API_BASE}/admin/products/csv-sample`;
      const res = await fetch(url, { headers: { Authorization: ADMIN_TOKEN } });
      const text = await res.text();
      if (res.status !== 200) {
        throw new Error(`Expected 200 got ${res.status}; body=${shortBody(text)}`);
      }
      return { status: res.status };
    });
  }

  // Shipping proxy auth checks
  await add("shipping proxy no key -> 401 or 400", async () => {
    const resp = await requestJson("POST", "/shipping/get-rates", { body: shippingBody });
    expectStatus(resp, [400, 401]);
    return { status: resp.status };
  });
  await add("shipping proxy bad key -> 401 or 400", async () => {
    const resp = await requestJson("POST", "/shipping/get-rates", {
      headers: { "x-api-key": "bad-key" },
      body: shippingBody,
    });
    expectStatus(resp, [400, 401]);
    return { status: resp.status };
  });
  if (SHIPPING_PROXY_TEST_API_KEY) {
    await add("shipping proxy valid client key", async () => {
      const resp = await requestJson("POST", "/shipping/get-rates", {
        headers: { "x-api-key": SHIPPING_PROXY_TEST_API_KEY },
        body: shippingBody,
      });
      expectStatus(resp, [200, 404, 429, 502, 503]);
      return { status: resp.status, rates: Array.isArray(resp.json?.data?.rates) ? resp.json.data.rates.length : null };
    });
  }

  // 404 behavior
  await add("unknown route -> 401 or 404", async () => {
    const resp = await requestJson("GET", "/_smoke_unknown_route_");
    expectStatus(resp, [401, 404]);
    return { status: resp.status };
  });

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const report = {
    generatedAt: nowIso(),
    apiBase: API_BASE,
    environment: {
      hasAdminToken: Boolean(ADMIN_TOKEN),
      hasUserToken: Boolean(USER_TOKEN),
      hasShippingProxyTestApiKey: Boolean(SHIPPING_PROXY_TEST_API_KEY),
    },
    summary: {
      total: checks.length,
      passed,
      failed,
      passRate: checks.length ? Number(((passed / checks.length) * 100).toFixed(2)) : 0,
    },
    checks,
  };

  const reportsDir = path.join(__dirname, "reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, "smoke-api-full-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`\nReport written: ${reportPath}`);
  console.log(`Summary: ${passed}/${checks.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("fatal:", error?.message || error);
  process.exit(1);
});
