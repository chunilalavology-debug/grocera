import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  MessageSquare,
  FileText,
  Gift,
  Zap,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Store,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  User,
  Settings,
} from 'lucide-react';
import '../styles/admin-tokens.css';
import './AdminLayout.css';
import AdminUserAvatar from './AdminUserAvatar';

const PRODUCT_SUBLINKS = [
  { to: '/admin/products', label: 'All products', end: false },
  { to: '/admin/categories', label: 'Categories', end: false },
];

const NAV_ITEMS_BEFORE_PRODUCTS = [{ to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard }];

const NAV_ITEMS_AFTER_PRODUCTS = [
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/contacts', label: 'Contacts', icon: FileText },
  { to: '/admin/voucher', label: 'Vouchers', icon: Gift },
  { to: '/admin/deals', label: 'Deals', icon: Zap },
  { to: '/admin/slider-settings', label: 'Slider Settings', icon: SlidersHorizontal },
];

const SETTINGS_SUBLINKS = [
  { to: '/admin/settings/storefront', label: 'Storefront', end: true },
  { to: '/admin/settings/shipping-api', label: 'Shipping API (Easyship)', end: true },
  { to: '/admin/settings/coming-soon', label: 'Coming soon', end: true },
  { to: '/admin/settings/general', label: 'General', end: true },
  { to: '/admin/settings/profile', label: 'Profile', end: true },
  { to: '/admin/settings', label: 'Notifications & homepage', end: true },
  { to: '/admin/settings/email', label: 'Email & SMTP', end: false },
  { to: '/admin/settings/email-center', label: 'Email notifications & templates', end: false },
];

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const messagesFullBleed = path.startsWith('/admin/messages');
  const catalogFullBleed = path.startsWith('/admin/products') || path.startsWith('/admin/categories');
  const inProductArea = catalogFullBleed;
  const inSettingsArea = path.startsWith('/admin/settings');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [productsNavOpen, setProductsNavOpen] = useState(inProductArea);
  const [settingsNavOpen, setSettingsNavOpen] = useState(inSettingsArea);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (inProductArea) setProductsNavOpen(true);
  }, [inProductArea]);

  useEffect(() => {
    if (inSettingsArea) setSettingsNavOpen(true);
  }, [inSettingsArea]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setSidebarOpen(false);
    setUserMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`admin-layout ${sidebarOpen ? 'admin-layout--sidebar-open' : ''}`}>
      {/* Overlay when sidebar is open on mobile */}
      <div
        className="admin-sidebar-overlay"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar__inner">
          <div className="admin-sidebar__brand">
            <Link to="/admin/dashboard" className="admin-sidebar__brand-link" onClick={() => setSidebarOpen(false)}>
              <span className="admin-sidebar__brand-icon">
                <Store size={22} strokeWidth={2} />
              </span>
              <span className="admin-sidebar__brand-text">Admin</span>
            </Link>
            <button
              type="button"
              className="admin-sidebar__close"
              aria-label="Close menu"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <nav className="admin-sidebar__nav" aria-label="Admin navigation">
            <span className="admin-sidebar__nav-label">Menu</span>
            <ul className="admin-sidebar__nav-list">
              {NAV_ITEMS_BEFORE_PRODUCTS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/admin/dashboard'}
                    className={({ isActive }) =>
                      `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`
                    }
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="admin-sidebar__link-icon">
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <span className="admin-sidebar__link-text">{label}</span>
                    <ChevronRight size={16} className="admin-sidebar__link-chevron" />
                  </NavLink>
                </li>
              ))}

              <li className="admin-sidebar__nav-group">
                <button
                  type="button"
                  className={`admin-sidebar__group-toggle ${inProductArea ? 'admin-sidebar__group-toggle--within' : ''}`}
                  aria-expanded={productsNavOpen}
                  onClick={() => setProductsNavOpen((o) => !o)}
                >
                  <span className="admin-sidebar__link-icon">
                    <Package size={20} strokeWidth={2} />
                  </span>
                  <span className="admin-sidebar__link-text">Products</span>
                  <ChevronDown
                    size={18}
                    className={`admin-sidebar__group-chevron ${productsNavOpen ? 'admin-sidebar__group-chevron--open' : ''}`}
                    aria-hidden
                  />
                </button>
                <div
                  className={`admin-sidebar__sublinks-wrapper ${productsNavOpen ? 'admin-sidebar__sublinks-wrapper--open' : ''}`}
                >
                  <div className="admin-sidebar__sublinks-inner">
                    <ul className="admin-sidebar__sublinks">
                      {PRODUCT_SUBLINKS.map(({ to, label, end }) => (
                        <li key={to}>
                          <NavLink
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                              `admin-sidebar__sublink ${isActive ? 'admin-sidebar__sublink--active' : ''}`
                            }
                            onClick={() => setSidebarOpen(false)}
                          >
                            {label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>

              {NAV_ITEMS_AFTER_PRODUCTS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/admin/dashboard'}
                    className={({ isActive }) =>
                      `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`
                    }
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="admin-sidebar__link-icon">
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <span className="admin-sidebar__link-text">{label}</span>
                    <ChevronRight size={16} className="admin-sidebar__link-chevron" />
                  </NavLink>
                </li>
              ))}

              <li className="admin-sidebar__nav-group">
                <button
                  type="button"
                  className={`admin-sidebar__group-toggle ${inSettingsArea ? 'admin-sidebar__group-toggle--within' : ''}`}
                  aria-expanded={settingsNavOpen}
                  onClick={() => setSettingsNavOpen((o) => !o)}
                >
                  <span className="admin-sidebar__link-icon">
                    <Settings size={20} strokeWidth={2} />
                  </span>
                  <span className="admin-sidebar__link-text">Settings</span>
                  <ChevronDown
                    size={18}
                    className={`admin-sidebar__group-chevron ${settingsNavOpen ? 'admin-sidebar__group-chevron--open' : ''}`}
                    aria-hidden
                  />
                </button>
                <div
                  className={`admin-sidebar__sublinks-wrapper ${settingsNavOpen ? 'admin-sidebar__sublinks-wrapper--open' : ''}`}
                >
                  <div className="admin-sidebar__sublinks-inner">
                    <ul className="admin-sidebar__sublinks">
                      {SETTINGS_SUBLINKS.map(({ to, label, end }) => (
                        <li key={to}>
                          <NavLink
                            to={to}
                            end={Boolean(end)}
                            className={({ isActive }) =>
                              `admin-sidebar__sublink ${isActive ? 'admin-sidebar__sublink--active' : ''}`
                            }
                            onClick={() => setSidebarOpen(false)}
                          >
                            {label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            </ul>
          </nav>

          <div className="admin-sidebar__footer">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-sidebar__store-link"
              onClick={() => setSidebarOpen(false)}
            >
              <ExternalLink size={18} />
              <span>View store</span>
            </Link>
            <div className="admin-sidebar__user">
              <AdminUserAvatar user={user} className="admin-sidebar__user-avatar" />
              <div className="admin-sidebar__user-info">
                <span className="admin-sidebar__user-name">{user?.name || 'Admin'}</span>
                <span className="admin-sidebar__user-email">{user?.email}</span>
              </div>
            </div>
            <button
              type="button"
              className="admin-sidebar__logout-link"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-body">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-topbar__menu"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="admin-topbar__right">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-topbar__store-link"
            >
              <ExternalLink size={16} />
              <span>View store</span>
            </Link>
            <div className="admin-topbar__user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="admin-topbar__user admin-topbar__user-btn"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <AdminUserAvatar user={user} className="admin-topbar__avatar" aria-hidden />
                <span className="admin-topbar__user-name">{user?.name || user?.email || 'Admin'}</span>
                <ChevronDown size={16} className={`admin-topbar__user-chevron ${userMenuOpen ? 'is-open' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="admin-topbar__dropdown" role="menu" aria-label="User menu">
                  <Link
                    to="/admin/settings/profile"
                    className="admin-topbar__dropdown-item"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User size={16} />
                    <span>Profile settings</span>
                  </Link>
                  <button
                    type="button"
                    className="admin-topbar__dropdown-item admin-topbar__dropdown-item--danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          className={`admin-main${messagesFullBleed ? ' admin-main--messages-bleed' : ''}${
            catalogFullBleed ? ' admin-main--catalog-bleed' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
