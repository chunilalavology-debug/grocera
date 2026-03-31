import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Box, CreditCard, Download, ListOrdered, Truck } from 'lucide-react';
import '../styles/pages/ZippyyyShips.css';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STEPS = ['zips', 'box', 'weight', 'review'];
const STEP_LABELS = ['ZIP', 'Box', 'Weight', 'Review'];
const SITE_COLOR = '#3090cf';

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
  const [step, setStep] = useState('zips');
  const [summaryMessage, setSummaryMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const currentStepIndex = STEPS.indexOf(step);
  const dimsValid = Number(formData.length) > 0 && Number(formData.width) > 0 && Number(formData.height) > 0;
  const weightValid = Number(formData.weight) > 0;
  const zipsValid = formData.originZip.trim().length >= 4 && formData.destinationZip.trim().length >= 4;
  const addressValid = formData.originAddress.trim().length >= 5 && formData.destinationAddress.trim().length >= 5;

  const canProceed = useMemo(() => {
    if (step === 'zips') return zipsValid && addressValid;
    if (step === 'box') return dimsValid;
    if (step === 'weight') return weightValid;
    if (step === 'review') return true;
    return false;
  }, [step, zipsValid, addressValid, dimsValid, weightValid]);

  const goNext = () => {
    if (!canProceed) return;
    const next = Math.min(currentStepIndex + 1, STEPS.length - 1);
    setStep(STEPS[next]);
  };

  const goPrev = () => {
    const prev = Math.max(currentStepIndex - 1, 0);
    setStep(STEPS[prev]);
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
    setSummaryMessage('');

    try {
      const res = await api.post("/user/shipping/checkout", formData);
      if (!res?.success || !res?.url) {
        toast.error(res?.message || "Failed to create shipping checkout");
        setSummaryMessage(res?.message || "Failed to start payment.");
        setQuoteLoading(false);
        return;
      }
      // Redirect to Stripe hosted checkout.
      window.location.href = res.url;
    } catch (err) {
      const message = err?.message || err?.response?.data?.message || "Failed to start payment.";
      toast.error(message);
      setSummaryMessage(message);
      setQuoteLoading(false);
    }
  };

  return (
    <div className="zippyyy-ships" role="main">
      {/* Hero */}
      <section className="zippyyy-ships__hero" aria-labelledby="zippyyy-ships-heading">
        <div className="zippyyy-ships__hero-inner">
          <div className="zippyyy-ships__hero-accent" aria-hidden />
          <h1 id="zippyyy-ships-heading" className="zippyyy-ships__hero-title">
            Zippyyy <span className="zippyyy-ships__hero-title-highlight">Ships</span>
          </h1>
          <p className="zippyyy-ships__hero-subtitle">
            Use the new step-by-step shipping flow from your Zippyyy Ships UI and checkout in Stripe securely.
          </p>
        </div>
      </section>

      <div className="zippyyy-ships__container">
        <section className="zippyyy-ships__layout" aria-labelledby="zippyyy-ships-form-heading">
          <div className="zippyyy-ships__card">
            <div className="zippyyy-ships__progress">
              {STEPS.map((s, idx) => {
                const active = idx === currentStepIndex;
                const done = idx < currentStepIndex;
                return (
                  <div key={s} className="zippyyy-ships__progress-item">
                    <div className={`zippyyy-ships__progress-dot ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}>
                      {idx + 1}
                    </div>
                    <span className="zippyyy-ships__progress-label">{STEP_LABELS[idx]}</span>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleGetQuote} className="zippyyy-ships__form" noValidate>
              <h2 id="zippyyy-ships-form-heading" className="zippyyy-ships__card-title">
                <Truck size={20} aria-hidden />
                {step === 'zips' && 'Pickup & destination'}
                {step === 'box' && 'Package dimensions'}
                {step === 'weight' && 'Package weight'}
                {step === 'review' && 'Review & checkout'}
              </h2>

              {step === 'zips' && (
                <div className="zippyyy-ships__step-pane">
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-origin-address">Origin address</label>
                    <input id="zs-origin-address" type="text" name="originAddress" placeholder="Street, city, state" value={formData.originAddress} onChange={handleChange} />
                  </div>
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-origin-zip">Origin ZIP</label>
                    <input id="zs-origin-zip" type="text" name="originZip" placeholder="e.g. 10001" value={formData.originZip} onChange={handleChange} maxLength={10} />
                  </div>
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-dest-address">Destination address</label>
                    <input id="zs-dest-address" type="text" name="destinationAddress" placeholder="Street, city, state" value={formData.destinationAddress} onChange={handleChange} />
                  </div>
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-dest-zip">Destination ZIP</label>
                    <input id="zs-dest-zip" type="text" name="destinationZip" placeholder="e.g. 90210" value={formData.destinationZip} onChange={handleChange} maxLength={10} />
                  </div>
                </div>
              )}

              {step === 'box' && (
                <div className="zippyyy-ships__step-pane">
                  <div className="zippyyy-ships__form-grid">
                    <div className="zippyyy-ships__field">
                      <label htmlFor="zs-length">Length (in)</label>
                      <input id="zs-length" type="number" name="length" min="1" step="0.1" placeholder="e.g. 12" value={formData.length} onChange={handleChange} />
                    </div>
                    <div className="zippyyy-ships__field">
                      <label htmlFor="zs-width">Width (in)</label>
                      <input id="zs-width" type="number" name="width" min="1" step="0.1" placeholder="e.g. 10" value={formData.width} onChange={handleChange} />
                    </div>
                    <div className="zippyyy-ships__field">
                      <label htmlFor="zs-height">Height (in)</label>
                      <input id="zs-height" type="number" name="height" min="1" step="0.1" placeholder="e.g. 8" value={formData.height} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              )}

              {step === 'weight' && (
                <div className="zippyyy-ships__step-pane">
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-weight">Weight (lb)</label>
                    <input id="zs-weight" type="number" name="weight" min="0.1" step="0.1" placeholder="e.g. 5" value={formData.weight} onChange={handleChange} />
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="zippyyy-ships__step-pane">
                  <div className="zippyyy-ships__review">
                    <p><strong>From:</strong> {formData.originAddress} ({formData.originZip})</p>
                    <p><strong>To:</strong> {formData.destinationAddress} ({formData.destinationZip})</p>
                    <p><strong>Box:</strong> {formData.length}" x {formData.width}" x {formData.height}"</p>
                    <p><strong>Weight:</strong> {formData.weight} lb</p>
                  </div>
                </div>
              )}

              {summaryMessage && (
                <div className="zippyyy-ships__quote-note" role="status">
                  {summaryMessage}
                </div>
              )}

              <div className="zippyyy-ships__nav">
                {step !== 'zips' ? (
                  <button type="button" className="zippyyy-ships__nav-btn secondary" onClick={goPrev}>
                    <ArrowLeft size={16} /> Back
                  </button>
                ) : <span />}

                {step !== 'review' ? (
                  <button type="button" className="zippyyy-ships__nav-btn primary" onClick={goNext} disabled={!canProceed}>
                    Continue <ArrowRight size={16} />
                  </button>
                ) : (
                  <button type="submit" className="zippyyy-ships__nav-btn primary" disabled={quoteLoading}>
                    {quoteLoading ? 'Redirecting...' : 'Proceed to Stripe'}
                  </button>
                )}
              </div>
            </form>
          </div>

          <aside className="zippyyy-ships__manifest">
            <h3 className="zippyyy-ships__manifest-title">
              <Box size={18} aria-hidden />
              Shipping Manifest
            </h3>
            <div className="zippyyy-ships__manifest-list">
              <p><span>Origin ZIP</span><strong>{formData.originZip || '—'}</strong></p>
              <p><span>Destination ZIP</span><strong>{formData.destinationZip || '—'}</strong></p>
              <p><span>Dimensions</span><strong>{dimsValid ? `${formData.length}x${formData.width}x${formData.height} in` : '—'}</strong></p>
              <p><span>Weight</span><strong>{weightValid ? `${formData.weight} lb` : '—'}</strong></p>
            </div>
            <div className="zippyyy-ships__manifest-foot">
              <CreditCard size={16} /> Secure payment via Stripe
              <br />
              <Download size={16} /> Auto label download
              <br />
              <ListOrdered size={16} /> Track in <Link to="/orders">Orders</Link>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
