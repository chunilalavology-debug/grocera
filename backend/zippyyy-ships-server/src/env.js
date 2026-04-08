import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/** Strip whitespace/newlines — common when pasting into Vercel env UI. */
function trimSecret(val) {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s.length > 0 ? s : undefined;
}

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  APP_URL: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      return s.length ? s : undefined;
    },
    z.string().url().default("http://localhost:8080"),
  ),
  /** Comma-separated extra allowed CORS origins (e.g. preview URL + production). */
  CORS_ORIGINS: z.string().optional(),
  EASYSHIP_API_KEY: z.preprocess(trimSecret, z.string().min(1).optional()),
  /** Safety guard: production apps should not use sandbox keys unless explicitly allowed. */
  EASYSHIP_ALLOW_SANDBOX: z.preprocess(
    (v) => {
      if (v === undefined || v === null || String(v).trim() === "") return false;
      const s = String(v).trim().toLowerCase();
      return s === "1" || s === "true" || s === "yes";
    },
    z.boolean().default(false),
  ),
  /** Commission added on top of Easyship live rates (e.g. 30 => +30%). */
  ZIPPYYY_COMMISSION_PERCENT: z.coerce.number().min(0).max(200).default(30),
  STRIPE_SECRET_KEY: z.preprocess(trimSecret, z.string().min(1).optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(trimSecret, z.string().min(1).optional()),
  ZIPPYYY_MARKUP_MULTIPLIER: z.coerce.number().min(1).default(1),
  ZIPPYYY_FEE_CENTS: z.coerce.number().int().min(0).default(0),
  /** Multiplier on Easyship total for “list price” line / Save % (must be > markup for a positive savings label). */
  ZIPPYYY_LIST_PRICE_MULTIPLIER: z.coerce.number().min(1.01).default(2),
  /**
   * Where the Vite ships UI is mounted under APP_URL (no slashes), e.g. zippyyy-ships-app.
   * Set empty to use /checkout/success at site root (standalone ships UI).
   */
  ZIPPYYY_UI_BASE_PATH: z.preprocess((v) => {
    if (v === undefined || v === null) return "zippyyy-ships-app";
    const s = String(v).trim().replace(/^\/+|\/+$/g, "");
    return s;
  }, z.string()),
});

export const env = EnvSchema.parse(process.env);

