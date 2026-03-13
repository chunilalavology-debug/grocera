import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/pages/Auth.css';


function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    setError('');

    if (!formData.firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (formData.firstName.trim().length < 2) {
      setError('First name must be at least 2 characters');
      return false;
    }

    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return false;
    }
    if (formData.lastName.trim().length < 2) {
      setError('Last name must be at least 2 characters');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Password
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    // Confirm Password
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password
      });

      if (result.success) {
        if (result.user?.role === 'admin') {
          sessionStorage.setItem('adminLogin', 'true');
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(result.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again later.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        {/* Left Side - Registration Form */}
        <div className="auth-box">
          <div className="auth-header">
            <h2>Join Zippyyy Family</h2>
            <p>Start your journey with NYC, Queens & Long Island's finest grocery store</p>
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
              <label htmlFor="firstName">First Name</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  required
                  disabled={loading}
                />
              </div>
            </div>

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
                  placeholder="Create a password"
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
            </div>


            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>

              <div className="input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                  disabled={loading}
                />

                <span
                  className="eye-icon"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </span>
              </div>
            </div>


            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? (
                // <div className="loading-spinner">
                <div>
                  <span className="spinner"></span>
                  Creating Account...
                </div>
              ) : (
                <>
                  <span>Create Account</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign in here
              </Link>
            </p>

            <div className="auth-benefits">
              <div className="benefit-item">
                <span>🎁</span>
                <span>Welcome Bonus</span>
              </div>
              <div className="benefit-item">
                <span>🚚</span>
                <span>Free First Delivery</span>
              </div>
              <div className="benefit-item">
                <span>⭐</span>
                <span>Loyalty Rewards</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Visual & Benefits */}
        <div className="auth-visual">
          <div className="visual-content">
            <h3>Authentic  Flavors</h3>
            <p className='visual-content-para'>
              Join thousands of satisfied customers across NYC, Queens & Long Island who trust Zippyyy for the finest  groceries, spices, and specialty ingredients.
            </p>

            <div className="visual-features">
              <div className="feature">
                <div className="feature-icon">🌶️</div>
                <div className="feature-text">
                  <h4>Premium Spices</h4>
                  <p>Sourced directly from trusted partners to guarantee premium quality.</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">🥬</div>
                <div className="feature-text">
                  <h4>Fresh Vegetables</h4>
                  <p>Daily fresh  vegetables</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">🍚</div>
                <div className="feature-text">
                  <h4>Specialty Items</h4>
                  <p>Hard-to-find authentic ingredients</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;