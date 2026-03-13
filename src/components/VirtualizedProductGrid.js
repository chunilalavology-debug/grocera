import React, { useMemo, useCallback } from 'react';
import { Grid } from 'react-window';

const ProductItem = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const { products, onAddToCart, itemsPerRow } = data;
  const index = rowIndex * itemsPerRow + columnIndex;
  const product = products[index];

  if (!product) {
    return <div style={style} />;
  }

  return (
    <div style={style}>
      <div className="product-card virtualized">
        <div className="product-image">
          <div className="image-placeholder">
            <i className="product-icon">🛒</i>
          </div>
          {product.inStock && <div className="stock-badge">In Stock</div>}
        </div>
        
        <div className="product-info">
          <div className="product-category">{product.category}</div>
          <h3 className="product-name">{product.name}</h3>
          <p className="product-description">{product.description}</p>
          
          <div className="product-footer">
            <div className="product-price">
              <span className="currency">$</span>
              <span className="amount">{product.price}</span>
            </div>
            
            <button 
              className="add-to-cart-btn"
              onClick={() => onAddToCart(product)}
              disabled={!product.inStock}
            >
              <i className="cart-icon">🛒</i>
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ProductItem.displayName = 'ProductItem';

const VirtualizedProductGrid = ({ products, onAddToCart, containerWidth = 1200 }) => {
  // Calculate items per row based on container width and item width
  const itemWidth = 300;
  const itemHeight = 400;
  const gap = 20;
  
  const itemsPerRow = useMemo(() => {
    return Math.floor((containerWidth + gap) / (itemWidth + gap));
  }, [containerWidth]);

  const rowCount = useMemo(() => {
    return Math.ceil(products.length / itemsPerRow);
  }, [products.length, itemsPerRow]);

  const itemData = useMemo(() => ({
    products,
    onAddToCart,
    itemsPerRow
  }), [products, onAddToCart, itemsPerRow]);

  const getGridHeight = useCallback(() => {
    // Calculate height based on number of rows, but cap it for better UX
    const maxVisibleRows = 6; // Show maximum 6 rows at once
    const visibleRows = Math.min(rowCount, maxVisibleRows);
    return visibleRows * (itemHeight + gap) - gap;
  }, [rowCount, itemHeight, gap]);

  if (products.length === 0) {
    return (
      <div className="no-products">
        <div className="no-products-icon">🔍</div>
        <h3>No products found</h3>
        <p>Try adjusting your search or category filter</p>
      </div>
    );
  }

  return (
    <div className="virtualized-grid-container">
      <Grid
        columnCount={itemsPerRow}
        columnWidth={itemWidth + gap}
        height={getGridHeight()}
        rowCount={rowCount}
        rowHeight={itemHeight + gap}
        width={containerWidth}
        itemData={itemData}
        style={{ overflowX: 'hidden' }}
      >
        {ProductItem}
      </Grid>
    </div>
  );
};

export default React.memo(VirtualizedProductGrid);