import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
import { AdminBadge, AdminButton, AdminCard } from '../../components/admin/ui';
import { ORDER_STATUS_OPTIONS, orderStatusLabel, orderStatusBadgeVariant } from '../../constants/orderStatuses';

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN');
}

function paymentVariant(ps) {
  const s = String(ps || '').toLowerCase();
  if (s === 'paid' || s === 'completed') return 'success';
  if (s === 'failed' || s === 'refunded' || s === 'partial_refund') return 'danger';
  return 'warning';
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [carrierInput, setCarrierInput] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/orders/${encodeURIComponent(id)}`);
      if (res?.success && res.data) {
        setOrder(res.data);
        setTrackingNumberInput(res.data.trackingNumber || '');
        setCarrierInput(res.data.carrier || '');
      } else {
        setOrder(null);
        toast.error(res?.message || 'Order not found');
      }
    } catch (e) {
      setOrder(null);
      toast.error(e?.message || 'Could not load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateOrderStatus = async (newStatus) => {
    if (!order?._id) return;
    try {
      const response = await api.patch(`/admin/orders/${order._id}/status`, {
        status: newStatus,
        trackingNumber: trackingNumberInput,
        carrier: carrierInput,
      });
      if (response?.success) {
        toast.success(`Order ${orderStatusLabel(newStatus)}`);
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                trackingNumber: trackingNumberInput,
                carrier: carrierInput,
              }
            : prev
        );
      } else {
        toast.error(response?.message || 'Could not update status');
      }
    } catch {
      toast.error('Could not update status');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-10 w-10 animate-spin text-[#008060]" />
        <p className="text-sm font-medium">Loading order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Package className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <p className="text-slate-700">We couldn&apos;t load this order.</p>
        <AdminButton variant="primary" size="md" className="mt-6" onClick={() => navigate('/admin/orders')}>
          Back to orders
        </AdminButton>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.addressId;
  const user = order.userId;
  const guest = order.guestShipping;
  const notifyEmail =
    order.customerEmail || user?.email || guest?.email || '';

  return (
    <div className="admin-design-scope mx-auto max-w-5xl space-y-6 pb-12 font-sans">
      <Toaster position="top-right" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-[#008060]"
          >
            <ArrowLeft className="h-4 w-4" />
            Orders
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {order.orderNumber || order._id}
          </h1>
          <AdminBadge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</AdminBadge>
          <AdminBadge variant={paymentVariant(order.paymentStatus)}>
            {(order.paymentStatus || 'pending').replace(/_/g, ' ')}
          </AdminBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard title="Customer">
          <p className="font-semibold text-slate-900">{addr?.name || user?.name || guest?.name || '—'}</p>
          <p className="mt-1 text-sm text-slate-600">{addr?.fullAddress || guest?.fullAddress || '—'}</p>
          <p className="mt-1 text-sm text-slate-600">
            {addr?.city || guest?.city || '—'}, {addr?.state || guest?.state || '—'}{' '}
            {addr?.pincode || guest?.pincode || ''}
          </p>
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-medium text-slate-500">Email</span> {notifyEmail || '—'}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-500">Phone</span> {addr?.phone || guest?.phone || '—'}
          </p>
          <p className="mt-3 text-xs text-slate-400">Placed {formatDateTime(order.createdAt)}</p>
        </AdminCard>

        <AdminCard title="Fulfillment">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Tracking</label>
              <input
                value={trackingNumberInput}
                onChange={(e) => setTrackingNumberInput(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                placeholder="Tracking number"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Carrier</label>
              <input
                value={carrierInput}
                onChange={(e) => setCarrierInput(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                placeholder="Carrier"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Order status</label>
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
              value={order.status}
              onChange={(e) => updateOrderStatus(e.target.value)}
            >
              {ORDER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </AdminCard>
      </div>

      <AdminCard title="Line items" subtitle={`${items.length} product(s)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4 text-center">Qty</th>
                <th className="py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    No line items
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {item.product?.image ? (
                            <img src={item.product.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Package className="h-5 w-5 text-slate-300" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">{item.product?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-center tabular-nums text-slate-700">{item.quantity || 0}</td>
                    <td className="py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatCurrency((item.quantity || 0) * (item.price || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminCard title="Totals">
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:justify-between">
          <span className="text-slate-600">
            Subtotal <strong className="text-slate-900">{formatCurrency(order.subtotal)}</strong>
          </span>
          <span className="text-slate-600">
            Tax <strong className="text-slate-900">{formatCurrency(order.taxAmount)}</strong>
          </span>
          <span className="text-slate-600">
            Shipping <strong className="text-slate-900">{formatCurrency(order.shippingAmount)}</strong>
          </span>
          <span className="text-base font-semibold text-[#008060]">
            Total {formatCurrency(order.totalAmount)}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Payment method: <span className="font-medium text-slate-700">{(order.paymentMethod || '—').toUpperCase()}</span>
        </p>
      </AdminCard>
    </div>
  );
}
