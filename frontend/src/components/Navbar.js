import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useSiteBranding } from '../context/SiteBrandingContext';
import '../styles/components/Navbar.css';
import logoRemo from "../assets-copy/navbar/logoRemo.svg";
import {
  User,
  ShoppingCart,
  Search,
  ChevronDown,
  Menu,
  X,
  Grid3X3,
  Heart,
  Plus,
  Mail,
} from 'lucide-react';
import Lottie from 'lottie-react';
import { MAIN_CATEGORIES, SUBCATEGORIES_BY_MAIN } from '../config/categories';
import api from '../services/api';

function navNormCategoryKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const FIRE_JSON_URL = process.env.PUBLIC_URL + '/fire.json';

const SEARCH_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'Daily Essentials', label: 'Daily Essentials' },
  { value: 'Milks and Dairies', label: 'Milks and Dairies' },
  { value: 'Spices & Masalas', label: 'Spices & Masalas' },
  { value: 'Fresh Vegetables', label: 'Fresh Vegetables' },
  { value: 'Fresh Fruits', label: 'Fresh Fruits' },
  { value: 'Rice & Grains', label: 'Rice & Grains' },
  { value: 'Beverages', label: 'Beverages' },
  { value: 'Snacks & Sweets', label: 'Snacks & Sweets' },
  { value: 'Chinese Noodles', label: 'Chinese Noodles' },
  { value: 'Turkish Desserts', label: 'Turkish Desserts' },
  { value: 'American Breakfast Fusions', label: 'American Breakfast' },
  { value: 'Frozen Foods', label: 'Frozen Foods' },
  { value: 'Sauces & Condiments', label: 'Sauces & Condiments' },
  { value: 'Pooja Items', label: 'Pooja Items' },
];

/* Browse card uses MAIN_CATEGORIES + SUBCATEGORIES_BY_MAIN from config (grouped by main) */

function Navbar() {
  const { isAuthenticated, logout, isAdmin, isCoAdmin } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount, openDrawer: openWishlist } = useWishlist();
  const { websiteName, websiteLogoSrc } = useSiteBranding();

  /** From GET /user/getCategories (active only). Null = not loaded yet — keep static lists. */
  const [searchCategoryOptions, setSearchCategoryOptions] = useState(SEARCH_CATEGORIES);
  const [activeCategoryNameKeys, setActiveCategoryNameKeys] = useState(null);

  const handleOpenWishlist = () => {
    openWishlist();
    setIsMobileMenuOpen(false);
  };
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [browseDropdownOpen, setBrowseDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const categoryDropdownRef = useRef(null);
  const browseDropdownRef = useRef(null);
  const [fireAnimation, setFireAnimation] = useState(null);

  useEffect(() => {
    fetch(FIRE_JSON_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setFireAnimation)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/user/getCategories')
      .then((res) => {
        if (cancelled || !res?.success || !Array.isArray(res.data)) return;
        const keys = new Set(
          res.data
            .map((c) => navNormCategoryKey(c?.name || c?.displayTitle || ''))
            .filter(Boolean),
        );
        setActiveCategoryNameKeys(keys);
        const opts = [
          { value: '', label: 'All Categories' },
          ...res.data
            .filter((c) => c && (c.name || c.displayTitle))
            .map((c) => ({
              value: String(c.name || '').trim(),
              label: String((c.displayTitle && c.displayTitle.trim()) || c.name || '').trim() || String(c.name),
            })),
        ];
        if (opts.length > 1) setSearchCategoryOptions(opts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) setIsCategoryDropdownOpen(false);
      if (browseDropdownRef.current && !browseDropdownRef.current.contains(e.target)) setBrowseDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (searchCategory) params.set('category', searchCategory);
    navigate(`/products${params.toString() ? `?${params.toString()}` : ''}`);
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  const filteredCategories = categoryFilter.trim()
    ? searchCategoryOptions.filter((c) =>
        c.label.toLowerCase().includes(categoryFilter.toLowerCase())
      )
    : searchCategoryOptions;

  const selectCategory = (value) => {
    setSearchCategory(value);
    setIsCategoryDropdownOpen(false);
    setCategoryFilter('');
  };

  return (
    <header className="header-nest">
      {/* ----- 1. Top bar (dark) ----- */}
      <div className="header-top">
        <div className="header-top__inner container">
          {/* Desktop: marquee only */}
          <div className="header-top__center header-top__desktop-only">
            <div className="header-top__marquee-wrap header-top__marquee--desktop">
              <div className="header-top__marquee">
                <div className="header-top__marquee-inner header-top__marquee-inner--desktop">
                  <span>🥦 Fresh groceries delivered to your door – shop with ease 🥕</span>
                  <span>🥦 Free delivery on orders over $50 – order now! 🥕</span>
                  <span>🥦 Best quality, best prices – Zippyyy has it all 🥕</span>
                  <span>🥦 Fresh groceries delivered to your door – shop with ease 🥕</span>
                  <span>🥦 Free delivery on orders over $50 – order now! 🥕</span>
                  <span>🥦 Best quality, best prices – Zippyyy has it all 🥕</span>
                </div>
              </div>
            </div>
          </div>
          {/* Mobile: marquee only */}
          <div className="header-top__marquee-wrap header-top__mobile-only" aria-hidden="true">
            <div className="header-top__marquee">
              <div className="header-top__marquee-inner">
                <span>🥦 Hot deals this week – Free delivery on orders over $50 – Fresh groceries to your door 🥕</span>
                <span>🥦 Hot deals this week – Free delivery on orders over $50 – Fresh groceries to your door 🥕</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----- 2. Main bar (logo + browse, search, location, compare, wishlist, cart, account, support) ----- */}
      <div className="header-main">
        <div className={`header-main__inner container${isAdmin ? " header-main__inner--admin-mobile" : ""}`}>
          <Link to="/" className="header-main__logo">
            <img
              src={websiteLogoSrc || logoRemo}
              alt={`${websiteName || 'Zippyyy'} home`}
              className="header-main__logo-img"
            />
          </Link>

          {!isAdmin && (
            <NavLink
              to="/zippyyy-ships"
              className={({ isActive }) =>
                `header-main__ships-tab mobile-only${isActive ? ' header-main__ships-tab--active' : ''}`
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Zippyyy Ships
            </NavLink>
          )}

          <form className="header-search desktop-only" onSubmit={handleSearchSubmit}>
            <div className="header-search__category" ref={categoryDropdownRef}>
              <button
                type="button"
                className="header-search__category-btn"
                onClick={() => setIsCategoryDropdownOpen((p) => !p)}
                aria-expanded={isCategoryDropdownOpen}
                aria-haspopup="listbox"
              >
                <span>{searchCategoryOptions.find((c) => c.value === searchCategory)?.label || 'All Categories'}</span>
                <ChevronDown className="header-search__chevron" size={16} />
              </button>
              <div className={`header-search__category-dropdown ${isCategoryDropdownOpen ? 'open' : ''}`}>
                <input
                  type="text"
                  className="header-search__category-filter"
                  placeholder="Filter categories..."
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Filter categories"
                />
                <ul className="header-search__category-list" role="listbox">
                  {filteredCategories.map((cat) => (
                    <li key={cat.value || 'all'}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={searchCategory === cat.value}
                        className={`header-search__category-option ${searchCategory === cat.value ? 'selected' : ''}`}
                        onClick={() => selectCategory(cat.value)}
                      >
                        {cat.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <input
              type="search"
              className="header-search__input"
              placeholder="Search for items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
            />
            <button type="submit" className="header-search__btn" aria-label="Search">
              <Search size={22} />
            </button>
          </form>

          <div className="header-main__actions">
            <button
              type="button"
              className="header-main__action header-main__icon-action desktop-only"
              aria-label="Wishlist"
              onClick={handleOpenWishlist}
            >
              <Heart size={22} className="header-main__action-icon" />
              <span className="header-main__badge">{wishlistCount}</span>
            </button>
            {!isAdmin && (
              <Link to="/cart" className="header-main__action header-main__icon-action header-main__cart" aria-label="Cart">
                <ShoppingCart size={22} className="header-main__action-icon" />
                <span className="header-main__badge">{itemCount}</span>
              </Link>
            )}
            <div className="header-main__action header-main__account" ref={dropdownRef}>
              <button
                type="button"
                className="header-main__account-btn"
                onClick={() => setIsDropdownOpen((p) => !p)}
                aria-label="Account"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <User size={22} className="header-main__action-icon" />
              </button>
              <div className={`header-main__dropdown ${isDropdownOpen ? 'show' : ''}`}>
            {isAuthenticated ? (
                  <>
                    {!isAdmin && !isCoAdmin && (
                      <>
                        <Link to="/profile" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Profile</Link>
                        <Link to="/orders" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>My Orders</Link>
                      </>
                    )}
                    {isCoAdmin && !isAdmin && (
                      <Link to="/co-admin/dashboard" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Co-Admin Panel</Link>
                    )}
                    {isAdmin && (
                      <>
                        <Link to="/admin/dashboard" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Dashboard</Link>
                        <Link to="/admin/products" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Products</Link>
                        <Link to="/admin/orders" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Orders</Link>
                        <Link to="/admin/users" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Users</Link>
                        <Link to="/admin/contacts" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Contacts</Link>
                      </>
                    )}
                    <div className="header-main__dropdown-divider" />
                    <button type="button" className="header-main__dropdown-item header-main__dropdown-logout" onClick={handleLogout}>Logout</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Sign In</Link>
                    <Link to="/register" className="header-main__dropdown-item" onClick={() => setIsDropdownOpen(false)}>Sign Up</Link>
                  </>
                )}
              </div>
              </div>

            <button
              type="button"
              className="header-main__menu-btn mobile-only"
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile search bar hidden on mobile per design – use main search from menu or product pages */}
        <form className="header-search header-search--mobile header-search--mobile-hidden" onSubmit={handleSearchSubmit} aria-hidden="true">
          <input
            type="search"
            className="header-search__input"
            placeholder="Search for items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search products"
          />
          <button type="submit" className="header-search__btn" aria-label="Search">
            <Search size={22} />
          </button>
        </form>
      </div>

      {/* ----- 3. Nav bar: Browse left (with card dropdown), menu center, Support right ----- */}
      <div className="header-nav">
        <div className="header-nav__inner container">
          <div className="header-nav__browse-wrap desktop-only" ref={browseDropdownRef}>
            <button
              type="button"
              className={`header-nav__browse ${browseDropdownOpen ? 'open' : ''}`}
              onClick={() => setBrowseDropdownOpen((p) => !p)}
              aria-expanded={browseDropdownOpen}
              aria-haspopup="true"
            >
              <Grid3X3 size={20} />
              <span>Browse All Categories</span>
              <ChevronDown size={16} className={browseDropdownOpen ? 'rotate' : ''} />
            </button>
            <div className={`header-nav__browse-card ${browseDropdownOpen ? 'open' : ''}`}>
              <div className="header-nav__browse-groups">
                {MAIN_CATEGORIES.filter((m) => m.id !== 'all').map((main) => (
                  <div key={main.id} className="header-nav__browse-group">
                    <div className="header-nav__browse-group-title">{main.name}</div>
                    <div className="header-nav__browse-group-list">
                      {(SUBCATEGORIES_BY_MAIN[main.id] || [])
                        .filter((sub) => {
                          if (activeCategoryNameKeys == null) return true;
                          return activeCategoryNameKeys.has(navNormCategoryKey(sub.value));
                        })
                        .map((sub) => (
                        <Link
                          key={sub.value}
                          to={`/products?category=${encodeURIComponent(sub.value)}&main=${main.id}`}
                          className="header-nav__browse-item"
                          onClick={() => setBrowseDropdownOpen(false)}
                        >
                          <span className="header-nav__browse-name">{sub.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/products"
                className="header-nav__browse-more"
                onClick={() => setBrowseDropdownOpen(false)}
              >
                <Plus size={18} />
                <span>Show more...</span>
              </Link>
            </div>
          </div>
          <nav className="header-nav__links desktop-only" aria-label="Main navigation">
            {!isAdmin ? (
              <>
                <NavLink to="/hot-deals" className={({ isActive }) => `header-nav__link header-nav__link--hot ${isActive ? 'active' : ''}`}>
                  <span className="header-nav__fire-wrap">
                    {fireAnimation ? (
                      <Lottie animationData={fireAnimation} loop className="header-nav__fire-lottie" />
                    ) : (
                      <span className="header-nav__fire-emoji" aria-hidden>🥦</span>
                    )}
                  </span>
                  Hot Deals
                </NavLink>
                <a
                  href={`${process.env.PUBLIC_URL || ''}/zippyyy-ships`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="header-nav__link"
                >
                  Zippyyy Ships
                </a>
                <NavLink to="/" end className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>Home</NavLink>
                <NavLink to="/about" className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>About</NavLink>
                <NavLink to="/products" className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>Shop</NavLink>
                <NavLink to="/contact" className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>Contact</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/admin/dashboard" className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
                <NavLink to="/admin/products" className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>Products</NavLink>
                <NavLink to="/admin/orders" className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>Orders</NavLink>
                <NavLink to="/admin/users" className={({ isActive }) => `header-nav__link ${isActive ? 'active' : ''}`}>Users</NavLink>
              </>
            )}
          </nav>
          <div className="header-nav__support desktop-only">
            <a href="mailto:contact@zippyyy.com" className="header-nav__support-link">
              <Mail size={24} className="header-nav__support-icon" />
              <span className="header-nav__support-email">contact@zippyyy.com</span>
            </a>
          </div>
        </div>
      </div>

      {/* ----- Mobile menu drawer ----- */}
      <div className={`header-mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="header-mobile-menu__content">
          <Link to="/hot-deals" className="header-mobile-menu__link header-mobile-menu__link--hot" onClick={toggleMobileMenu}>
            <span className="header-mobile-menu__fire-wrap">
              {fireAnimation ? (
                <Lottie animationData={fireAnimation} loop className="header-mobile-menu__fire-lottie" />
              ) : (
                <span className="header-mobile-menu__fire-emoji" aria-hidden>🥦</span>
              )}
            </span>
            Hot Deals
          </Link>
          <NavLink to="/" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Home</NavLink>
          <NavLink to="/products" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Shop</NavLink>
          <NavLink to="/about" className="header-mobile-menu__link" onClick={toggleMobileMenu}>About</NavLink>
          <NavLink to="/contact" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Contact</NavLink>
          <Link to="/products" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Browse All Categories</Link>
          {isAuthenticated && (
            <>
              <div className="header-mobile-menu__divider" />
              <Link to="/profile" className="header-mobile-menu__link" onClick={toggleMobileMenu}>My Account</Link>
              <Link to="/orders" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Order Tracking</Link>
              {isCoAdmin && !isAdmin && (
                <Link to="/co-admin/dashboard" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Co-Admin Panel</Link>
              )}
              {isAdmin && (
                <>
                  <Link to="/admin/dashboard" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Dashboard</Link>
                  <Link to="/admin/products" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Products</Link>
                  <Link to="/admin/orders" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Orders</Link>
                  <Link to="/admin/users" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Users</Link>
                  <Link to="/admin/contacts" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Contacts</Link>
                </>
              )}
              <button type="button" className="header-mobile-menu__link header-mobile-menu__logout" onClick={handleLogout}>Logout</button>
            </>
          )}
          {!isAuthenticated && (
            <div className="header-mobile-menu__auth">
              <Link to="/login" className="header-mobile-menu__link" onClick={toggleMobileMenu}>Sign In</Link>
              <Link to="/register" className="header-mobile-menu__link header-mobile-menu__link--primary" onClick={toggleMobileMenu}>Sign Up</Link>
            </div>
          )}
          <a
            href="mailto:contact@zippyyy.com"
            className="header-mobile-menu__support"
            onClick={toggleMobileMenu}
          >
            <Mail size={20} aria-hidden />
            <span>contact@zippyyy.com</span>
          </a>
        </div>
      </div>
      <div
        className={`header-mobile-menu__backdrop ${isMobileMenuOpen ? 'open' : ''}`}
        aria-hidden="true"
        onClick={toggleMobileMenu}
      />
    </header>
  );
}

export default Navbar;
