/**
 * Shared Easyship /2024-09/rates response parsing (grocery API + smoke scripts).
 * Keeps charge detection and array extraction aligned so rows are not dropped as $0.
 */

/**
 * @param {unknown} parsed JSON body from Easyship rates POST
 * @returns {object[]} raw rate rows
 */
function extractEasyshipRatesArray(parsed) {
  if (!parsed || typeof parsed !== "object") return [];
  const nested = [
    parsed.rates,
    parsed.data?.rates,
    parsed.data?.data?.rates,
    parsed.rate_list?.rates,
    parsed.result?.rates,
  ];
  for (const c of nested) {
    if (Array.isArray(c) && c.length) return c;
  }
  for (const c of nested) {
    if (Array.isArray(c)) return c;
  }
  if (Array.isArray(parsed.data) && parsed.data.length && parsed.data[0]?.courier_service != null) {
    return parsed.data;
  }
  const one = parsed;
  if (
    one &&
    typeof one === "object" &&
    (one.courier_service != null || one.courier_service_name != null) &&
    (one.total_charge != null || one.shipment_charge_total != null || typeof one.shipment_charge === "number")
  ) {
    return [one];
  }
  return [];
}

/**
 * Prefer all-in total_charge (Easyship schema), then shipment_charge_total, then components.
 * @param {object} r rate row
 * @returns {number}
 */
function easyshipRowChargeTotalUSD(r) {
  if (!r) return 0;
  const ric = r.rates_in_origin_currency;
  const candidates = [
    r.total_charge,
    ric?.total_charge,
    r.shipment_charge_total,
    ric?.shipment_charge_total,
    r.shipment_charge?.total,
    typeof r.shipment_charge === "number" ? r.shipment_charge : null,
    ric?.shipment_charge?.total,
    typeof ric?.shipment_charge === "number" ? ric.shipment_charge : null,
    r.other_surcharges?.total_fee,
    ric?.other_surcharges?.total_fee,
  ];
  for (const v of candidates) {
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

module.exports = {
  extractEasyshipRatesArray,
  easyshipRowChargeTotalUSD,
};
