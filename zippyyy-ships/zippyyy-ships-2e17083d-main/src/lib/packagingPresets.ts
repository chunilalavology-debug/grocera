export type PackagingCarrier = "UPS" | "FedEx" | "USPS" | "Custom";

export type PackagingPreset = {
  carrier: PackagingCarrier;
  name: string;
  length: number;
  width: number;
  height: number;
  label: string;
};

type PackagingKind = "Box" | "Envelope" | "Tube";

function kindFromName(name: string): PackagingKind {
  const n = name.toLowerCase();
  if (n.includes("tube")) return "Tube";
  if (n.includes("envelope")) return "Envelope";
  return "Box";
}

function normalizeDisplayName(name: string): string {
  const kind = kindFromName(name);
  // Remove confusing terms for customers.
  const cleaned = name
    .replace(/\bExpress\b/gi, "")
    .replace(/\bReusable\b/gi, "Reusable")
    .replace(/\bPak\b/gi, "")
    .replace(/\bPack\b/gi, "")
    .replace(/\(.*?\)/g, (m) => m) // keep parenthetical if present
    .replace(/\s+/g, " ")
    .trim();

  // Ensure the visible type is clear and consistent.
  if (kind === "Tube") return cleaned.includes("Tube") ? cleaned : `${cleaned} Tube`;
  if (kind === "Envelope") return cleaned.includes("Envelope") ? cleaned : `${cleaned} Envelope`;
  return cleaned.includes("Box") ? cleaned : `${cleaned} Box`;
}

function withNormalizedName(p: PackagingPreset): PackagingPreset {
  return { ...p, name: normalizeDisplayName(p.name) };
}

// Dimensions are in inches.
// These presets are compiled from carrier-published references:
// - UPS Express Envelope/Tube/Pack/Box/Value Box list (UPS packaging guide PDF)
// - FedEx One Rate packaging chart (FedEx One Rate Packaging PDF)
// - USPS Flat Rate quick reference (Postal Explorer)
export const PACKAGING_PRESETS: PackagingPreset[] = [
  // UPS Express packaging (UPS packaging guide; metric converted to inches)
  { carrier: "UPS", name: "UPS Express Envelope", length: 13.58, width: 9.84, height: 0.25, label: '34.5×25 cm (~13.58×9.84 in)' },
  { carrier: "UPS", name: "UPS Express Reusable Envelope", length: 13.58, width: 9.84, height: 0.25, label: '34.5×25 cm (~13.58×9.84 in)' },
  { carrier: "UPS", name: "UPS Express Tube", length: 38.19, width: 7.48, height: 6.5, label: '97×19×16.5 cm (~38.19×7.48×6.5 in)' },
  { carrier: "UPS", name: "UPS Express Pack (Small)", length: 16.06, width: 12.8, height: 0.5, label: '40.8×32.5 cm (~16.06×12.8 in)' },
  { carrier: "UPS", name: "UPS Express Pack (Medium)", length: 17.72, width: 16.14, height: 0.5, label: '45×41 cm (~17.72×16.14 in)' },
  { carrier: "UPS", name: "UPS Express Box", length: 18.11, width: 12.4, height: 3.74, label: '46×31.5×9.5 cm (~18.11×12.4×3.74 in)' },
  // UPS Value Box sizes vary by program/region; dimensions are not in the referenced quick guide.

  // FedEx One Rate packaging (FedEx One Rate PDF)
  { carrier: "FedEx", name: "FedEx Envelope (built-in pouch)", length: 12.5, width: 9.5, height: 0.25, label: '9.5×12.5 in' },
  { carrier: "FedEx", name: "FedEx Envelope (no pouch)", length: 12.5, width: 9.5, height: 0.25, label: '9.5×12.5 in' },
  { carrier: "FedEx", name: "FedEx Reusable Envelope (Legal)", length: 15.5, width: 9.5, height: 0.25, label: '9.5×15.5 in' },
  { carrier: "FedEx", name: "FedEx Small Pak", length: 12.75, width: 10.25, height: 0.5, label: '10.25×12.75 in' },
  { carrier: "FedEx", name: "FedEx Small Pak (poly)", length: 12.75, width: 10.25, height: 0.5, label: '10.25×12.75 in' },
  { carrier: "FedEx", name: "FedEx Padded Pak", length: 14.75, width: 11.75, height: 0.75, label: '11.75×14.75 in' },
  { carrier: "FedEx", name: "FedEx Large Pak", length: 15.5, width: 12, height: 0.75, label: '12×15.5 in' },
  { carrier: "FedEx", name: "FedEx Large Pak (poly)", length: 15.5, width: 12, height: 0.75, label: '12×15.5 in' },
  { carrier: "FedEx", name: "FedEx Reusable Sturdy Pak", length: 14.5, width: 10, height: 0.75, label: '10×14.5 in' },
  { carrier: "FedEx", name: "FedEx Small Box (S1)", length: 12.375, width: 10.875, height: 1.5, label: '10.875×1.5×12.375 in' },
  { carrier: "FedEx", name: "FedEx Small Box (S2)", length: 11.0625, width: 8.75, height: 2.0625, label: '8.75×2.0625×11.0625 in' },
  { carrier: "FedEx", name: "FedEx Medium Box (M1)", length: 13.25, width: 11.5, height: 2.375, label: '11.5×2.375×13.25 in' },
  { carrier: "FedEx", name: "FedEx Medium Box (M2)", length: 11.0625, width: 8.75, height: 4.375, label: '8.75×4.375×11.0625 in' },
  // FedEx One Rate Large/Extra Large boxes exist, but their official dimensions aren’t in the PDF we’re using here.

  // USPS Flat Rate (Postal Explorer; outside dimensions where given)
  { carrier: "USPS", name: "Flat Rate Envelope", length: 12.5, width: 9.5, height: 0.25, label: '12.5×9.5 in' },
  { carrier: "USPS", name: "Legal Flat Rate Envelope", length: 15, width: 9.5, height: 0.25, label: '15×9.5 in' },
  { carrier: "USPS", name: "Padded Flat Rate Envelope", length: 12.5, width: 9.5, height: 0.5, label: '12.5×9.5 in (padded)' },
  { carrier: "USPS", name: "Small Flat Rate Envelope", length: 10, width: 6, height: 0.25, label: '10×6 in' },
  { carrier: "USPS", name: "Small Flat Rate Box (Outside)", length: 8.6875, width: 5.4375, height: 1.75, label: '8-11/16×5-7/16×1-3/4 in' },
  { carrier: "USPS", name: "Medium Flat Rate Box (Top-Loading, Outside)", length: 11.25, width: 8.75, height: 6, label: '11-1/4×8-3/4×6 in' },
  { carrier: "USPS", name: "Medium Flat Rate Box (Side-Loading, Outside)", length: 14.125, width: 12, height: 3.5, label: '14-1/8×12×3-1/2 in' },
  { carrier: "USPS", name: "Large Flat Rate Box (Outside)", length: 12.25, width: 12, height: 6, label: '12-1/4×12×6 in' },
  { carrier: "USPS", name: "Large Video Box (Outside)", length: 9.4375, width: 6.4375, height: 2.1875, label: '9-7/16×6-7/16×2-3/16 in' },
].map(withNormalizedName);

