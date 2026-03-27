import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../services/api';
import './ProductSalePopup.css';

const SITE_COLOR = '#3090cf';
const DELAY_BEFORE_FIRST_MS = 4000;
const DELAY_AFTER_CLOSE_MS = 10000;

function getRandomProduct(products) {
  if (!products || products.length === 0) return null;
  return products[Math.floor(Math.random() * products.length)];
}

export default function ProductSalePopup() {
  const [products, setProducts] = useState([]);
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef(null);

  const scheduleNext = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const product = getRandomProduct(products);
      if (product) {
        setCurrent(product);
        setVisible(true);
      }
      timeoutRef.current = null;
    }, DELAY_AFTER_CLOSE_MS);
  }, [products]);

  const showNext = useCallback(() => {
    if (products.length === 0) return;
    const product = getRandomProduct(products);
    setCurrent(product);
    setVisible(true);
  }, [products]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/user/products', { params: { limit: 50 } });
        const list = res?.data ?? res?.products ?? [];
        const arr = Array.isArray(list) ? list : [];
        if (mounted && arr.length > 0) setProducts(arr);
      } catch (err) {
        if (mounted) setProducts([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (products.length === 0) return;
    const t = setTimeout(() => showNext(), DELAY_BEFORE_FIRST_MS);
    return () => clearTimeout(t);
  }, [products, showNext]);

  const handleClose = () => {
    setVisible(false);
    scheduleNext();
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!visible || !current) return null;

  const pid = current._id || current.id;
  const price = current.hasDeal ? current.finalPrice : current.price;
  const orig = current.originalPrice ?? current.compareAtPrice;
  const hasDiscount = orig != null && orig > 0 && price < orig;
  const name = current.name || 'Product';

  return (
    <div className="product-sale-popup" role="dialog" aria-label="Product on sale">
      <button
        type="button"
        className="product-sale-popup__close"
        onClick={handleClose}
        aria-label="Close notification"
      >
        <X size={18} strokeWidth={2.5} />
      </button>
      <Link
        to={`/products/${pid}`}
        className="product-sale-popup__link"
        onClick={() => setVisible(false)}
      >
        <span className="product-sale-popup__img-wrap">
          <img src={current.image} alt="" className="product-sale-popup__img" />
        </span>
        <span className="product-sale-popup__body">
          <p className="product-sale-popup__message">
            {name} is on-sale. Hurry up!
          </p>
          <span className="product-sale-popup__prices">
            {hasDiscount && (
              <span className="product-sale-popup__old">${Number(orig).toFixed(2)}</span>
            )}
            <span className="product-sale-popup__price" style={{ color: SITE_COLOR }}>
              ${Number(price).toFixed(2)}
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}
