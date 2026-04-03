import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import api from "../../../services/api";
import ScrollReveal from "../../../components/ScrollReveal";

import slide1 from "../../../assets-copy/home/slide1.png";
import slide3 from "../../../assets-copy/home/slide3.png";
import slide4 from "../../../assets-copy/home/slide4.png";
import slide5 from "../../../assets-copy/home/slide5.png";

const FALLBACK_SLIDES = [
  { imageUrl: slide1, title: "Everyday Fresh & Clean with Our Products", cardBgColor: "#fef3c7", textColor: "#1e293b", buttonText: "Shop Now", buttonLink: "/products", buttonBgColor: "#3090cf", buttonTextColor: "#ffffff" },
  { imageUrl: slide3, title: "The best Organic Products Online", cardBgColor: "#e2e8f0", textColor: "#1e293b", buttonText: "Shop Now", buttonLink: "/products", buttonBgColor: "#3090cf", buttonTextColor: "#ffffff" },
  { imageUrl: slide4, title: "Fresh Groceries Delivered to Your Door", cardBgColor: "#ecfdf5", textColor: "#1e293b", buttonText: "Shop Now", buttonLink: "/products", buttonBgColor: "#3090cf", buttonTextColor: "#ffffff" },
  { imageUrl: slide5, title: "Quality Ingredients for Every Kitchen", cardBgColor: "#e0f2fe", textColor: "#1e293b", buttonText: "Shop Now", buttonLink: "/products", buttonBgColor: "#3090cf", buttonTextColor: "#ffffff" },
];

function HomeCustomSlider() {
  const [config, setConfig] = useState({
    sectionBgColor: "#ffffff",
    autoPlay: true,
    autoPlayDelayMs: 3000,
    transitionDurationMs: 700,
    slidesPerViewDesktop: 3,
    slidesPerViewTablet: 2,
    slidesPerViewMobile: 1,
    slides: FALLBACK_SLIDES,
  });

  useEffect(() => {
    const loadSliderSettings = async () => {
      try {
        const res = await api.get("/user/home-slider-settings");
        if (res?.success && Array.isArray(res?.data?.slides) && res.data.slides.length > 0) {
          setConfig((prev) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        // Keep fallback slider when API fails.
      }
    };
    loadSliderSettings();
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
  const slides = Array.isArray(config?.slides) && config.slides.length > 0 ? config.slides : FALLBACK_SLIDES;
  const [index, setIndex] = useState(0);
  const [visibleSlides, setVisibleSlides] = useState(1);
  const [enableTransition, setEnableTransition] = useState(true);

  useEffect(() => {
    const updateSlides = () => {
      if (window.innerWidth >= 1024) setVisibleSlides(Math.max(1, Number(config?.slidesPerViewDesktop || 3)));
      else if (window.innerWidth >= 768) setVisibleSlides(Math.max(1, Number(config?.slidesPerViewTablet || 2)));
      else setVisibleSlides(Math.max(1, Number(config?.slidesPerViewMobile || 1)));
    };
    updateSlides();
    window.addEventListener("resize", updateSlides);
    return () => window.removeEventListener("resize", updateSlides);
  }, [config?.slidesPerViewDesktop, config?.slidesPerViewTablet, config?.slidesPerViewMobile]);

  const sliderSlides = [...slides.slice(-visibleSlides), ...slides, ...slides.slice(0, visibleSlides)];

  useEffect(() => {
    setEnableTransition(false);
    setIndex(visibleSlides);
    requestAnimationFrame(() => setEnableTransition(true));
  }, [visibleSlides, slides.length]);

  useEffect(() => {
    if (!config?.autoPlay || slides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => prev + 1);
    }, Number(config?.autoPlayDelayMs || 3000));
    return () => clearInterval(timer);
  }, [config?.autoPlay, config?.autoPlayDelayMs, slides.length]);

  const handleTransitionEnd = () => {
    if (index >= slides.length + visibleSlides) {
      setEnableTransition(false);
      setIndex(visibleSlides);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEnableTransition(true));
      });
    }
  };

  const activeDot = (index - visibleSlides + slides.length) % slides.length;

  return (
    <div className="relative overflow-hidden pb-10 w-full">
      <div
        onTransitionEnd={handleTransitionEnd}
        className={`flex min-w-full ${enableTransition ? "transition-transform ease-in-out" : ""}`}
        style={{
          transform: `translateX(-${index * (100 / visibleSlides)}%)`,
          transitionDuration: `${Number(config?.transitionDurationMs || 700)}ms`,
        }}
      >
        {sliderSlides.map((item, i) => (
          <div key={i} className="px-3 sm:px-4 flex-shrink-0" style={{ width: `${100 / visibleSlides}%` }}>
            <ScrollReveal>
              <div
                className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-slate-100 flex flex-col md:flex-row min-h-[180px] md:h-[220px] lg:h-[260px]"
                style={{ backgroundColor: item.cardBgColor || "#ffffff" }}
              >
              <div className="flex flex-1 flex-col justify-center p-5 md:p-6 lg:p-8 order-2 md:order-1">
                <h3 className="font-bold text-base sm:text-lg lg:text-xl leading-tight mb-3 md:mb-4" style={{ color: item.textColor || "#1e293b" }}>
                  {item.title}
                </h3>
                {(item.buttonLink || "").startsWith("http") ? (
                  <a
                    href={item.buttonLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 w-fit rounded-xl font-semibold text-sm px-4 py-2.5 transition-opacity"
                    style={{ backgroundColor: item.buttonBgColor || "#3090cf", color: item.buttonTextColor || "#ffffff" }}
                  >
                    {item.buttonText || "Shop Now"}
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </a>
                ) : (
                  <Link
                    to={item.buttonLink || "/products"}
                    className="inline-flex items-center gap-1.5 w-fit rounded-xl font-semibold text-sm px-4 py-2.5 transition-opacity"
                    style={{ backgroundColor: item.buttonBgColor || "#3090cf", color: item.buttonTextColor || "#ffffff" }}
                  >
                    {item.buttonText || "Shop Now"}
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </Link>
                )}
              </div>
              <div className="flex-shrink-0 w-full md:w-2/5 lg:w-[45%] order-1 md:order-2 flex items-center justify-center overflow-hidden">
                <img src={item.imageUrl || item.img} alt="" className="h-32 md:h-full w-full object-cover object-center md:max-h-[220px] lg:max-h-[260px]" />
              </div>
              </div>
            </ScrollReveal>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i + visibleSlides)}
            className={`rounded-full transition-all ${i === activeDot ? "bg-[#3090cf] w-2 h-2" : "bg-slate-300 w-2 h-2"}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HomeCustomSlider;
