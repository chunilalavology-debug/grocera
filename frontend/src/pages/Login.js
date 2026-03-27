import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
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
    <div className="auth-container auth-login">
      <div className="auth-wrapper">
        <div className="auth-box">
          <div className="auth-header">
            <h2>Welcome back</h2>
            <p>Sign in to your Zippyyy account to continue</p>
            <div className="auth-accent-line" />
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error" role="alert">
                <span aria-hidden="true">⚠</span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={20} strokeWidth={1.8} aria-hidden />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <Lock className="input-icon" size={20} strokeWidth={1.8} aria-hidden />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
                </button>
              </div>
              <div className="forgot-password">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              New to Zippyyy? <Link to="/register" className="auth-link">Create an account</Link>
            </p>
            <div className="auth-benefits">
              <div className="benefit-item">
                <span>🚀</span>
                <span>Same-day delivery</span>
              </div>
              <div className="benefit-item">
                <span>🌿</span>
                <span>Fresh groceries</span>
              </div>
              <div className="benefit-item">
                <span>📍</span>
                <span>NYC • Queens • Long Island</span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-visual">
          <div className="visual-content">
            <h3>Fresh groceries, delivered</h3>
            <p className="visual-content-para">
              Premium spices, fresh vegetables, and specialty items delivered to your doorstep across NYC, Queens & Long Island.
            </p>
            <div className="visual-features">
              <div className="feature">
                <div className="feature-icon">🕐</div>
                <div className="feature-text">
                  <h4>Fast delivery</h4>
                  <p>Same-day to 1-day delivery</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">✨</div>
                <div className="feature-text">
                  <h4>Premium quality</h4>
                  <p>Hand-picked fresh ingredients</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">🛒</div>
                <div className="feature-text">
                  <h4>Wide selection</h4>
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