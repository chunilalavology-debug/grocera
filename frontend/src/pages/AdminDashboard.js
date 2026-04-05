import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  Tag,
  PlusCircle,
  ClipboardList,
  Users,
  AlertTriangle,
  ChevronRight,
  PackageCheck,
  Clock,
  Gift,
  Zap,
  MessageCircle,
} from 'lucide-react';
import api from '../services/api';
import '../styles/pages/AdminDashboardOverview.css';

function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    sales: { day: 0, week: 0, month: 0 },
    orders: { pending: 0, delivered: 0, total: 0 },
    profits: { day: 0, week: 0, month: 0 },
    products: { total: 0, lowStock: 0 },
  });
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [loading, setLoading] = useState(true);
  const [contactAutoReplyPreview, setContactAutoReplyPreview] = useState('');
  const [contactAutoReplyLoading, setContactAutoReplyLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) fetchDashboardData();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        setContactAutoReplyLoading(true);
        const res = await api.get('/admin/settings');
        if (!cancelled && res?.success && res.data?.contactAutoReplyPreview != null) {
          setContactAutoReplyPreview(String(res.data.contactAutoReplyPreview));
        }
      } catch {
        if (!cancelled) setContactAutoReplyPreview('');
      } finally {
        if (!cancelled) setContactAutoReplyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const dash = await api.get('/admin/dashboard');
      if (dash?.sales && dash?.orders && dash?.profits && dash?.products) {
        setStats({
          sales: {
            day: Number(dash.sales.day) || 0,
            week: Number(dash.sales.week) || 0,
            month: Number(dash.sales.month) || 0,
          },
          orders: {
            pending: Number(dash.orders.pending) || 0,
            delivered: Number(dash.orders.delivered) || 0,
            total: Number(dash.orders.total) || 0,
          },
          profits: {
            day: Number(dash.profits.day) || 0,
            week: Number(dash.profits.week) || 0,
            month: Number(dash.profits.month) || 0,
          },
          products: {
            total: Number(dash.products.total) || 0,
            lowStock: Number(dash.products.lowStock) || 0,
          },
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="admin-design-scope admin-overview-loading">
        <div className="admin-overview-spinner" aria-hidden />
        <p className="admin-overview-loading-text">Loading overview…</p>
      </div>
    );

  const periodLabel = { day: 'Today', week: 'Last 7 days', month: 'Last 30 days' }[selectedPeriod];

  return (
    <div className="admin-design-scope admin-overview">
      <header className="admin-overview__header">
        <div className="admin-overview__header-top">
          <div>
            <h1 className="admin-overview__title">Overview</h1>
            <p className="admin-overview__subtitle">
              Welcome back, <strong>{user?.name || user?.email || 'Admin'}</strong>. Here’s what’s happening with your store.
            </p>
          </div>
          <div className="admin-overview__period">
            <span className="admin-overview__period-label">Period</span>
            <div className="admin-overview__period-tabs">
              {(['day', 'week', 'month']).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  className={`admin-overview__period-tab ${selectedPeriod === p ? 'admin-overview__period-tab--active' : ''}`}
                >
                  {({ day: 'Today', week: 'Last 7 days', month: 'Last 30 days' })[p] || p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="admin-overview__kpis" aria-label="Key metrics">
        <div className="admin-overview-kpi admin-overview-kpi--revenue">
          <div className="admin-overview-kpi__icon">
            <DollarSign size={22} strokeWidth={2} />
          </div>
          <div className="admin-overview-kpi__content">
            <span className="admin-overview-kpi__label">Revenue</span>
            <span className="admin-overview-kpi__value">
              ${Number(stats.sales[selectedPeriod]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="admin-overview-kpi__meta">{periodLabel}</span>
          </div>
        </div>
        <div className="admin-overview-kpi admin-overview-kpi--profit">
          <div className="admin-overview-kpi__icon">
            <TrendingUp size={22} strokeWidth={2} />
          </div>
          <div className="admin-overview-kpi__content">
            <span className="admin-overview-kpi__label">Net profit</span>
            <span className="admin-overview-kpi__value">
              ${Number(stats.profits[selectedPeriod]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="admin-overview-kpi__meta">Margin</span>
          </div>
        </div>
        <div className="admin-overview-kpi admin-overview-kpi--orders">
          <div className="admin-overview-kpi__icon">
            <Package size={22} strokeWidth={2} />
          </div>
          <div className="admin-overview-kpi__content">
            <span className="admin-overview-kpi__label">Orders</span>
            <span className="admin-overview-kpi__value">{stats.orders.total}</span>
            <span className="admin-overview-kpi__meta">{stats.orders.pending} pending</span>
          </div>
        </div>
        <div className="admin-overview-kpi admin-overview-kpi--inventory">
          <div className="admin-overview-kpi__icon">
            <ShoppingCart size={22} strokeWidth={2} />
          </div>
          <div className="admin-overview-kpi__content">
            <span className="admin-overview-kpi__label">Products</span>
            <span className="admin-overview-kpi__value">{stats.products.total}</span>
            <span className={`admin-overview-kpi__meta ${stats.products.lowStock > 0 ? 'admin-overview-kpi__meta--alert' : ''}`}>
              {stats.products.lowStock} low stock
            </span>
          </div>
        </div>
      </section>

      <section className="admin-overview__grid" style={{ marginTop: '2rem' }}>
        <div>
          <section className="admin-overview-auto-reply" aria-label="Automatic contact reply">
            <div className="admin-overview-auto-reply__inner">
              <div className="admin-overview-auto-reply__head">
                <div className="admin-overview-auto-reply__title-row">
                  <span className="admin-overview-auto-reply__icon" aria-hidden>
                    <MessageCircle size={20} strokeWidth={2} />
                  </span>
                  <h2 className="admin-overview-auto-reply__title">Contact auto-reply</h2>
                </div>
                <p className="admin-overview-auto-reply__desc">
                  Preview of the message customers see after submitting the contact form (from General / Notifications settings).
                </p>
                <Link to="/admin/settings/general" className="admin-overview-auto-reply__edit">
                  Edit in settings
                  <ChevronRight size={16} />
                </Link>
              </div>
              {contactAutoReplyLoading ? (
                <p className="admin-overview-auto-reply__loading">Loading preview…</p>
              ) : (
                <div className="admin-overview-auto-reply__body">
                  {contactAutoReplyPreview || 'No auto-reply template configured yet.'}
                </div>
              )}
            </div>
          </section>

          <section className="admin-overview__actions" aria-label="Quick actions">
            <h2 className="admin-overview__section-title">Store management</h2>
            <div className="admin-overview-actions">
              {[
                { to: '/admin/products/new', icon: PlusCircle, label: 'Add product', desc: 'Create a new catalog item' },
                { to: '/admin/orders', icon: ClipboardList, label: 'Orders', desc: 'Review and update fulfillment' },
                { to: '/admin/messages', icon: MessageCircle, label: 'Messages', desc: 'Customer inbox' },
                { to: '/admin/users', icon: Users, label: 'Users', desc: 'Accounts and roles' },
                { to: '/admin/categories', icon: Tag, label: 'Categories', desc: 'Organize your catalog' },
                { to: '/admin/voucher', icon: Gift, label: 'Vouchers', desc: 'Discount codes' },
                { to: '/admin/deals', icon: Zap, label: 'Deals', desc: 'Promotional pricing' },
                { to: '/admin/slider-settings', icon: PackageCheck, label: 'Home slider', desc: 'Hero slides' },
                { to: '/admin/settings', icon: Clock, label: 'Settings', desc: 'Storefront & notifications' },
              ].map(({ to, icon: Icon, label, desc }) => (
                <Link key={to} to={to} className="admin-overview-action">
                  <span className="admin-overview-action__icon">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <span className="admin-overview-action__text">
                    <span className="admin-overview-action__label">{label}</span>
                    <span className="admin-overview-action__desc">{desc}</span>
                  </span>
                  <ChevronRight size={18} className="admin-overview-action__chevron" aria-hidden />
                </Link>
              ))}
            </div>
          </section>

          <div className="admin-overview-alert" role="note">
            <AlertTriangle size={20} className="admin-overview-alert__icon" aria-hidden />
            <div>
              <p className="admin-overview-alert__title">Metrics note</p>
              <p className="admin-overview-alert__text">
                Revenue and profit include orders with payment status <strong>paid</strong> or <strong>completed</strong>.
                Product totals exclude deleted SKUs; low stock is quantity under 10.
              </p>
            </div>
          </div>
        </div>

        <aside className="admin-overview-card" aria-label="At a glance">
          <h2 className="admin-overview__section-title" style={{ marginTop: 0 }}>
            At a glance
          </h2>
          <div className="admin-overview-summary">
            <div className="admin-overview-summary__row">
              <span className="admin-overview-summary__label">
                <Package size={16} strokeWidth={2} aria-hidden />
                Pending orders
              </span>
              <span className="admin-overview-summary__value">{stats.orders.pending}</span>
            </div>
            <div
              className="admin-overview-summary__bar admin-overview-summary__bar--warning"
              style={{
                width: `${Math.min(100, stats.orders.total ? (stats.orders.pending / stats.orders.total) * 100 : 0)}%`,
              }}
            />
            <div className="admin-overview-summary__row">
              <span className="admin-overview-summary__label">
                <PackageCheck size={16} strokeWidth={2} aria-hidden />
                Delivered
              </span>
              <span className="admin-overview-summary__value">{stats.orders.delivered}</span>
            </div>
            <div
              className="admin-overview-summary__bar admin-overview-summary__bar--success"
              style={{
                width: `${Math.min(100, stats.orders.total ? (stats.orders.delivered / stats.orders.total) * 100 : 0)}%`,
              }}
            />
            <div className="admin-overview-summary__row">
              <span className="admin-overview-summary__label">
                <ShoppingCart size={16} strokeWidth={2} aria-hidden />
                Low stock SKUs
              </span>
              <span className="admin-overview-summary__value">{stats.products.lowStock}</span>
            </div>
          </div>
          <Link to="/admin/orders" className="admin-overview-alert__link" style={{ marginTop: '1rem' }}>
            Open orders
            <ChevronRight size={14} />
          </Link>
        </aside>
      </section>
    </div>
  );
}

export default AdminDashboard;
