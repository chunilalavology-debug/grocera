import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { X, Calendar, ChevronRight, ShoppingBag, MapPin } from 'lucide-react';

// --- Reusable Classic Components ---

const OrderSkeleton = () => (
  <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 animate-pulse">
    <div className="flex justify-between items-center mb-4">
      <div className="space-y-2">
        <div className="h-3 w-32 bg-gray-100 rounded"></div>
        <div className="h-2 w-20 bg-gray-50 rounded"></div>
      </div>
      <div className="h-7 w-20 bg-gray-100 rounded-full"></div>
    </div>
    <div className="h-16 bg-gray-50 rounded-xl w-full"></div>
  </div>
);

const OrderDetailsModal = ({ order, onClose }) => {
  if (!order) return null;

  const address = order.address || {};
  const name = address.name || "Guest User";
  const amounts = order.amounts || {};

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-xl flex flex-col animate-in slide-in-from-bottom sm:fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 flex justify-between items-center border-b border-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Order Information</h2>
            <p className="text-gray-400 text-[11px] uppercase tracking-[0.15em] mt-0.5">ID: {order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7 no-scrollbar">

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Status</p>
              <p className="text-sm font-medium text-blue-600 capitalize">{order.status || 'Pending'}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Date</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(order.timeline?.createdAt).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>

          {/* Shipping */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-widest flex items-center gap-2">
              <MapPin size={13} className="text-gray-400" /> Shipping Address
            </h3>
            <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/30">
              <p className="font-semibold text-gray-800 text-sm">{name}</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                {address.addressLine1}, {address.addressLine2}<br />
                {address.city}, {address.state} {address.pincode}
              </p>
              <p className="text-[11px] text-gray-400 mt-3 font-medium">Contact: {address.phone || 'N/A'}</p>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-widest">Items ({order.itemsCount || 0})</h3>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                    <img src={item.product?.image} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-xs truncate">{item.productName}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Qty: {item.quantity} × ${item.price?.toFixed(2)}</p>
                  </div>
                  <p className="font-semibold text-gray-900 text-xs">${(item.subtotal || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="pt-4 border-t border-gray-100">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${amounts.subtotal?.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-400 italic"><span>Shipping & Tax</span><span>${((amounts.shipping || 0) + (amounts.tax || 0)).toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-900 font-semibold pt-2 text-sm">
                <span>Total Amount</span>
                <span>${amounts.total?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors">
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};

function Orders() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await api.get(`/user/orders${filter !== 'all' ? `?status=${filter}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Supporting both direct array and nested structure
      const data = response.success ? (response.data?.orders || response.data || []) : [];
      setOrders(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (isAuthenticated) fetchOrders();
    else setLoading(false);
  }, [isAuthenticated, fetchOrders]);

  useEffect(() => {
    document.body.style.overflow = selectedOrder ? 'hidden' : 'unset';
  }, [selectedOrder]);

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase();
    if (s === 'delivered') return 'text-emerald-600';
    if (s === 'pending') return 'text-amber-600';
    if (s === 'processing') return 'text-blue-600';
    return 'text-gray-400';
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="text-center">
        <ShoppingBag className="mx-auto mb-6 text-gray-200" size={40} />
        <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Account Access Required</h2>
        <p className="text-gray-400 text-xs mt-2 mb-8 uppercase tracking-widest">Please sign in to view history</p>
        <Link to="/login" className="px-10 py-3 bg-black text-white text-[11px] font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all">
          Sign In
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-14 text-center sm:text-left">
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">My Orders</h1>
          <p className="text-gray-400 text-[10px] font-medium uppercase tracking-[0.25em] mt-2">Personal Purchase History</p>

          <div className="flex justify-center sm:justify-start gap-4 mt-8 border-b border-gray-100">
            {['all', 'pending', 'processing', 'delivered'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`pb-3 text-[10px] font-semibold uppercase tracking-widest transition-all ${filter === f ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <OrderSkeleton key={i} />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-widest">No history found</p>
            <Link to="/products" className="text-blue-600 text-[11px] font-semibold uppercase tracking-widest mt-4 inline-block hover:underline">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.orderId}
                className="bg-white rounded-xl border border-gray-100 p-5 sm:p-6 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                      <Calendar size={12} /> {new Date(order.timeline?.createdAt).toDateString()}
                      <span className={`font-semibold ${getStatusStyle(order.status)}`}>• {order.status || 'Pending'}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Order #{order.orderNumber}</h3>
                  </div>

                  <div className="flex items-center justify-between sm:text-right gap-8">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Total</p>
                      <p className="text-sm font-semibold text-gray-900">${order.amounts?.total?.toFixed(2)}</p>
                    </div>
                    <div className="p-2 rounded-full bg-gray-50 text-gray-400 group-hover:text-black transition-colors">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

export default Orders;