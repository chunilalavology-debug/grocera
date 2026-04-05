import React, { createContext, useContext, useEffect } from 'react';

const WISHLIST_STORAGE_KEY = 'grocera_wishlist';

const WishlistContext = createContext();

const loadWishlist = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
};

export function WishlistProvider({ children }) {
  const [items, setItems] = React.useState(loadWishlist);
  const [isOpen, setIsOpen] = React.useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Wishlist save failed', e);
      }
    }
  }, [items]);

  const addToWishlist = (product) => {
    const id = product._id || product.id;
    if (items.some((p) => (p._id || p.id) === id)) return;
    setItems((prev) => [...prev, { ...product, _id: id, id }]);
  };

  const removeFromWishlist = (productId) => {
    setItems((prev) => prev.filter((p) => (p._id || p.id) !== productId));
  };

  const toggleWishlist = (product) => {
    const id = product._id || product.id;
    setItems((prev) => {
      const exists = prev.some((p) => (p._id || p.id) === id);
      if (exists) return prev.filter((p) => (p._id || p.id) !== id);
      return [...prev, { ...product, _id: id, id }];
    });
  };

  const isInWishlist = (productId) =>
    items.some((p) => (p._id || p.id) === productId);

  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);

  const value = {
    items,
    wishlistCount: items.length,
    isOpen,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    openDrawer,
    closeDrawer,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
