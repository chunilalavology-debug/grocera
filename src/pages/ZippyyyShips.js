import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, CreditCard, Download, ListOrdered } from 'lucide-react';
import '../styles/pages/ZippyyyShips.css';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const SITE_COLOR = '#3090cf';
const SITE_COLOR_DARK = '#2680b8';

export default function ZippyyyShips() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth() || {};

  const [formData, setFormData] = useState({
    length: '',
    width: '',
    height: '',
    weight: '',
    originZip: '',
    originAddress: '',
    destinationZip: '',
    destinationAddress: '',
  });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGetQuote = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || (!isLoading && !isAuthenticated)) {
      toast.error("Please login to book shipping.");
      setTimeout(() => navigate('/login'), 400);
      return;
    }

    setQuoteLoading(true);
    setQuoteResult(null);

    try {
      const res = await api.post("/user/shipping/checkout", formData);
      if (!res?.success || !res?.url) {
        toast.error(res?.message || "Failed to create shipping checkout");
        setQuoteResult({ message: res?.message || "Failed to start payment." });
        setQuoteLoading(false);
        return;
      }
      // Redirect to Stripe hosted checkout.
      window.location.href = res.url;
    } catch (err) {
      const message = err?.message || err?.response?.data?.message || "Failed to start payment.";
      toast.error(message);
      setQuoteResult({ message });
      setQuoteLoading(false);
    }
  };

  return (
    <div className="zippyyy-ships" role="main">
      {/* Hero */}
      <section className="zippyyy-ships__hero" aria-labelledby="zippyyy-ships-heading">
        <div className="zippyyy-ships__hero-inner">
          <div className="zippyyy-ships__hero-accent" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} aria-hidden />
          <h1 id="zippyyy-ships-heading" className="zippyyy-ships__hero-title">
            Zippyyy <span className="zippyyy-ships__hero-title-highlight">Ships</span>
          </h1>
          <p className="zippyyy-ships__hero-subtitle">
            Enter your package details and get an instant shipping quote. Pay with Stripe, receive your label, and track the order in your account.
          </p>
        </div>
      </section>

      <div className="zippyyy-ships__container">
        {/* Quote form */}
        <section className="zippyyy-ships__form-section" aria-labelledby="zippyyy-ships-form-heading">
          <div className="zippyyy-ships__card">
            <h2 id="zippyyy-ships-form-heading" className="zippyyy-ships__card-title">
              <Package size={22} style={{ color: SITE_COLOR }} aria-hidden />
              Shipment details & dimensions
            </h2>
            <form onSubmit={handleGetQuote} className="zippyyy-ships__form" noValidate>
              <div className="zippyyy-ships__form-grid">
                <div className="zippyyy-ships__field">
                  <label htmlFor="zs-length">Length (in)</label>
                  <input id="zs-length" type="number" name="length" min="1" step="0.1" placeholder="e.g. 12" value={formData.length} onChange={handleChange} inputMode="decimal" autoComplete="off" />
                </div>
                <div className="zippyyy-ships__field">
                  <label htmlFor="zs-width">Width (in)</label>
                  <input id="zs-width" type="number" name="width" min="1" step="0.1" placeholder="e.g. 10" value={formData.width} onChange={handleChange} inputMode="decimal" autoComplete="off" />
                </div>
                <div className="zippyyy-ships__field">
                  <label htmlFor="zs-height">Height (in)</label>
                  <input id="zs-height" type="number" name="height" min="1" step="0.1" placeholder="e.g. 8" value={formData.height} onChange={handleChange} inputMode="decimal" autoComplete="off" />
                </div>
                <div className="zippyyy-ships__field">
                  <label htmlFor="zs-weight">Weight (lb)</label>
                  <input id="zs-weight" type="number" name="weight" min="0.1" step="0.1" placeholder="e.g. 5" value={formData.weight} onChange={handleChange} inputMode="decimal" autoComplete="off" />
                </div>
              </div>
              <div className="zippyyy-ships__field">
                <label htmlFor="zs-origin-address">Origin address</label>
                <input id="zs-origin-address" type="text" name="originAddress" placeholder="Street, city, state" value={formData.originAddress} onChange={handleChange} autoComplete="street-address" />
              </div>
              <div className="zippyyy-ships__field">
                <label htmlFor="zs-origin-zip">Origin ZIP</label>
                <input id="zs-origin-zip" type="text" name="originZip" placeholder="e.g. 10001" value={formData.originZip} onChange={handleChange} inputMode="numeric" autoComplete="postal-code" maxLength={10} />
              </div>
              <div className="zippyyy-ships__field">
                <label htmlFor="zs-dest-address">Destination address</label>
                <input id="zs-dest-address" type="text" name="destinationAddress" placeholder="Street, city, state" value={formData.destinationAddress} onChange={handleChange} autoComplete="off" />
              </div>
              <div className="zippyyy-ships__field">
                <label htmlFor="zs-dest-zip">Destination ZIP</label>
                <input id="zs-dest-zip" type="text" name="destinationZip" placeholder="e.g. 90210" value={formData.destinationZip} onChange={handleChange} inputMode="numeric" autoComplete="off" maxLength={10} />
              </div>
              {quoteResult && (
                <div className="zippyyy-ships__quote-note" style={{ borderColor: SITE_COLOR }} role="status">
                  {quoteResult.message}
                </div>
              )}
              <button type="submit" className="zippyyy-ships__submit" disabled={quoteLoading} style={{ backgroundColor: SITE_COLOR }} aria-busy={quoteLoading}>
                {quoteLoading ? 'Getting quote...' : 'Get shipping quote'}
              </button>
            </form>
          </div>
        </section>

        {/* How it works */}
        <section className="zippyyy-ships__how" aria-labelledby="zippyyy-ships-how-heading">
          <h2 id="zippyyy-ships-how-heading" className="zippyyy-ships__how-title">How it works</h2>
          <div className="zippyyy-ships__steps">
            <div className="zippyyy-ships__step">
              <span className="zippyyy-ships__step-num" style={{ backgroundColor: SITE_COLOR }} aria-hidden>1</span>
              <p>Enter package dimensions and origin/destination details above.</p>
            </div>
            <div className="zippyyy-ships__step">
              <span className="zippyyy-ships__step-num" style={{ backgroundColor: SITE_COLOR }} aria-hidden>2</span>
              <p>Get your price and place the shipping order.</p>
            </div>
            <div className="zippyyy-ships__step">
              <CreditCard size={24} style={{ color: SITE_COLOR }} aria-hidden />
              <p>You’re redirected to Stripe to pay securely.</p>
            </div>
            <div className="zippyyy-ships__step">
              <Download size={24} style={{ color: SITE_COLOR }} aria-hidden />
              <p>Your shipping label is generated and downloaded automatically.</p>
            </div>
            <div className="zippyyy-ships__step">
              <ListOrdered size={24} style={{ color: SITE_COLOR }} aria-hidden />
              <p>Find the paid shipping order in <Link to="/orders" className="zippyyy-ships__link" style={{ color: SITE_COLOR }}>Orders</Link>.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
