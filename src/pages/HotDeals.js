import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Heart, ShoppingCart, Zap, Star } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import StarRating from '../components/StarRating';
import '../styles/pages/HotDeals.css';

const SITE_COLOR = '#3090cf';
const HOT_DEAL_COLOR = '#e9aa42';
const STAR_GOLD = '#f5c542';

/* Dummy countdown: ends 7 days from first render */
function getDefaultEndTime() {
  const end = new Date();
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

function CountdownClock({ endTime }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, endTime - now);
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return (
    <div className="hot-deals-countdown">
      <div className="hot-deals-countdown__unit">
        <span className="hot-deals-countdown__value">{String(timeLeft.days).padStart(2, '0')}</span>
        <span className="hot-deals-countdown__label">Days</span>
      </div>
      <span className="hot-deals-countdown__sep">:</span>
      <div className="hot-deals-countdown__unit">
        <span className="hot-deals-countdown__value">{String(timeLeft.hours).padStart(2, '0')}</span>
        <span className="hot-deals-countdown__label">Hours</span>
      </div>
      <span className="hot-deals-countdown__sep">:</span>
      <div className="hot-deals-countdown__unit">
        <span className="hot-deals-countdown__value">{String(timeLeft.minutes).padStart(2, '0')}</span>
        <span className="hot-deals-countdown__label">Min</span>
      </div>
      <span className="hot-deals-countdown__sep">:</span>
      <div className="hot-deals-countdown__unit">
        <span className="hot-deals-countdown__value">{String(timeLeft.seconds).padStart(2, '0')}</span>
        <span className="hot-deals-countdown__label">Sec</span>
      </div>
    </div>
  );
}

export default function HotDeals() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [endTime] = useState(getDefaultEndTime);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [categories, setCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [priceMin, priceMax, categoryFilter, sortBy, inStockOnly]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await api.get('/user/products', { params: { limit: 200 } });
        const list = res?.data || res?.products || [];
        const arr = Array.isArray(list) ? list : [];

        const withDiscountPct = arr.map((p) => {
          const price = p.hasDeal ? p.finalPrice : p.price;
          const orig = p.originalPrice ?? p.compareAtPrice;
          let pct = 0;
          if (p.dealId?.dealType === 'PERCENT' && p.dealId?.discountValue != null) {
            pct = Number(p.dealId.discountValue);
          } else if (orig != null && orig > 0 && price < orig) {
            pct = Math.round((1 - price / orig) * 100);
          }
          return { ...p, _discountPct: pct };
        });

        setProducts(withDiscountPct);
      } catch (err) {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, success } = await api.get('/user/getCategories');
        if (success && Array.isArray(data) && data.length > 0) {
          const names = data.map((cat) => (cat && (cat.name || cat))).filter(Boolean);
          setCategories([...new Set(names)].sort());
        }
      } catch (err) {
        // fallback: will be filled from products when they load
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (categories.length === 0 && products.length > 0) {
      const fromProducts = [...new Set(products.map((p) => p.category || p.categoryName).filter(Boolean))].sort();
      setCategories(fromProducts);
    }
  }, [products, categories.length]);

  const minPriceNum = priceMin !== '' ? parseFloat(priceMin) : null;
  const maxPriceNum = priceMax !== '' ? parseFloat(priceMax) : null;
  const hasValidMin = minPriceNum != null && !Number.isNaN(minPriceNum) && minPriceNum >= 0;
  const hasValidMax = maxPriceNum != null && !Number.isNaN(maxPriceNum) && maxPriceNum >= 0;

  const filteredProducts = products
    .filter((p) => {
      const price = p.hasDeal ? p.finalPrice : p.price;
      const numPrice = parseFloat(price);
      const hasValidPrice = !Number.isNaN(numPrice) && numPrice >= 0;

      if (hasValidMin || hasValidMax) {
        if (!hasValidPrice) return false;
        if (hasValidMin && numPrice < minPriceNum) return false;
        if (hasValidMax && numPrice > maxPriceNum) return false;
      }
      if (categoryFilter && (String(p.category || p.categoryName || '').trim() !== String(categoryFilter).trim())) return false;
      if (inStockOnly && (p.inStock === false || String(p.inStock).toLowerCase() === 'false')) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') {
        const pa = a.hasDeal ? a.finalPrice : a.price;
        const pb = b.hasDeal ? b.finalPrice : b.price;
        const na = parseFloat(pa);
        const nb = parseFloat(pb);
        return (Number.isNaN(na) ? 0 : na) - (Number.isNaN(nb) ? 0 : nb);
      }
      if (sortBy === 'price-desc') {
        const pa = a.hasDeal ? a.finalPrice : a.price;
        const pb = b.hasDeal ? b.finalPrice : b.price;
        const na = parseFloat(pa);
        const nb = parseFloat(pb);
        return (Number.isNaN(nb) ? 0 : nb) - (Number.isNaN(na) ? 0 : na);
      }
      if (sortBy === 'newest') {
        const da = new Date(a.createdAt || a.addedAt || a.created_at || 0).getTime();
        const db = new Date(b.createdAt || b.addedAt || b.created_at || 0).getTime();
        return db - da;
      }
      if (sortBy === 'discount') {
        return (b._discountPct || 0) - (a._discountPct || 0);
      }
      return 0;
    });

  const trendingProducts = products
    .slice()
    .sort((a, b) => (Number(b.orderCount ?? b.timesOrdered ?? b.salesCount ?? 0) || 0) - (Number(a.orderCount ?? a.timesOrdered ?? a.salesCount ?? 0) || 0))
    .slice(0, 5);

  const perPage = isMobileView ? 6 : 12;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const pageIndex = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedProducts = filteredProducts.slice((pageIndex - 1) * perPage, pageIndex * perPage);

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login first to add items to cart');
      setTimeout(() => navigate('/login'), 500);
      return;
    }
    try {
      const result = addToCart(product, 1);
      if (result?.success !== false) toast.success('Added to cart');
      else toast.error(result?.message || 'Failed to add');
    } catch {
      toast.error('Failed to add to cart');
    }
  };

  return (
    <div className="hot-deals-page min-h-screen bg-[#f8fafc]">
      {/* Top banner – simple */}
      <section className="hot-deals-banner">
        <div className="hot-deals-banner__inner">
          <div className="hot-deals-banner__content">
            <Zap size={40} className="hot-deals-banner__icon" aria-hidden />
            <div>
              <h1 className="hot-deals-banner__title">Hot Deals</h1>
              <p className="hot-deals-banner__subtitle">Limited time – biggest discounts end soon</p>
            </div>
          </div>
          <CountdownClock endTime={endTime} />
        </div>
      </section>

      {/* Main content: sidebar + products */}
      <div className="hot-deals-layout">
        {/* Left: Filters + Trending Now */}
        <aside className="hot-deals-sidebar">
          <div className="hot-deals-filter">
            <h3 className="hot-deals-filter__title">Filters</h3>
            <div className="hot-deals-filter__accent" style={{ backgroundColor: SITE_COLOR }} />
            <div className="hot-deals-filter__group">
              <label className="hot-deals-filter__label">Price</label>
              <div className="hot-deals-filter__price-row">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="hot-deals-filter__input"
                />
                <span className="hot-deals-filter__price-sep">–</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="hot-deals-filter__input"
                />
              </div>
            </div>
            <div className="hot-deals-filter__group">
              <label className="hot-deals-filter__label">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="hot-deals-filter__select"
              >
                <option value="">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="hot-deals-filter__group">
              <label className="hot-deals-filter__label">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="hot-deals-filter__select"
              >
                <option value="default">Default</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest</option>
                <option value="discount">Biggest discount</option>
              </select>
            </div>
            <div className="hot-deals-filter__group hot-deals-filter__group--checkbox">
              <label className="hot-deals-filter__checkbox-label">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="hot-deals-filter__checkbox"
                />
                <span>In stock only</span>
              </label>
            </div>
          </div>
          <div className="hot-deals-trending">
            <h2 className="hot-deals-trending__title">Trending Now</h2>
            <div className="hot-deals-trending__accent" style={{ backgroundColor: SITE_COLOR }} />
            <ul className="hot-deals-trending__list">
              {trendingProducts.length === 0 && !loading ? (
                <li className="hot-deals-trending__empty">No trending products yet.</li>
              ) : (
                trendingProducts.map((product) => {
                  const pid = product._id || product.id;
                  const price = product.hasDeal ? product.finalPrice : product.price;
                  const orig = product.originalPrice ?? product.compareAtPrice;
                  const reviewCount = product.reviews?.length ?? product.reviewCount ?? 0;
                  const avgRating = reviewCount
                    ? Math.round((product.reviews || []).reduce((a, r) => a + (r.rating || 0), 0) / (product.reviews?.length || 1))
                    : product.rating ?? 0;
                  return (
                    <li key={pid} className="hot-deals-trending__item">
                      <Link to={`/products/${pid}`} className="hot-deals-trending__link">
                        <span className="hot-deals-trending__img-wrap">
                          <img src={product.image} alt="" className="hot-deals-trending__img" />
                        </span>
                        <span className="hot-deals-trending__info">
                          <span className="hot-deals-trending__name">{product.name}</span>
                          {avgRating > 0 && (
                            <span className="hot-deals-trending__stars">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={12}
                                  fill="currentColor"
                                  className={s <= avgRating ? 'hot-deals-trending__star--on' : 'hot-deals-trending__star--off'}
                                  style={s <= avgRating ? { color: STAR_GOLD } : {}}
                                />
                              ))}
                            </span>
                          )}
                          <span className="hot-deals-trending__prices">
                            {orig != null && orig > price && (
                              <span className="hot-deals-trending__old">${Number(orig).toFixed(2)}</span>
                            )}
                            <span className="hot-deals-trending__price" style={{ color: SITE_COLOR }}>
                              ${Number(price).toFixed(2)}
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </aside>

        {/* Right: Products grid */}
        <section className="hot-deals-products">
          <div className="hot-deals-products__inner">
          <h2 className="hot-deals-products__heading">All products</h2>
          {loading ? (
            <div className="hot-deals-products__loading">
              <div className="hot-deals-products__spinner" />
              <p>Loading products…</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="hot-deals-products__empty">
              <p>No products match your filters.</p>
              <Link to="/products" className="hot-deals-products__link">Browse all products</Link>
            </div>
          ) : (
            <>
            <div className="hot-deals-products__grid">
              {paginatedProducts.map((product) => {
                const productId = product._id || product.id;
                const price = product.hasDeal ? product.finalPrice : product.price;
                const discountPct = product._discountPct ?? 0;
                const inStock = product.inStock !== false;
                const reviewCount = product.reviews?.length ?? product.reviewCount ?? 0;
                const avgRating = reviewCount
                  ? (product.reviews || []).reduce((a, r) => a + (Number(r?.rating) || 0), 0) / (product.reviews?.length || 1)
                  : (product.rating ?? 0);
                const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
                const isNewlyAdded = (() => {
                  const date = product.createdAt || product.addedAt || product.created_at;
                  if (!date) return false;
                  return new Date(date).getTime() >= Date.now() - FIFTEEN_DAYS_MS;
                })();
                const orderCount = Number(product.orderCount ?? product.timesOrdered ?? product.salesCount ?? 0) || 0;
                const isHot = orderCount > 5;
                const rightBadge = isHot ? 'hot' : isNewlyAdded ? 'new' : 'sale';

                return (
                  <ScrollReveal key={productId}>
                    <div className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-300/80 transition-all duration-300 flex flex-col overflow-hidden">
                      {/* Top-left discount */}
                      {discountPct > 0 && (
                        <span
                          className="absolute top-0 left-0 z-20 text-white text-xs font-bold pl-3 pr-4 py-1.5 min-w-[3rem] text-center rounded-tl-none rounded-bl-none rounded-tr-none rounded-br-xl shadow-sm"
                          style={{ backgroundColor: HOT_DEAL_COLOR, color: '#fff' }}
                        >
                          {discountPct}%
                        </span>
                      )}

                      {/* Top-right badge */}
                      {rightBadge && (
                        <div className="absolute top-0 right-0 z-20 pointer-events-none flex flex-col items-end gap-1">
                          <span
                            className="inline-block text-[11px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-tr-xl rounded-br-none rounded-bl-xl rounded-tl-none text-white shadow-sm"
                            style={{ backgroundColor: SITE_COLOR }}
                          >
                            {rightBadge === 'hot' ? 'Hot' : rightBadge === 'new' ? 'New' : 'Sale'}
                          </span>
                        </div>
                      )}

                      <Link to={`/products/${productId}`} className="relative block aspect-square overflow-hidden bg-slate-100">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {!inStock && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                            <span className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                              Out of stock
                            </span>
                          </div>
                        )}
                      </Link>

                      <div className="p-3 sm:p-4 flex flex-col flex-grow">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                          {product.category}
                        </span>

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link to={`/products/${productId}`} className="min-w-0 flex-1">
                            <h3 className="text-slate-800 font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-[#3090cf] transition-colors">
                              {product.name}
                            </h3>
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product); }}
                            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-[#3090cf]/50 transition-all -mt-1"
                            aria-label={isInWishlist(productId) ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            <Heart
                              size={20}
                              style={isInWishlist(productId) ? { color: SITE_COLOR } : {}}
                              fill={isInWishlist(productId) ? 'currentColor' : 'none'}
                              strokeWidth={2}
                            />
                          </button>
                        </div>

                        <StarRating rating={avgRating} count={reviewCount} className="mb-2" />

                        <p className="text-xs text-slate-500 mb-3">{product.unit || 'piece'}</p>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-auto">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-xl font-bold" style={{ color: SITE_COLOR }}>
                              ${price?.toFixed(2)}
                            </span>
                            {product.originalPrice != null && (
                              <span className="text-sm text-slate-400 line-through">
                                ${product.originalPrice?.toFixed(2)}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleAddToCart(e, product)}
                            disabled={!inStock}
                            className="min-h-[40px] px-4 rounded-lg text-white text-sm font-semibold transition-colors active:scale-[0.98] inline-flex items-center justify-center gap-1.5 disabled:bg-slate-200 disabled:text-slate-400 touch-manipulation w-full sm:w-auto whitespace-nowrap"
                            style={{ backgroundColor: inStock ? SITE_COLOR : undefined }}
                          >
                            <ShoppingCart size={18} strokeWidth={2.5} />
                            Add to cart
                          </button>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
            {totalPages > 1 && (
              <nav className="hot-deals-pagination" aria-label="Hot deals pagination">
                <button
                  type="button"
                  className="hot-deals-pagination__btn"
                  disabled={pageIndex <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="hot-deals-pagination__info">
                  Page {pageIndex} of {totalPages}
                </span>
                <button
                  type="button"
                  className="hot-deals-pagination__btn"
                  disabled={pageIndex >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  Next
                </button>
              </nav>
            )}
            </>
          )}
          </div>
        </section>
      </div>
    </div>
  );
}
