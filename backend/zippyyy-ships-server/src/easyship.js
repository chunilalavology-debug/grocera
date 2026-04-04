import { z } from "zod";

const PROD_BASE = "https://public-api.easyship.com";
const SANDBOX_BASE = "https://public-api-sandbox.easyship.com";
const API_VERSION = "2024-09";

export function createEasyshipClient({ apiKey }) {
  const base = pickBaseUrl(apiKey);

  async function request(path, { method = "GET", body } = {}) {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const json = text ? safeJson(text) : null;

    if (!res.ok) {
      const msg =
        (json && (json.error || json.message || json.errors)) ||
        text ||
        `Easyship request failed: ${res.status}`;
      const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      err.status = res.status;
      err.url = url;
      err.details = json;
      throw err;
    }

    return json;
  }

  return {
    /**
     * Rates request.
     * Docs: https://developers.easyship.com/reference/rates_request
     */
    async requestRates(payload) {
      return await request(`/${API_VERSION}/rates`, { method: "POST", body: payload });
    },

    /**
     * Create shipment.
     * Docs: https://developers.easyship.com/v2023.01/reference/shipments_create
     */
    async createShipment(payload) {
      return await request(`/${API_VERSION}/shipments`, { method: "POST", body: payload });
    },

    /**
     * List item categories (for item_category_id).
     * Docs: https://developers.easyship.com/reference/item_categories_index
     */
    async listItemCategories() {
      return await request(`/${API_VERSION}/item_categories`, { method: "GET" });
    },

    // For v2024+, we buy labels during shipment creation (buy_label_synchronous).
  };
}

export const AddressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  company_name: z.string().optional(),
  address_line_1: z.string().min(1),
  address_line_2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1).optional(),
  postal_code: z.string().min(1),
  country_alpha2: z.string().length(2),
});

export const ParcelSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  weight: z.number().positive(),
});

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickBaseUrl(apiKey) {
  const key = String(apiKey || "");
  const isSandbox = key.startsWith("sand_");
  const isProd = key.startsWith("prod_");

  if (isSandbox) return SANDBOX_BASE;
  if (isProd) return PROD_BASE;
  return PROD_BASE;
}

