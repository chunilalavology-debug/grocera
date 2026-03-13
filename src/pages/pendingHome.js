import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import banner from "../assets-copy/banner/banner.webp";
import ricedaily from "../assets-copy/indian/ricedaily.webp";
import masalaspicy from "../assets-copy/indian/masalaspicy.webp";
import poojaitems from "../assets-copy/indian/poojaitems.webp";
import vegetables from "../assets-copy/indian/vegetables.webp";
import god from "../assets-copy/indian/god.webp";
import fruits from "../assets-copy/indian/fruits.webp";
import soses from "../assets-copy/american/soses.webp";
import snacks from "../assets-copy/american/snaks.webp";
import breakfast from "../assets-copy/american/breakfast.webp";
import deal from "../assets-copy/deals/deal.webp";
import chinaOil3 from "../assets-copy/chinese/chinaOil3.webp";
import chinaSnaks3 from "../assets-copy/chinese/chinaSnaks3.webp";
import noodles3 from "../assets-copy/chinese/noodles3.webp";
import natchiyar from "../assets-copy/natchiyar/natchiyar.webp";
import coldPressed from "../assets-copy/sliderImg/coldPressed.webp";
import nuts from "../assets-copy/sliderImg/nuts.webp";
import spices from "../assets-copy/sliderImg/2.webp";
import coffe from "../assets-copy/turkish/coffe.webp";
import breads from "../assets-copy/turkish/breads.webp";
import sweetDesert from "../assets-copy/turkish/sweetDesert.webp";

function PendingHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const allImages = [
      banner, ricedaily, masalaspicy, poojaitems, vegetables, god, fruits,
      soses, snacks, breakfast, deal, chinaOil3, chinaSnaks3, noodles3,
      natchiyar, coldPressed, nuts, spices, coffe, breads, sweetDesert
    ];

    const cacheImages = async (srcArray) => {
      const promises = srcArray.map((src) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = reject;
        });
      });
      try {
        await Promise.all(promises);
      } finally {
        setTimeout(() => setLoading(false), 200);
      }
    };

    
    cacheImages(allImages);
  }, []);


  // Reusable Section Header Component
  const SectionHeader = ({ title, sub }) => (
    <div className="mb-8 px-4 text-center">
      <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl tracking-tight">{title}</h2>
      <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-green-500"></div>
      <p className="mt-4 text-sm text-slate-500 md:text-base max-w-md mx-auto">{sub}</p>
    </div>
  );

  const categories = [
    {
      title: "American Category",
      bannerImg: deal,
      items: [
        { img: breakfast, name: 'Breakfast & Cereals', brand: 'fresho!' },
        { img: snacks, name: 'Snacks & Sweets', brand: 'fresho!' },
        { img: soses, name: 'Sauces & Canned', brand: 'fresho!' }
      ]
    },
    {
      title: "Chinese Category",
      bannerImg: natchiyar,
      items: [
        { img: noodles3, name: 'Noodles' },
        { img: chinaSnaks3, name: 'Snacks & Teas' },
        { img: chinaOil3, name: 'Sauces & Condiments' }
      ]
    },
    {
      title: "Turkish Category",
      items: [
        { img: sweetDesert, name: 'Sweets & Desserts' },
        { img: coffe, name: 'Coffee & Drinks' },
        { img: breads, name: 'Breads & Staples' }
      ]
    }
  ];

  return (
    <div className="home-only isolate bg-slate-50">
      <div className="w-full bg-slate-50 font-sans antialiased">

        {/* Hero Banner */}
        <section className="w-full bg-slate-200">
          <img src={banner} alt="Hero" className="w-full h-auto min-h-[250px] object-cover" />
        </section>

        {/* Indian Category Grid */}
        <section className="py-12 md:py-20">
          <div className="container">
            <SectionHeader title="Indian Category" sub="Authentic flavors from the heart of India" />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { img: ricedaily, name: 'Daily Essentials' },
                { img: masalaspicy, name: 'Spices & Masalas' },
                { img: vegetables, name: 'Fresh Vegetables' },
                { img: poojaitems, name: 'Pooja Items' },
                { img: fruits, name: 'Fresh Fruits' },
                { img: god, name: 'God Idols' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate('/products', { state: item.name })}
                  className="group cursor-pointer rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:shadow-xl hover:ring-green-500 transition-all duration-300"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-slate-50">
                    <img src={item.img} alt={item.name} className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <p className="mt-3 text-center text-sm font-bold text-slate-700">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      

        <section className="bg-white py-12 border-y border-slate-100">
          <div className="container">
            <CustomSlider images={[spices, nuts, coldPressed, spices]} />
          </div>
        </section>


        {/* Dynamic International Categories */}
        {categories.map((section, idx) => (
          <div key={idx}>
            <section className="py-16 md:py-24 ">
              <div className="container">
                <SectionHeader title={section.title} sub="Premium quality global imports" />
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => navigate('/products', { state: item.name })}
                      className="group cursor-pointer overflow-hidden rounded-[2rem] bg-white shadow-md transition-all hover:-translate-y-2 hover:shadow-2xl ring-1 ring-slate-100"
                    >

                      <div className="relative h-64 overflow-hidden md:h-80">
                        <img src={item.img} alt={item.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      </div>
                      <div className="p-8 text-center">
                        {item.brand && (
                          <span className="inline-block px-3 py-1 mb-2 text-[10px] font-bold uppercase tracking-widest text-white bg-green-500 rounded-full">
                            {item.brand}
                          </span>
                        )}
                        <h3 className="text-xl font-extrabold text-slate-800">{item.name}</h3>
                        <p className="mt-4 inline-flex items-center text-sm font-bold text-green-600">
                          Explore Collection
                          <span className="ml-2 transition-transform group-hover:translate-x-2">→</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {section.bannerImg && (
              <div className="w-full border-y border-slate-100">
                <img src={section.bannerImg} alt="Promo" className="h-auto w-full object-cover" />
              </div>
            )}
          </div>
        ))}

        {/* Simple Footer Spacer */}
        <div className="h-20" />
      </div>
    </div>
  );
}
const CustomSlider = ({ images }) => {
 const [index, setIndex] = useState(0);
  const [visibleSlides, setVisibleSlides] = useState(1);
  const [enableTransition, setEnableTransition] = useState(true);

  // Responsive visible slides
  useEffect(() => {
    const updateSlides = () => {
      if (window.innerWidth >= 1024) {
        setVisibleSlides(3);
      } else if (window.innerWidth >= 768) {
        setVisibleSlides(2);
      } else {
        setVisibleSlides(1);
      }
    };

    updateSlides();
    window.addEventListener("resize", updateSlides);
    return () => window.removeEventListener("resize", updateSlides);
  }, []);

  // Clone slides for infinite effect
  const sliderImages = [...images, ...images.slice(0, visibleSlides)];

  // Auto slide
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => prev + 1);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  // Reset without animation (important)
  useEffect(() => {
    if (index === images.length) {
      setTimeout(() => {
        setEnableTransition(false);
        setIndex(0);
      }, 700);
    } else {
      setEnableTransition(true);
    }
  }, [index, images.length]);


  return (
    <div className="relative overflow-hidden">
      {/* Slides */}
      {/* <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {images.map((img, i) => (
          <div key={i} className="min-w-full px-3">
            <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-slate-100">
              <img
                src={img}
                alt="Promo"
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          </div>
        ))}
      </div> */}


      <div
        className={`flex ${enableTransition
            ? "transition-transform duration-700 ease-in-out"
            : ""
          }`}
        style={{
          transform: `translateX(-${(index * 100) / visibleSlides}%)`,
        }}
      >
        {sliderImages.map((img, i) => (
          <div
            key={i}
            className="px-3 w-full md:w-1/2 lg:w-1/3 flex-shrink-0"
          >
            <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-slate-100 h-[180px] md:h-[220px] lg:h-[260px]">
              <img
                src={img}
                alt="Promo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>


      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-2.5 w-2.5 rounded-full transition-all ${i === index ? "bg-green-500 w-6" : "bg-slate-300"
              }`}
          />
        ))}
      </div>
    </div>
  );
};


export default pendingHome;