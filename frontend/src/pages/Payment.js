import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/pages/Payment.css';
import api from '../services/api';
import { getApiBaseUrl } from '../config/apiBase';

function Payment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState(null);
  const [remainingAmount, setRemainingAmount] = useState(null);

  const orderId = searchParams.get('orderId');
  const isRemainingPayment = searchParams.get('remaining') === 'true';
  const isRequestedPayment = searchParams.get('requested') === 'true';
  const requestedAmount = searchParams.get('amount');

  useEffect(() => {
    async function fetchRemainingAmount() {
      try {
        // No authentication required - fetch order details without token
        const response = await api.get(`/user/getUserOrderById/?orderId=${orderId}`, {
          headers: {

          }
        });
        if (response.ok) {
          const data = await response.json();
          // Handle different response structures
          const order = data.data || data;
          if (order && order.remainingAmount) {
            setRemainingAmount(order.remainingAmount);
            setPaymentAmount(order.remainingAmount.toFixed(2));
          }
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
        // Don't show error, just continue without max amount validation
      }
    }

    if (!orderId) {
      setError('Order ID is missing');
      return;
    }

    if (isRequestedPayment && requestedAmount) {
      setPaymentAmount(parseFloat(requestedAmount).toFixed(2));
    }

    if (isRemainingPayment) {
      fetchRemainingAmount();
    }
  }, [orderId, navigate, isRemainingPayment, isRequestedPayment, requestedAmount]);

  const handleAmountChange = (e) => {
    const value = e.target.value;
    // Allow only numbers and one decimal point
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setPaymentAmount(value);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(paymentAmount);

    if (!amount || amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    if (isRemainingPayment && remainingAmount) {
      if (amount > remainingAmount) {
        setError(`Amount cannot exceed remaining balance of $${remainingAmount.toFixed(2)}`);
        return;
      }
    }

    try {
      setLoading(true);

      // Create Stripe checkout session - no authentication required
      const response = await fetch(`${getApiBaseUrl()}/payments/create-payment-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderId,
          amount: amount,
          paymentType: isRemainingPayment ? 'remaining_payment' : 'extra_payment',
          customerEmail: user?.email || undefined
        })
      });

      const data = await response.json();

      if (response.ok && data.success && data.url) {
        // Redirect to Stripe checkout immediately
        window.location.href = data.url;
      } else {
        setError(data.message || 'Failed to create payment session. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error creating payment session:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (!orderId) {
    return (
      <div className="payment-container">
        <div className="container">
          <div className="error-message">
            <p>Order ID is missing</p>
            <button onClick={() => navigate('/orders')} className="btn btn-primary">
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-container">
      <div className="container">
        <div className="payment-header">
          <h1>💳 Make Payment</h1>
          {isRequestedPayment ? (
            <p style={{ color: '#ff6b00', fontWeight: '600' }}>
              Admin has requested a payment of ${requestedAmount || '0.00'} for this order
            </p>
          ) : (
            <p>Enter the amount you want to pay for this order</p>
          )}
        </div>

        <div className="payment-content">
          <form onSubmit={handleSubmit} className="payment-form">
            <div className="form-group">
              <label htmlFor="paymentAmount">
                {isRemainingPayment && remainingAmount
                  ? `Enter Amount to Pay (Max: $${remainingAmount.toFixed(2)})`
                  : 'Enter Payment Amount'}
                <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="currency-symbol">$</span>
                <input
                  type="text"
                  id="paymentAmount"
                  value={paymentAmount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  required
                  autoFocus
                  className={error ? 'error' : ''}
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              {isRemainingPayment && remainingAmount && (
                <p className="helper-text">
                  You can pay up to ${remainingAmount.toFixed(2)} to complete this order.
                </p>
              )}
              {!isRemainingPayment && (
                <p className="helper-text">
                  Enter any amount you want to pay for this order.
                </p>
              )}
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                {loading ? (
                  <>
                    <span className="spinner-small"></span>
                    Redirecting to Payment...
                  </>
                ) : (
                  <>
                    💳 Proceed to Payment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Payment;

