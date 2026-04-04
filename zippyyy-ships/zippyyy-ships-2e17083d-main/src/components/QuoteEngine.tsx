import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Weight,
  ArrowRight,
  Package,
  Truck,
  Plane,
  Ship,
  Heart,
  RotateCcw,
  User,
  Shield,
  Home,
  Clock,
  MapPinned,
  Check,
  Percent,
  Tag,
} from "lucide-react";
import shippingBox from "@/assets/shipping-box.png";
import Box3DPreview from "@/components/Box3DPreview";
import { AddressAutocomplete, type TaggedAddress } from "@/components/AddressAutocomplete";
import { apiPost } from "@/lib/api";
import { PACKAGING_PRESETS, type PackagingCarrier, type PackagingPreset } from "@/lib/packagingPresets";
import { usStateFromZip } from "@/lib/usStateFromZip";

const CARRIERS: PackagingCarrier[] = ["UPS", "FedEx", "USPS"];

const TIP_OPTIONS = [
  { label: "5%", value: 0.05 },
  { label: "10%", value: 0.10 },
  { label: "15%", value: 0.15 },
];

type ApiRate = {
  courier_name: string;
  courier_service_name?: string;
  shipment_charge_total: number;
  shipment_charge_total_currency: string;
  easyship_rate_id?: string;
  min_delivery_time?: number | null;
  max_delivery_time?: number | null;
  minimum_pickup_fee?: number | null;
  rate_description?: string;
  raw?: unknown;
};

const SAVED_ADDR_KEY = "zippyyy-ships-saved-addresses-v1";

type PricingMeta = { markupMultiplier: number; listPriceMultiplier: number };
const DEFAULT_PRICING: PricingMeta = { markupMultiplier: 1.25, listPriceMultiplier: 2 };

function computeSavingsLabel(base: number, markupMult: number, listMult: number) {
  if (base <= 0 || listMult <= markupMult) return null;
  const listRef = Math.ceil(base * listMult);
  const yourPrice = Math.ceil(base * markupMult);
  if (listRef <= yourPrice) return null;
  const savePct = Math.round((1 - yourPrice / listRef) * 100);
  if (savePct < 1) return null;
  return { listRef, yourPrice, savePct };
}

function parseApiErrorMessage(err: unknown): string {
  if (!(err instanceof Error) || !err.message) return "Something went wrong.";
  try {
    const j = JSON.parse(err.message) as { message?: string; error?: string };
    if (typeof j.message === "string" && j.message.trim()) return j.message;
    if (typeof j.error === "string") return j.error;
  } catch {
    /* ignore */
  }
  return err.message;
}

/** User-facing copy when quotes fail (includes deployment hints). */
function formatQuotesFetchError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let code: string | undefined;
  try {
    code = (JSON.parse(raw) as { error?: string }).error;
  } catch {
    if (raw.includes("EASYSHIP_NOT_CONFIGURED")) code = "EASYSHIP_NOT_CONFIGURED";
    else if (raw.includes("SHIPS_API_NOT_CONFIGURED")) code = "SHIPS_API_NOT_CONFIGURED";
    else if (raw.includes("SHIPS_UPSTREAM_UNREACHABLE")) code = "SHIPS_UPSTREAM_UNREACHABLE";
  }
  if (code === "EASYSHIP_NOT_CONFIGURED") {
    return "Easyship is not enabled on the shipping API server. Add EASYSHIP_API_KEY to the Node project that serves /api/quotes (not only the storefront Vercel app), save for Production, redeploy, then try again.";
  }
  if (code === "SHIPS_API_NOT_CONFIGURED") {
    return "Storefront is not pointed at the shipping API. On the site Vercel project, set SHIPS_API_BASE to your ships server URL (same place you set EASYSHIP_API_KEY), then redeploy.";
  }
  if (code === "SHIPS_UPSTREAM_UNREACHABLE") {
    return "Could not reach the shipping API. Check SHIPS_API_BASE and that the ships server is running.";
  }
  return parseApiErrorMessage(err);
}

type SavedAddressBook = {
  id: string;
  label: string;
  tagged: TaggedAddress;
  contact: { name: string; phone: string; email: string };
};

type Step = "zips" | "dimensions" | "weight" | "quotes" | "details" | "checkout";
const STEPS: Step[] = ["zips", "dimensions", "weight", "quotes", "details", "checkout"];
const STEP_LABELS = ["ZIP", "Box", "Weight", "Quote", "Details", "Pay"];

const QuoteEngine = () => {
  const [step, setStep] = useState<Step>("zips");
  const [fromZip, setFromZip] = useState("");
  const [toZip, setToZip] = useState("");
  const [shipCountryAlpha2, setShipCountryAlpha2] = useState("US");
  const [fromAddress, setFromAddress] = useState<TaggedAddress | null>(null);
  const [toAddress, setToAddress] = useState<TaggedAddress | null>(null);
  const [carrier, setCarrier] = useState<PackagingCarrier>("UPS");
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [customDims, setCustomDims] = useState({ length: "", width: "", height: "" });
  const [isCustom, setIsCustom] = useState(false);
  const [weight, setWeight] = useState("");
  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const [rates, setRates] = useState<ApiRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const lastQuoteKeyRef = useRef<string>("");

  const [fromContact, setFromContact] = useState({ name: "", phone: "", email: "" });
  const [toContact, setToContact] = useState({ name: "", phone: "", email: "" });

  const [setAsResidential, setSetAsResidential] = useState(false);
  const [wantInsurance, setWantInsurance] = useState(false);
  const [insuredAmount, setInsuredAmount] = useState("100");
  const [declaredCustomsValue, setDeclaredCustomsValue] = useState("50");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressBook[]>([]);
  const [pricing, setPricing] = useState<PricingMeta>(DEFAULT_PRICING);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_ADDR_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        const cleaned = parsed.filter((row): row is SavedAddressBook => {
          if (!row || typeof row !== "object") return false;
          const r = row as SavedAddressBook;
          return (
            typeof r.id === "string" &&
            typeof r.label === "string" &&
            r.tagged &&
            typeof r.tagged === "object" &&
            typeof r.tagged.formattedAddress === "string" &&
            r.tagged.components &&
            typeof r.contact === "object" &&
            typeof r.contact?.name === "string" &&
            typeof r.contact?.phone === "string" &&
            typeof r.contact?.email === "string"
          );
        });
        setSavedAddresses(cleaned);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistSavedAddresses = (next: SavedAddressBook[]) => {
    setSavedAddresses(next);
    try {
      localStorage.setItem(SAVED_ADDR_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const filteredPresets = useMemo<PackagingPreset[]>(
    () => PACKAGING_PRESETS.filter((p) => p.carrier === carrier),
    [carrier],
  );

  const derivedFromState = useMemo(
    () => (shipCountryAlpha2.trim().toUpperCase() === "US" ? usStateFromZip(fromZip) ?? "" : ""),
    [shipCountryAlpha2, fromZip],
  );
  const derivedToState = useMemo(
    () => (shipCountryAlpha2.trim().toUpperCase() === "US" ? usStateFromZip(toZip) ?? "" : ""),
    [shipCountryAlpha2, toZip],
  );

  const dims = isCustom
    ? { length: Number(customDims.length) || 0, width: Number(customDims.width) || 0, height: Number(customDims.height) || 0 }
    : selectedBox !== null
    ? filteredPresets[selectedBox]
    : null;

  const calculatePrice = (base: number) => Math.ceil(base * pricing.markupMultiplier);

  const uniqueCarrierCount = useMemo(
    () => new Set(rates.map((r) => r.courier_name)).size,
    [rates],
  );

  const selectedRateObj = useMemo(() => {
    if (selectedRate === null) return null;
    return rates[selectedRate] ?? null;
  }, [rates, selectedRate]);

  const selectedSavings = useMemo(() => {
    if (!selectedRateObj) return null;
    return computeSavingsLabel(
      selectedRateObj.shipment_charge_total,
      pricing.markupMultiplier,
      pricing.listPriceMultiplier,
    );
  }, [selectedRateObj, pricing.markupMultiplier, pricing.listPriceMultiplier]);

  const getTotal = () => {
    if (!selectedRateObj) return 0;
    const price = calculatePrice(selectedRateObj.shipment_charge_total);
    const tipAmount = tip !== null ? Math.round(price * TIP_OPTIONS[tip].value) : 0;
    return price + tipAmount;
  };

  const canProceed = () => {
    switch (step) {
      case "zips":
        return (
          fromZip.trim().length >= 4 &&
          toZip.trim().length >= 4 &&
          shipCountryAlpha2.trim().length === 2 &&
          (shipCountryAlpha2.trim().toUpperCase() !== "US" ||
            (derivedFromState.length === 2 && derivedToState.length === 2))
        );
      case "dimensions": return dims !== null && dims.length > 0 && dims.width > 0 && dims.height > 0;
      case "weight":
        if (!Number(weight) || Number(weight) <= 0) return false;
        if (wantInsurance && (!Number(insuredAmount) || Number(insuredAmount) <= 0)) return false;
        if (!Number(declaredCustomsValue) || Number(declaredCustomsValue) <= 0) return false;
        return true;
      case "quotes": return selectedRateObj !== null;
      case "details":
        return (
          Boolean(fromAddress && toAddress) &&
          fromContact.name.trim().length > 1 &&
          fromContact.phone.trim().length > 6 &&
          toContact.name.trim().length > 1 &&
          toContact.phone.trim().length > 6
        );
      default: return false;
    }
  };

  const nextStep = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      const next = STEPS[idx + 1];
      setStep(next);
      if (next === "quotes") void fetchRates();
    }
  };
  const prevStep = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const currentStepIdx = STEPS.indexOf(step);

  const fetchRates = async (options?: { force?: boolean }) => {
    if (!dims || !Number(weight)) return;

    const quoteKey = JSON.stringify({
      fromZip: fromZip.trim(),
      toZip: toZip.trim(),
      country: shipCountryAlpha2.trim().toUpperCase(),
      fromState: derivedFromState,
      toState: derivedToState,
      dims,
      weight: Number(weight),
      setAsResidential,
      wantInsurance,
      insuredAmount: Number(insuredAmount),
      declaredCustomsValue: Number(declaredCustomsValue),
    });
    if (!options?.force && quoteKey === lastQuoteKeyRef.current && rates.length > 0) return;
    lastQuoteKeyRef.current = quoteKey;

    setIsLoadingRates(true);
    setRatesError(null);
    setSelectedRate(null);

    try {
      const declared = Number(declaredCustomsValue) || 50;
      const body: Record<string, unknown> = {
        from: zipOnlyAddress(fromZip, shipCountryAlpha2, derivedFromState || undefined),
        to: zipOnlyAddress(toZip, shipCountryAlpha2, derivedToState || undefined),
        parcel: {
          length: dims.length,
          width: dims.width,
          height: dims.height,
          weight: Number(weight),
        },
        currency: "USD",
        declared_customs_value: declared,
        set_as_residential: setAsResidential,
      };
      if (wantInsurance) {
        body.insurance = {
          is_insured: true,
          insured_amount: Number(insuredAmount) || declared,
          insured_currency: "USD",
        };
      }
      const resp = await apiPost<{
        rates: ApiRate[];
        pricing?: Partial<PricingMeta>;
      }>("/api/quotes", body);
      setRates(resp.rates ?? []);
      if (
        resp.pricing &&
        typeof resp.pricing.markupMultiplier === "number" &&
        typeof resp.pricing.listPriceMultiplier === "number"
      ) {
        setPricing({
          markupMultiplier: resp.pricing.markupMultiplier,
          listPriceMultiplier: resp.pricing.listPriceMultiplier,
        });
      }
    } catch (e) {
      setRatesError(formatQuotesFetchError(e));
      setRates([]);
    } finally {
      setIsLoadingRates(false);
    }
  };

  const startCheckout = async () => {
    if (!selectedRateObj || !fromAddress || !toAddress || !dims || !Number(weight)) return;
    setCheckoutError(null);
    const declared = Number(declaredCustomsValue) || 50;
    const draft: Record<string, unknown> = {
      from: toEasyshipAddress(fromAddress, fromContact),
      to: toEasyshipAddress(toAddress, toContact),
      parcel: {
        length: dims.length,
        width: dims.width,
        height: dims.height,
        weight: Number(weight),
      },
      currency: "USD",
      declared_customs_value: declared,
      set_as_residential: setAsResidential,
    };
    if (wantInsurance) {
      draft.insurance = {
        is_insured: true,
        insured_amount: Number(insuredAmount) || declared,
        insured_currency: "USD",
      };
    }

    try {
      const resp = await apiPost<{ url: string }>("/api/checkout/session", {
        draft,
        selectedRate: selectedRateObj,
        ...(appliedPromoCode ? { promotionCode: appliedPromoCode } : {}),
      });
      window.location.href = resp.url;
    } catch (e) {
      setCheckoutError(parseApiErrorMessage(e));
    }
  };

  const applyPromoCode = async () => {
    const c = promoInput.trim();
    if (!c) {
      setPromoError("Enter a promotion code.");
      return;
    }
    setPromoApplying(true);
    setPromoError(null);
    try {
      const res = await apiPost<{ ok: boolean; code: string }>("/api/checkout/promotion-code", { code: c });
      if (res.ok && res.code) setAppliedPromoCode(res.code);
    } catch (e) {
      setPromoError(parseApiErrorMessage(e));
      setAppliedPromoCode(null);
    } finally {
      setPromoApplying(false);
    }
  };

  return (
    <section id="quote" className="py-8 sm:py-14 md:py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/3 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6 sm:mb-10 md:mb-12"
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">
            Instant Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-foreground mt-2 sm:mt-3">
            Get your shipping quote
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 text-left max-w-4xl mx-auto">
            {[
              {
                icon: Truck,
                title: "Multiple carriers",
                body: "Compare live UPS, FedEx, USPS and more in one place — pick the service that fits speed and budget.",
              },
              {
                icon: Percent,
                title: "Savings shown on every rate",
                body: "Each quote includes an estimated Save % vs. typical carrier list pricing so your price is easy to explain.",
              },
              {
                icon: Tag,
                title: "Promo codes before checkout",
                body: "Apply a Stripe promotion code on the Pay step before you continue to secure card payment.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex gap-3 rounded-2xl border border-border/40 bg-card/60 p-4 text-sm shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Check size={14} className="text-primary shrink-0" />
                    {title}
                  </p>
                  <p className="mt-1 text-muted-foreground leading-snug">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-float-lg border border-border/30 flex flex-col">
            {/* Progress bar */}
            <div className="flex items-center gap-1 mb-5 sm:mb-8 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <motion.div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shrink-0 ${
                      step === s
                        ? "bg-primary text-primary-foreground shadow-glow ring-2 ring-primary/35"
                        : currentStepIdx > i
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {i + 1}
                  </motion.div>
                  <span className={`hidden sm:block text-[10px] uppercase tracking-wide font-semibold ${
                    step === s ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {STEP_LABELS[i]}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1">
                      <motion.div
                        className="h-full bg-primary/30 rounded-full"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: currentStepIdx > i ? 1 : 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ transformOrigin: "left" }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Short steps stay compact; longer steps (quote/details/pay) get a modest min-h for stability */}
            <div
              className={
                step === "quotes" || step === "details" || step === "checkout"
                  ? "flex flex-col min-h-[min(220px,42vh)] sm:min-h-[260px]"
                  : "flex flex-col min-h-0"
              }
            >
            <AnimatePresence mode="wait">
              {step === "zips" && (
                <motion.div key="zips" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                  <h3 className="text-xl font-bold text-foreground mb-2">Enter ZIP codes</h3>
                  <p className="text-sm text-muted-foreground mb-4">Start with ZIP/postal codes to fetch live rates fast.</p>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">Country</label>
                      <input
                        value={shipCountryAlpha2}
                        onChange={(e) => setShipCountryAlpha2(e.target.value.toUpperCase())}
                        placeholder="US"
                        className="w-full bg-secondary border-none focus:ring-2 focus:ring-primary/50 transition-all p-4 rounded-2xl text-foreground placeholder:text-muted-foreground outline-none font-mono uppercase"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">From ZIP</label>
                      <input
                        value={fromZip}
                        onChange={(e) => setFromZip(e.target.value)}
                        placeholder="10001"
                        className="w-full bg-secondary border-none focus:ring-2 focus:ring-primary/50 transition-all p-4 rounded-2xl text-foreground placeholder:text-muted-foreground outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">To ZIP</label>
                      <input
                        value={toZip}
                        onChange={(e) => setToZip(e.target.value)}
                        placeholder="94105"
                        className="w-full bg-secondary border-none focus:ring-2 focus:ring-primary/50 transition-all p-4 rounded-2xl text-foreground placeholder:text-muted-foreground outline-none font-mono"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === "dimensions" && (
                <motion.div key="dimensions" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                  <h3 className="text-xl font-bold text-foreground mb-2">Select packaging</h3>
                  <p className="text-sm text-muted-foreground mb-6">Choose a carrier box preset or enter custom dimensions</p>

                  {/* Fixed-height preview so layout doesn’t jump when dimensions become valid */}
                  <div className="relative mb-3 h-48 shrink-0 rounded-2xl bg-secondary/50 p-4 flex items-center justify-center overflow-hidden">
                    {dims && dims.length > 0 && dims.width > 0 && dims.height > 0 ? (
                      <Box3DPreview length={dims.length} width={dims.width} height={dims.height} />
                    ) : (
                      <p className="text-center text-sm text-muted-foreground px-4">
                        Select a box preset or enter custom length, width, and height.
                      </p>
                    )}
                  </div>
                  <div className="mb-6 min-h-[4.5rem] rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 text-center flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
                      All dimensions (inches)
                    </p>
                    {dims && dims.length > 0 && dims.width > 0 && dims.height > 0 ? (
                      <p className="font-mono text-sm sm:text-base text-foreground tabular-nums">
                        <span className="text-primary font-semibold">L</span> {dims.length.toFixed(2)} ×{" "}
                        <span className="text-primary font-semibold">W</span> {dims.width.toFixed(2)} ×{" "}
                        <span className="text-primary font-semibold">H</span> {dims.height.toFixed(2)}{" "}
                        <span className="text-muted-foreground">in</span>
                      </p>
                    ) : (
                      <p className="font-mono text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {CARRIERS.map((c) => (
                      <motion.button
                        key={c}
                        onClick={() => {
                          setCarrier(c);
                          setSelectedBox(null);
                          setIsCustom(false);
                        }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                          carrier === c
                            ? "border-primary bg-primary/5 text-foreground shadow-glow"
                            : "border-transparent bg-secondary text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {c}
                      </motion.button>
                    ))}
                    <motion.button
                      onClick={() => { setIsCustom(true); setSelectedBox(null); }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                        isCustom
                          ? "border-primary bg-primary/5 text-foreground shadow-glow"
                          : "border-transparent bg-secondary text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      Custom
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {!isCustom && filteredPresets.map((box, i) => (
                      <motion.button
                        key={`${box.carrier}-${box.name}`}
                        onClick={() => { setSelectedBox(i); setIsCustom(false); }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className={`p-4 rounded-2xl border-2 transition-all text-left ${
                          selectedBox === i && !isCustom
                            ? "border-primary bg-primary/5 shadow-glow"
                            : "border-transparent bg-secondary hover:border-primary/30"
                        }`}
                      >
                        <Box className={selectedBox === i && !isCustom ? "text-primary" : "text-muted-foreground"} size={20} />
                        <div className="mt-2 font-semibold text-sm text-foreground">{box.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{box.label}</div>
                      </motion.button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {isCustom && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-3 gap-3">
                          {(["length", "width", "height"] as const).map((dim) => (
                            <div key={dim}>
                              <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1 block">{dim} (in)</label>
                              <input
                                type="number"
                                value={customDims[dim]}
                                onChange={(e) => setCustomDims({ ...customDims, [dim]: e.target.value })}
                                className="w-full bg-secondary p-3 rounded-xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {step === "weight" && (
                <motion.div key="weight" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                  <h3 className="text-xl font-bold text-foreground mb-6">Package weight</h3>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">Weight in Pounds (lb)</label>
                    <div className="relative group">
                      <Weight className="absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110" size={18} />
                      <input
                        type="number"
                        placeholder="Enter weight in lb"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full bg-secondary border-none focus:ring-2 focus:ring-primary/50 transition-all p-4 pl-12 rounded-2xl text-foreground placeholder:text-muted-foreground outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Fixed block height so the form doesn’t shift when weight goes from 0 to &gt; 0 */}
                  <div className="mt-6 min-h-[4.25rem] bg-secondary rounded-2xl p-4 flex flex-col justify-center">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Light</span>
                      <span>Heavy</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-[width] duration-300 ease-out"
                        style={{ width: `${Number(weight) > 0 ? Math.min(Number(weight) / 100 * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-8 space-y-5 rounded-2xl border border-border/40 bg-card/50 p-5">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                      Shipment options (used for accurate quotes)
                    </p>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/60 p-4">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={setAsResidential}
                        onChange={(e) => setSetAsResidential(e.target.checked)}
                      />
                      <span>
                        <span className="flex items-center gap-2 font-semibold text-foreground">
                          <Home size={16} className="text-primary" />
                          Residential delivery address
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Check if the receiver is a home (not commercial). Rates may include a residential surcharge where applicable.
                        </span>
                      </span>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1 block">
                          Declared customs value (USD)
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={declaredCustomsValue}
                          onChange={(e) => setDeclaredCustomsValue(e.target.value)}
                          className="w-full rounded-xl bg-secondary p-3 font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-secondary/60 p-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={wantInsurance}
                            onChange={(e) => setWantInsurance(e.target.checked)}
                          />
                          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Shield size={16} className="text-primary" />
                            Add shipping insurance
                          </span>
                        </label>
                      </div>
                    </div>

                    {wantInsurance && (
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1 block">
                          Insured value (USD)
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={insuredAmount}
                          onChange={(e) => setInsuredAmount(e.target.value)}
                          className="w-full rounded-xl bg-secondary p-3 font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/50 sm:max-w-xs"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Premium insurance via Easyship when available. Courier basic coverage may still apply separately.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {step === "quotes" && (
                <motion.div key="quotes" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                  <h3 className="text-xl font-bold text-foreground mb-2">Available rates</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    {rates.length > 0
                      ? `Showing options from ${uniqueCarrierCount} carrier${uniqueCarrierCount === 1 ? "" : "s"} — choose any service below.`
                      : "All-inclusive professional rates from major carriers."}
                  </p>
                  <p className="text-xs text-muted-foreground/90 mb-6">
                    Save % compares your price to an estimated typical carrier list price; published counter rates vary by location.
                  </p>
                  <div className="min-h-[200px]">
                  {isLoadingRates ? (
                    <div className="bg-secondary rounded-2xl p-6 text-sm text-muted-foreground">
                      Fetching live Easyship rates…
                    </div>
                  ) : ratesError ? (
                    <div className="bg-secondary rounded-2xl p-6 text-sm text-destructive break-words">
                      {ratesError}
                      <button
                        type="button"
                        className="ml-3 underline text-foreground"
                        onClick={() => void fetchRates({ force: true })}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rates.map((rate, i) => {
                        const displayPrice = calculatePrice(rate.shipment_charge_total);
                        const savings = computeSavingsLabel(
                          rate.shipment_charge_total,
                          pricing.markupMultiplier,
                          pricing.listPriceMultiplier,
                        );
                        const Icon = pickIcon(rate.courier_name);
                        return (
                          <motion.button
                            key={`${rate.courier_name}-${i}`}
                            onClick={() => setSelectedRate(i)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                              selectedRate === i
                                ? "border-primary bg-primary/5 shadow-glow"
                                : "border-transparent bg-secondary hover:border-primary/30"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                              selectedRate === i ? "bg-primary shadow-glow" : "bg-primary/10"
                            }`}>
                              <Icon className={selectedRate === i ? "text-primary-foreground" : "text-primary"} size={20} />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="font-semibold text-foreground text-sm">{rate.courier_name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {rate.courier_service_name || "Service"}
                              </div>
                              {(rate.min_delivery_time != null || rate.max_delivery_time != null) && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Clock size={12} className="shrink-0 text-primary" />
                                  <span>
                                    Est.{" "}
                                    {rate.min_delivery_time != null && rate.max_delivery_time != null
                                      ? `${rate.min_delivery_time}–${rate.max_delivery_time} business days`
                                      : rate.min_delivery_time != null
                                        ? `${rate.min_delivery_time}+ business days`
                                        : `up to ${rate.max_delivery_time} business days`}
                                  </span>
                                </div>
                              )}
                              {typeof rate.minimum_pickup_fee === "number" && rate.minimum_pickup_fee > 0 ? (
                                <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                                  Pickup available — min. pickup fee ${rate.minimum_pickup_fee.toFixed(2)} (drop-off may be no extra)
                                </div>
                              ) : (
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  Typical service: courier pickup or drop-off per carrier rules — see details below when you pay.
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              {savings && (
                                <div className="mb-1 flex flex-col items-end gap-0.5">
                                  <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                    Save {savings.savePct}%
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground line-through">
                                    ${savings.listRef}
                                  </span>
                                </div>
                              )}
                              <motion.div
                                className="font-bold text-foreground font-mono text-lg"
                                key={displayPrice}
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                              >
                                ${displayPrice}
                              </motion.div>
                            </div>
                          </motion.button>
                        );
                      })}
                      {rates.length === 0 && (
                        <div className="bg-secondary rounded-2xl p-6 text-sm text-muted-foreground">
                          No rates returned. Check addresses/parcel details.
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                </motion.div>
              )}

              {step === "details" && (
                <motion.div key="details" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                  <h3 className="text-xl font-bold text-foreground mb-2">Full address & contact</h3>
                  <p className="text-sm text-muted-foreground mb-6">Now confirm the full pickup and delivery details for the label.</p>

                  <div className="space-y-6">
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-primary" />
                          <span className="font-semibold text-sm text-foreground">From</span>
                        </div>
                        {savedAddresses.length > 0 && (
                          <div>
                            <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                              <MapPinned size={12} />
                              Load saved address
                            </label>
                            <select
                              className="w-full rounded-2xl border border-transparent bg-secondary p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                              defaultValue=""
                              onChange={(e) => {
                                const id = e.target.value;
                                const found = savedAddresses.find((a) => a.id === id);
                                if (found) {
                                  setFromAddress(found.tagged);
                                  setFromContact({ ...found.contact });
                                }
                                e.target.value = "";
                              }}
                            >
                              <option value="">Select…</option>
                              {savedAddresses.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <button
                          type="button"
                          className="w-full rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                          onClick={() => {
                            if (!fromAddress) return;
                            const label = window.prompt("Save this “From” address as (e.g. Home, Warehouse)", "Saved address");
                            if (!label?.trim()) return;
                            const id =
                              typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : `addr-${Date.now()}`;
                            persistSavedAddresses([
                              ...savedAddresses,
                              {
                                id,
                                label: label.trim(),
                                tagged: fromAddress,
                                contact: { ...fromContact },
                              },
                            ]);
                          }}
                        >
                          Save current “From” for autofill next time
                        </button>
                        <AddressAutocomplete
                          label="From Address"
                          value={fromAddress}
                          onChange={setFromAddress}
                          placeholder="Origin address"
                          active={step === "details"}
                        />
                        <div className="space-y-3">
                          <input
                            value={fromContact.name}
                            onChange={(e) => setFromContact({ ...fromContact, name: e.target.value })}
                            placeholder="Full name"
                            className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <input
                            value={fromContact.phone}
                            onChange={(e) => setFromContact({ ...fromContact, phone: e.target.value })}
                            placeholder="Phone"
                            className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                          />
                          <input
                            value={fromContact.email}
                            onChange={(e) => setFromContact({ ...fromContact, email: e.target.value })}
                            placeholder="Email (optional)"
                            className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-accent" />
                          <span className="font-semibold text-sm text-foreground">To</span>
                        </div>
                        {savedAddresses.length > 0 && (
                          <div>
                            <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                              <MapPinned size={12} />
                              Load saved address
                            </label>
                            <select
                              className="w-full rounded-2xl border border-transparent bg-secondary p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                              defaultValue=""
                              onChange={(e) => {
                                const id = e.target.value;
                                const found = savedAddresses.find((a) => a.id === id);
                                if (found) {
                                  setToAddress(found.tagged);
                                  setToContact({ ...found.contact });
                                }
                                e.target.value = "";
                              }}
                            >
                              <option value="">Select…</option>
                              {savedAddresses.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <button
                          type="button"
                          className="w-full rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                          onClick={() => {
                            if (!toAddress) return;
                            const label = window.prompt("Save this “To” address as (e.g. Mom, Office)", "Saved address");
                            if (!label?.trim()) return;
                            const id =
                              typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : `addr-${Date.now()}`;
                            persistSavedAddresses([
                              ...savedAddresses,
                              {
                                id,
                                label: label.trim(),
                                tagged: toAddress,
                                contact: { ...toContact },
                              },
                            ]);
                          }}
                        >
                          Save current “To” for autofill next time
                        </button>
                        <AddressAutocomplete
                          label="To Address"
                          value={toAddress}
                          onChange={setToAddress}
                          placeholder="Destination address"
                          active={step === "details"}
                        />
                        <div className="space-y-3">
                          <input
                            value={toContact.name}
                            onChange={(e) => setToContact({ ...toContact, name: e.target.value })}
                            placeholder="Full name"
                            className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <input
                            value={toContact.phone}
                            onChange={(e) => setToContact({ ...toContact, phone: e.target.value })}
                            placeholder="Phone"
                            className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                          />
                          <input
                            value={toContact.email}
                            onChange={(e) => setToContact({ ...toContact, email: e.target.value })}
                            placeholder="Email (optional)"
                            className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === "checkout" && (
                <motion.div key="checkout" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                  <h3 className="text-xl font-bold text-foreground mb-6">Confirm & Pay</h3>

                  <div className="mb-6 rounded-2xl border border-border/50 bg-card/50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Tag className="text-primary" size={16} />
                      <span className="text-sm font-semibold text-foreground">Promotion code</span>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Have a code? Apply it here before continuing — discounts are applied in secure Stripe Checkout.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <input
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value);
                          setPromoError(null);
                          setAppliedPromoCode(null);
                        }}
                        placeholder="Enter code"
                        className="min-h-[48px] flex-1 rounded-2xl bg-secondary px-4 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                        disabled={promoApplying}
                      />
                      <motion.button
                        type="button"
                        onClick={() => void applyPromoCode()}
                        disabled={promoApplying || !promoInput.trim()}
                        whileHover={{ scale: promoApplying ? 1 : 1.02 }}
                        whileTap={{ scale: promoApplying ? 1 : 0.98 }}
                        className="rounded-2xl bg-secondary px-5 py-3 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-primary/10 disabled:opacity-40"
                      >
                        {promoApplying ? "Checking…" : "Apply"}
                      </motion.button>
                    </div>
                    {promoError && <p className="mt-2 text-xs text-destructive">{promoError}</p>}
                    {appliedPromoCode && !promoError && (
                      <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        “{appliedPromoCode}” applied — your discount will show on the next screen.
                      </p>
                    )}
                  </div>

                  <div className="bg-secondary/70 rounded-2xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="text-primary" size={16} />
                      <span className="font-semibold text-sm text-foreground">Support your shippers</span>
                    </div>
                    <div className="flex gap-2">
                      {TIP_OPTIONS.map((t, i) => (
                        <motion.button
                          key={t.label}
                          onClick={() => setTip(tip === i ? null : i)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            tip === i
                              ? "bg-primary text-primary-foreground shadow-glow"
                              : "bg-card text-foreground hover:bg-primary/10"
                          }`}
                        >
                          {t.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <div className="text-right">
                        {selectedSavings && (
                          <div className="mb-0.5 flex flex-wrap items-center justify-end gap-2">
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                              Save {selectedSavings.savePct}%
                            </span>
                            <span className="font-mono text-xs text-muted-foreground line-through">
                              ${selectedSavings.listRef}
                            </span>
                          </div>
                        )}
                        <span className="font-mono font-medium text-foreground">
                          ${selectedRateObj ? calculatePrice(selectedRateObj.shipment_charge_total) : 0}
                        </span>
                      </div>
                    </div>
                    {tip !== null && selectedRateObj && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">Shipper tip ({TIP_OPTIONS[tip].label})</span>
                        <span className="font-mono font-medium text-foreground">
                          ${Math.round(calculatePrice(selectedRateObj.shipment_charge_total) * TIP_OPTIONS[tip].value)}
                        </span>
                      </motion.div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-border pt-3 mt-3">
                      <span className="text-foreground">Total</span>
                      <motion.span
                        className="font-mono text-primary"
                        key={getTotal()}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                      >
                        ${getTotal()}
                      </motion.span>
                    </div>
                    {appliedPromoCode && (
                      <p className="text-[11px] text-muted-foreground">
                        Promo discounts apply to the Stripe payment step; total above is before your code.
                      </p>
                    )}
                  </div>

                  {checkoutError && (
                    <p className="mb-4 text-sm text-destructive" role="alert">
                      {checkoutError}
                    </p>
                  )}

                  <motion.button
                    className="w-full mt-6 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full shadow-glow relative overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => void startCheckout()}
                    disabled={!selectedRateObj || promoApplying}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <span className="relative z-10">Proceed to Payment</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-5 sm:mt-8 gap-3">
              {step !== "zips" ? (
                <motion.button
                  onClick={prevStep}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-secondary text-secondary-foreground font-semibold rounded-full text-sm flex items-center gap-2"
                >
                  <RotateCcw size={14} /> Back
                </motion.button>
              ) : <div />}
              {step !== "checkout" && (
                <motion.button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  whileHover={canProceed() ? { scale: 1.05 } : {}}
                  whileTap={canProceed() ? { scale: 0.95 } : {}}
                  className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-full text-sm disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
                >
                  Continue <ArrowRight size={16} />
                </motion.button>
              )}
            </div>
          </div>

          {/* Live Manifest Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-foreground text-primary-foreground rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 h-fit relative lg:sticky lg:top-24 border border-primary-foreground/5 self-start"
          >
            <div className="flex items-center gap-3 mb-6">
              <motion.img
                src={shippingBox}
                alt="box"
                className="w-8 h-8"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="text-[10px] uppercase tracking-widest font-semibold opacity-60">
                Shipping Manifest
              </span>
            </div>

            <div className="space-y-4 font-mono text-sm">
              <div>
                <span className="text-[10px] uppercase tracking-widest opacity-40">Origin</span>
                <div className="mt-1 font-medium">{fromZip || "—"}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest opacity-40">Destination</span>
                <div className="mt-1 font-medium">{toZip || "—"}</div>
              </div>
              <div className="border-t border-primary-foreground/10 pt-4">
                <span className="text-[10px] uppercase tracking-widest opacity-40">Dimensions</span>
                <div className="mt-1 font-medium">
                  {dims && dims.length > 0 ? `${dims.length}×${dims.width}×${dims.height} in` : "—"}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest opacity-40">Weight</span>
                <div className="mt-1 font-medium">{weight ? `${weight} lb` : "—"}</div>
              </div>
              {selectedRateObj !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-t border-primary-foreground/10 pt-4"
                >
                  <span className="text-[10px] uppercase tracking-widest opacity-40">Carrier</span>
                  <div className="mt-1 font-medium">{selectedRateObj?.courier_name}</div>
                  {selectedSavings && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground/90">
                        Save {selectedSavings.savePct}%
                      </span>
                      <span className="font-mono text-xs opacity-60 line-through">${selectedSavings.listRef}</span>
                    </div>
                  )}
                  <motion.div
                    className="text-3xl font-bold mt-2 text-primary"
                    key={getTotal()}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    ${getTotal()}
                  </motion.div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default QuoteEngine;

function toEasyshipAddress(tagged: TaggedAddress, contact: { name: string; phone: string; email: string }) {
  return {
    name: contact.name || "Customer",
    phone: contact.phone || "0000000000",
    email: contact.email || undefined,
    address_line_1: tagged.components.addressLine1 || tagged.formattedAddress,
    address_line_2: tagged.components.addressLine2 || undefined,
    city: tagged.components.city || "City",
    state: tagged.components.state || undefined,
    postal_code: tagged.components.postalCode || "00000",
    country_alpha2: tagged.components.countryAlpha2 || "US",
  };
}

function zipOnlyAddress(zip: string, countryAlpha2: string, state?: string) {
  // Used for initial quoting: Easyship v2024 requires structured addresses; we provide minimal placeholders.
  const z = zip.trim();
  const c = (countryAlpha2 || "US").trim().toUpperCase();
  const st = state?.trim().toUpperCase();
  return {
    name: "Quote",
    phone: "0000000000",
    address_line_1: "N/A",
    city: "N/A",
    state: st && st.length ? st : undefined,
    postal_code: z,
    country_alpha2: c,
  };
}

function pickIcon(courier: string) {
  const c = courier.toLowerCase();
  if (c.includes("dhl")) return Ship;
  if (c.includes("usps")) return Package;
  if (c.includes("fedex") || c.includes("ups")) return Truck;
  return Plane;
}
