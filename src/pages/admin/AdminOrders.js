import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Download, Upload, Search } from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewOrderId, setViewOrderId] = useState(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [requestPaymentModal, setRequestPaymentModal] = useState({ show: false, cardNumber: '', name: '', pin: '' });
  const [importingCsv, setImportingCsv] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [carrierInput, setCarrierInput] = useState('');
  const csvInputRef = useRef(null);

  useEffect(() => {
    loadOrders(1);
  }, [filter]);

  const loadOrders = async (pageNo = 1) => {
    try {
      setLoading(true);
      const response = await api.get(
        `/admin/orders?page=${pageNo}&limit=10&status=${filter}`
      );

      if (response.success) {
        const formatted = formatOrders(response.data || []);
        setOrders(formatted);

        setTotalPages(response.meta?.pagination?.totalPages || 1);
        setPage(response.meta?.pagination?.page || pageNo);
        setError('');
      } else {
        setError(response.message || 'Failed to fetch orders');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/status`, {
        status: newStatus,
        trackingNumber: trackingNumberInput,
        carrier: carrierInput,
      });

      if (response.success) {
        setOrders(prev => prev.map(o => o.orderId === orderId
          ? { ...o, status: newStatus, trackingNumber: trackingNumberInput, carrier: carrierInput }
          : o));
        // --- SUCCESS TOAST ---
        toast.success(`Order ${newStatus} successfully!`, {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });
      }
    } catch (error) {
      // --- ERROR TOAST ---
      toast.error('Error updating status');
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const selectedStatus = (filter || 'all').trim();
      const query = selectedStatus && selectedStatus !== 'all'
        ? `?status=${encodeURIComponent(selectedStatus)}`
        : '';
      const blob = await api.get(`/admin/orders/export-csv${query}`, {
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
        throw new Error(payload?.message || 'CSV export failed');
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `orders-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Orders CSV exported');
    } catch (err) {
      toast.error(err?.message || 'CSV export failed');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleImportCsv = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
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
        if (response.failedCount > 0) {
          toast.error(`${response.failedCount} rows failed`);
          console.warn('Order CSV failed rows:', response.failedRows);
        }
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

  const formatOrders = (orders = []) => {
    return orders.map(order => {
      const totalQuantity = order.items?.reduce(
        (sum, item) => sum + (item.quantity || 0),
        0
      );

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
        items: order.items?.map(item => ({
          productId: item.product?._id,
          productName: item.product?.name,
          image: item.product?.image,
          quantity: item.quantity,
          price: item.price,
        })),

        itemsCount: order.items?.length || 0,
        totalQuantity,

        addressId: order.addressId,
        userId: order.userId,

        timeline: {
          createdAt: order.createdAt,
          estimatedDelivery: order.estimatedDelivery,
          deliveredAt: order.deliveredAt,
        },
      };
    });
  };

  const statusColor = {
    pending: 'bg-orange-100 text-orange-600',
    confirmed: 'bg-green-100 text-green-700',
    processing: 'bg-blue-100 text-blue-600',
    packed: 'bg-violet-100 text-violet-700',
    shipped: 'bg-indigo-100 text-indigo-600',
    on_the_way: 'bg-cyan-100 text-cyan-700',
    delivered: 'bg-emerald-100 text-emerald-600',
    cancelled: 'bg-red-100 text-red-600',
  };
  const statusLabel = (status) => {
    const map = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processed',
      packed: 'Packed',
      shipped: 'Shipped',
      on_the_way: 'On the way',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return map[status] || status || '-';
  };

  const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;
  const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN');
  };

  const filteredOrders = orders.filter((order) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const customerName = (order.addressId?.name || order.userId?.name || '').toLowerCase();
    return (
      (order.orderNumber || '').toLowerCase().includes(q) ||
      customerName.includes(q)
    );
  });
  const selectedOrder = viewOrderId ? orders.find((order) => order.orderId === viewOrderId) : null;

  useEffect(() => {
    if (!selectedOrder) return;
    setTrackingNumberInput(selectedOrder.trackingNumber || '');
    setCarrierInput(selectedOrder.carrier || '');
  }, [selectedOrder?.orderId]);


  if (loading && page === 1) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Loading Orders...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <Toaster />
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
            <p className="text-gray-500">Manage your store transactions and logistics</p>
          </div>
          <div className="w-full flex flex-wrap items-center gap-2.5 md:gap-3">
            <div className="relative w-full sm:flex-1 sm:min-w-[260px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search Order # or Name..."
                className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3090cf] outline-none w-full shadow-sm"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2.5 border border-gray-300 rounded-xl bg-white outline-none shadow-sm font-medium text-gray-700 w-full sm:w-[170px]"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="on_the_way">On the way</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => loadOrders(page)}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto sm:min-w-[118px] font-medium"
            >
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-60 w-full sm:w-auto sm:min-w-[136px] font-medium flex items-center justify-center gap-2"
            >
              <Download size={16} />
              <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleImportCsv(e.target.files?.[0])}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={importingCsv}
              className="bg-[#3090cf] hover:bg-[#246fa0] text-white border border-[#3090cf] px-4 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-60 w-full sm:w-auto sm:min-w-[136px] font-semibold flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              <span>{importingCsv ? 'Importing...' : 'Import CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block max-w-7xl mx-auto bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.orderId} className="border-b border-gray-100 hover:bg-blue-50/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-blue-700">{order.orderNumber || order.orderId}</div>
                    <div className="text-xs text-gray-500">{order.itemsCount} items</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(order.timeline?.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-800">{order.addressId?.name || order.userId?.name || '-'}</div>
                    <div className="text-xs text-gray-500">{order.userId?.email || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${statusColor[order.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {(order.paymentStatus || 'unpaid').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{formatCurrency(order.amounts?.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
                      onClick={() => setViewOrderId(order.orderId)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden max-w-7xl mx-auto space-y-3">
        {filteredOrders.map((order) => (
          <div key={order.orderId} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-blue-700 truncate">{order.orderNumber || order.orderId}</div>
                <div className="text-xs text-gray-500">{formatDateTime(order.timeline?.createdAt)}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${statusColor[order.status] || 'bg-gray-100 text-gray-600'}`}>
                {statusLabel(order.status)}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-sm font-medium text-gray-800">{order.addressId?.name || order.userId?.name || '-'}</div>
              <div className="text-xs text-gray-500 break-all">{order.userId?.email || '-'}</div>
              <div className="text-xs text-gray-500">{order.itemsCount} items</div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {(order.paymentStatus || 'unpaid').toUpperCase()}
              </span>
              <div className="text-sm font-bold text-gray-800">{formatCurrency(order.amounts?.total)}</div>
            </div>
            <button
              type="button"
              className="mt-3 w-full text-sm font-semibold text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 rounded-lg py-2"
              onClick={() => setViewOrderId(order.orderId)}
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 mt-8 mb-10 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <button
            disabled={page === 1}
            onClick={() => loadOrders(page - 1)}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors w-full sm:w-auto"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Page</span>
            <span className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg font-black shadow-lg shadow-blue-200">
              {page}
            </span>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">of {totalPages}</span>
          </div>

          <button
            disabled={page === totalPages}
            onClick={() => loadOrders(page + 1)}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors w-full sm:w-auto"
          >
            Next →
          </button>
        </div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <div className="text-center py-32 bg-white rounded-3xl shadow-sm max-w-7xl mx-auto border border-dashed border-gray-300 mt-10">
          <div className="text-5xl mb-4 text-gray-200">📂</div>
          <p className="text-gray-400 text-lg font-medium">No orders found for this selection.</p>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 truncate">Order {selectedOrder.orderNumber || selectedOrder.orderId}</h3>
                <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${statusColor[selectedOrder.status] || 'bg-gray-100 text-gray-700'}`}>
                  {statusLabel(selectedOrder.status)}
                </span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                onClick={() => setViewOrderId(null)}
                aria-label="Close order details"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto">
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-200">
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Billing details</h4>
                <p className="text-sm text-gray-800 font-semibold">{selectedOrder.addressId?.name || selectedOrder.userId?.name || '-'}</p>
                <p className="text-sm text-gray-600">{selectedOrder.addressId?.fullAddress || '-'}</p>
                <p className="text-sm text-gray-600">{selectedOrder.addressId?.city || '-'}, {selectedOrder.addressId?.state || '-'} {selectedOrder.addressId?.pincode || ''}</p>
                <p className="text-sm text-gray-700 mt-3"><span className="font-semibold">Email:</span> {selectedOrder.userId?.email || '-'}</p>
                <p className="text-sm text-gray-700"><span className="font-semibold">Phone:</span> {selectedOrder.addressId?.phone || '-'}</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Shipping details</h4>
                <p className="text-sm text-gray-800 font-semibold">{selectedOrder.addressId?.name || selectedOrder.userId?.name || '-'}</p>
                <p className="text-sm text-gray-600">{selectedOrder.addressId?.fullAddress || '-'}</p>
                <p className="text-sm text-gray-600">{selectedOrder.addressId?.city || '-'}, {selectedOrder.addressId?.state || '-'} {selectedOrder.addressId?.pincode || ''}</p>
                <p className="text-sm text-gray-700 mt-3"><span className="font-semibold">Shipping:</span> {formatCurrency(selectedOrder.amounts?.shipping)}</p>
                <p className="text-sm text-gray-700"><span className="font-semibold">Payment:</span> {(selectedOrder.paymentMethod || '-').toUpperCase()}</p>
                <p className="text-sm text-gray-700"><span className="font-semibold">Tracking:</span> {selectedOrder.trackingNumber || '-'}</p>
                <p className="text-sm text-gray-700"><span className="font-semibold">Carrier:</span> {selectedOrder.carrier || '-'}</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-b border-gray-200">
              <div className="hidden sm:grid grid-cols-12 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200 pb-2">
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-center">Tax</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {selectedOrder.items?.length > 0 ? selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 items-start sm:items-center gap-2 sm:gap-0 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="sm:col-span-6 flex items-center gap-3 min-w-0">
                      <img src={item.image} alt="" className="w-10 h-10 object-contain rounded border border-gray-100 bg-gray-50" />
                      <span className="text-sm font-medium text-gray-800 truncate">{item.productName || '-'}</span>
                    </div>
                    <div className="sm:col-span-2 text-left sm:text-center text-xs sm:text-sm text-gray-700">Qty: {item.quantity || 0}</div>
                    <div className="sm:col-span-2 text-left sm:text-center text-xs sm:text-sm text-gray-700">Tax: {formatCurrency(0)}</div>
                    <div className="sm:col-span-2 text-left sm:text-right text-sm font-semibold text-gray-800">
                      {formatCurrency((item.quantity || 0) * (item.price || 0))}
                    </div>
                  </div>
                )) : <p className="py-4 text-sm text-gray-500">No items in this order.</p>}
              </div>
            </div>

            <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-gray-50">
              <div className="text-sm text-gray-700 flex flex-wrap items-center gap-4">
                <span>Subtotal: <strong>{formatCurrency(selectedOrder.amounts?.subtotal)}</strong></span>
                <span>Tax: <strong>{formatCurrency(selectedOrder.amounts?.tax)}</strong></span>
                <span>Total: <strong className="text-blue-700">{formatCurrency(selectedOrder.amounts?.total)}</strong></span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={trackingNumberInput}
                  onChange={(e) => setTrackingNumberInput(e.target.value)}
                  placeholder="Tracking number"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none w-full sm:w-[170px]"
                />
                <input
                  type="text"
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  placeholder="Carrier"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none w-full sm:w-[120px]"
                />
                {selectedOrder.paymentMethod === 'otc' && selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => setRequestPaymentModal({
                      show: true,
                      name: selectedOrder.paymentCards?.name,
                      cardNumber: selectedOrder.paymentCards?.cardNumber,
                      pin: selectedOrder.paymentCards?.pin
                    })}
                    className="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold px-3 py-2 rounded-lg hover:bg-orange-600 hover:text-white transition-all"
                  >
                    View OTC Details
                  </button>
                )}
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer w-full sm:w-auto"
                  value={selectedOrder.status}
                  onChange={(e) => updateOrderStatus(selectedOrder.orderId, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="on_the_way">On the way</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {requestPaymentModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-gray-800 tracking-tight">OTC Details</h2>
                <button
                  onClick={() => setIsDetailsVisible(!isDetailsVisible)}
                  className="text-[10px] text-blue-600 font-bold uppercase tracking-widest flex items-center gap-1 hover:underline"
                >
                  {isDetailsVisible ? '👁️ Hide Details' : '👁️ Show Details'}
                </button>
              </div>
              <button
                onClick={() => {
                  setRequestPaymentModal({ show: false });
                  setIsDetailsVisible(false);
                }}
                className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 border border-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <div className="relative bg-gradient-to-br from-[#1a1a1a] via-[#000000] to-[#1a1a1a] p-7 rounded-[2rem] text-white shadow-2xl overflow-hidden min-h-[220px] border border-white/10">

                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

                <div className="mb-10 relative z-10">
                  <div className="w-12 h-9 bg-gradient-to-br from-yellow-200 via-yellow-600 to-yellow-700 rounded-md"></div>
                </div>

                <div className="relative z-10 mb-8">
                  <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] mb-1">Card Number</p>
                  <p className="text-xl font-mono tracking-[0.15em] font-semibold text-gray-100">
                    {isDetailsVisible
                      ? (requestPaymentModal.cardNumber || '0000 0000 0000 0000')
                      : '**** **** **** ' + (requestPaymentModal.cardNumber?.slice(-4) || '0000')
                    }
                  </p>
                </div>

                <div className="flex justify-between items-end relative z-10">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] mb-0.5">Card Holder</p>
                    <p className="text-sm font-bold tracking-widest uppercase text-gray-200">
                      {requestPaymentModal.name || 'PLATINUM CUSTOMER'}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] mb-0.5">PIN</p>
                    <div className="bg-white/10 px-3 py-1 rounded-md border border-white/10">
                      <p className="text-sm font-black text-yellow-500">
                        {isDetailsVisible ? (requestPaymentModal.pin || '****') : '****'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setRequestPaymentModal({ show: false });
                setIsDetailsVisible(false);
              }}
              className="w-full py-4 mt-8 bg-black text-white font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg"
            >
              Confirm & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}