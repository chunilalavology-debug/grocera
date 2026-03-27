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

  useEffect(() => {
    if (isAdmin) fetchDashboardData();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      await api.get(`/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ordersResponse = await fetch(`${API_URL}/admin/orders?limit=1000`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      let allOrders = [];
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        allOrders = ordersData.orders || [];
      }

      const now = new Date();
      const periods = {
        day: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        week: new Date(new Date().setDate(now.getDate() - 7)),
        month: new Date(new Date().setMonth(now.getMonth() - 1)),
      };

      const calculate = (startDate) => {
        const filtered = allOrders.filter(
          (o) => new Date(o.createdAt) >= startDate && o.paymentStatus === 'completed'
        );
        const sales = filtered.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const profit = filtered.reduce(
          (sum, o) =>
            sum +
            (o.items?.reduce(
              (isum, i) =>
                isum +
                ((i.price || 0) - (i.product?.cost || 0)) * (i.quantity || 0),
              0
            ) || 0),
          0
        );
        return { sales, profit };
      };

      const dayData = calculate(periods.day);
      const weekData = calculate(periods.week);
      const monthData = calculate(periods.month);

      const productsResponse = await fetch(`${API_URL}/admin/products`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      let prodStats = { total: 0, low: 0 };
      if (productsResponse.ok) {
        const pData = await productsResponse.json();
        const items = pData.products || pData.data || [];
        prodStats = { total: items.length, low: items.filter((p) => (p.quantity || 0) < 10).length };
      }

      setStats({
        sales: { day: dayData.sales, week: weekData.sales, month: monthData.sales },
        orders: {
          pending: allOrders.filter((o) => ['pending', 'processing'].includes(o.status)).length,
          delivered: allOrders.filter((o) => o.status === 'delivered').length,
          total: allOrders.length,
        },
        profits: { day: dayData.profit, week: weekData.profit, month: monthData.profit },
        products: { total: prodStats.total, lowStock: prodStats.low },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="admin-overview-loading">
        <div className="admin-overview-spinner" aria-hidden />
        <p className="admin-overview-loading-text">Loading overview…</p>
      </div>
    );

  const periodLabel = { day: 'Today', week: 'Last 7 days', month: 'Last 30 days' }[selectedPeriod];

  return (
    <div className="admin-overview">
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

      <div className="admin-overview__grid">
        <section className="admin-overview__actions">
          <h2 className="admin-overview__section-title">Quick actions</h2>
          <div className="admin-overview-actions">
            <ActionLink to="/admin/products" icon={PlusCircle} label="Products" desc="Add and manage products" />
            <ActionLink to="/admin/orders" icon={ClipboardList} label="Orders" desc="View and fulfill orders" />
            <ActionLink to="/admin/users" icon={Users} label="Users" desc="Manage customer accounts" />
            <ActionLink to="/admin/categories" icon={Tag} label="Categories" desc="Organize catalog" />
            <ActionLink to="/admin/voucher" icon={Gift} label="Vouchers" desc="Discount codes" />
            <ActionLink to="/admin/deals" icon={Zap} label="Deals" desc="Hot deals and promotions" />
          </div>
        </section>

        <aside className="admin-overview__sidebar">
          <div className="admin-overview-card">
            <h2 className="admin-overview__section-title">Order summary</h2>
            <div className="admin-overview-summary">
              <div className="admin-overview-summary__row">
                <span className="admin-overview-summary__label">
                  <PackageCheck size={16} /> Delivered
                </span>
                <span className="admin-overview-summary__value">{stats.orders.delivered}</span>
              </div>
              <div
                className="admin-overview-summary__bar admin-overview-summary__bar--success"
                style={{
                  width: `${stats.orders.total ? (stats.orders.delivered / stats.orders.total) * 100 : 0}%`,
                }}
              />
              <div className="admin-overview-summary__row">
                <span className="admin-overview-summary__label">
                  <Clock size={16} /> Pending
                </span>
                <span className="admin-overview-summary__value">{stats.orders.pending}</span>
              </div>
              <div
                className="admin-overview-summary__bar admin-overview-summary__bar--warning"
                style={{
                  width: `${stats.orders.total ? (stats.orders.pending / stats.orders.total) * 100 : 0}%`,
                }}
              />
            </div>

            {stats.products.lowStock > 0 && (
              <div className="admin-overview-alert">
                <AlertTriangle size={20} className="admin-overview-alert__icon" />
                <div>
                  <p className="admin-overview-alert__title">Low stock</p>
                  <p className="admin-overview-alert__text">
                    {stats.products.lowStock} product{stats.products.lowStock !== 1 ? 's' : ''} need restocking.
                  </p>
                  <Link to="/admin/products" className="admin-overview-alert__link">
                    Manage products <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActionLink({ to, icon: Icon, label, desc }) {
  return (
    <Link to={to} className="admin-overview-action">
      <div className="admin-overview-action__icon">
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="admin-overview-action__text">
        <span className="admin-overview-action__label">{label}</span>
        <span className="admin-overview-action__desc">{desc}</span>
      </div>
      <ChevronRight size={18} className="admin-overview-action__chevron" />
    </Link>
  );
}

export default AdminDashboard;
