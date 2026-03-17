import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Home } from 'lucide-react';
import '../styles/pages/NotFound.css';

function NotFound() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const q = (searchTerm || '').trim();
    if (q) navigate(`/products?search=${encodeURIComponent(q)}`);
    else navigate('/products');
  };

  return (
    <div className="not-found-page">
      <div className="not-found-page__inner">
        <div className="not-found-page__code">
          <span className="not-found-page__digit">4</span>
          <span className="not-found-page__cookie" aria-hidden="true">🍪</span>
          <span className="not-found-page__digit">4</span>
        </div>
        <h1 className="not-found-page__title">Oops! Why you&apos;re here?</h1>
        <p className="not-found-page__text">
          We are very sorry for the inconvenience. It looks like you&apos;re trying to access a page that either has been deleted or never existed.
        </p>
        <form onSubmit={handleSearch} className="not-found-page__search-wrap">
          <input
            type="text"
            className="not-found-page__search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search products"
          />
          <button type="submit" className="not-found-page__search-btn" aria-label="Search">
            <Search size={20} strokeWidth={2} />
          </button>
        </form>
        <Link to="/" className="not-found-page__home-btn">
          <Home size={20} strokeWidth={2.5} />
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
