import React, { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import './ComingSoonPage.css';

/**
 * @param {{ mode?: 'site' | 'zippy', headline?: string, message?: string, subscriptionEnabled?: boolean, websiteName?: string }} props
 */
export default function ComingSoonPage({
  mode = 'site',
  headline = 'Zippy Ships is coming soon',
  message = "Zippy Ships is coming soon. We're working hard to bring fast and reliable shipping to you.",
  subscriptionEnabled = true,
  websiteName = 'Zippyyy',
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Enter your email');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/user/coming-soon/subscribe', {
        email: trimmed,
        source: mode === 'zippy' ? 'zippy_ships' : 'site_wide',
      });
      if (res.success) {
        toast.success(res.message || 'You are on the list.');
        setEmail('');
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="coming-soon">
      <div className="coming-soon__card">
        <div className="coming-soon__pulse" aria-hidden />
        <p className="coming-soon__eyebrow">{websiteName}</p>
        <h1 className="coming-soon__title">{headline}</h1>
        <p className="coming-soon__message">{message}</p>
        {subscriptionEnabled ? (
          <form className="coming-soon__form" onSubmit={onSubmit} noValidate>
            <label htmlFor="coming-soon-email" className="coming-soon__label">
              Get notified when we launch
            </label>
            <div className="coming-soon__row">
              <input
                id="coming-soon-email"
                type="email"
                className="coming-soon__input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={submitting}
              />
              <button type="submit" className="coming-soon__btn" disabled={submitting}>
                {submitting ? '…' : 'Notify me'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
