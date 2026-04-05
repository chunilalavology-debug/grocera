import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import '../styles/pages/AdminPricing.css';

function AdminPricing() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    if (isAdmin) {
      fetchProducts();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const fetchProducts = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/admin/products`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const productsData = result.data || result.products || result;
        
        // Transform products to match pricing page format
        const transformedProducts = Array.isArray(productsData) ? productsData.map(product => {
          const costPrice = product.cost || 0;
          const sellingPrice = product.price || 0;
          const profitMargin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice * 100) : 0;
          
          return {
            _id: product._id || product.id,
            name: product.name,
            category: product.category,
            costPrice: costPrice,
            sellingPrice: sellingPrice,
            profitMargin: parseFloat(profitMargin.toFixed(1)),
            stock: product.quantity || product.stockQuantity || 0,
            image: product.image || '/api/placeholder/100/100'
          };
        }) : [];
        
        setProducts(transformedProducts);
      } else {
        console.error('Failed to fetch products:', response.status);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceUpdate = async (productId, newPrice) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';
      const token = localStorage.getItem('token');
      
      // Update on server
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ price: newPrice })
      });
      
      if (response.ok) {
        // Reload products from server to ensure sync
        await fetchProducts();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update price');
      }
    } catch (error) {
      console.error('Error updating price:', error);
      alert(`Error updating price: ${error.message}`);
      // Reload to revert any local changes
      await fetchProducts();
    }
  };

  const handleImageUpload = (productId, file) => {
    void productId;
    void file;
    /* Image upload not wired in this legacy screen — use Admin → Products. */
  };

  const quickPriceAdjust = (productId, percentage) => {
    const product = products.find(p => p._id === productId);
    if (product) {
      const newPrice = (product.sellingPrice * (1 + percentage / 100)).toFixed(2);
      handlePriceUpdate(productId, parseFloat(newPrice));
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...new Set(products.map(p => p.category))];

  if (loading) {
    return (
      <div className="admin-pricing">
        <div className="loading-section">
          <div className="loading-spinner-large">
            <div className="spinner-large"></div>
          </div>
          <p>Loading pricing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-pricing">
      <div className="pricing-header">
        <h1>Price Management</h1>
        <p>Manage product pricing, cost analysis, and profit margins</p>
      </div>

      <div className="pricing-filters">
        <div className="price-search-section">
          <div className="search-wrapper">
            <i className="search-icon">🔍</i>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        
        <div className="category-filter">
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="pricing-stats">
        <div className="pricing-stat-card">
          <div className="pricing-stat-icon">💰</div>
          <div className="pricing-stat-info">
            <span className="pricing-stat-label">Average Margin</span>
            <span className="pricing-stat-value">
              {(products.reduce((acc, p) => acc + p.profitMargin, 0) / products.length).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="pricing-stat-card">
          <div className="pricing-stat-icon">📊</div>
          <div className="pricing-stat-info">
            <span className="pricing-stat-label">Total Products</span>
            <span className="pricing-stat-value">{products.length}</span>
          </div>
        </div>
        <div className="pricing-stat-card">
          <div className="pricing-stat-icon">📈</div>
          <div className="pricing-stat-info">
            <span className="pricing-stat-label">High Margin ({'>'}50%)</span>
            <span className="pricing-stat-value">{products.filter(p => p.profitMargin > 50).length}</span>
          </div>
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.map(product => (
          <div key={product._id} className="product-card">
            <div className="price-product-image">
              <div className="image-placeholder">
                <span className="product-icon">📦</span>
              </div>
              <button 
                className="upload-btn"
                onClick={() => document.getElementById(`file-${product._id}`).click()}
              >
                📷
              </button>
              <input
                id={`file-${product._id}`}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleImageUpload(product._id, e.target.files[0])}
              />
            </div>

            <div className="product-info">
              <h3 className="product-name">{product.name}</h3>
              <span className="product-category">{product.category}</span>
              
              <div className="pricing-section">
                <div className="price-row">
                  <span className="label">Cost Price:</span>
                  <span className="cost-price">${product.costPrice}</span>
                </div>
                
                <div className="price-row">
                  <span className="label">Selling Price:</span>
                  {editingProduct === product._id ? (
                    <div className="price-edit">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={product.sellingPrice}
                        onBlur={(e) => {
                          handlePriceUpdate(product._id, parseFloat(e.target.value));
                          setEditingProduct(null);
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handlePriceUpdate(product._id, parseFloat(e.target.value));
                            setEditingProduct(null);
                          }
                        }}
                        autoFocus
                        className="price-input"
                      />
                    </div>
                  ) : (
                    <span 
                      className="selling-price clickable"
                      onClick={() => setEditingProduct(product._id)}
                    >
                      ${product.sellingPrice}
                    </span>
                  )}
                </div>
                
                <div className="price-row">
                  <span className="label">Profit:</span>
                  <span className="profit-amount">
                    ${(product.sellingPrice - product.costPrice).toFixed(2)}
                  </span>
                </div>
                
                <div className="price-row">
                  <span className="label">Margin:</span>
                  <span 
                    className={`margin-percentage ${product.profitMargin > 40 ? 'high' : product.profitMargin > 25 ? 'medium' : 'low'}`}
                  >
                    {product.profitMargin}%
                  </span>
                </div>
              </div>

              <div className="stock-info">
                <span className="stock-label">Stock:</span>
                <span className={`stock-value ${product.stock < 30 ? 'low' : ''}`}>
                  {product.stock} units
                </span>
              </div>

              <div className="price-actions">
                <button 
                  className="quick-btn increase"
                  onClick={() => quickPriceAdjust(product._id, 5)}
                  title="Increase by 5%"
                >
                  +5%
                </button>
                <button 
                  className="quick-btn increase"
                  onClick={() => quickPriceAdjust(product._id, 10)}
                  title="Increase by 10%"
                >
                  +10%
                </button>
                <button 
                  className="quick-btn decrease"
                  onClick={() => quickPriceAdjust(product._id, -5)}
                  title="Decrease by 5%"
                >
                  -5%
                </button>
                <button 
                  className="quick-btn decrease"
                  onClick={() => quickPriceAdjust(product._id, -10)}
                  title="Decrease by 10%"
                >
                  -10%
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminPricing;