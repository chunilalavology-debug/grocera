import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/pages/Auth.css';

function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth" // optional (remove if you want instant scroll)
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData);

      if (result.success) {
        if (result.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(result.message || 'Invalid email or password');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        {/* Left Side - Login Form */}
        <div className="auth-box">
          <div className="auth-header">
            <h2>Welcome Back to Zippyyy</h2>
            <p>A trusted grocery store serving NYC, Queens & Long Island</p>
            <div className="auth-accent-line"></div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <span>⚠</span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />

                {/* TEXT Eye */}
                <span
                  className="password-eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </span>
              </div>
              {/* Reset / Forgot Password */}
              <div className="forgot-password">
                <Link to="/forgot-password">Forgot Password?</Link>
              </div>
            </div>


            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? (
                // <div className="loading-spinner">
                <div>
                  <span className="spinner"></span>
                  Signing In...
                </div>
              ) : (
                <>
                  <span>Sign In</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              New to Zippyyy?{' '}
              <Link to="/register" className="auth-link">
                Create an account
              </Link>
            </p>

            <div className="auth-benefits">
              <div className="benefit-item">
                <span>🚀</span>
                <span>Same-Day Express Delivery</span>
              </div>
              <div className="benefit-item">
                <span>🌿</span>
                <span>Fresh Groceries</span>
              </div>
              <div className="benefit-item">
                <span>📍</span>
                <span>Serving NYC • Queens • Long Island</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Visual & Benefits */}
        <div className="auth-visual">
          <div className="visual-content">
            <h3>Fresh Groceries</h3>
            <p className='visual-content-para'>
              Experience the finest selection of premium spices, fresh vegetables, and specialty items delivered to your doorstep across NYC, Queens & Long Island.
            </p>

            <div className="visual-features">
              <div className="feature">
                <div className="feature-icon">🕐</div>
                <div className="feature-text">
                  <h4>Lightning Fast</h4>
                  <p>Same-day to 1-day delivery</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">✨</div>
                <div className="feature-text">
                  <h4>Premium Quality</h4>
                  <p>Hand-picked fresh ingredients</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">🛒</div> {/* Yahan se 🇮🇳 icon hata kar 🛒 laga diya hai */}
                <div className="feature-text">
                  <h4>Wide Selection</h4>
                  <p>Traditional spices & specialties</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;