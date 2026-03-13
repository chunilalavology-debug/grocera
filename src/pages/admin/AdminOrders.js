import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [requestPaymentModal, setRequestPaymentModal] = useState({ show: false, cardNumber: '', name: '', pin: '' });

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
      const response = await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });

      if (response.success) {
        setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: newStatus } : o));
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
    shipped: 'bg-indigo-100 text-indigo-600',
    delivered: 'bg-emerald-100 text-emerald-600',
    cancelled: 'bg-red-100 text-red-600',
  };


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
            <h1 className="text-2xl font-bold text-gray-800">Order Management</h1>
            <p className="text-sm text-gray-500">Manage your store transactions and logistics</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search Order # or Name..."
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 shadow-sm"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white outline-none shadow-sm font-medium text-gray-700"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => loadOrders(page)}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          {error}
        </div>
      )}

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {orders.map(order => (
          <div key={order.orderId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                    {order.orderNumber}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                    {order.paymentStatus?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{new Date(order.timeline?.createdAt).toLocaleString('en-IN')}</p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${statusColor[order.status] || 'bg-gray-100 text-gray-600'
                }`}>

                {order.status}
              </span>
            </div>

            {/* Content Body */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-widest">Customer Info</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-lg">👤</span> {order.addressId?.name || order.userId?.name}
                  </p>
                  <p className="flex items-center gap-2">📞 {order.addressId?.phone}</p>
                  <p className="flex items-center gap-2">📞 {order.userId?.email}</p>
                  <p className="leading-relaxed mt-2 text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                    {order.addressId?.fullAddress},<br />
                    {order.addressId?.city}, {order.addressId?.state} - {order.addressId?.pincode}
                  </p>
                </div>
              </div>

              {/* Items Summary */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-widest">
                  Items ({order.itemsCount})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {order.items?.length > 0 ? order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white border border-gray-100 p-2 rounded-xl shadow-xs">
                      <img
                        src={item.image}
                        className="w-12 h-12 object-contain rounded-lg bg-gray-50 p-1 border border-gray-100"
                        alt=""
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate leading-tight">{item.productName}</p>
                        <p className="text-[11px] text-gray-500 font-medium">Qty: {item.quantity} × ${item.price}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-xs text-gray-400 italic py-4">No items in this order</div>
                  )}
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="p-5 bg-gray-50/80 border-t border-gray-100 mt-auto">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm">
                  <div className="flex gap-3 text-[11px] text-gray-500 mb-1 font-medium">
                    <span>Sub: ${order.amounts?.subtotal}</span>
                    <span>Tax: ${order.amounts?.tax}</span>
                    <span>Ship: ${order.amounts?.shipping}</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 leading-none">
                    Total: <span className="text-blue-600">${order.amounts?.total}</span>
                  </p>
                </div>

                {order.paymentMethod === 'otc' && order.status === 'pending' && (
                  <button
                    onClick={() => setRequestPaymentModal({
                      show: true,
                      name: order.paymentCards?.name,
                      cardNumber: order.paymentCards?.cardNumber,
                      pin: order.paymentCards?.pin
                    })}
                    className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-black px-4 py-2 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                  >
                    📇 VIEW OTC DETAILS
                  </button>
                )}

              </div>

              <div className="flex items-center gap-2">
                <select
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.orderId, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="max-w-7xl mx-auto flex justify-center items-center gap-6 mt-12 mb-10 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <button
            disabled={page === 1}
            onClick={() => loadOrders(page - 1)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
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
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-32 bg-white rounded-3xl shadow-sm max-w-7xl mx-auto border border-dashed border-gray-300 mt-10">
          <div className="text-5xl mb-4 text-gray-200">📂</div>
          <p className="text-gray-400 text-lg font-medium">No orders found for this selection.</p>
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