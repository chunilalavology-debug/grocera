import { z } from "zod";
import { AddressSchema, ParcelSchema } from "./easyship.js";

export const InsuranceBodySchema = z.object({
  is_insured: z.boolean(),
  insured_amount: z.number().positive().optional(),
  insured_currency: z.string().length(3).optional(),
});

export const QuoteRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  parcel: ParcelSchema,
  currency: z.string().min(3).max(3).default("USD"),
  declared_customs_value: z.number().positive().optional(),
  /** Receiver is residential (Easyship `set_as_residential` on rate request). */
  set_as_residential: z.boolean().optional(),
  insurance: InsuranceBodySchema.optional(),
  category: z.string().min(1).optional(),
});

export const SelectedRateSchema = z.object({
  courier_name: z.string().min(1),
  courier_service_name: z.string().optional(),
  shipment_charge_total: z.number().nonnegative(),
  shipment_charge_total_currency: z.string().min(3).max(3),
  easyship_rate_id: z.string().optional(),
  min_delivery_time: z.number().nullable().optional(),
  max_delivery_time: z.number().nullable().optional(),
  minimum_pickup_fee: z.number().nullable().optional(),
  rate_description: z.string().optional(),
  raw: z.any().optional(),
});

export const CheckoutSessionRequestSchema = z.object({
  draft: QuoteRequestSchema,
  selectedRate: SelectedRateSchema,
});

