import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Check, Package, MapPin, ChevronRight, ShoppingBag, Phone, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [orderDetails, setOrderDetails] = useState(null);
  const shipping = searchParams.get('shipping');
  const [loading, setLoading] = useState(true);
  const [failedImageIndices, setFailedImageIndices] = useState(() => new Set());

  const token = localStorage.getItem("token");
  const orderId = searchParams.get('order');

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await api.get(`/user/getUserOrderById/?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.success) {
          setOrderDetails(response.data);
          clearCart();
        }
      } catch (error) {
        console.error('Order Fetch Error:', error);
        toast.error(error.message || 'Failed to load order details.');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) fetchOrderDetails();
    else setLoading(false);
  }, []);

  // Poll until payment becomes "paid" for shipping orders (webhook delay)
  useEffect(() => {
    if (!shipping || shipping !== "1") return;
    if (!orderDetails) return;
    if (orderDetails.paymentStatus === "paid") return;

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/user/getUserOrderById/?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response?.success) {
          setOrderDetails(response.data);
          if (response.data?.paymentStatus === "paid") clearInterval(interval);
        }
      } catch (err) {
        // ignore transient polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [shipping, orderDetails, orderId, token]);

  // Auto download shipping label when payment is paid
  useEffect(() => {
    if (!orderDetails) return;
    if (orderDetails.paymentStatus !== "paid") return;
    if (!orderDetails.shippingLabelUrl) return;

    try {
      const a = document.createElement("a");
      a.href = orderDetails.shippingLabelUrl;
      a.download = "shipping-label.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      // If auto download fails, user can still manually download via Orders modal (future enhancement).
    }
  }, [orderDetails?.paymentStatus, orderDetails?.shippingLabelUrl]);

  // useEffect(() => {
  //   if (!orderDetails) return;

  //   if (orderDetails.paymentStatus !== 'paid') {
  //     const interval = setInterval(async () => {
  //       try {
  //         const response = await api.get(
  //           `/user/getUserOrderById/?orderId=${orderId}`,
  //           { headers: { Authorization: `Bearer ${token}` } }
  //         );

  //         if (response.success) {
  //           setOrderDetails(response.data);

  //           if (response.data.paymentStatus === 'paid') {
  //             clearCart();
  //             clearInterval(interval);
  //           }
  //         }
  //       } catch (err) {
  //         console.error("Polling error:", err);
  //       }
  //     }, 3000);

  //     return () => clearInterval(interval);
  //   }
  // }, [orderDetails]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-2 border-gray-100 border-t-black rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-semibold tracking-widest text-gray-400 uppercase">Processing Details</p>
        </div>
      </div>
    );
  }

  if (!orderDetails) return null;

  const steps = ["pending", "processing", "shipped", "delivered"];
  const currentStatusIndex = steps.indexOf(orderDetails.status?.toLowerCase()) !== -1
    ? steps.indexOf(orderDetails.status?.toLowerCase())
    : 0;

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: orderDetails.currency || 'USD',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans antialiased text-gray-900 pb-20">
      <div className="bg-white pt-16 pb-10 px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500 rounded-full mb-6 shadow-xl shadow-emerald-100">
            <Check className="w-6 h-6 text-white" strokeWidth={3} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {orderDetails.paymentStatus === 'paid'
              ? 'Thank you for your purchase'
              : 'Payment received'}
          </h1>

          <p className="text-gray-400 text-sm md:text-base">
            {orderDetails.paymentStatus === 'paid'
              ? <>Order <span className="text-black font-semibold">#{orderDetails.orderNumber}</span> confirmed.</>
              : 'Confirming your order, please wait...'}
          </p>

        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-10">

        <div className="lg:col-span-7 space-y-8">

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative flex justify-between items-center">
              {steps.map((step, index) => (
                <div key={step} className="flex flex-col items-center z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500 border ${index <= currentStatusIndex ? "bg-black border-black text-white" : "bg-white border-gray-200 text-gray-300"
                    }`}>
                    {index < currentStatusIndex ? <Check size={14} /> : index + 1}
                  </div>
                  <span className={`mt-2 text-[10px] font-bold uppercase tracking-tighter ${index <= currentStatusIndex ? "text-black" : "text-gray-300"}`}>
                    {step}
                  </span>
                </div>
              ))}
              <div className="absolute top-4 left-0 w-full h-[1px] bg-gray-100 -z-0">
                <div
                  className="h-full bg-black transition-all duration-1000"
                  style={{ width: `${(currentStatusIndex / (steps.length - 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Items Container */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Order Summary</h3>

              {orderDetails.items?.length > 0 ? (
                <div className="space-y-6">
                  {orderDetails.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 group">
                      {/* Product Image Section */}
                      <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden">
                        {(item.product?.image || item?.product?.image) && !failedImageIndices.has(index) ? (
                          <img
                            src={item.product?.image || item?.product?.image}
                            alt={item.productName || item?.name || "Product"}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            onError={() => setFailedImageIndices((prev) => new Set([...prev, index]))}
                          />
                        ) : (
                          <Package size={24} className="text-gray-300" />
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-800 line-clamp-1">
                          {item.productName || item.name || "Product Name"}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 font-medium italic">
                          Qty: {item.quantity || 1}
                        </p>
                      </div>

                      {/* Price */}
                      <p className="text-sm font-bold text-gray-900">
                        {formatPrice(item.price || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No specific items listed, standard order processing.</p>
              )}

              <div className="mt-8 pt-6 border-t border-gray-50 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tax</span>
                  <span className="font-semibold">{formatPrice(orderDetails.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Shipping</span>
                  <span className="font-semibold">{formatPrice(orderDetails.shippingAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-4">
                  <span>Total Amount</span>
                  <span className="text-emerald-600 font-black">{formatPrice(orderDetails.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Customer & Actions */}
        <div className="lg:col-span-5 space-y-6">

          {/* Shipping Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-500"><MapPin size={18} /></div>
              <h3 className="font-bold text-gray-800">Shipping Details</h3>
            </div>

            {orderDetails.addressId && (
              <div className="text-sm leading-relaxed">
                <p className="font-bold text-gray-900 mb-1">{orderDetails.addressId.name}</p>
                <p className="text-gray-500 font-medium">{orderDetails.addressId.addressLine1}</p>
                <p className="text-gray-500 font-medium">{orderDetails.addressId.addressLine2}</p>
                <p className="text-gray-500 font-medium">{orderDetails.addressId.city}, {orderDetails.addressId.state} - {orderDetails.addressId.pincode}</p>

                <div className="mt-4 flex items-center gap-2 text-gray-400 font-semibold border-t border-gray-50 pt-4">
                  <Phone size={14} className="text-gray-300" />
                  <span>{orderDetails.addressId.phone}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-500"><CreditCard size={18} /></div>
              <h3 className="font-bold text-gray-800 text-sm italic">Payment Status</h3>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-gray-400 tracking-widest">{orderDetails.paymentMethod}</span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${orderDetails.paymentStatus === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                {orderDetails.paymentStatus}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid gap-3 pt-4">
            <Link to="/orders" className="flex items-center justify-between w-full bg-black text-white px-6 py-4 rounded-xl font-bold hover:shadow-lg transition-all text-sm">
              View All Orders <ChevronRight size={16} />
            </Link>
            <Link to="/products" className="flex items-center justify-center gap-2 w-full bg-gray-50 text-gray-600 px-6 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all text-sm">
              <ShoppingBag size={16} /> Continue Shopping
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

export default OrderSuccess;