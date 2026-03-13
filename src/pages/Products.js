import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useRef, useCallback } from "react";
// import '../styles/pages/Products.css';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Heart } from 'lucide-react';
import { MAIN_CATEGORIES, getSubcategories, getMainForCategory } from '../config/categories';

const NON_SUBSCRIPTION_CATEGORIES = [
  "spices",
  "masala",
  "rice",
  "grains",
  "lentils",
  "pulses",
  "snacks",
  "sweets",
  "frozen",
  "pooja",
  "idol",
];
const weightOptions = [1, 2, 3, 5];

function Products() {
  const observer = useRef();
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialLoad = useRef(true);
  const navigate = useNavigate();
  const { state } = useLocation();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [selectedMain, setSelectedMain] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [apiCategories, setApiCategories] = useState(['All']);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [totalData, setTotalData] = useState(0);
  const resultsTopRef = useRef(null);

  const isSubscribableProduct = (product) => {
    if (!product?.category) return false;
    const category = product.category.toLowerCase();
    return !NON_SUBSCRIPTION_CATEGORIES.some((c) =>
      category.includes(c)
    );
  };

  const searchKeyword = searchParams.get("search");
  const categoryFromUrl = searchParams.get("category");
  const mainFromUrl = searchParams.get("main");

  useEffect(() => {
    if (searchKeyword) setSearchTerm(searchKeyword);
  }, [searchKeyword]);

  useEffect(() => {
    if (state !== null) {
      setSelectedCategory(state);
      setSelectedMain(getMainForCategory(state));
    }
  }, [state]);

  useEffect(() => {
    if (mainFromUrl && MAIN_CATEGORIES.some((m) => m.id === mainFromUrl)) {
      setSelectedMain(mainFromUrl);
    }
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
      if (!mainFromUrl) setSelectedMain(getMainForCategory(categoryFromUrl));
    }
  }, [categoryFromUrl, mainFromUrl]);

  const [productQuantities, setProductQuantities] = useState({});
  const [productWeights, setProductWeights] = useState({});

  const handleQuantityChange = (productId, change) => {
    setProductQuantities(prev => {
      const currentQty = prev[productId] || 1;
      const newQty = Math.max(1, currentQty + change);
      const product = products.find(p => (p._id || p.id) === productId);
      const maxQty = product?.quantity || product?.stockQuantity || 999;
      return {
        ...prev,
        [productId]: Math.min(newQty, maxQty)
      };
    });
  };

  const handleQuantityInputChange = (productId, value) => {
    const numValue = parseInt(value) || 1;
    const product = products.find(p => (p._id || p.id) === productId);
    const maxQty = product?.quantity || product?.stockQuantity || 999;
    setProductQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, Math.min(numValue, maxQty))
    }));
  };

  const isVegetable = (category) => {
    return category?.toLowerCase().includes('vegetable') ||
      category === 'Fresh Vegetables' ||
      category === 'Vegetables';
  };

  const handleWeightSelect = (productId, weight) => {
    setProductWeights(prev => ({
      ...prev,
      [productId]: weight
    }));
  };

  const handleAddToCart = (e, product) => {
    if (e) e.preventDefault();

    const productId = product._id || product.id;
    const isVeg = isVegetable(product.category);

    if (isVeg) {
      const weight = productWeights[productId] || 1;
      const productWithWeight = { ...product, selectedWeight: weight, displayName: `${product.name} (${weight} lb)` };
      const result = addToCart(productWithWeight, 1);
      if (!result.success) {
        toast.error(result.message || "Could not add to cart");
        return;
      }
      navigate('/cart');
    } else {
      const quantity = productQuantities[productId] || 1;
      const result = addToCart(product, quantity);
      if (!result.success) {
        toast.error(result.message || "Could not add to cart");
        return;
      }
      navigate('/cart');
    }
  };

  const loadProductsData = async (isLoadMore = false) => {
    try {
      setLoading(true);

      const response = await api.get("/user/products", {
        params: {
          category: selectedCategory !== "All" ? selectedCategory : undefined,
          ...(debouncedSearch && {
            search: debouncedSearch
          }),
          limit: 12,
          cursor: isLoadMore ? cursor : undefined
        }
      });

      if (!response?.success) return;

      const productsArray = response.data || [];

      setProducts(prev => {
        const existingIds = new Set(prev.map(p => p._id));
        const filtered = productsArray.filter(p => !existingIds.has(p._id));
        return isLoadMore ? [...prev, ...filtered] : productsArray;
      });
      if (!isLoadMore && response.totalCount !== null) {
        setTotalData(response.totalCount);
      }
      setCursor(response.nextCursor || null);
      setHasMore(response.hasNextPage);

      if (!isLoadMore) {
        isInitialLoad.current = false;
      }

    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const lastProductRef = useCallback(
    (node) => {
      if (loading || !hasMore) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          loadProductsData(true);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore, cursor]
  );


  useEffect(() => {
    setProducts([]);
    setCursor(null);
    setHasMore(true);
    isInitialLoad.current = true;
    loadProductsData(false);
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);


  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const { data, success } = await api.get("/user/getCategories");
      if (success && Array.isArray(data)) {
        setApiCategories(["All", ...data.map((cat) => cat.name)]);
      }
    } catch (error) {
      console.error("Category fetch error:", error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const updateUrlFromFilters = (main, category) => {
    const next = new URLSearchParams(searchParams);
    if (main && main !== 'all') next.set('main', main);
    else next.delete('main');
    if (category && category !== 'All') next.set('category', category);
    else next.delete('category');
    setSearchParams(next, { replace: true });
  };

  const handleMainSelect = (mainId) => {
    setSelectedMain(mainId);
    if (mainId === 'all') {
      setSelectedCategory('All');
      updateUrlFromFilters('all', 'All');
    } else {
      const subs = getSubcategories(mainId);
      const currentInMain = subs.some((s) => s.value === selectedCategory);
      if (!currentInMain && subs.length) {
        setSelectedCategory(subs[0].value);
        updateUrlFromFilters(mainId, subs[0].value);
      } else {
        updateUrlFromFilters(mainId, selectedCategory);
      }
    }
  };

  const handleSubSelect = (categoryValue) => {
    setSelectedCategory(categoryValue);
    updateUrlFromFilters(selectedMain, categoryValue);
  };

  const subcategories = getSubcategories(selectedMain);

  useEffect(() => {
    if (resultsTopRef.current) {
      resultsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedCategory, selectedMain]);

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden animate-fadeIn">

      {/* Header Section */}
      <div className="py-12 text-center border-b-2 border-blue-50/50 bg-white shadow-sm mb-4">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
            Premium Grocery Store
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            Fresh ingredients delivered from our trusted suppliers directly to your doorstep.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Filter – responsive bar, larger text, touch-friendly */}
        <div className="products-filter-sticky sticky top-[100px] sm:top-[110px] md:top-[120px] z-20 mb-6 -mt-6 overflow-visible">
          <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm relative z-10 overflow-visible">
            <div className="max-w-5xl mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-5">
              {/* Search + main categories – stack on small, row on larger */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="relative flex-1 min-w-0 w-full">
                  <span className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none select-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 sm:pl-11 pr-4 py-3 sm:py-3.5 text-sm sm:text-base bg-slate-50 border border-slate-200 rounded-xl text-gray-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all min-h-[44px]"
                  />
                </div>
                {/* Main categories – segment control, scroll on small screens */}
                <div className="flex items-stretch gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto overflow-y-hidden no-scrollbar min-h-[44px] sm:min-h-0 sm:w-fit">
                  {MAIN_CATEGORIES.map((main) => (
                    <button
                      key={main.id}
                      type="button"
                      className={`flex-shrink-0 px-4 sm:px-5 py-2.5 sm:py-2 rounded-lg text-sm sm:text-base font-semibold whitespace-nowrap transition-all duration-200 min-h-[40px] flex items-center justify-center ${selectedMain === main.id
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                        }`}
                      onClick={() => handleMainSelect(main.id)}
                    >
                      {main.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategories – wrap + scroll on very small; larger tap targets */}
              {selectedMain && selectedMain !== 'all' && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar animate-fadeIn">
                  <button
                    type="button"
                    className={`px-4 py-2.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors min-h-[44px] sm:min-h-[40px] flex items-center justify-center ${selectedCategory === 'All'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    onClick={() => handleSubSelect('All')}
                  >
                    All
                  </button>
                  {subcategories.map((sub) => (
                    <button
                      key={sub.value}
                      type="button"
                      className={`px-4 py-2.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors min-h-[44px] sm:min-h-[40px] flex items-center justify-center flex-shrink-0 ${selectedCategory === sub.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      onClick={() => handleSubSelect(sub.value)}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results anchor for scroll-to-top */}
        <div ref={resultsTopRef} className="scroll-mt-4" />

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          {[
            { label: 'Products Available', value: totalData, icon: '📦' },
            { label: 'Delivery Time', value: '4-24h', icon: '⚡' },
            { label: 'Daily Stock', value: 'Fresh', icon: '🌿' }
          ].map((stat, i) => (
            <div key={i} className="group bg-white p-6 rounded-3xl border-2 border-blue-50/50 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 text-center">
              <span className="block text-3xl font-black text-blue-600 mb-1 group-hover:scale-110 transition-transform">{stat.value}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Main Content */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-[28px] p-5 border-2 border-slate-50 animate-pulse">
                <div className="bg-slate-200 h-52 rounded-2xl mb-4"></div>
                <div className="h-4 bg-slate-200 rounded-full w-2/3 mb-2"></div>
                <div className="h-3 bg-slate-100 rounded-full w-1/2 mb-6"></div>
                <div className="flex justify-between items-center"><div className="h-6 bg-slate-200 rounded w-16"></div><div className="h-10 bg-slate-100 rounded-xl w-24"></div></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-7xl mb-6 opacity-30">⏳</div>
            <h3 className="text-2xl font-bold text-gray-800">New Collection Arriving Soon</h3>
            <p className="text-gray-500 mt-2">Try switching categories or check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {products.map((product, index) => {
              const productId = product._id || product.id;
              const isLast = index === products.length - 1;
              const qty = productQuantities[productId] || 1;
              const price = product.hasDeal ? product.finalPrice : product.price;
              return (
                <div
                  key={productId}
                  ref={isLast ? lastProductRef : null}
                  className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-300/80 transition-all duration-300 flex flex-col overflow-hidden"
                >
                  <Link to={`/products/${productId}`} className="relative block aspect-square overflow-hidden bg-slate-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {isSubscribableProduct(product) && (
                      <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-sm">
                        Subscribe
                      </span>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <span className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-full">Out of stock</span>
                      </div>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); toggleWishlist(product); }}
                    className="absolute top-2 right-2 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 shadow-sm border border-slate-200/80 text-[#3090cf] hover:bg-white hover:shadow-md transition-all"
                    aria-label={isInWishlist(productId) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart
                      size={20}
                      className={isInWishlist(productId) ? 'text-[#3090cf]' : ''}
                      fill={isInWishlist(productId) ? 'currentColor' : 'none'}
                      strokeWidth={2}
                    />
                  </button>

                  <div className="p-4 flex flex-col flex-grow">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{product.category}</span>
                    <h3 className="text-slate-800 font-semibold text-[15px] leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">{product.unit || 'piece'}</p>

                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-xl font-bold text-slate-900">${price.toFixed(2)}</span>
                      {product.hasDeal && (
                        <span className="text-sm text-slate-400 line-through">${product.originalPrice.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="mt-auto flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/80 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleQuantityChange(productId, -1); }}
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors font-medium"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-slate-700 tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleQuantityChange(productId, 1); }}
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors font-medium"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={!product.inStock}
                        className="flex-1 min-w-0 py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading More Spinner */}
        {loading && products.length > 0 && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Benefits Footer Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-20">
          {[
            { icon: '🚚', title: 'Fast Delivery', desc: 'Same-day express delivery across NYC' },
            { icon: '🌿', title: 'Fresh Quality', desc: 'Daily fresh stock, premium ingredients' },
            { icon: '🇮🇳', title: 'Authentic', desc: 'Directly sourced from trusted suppliers' },
            { icon: '💰', title: 'Best Prices', desc: 'Competitive pricing on all products' }
          ].map((benefit, i) => (
            <div key={i} className="group bg-white p-8 rounded-[32px] border-2 border-blue-50 hover:border-blue-400 hover:shadow-2xl transition-all duration-500 text-center">
              <div className="text-4xl mb-4 group-hover:scale-125 transition-transform duration-500 inline-block drop-shadow-md">{benefit.icon}</div>
              <h4 className="font-black text-gray-800 text-lg mb-2">{benefit.title}</h4>
              <p className="text-gray-500 text-sm leading-relaxed">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  // return (
  //   <div className="container products-container">
  //     <Toaster position="top-center" reverseOrder={false} />
  //     <div className="products-header">

  //       <div className="products-filters">
  //         <div className="search-section">
  //           <div className="search-wrapper">
  //             <i className="search-icon">🔍</i>
  //             <input
  //               type="text"
  //               placeholder="Search for spices, vegetables, rice..."
  //               value={searchTerm}
  //               onChange={(e) => setSearchTerm(e.target.value)}
  //               className="search-input"
  //             />
  //           </div>
  //         </div>

  //         <div className="category-filters">
  //           {categories.map(category => (
  //             <button
  //               key={category}
  //               className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
  //               onClick={() => setSelectedCategory(category)}
  //             >
  //               {category}
  //             </button>
  //           ))}
  //         </div>
  //       </div>
  //     </div>

  //     <div className="products-content">
  //       <div className="products-stats">
  //         <div className="products-stat-item">
  //           <span className="products-stat-number">{totalData}</span>
  //           <span className="products-stat-label">Products Available</span>
  //         </div>
  //         <div className="products-stat-item">
  //           <span className="products-stat-number">4-24h</span>
  //           <span className="products-stat-label">Delivery Time</span>
  //         </div>
  //         <div className="products-stat-item">
  //           <span className="products-stat-number">Fresh</span>
  //           <span className="products-stat-label">Daily Stock</span>
  //         </div>
  //       </div>

  //       {loading ? (
  //         <div className="container mx-auto px-4 py-8">
  //           {/* Loading Header Message */}
  //           <div className="flex flex-col items-center justify-center mb-10 animate-pulse">
  //             <div className="h-8 w-64 bg-gray-200 rounded-full mb-2"></div>
  //             <p className="text-gray-400 font-medium">Fetching fresh groceries for you...</p>
  //           </div>

  //           {/* Skeleton Grid */}
  //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
  //             {[...Array(8)].map((_, i) => (
  //               <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm animate-pulse">
  //                 {/* Image Skeleton */}
  //                 <div className="bg-gray-200 h-48 w-full rounded-xl mb-4"></div>

  //                 {/* Title Skeleton */}
  //                 <div className="h-5 bg-gray-200 rounded-full w-3/4 mb-3"></div>

  //                 {/* Category Skeleton */}
  //                 <div className="h-4 bg-gray-100 rounded-full w-1/2 mb-4"></div>

  //                 {/* Price & Button Skeleton */}
  //                 <div className="flex justify-between items-center mt-6">
  //                   <div className="h-6 bg-gray-200 rounded-full w-20"></div>
  //                   <div className="h-9 bg-green-100 rounded-lg w-24"></div>
  //                 </div>
  //               </div>
  //             ))}
  //           </div>
  //         </div>
  //       ) : (
  //         <>
  //           {products.length === 0 ? (
  //             <div className="no-products">
  //               <div className="no-products-icon">⏳</div>
  //               <h3>New Collection Arriving Soon</h3>
  //               <p>We're currently stocking up on new arrivals. Stay tuned or try browsing another category!</p>
  //             </div>
  //           ) : (
  //             <div className="products-grid">
  //               {products.map((product, index) => {
  //                 const isLastProduct = index === products.length - 1;
  //                 const productId = product._id || product.id;

  //                 return (
  //                   <div
  //                     key={productId}
  //                     ref={isLastProduct ? lastProductRef : null}
  //                     className="product-card product-ca"
  //                   >
  //                     <Link to={`/products/${productId}`} className="product-link">
  //                       <div className="product-image px-3">
  //                         <img
  //                           src={product.image}
  //                           alt={product.name}
  //                           loading="lazy"
  //                           width="300"
  //                           height="200"
  //                           style={{ objectFit: "cover" }}
  //                         />
  //                         {isSubscribableProduct(product) && (
  //                           <div
  //                             style={{
  //                               position: 'absolute',
  //                               top: '10px',
  //                               left: '10px',
  //                               backgroundColor: '#10b981',
  //                               color: '#fff',
  //                               padding: '4px 8px',
  //                               fontSize: '0.65rem',
  //                               fontWeight: 'bold',
  //                               borderRadius: '6px'
  //                             }}
  //                           >
  //                             Subscription Available
  //                           </div>
  //                         )}

  //                         {!product.inStock && <div className="out-of-stock-badge">Out of Stock</div>}
  //                       </div>

  //                       <div className="product-info">
  //                         <h3 className="product-name">{product.name}</h3>

  //                         {/* UNIT DISPLAY: Name ke niche unit dikhane ke liye */}
  //                         <p className="product-unit-text" style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>
  //                           Unit: {product.unit || 'piece'}
  //                         </p>

  //                         <p className="product-category">{product.category}</p>
  //                         {/* <p className="product-description">{product.description}</p> */}

  //                         {/* Price Section */}
  //                         <div className="product-footer">
  //                           {product.hasDeal ? (
  //                             <>
  //                               <span className="product-price">${product.finalPrice.toFixed(2)}</span>
  //                               <span className="product-price-original" style={{ textDecoration: 'line-through', marginLeft: '0.5rem', opacity: 0.6 }}>
  //                                 ${product.originalPrice.toFixed(2)}
  //                               </span>
  //                             </>
  //                           ) : (
  //                             <span className="product-price">${product.price.toFixed(2)}</span>
  //                           )}
  //                         </div>
  //                       </div>
  //                     </Link>

  //                     {/* Quantity Selector - Sabhi products ke liye ek jaisa */}
  //                     <div className="product-cart-controls" onClick={(e) => e.stopPropagation()}>
  //                       <div className="quantity-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>

  //                         <div className="quantity-selector-small">
  //                           <button
  //                             className="qty-btn-small"
  //                             onClick={(e) => {
  //                               e.preventDefault();
  //                               handleQuantityChange(productId, -1);
  //                             }}
  //                           >
  //                             −
  //                           </button>
  //                           <input
  //                             type="number"
  //                             className="qty-input-small"
  //                             value={productQuantities[productId] || 1}
  //                             onChange={(e) => handleQuantityInputChange(productId, e.target.value)}
  //                           />
  //                           <button
  //                             className="qty-btn-small"
  //                             onClick={(e) => {
  //                               e.preventDefault();
  //                               handleQuantityChange(productId, 1);
  //                             }}
  //                           >
  //                             +
  //                           </button>
  //                         </div>

  //                         {/* Button ke andar unit show karna */}
  //                         <button
  //                           className="btn btn-primary btn-sm"
  //                           onClick={(e) => handleAddToCart(e, product)}
  //                           disabled={!product.inStock}
  //                           style={{ width: '100%' }}
  //                         >
  //                           Add {productQuantities[productId] || 1} {product.unit || 'pc'}
  //                         </button>
  //                       </div>
  //                     </div>
  //                   </div>
  //                 );
  //               })}
  //             </div>

  //           )}

  //         </>
  //       )}


  //       {loading && products.length > 0 && (
  //         <div style={{ textAlign: "center", padding: "1.5rem", color: "#999" }}>
  //           Loading more products...
  //         </div>
  //       )}
  //     </div>



  //     <div className="products-benefits">
  //       <div className="benefit-card">
  //         <div className="benefit-icon">🚚</div>
  //         <h4>Fast Delivery</h4>
  //         <p>Same-day express delivery across NYC, Queens & Long Island</p>
  //       </div>
  //       <div className="benefit-card">
  //         <div className="benefit-icon">🌿</div>
  //         <h4>Fresh Quality</h4>
  //         <p>Daily fresh stock, premium ingredients</p>
  //       </div>
  //       <div className="benefit-card">
  //         <div className="benefit-icon">🇮🇳</div>
  //         <h4>Authentic</h4>
  //         <p>Directly sourced from trusted suppliers</p>
  //       </div>
  //       <div className="benefit-card">
  //         <div className="benefit-icon">💰</div>
  //         <h4>Best Prices</h4>
  //         <p>Competitive pricing on all premium products</p>
  //       </div>
  //     </div>
  //   </div>
  // );
}

export default Products;