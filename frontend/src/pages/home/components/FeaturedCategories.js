import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MAIN_CATEGORIES } from '../../../config/categories';
import { getApiBaseUrl } from '../../../config/apiBase';
import api from '../../../services/api';
import ScrollReveal from '../../../components/ScrollReveal';
import { featuredCategoriesListFromResponse } from '../../../utils/featuredCategoriesResponse';
import { mapPool } from '../../../utils/mapPool';

function getProductImageUrl(product) {
  if (!product) return null;
  const imageOrigin =
    getApiBaseUrl().replace(/\/api\/?$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const raw =
    product.image || (Array.isArray(product.images) && product.images[0]) || product.imageUrl || null;
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return imageOrigin + raw;
  return imageOrigin + '/' + raw.replace(/^\//, '');
}

function resolveCategoryImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const imageOrigin =
    getApiBaseUrl().replace(/\/api\/?$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  if (raw.startsWith('/')) return imageOrigin + raw;
  return imageOrigin + '/' + raw.replace(/^\//, '');
}

const BROKEN_IMAGE_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280"><rect fill="#e2e8f0" width="400" height="280" rx="12"/></svg>'
  );

function categoryRowIsActiveForFeatured(r) {
  if (!r || !r.name) return false;
  if (r.isDeleted === true || r.isDeleted === 1) return false;
  if (String(r.isDeleted).toLowerCase() === 'true') return false;
  if (r.isDisable === true || r.isDisable === 1) return false;
  if (String(r.isDisable).toLowerCase() === 'true') return false;
  if (r.isActive === false || r.isActive === 0) return false;
  if (typeof r.isActive === 'string' && ['false', '0', 'no', ''].includes(String(r.isActive).trim().toLowerCase())) {
    return false;
  }
  return true;
}

function parseTotalFromProductsResponse(res) {
  if (!res || typeof res !== 'object') return null;
  const all = Number(res.totalCountAll);
  if (Number.isFinite(all)) return Math.max(0, Math.floor(all));
  const instock = Number(res.totalCount);
  if (Number.isFinite(instock)) return Math.max(0, Math.floor(instock));
  return null;
}

const FEATURED_FETCH_ATTEMPTS = 2;
const FEATURED_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function FeaturedCategories() {
  const mains = MAIN_CATEGORIES.filter((m) => m.id !== 'all');
  const [activeMain, setActiveMain] = useState(mains[0]?.id || 'indian');
  const [apiRows, setApiRows] = useState([]);
  /** True when the last request cycle ended in failure (no user-facing error copy; avoids “empty admin” false positives). */
  const [featuredFetchFailed, setFeaturedFetchFailed] = useState(false);
  const [featuredCatalogReady, setFeaturedCatalogReady] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('Featured Categories');
  /** `${main}:${value}` → real thumb URL + SKU count from Mongo via /user/products */
  const [categoryOverlay, setCategoryOverlay] = useState({});
  const scrollRef = useRef(null);

  const baseDisplayList = useMemo(() => {
    if (!featuredCatalogReady || featuredFetchFailed) return [];
    return apiRows
      .filter((r) => r && r.name && categoryRowIsActiveForFeatured(r))
      .map((r) => {
        const n = Number(r.count);
        const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        const cardLabel = (r.displayTitle && String(r.displayTitle).trim()) || r.name;
        return {
          cardLabel,
          value: r.value || r.name,
          count,
          featuredImage: r.image ? resolveCategoryImageUrl(r.image) : null,
          _source: 'api',
        };
      });
  }, [featuredCatalogReady, apiRows, featuredFetchFailed]);

  const rowsToShow = useMemo(() => {
    return baseDisplayList.map((item) => {
      const key = `${activeMain}:${item.value}`;
      const o = categoryOverlay[key];
      const thumb = item.featuredImage || (o?.thumb ? resolveCategoryImageUrl(o.thumb) : null);
      const count = o && typeof o.total === 'number' ? o.total : item.count;
      return {
        ...item,
        featuredImage: thumb,
        count,
      };
    });
  }, [baseDisplayList, activeMain, categoryOverlay]);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setFeaturedCatalogReady(false);
    setFeaturedFetchFailed(false);
    setCategoryOverlay({});
    (async () => {
      let succeeded = false;
      for (let attempt = 0; attempt < FEATURED_FETCH_ATTEMPTS && alive && !controller.signal.aborted; attempt++) {
        if (attempt > 0) {
          await sleep(FEATURED_RETRY_DELAY_MS);
          if (!alive || controller.signal.aborted) return;
        }
        try {
          const res = await api.get('/user/featured-categories', {
            params: { main: activeMain, _: Date.now() + attempt },
            signal: controller.signal,
            timeout: 90_000,
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          });
          if (!alive) return;
          if (res && res.success === false) {
            setApiRows([]);
            continue;
          }
          const rows = featuredCategoriesListFromResponse(res);
          if (rows === null) {
            setApiRows([]);
            continue;
          }
          setApiRows(rows);
          setFeaturedFetchFailed(false);
          const t = typeof res.sectionTitle === 'string' ? res.sectionTitle.trim() : '';
          setSectionTitle(t || 'Featured Categories');
          succeeded = true;
          break;
        } catch (e) {
          if (!alive || controller.signal.aborted) return;
          const aborted = e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';
          if (aborted) return;
          setApiRows([]);
        }
      }
      if (alive && !controller.signal.aborted) {
        if (!succeeded) {
          setApiRows([]);
          setFeaturedFetchFailed(true);
        }
        setFeaturedCatalogReady(true);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [activeMain]);

  /**
   * One /user/products call per visible category: real totalCountAll from Mongo + first product image.
   * Replaces any demo counts and fills missing thumbnails.
   */
  useEffect(() => {
    if (!featuredCatalogReady) return undefined;
    if (baseDisplayList.length === 0) return undefined;

    const controller = new AbortController();
    let alive = true;
    (async () => {
      /** Max 4 concurrent /user/products calls so cold Vercel + browser limits don’t stall the page */
      const results = await mapPool(4, baseDisplayList, async (item) => {
        try {
          const res = await api.get('/user/products', {
            params: { category: item.value, main: activeMain, limit: 24 },
            signal: controller.signal,
          });
          const list = Array.isArray(res?.data) ? res.data : [];
          const p = list.find((x) => getProductImageUrl(x)) || list[0];
          const url = getProductImageUrl(p);
          const total = parseTotalFromProductsResponse(res);
          return { value: item.value, thumb: url || null, total: total !== null ? total : 0 };
        } catch {
          return { value: item.value, thumb: null, total: 0 };
        }
      });
      if (!alive) return;
      setCategoryOverlay((prev) => {
        const next = { ...prev };
        results.forEach(({ value, thumb, total }) => {
          const key = `${activeMain}:${value}`;
          next[key] = { thumb: thumb || undefined, total };
        });
        return next;
      });
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [featuredCatalogReady, baseDisplayList, activeMain]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const card = el.querySelector('[data-featured-card]');
    const step = card ? card.offsetWidth + 16 : 280;
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  return (
    <section className="featured-categories featured-categories--v2 bg-[#f4f6f8] pt-10 pb-12 md:pt-14 md:pb-16">
      <div className="container max-w-7xl mx-auto px-4 sm:px-5 md:px-6">
        <div className="featured-categories__header flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-y-3 mb-2">
          <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:gap-4">
            <h2 className="featured-categories__title text-[1.35rem] sm:text-2xl md:text-[1.75rem] font-extrabold text-slate-900 tracking-tight m-0">
              {sectionTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Region">
              {mains.map((main) => (
                <button
                  key={main.id}
                  type="button"
                  role="tab"
                  aria-selected={activeMain === main.id}
                  onClick={() => setActiveMain(main.id)}
                  className={`featured-categories__tab rounded-full px-4 py-2.5 text-sm font-semibold transition-all border ${
                    activeMain === main.id
                      ? 'bg-[#3090cf] text-white border-[#3090cf] shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {main.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:justify-start shrink-0">
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label="Scroll categories left"
              className="featured-categories__nav flex h-11 w-11 items-center justify-center rounded-full bg-[#3090cf] text-white shadow-sm transition-colors hover:bg-[#2680b8] border-0"
            >
              <ChevronLeft size={22} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label="Scroll categories right"
              className="featured-categories__nav flex h-11 w-11 items-center justify-center rounded-full bg-[#3090cf] text-white shadow-sm transition-colors hover:bg-[#2680b8] border-0"
            >
              <ChevronRight size={22} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {featuredCatalogReady && !featuredFetchFailed && rowsToShow.length === 0 ? (
          <p className="text-center text-slate-600 py-10 px-4 rounded-2xl bg-white/80 border border-slate-200/80">
            No homepage categories for this region yet. Add categories in the admin and assign a parent region, or enable &quot;Show on
            homepage featured categories&quot; on each category.{' '}
            <Link to="/admin/categories" className="font-semibold text-[#3090cf] hover:underline">
              Manage categories
            </Link>
          </p>
        ) : null}

        <div className="featured-categories__viewport -mx-1 sm:mx-0">
          <div
            ref={scrollRef}
            className="featured-categories__scroll flex gap-4 overflow-x-auto scroll-smooth pb-2 pt-3"
          >
            {rowsToShow.map((sub) => (
              <ScrollReveal
                key={`${activeMain}-${sub.value}`}
                className="featured-categories__card-wrap flex-shrink-0 snap-start"
              >
                <Link
                  data-featured-card
                  to={`/products?category=${encodeURIComponent(sub.value)}&main=${activeMain}`}
                  className="featured-categories__card group flex flex-col w-[min(200px,calc(100vw-3.5rem))] sm:w-[200px] bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.12)] hover:shadow-[0_8px_24px_-6px_rgba(48,144,207,0.25)] hover:border-[#3090cf]/40 transition-all duration-300"
                >
                  <div className="featured-categories__card-media relative h-[132px] sm:h-[140px] w-full bg-slate-100 overflow-hidden">
                    {sub.featuredImage ? (
                      <img
                        src={sub.featuredImage}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = BROKEN_IMAGE_FALLBACK;
                        }}
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400 px-3 text-center">
                        No image
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center px-3 py-3.5 sm:py-4 text-center border-t border-slate-100/80">
                    <h3 className="featured-categories__card-title font-extrabold text-slate-900 text-[0.9375rem] sm:text-base leading-snug line-clamp-2 group-hover:text-[#3090cf] transition-colors">
                      {sub.cardLabel}
                    </h3>
                    <span className="mt-1.5 text-sm font-medium text-slate-500 tabular-nums">
                      {sub.count} {sub.count === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
