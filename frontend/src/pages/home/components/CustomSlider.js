import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../../services/api";
import { resolveBrandingAssetUrl } from "../../../utils/brandingAssets";

/** Shown only when the API fails or returns no usable slides (no bundled marketing images). */
const PLACEHOLDER_SLIDES = [
  {
    title: "Configure your hero slides",
    subtitle: "Open Admin → Home slider to add images, titles, and links.",
    imageUrl:
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#e0f2fe"/><stop offset="100%" style="stop-color:#f0f9ff"/></linearGradient></defs><rect fill="url(#g)" width="800" height="520" rx="24"/><text x="400" y="248" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="20">Homepage slider</text></svg>'
      ),
    cardBgColor: "#f8fafc",
    textColor: "#334155",
    buttonText: "Admin",
    buttonLink: "/admin/slider-settings",
    buttonBgColor: "#3090cf",
    buttonTextColor: "#ffffff",
  },
];

function readVisibleSlidesFromConfig(config) {
  const d = Math.max(1, Math.min(4, Number(config?.slidesPerViewDesktop ?? 3)));
  const t = Math.max(1, Math.min(3, Number(config?.slidesPerViewTablet ?? 2)));
  const m = Math.max(1, Math.min(2, Number(config?.slidesPerViewMobile ?? 1)));
  if (typeof window === "undefined") return d;
  if (window.matchMedia("(min-width: 1024px)").matches) return d;
  if (window.matchMedia("(min-width: 768px)").matches) return t;
  return m;
}

function HomeCustomSlider() {
  const [config, setConfig] = useState({
    sectionBgColor: "#ffffff",
    autoPlay: true,
    autoPlayDelayMs: 3000,
    transitionDurationMs: 700,
    slidesPerViewDesktop: 3,
    slidesPerViewTablet: 2,
    slidesPerViewMobile: 1,
    slides: PLACEHOLDER_SLIDES,
  });

  useEffect(() => {
    let cancelled = false;

    const loadSliderSettings = async () => {
      try {
        const res = await api.get("/user/home-slider-settings", {
          params: { _: Date.now() },
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        if (cancelled) return;
        if (res?.success && res?.data && typeof res.data === "object") {
          const nextSlides = Array.isArray(res.data.slides) ? res.data.slides : [];
          const valid = nextSlides.filter(
            (s) => s && String(s.title || "").trim() && String(s.imageUrl || s.img || "").trim()
          );
          if (valid.length > 0) {
            setConfig((prev) => ({ ...prev, ...res.data, slides: valid }));
          } else {
            setConfig((prev) => ({ ...prev, ...res.data, slides: PLACEHOLDER_SLIDES }));
          }
        }
      } catch {
        if (!cancelled) setConfig((prev) => ({ ...prev, slides: PLACEHOLDER_SLIDES }));
      }
    };

    loadSliderSettings();

    let t;
    const schedule = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        void loadSliderSettings();
      }, 400);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div style={{ backgroundColor: "#f8fafc" }}>
      <section className="py-7 md:py-12 border-y border-slate-100" style={{ backgroundColor: config.sectionBgColor || "#ffffff" }}>
        <div className="container mx-auto">
          <SliderRenderer config={config} />
        </div>
      </section>
    </div>
  );
}

const SliderRenderer = ({ config }) => {
  const slides = Array.isArray(config?.slides) && config.slides.length > 0 ? config.slides : PLACEHOLDER_SLIDES;
  const [index, setIndex] = useState(0);
  const [visibleSlides, setVisibleSlides] = useState(() => readVisibleSlidesFromConfig(config));

  useEffect(() => {
    const sync = () => setVisibleSlides(readVisibleSlidesFromConfig(config));
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqMd = window.matchMedia("(min-width: 768px)");
    mqLg.addEventListener("change", sync);
    mqMd.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    sync();
    return () => {
      mqLg.removeEventListener("change", sync);
      mqMd.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [config]);

  const n = slides.length;
  const columns = visibleSlides;
  const layoutCols = Math.max(columns, 1);
  const maxIndex = Math.max(0, n - columns);
  const centerTrack = n > 0 && n < columns;
  const pageCount = maxIndex + 1;

  useEffect(() => {
    setIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    if (!config?.autoPlay || n <= 1 || maxIndex === 0) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, Number(config?.autoPlayDelayMs || 3000));
    return () => clearInterval(timer);
  }, [config?.autoPlay, config?.autoPlayDelayMs, n, maxIndex]);

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  }, [maxIndex]);

  const goNext = useCallback(() => {
    setIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, dx: 0 });

  const onPointerDown = (e) => {
    if (maxIndex === 0) return;
    dragRef.current = { active: true, startX: e.clientX, dx: 0 };
    trackRef.current?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    dragRef.current.dx = e.clientX - dragRef.current.startX;
  };
  const onPointerUp = (e) => {
    if (!dragRef.current.active) return;
    const { dx } = dragRef.current;
    dragRef.current.active = false;
    try {
      trackRef.current?.releasePointerCapture?.(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    if (dx > 60) goPrev();
    else if (dx < -60) goNext();
  };

  const innerWidthPct = layoutCols > 0 && n > 0 ? (n * 100) / layoutCols : 100;
  const slideShareOfInnerPct = n > 0 ? 100 / n : 100;

  const activeDot = index;

  return (
    <div className="relative overflow-hidden pb-10 w-full min-h-[200px] md:min-h-[240px]">
      {pageCount > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slides"
            onClick={goPrev}
            className="absolute left-0 sm:left-1 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[#3090cf] text-white shadow-md hover:bg-[#2680b8] border-0 transition-colors"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label="Next slides"
            onClick={goNext}
            className="absolute right-0 sm:right-1 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[#3090cf] text-white shadow-md hover:bg-[#2680b8] border-0 transition-colors"
          >
            <ChevronRight size={22} strokeWidth={2.5} />
          </button>
        </>
      )}
      <div
        ref={trackRef}
        className="w-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: maxIndex === 0 ? "auto" : "pan-x" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={`flex transition-transform ease-in-out will-change-transform ${centerTrack ? "mx-auto" : ""}`}
          style={{
            width: `${innerWidthPct}%`,
            transform: `translateX(-${index * slideShareOfInnerPct}%)`,
            transitionDuration: `${Number(config?.transitionDurationMs || 700)}ms`,
          }}
        >
          {slides.map((item, i) => (
            <div
              key={item.id || item._id || `slide-${i}`}
              className="box-border flex-shrink-0 px-3 sm:px-4"
              style={{ width: `${slideShareOfInnerPct}%` }}
            >
              <div
                className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-slate-100 flex flex-col md:flex-row min-h-[180px] md:h-[220px] lg:h-[260px]"
                style={{ backgroundColor: item.cardBgColor || "#ffffff" }}
              >
                <div className="flex flex-1 flex-col justify-center p-5 md:p-6 lg:p-8 order-2 md:order-1">
                  <h3
                    className={`font-bold text-base sm:text-lg lg:text-xl leading-tight ${String(item.subtitle || "").trim() ? "mb-1 md:mb-2" : "mb-3 md:mb-4"}`}
                    style={{ color: item.textColor || "#1e293b" }}
                  >
                    {item.title}
                  </h3>
                  {String(item.subtitle || "").trim() ? (
                    <p
                      className="text-sm sm:text-base leading-snug mb-3 md:mb-4 opacity-90 line-clamp-3"
                      style={{ color: item.textColor || "#1e293b" }}
                    >
                      {String(item.subtitle).trim()}
                    </p>
                  ) : null}
                  {(item.buttonLink || "").startsWith("http") ? (
                    <a
                      href={item.buttonLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 w-fit rounded-xl font-semibold text-sm px-4 py-2.5 transition-opacity"
                      style={{
                        backgroundColor: item.buttonBgColor || "#3090cf",
                        color: item.buttonTextColor || "#ffffff",
                      }}
                    >
                      {item.buttonText || "Shop Now"}
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </a>
                  ) : (
                    <Link
                      to={item.buttonLink || "/products"}
                      className="inline-flex items-center gap-1.5 w-fit rounded-xl font-semibold text-sm px-4 py-2.5 transition-opacity"
                      style={{
                        backgroundColor: item.buttonBgColor || "#3090cf",
                        color: item.buttonTextColor || "#ffffff",
                      }}
                    >
                      {item.buttonText || "Shop Now"}
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </Link>
                  )}
                </div>
                <div className="flex-shrink-0 w-full md:w-2/5 lg:w-[45%] order-1 md:order-2 flex items-center justify-center overflow-hidden bg-slate-100/40">
                  <img
                    src={
                      resolveBrandingAssetUrl(String(item.imageUrl || item.img || "").trim()) ||
                      item.imageUrl ||
                      item.img
                    }
                    alt=""
                    className="h-32 md:h-full w-full object-cover object-center md:max-h-[220px] lg:max-h-[260px]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" role="tablist" aria-label="Slider pages">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              type="button"
              role="tab"
              aria-selected={i === activeDot}
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Page ${i + 1} of ${pageCount} (slides ${i + 1}–${Math.min(i + columns, n)})`}
              className={`rounded-full transition-all ${i === activeDot ? "bg-[#3090cf] w-2.5 h-2.5" : "bg-slate-300 w-2 h-2 hover:bg-slate-400"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeCustomSlider;
