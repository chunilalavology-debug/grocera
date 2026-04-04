import zipcodes from "zipcodes";

type ZipRecord = { state?: string } | null | undefined;

/**
 * Returns the 2-letter US state for a 5-digit ZIP, or undefined if unknown / incomplete.
 */
export function usStateFromZip(zipInput: string): string | undefined {
  const digits = zipInput.trim().replace(/\D/g, "").slice(0, 5);
  if (digits.length < 5) return undefined;
  const rec = zipcodes.lookup(digits) as ZipRecord;
  const st = rec?.state;
  if (!st || typeof st !== "string") return undefined;
  const u = st.toUpperCase().trim();
  return u.length >= 2 ? u.slice(0, 2) : u;
}
