import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { RefreshCw, Download, Upload, Search, ChevronLeft, ChevronRight, CreditCard, Package, X } from 'lucide-react';
import { AdminBadge, AdminButton, AdminTableSkeleton } from '../../components/admin/ui';
import { ORDER_STATUS_OPTIONS, orderStatusLabel, orderStatusBadgeVariant } from '../../constants/orderStatuses';
import { useSearch } from '../../hooks/usePerformance';

function paymentVariant(ps) {
  const s = String(ps || '').toLowerCase();
  if (s === 'paid' || s === 'completed') return 'success';
  if (s === 'failed' || s === 'refunded' || s === 'partial_refund') return 'danger';
  return 'warning';
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { searchTerm, debouncedSearchTerm, handleSearchChange } = useSearch('', 280);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [requestPaymentModal, setRequestPaymentModal] = useState({ show: false, cardNumber: '', name: '', pin: '' });
  const [importingCsv, setImportingCsv] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalFrom, setExportModalFrom] = useState('');
  const [exportModalTo, setExportModalTo] = useState('');
  const [exportModalFormat, setExportModalFormat] = useState('full');
  const csvInputRef = useRef(null);

  const formatOrders = useCallback((orders = []) => {
    return orders.map((order) => {
      const totalQuantity = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0);
      return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        trackingNumber: order.trackingNumber || '',
        carrier: order.carrier || '',
        amounts: {
          subtotal: order.subtotal || 0,
          tax: order.taxAmount || 0,
          shipping: order.shippingAmount || 0,
          total: order.totalAmount || 0,
          remaining: order.remainingAmount || 0,
        },
        paymentMethod: order?.paymentMethod,
        paymentCards: order?.paymentCards,
        items: order.items?.map((item) => ({
          productId: item.product?._id,
          productName: item.product?.name,
          image: item.product?.image,
          quantity: item.quantity,
          price: item.price,
        })),
        itemsCount: order.items?.length || 0,
        totalQuantity,
        customerEmail: order.customerEmail || order.userId?.email || order.guestShipping?.email || '',
        addressId: order.addressId,
        guestShipping: order.guestShipping,
        userId: order.userId,
        timeline: {
          createdAt: order.createdAt,
          estimatedDelivery: order.estimatedDelivery,
          deliveredAt: order.deliveredAt,
        },
      };
    });
  }, []);

  const loadOrders = useCallback(
    async (pageNo = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(pageNo),
          limit: '10',
          status: filter,
        });
        const q = debouncedSearchTerm.trim();
        if (q) params.set('search', q);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        const response = await api.get(`/admin/orders?${params.toString()}`);
        if (response.success) {
          const formatted = formatOrders(response.data || []);
          setOrders(formatted);
          setTotalPages(response.meta?.pagination?.totalPages || 1);
          setPage(response.meta?.pagination?.page || pageNo);
          setError('');
        } else {
          setOrders([]);
          setError(response.message || 'Failed to fetch orders');
        }
      } catch (err) {
        setOrders([]);
        setError('Network error: ' + (err?.message || 'unknown'));
      } finally {
        setLoading(false);
      }
    },
    [filter, debouncedSearchTerm, dateFrom, dateTo, formatOrders]
  );

  useEffect(() => {
    void loadOrders(1);
  }, [filter, debouncedSearchTerm, dateFrom, dateTo, loadOrders]);

  const openExportModal = () => {
    setExportModalFrom(dateFrom || '');
    setExportModalTo(dateTo || '');
    setExportModalFormat('full');
    setExportModalOpen(true);
  };

  const runExportFromModal = async () => {
    if (exportModalFrom && exportModalTo) {
      const a = new Date(exportModalFrom);
      const b = new Date(exportModalTo);
      if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a > b) {
        toast.error('Start date must be on or before end date');
        return;
      }
    }
    try {
      setExportingCsv(true);
      const params = new URLSearchParams();
      const selectedStatus = (filter || 'all').trim();
      if (selectedStatus && selectedStatus !== 'all') {
        params.set('status', selectedStatus);
      }
      const q = debouncedSearchTerm.trim();
      if (q) params.set('search', q);
      if (exportModalFrom) params.set('dateFrom', exportModalFrom);
      if (exportModalTo) params.set('dateTo', exportModalTo);
      if (exportModalFormat === 'summary') {
        params.set('summary', '1');
      }
      const qs = params.toString();
      const blob = await api.get(`/admin/orders/export-csv${qs ? `?${qs}` : ''}`, {
        responseType: 'blob',
        headers: { Accept: 'text/csv' },
      });
      if (blob?.type?.includes('application/json')) {
        const payload = await blob.text().then((txt) => {
          try {
            return JSON.parse(txt);
          } catch {
            return {};
          }
        });
        throw new Error(payload?.message || 'Export failed');
      }
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const suffix = exportModalFormat === 'summary' ? 'summary' : 'full';
      link.download = `orders-${suffix}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(exportModalFormat === 'summary' ? 'Summary CSV downloaded' : 'Orders CSV downloaded');
      setExportModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleImportCsv = async (file) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const ok = lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');
    if (!ok) {
      toast.error('Please upload a .csv, .xls, or .xlsx file');
      return;
    }
    try {
      setImportingCsv(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/admin/orders/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.success) {
        toast.success(`Imported ${response.importedCount || 0} orders`);
        if (response.failedCount > 0) toast.error(`${response.failedCount} rows failed`);
        loadOrders(1);
      } else {
        toast.error(response.message || 'CSV import failed');
      }
    } catch (err) {
      toast.error(err?.message || 'CSV import failed');
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;
  const formatDateTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN');
  };

  const openOrder = (orderId) => navigate(`/admin/orders/${orderId}`);

  const patchOrderStatus = async (orderId, status, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    try {
      const res = await api.patch(`/admin/orders/${orderId}/status`, { status });
      if (res && res.success) {
        toast.success('Order status updated');
        setOrders((prev) => prev.map((o) => (String(o.orderId) === String(orderId) ? { ...o, status } : o)));
      } else {
        toast.error(res?.message || 'Update failed');
      }
    } catch (err) {
      toast.error(err?.message || 'Update failed');
    }
  };

  return (
    <div className="admin-design-scope mx-auto max-w-[1600px] space-y-6 pb-12 font-sans">
      <div className="admin-card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Orders</h1>
            <p className="mt-1 text-sm text-slate-500">Track fulfillment, payments, and customer details.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="secondary" size="md" onClick={() => loadOrders(page)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </AdminButton>
            <AdminButton variant="secondary" size="md" disabled={exportingCsv} onClick={openExportModal}>
              <Download className="h-4 w-4" />
              Export
            </AdminButton>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => handleImportCsv(e.target.files?.[0])}
            />
            <AdminButton variant="primary" size="md" disabled={importingCsv} onClick={() => csvInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {importingCsv ? 'Importing…' : 'Import'}
            </AdminButton>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Order #, email, name, or ID (server search)"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
              value={searchTerm}
              onChange={handleSearchChange}
              aria-label="Search orders"
            />
          </div>
          <input
            type="date"
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 shadow-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
          />
          <input
            type="date"
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 shadow-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
          />
          <select
            className="h-10 min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="on_the_way">On the way</option>
            <option value="on_hold">On hold</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {error ? (
          <div className="mx-4 my-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6">{error}</div>
        ) : null}

        <div className="hidden md:block">
          <div className="max-h-[min(70vh,680px)] overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Order status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <AdminTableSkeleton rows={8} cols={7} />
              ) : (
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                            <Package className="h-7 w-7 text-slate-400" />
                          </div>
                          <p className="text-base font-medium text-slate-800">No orders in this view</p>
                          <p className="mt-1 text-sm text-slate-500">Change filters or refresh to load the latest.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr
                        key={order.orderId}
                        role="button"
                        tabIndex={0}
                        onClick={() => openOrder(order.orderId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openOrder(order.orderId);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-slate-50/90"
                      >
                        <td className="px-4 py-3">
                          <span className="font-semibold text-[#008060]">{order.orderNumber || order.orderId}</span>
                          <p className="text-xs font-mono text-slate-400">{String(order.orderId).slice(-8)}</p>
                          <p className="text-xs text-slate-500">{order.itemsCount} items</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {order.addressId?.name || order.userId?.name || order.guestShipping?.name || '—'}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-[220px]">{order.customerEmail || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(order.timeline?.createdAt)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {formatCurrency(order.amounts?.total)}
                        </td>
                        <td className="px-4 py-3">
                          <AdminBadge variant={paymentVariant(order.paymentStatus)}>
                            {(order.paymentStatus || 'pending').replace(/_/g, ' ')}
                          </AdminBadge>
                        </td>
                        <td className="px-4 py-3">
                          <AdminBadge variant={orderStatusBadgeVariant(order.status)}>
                            {orderStatusLabel(order.status)}
                          </AdminBadge>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                              aria-label="Change order status"
                              className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                              value={order.status}
                              onChange={(e) => patchOrderStatus(order.orderId, e.target.value, e)}
                            >
                              {ORDER_STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              {order.paymentMethod === 'otc' && order.status === 'pending' ? (
                                <AdminButton
                                  variant="secondary"
                                  size="sm"
                                  type="button"
                                  onClick={() =>
                                    setRequestPaymentModal({
                                      show: true,
                                      name: order.paymentCards?.name,
                                      cardNumber: order.paymentCards?.cardNumber,
                                      pin: order.paymentCards?.pin,
                                    })
                                  }
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  OTC
                                </AdminButton>
                              ) : null}
                              <AdminButton variant="secondary" size="sm" type="button" onClick={() => openOrder(order.orderId)}>
                                View
                              </AdminButton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>

        <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No orders found.</p>
          ) : (
            orders.map((order) => (
              <button
                key={order.orderId}
                type="button"
                onClick={() => openOrder(order.orderId)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#008060]">{order.orderNumber || order.orderId}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(order.timeline?.createdAt)}</p>
                  </div>
                  <AdminBadge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</AdminBadge>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {order.addressId?.name || order.userId?.name || order.guestShipping?.name || '—'}
                </p>
                <p className="text-xs text-slate-500">{order.customerEmail || '—'}</p>
                <div className="mt-3 flex items-center justify-between">
                  <AdminBadge variant={paymentVariant(order.paymentStatus)}>
                    {(order.paymentStatus || 'pending').replace(/_/g, ' ')}
                  </AdminBadge>
                  <span className="font-bold text-slate-900">{formatCurrency(order.amounts?.total)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:px-6">
            <p className="text-sm text-slate-500">
              Page <span className="font-medium text-slate-800">{page}</span> of{' '}
              <span className="font-medium text-slate-800">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <AdminButton variant="secondary" size="sm" disabled={page === 1 || loading} onClick={() => loadOrders(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </AdminButton>
              <AdminButton variant="secondary" size="sm" disabled={page === totalPages || loading} onClick={() => loadOrders(page + 1)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </AdminButton>
            </div>
          </div>
        ) : null}
      </div>

      {exportModalOpen ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-orders-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="export-orders-title" className="text-lg font-semibold text-slate-900">
                  Export orders
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Uses the same status and search as the table below. Leave dates empty to export that full filtered set.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => !exportingCsv && setExportModalOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">From date</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                    value={exportModalFrom}
                    onChange={(e) => setExportModalFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">To date</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                    value={exportModalTo}
                    onChange={(e) => setExportModalTo(e.target.value)}
                  />
                </div>
              </div>
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">File contents</legend>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <input
                      type="radio"
                      name="exportFmt"
                      className="mt-1"
                      checked={exportModalFormat === 'full'}
                      onChange={() => setExportModalFormat('full')}
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">Full backup (CSV)</span>
                      <span className="text-xs text-slate-500">All fields for re-import and accounting.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <input
                      type="radio"
                      name="exportFmt"
                      className="mt-1"
                      checked={exportModalFormat === 'summary'}
                      onChange={() => setExportModalFormat('summary')}
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">Summary report (CSV)</span>
                      <span className="text-xs text-slate-500">Order ID, customer, date, status, total only.</span>
                    </span>
                  </label>
                </div>
              </fieldset>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AdminButton variant="secondary" size="md" type="button" disabled={exportingCsv} onClick={() => setExportModalOpen(false)}>
                Cancel
              </AdminButton>
              <AdminButton variant="primary" size="md" type="button" disabled={exportingCsv} onClick={() => void runExportFromModal()}>
                {exportingCsv ? 'Downloading…' : 'Download CSV'}
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}

      {requestPaymentModal.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">OTC payment details</h2>
                <button
                  type="button"
                  onClick={() => setIsDetailsVisible(!isDetailsVisible)}
                  className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#008060] hover:underline"
                >
                  {isDetailsVisible ? 'Hide sensitive' : 'Reveal sensitive'}
                </button>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => {
                  setRequestPaymentModal({ show: false });
                  setIsDetailsVisible(false);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-inner">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Card number</p>
              <p className="mt-1 font-mono text-lg tracking-widest">
                {isDetailsVisible
                  ? requestPaymentModal.cardNumber || '—'
                  : `•••• •••• •••• ${(requestPaymentModal.cardNumber || '').slice(-4) || '••••'}`}
              </p>
              <div className="mt-6 flex justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Name</p>
                  <p className="mt-1 text-sm font-semibold">{requestPaymentModal.name || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">PIN</p>
                  <p className="mt-1 font-mono text-sm font-bold text-amber-300">
                    {isDetailsVisible ? requestPaymentModal.pin || '—' : '••••'}
                  </p>
                </div>
              </div>
            </div>
            <AdminButton
              variant="primary"
              size="md"
              className="mt-6 w-full"
              onClick={() => {
                setRequestPaymentModal({ show: false });
                setIsDetailsVisible(false);
              }}
            >
              Done
            </AdminButton>
          </div>
        </div>
      )}
    </div>
  );
}
