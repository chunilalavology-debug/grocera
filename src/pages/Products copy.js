import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useRef, useCallback } from "react";
// import '../styles/pages/Products.css';
import api from '../services/api';
import toast, { Toaster } from 'react-hot-toast';

const categories = [
  'All',
  'Daily Essentials',
  'Spices & Masalas',
  'Fresh Vegetables',
  'Fresh Fruits',
  'Rice & Grains',
  'Lentils & Pulses',
  'Frozen Foods',
  'Beverages',
  'Snacks & Sweets',
  'Breakfast & Cereals',
  'Sauces & Canned',
  'Chinese Noodles',
  'Snacks & Teas',
  'Sauces & Condiments',
  'Turkish Desserts',
  'Coffee & Drinks',
  'Breads & Staples',
  'American Breakfast Fusions',
  'Pooja Items',
  'God Idols'
]
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
  const [searchParams] = useSearchParams();
  const isInitialLoad = useRef(true);
  const navigate = useNavigate();
  const { state } = useLocation();
  const { addToCart } = useCart();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [totalData, setTotalData] = useState(0);

  const isSubscribableProduct = (product) => {
    if (!product?.category) return false;
    const category = product.category.toLowerCase();
    return !NON_SUBSCRIPTION_CATEGORIES.some((c) =>
      category.includes(c)
    );
  };

  const searchKeyword = searchParams.get("search");
  useEffect(() => {
    if (searchKeyword) {
      setSearchTerm(searchKeyword);
    }
  }, [searchKeyword]);

  useEffect(() => {
    if (state !== null) {
      setSelectedCategory(state);
    }
  }, [state]);

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

      if (!result.success && result.requireLogin) {
        toast.error("Please login first to add items");
        setTimeout(() => {
          navigate("/login");
        }, 1000);
        return
      }
      toast.success(`${weight} lb of ${product.name} added!`);

    } else {
      const quantity = productQuantities[productId] || 1;
      const result = addToCart(product, quantity);

      if (!result.success && result.requireLogin) {
        toast.error("Please login first to add items");
        setTimeout(() => {
          navigate("/login");
        }, 1000);
        return
      }
      toast.success(`${quantity} x ${product.name} added to cart!`);
    }
  };

  const loadProductsData = async (currentPage = 1, isLoadMore = false) => {
    try {
      const response = await api.get(
        `/user/products`,
        {
          params: {
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            search: debouncedSearch || undefined,
            page: currentPage,
            limit: 12
          },
        }
      );

      if (!response?.success) return;

      const responseData = await response;

      const productsArray = Array.isArray(responseData.data)
        ? responseData.data
        : [];

      const hasMoreValue =
        typeof responseData.hasMore === "boolean"
          ? responseData.hasMore
          : responseData.pagination?.hasNextPage || false;

      setProducts((prev) => {
        if (!isLoadMore) return productsArray;

        const existingIds = new Set(prev.map(p => p._id || p.id));
        const filtered = productsArray.filter(p =>
          !existingIds.has(p._id || p.id)
        );

        return [...prev, ...filtered];
      });

      setTotalData(responseData.pagination?.totalCount)

      setHasMore(hasMoreValue);
      setPage(currentPage);

      if (currentPage === 1) {
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
      if (loading) return;

      if (isInitialLoad.current) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            loadProductsData(page + 1, true);
          }
        },
        { threshold: 0.3 }
      );

      if (node) observer.current.observe(node);
    },
    [loading, hasMore, page,]
  );


  useEffect(() => {
    setLoading(true);
    setPage(1);
    setProducts([]);
    setHasMore(true);
    loadProductsData(1, false);
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);


  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden animate-fadeIn">
      <Toaster position="top-center" reverseOrder={false} />

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
        {/* Filter Section */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl shadow-blue-900/5 border-2 border-blue-50 mb-10 -mt-8 relative z-10">
          <div className="flex flex-col gap-8">
            {/* Search Wrapper */}
            <div className="relative max-w-2xl mx-auto w-full group">
              <i className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-blue-500 group-focus-within:text-blue-600 transition-colors">🔍</i>
              <input
                type="text"
                placeholder="Search for spices, vegetables, rice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-full text-gray-800 font-medium focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap md:justify-center gap-3 overflow-x-auto pb-2 no-scrollbar">
              {categories.map(category => (
                <button
                  key={category}
                  className={`px-6 py-3 rounded-full text-sm font-bold tracking-wide transition-all duration-300 whitespace-nowrap border-2 ${selectedCategory === category
                    ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200 -translate-y-1'
                    : 'bg-white text-gray-600 border-slate-100 hover:border-blue-300 hover:text-blue-600 hover:-translate-y-0.5'
                    }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product, index) => {
              const productId = product._id || product.id;
              const isLast = index === products.length - 1;
              return (
                <div
                  key={productId}
                  ref={isLast ? lastProductRef : null}
                  className="group relative bg-white rounded-[28px] border-2 border-transparent hover:border-blue-400 shadow-md hover:shadow-2xl hover:shadow-blue-200 transition-all duration-500 flex flex-col overflow-hidden"
                >
                  {/* Top Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-blue-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 z-30"></div>

                  <Link to={`/products/${productId}`} className="relative block h-60 overflow-hidden bg-slate-50">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    {isSubscribableProduct(product) && (
                      <div className="absolute top-4 left-4 bg-green-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-lg z-10">
                        SUBSCRIPTION AVAILABLE
                      </div>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                        <span className="bg-gradient-to-br from-red-500 to-red-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-xl">OUT OF STOCK</span>
                      </div>
                    )}
                  </Link>

                  <div className="p-5 flex flex-col flex-grow">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{product.category}</span>
                    <h3 className="text-gray-800 font-bold text-lg leading-tight mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">{product.name}</h3>

                    <p className="text-[11px] font-bold text-green-600 mb-4 bg-green-50 inline-block px-2 py-0.5 rounded-md w-fit">
                      Unit: {product.unit || 'piece'}
                    </p>

                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-2xl font-black text-blue-600 leading-none">
                          ${(product.hasDeal ? product.finalPrice : product.price).toFixed(2)}
                        </span>
                        {product.hasDeal && (
                          <span className="text-xs text-gray-400 line-through mt-1">${product.originalPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    {/* Cart Controls Section */}
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-1.5 border border-slate-100">
                        <button
                          onClick={(e) => { e.preventDefault(); handleQuantityChange(productId, -1); }}
                          className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-sm hover:bg-blue-600 hover:text-white transition-all font-bold text-lg"
                        >−</button>
                        <input
                          type="number"
                          className="w-12 bg-transparent text-center font-black text-gray-700 outline-none"
                          value={productQuantities[productId] || 1}
                          readOnly
                        />
                        <button
                          onClick={(e) => { e.preventDefault(); handleQuantityChange(productId, 1); }}
                          className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-sm hover:bg-blue-600 hover:text-white transition-all font-bold text-lg"
                        >+</button>
                      </div>

                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={!product.inStock}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-slate-200 disabled:to-slate-300 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-100 active:scale-[0.97]"
                      >
                        Add {productQuantities[productId] || 1} {product.unit || 'pc'}
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