import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ScrollReveal from '../components/ScrollReveal';
import '../styles/pages/Products.css';
import StarRating from '../components/StarRating';
import api from '../services/api';
import { filterProductsBySearch } from '../utils/fuzzyProductMatch';

export default function Category() {
  const { isAdmin } = useAuth();
  const { addToCart } = useCart();
  const location = useLocation();
  const [products, setProducts] = useState([]); // Ensure it starts as empty array
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Read category from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const categoryFromUrl = params.get('category');
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [location.search]);
  const [productWeights, setProductWeights] = useState({}); // Track weights for vegetables (in lbs)
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };
  
  // Check if product is a vegetable
  const isVegetable = (category) => {
    return category?.toLowerCase().includes('vegetable') || 
           category === 'Fresh Vegetables' ||
           category === 'Vegetables';
  };

  const weightOptions = [0.5, 1, 2, 3, 5]; // Weight options in lbs

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
      // For vegetables, use weight
      const weight = productWeights[productId] || 0.5; // Default to 0.5 lb
      const productWithWeight = {
        ...product,
        selectedWeight: weight,
        displayName: `${product.name} (${weight} lb)`
      };
      const result = addToCart(productWithWeight, 1);
      
      if (result && result.success) {
        alert(`✅ ${weight} lb of ${product.name} added to cart!`);
      } else if (result) {
        alert(`❌ ${result.message}`);
      } else {
        alert(`✅ ${weight} lb of ${product.name} added to cart!`);
      }
      
      // Reset weight after adding
      setProductWeights(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
    } else {
      // For non-vegetables, always add 1 (quantity selector is only on single product page)
      console.log('Adding to cart:', product, 'quantity:', 1);
      const result = addToCart(product, 1);
      
      if (result && result.success) {
        alert(`✅ 1 x ${product.name} added to cart!`);
      } else if (result) {
        alert(`❌ ${result.message}`);
      } else {
        alert(`✅ 1 x ${product.name} added to cart!`);
      }
    }
  };

  const categories = useMemo(() => [
    'All',
    'Daily Essentials',
    'Spices & Seasonings',
    'Fresh Vegetables',
    'Fruits',
    'Rice & Grains',
    'Lentils & Pulses',
    'Snacks & Sweets',
    'Frozen Foods',
    'Beverages',
    'American Breakfast Fusions'
  ], []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    // Ensure products is always an array
    if (!Array.isArray(products)) {
      return [];
    }
    
    let filtered = products;

    // Filter out out-of-stock products (double check)
    filtered = filtered.filter(product => 
      product.inStock === true && 
      (product.quantity > 0 || product.stockQuantity > 0)
    );

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product =>
        product.category &&
        product.category.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Filter by search term (typo-tolerant; never empty if catalog has items)
    if (searchTerm && searchTerm.trim()) {
      filtered = filterProductsBySearch(filtered, searchTerm.trim());
    }

    return filtered;
  }, [products, searchTerm, selectedCategory]);

  useEffect(() => {
    let mounted = true;
    const loadProductsData = async () => {
      try {
        const res = await api.get('/user/products', { params: { limit: 500 } });
        if (!mounted) return;
        const raw = res?.data;
        const productsArray = Array.isArray(raw) ? raw : [];
        const inStockProducts = productsArray.filter(
          (p) => p.inStock === true && (p.quantity > 0 || p.stockQuantity > 0)
        );
        if (mounted) setProducts(inStockProducts);
      } catch {
        if (mounted) {
          setProducts([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProductsData();
    // Auto-refresh products every 10 seconds to show new products added by admin
    const refreshInterval = setInterval(() => {
      if (mounted) {
        loadProductsData();
      }
    }, 10000); // Refresh every 10 seconds
    return () => {
      mounted = false;
      clearInterval(refreshInterval);
    };
  }, []); // No external dependencies needed



  if (loading) {
    return (
      <div className="products-container">
        <div className="loading-section">
          <div className="loading-spinner-large">
            <div className="spinner-large"></div>
          </div>
          <p>Loading Fresh Groceries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="products-container">
      <div className="products-header">
        <div className="header-content">
          <h1>Fresh Groceries</h1>
          <p>Discover authentic flavors from India, delivered fresh to your doorstep across NYC, Queens & Long Island</p>
          {isAdmin && (
            <div className="admin-controls">
              <Link to="/admin/products" className="btn btn-admin">
                📦 Manage Products
              </Link>
            </div>
          )}
        </div>
        
        <div className="products-filters">
          <div className="search-section">
            <div className="search-wrapper">
              <i className="search-icon">🔍</i>
              <input
                type="text"
                placeholder="Search for spices, vegetables, rice..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-input"
              />
            </div>
          </div>
          
          <div className="category-filters">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="products-content">
        <div className="products-stats">
          <div className="category-stat-item">
            <span className="category-stat-number">{filteredProducts.length}</span>
            <span className="category-stat-label">Products Available</span>
          </div>
          <div className="category-stat-item">
            <span className="category-stat-number">24-48h</span>
            <span className="category-stat-label">Delivery Time</span>
          </div>
          <div className="category-stat-item">
            <span className="category-stat-number">Fresh</span>
            <span className="category-stat-label">Daily Stock</span>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="no-products">
            <div className="no-products-icon">🔍</div>
            <h3>No products found</h3>
            <p>Try adjusting your search or category filter</p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map(product => (
              <ScrollReveal key={product.id || product._id}>
              <div className="product-card">
                <Link to={`/products/${product.id || product._id}`} className="product-link">
                  <div className="product-image">
                    <img 
                      src={product.image || '/api/placeholder/300/200'} 
                      alt={product.name}
                      onError={(e) => {
                        e.target.src = '/api/placeholder/300/200';
                      }}
                      loading="lazy"
                    />
                    {!product.inStock && <div className="out-of-stock-badge">Out of Stock</div>}
                  </div>
                  <div className="product-info">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-category">{product.category}</p>
                    <div style={{ margin: '0.25rem 0 0.35rem' }}>
                      <StarRating
                        rating={product.rating ?? (product.reviews?.length ? (product.reviews || []).reduce((a, r) => a + (Number(r?.rating) || 0), 0) / (product.reviews?.length || 1) : 0)}
                        count={product.reviews?.length ?? product.reviewCount ?? 0}
                        size={14}
                      />
                    </div>
                    <p className="product-description">{product.description}</p>
                    <div className="product-footer">
                      <span className="product-price">${product.price.toFixed(2)}</span>
                    </div>
                  </div>
                </Link>
                {product.inStock && (
                  <div className="product-cart-controls" onClick={(e) => e.stopPropagation()}>
                    {isVegetable(product.category) ? (
                      // Weight selector for vegetables
                      <div className="weight-selector-small">
                        <select
                          className="weight-select-small"
                          value={productWeights[product._id || product.id] || 0.5}
                          onChange={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleWeightSelect(product._id || product.id, parseFloat(e.target.value));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {weightOptions.map(weight => (
                            <option key={weight} value={weight}>
                              {weight} lb
                            </option>
                          ))}
                        </select>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={(e) => handleAddToCart(e, product)}
                          type="button"
                        >
                          Add to Cart
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => handleAddToCart(e, product)}
                        type="button"
                      >
                        Add to Cart
                      </button>
                    )}
                  </div>
                )}
              </div>
              </ScrollReveal>
            ))}
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
          <p>Directly sourced from trusted Indian suppliers</p>
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
