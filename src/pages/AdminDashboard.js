import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, TrendingUp, Package,
  ShoppingCart, Tag, PlusCircle, Image as ImageIcon,
  ClipboardList, BarChart3, Users, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import api from '../services/api';

function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    sales: { day: 0, week: 0, month: 0 },
    orders: { pending: 0, delivered: 0, total: 0 },
    profits: { day: 0, week: 0, month: 0 },
    products: { total: 0, lowStock: 0 }
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
      if (!token) { setLoading(false); return; }

      const dashboardResponse = await api.get(`/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dashboardData = dashboardResponse;
      const ordersResponse = await fetch(`${API_URL}/admin/orders?limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
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
        month: new Date(new Date().setMonth(now.getMonth() - 1))
      };

      const calculate = (startDate) => {
        const filtered = allOrders.filter(o => new Date(o.createdAt) >= startDate && o.paymentStatus === 'completed');
        const sales = filtered.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const profit = filtered.reduce((sum, o) => sum + (o.items?.reduce((isum, i) => isum + (((i.price || 0) - (i.product?.cost || 0)) * (i.quantity || 0)), 0) || 0), 0);
        return { sales, profit };
      };

      const dayData = calculate(periods.day);
      const weekData = calculate(periods.week);
      const monthData = calculate(periods.month);

      const productsResponse = await fetch(`${API_URL}/admin/products`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      let prodStats = { total: 0, low: 0 };
      if (productsResponse.ok) {
        const pData = await productsResponse.json();
        const items = pData.products || pData.data || [];
        prodStats = { total: items.length, low: items.filter(p => (p.quantity || 0) < 10).length };
      }

      setStats({
        sales: { day: dayData.sales, week: weekData.sales, month: monthData.sales },
        orders: {
          pending: allOrders.filter(o => ['pending', 'processing'].includes(o.status)).length,
          delivered: allOrders.filter(o => o.status === 'delivered').length,
          total: allOrders.length
        },
        profits: { day: dayData.profit, week: weekData.profit, month: monthData.profit },
        products: { total: prodStats.total, lowStock: prodStats.low }
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <p className="font-medium text-slate-600">Syncing Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 lg:p-8">
      {/* Header Section */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-1 flex items-center gap-2 text-indigo-600">
            <LayoutDashboard size={20} />
            <span className="text-sm font-bold uppercase tracking-wider">Overview</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500">Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span></p>
        </div>

        <div className="flex items-center rounded-xl bg-white p-1 shadow-sm border border-slate-200">
          {['day', 'week', 'month'].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-6 py-2 text-sm font-bold transition-all rounded-lg ${selectedPeriod === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={`$${stats.sales[selectedPeriod].toLocaleString()}`}
          icon={<DollarSign className="text-emerald-600" />}
          trend="+12% from last period"
          color="bg-emerald-50"
        />
        <StatCard
          label="Net Profit"
          value={`$${stats.profits[selectedPeriod].toLocaleString()}`}
          icon={<TrendingUp className="text-blue-600" />}
          trend="Calculated Margin"
          color="bg-blue-50"
        />
        <StatCard
          label="Active Orders"
          value={stats.orders.total}
          icon={<Package className="text-amber-600" />}
          trend={`${stats.orders.pending} Pending Orders`}
          color="bg-amber-50"
        />
        <StatCard
          label="Inventory"
          value={stats.products.total}
          icon={<ShoppingCart className="text-purple-600" />}
          trend={`${stats.products.lowStock} Low Stock items`}
          color="bg-purple-50"
          isAlert={stats.products.lowStock > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Quick Actions - Revamped */}
        <div className="lg:col-span-2">
          <h2 className="mb-6 text-xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowUpRight size={20} /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ActionLink to="/admin/pricing" icon={<Tag />} label="Pricing" desc="Manage rates" color="border-blue-200 hover:bg-blue-50" />
            <ActionLink to="/admin/products" icon={<PlusCircle />} label="Products" desc="Add new items" color="border-emerald-200 hover:bg-emerald-50" />
            <ActionLink to="#" icon={<ImageIcon />} label="Gallery" desc="Upload assets" color="border-purple-200 hover:bg-purple-50" />
            <ActionLink to="/admin/orders" icon={<ClipboardList />} label="Orders" desc="View logistics" color="border-amber-200 hover:bg-amber-50" />
            <ActionLink to="#" icon={<BarChart3 />} label="Analytics" desc="Sales reports" color="border-indigo-200 hover:bg-indigo-50" />
            <ActionLink to="/admin/users" icon={<Users />} label="Customers" desc="User database" color="border-pink-200 hover:bg-pink-50" />
          </div>
        </div>

        {/* Status Breakdown Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-slate-800">Order Summary</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500">Delivered</span>
                <span className="text-slate-900">{stats.orders.delivered}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all duration-1000"
                  style={{ width: `${(stats.orders.delivered / stats.orders.total) * 100 || 0}%` }}
                ></div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500">Pending</span>
                <span className="text-slate-900">{stats.orders.pending}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all duration-1000"
                  style={{ width: `${(stats.orders.pending / stats.orders.total) * 100 || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {stats.products.lowStock > 0 && (
            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-700 border border-red-100">
              <AlertTriangle className="shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-red-800">Stock Alert</p>
                <p className="text-xs">{stats.products.lowStock} products are running low. Restock soon to avoid losing sales.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components for cleaner code
function StatCard({ label, value, icon, trend, color, isAlert }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-transform hover:scale-[1.02]`}>
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <h3 className="text-2xl font-black text-slate-900">{value}</h3>
      <p className={`mt-2 text-xs font-medium ${isAlert ? 'text-red-600' : 'text-slate-400'}`}>
        {trend}
      </p>
    </div>
  );
}

function ActionLink({ to, icon, label, desc, color }) {
  return (
    <Link to={to} className={`flex flex-col rounded-2xl border bg-white p-5 transition-all hover:shadow-md ${color}`}>
      <div className="mb-3 text-slate-700">{React.cloneElement(icon, { size: 24 })}</div>
      <p className="font-bold text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">{desc}</p>
    </Link>
  );
}

export default AdminDashboard;