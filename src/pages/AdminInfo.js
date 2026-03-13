import React from 'react';
import '../styles/pages/AdminInfo.css';

function AdminInfo() {
  return (
    <div className="admin-info-container">
      <div className="admin-info-card">
        <div className="admin-info-header">
          <h2>🔐 Admin Panel Access</h2>
          <p>Use these credentials to access the admin dashboard</p>
        </div>
        
        <div className="credentials-section">
          <h3>Admin Credentials</h3>
          <div className="credential-item">
            <span className="label">Email Options:</span>
            <div className="email-list">
              <code>admin@rbsgrocery.com</code>
              <code>rbsadmin@gmail.com</code>
              <code>manager@rbsgrocery.com</code>
              <code>boss@rbsgrocery.com</code>
              <code>owner@rbsgrocery.com</code>
            </div>
          </div>
          
          <div className="credential-item">
            <span className="label">Password:</span>
            <code className="password-code">admin123</code>
          </div>
        </div>

        <div className="features-section">
          <h3>Admin Panel Features</h3>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>Sales Analytics</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💰</span>
              <span>Profit Tracking</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💲</span>
              <span>Price Management</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📦</span>
              <span>Order Management</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🛒</span>
              <span>Product Control</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">👥</span>
              <span>User Management</span>
            </div>
          </div>
        </div>

        <div className="instructions-section">
          <h3>How to Access</h3>
          <div className="steps">
            <div className="step">
              <span className="step-number">1</span>
              <span>Go to Login or Register page</span>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <span>Use any admin email from the list above</span>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <span>Enter password: admin123</span>
            </div>
            <div className="step">
              <span className="step-number">4</span>
              <span>You'll be automatically redirected to admin dashboard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminInfo;