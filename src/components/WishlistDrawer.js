import React from 'react';
import { Link } from 'react-router-dom';
import { X, Heart, ShoppingCart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import '../styles/components/WishlistDrawer.css';

export default function WishlistDrawer() {
  const { items, isOpen, closeDrawer, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    const result = addToCart(product, 1);
    if (result.success) {
      removeFromWishlist(product._id || product.id);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="wishlist-drawer__backdrop"
        onClick={closeDrawer}
        onKeyDown={(e) => e.key === 'Escape' && closeDrawer()}
        role="button"
        tabIndex={0}
        aria-label="Close wishlist"
      />
      <div className="wishlist-drawer" role="dialog" aria-label="Wishlist">
        <div className="wishlist-drawer__header">
          <h2 className="wishlist-drawer__title">
            <Heart size={22} className="wishlist-drawer__title-icon" />
            Wishlist
          </h2>
          <button
            type="button"
            className="wishlist-drawer__close"
            onClick={closeDrawer}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="wishlist-drawer__body">
          {items.length === 0 ? (
            <div className="wishlist-drawer__empty">
              <Heart size={48} className="wishlist-drawer__empty-icon" />
              <p className="wishlist-drawer__empty-text">Your wishlist is empty</p>
              <p className="wishlist-drawer__empty-hint">Save items you like by tapping the heart on product cards.</p>
              <Link to="/products" className="wishlist-drawer__empty-btn" onClick={closeDrawer}>
                Browse products
              </Link>
            </div>
          ) : (
            <ul className="wishlist-drawer__list">
              {items.map((product) => {
                const productId = product._id || product.id;
                const price = product.hasDeal ? product.finalPrice : product.price;
                return (
                  <li key={productId} className="wishlist-drawer__item">
                    <Link
                      to={`/products/${productId}`}
                      className="wishlist-drawer__item-link"
                      onClick={closeDrawer}
                    >
                      <div className="wishlist-drawer__item-img-wrap">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="wishlist-drawer__item-img"
                        />
                      </div>
                      <div className="wishlist-drawer__item-info">
                        <span className="wishlist-drawer__item-name line-clamp-2">{product.name}</span>
                        <span className="wishlist-drawer__item-price">${price.toFixed(2)}</span>
                      </div>
                    </Link>
                    <div className="wishlist-drawer__item-actions">
                      <button
                        type="button"
                        className="wishlist-drawer__btn wishlist-drawer__btn--cart"
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={!product.inStock}
                        title="Add to cart"
                      >
                        <ShoppingCart size={18} />
                        Add to cart
                      </button>
                      <button
                        type="button"
                        className="wishlist-drawer__btn wishlist-drawer__btn--remove"
                        onClick={(e) => {
                          e.preventDefault();
                          removeFromWishlist(productId);
                        }}
                        aria-label="Remove from wishlist"
                        title="Remove"
                      >
                        <Heart size={18} fill="currentColor" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
