import React, { useState, useEffect } from 'react';
import './CoAdminDashboard.css';

export default function CoAdminDashboard() {
  const [activeTab, setActiveTab] = useState('products'); // Changed default to 'products'
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    cost: '',
    category: 'Daily Essentials',
    quantity: '0',
    image: '',
    inStock: true
  });

  // Load data based on active tab
  useEffect(() => {
    setLoading(true);
    if (activeTab === 'orders') {
      loadOrders();
      const interval = setInterval(loadOrders, 3000);
      return () => clearInterval(interval);
    } else if (activeTab === 'products') {
      loadProducts();
    }
  }, [activeTab]);

  // WebSocket connection (unchanged)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://zippyyy.com';
      const ws = new WebSocket(`ws://${apiUrl.replace('http://', '').replace('https://', '')}`);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new-order') {
          addNotification(data);
          setNewOrdersCount(prev => prev + 1);
          loadOrders();
        }
      };

      ws.onerror = () => console.log('WebSocket not available, using polling');
      return () => ws.close();
    } catch (error) {
      console.log('WebSocket not supported, using polling');
    }
  }, []);

  const loadOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const apiUrl = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';
      const response = await fetch(`${apiUrl}/co-admin/orders?status=pending&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const ordersData = data.orders || data.data || [];

        if (ordersData.length > 0) {
          const latestOrderId = ordersData[0]._id;
          if (lastOrderId && latestOrderId !== lastOrderId) {
            const newOrder = ordersData.find(o => o._id === latestOrderId);
            if (newOrder) {
              addNotification(newOrder);
              setNewOrdersCount(prev => prev + 1);
            }
          }
          setLastOrderId(latestOrderId);
        }

        setOrders(ordersData);
        setError('');
      } else {
        setError('Failed to load orders');
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      setError('Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const apiUrl = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';
      const response = await fetch(`${apiUrl}/co-admin/products`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || []);
        setError('');
      } else {
        setError('Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setError('Error loading products');
    } finally {
      setLoading(false);
    }
  };

  const addNotification = (order) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🛒 New Order!', {
        body: `Order #${order.orderNumber || order._id} - $${order.totalAmount || 0}`,
        icon: '/logo.png'
      });
    }

    const notification = {
      id: Date.now(),
      message: `New order: #${order.orderNumber || order._id.slice(-6)}`,
      order
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';

      const url = editingProduct
        ? `${apiUrl}/co-admin/products/${editingProduct._id}`
        : `${apiUrl}/co-admin/products`;

      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productForm)
      });

      if (response.ok) {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductForm({
          name: '', description: '', price: '', cost: '', category: 'Daily Essentials',
          quantity: '0', image: '', inStock: true
        });
        loadProducts();
        window.dispatchEvent(new CustomEvent('productUpdated'));
      } else {
        const error = await response.json();
        alert(error.message || 'Validation failed.');
      }
    } catch (error) {
      alert('Error saving product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';

      const response = await fetch(`${apiUrl}/co-admin/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadProducts();
        window.dispatchEvent(new CustomEvent('productUpdated'));
      } else {
        alert('Failed to delete product');
      }
    } catch (error) {
      alert('Error deleting product');
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      cost: product.cost || '',
      category: product.category || 'Daily Essentials',
      quantity: product.quantity || '0',
      image: product.image || '',
      inStock: product.inStock !== false
    });
    setShowProductModal(true);
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="co-admin-dashboard">
      <div className="dashboard-header">
        <h1>📋 Co-Admin Panel</h1>
        <div className="tab-buttons">
          <button
            className={activeTab === 'products' ? 'active' : ''}
            onClick={() => setActiveTab('products')}
          >
            🛍️ Products
          </button>
          <button
            className={activeTab === 'orders' ? 'active' : ''}
            onClick={() => setActiveTab('orders')}
          >
            📦 New Orders {newOrdersCount > 0 && <span className="badge">{newOrdersCount}</span>}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="notifications-container">
          {notifications.map(notif => (
            <div key={notif.id} className="notification-card">
              🛒 {notif.message}
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Products Tab (Default) */}
      {activeTab === 'products' && (
        <div className="products-section">
          <div className="section-header">
            <h2>Product Management</h2>
            <button
              className="btn-add"
              onClick={() => {
                setEditingProduct(null);
                setProductForm({
                  name: '', description: '', price: '', cost: '', category: 'Daily Essentials',
                  quantity: '0', image: '', inStock: true
                });
                setShowProductModal(true);
              }}
            >
              ➕ Add Product
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="empty-state">No products found</div>
          ) : (
            <div className="products-table">
              <div className="co-table-header">
                <div>Name</div>
                <div className='co-category'>Category</div>
                <div>Price</div>
                <div>Stock</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {products.map(product => (
                <div key={product._id} className="co-table-row">
                  <div data-label="Name">{product.name}</div>
                  <div data-label="Category" className='co-category'>{product.category}</div>
                  <div data-label="Price">${parseFloat(product.price).toFixed(2)}</div>
                  <div data-label="Stock">{product.quantity || 0}</div>
                  <div data-label="Status">
                    <span className={`status-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
                      {product.inStock ? '✅ In Stock' : '❌ Out of Stock'}
                    </span>
                  </div>
                  <div data-label="Actions" className="actions">
                    <button className="btn-edit" onClick={() => handleEditProduct(product)}>Edit</button>
                    <button className="btn-delete" onClick={() => handleDeleteProduct(product._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="orders-section">
          <h2>New & Pending Orders</h2>
          {loading ? (
            <div className="loading">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">No new orders</div>
          ) : (
            <div className="orders-grid">
              {orders.map(order => (
                <div key={order._id} className="order-card">
                  <div className="order-header">
                    <span className="order-number">#{order.orderNumber || order._id.slice(-6)}</span>
                    <span className={`status-badge ${order.status || 'pending'}`}>{order.status || 'pending'}</span>
                  </div>
                  <div className="order-info">
                    <p><strong>Customer:</strong> {order.customerName || 'Guest'}</p>
                    <p><strong>Total:</strong> ${parseFloat(order.totalAmount || 0).toFixed(2)}</p>
                    <p><strong>Items:</strong> {order.items?.length || 0}</p>
                    <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="co-modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleProductSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.cost}
                    onChange={e => setProductForm({ ...productForm, cost: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    <option value="Daily Essentials">Daily Essentials</option>
                    <option value="Fresh Vegetables">Fresh Vegetables</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Spices & Seasonings">Spices & Seasonings</option>
                    <option value="Rice & Grains">Rice & Grains</option>
                    <option value="Lentils & Pulses">Lentils & Pulses</option>
                    <option value="Snacks & Sweets">Snacks & Sweets</option>
                    <option value="Frozen Foods">Frozen Foods</option>
                    <option value="Beverages">Beverages</option>
                    <option value="American Breakfast Fusions">American Breakfast Fusions</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.quantity}
                    onChange={e => setProductForm({ ...productForm, quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={productForm.image}
                  onChange={e => setProductForm({ ...productForm, image: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}