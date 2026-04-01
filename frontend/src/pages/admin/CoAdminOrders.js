import React, { useState, useEffect } from 'react';
import './CoAdminOrders.css';
import { getApiBaseUrl } from '../../config/apiBase';

export default function CoAdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  // Load orders from backend - only new/pending orders
  useEffect(() => {
    loadOrders();
    // Real-time polling every 3 seconds for new orders
    const interval = setInterval(() => {
      loadOrders();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('❌ Co-admin: No token found');
        setError('Not authenticated. Please login again.');
        setLoading(false);
        return;
      }

      const apiUrl = getApiBaseUrl();
      console.log('📡 Co-admin: Fetching orders from:', `${apiUrl}/co-admin/orders`);
      
      // Co-admin only sees new/pending orders
      const response = await fetch(`${apiUrl}/co-admin/orders?status=pending&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Co-admin: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const ordersData = data.orders || data.data || [];
        
        console.log('✅ Co-admin orders loaded:', ordersData.length);
        
        // Check for new orders
        if (ordersData.length > 0) {
          const latestOrderId = ordersData[0]._id;
          if (lastOrderId && latestOrderId !== lastOrderId) {
            // New order detected
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
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ Co-admin orders error:', response.status, errorData);
        
        let errorMessage = `Failed to load orders: ${errorData.message || errorData.error || 'Server error'}. Status: ${response.status}`;
        
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please logout and login again.';
        } else if (response.status === 403) {
          errorMessage = 'Access denied. You need co-admin role to view this page.';
        }
        
        setError(errorMessage);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      setError(`Network error: ${error.message}`);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const addNotification = (order) => {
    const notification = {
      id: Date.now(),
      orderNumber: order.orderNumber,
      customerName: order.customerName || 'Customer',
      totalAmount: order.totalAmount,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev].slice(0, 10)); // Keep last 10
    
    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New Order: ${order.orderNumber}`, {
        body: `$${order.totalAmount.toFixed(2)} from ${order.customerName || 'Customer'}`,
        icon: '/logo.png',
        badge: '/logo.png'
      });
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  const clearAllNotifications = () => {
    setNotifications([]);
    setNewOrdersCount(0);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="co-admin-container">
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Loading new orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="co-admin-container">
      <div className="co-admin-header">
        <div className="header-content">
          <h1>📋 New Orders</h1>
          <p>View incoming orders in real-time</p>
        </div>
        <div className="notification-badge">
          {newOrdersCount > 0 && (
            <span className="badge-count">{newOrdersCount}</span>
          )}
        </div>
      </div>

      {/* Notifications Panel */}
      {notifications.length > 0 && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3>🔔 Recent Notifications</h3>
            <button onClick={clearAllNotifications} className="clear-btn">
              Clear All
            </button>
          </div>
          <div className="notifications-list">
            {notifications.map(notification => (
              <div key={notification.id} className="notification-item">
                <div className="notification-content">
                  <div className="notification-title">
                    New Order: {notification.orderNumber}
                  </div>
                  <div className="notification-details">
                    {notification.customerName} • ${notification.totalAmount.toFixed(2)}
                  </div>
                  <div className="notification-time">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <button 
                  onClick={() => dismissNotification(notification.id)}
                  className="dismiss-btn"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>⚠️ Error:</strong> {error}
          <br />
          <small style={{marginTop: '0.5rem', display: 'block'}}>
            Make sure you're logged in as a co-admin user. 
            Check browser console (F12) for more details.
          </small>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="no-orders">
          <div className="no-orders-icon">📭</div>
          <h3>No New Orders</h3>
          <p>New orders will appear here when customers place them</p>
        </div>
      ) : (
        <div className="orders-grid">
          {orders.map(order => (
            <div key={order._id} className="order-card glass-card">
              <div className="order-header">
                <div className="order-number">#{order.orderNumber}</div>
                <div className={`order-status status-${order.status}`}>
                  {order.status}
                </div>
              </div>
              
              <div className="order-details">
                <div className="detail-row">
                  <span className="label">Customer:</span>
                  <span className="value">{order.customerName || 'Guest'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Email:</span>
                  <span className="value">{order.customerEmail || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Items:</span>
                  <span className="value">{order.items?.length || 0} items</span>
                </div>
                <div className="detail-row">
                  <span className="label">Total:</span>
                  <span className="value amount">${order.totalAmount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Payment:</span>
                  <span className="value">{order.paymentMethod || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Date:</span>
                  <span className="value">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {order.shippingAddress && (
                <div className="shipping-info">
                  <div className="shipping-label">Shipping Address:</div>
                  <div className="shipping-text">
                    {order.shippingAddress.street}<br/>
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                  </div>
                </div>
              )}

              {order.items && order.items.length > 0 && (
                <div className="order-items">
                  <div className="items-label">Order Items:</div>
                  <div className="items-list">
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="item-row">
                        <span>{item.quantity}x {item.product?.name || item.name || 'Product'}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="more-items">
                        +{order.items.length - 3} more items
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

