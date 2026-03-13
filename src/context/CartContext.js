import React, { createContext, useContext, useReducer, useEffect } from 'react';
const CartContext = createContext();

// Helper function to calculate totals
const calculateTotals = (items) => {
  const total = items.reduce((sum, item) => {
    const isVegetable = item.product?.category?.toLowerCase().includes('vegetable') ||
      item.product?.category === 'Fresh Vegetables';
    const selectedWeight = item.product?.selectedWeight;

    // For vegetables, calculate: price per lb × weight × quantity
    // For other items, calculate: price × quantity

    const price = item.product.hasDeal ?
      item.product.finalPrice :
      item.product.price

    if (isVegetable && selectedWeight) {
      return sum + (price * selectedWeight * item.quantity);
    } else {
      return sum + (price * item.quantity);
    }
  }, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { total, itemCount };
};

// Load saved cart items from localStorage or start empty
const loadInitialCart = () => {
  try {
    const savedItems = JSON.parse(localStorage.getItem('cartItems')) || [];
    const totals = calculateTotals(savedItems);
    return {
      items: savedItems,
      isOpen: false,
      ...totals
    };
  } catch (error) {
    console.error('Error loading cart:', error);
    return {
      items: [],
      isOpen: false,
      total: 0,
      itemCount: 0
    };
  }
};

const initialState = loadInitialCart();

function cartReducer(state, action) {
  let newItems;
  let totals;

  // Helper function to get product ID
  const getProductId = (product) => product._id || product.id;

  switch (action.type) {
    case 'ADD_TO_CART':
      const payloadProductId = getProductId(action.payload.product);
      const payloadSelectedWeight = action.payload.product?.selectedWeight;
      const payloadDisplayName = action.payload.product?.displayName;

      // For vegetables, check if same product with same weight already exists
      // For other products, just check product ID
      const isVegetable = action.payload.product?.category?.toLowerCase().includes('vegetable') ||
        action.payload.product?.category === 'Fresh Vegetables';

      const existingItem = state.items.find(item => {
        const itemProductId = getProductId(item.product);
        const itemSelectedWeight = item.product?.selectedWeight;
        const itemDisplayName = item.product?.displayName;

        if (itemProductId !== payloadProductId) {
          return false;
        }

        // For vegetables, also check if weight matches
        if (isVegetable) {
          // If both have selectedWeight, they must match
          if (payloadSelectedWeight && itemSelectedWeight) {
            return payloadSelectedWeight === itemSelectedWeight;
          }
          // If both have displayName, check if they match (includes weight info)
          if (payloadDisplayName && itemDisplayName) {
            return payloadDisplayName === itemDisplayName;
          }
          // If weights don't match, treat as different items
          return payloadSelectedWeight === itemSelectedWeight;
        }

        // For non-vegetables, same product ID means same item
        return true;
      });

      if (existingItem) {
        // Same item exists, increase quantity
        newItems = state.items.map(item => {
          const itemProductId = getProductId(item.product);
          const itemSelectedWeight = item.product?.selectedWeight;
          const itemDisplayName = item.product?.displayName;

          // Check if this is the same item
          const isSameItem = itemProductId === payloadProductId && (
            !isVegetable || (
              (payloadSelectedWeight && itemSelectedWeight && payloadSelectedWeight === itemSelectedWeight) ||
              (payloadDisplayName && itemDisplayName && payloadDisplayName === itemDisplayName) ||
              (!payloadSelectedWeight && !itemSelectedWeight)
            )
          );

          return isSameItem
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item;
        });
      } else {
        // New item (or same product with different weight), add as separate item
        newItems = [...state.items, action.payload];
      }

      totals = calculateTotals(newItems);
      return {
        ...state,
        items: newItems,
        ...totals
      };

    case 'REMOVE_FROM_CART':
      // For vegetables, we need to match by productId + selectedWeight
      // For other items, just match by productId
      const removeProductId = action.payload.productId || action.payload;
      const removeSelectedWeight = action.payload.selectedWeight;

      newItems = state.items.filter(item => {
        const itemProductId = getProductId(item.product);
        const itemSelectedWeight = item.product?.selectedWeight;
        const isVeg = item.product?.category?.toLowerCase().includes('vegetable') ||
          item.product?.category === 'Fresh Vegetables';

        if (itemProductId !== removeProductId) {
          return true; // Keep this item
        }

        // For vegetables, also check weight
        if (isVeg && removeSelectedWeight !== undefined) {
          return itemSelectedWeight !== removeSelectedWeight;
        }

        // For non-vegetables or if no weight specified, remove if productId matches
        return false;
      });

      totals = calculateTotals(newItems);
      return {
        ...state,
        items: newItems,
        ...totals
      };

    case 'UPDATE_QUANTITY':
      // Ensure quantity is a valid number
      const newQuantity = parseInt(action.payload.quantity) || 0;
      const updateProductId = action.payload.productId;
      const updateSelectedWeight = action.payload.selectedWeight;

      if (newQuantity <= 0) {
        // Remove item if quantity is 0 or negative
        newItems = state.items.filter(item => {
          const itemProductId = getProductId(item.product);
          const itemSelectedWeight = item.product?.selectedWeight;
          const isVeg = item.product?.category?.toLowerCase().includes('vegetable') ||
            item.product?.category === 'Fresh Vegetables';

          if (itemProductId !== updateProductId) {
            return true; // Keep this item
          }

          // For vegetables, also check weight
          if (isVeg && updateSelectedWeight !== undefined) {
            return itemSelectedWeight !== updateSelectedWeight;
          }

          // For non-vegetables, remove if productId matches
          return false;
        });
      } else {
        // Update the quantity
        newItems = state.items.map(item => {
          const itemProductId = getProductId(item.product);
          const itemSelectedWeight = item.product?.selectedWeight;
          const isVeg = item.product?.category?.toLowerCase().includes('vegetable') ||
            item.product?.category === 'Fresh Vegetables';

          // Check if this is the item to update
          const isMatch = itemProductId === updateProductId && (
            !isVeg ||
            updateSelectedWeight === undefined ||
            itemSelectedWeight === updateSelectedWeight
          );

          return isMatch
            ? { ...item, quantity: newQuantity }
            : item;
        });
      }

      totals = calculateTotals(newItems);
      return {
        ...state,
        items: newItems,
        ...totals
      };

    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        total: 0,
        itemCount: 0
      };

    case 'TOGGLE_CART':
      return {
        ...state,
        isOpen: !state.isOpen
      };

    case 'SET_CART_OPEN':
      return {
        ...state,
        isOpen: action.payload
      };

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Save to localStorage whenever cart changes
  useEffect(() => {
    if (state.items.length > 0) {
      localStorage.setItem('cartItems', JSON.stringify(state.items));
    } else {
      localStorage.removeItem('cartItems'); // Clean up when cart is empty
    }
  }, [state.items]);

  const addToCart = (product, quantity = 1) => {
    // Stock check
    const availableStock = product.quantity || product.stockQuantity || 0;
    if (!product.inStock || availableStock < quantity) {
      return {
        success: false,
        message:
          availableStock < quantity
            ? "Insufficient stock available"
            : "Product is out of stock",
      };
    }

    const normalizedProduct = {
      ...product,
      _id: product._id || product.id,
      id: product._id || product.id,
    };

    dispatch({
      type: "ADD_TO_CART",
      payload: { product: normalizedProduct, quantity },
    });

    return {
      success: true,
      message: `${product.name} added to cart`,
    };
  };


  const removeFromCart = (productId, selectedWeight) => {
    dispatch({
      type: 'REMOVE_FROM_CART',
      payload: typeof productId === 'object' ? productId : { productId, selectedWeight }
    });
  };

  const updateQuantity = (productId, quantity, selectedWeight) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedWeight);
      return;
    }

    const item = state.items.find(item => {
      const itemProductId = item.product._id || item.product.id;
      const matchId = itemProductId === productId;
      const isVeg = item.product?.category?.toLowerCase().includes('vegetable') || item.product?.category === 'Fresh Vegetables';
      if (!matchId) return false;
      if (isVeg && selectedWeight !== undefined) return item.product?.selectedWeight === selectedWeight;
      return true;
    });

    if (item) {
      const availableStock = item.product.quantity || item.product.stockQuantity || 0;
      if (quantity > availableStock) {
        return {
          success: false,
          message: 'Insufficient stock available'
        };
      }
    }

    dispatch({
      type: 'UPDATE_QUANTITY',
      payload: { productId, quantity, selectedWeight }
    });

    return { success: true };
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const toggleCart = () => {
    dispatch({ type: 'TOGGLE_CART' });
  };

  const setCartOpen = (isOpen) => {
    dispatch({ type: 'SET_CART_OPEN', payload: isOpen });
  };

  const getItemQuantity = (productId) => {
    const item = state.items.find(item => {
      const itemProductId = item.product._id || item.product.id;
      return itemProductId === productId;
    });
    return item ? item.quantity : 0;
  };

  const isInCart = (productId) => {
    return state.items.some(item => {
      const itemProductId = item.product._id || item.product.id;
      return itemProductId === productId;
    });
  };

  const value = {
    items: state.items,
    isOpen: state.isOpen,
    total: state.total,
    itemCount: state.itemCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    toggleCart,
    setCartOpen,
    getItemQuantity,
    isInCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}