import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MAIN_CATEGORIES, SUBCATEGORIES_BY_MAIN } from '../../../config/categories';
import api from '../../../services/api';
import { getApiBaseUrl, getApiOrigin } from '../../../config/apiBase';

const API_BASE = getApiBaseUrl();
const IMAGE_ORIGIN = getApiOrigin() || (typeof window !== 'undefined' ? window.location.origin : '');

/** Stronger pastel backgrounds for card image area */
const CARD_BG_COLORS = [
  'bg-rose-200',
  'bg-emerald-200',
  'bg-amber-200',
  'bg-sky-200',
  'bg-violet-200',
  'bg-teal-200',
  'bg-orange-200',
  'bg-lime-200',
];

/** Resolve product image: support image, images[0], and relative paths */
function getProductImageUrl(product) {
  if (!product) return null;
  const raw = product.image || (Array.isArray(product.images) && product.images[0]) || product.imageUrl || null;
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return IMAGE_ORIGIN + raw;
  return raw;
}

/** Inline placeholder so it never 404s */
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="160" viewBox="0 0 200 160"%3E%3Crect fill="%23e2e8f0" width="200" height="160"/%3E%3Ctext fill="%2394a3b8" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="14"%3ENo image%3C/text%3E%3C/svg%3E';

export default function FeaturedCategories() {
  const mains = MAIN_CATEGORIES.filter((m) => m.id !== 'all');
  const [activeMain, setActiveMain] = useState(mains[0]?.id || 'indian');
  const [subcategoryImages, setSubcategoryImages] = useState({});
  const scrollRef = useRef(null);

  const subcategories = SUBCATEGORIES_BY_MAIN[activeMain] || [];

  // Fetch one product image per subcategory from API (category-related image)
  useEffect(() => {
    if (!subcategories.length) return;
    const controller = new AbortController();
    (async () => {
      const results = await Promise.all(
        subcategories.map(async (sub) => {
          try {
            const res = await api.get('/user/products', {
              params: { category: sub.value, main: activeMain, limit: 1 },
              signal: controller.signal,
            });
            const product = res?.data?.[0];
            const image = getProductImageUrl(product);
            return { value: sub.value, image };
          } catch {
            return { value: sub.value, image: null };
          }
        })
      );
      setSubcategoryImages((prev) => {
        const next = { ...prev };
        results.forEach(({ value, image }) => {
          const key = `${activeMain}:${value}`;
          if (image) next[key] = image;
        });
        return next;
      });
    })();
    return () => controller.abort();
  }, [activeMain]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = 280;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className="featured-categories pt-10 pb-12 md:pt-14 md:pb-16 bg-slate-50/50">
      <div className="container">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="featured-categories__title text-2xl md:text-3xl font-extrabold text-slate-900">
              Featured Categories
            </h2>
            <div className="flex items-center gap-2">
              {mains.map((main) => (
                <button
                  key={main.id}
                  type="button"
                  onClick={() => setActiveMain(main.id)}
                  className={`featured-categories__tab px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeMain === main.id
                      ? 'bg-[#3090cf] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {main.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              className="featured-categories__nav w-10 h-10 rounded-full bg-[#3090cf] text-white hover:bg-[#2680b8] border-0 flex items-center justify-center transition-colors shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              className="featured-categories__nav w-10 h-10 rounded-full bg-[#3090cf] text-white hover:bg-[#2680b8] border-0 flex items-center justify-center transition-colors shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="featured-categories__scroll flex gap-4 overflow-x-auto pt-2 pb-4 mt-2 scroll-smooth"
        >
          {subcategories.map((sub, idx) => (
            <Link
              key={sub.value}
              to={`/products?category=${encodeURIComponent(sub.value)}&main=${activeMain}`}
              className="featured-categories__card flex-shrink-0 w-[180px] sm:w-[200px] bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg hover:border-[#3090cf]/30 transition-all duration-300 group"
            >
              <div
                className={`h-32 sm:h-36 flex items-center justify-center overflow-hidden ${CARD_BG_COLORS[idx % CARD_BG_COLORS.length]}`}
              >
                <img
                  src={subcategoryImages[`${activeMain}:${sub.value}`] || PLACEHOLDER_IMAGE}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="featured-categories__card-title font-extrabold text-slate-900 text-base sm:text-[1.0625rem] leading-tight line-clamp-2 group-hover:text-[#3090cf] transition-colors">
                  {sub.name}
                </h3>
                <span className="inline-block mt-2 text-sm font-bold text-slate-600">
                  {typeof sub.count === 'number' ? `${sub.count} Items` : 'Browse'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
