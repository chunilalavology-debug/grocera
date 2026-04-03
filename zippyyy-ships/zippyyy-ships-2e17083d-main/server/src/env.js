import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().url().default("http://localhost:8080"),
  EASYSHIP_API_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  ZIPPYYY_MARKUP_MULTIPLIER: z.coerce.number().min(1).default(1.25),
  ZIPPYYY_FEE_CENTS: z.coerce.number().int().min(0).default(0),
});

export const env = EnvSchema.parse(process.env);

