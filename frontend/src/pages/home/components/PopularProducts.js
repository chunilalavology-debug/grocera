import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';
import { useHomePageDataOptional } from '../../../context/HomePageDataContext';
import api from '../../../services/api';
// eslint-disable-next-line no-unused-vars -- in scope when local catch still references getApiBaseUrl()
import { getApiBaseUrl } from '../../../config/apiBase';
import toast from 'react-hot-toast';
import { Heart, ShoppingCart } from 'lucide-react';
import ScrollReveal from '../../../components/ScrollReveal';
import StarRating from '../../../components/StarRating';

const SITE_COLOR = '#3090cf';

function PopularProducts() {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const homeData = useHomePageDataOptional();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (homeData) {
      if (homeData.homeProductsLoading) {
        setLoading(true);
        return;
      }
      if (homeData.homeProducts?.length) {
        setProducts(homeData.homeProducts.slice(0, 10));
        setLoading(false);
        return;
      }
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await api.get('/user/products', { params: { limit: 10 } });
        const list = res?.data || res?.products || [];
        setProducts(Array.isArray(list) ? list.slice(0, 10) : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [
    homeData,
    homeData?.homeProducts,
    homeData?.homeProductsLoading,
  ]);

  const isVegetable = (p) =>
    p?.category?.toLowerCase().includes('vegetable') ||
    p?.category === 'Fresh Vegetables' ||
    p?.category === 'Vegetables';

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    const weight = 1;
    const itemToAdd = isVegetable(product)
      ? { ...product, selectedWeight: weight, displayName: `${product.name} (${weight} lb)` }
      : product;
    try {
      const result = addToCart(itemToAdd, 1);
      if (result?.success !== false) {
        toast.success('Added to cart');
      } else {
        toast.error(result?.message || 'Failed to add');
      }
    } catch {
      toast.error('Failed to add to cart');
    }
  };

  if (loading && products.length === 0) {
    return (
      <section className="py-10 md:py-14 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-48 bg-slate-200 rounded-lg mb-8 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
                <div className="aspect-square bg-slate-200 rounded-xl mb-4" />
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/2 mb-4" />
                <div className="flex gap-2">
                  <div className="h-10 flex-1 bg-slate-100 rounded-xl" />
                  <div className="h-10 w-20 bg-slate-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-slate-50/50">
      <div className="container">
        <div className="mb-6 md:mb-8">
          <h2 className="font-extrabold text-2xl md:text-3xl text-slate-900 tracking-tight">
            Popular Products
          </h2>
          <div className="mt-2 h-1 w-16 rounded-full opacity-90" style={{ backgroundColor: SITE_COLOR }} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
          {products.map((product, index) => {
            const productId = product._id || product.id;
            const price = product.hasDeal ? product.finalPrice : product.price;
            const DISCOUNT_BADGE_PCT = 5;
            const inStock = product.inStock !== false;
            const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
            const isNewlyAdded = (() => {
              const date = product.createdAt || product.addedAt || product.created_at;
              if (!date) return false;
              return new Date(date).getTime() >= Date.now() - FIFTEEN_DAYS_MS;
            })();
            const orderCount = Number(product.orderCount ?? product.timesOrdered ?? product.salesCount ?? 0) || 0;
            const isHot = orderCount > 5;
            const rightBadge = !inStock ? null : isHot ? 'hot' : isNewlyAdded ? 'new' : 'sale';
            const reviewCount = product.reviews?.length ?? product.reviewCount ?? 0;
            const avgRating = reviewCount
              ? (product.reviews || []).reduce((a, r) => a + (Number(r?.rating) || 0), 0) / (product.reviews?.length || 1)
              : (product.rating ?? 0);

            return (
              <ScrollReveal key={productId}>
              <div
                className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-300/80 transition-all duration-300 flex flex-col overflow-hidden"
              >
                <span
                  className="product-card__discount-tag absolute top-0 left-0 z-20 text-white text-xs font-bold pl-3 pr-4 py-1.5 min-w-[3rem] text-center rounded-tl-none rounded-bl-none rounded-tr-none rounded-br-xl shadow-sm"
                  style={{ backgroundColor: '#e9aa42', color: '#fff' }}
                >
                  {DISCOUNT_BADGE_PCT}%
                </span>
                {rightBadge && (
                  <div className="absolute top-0 right-0 z-20 pointer-events-none flex flex-col items-end gap-1">
                    <span
                      className="product-card__sale-tag inline-block text-[11px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-tr-xl rounded-br-none rounded-bl-xl rounded-tl-none text-white shadow-sm"
                      style={{ backgroundColor: SITE_COLOR }}
                    >
                      {rightBadge === 'hot' ? 'Hot' : rightBadge === 'new' ? 'New' : 'Sale'}
                    </span>
                  </div>
                )}
                <Link
                  to={`/products/${productId}`}
                  className="relative block aspect-square overflow-hidden bg-slate-100"
                >
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(product);
                      }}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-[#3090cf]/50 transition-all -mt-1"
                      aria-label={isInWishlist(productId) ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <Heart
                        size={20}
                        className={isInWishlist(productId) ? '' : ''}
                        style={isInWishlist(productId) ? { color: SITE_COLOR } : {}}
                        fill={isInWishlist(productId) ? 'currentColor' : 'none'}
                        strokeWidth={2}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{product.unit || 'piece'}</p>
                  <StarRating rating={avgRating} count={reviewCount} className="mb-2" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-xl font-bold" style={{ color: SITE_COLOR }}>
                        ${price?.toFixed(2)}
                      </span>
                      {product.hasDeal && (
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
                      Add
                    </button>
                  </div>
                </div>
              </div>
              </ScrollReveal>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl font-semibold text-white transition-colors hover:opacity-90 touch-manipulation"
            style={{ backgroundColor: SITE_COLOR }}
          >
            View all products
          </Link>
        </div>
      </div>
    </section>
  );
}

export default PopularProducts;
