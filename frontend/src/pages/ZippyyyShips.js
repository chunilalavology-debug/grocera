import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Box, CreditCard, Download, ListOrdered, Truck } from 'lucide-react';
import '../styles/pages/ZippyyyShips.css';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STEPS = ['zips', 'options', 'addresses', 'review'];
const STEP_LABELS = ['ZIP', 'Options', 'Address', 'Pay'];

export default function ZippyyyShips() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth() || {};

  const [formData, setFormData] = useState({
    originZip: '',
    destinationZip: '',
    originAddress: '',
    destinationAddress: '',
  });
  const [options, setOptions] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [step, setStep] = useState('zips');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [businessForm, setBusinessForm] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    monthlyShipments: '',
    message: '',
  });
  const [businessLoading, setBusinessLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const currentStepIndex = STEPS.indexOf(step);
  const zipsValid = formData.originZip.trim().length >= 4 && formData.destinationZip.trim().length >= 4;
  const addressesValid = formData.originAddress.trim().length >= 5 && formData.destinationAddress.trim().length >= 5;
  const selectedOption = useMemo(
    () => options.find((o) => o.id === selectedOptionId) || null,
    [options, selectedOptionId]
  );

  const canProceed = useMemo(() => {
    if (step === 'zips') return zipsValid;
    if (step === 'options') return Boolean(selectedOptionId);
    if (step === 'addresses') return addressesValid;
    if (step === 'review') return true;
    return false;
  }, [step, zipsValid, selectedOptionId, addressesValid]);

  const fetchOptions = async () => {
    setOptionsLoading(true);
    setSummaryMessage('');
    setSelectedOptionId('');
    try {
      const res = await api.post('/user/shipping/options', {
        originZip: formData.originZip,
        destinationZip: formData.destinationZip,
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setOptions(list);
      if (list.length === 0) {
        setSummaryMessage('No shipping options found for these ZIP codes.');
      } else {
        setSelectedOptionId(list[0].id);
      }
    } catch (err) {
      setOptions([]);
      setSummaryMessage(err?.message || 'Failed to load shipping options.');
    } finally {
      setOptionsLoading(false);
    }
  };

  const goNext = () => {
    if (!canProceed) return;
    if (step === 'zips') {
      fetchOptions();
    }
    const next = Math.min(currentStepIndex + 1, STEPS.length - 1);
    setStep(STEPS[next]);
  };

  const goPrev = () => {
    const prev = Math.max(currentStepIndex - 1, 0);
    setStep(STEPS[prev]);
  };

  const handleGetQuote = async (e) => {
    e.preventDefault();
    if (!selectedOption) {
      toast.error('Please select a shipping option first.');
      return;
    }
    const token = localStorage.getItem("token");
    if (!token || (!isLoading && !isAuthenticated)) {
      toast.error("Please login to book shipping.");
      setTimeout(() => navigate('/login'), 400);
      return;
    }

    setQuoteLoading(true);
    setSummaryMessage('');

    try {
      const res = await api.post("/user/shipping/checkout", {
        length: selectedOption.dimensions.length,
        width: selectedOption.dimensions.width,
        height: selectedOption.dimensions.height,
        weight: selectedOption.weight,
        originZip: formData.originZip,
        destinationZip: formData.destinationZip,
        originAddress: formData.originAddress,
        destinationAddress: formData.destinationAddress,
      });
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

  const handleBusinessSubmit = async (e) => {
    e.preventDefault();
    setBusinessLoading(true);
    try {
      const res = await api.post('/user/shipping/business-inquiry', {
        ...businessForm,
        monthlyShipments: Number(businessForm.monthlyShipments || 0),
      });
      if (!res?.success) {
        toast.error(res?.message || 'Failed to submit inquiry');
      } else {
        toast.success('Inquiry sent. Our team will contact you shortly.');
        setBusinessForm({
          name: '',
          businessName: '',
          email: '',
          phone: '',
          monthlyShipments: '',
          message: '',
        });
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to submit inquiry');
    } finally {
      setBusinessLoading(false);
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
                {step === 'zips' && 'Enter ZIP codes'}
                {step === 'options' && 'Select box and service'}
                {step === 'addresses' && 'Enter from/to address'}
                {step === 'review' && 'Review & checkout'}
              </h2>

              {step === 'zips' && (
                <div className="zippyyy-ships__step-pane">
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-origin-zip">Origin ZIP</label>
                    <input id="zs-origin-zip" type="text" name="originZip" placeholder="e.g. 10001" value={formData.originZip} onChange={handleChange} maxLength={10} />
                  </div>
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-dest-zip">Destination ZIP</label>
                    <input id="zs-dest-zip" type="text" name="destinationZip" placeholder="e.g. 90210" value={formData.destinationZip} onChange={handleChange} maxLength={10} />
                  </div>
                </div>
              )}

              {step === 'options' && (
                <div className="zippyyy-ships__step-pane">
                  {optionsLoading ? (
                    <div className="zippyyy-ships__review">Fetching shipping options...</div>
                  ) : options.length === 0 ? (
                    <div className="zippyyy-ships__review">No options found. Go back and try other ZIP codes.</div>
                  ) : (
                    <div className="zippyyy-ships__options-list">
                      {options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`zippyyy-ships__option-card ${selectedOptionId === option.id ? 'is-selected' : ''}`}
                          onClick={() => setSelectedOptionId(option.id)}
                        >
                          <div>
                            <strong>{option.name}</strong>
                            <p>{option.dimensions.length} x {option.dimensions.width} x {option.dimensions.height} in, {option.weight} lb</p>
                            <small>{option.carrier}{option.serviceName ? ` - ${option.serviceName}` : ''}</small>
                          </div>
                          <span>${Number(option.quoteAmount || 0).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 'addresses' && (
                <div className="zippyyy-ships__step-pane">
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-origin-address">From address</label>
                    <input id="zs-origin-address" type="text" name="originAddress" placeholder="Street, city, state" value={formData.originAddress} onChange={handleChange} />
                  </div>
                  <div className="zippyyy-ships__field">
                    <label htmlFor="zs-dest-address">To address</label>
                    <input id="zs-dest-address" type="text" name="destinationAddress" placeholder="Street, city, state" value={formData.destinationAddress} onChange={handleChange} />
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="zippyyy-ships__step-pane">
                  <div className="zippyyy-ships__review">
                    <p><strong>From:</strong> {formData.originAddress} ({formData.originZip})</p>
                    <p><strong>To:</strong> {formData.destinationAddress} ({formData.destinationZip})</p>
                    <p><strong>Box:</strong> {selectedOption ? `${selectedOption.dimensions.length}" x ${selectedOption.dimensions.width}" x ${selectedOption.dimensions.height}"` : '—'}</p>
                    <p><strong>Weight:</strong> {selectedOption ? `${selectedOption.weight} lb` : '—'}</p>
                    <p><strong>Price:</strong> {selectedOption ? `$${Number(selectedOption.quoteAmount || 0).toFixed(2)}` : '—'}</p>
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
              <p><span>Dimensions</span><strong>{selectedOption ? `${selectedOption.dimensions.length}x${selectedOption.dimensions.width}x${selectedOption.dimensions.height} in` : '—'}</strong></p>
              <p><span>Weight</span><strong>{selectedOption ? `${selectedOption.weight} lb` : '—'}</strong></p>
              <p><span>Selected price</span><strong>{selectedOption ? `$${Number(selectedOption.quoteAmount || 0).toFixed(2)}` : '—'}</strong></p>
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

        <section className="zippyyy-ships__card" style={{ marginTop: '1rem' }}>
          <h3 className="zippyyy-ships__card-title">Business shipping in bulk</h3>
          <p style={{ marginTop: '-.35rem', color: '#64748b', fontSize: '.92rem' }}>
            For frequent shipping, we can provide more competitive pricing than market rates.
          </p>
          <form className="zippyyy-ships__form" onSubmit={handleBusinessSubmit}>
            <div className="zippyyy-ships__form-grid">
              <div className="zippyyy-ships__field">
                <label>Name</label>
                <input value={businessForm.name} onChange={(e) => setBusinessForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="zippyyy-ships__field">
                <label>Business name</label>
                <input value={businessForm.businessName} onChange={(e) => setBusinessForm((p) => ({ ...p, businessName: e.target.value }))} required />
              </div>
              <div className="zippyyy-ships__field">
                <label>Email</label>
                <input type="email" value={businessForm.email} onChange={(e) => setBusinessForm((p) => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="zippyyy-ships__field">
                <label>Phone</label>
                <input value={businessForm.phone} onChange={(e) => setBusinessForm((p) => ({ ...p, phone: e.target.value }))} required />
              </div>
              <div className="zippyyy-ships__field">
                <label>Monthly shipments</label>
                <input type="number" min="1" value={businessForm.monthlyShipments} onChange={(e) => setBusinessForm((p) => ({ ...p, monthlyShipments: e.target.value }))} required />
              </div>
            </div>
            <div className="zippyyy-ships__field">
              <label>Message</label>
              <input value={businessForm.message} onChange={(e) => setBusinessForm((p) => ({ ...p, message: e.target.value }))} placeholder="Optional details" />
            </div>
            <div className="zippyyy-ships__nav">
              <span />
              <button className="zippyyy-ships__nav-btn primary" type="submit" disabled={businessLoading}>
                {businessLoading ? 'Submitting...' : 'Submit inquiry'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
