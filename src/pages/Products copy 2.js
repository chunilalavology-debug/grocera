import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useRef, useCallback } from "react";
import '../styles/pages/Products.css';
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
            limit: 10
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

      setProducts((prev) =>
        isLoadMore ? [...prev, ...productsArray] : productsArray
      );

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

      observer.current = new IntersectionObserver((entries) => {
        // if (entries[0].isIntersecting && hasMore) {
        //   loadProductsData(page + 1, true);
        // }

        if (entries[0].isIntersecting && hasMore && !loading) {
          loadProductsData(page + 1, true);
        }
      });

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
    <div className="container products-container">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="products-header">
        {/* <div className="header-content">
          <h1>Fresh Groceries</h1>
          <p>Discover authentic flavors, delivered fresh to your doorstep across NYC, Queens & Long Island</p>
          {isAdmin && (
            <div className="admin-controls">
              <Link to="/admin/products" className="btn btn-admin">
                📦 Manage Products
              </Link>
            </div>
          )}
        </div> */}

        <div className="products-filters">
          <div className="search-section">
            <div className="search-wrapper">
              <i className="search-icon">🔍</i>
              <input
                type="text"
                placeholder="Search for spices, vegetables, rice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="category-filters">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="products-content">
        <div className="products-stats">
          <div className="products-stat-item">
            <span className="products-stat-number">{totalData}</span>
            <span className="products-stat-label">Products Available</span>
          </div>
          <div className="products-stat-item">
            <span className="products-stat-number">4-24h</span>
            <span className="products-stat-label">Delivery Time</span>
          </div>
          <div className="products-stat-item">
            <span className="products-stat-number">Fresh</span>
            <span className="products-stat-label">Daily Stock</span>
          </div>
        </div>

        {loading ? (
          <div className="container mx-auto px-4 py-8">
            {/* Loading Header Message */}
            <div className="flex flex-col items-center justify-center mb-10 animate-pulse">
              <div className="h-8 w-64 bg-gray-200 rounded-full mb-2"></div>
              <p className="text-gray-400 font-medium">Fetching fresh groceries for you...</p>
            </div>

            {/* Skeleton Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm animate-pulse">
                  {/* Image Skeleton */}
                  <div className="bg-gray-200 h-48 w-full rounded-xl mb-4"></div>

                  {/* Title Skeleton */}
                  <div className="h-5 bg-gray-200 rounded-full w-3/4 mb-3"></div>

                  {/* Category Skeleton */}
                  <div className="h-4 bg-gray-100 rounded-full w-1/2 mb-4"></div>

                  {/* Price & Button Skeleton */}
                  <div className="flex justify-between items-center mt-6">
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                    <div className="h-9 bg-green-100 rounded-lg w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {products.length === 0 ? (
              <div className="no-products">
                <div className="no-products-icon">⏳</div>
                <h3>New Collection Arriving Soon</h3>
                <p>We're currently stocking up on new arrivals. Stay tuned or try browsing another category!</p>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product, index) => {
                  const isLastProduct = index === products.length - 1;
                  const productId = product._id || product.id;

                  return (
                    <div
                      key={productId}
                      ref={isLastProduct ? lastProductRef : null}
                      className="product-card product-ca"
                    >
                      <Link to={`/products/${productId}`} className="product-link">
                        <div className="product-image px-3">
                          <img
                            src={product.image || '/api/placeholder/300/200'}
                            alt={product.name}
                            loading="lazy"
                          />
                          {isSubscribableProduct(product) && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                padding: '4px 8px',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                borderRadius: '6px'
                              }}
                            >
                              Subscription Available
                            </div>
                          )}

                          {!product.inStock && <div className="out-of-stock-badge">Out of Stock</div>}
                        </div>

                        <div className="product-info">
                          <h3 className="product-name">{product.name}</h3>

                          {/* UNIT DISPLAY: Name ke niche unit dikhane ke liye */}
                          <p className="product-unit-text" style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>
                            Unit: {product.unit || 'piece'}
                          </p>

                          <p className="product-category">{product.category}</p>
                          <p className="product-description">{product.description}</p>

                          {/* Price Section */}
                          <div className="product-footer">
                            {product.hasDeal ? (
                              <>
                                <span className="product-price">${product.finalPrice.toFixed(2)}</span>
                                <span className="product-price-original" style={{ textDecoration: 'line-through', marginLeft: '0.5rem', opacity: 0.6 }}>
                                  ${product.originalPrice.toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="product-price">${product.price.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Quantity Selector - Sabhi products ke liye ek jaisa */}
                      <div className="product-cart-controls" onClick={(e) => e.stopPropagation()}>
                        <div className="quantity-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>

                          <div className="quantity-selector-small">
                            <button
                              className="qty-btn-small"
                              onClick={(e) => {
                                e.preventDefault();
                                handleQuantityChange(productId, -1);
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              className="qty-input-small"
                              value={productQuantities[productId] || 1}
                              onChange={(e) => handleQuantityInputChange(productId, e.target.value)}
                            />
                            <button
                              className="qty-btn-small"
                              onClick={(e) => {
                                e.preventDefault();
                                handleQuantityChange(productId, 1);
                              }}
                            >
                              +
                            </button>
                          </div>

                          {/* Button ke andar unit show karna */}
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => handleAddToCart(e, product)}
                            disabled={!product.inStock}
                            style={{ width: '100%' }}
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

          </>
        )}


        {loading && products.length > 0 && (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "#999" }}>
            Loading more products...
          </div>
        )}
      </div>



      <div className="products-benefits">
        <div className="benefit-card">
          <div className="benefit-icon">🚚</div>
          <h4>Fast Delivery</h4>
          <p>Same-day express delivery across NYC, Queens & Long Island</p>
        </div>
        <div className="benefit-card">
          <div className="benefit-icon">🌿</div>
          <h4>Fresh Quality</h4>
          <p>Daily fresh stock, premium ingredients</p>
        </div>
        <div className="benefit-card">
          <div className="benefit-icon">🇮🇳</div>
          <h4>Authentic</h4>
          <p>Directly sourced from trusted suppliers</p>
        </div>
        <div className="benefit-card">
          <div className="benefit-icon">💰</div>
          <h4>Best Prices</h4>
          <p>Competitive pricing on all premium products</p>
        </div>
      </div>
    </div>
  );
}

export default Products;