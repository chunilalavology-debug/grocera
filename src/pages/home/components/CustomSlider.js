import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// local images
import slide1 from "../../../assets-copy/home/slide1.png";
import slide3 from "../../../assets-copy/home/slide3.png";
import slide4 from "../../../assets-copy/home/slide4.png";
import slide5 from "../../../assets-copy/home/slide5.png";

const CARD_BG = ["bg-amber-50", "bg-slate-100", "bg-emerald-50", "bg-sky-50"];

function HomeCustomSlider() {
  const sliderSlides = [
    { img: slide1, title: "Everyday Fresh & Clean with Our Products", bg: CARD_BG[0] },
    { img: slide3, title: "The best Organic Products Online", bg: CARD_BG[1] },
    { img: slide4, title: "Fresh Groceries Delivered to Your Door", bg: CARD_BG[2] },
    { img: slide5, title: "Quality Ingredients for Every Kitchen", bg: CARD_BG[3] },
  ];

  return (
    <div className="bg-slate-50">
      <section className="bg-white py-7 md:py-12 border-y border-slate-100">
        <div className="container mx-auto">
          <CustomSlider slides={sliderSlides} />
        </div>
      </section>
    </div>
  );
}

/* =======================
   SLIDER COMPONENT
======================= */
const CustomSlider = ({ slides }) => {
  const [index, setIndex] = useState(0);
  const [visibleSlides, setVisibleSlides] = useState(1);
  const [enableTransition, setEnableTransition] = useState(true);

  /* ---------- RESPONSIVE ---------- */
  useEffect(() => {
    const updateSlides = () => {
      if (window.innerWidth >= 1024) setVisibleSlides(3);
      else if (window.innerWidth >= 768) setVisibleSlides(2);
      else setVisibleSlides(1);
    };

    updateSlides();
    window.addEventListener("resize", updateSlides);
    return () => window.removeEventListener("resize", updateSlides);
  }, []);

  /* ---------- CLONES ---------- */
  const sliderSlides = [
    ...slides.slice(-visibleSlides),
    ...slides,
    ...slides.slice(0, visibleSlides),
  ];

  /* ---------- INITIAL INDEX ---------- */
  useEffect(() => {
    setEnableTransition(false);
    setIndex(visibleSlides);
    requestAnimationFrame(() => setEnableTransition(true));
  }, [visibleSlides]);

  /* ---------- AUTOPLAY ---------- */
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => prev + 1);
    }, 3000);

    return () => clearInterval(timer);
  }, [visibleSlides]);

  /* ---------- INVISIBLE RESET ---------- */
  const handleTransitionEnd = () => {
    if (index >= slides.length + visibleSlides) {
      setEnableTransition(false);
      setIndex(visibleSlides);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEnableTransition(true);
        });
      });
    }
  };

  const activeDot =
    (index - visibleSlides + slides.length) % slides.length;

  return (
    <div className="relative overflow-hidden pb-10 w-full">
      <div
        onTransitionEnd={handleTransitionEnd}
        className={`flex min-w-full ${enableTransition
          ? "transition-transform duration-700 ease-in-out"
          : ""
          }`}
        style={{
          transform: `translateX(-${index * (100 / visibleSlides)}%)`,
        }}
      >
        {sliderSlides.map((item, i) => (
          <div
            key={i}
            className="px-3 sm:px-4 flex-shrink-0"
            style={{ width: `${100 / visibleSlides}%` }}
          >
            <div
              className={`overflow-hidden rounded-3xl shadow-lg ring-1 ring-slate-100 flex flex-col md:flex-row min-h-[180px] md:h-[220px] lg:h-[260px] ${item.bg || "bg-white"}`}
            >
              <div className="flex flex-1 flex-col justify-center p-5 md:p-6 lg:p-8 order-2 md:order-1">
                <h3 className="text-slate-800 font-bold text-base sm:text-lg lg:text-xl leading-tight mb-3 md:mb-4">
                  {item.title}
                </h3>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1.5 w-fit rounded-xl bg-[#3090cf] hover:bg-[#2680b8] text-white font-semibold text-sm px-4 py-2.5 transition-colors"
                >
                  Shop Now
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Link>
              </div>
              <div className="flex-shrink-0 w-full md:w-2/5 lg:w-[45%] order-1 md:order-2 flex items-center justify-center overflow-hidden">
                <img
                  src={item.img}
                  alt=""
                  className="h-32 md:h-full w-full object-cover object-center md:max-h-[220px] lg:max-h-[260px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- DOTS ---------- */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i + visibleSlides)}
            className={`rounded-full transition-all ${i === activeDot
              ? "bg-[#3090cf] w-2 h-2"
              : "bg-slate-300 w-2 h-2"
              }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HomeCustomSlider;
