import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  MessageSquare,
  FileText,
  Tag,
  Gift,
  Zap,
  LogOut,
  Menu,
  X,
  Store,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import './AdminLayout.css';

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/contacts', label: 'Contacts', icon: FileText },
  { to: '/admin/voucher', label: 'Vouchers', icon: Gift },
  { to: '/admin/deals', label: 'Deals', icon: Zap },
  { to: '/admin/categories', label: 'Categories', icon: Tag },
];

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setSidebarOpen(false);
  };

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
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
              <div className="admin-sidebar__user-avatar">
                {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="admin-sidebar__user-info">
                <span className="admin-sidebar__user-name">{user?.name || 'Admin'}</span>
                <span className="admin-sidebar__user-email">{user?.email}</span>
              </div>
              <button
                type="button"
                className="admin-sidebar__logout"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
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
            <div className="admin-topbar__user">
              <span className="admin-topbar__avatar" aria-hidden>
                {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </span>
              <span className="admin-topbar__user-name">{user?.name || user?.email || 'Admin'}</span>
              <button
                type="button"
                className="admin-topbar__logout"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
