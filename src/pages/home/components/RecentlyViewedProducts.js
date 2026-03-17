import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import ScrollReveal from '../../../components/ScrollReveal';

const SITE_COLOR = '#3090cf';
const STORAGE_KEY = 'recentlyViewedProducts';
const MAX_RECENT = 10;

function RecentlyViewedProducts() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      setProducts(Array.isArray(list) ? list.slice(0, MAX_RECENT) : []);
    } catch {
      setProducts([]);
    }
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-slate-50/50">
      <div className="container">
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 sm:p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">
            Recently Viewed Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
            {products.map((product) => {
              const pid = product._id || product.id;
              const price = product.hasDeal ? product.finalPrice : product.price;
              const reviewCount = product.reviews?.length ?? product.reviewCount ?? 0;
              const avgRating = reviewCount
                ? Math.round(
                    (product.reviews || []).reduce((a, r) => a + (r.rating || 0), 0) /
                      (product.reviews?.length || 1)
                  )
                : product.rating ?? 0;

              return (
                <ScrollReveal key={pid}>
                <Link
                  to={`/products/${pid}`}
                  className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-[#3090cf]/40 hover:shadow-sm transition-all group min-h-[44px]"
                >
                  <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-[#3090cf] transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={14}
                            fill="currentColor"
                            className={s <= avgRating ? '' : 'text-slate-200'}
                            style={s <= avgRating ? { color: '#f5c542' } : {}}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">({reviewCount})</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-base font-bold" style={{ color: SITE_COLOR }}>
                        ${price != null ? Number(price).toFixed(2) : '0.00'}
                      </span>
                      {product.hasDeal && product.originalPrice != null && (
                        <span className="text-sm text-slate-400 line-through">
                          ${Number(product.originalPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default RecentlyViewedProducts;

export function saveRecentlyViewedProduct(product) {
  if (!product || !(product._id || product.id)) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const id = product._id || product.id;
    const entry = {
      _id: product._id,
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      originalPrice: product.originalPrice,
      hasDeal: product.hasDeal,
      finalPrice: product.finalPrice,
      reviews: product.reviews,
      reviewCount: product.reviewCount,
      rating: product.rating,
    };
    const filtered = list.filter((p) => (p._id || p.id) !== id);
    const next = [entry, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    // ignore
  }
}
