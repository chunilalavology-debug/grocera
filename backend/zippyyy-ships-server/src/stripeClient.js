import Stripe from "stripe";

export function createStripe({ secretKey }) {
  return new Stripe(secretKey, {
    apiVersion: "2024-06-20",
    typescript: false,
  });
}

