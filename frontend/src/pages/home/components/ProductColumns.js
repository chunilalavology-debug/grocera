import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHomePageDataOptional } from '../../../context/HomePageDataContext';
import api from '../../../services/api';
import { Star } from 'lucide-react';
import ScrollReveal from '../../../components/ScrollReveal';

const SITE_COLOR = '#3090cf';

const COLUMNS = [
  { id: 'topSelling', title: 'Top Selling' },
  { id: 'trending', title: 'Trending Products' },
  { id: 'recentlyAdded', title: 'Recently added' },
  { id: 'topRated', title: 'Top Rated' },
];

function ProductColumns() {
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
        setProducts(homeData.homeProducts);
        setLoading(false);
        return;
      }
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await api.get('/user/products', { params: { limit: 12 } });
        const list = res?.data || res?.products || [];
        const arr = Array.isArray(list) ? list : [];
        setProducts(arr);
      } catch (err) {
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

  // Split products into four columns: by index and by sort logic
  const getColumnProducts = () => {
    if (products.length === 0)
      return { topSelling: [], trending: [], recentlyAdded: [], topRated: [] };

    const byDate = [...products].sort((a, b) => {
      const da = new Date(a.createdAt || a.addedAt || a.created_at || 0).getTime();
      const db = new Date(b.createdAt || b.addedAt || b.created_at || 0).getTime();
      return db - da;
    });
    const byRating = [...products].sort((a, b) => {
      const ra = (a.reviewCount ?? a.rating ?? 0) + (a.reviews?.length ?? 0);
      const rb = (b.reviewCount ?? b.rating ?? 0) + (b.reviews?.length ?? 0);
      return rb - ra;
    });

    const perColumn = 3;
    return {
      topSelling: products.slice(0, perColumn),
      trending: products.slice(perColumn, perColumn * 2),
      recentlyAdded: byDate.slice(0, perColumn),
      topRated: byRating.slice(0, perColumn),
    };
  };

  const columns = getColumnProducts();

  const ProductRow = ({ product }) => {
    const pid = product._id || product.id;
    const price = product.hasDeal ? product.finalPrice : product.price;
    const reviewCount = product.reviews?.length ?? product.reviewCount ?? 0;
    const avgRating = reviewCount
      ? Math.round(
          (product.reviews || []).reduce((a, r) => a + (r.rating || 0), 0) / (product.reviews?.length || 1)
        )
      : product.rating ?? 0;

    return (
      <Link
        to={`/products/${pid}`}
        className="flex gap-3 py-3 border-b border-slate-100 last:border-b-0 group"
      >
        <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-100">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-[#3090cf] transition-colors leading-snug">
            {product.name}
          </h4>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={12}
                  fill="currentColor"
                  className={s <= avgRating ? '' : 'text-slate-200'}
                  style={s <= avgRating ? { color: '#f5c542' } : {}}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">({reviewCount})</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm font-bold" style={{ color: SITE_COLOR }}>
              ${price?.toFixed(2)}
            </span>
            {product.hasDeal && product.originalPrice != null && (
              <span className="text-xs text-slate-400 line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14 bg-white border-t border-slate-100">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {COLUMNS.map((col) => (
              <div key={col.id} className="animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-32 mb-3" />
                <div className="h-1 bg-slate-100 rounded w-16 mb-4" />
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3 py-3 border-b border-slate-100">
                    <div className="w-16 h-16 rounded-xl bg-slate-200" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-full mb-2" />
                      <div className="h-3 bg-slate-100 rounded w-2/3 mb-2" />
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const hasAny = Object.values(columns).some((arr) => arr.length > 0);
  if (!hasAny) return null;

  return (
    <section className="py-10 md:py-14 bg-white border-t border-slate-100">
      <div className="container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {COLUMNS.map((col) => (
            <div key={col.id} className="border-b border-slate-100 pb-6 last:border-b-0 last:pb-0 lg:border-b-0 lg:pb-0 lg:border-r lg:border-slate-100 lg:pr-6 lg:last:border-r-0 lg:last:pr-0">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{col.title}</h3>
              <div
                className="h-0.5 w-10 rounded-full mb-4"
                style={{ backgroundColor: SITE_COLOR }}
              />
              <div className="space-y-0">
                {(columns[col.id] || []).map((product) => (
                  <ScrollReveal key={product._id || product.id}>
                    <ProductRow product={product} />
                  </ScrollReveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ProductColumns;
