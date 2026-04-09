import React, { useState, useEffect, useMemo } from 'react';
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
  Mail,
  Percent,
  Sparkles,
  LayoutDashboard,
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
    messages: { unread: 0 },
    users: { customers: 0 },
    vouchers: { active: 0 },
  });
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) fetchDashboardData();
  }, [isAdmin]);

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
          messages: {
            unread: Number(dash.messages?.unread) || 0,
          },
          users: {
            customers: Number(dash.users?.customers) || 0,
          },
          vouchers: {
            active: Number(dash.vouchers?.active) || 0,
          },
        });
      }
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  };

  const fulfillmentPct = useMemo(() => {
    const t = stats.orders.total;
    if (!t) return 0;
    return Math.min(100, Math.round((stats.orders.delivered / t) * 100));
  }, [stats.orders.delivered, stats.orders.total]);

  if (!isAdmin) return <Navigate to="/" replace />;

  if (loading)
    return (
      <div className="admin-design-scope admin-overview-loading">
        <div className="admin-overview-spinner" aria-hidden />
        <p className="admin-overview-loading-text">Loading overview…</p>
      </div>
    );

  const periodLabel = { day: 'Today', week: 'Last 7 days', month: 'Last 30 days' }[selectedPeriod];

  const periodRevenue = Number(stats.sales[selectedPeriod]) || 0;
  const periodProfit = Number(stats.profits[selectedPeriod]) || 0;
  const marginPct =
    periodRevenue > 0 ? Math.min(100, Math.round((periodProfit / periodRevenue) * 100)) : 0;

  return (
    <div className="admin-design-scope admin-overview">
      <div className="admin-overview__hero">
        <div className="admin-overview__hero-inner">
          <div className="admin-overview__hero-copy">
            <p className="admin-overview__hero-eyebrow">
              <LayoutDashboard size={14} strokeWidth={2} aria-hidden />
              Admin overview
            </p>
            <h1 className="admin-overview__title">Overview</h1>
            <p className="admin-overview__subtitle">
              Welcome back, <strong>{user?.name || user?.email || 'Admin'}</strong>. Revenue, orders, and store health
              at a glance — switch the period to compare today vs last week or month.
            </p>
          </div>
          <div className="admin-overview__period admin-overview__period--hero">
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
      </div>

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
            <span className="admin-overview-kpi__meta">
              {marginPct > 0 ? `~${marginPct}% of period revenue` : 'Margin'}
            </span>
          </div>
        </div>
        <div className="admin-overview-kpi admin-overview-kpi--orders">
          <div className="admin-overview-kpi__icon">
            <Package size={22} strokeWidth={2} />
          </div>
          <div className="admin-overview-kpi__content">
            <span className="admin-overview-kpi__label">Orders</span>
            <span className="admin-overview-kpi__value">{stats.orders.total}</span>
            <span className="admin-overview-kpi__meta">{stats.orders.pending} pending · {stats.orders.delivered} delivered</span>
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

      <section className="admin-overview__stat-strip" aria-label="Snapshot">
        <Link to="/admin/messages" className="admin-overview-strip-card admin-overview-strip-card--mail">
          <Mail size={20} strokeWidth={2} aria-hidden />
          <div>
            <span className="admin-overview-strip-card__value">{stats.messages.unread}</span>
            <span className="admin-overview-strip-card__label">Unread messages</span>
          </div>
          <ChevronRight size={18} className="admin-overview-strip-card__chev" aria-hidden />
        </Link>
        <Link to="/admin/users" className="admin-overview-strip-card admin-overview-strip-card--users">
          <Users size={20} strokeWidth={2} aria-hidden />
          <div>
            <span className="admin-overview-strip-card__value">{stats.users.customers.toLocaleString()}</span>
            <span className="admin-overview-strip-card__label">Customers</span>
          </div>
          <ChevronRight size={18} className="admin-overview-strip-card__chev" aria-hidden />
        </Link>
        <Link to="/admin/voucher" className="admin-overview-strip-card admin-overview-strip-card--voucher">
          <Gift size={20} strokeWidth={2} aria-hidden />
          <div>
            <span className="admin-overview-strip-card__value">{stats.vouchers.active}</span>
            <span className="admin-overview-strip-card__label">Active vouchers</span>
          </div>
          <ChevronRight size={18} className="admin-overview-strip-card__chev" aria-hidden />
        </Link>
        <div className="admin-overview-strip-card admin-overview-strip-card--fulfill">
          <Percent size={20} strokeWidth={2} aria-hidden />
          <div>
            <span className="admin-overview-strip-card__value">{fulfillmentPct}%</span>
            <span className="admin-overview-strip-card__label">Delivered / all orders</span>
          </div>
        </div>
      </section>

      <section className="admin-overview__grid">
        <div>
          <section className="admin-overview__actions" aria-label="Quick actions">
            <h2 className="admin-overview__section-title">
              <Sparkles size={18} strokeWidth={2} className="admin-overview__section-icon" aria-hidden />
              Store management
            </h2>
            <div className="admin-overview-actions">
              {[
                { to: '/admin/products/new', icon: PlusCircle, label: 'Add product', desc: 'Create a new catalog item' },
                { to: '/admin/orders', icon: ClipboardList, label: 'Orders', desc: 'Review and update fulfillment' },
                { to: '/admin/messages', icon: MessageCircle, label: 'Messages', desc: 'Customer inbox' },
                { to: '/admin/settings/email-center', icon: Mail, label: 'Email center', desc: 'Templates & notifications' },
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
                Product totals exclude deleted SKUs; low stock is quantity under 10. Fulfillment % is delivered orders vs
                all orders in the system.
              </p>
            </div>
          </div>
        </div>

        <aside className="admin-overview-card admin-overview-card--accent" aria-label="At a glance">
          <h2 className="admin-overview__section-title admin-overview__section-title--card">
            At a glance
          </h2>
          <p className="admin-overview-card__hint">{periodLabel} snapshot</p>
          <div className="admin-overview-summary">
            <div className="admin-overview-summary__row">
              <span className="admin-overview-summary__label">
                <DollarSign size={16} strokeWidth={2} aria-hidden />
                Period revenue
              </span>
              <span className="admin-overview-summary__value">
                ${periodRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="admin-overview-summary__row">
              <span className="admin-overview-summary__label">
                <TrendingUp size={16} strokeWidth={2} aria-hidden />
                Period profit
              </span>
              <span className="admin-overview-summary__value">
                ${periodProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="admin-overview-summary__divider" />
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
                <Mail size={16} strokeWidth={2} aria-hidden />
                Unread inbox
              </span>
              <span className="admin-overview-summary__value">{stats.messages.unread}</span>
            </div>
            <div className="admin-overview-summary__row">
              <span className="admin-overview-summary__label">
                <ShoppingCart size={16} strokeWidth={2} aria-hidden />
                Low stock SKUs
              </span>
              <span className="admin-overview-summary__value">{stats.products.lowStock}</span>
            </div>
            <div className="admin-overview-summary__row">
              <span className="admin-overview-summary__label">
                <Users size={16} strokeWidth={2} aria-hidden />
                Customers
              </span>
              <span className="admin-overview-summary__value">{stats.users.customers.toLocaleString()}</span>
            </div>
          </div>
          <div className="admin-overview-card__links">
            <Link to="/admin/orders" className="admin-overview-alert__link">
              Open orders
              <ChevronRight size={14} />
            </Link>
            <Link to="/admin/messages" className="admin-overview-alert__link">
              Open messages
              <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default AdminDashboard;
