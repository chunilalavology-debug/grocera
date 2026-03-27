import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/pages/Cart.css';

function Cart() {
  const { items, total, itemCount, removeFromCart, updateQuantity, clearCart } = useCart();

  if (itemCount === 0) {
    return (
      <div className="cart-page cart-page--empty">
        <div className="cart-empty">
          <h1 className="cart-empty__title">Your cart is empty</h1>
          <p className="cart-empty__text">Looks like you haven’t added anything yet.</p>
          <Link to="/products" className="cart-empty__btn">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-page__inner">
        {/* Header / Breadcrumb */}
        <header className="cart-header">
          <h1 className="cart-header__title">Cart</h1>
          <span className="cart-header__count">({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
        </header>

        <div className="cart-layout">
          {/* Left: Cart items */}
          <div className="cart-items-col">
            <div className="cart-items">
              {items.map((item, index) => {
                const hasDeal = item.product?.hasDeal;
                const unitPrice = hasDeal ? Number(item.product.finalPrice) : Number(item.product.price);
                const originalPrice = Number(item.product.price);
                const isVeg = item.product?.category?.toLowerCase().includes('vegetable') || item.product?.category === 'Fresh Vegetables';
                const weight = item.product?.selectedWeight;
                const lineTotal = (isVeg && weight) ? unitPrice * weight * item.quantity : unitPrice * item.quantity;
                const productId = item.product._id || item.product.id;
                const uniqueKey = isVeg && weight ? `${productId}_${weight}` : `${productId}_${index}`;

                return (
                  <div key={uniqueKey} className="cart-line">
                    <Link to={`/products/${productId}`} className="cart-line__img-wrap">
                      <img
                        src={item.product.image || '/api/placeholder/80/80'}
                        alt={item.product.name}
                        className="cart-line__img"
                        onError={(e) => { e.target.src = '/api/placeholder/80/80'; }}
                      />
                      <span className="cart-line__qty-badge">{item.quantity}</span>
                    </Link>
                    <div className="cart-line__info">
                      <Link to={`/products/${productId}`} className="cart-line__name">
                        {item.product.displayName || item.product.name}
                      </Link>
                      {weight && (
                        <p className="cart-line__variant">{weight} lb</p>
                      )}
                      <button
                        type="button"
                        className="cart-line__remove"
                        onClick={() => removeFromCart(productId, isVeg ? item.product?.selectedWeight : undefined)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="cart-line__secondary">
                      <div className="cart-line__qty">
                        <button
                          type="button"
                          className="cart-line__qty-btn"
                          onClick={() => updateQuantity(productId, item.quantity - 1, isVeg ? item.product?.selectedWeight : undefined)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="cart-line__qty-num">{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-line__qty-btn"
                          onClick={() => updateQuantity(productId, item.quantity + 1, isVeg ? item.product?.selectedWeight : undefined)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <div className="cart-line__price">
                        <span className="cart-line__price-total">${lineTotal.toFixed(2)}</span>
                        {hasDeal && (
                          <span className="cart-line__price-original">${(originalPrice * (weight || 1) * item.quantity).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-actions">
              <button type="button" className="cart-clear" onClick={clearCart}>
                Clear cart
              </button>
              <Link to="/products" className="cart-continue">
                ← Continue shopping
              </Link>
            </div>
          </div>

          {/* Right: Order summary */}
          <aside className="cart-summary-col">
            <div className="cart-summary">
              <h2 className="cart-summary__title">Order summary</h2>

              <ul className="cart-summary__list">
                {items.map((item, index) => {
                  const hasDeal = item.product?.hasDeal;
                  const unitPrice = hasDeal ? Number(item.product.finalPrice) : Number(item.product.price);
                  const isVeg = item.product?.category?.toLowerCase().includes('vegetable') || item.product?.category === 'Fresh Vegetables';
                  const weight = item.product?.selectedWeight;
                  const lineTotal = (isVeg && weight) ? unitPrice * weight * item.quantity : unitPrice * item.quantity;
                  return (
                    <li key={`${item.product._id || item.product.id}_${index}`} className="cart-summary__item">
                      <div className="cart-summary__item-thumb">
                        <div className="cart-summary__item-img-wrap">
                          <img
                            src={item.product.image || '/api/placeholder/80/80'}
                            alt={item.product.name}
                            className="cart-summary__item-img"
                            onError={(e) => { e.target.src = '/api/placeholder/80/80'; }}
                          />
                        </div>
                        <span className="cart-summary__item-qty">{item.quantity}</span>
                      </div>
                      <div className="cart-summary__item-info">
                        <span className="cart-summary__item-name">{item.product.displayName || item.product.name}</span>
                        <span className="cart-summary__item-price">${lineTotal.toFixed(2)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="cart-summary__discount">
                <label htmlFor="cart-discount" className="cart-summary__discount-label">Gift card or discount code</label>
                <div className="cart-summary__discount-row">
                  <input id="cart-discount" type="text" className="cart-summary__discount-input" placeholder="Enter code" />
                  <button type="button" className="cart-summary__discount-btn">Apply</button>
                </div>
              </div>

              <div className="cart-summary__totals">
                <div className="cart-summary__row">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="cart-summary__row">
                  <span>Shipping</span>
                  <span className="cart-summary__shipping">Calculated at next step</span>
                </div>
                <div className="cart-summary__row cart-summary__row--total">
                  <span>Total</span>
                  <span>USD ${total.toFixed(2)}</span>
                </div>
              </div>

              <Link to="/checkout" className="cart-summary__checkout-btn">
                Proceed to checkout
              </Link>

              <p className="cart-summary__tax-note">Taxes included.</p>

              <nav className="cart-summary__footer">
                <Link to="/refund-policy">Refund policy</Link>
                <Link to="/privacy-policy">Privacy policy</Link>
                <Link to="/terms-and-conditions">Terms of service</Link>
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Cart;
