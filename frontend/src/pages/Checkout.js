import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import api from '../services/api';
import toast from "react-hot-toast";

export default function Checkout() {
  const { items, total, itemCount, addToCart } = useCart();
  const navigate = useNavigate();
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    if (itemCount === 0) {
      navigate('/cart', { replace: true });
    }
  }, [itemCount, navigate]);

  // Billing constants (user spec)
  const TAX_AND_CONVENIENCE_RATE = 0.0887;   // 8.87% of order value
  const TAX_AND_CONVENIENCE_FIXED = 1.99;    // + $1.99 for all orders
  const PACKAGING_FEE = 2;
  const EXPRESS_EXTRA = 10;                   // $10 extra for 1-day priority

  const [deliveryType, setDeliveryType] = useState('standard'); // 'standard' | 'express'
  const [tipPercent, setTipPercent] = useState(0);
  const [tipInput, setTipInput] = useState('');

  const [showStripe, setShowStripe] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [driverNote, setDriverNote] = useState("");

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [addressError, setAddressError] = useState("");
  /** Per-field messages for the add-address modal */
  const [addressFieldErrors, setAddressFieldErrors] = useState({});

  // Checkout function ke andar top par:
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);

  const [vouchers, setVouchers] = useState([]);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);

  const GUEST_ADDRESS_ID = "guest";
  /** Labels shown in UI; values must match backend / Address model: Home | Work | Other */
  const ADDRESS_TYPE_OPTIONS = [
    { label: "Home", value: "Home" },
    { label: "Office", value: "Work" },
    { label: "Other", value: "Other" },
  ];
  const [newAddress, setNewAddress] = useState({
    name: "",
    phone: "",
    fullAddress: "",
    city: "",
    state: "",
    pincode: "",
    addressType: "Home",
  });

  const updateNewAddress = (patch) => {
    setNewAddress((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch);
    if (keys.length) {
      setAddressFieldErrors((fe) => {
        const next = { ...fe };
        keys.forEach((k) => {
          delete next[k];
        });
        return next;
      });
    }
  };

  const [cardDetails, setCardDetails] = useState({
    number: '',
    cvv: '',
    nameOnCard: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [showOtcPolicyModal, setShowOtcPolicyModal] = useState(false);
  const [otcPolicyAccepted, setOtcPolicyAccepted] = useState(false);
  const isVegetableCategory = (category = '') => {
    const c = String(category).toLowerCase();
    return c.includes('vegetable') || c === 'fresh vegetables' || c === 'vegetables';
  };

  const handleSelectCardPayment = () => {
    setPaymentMethod('card');
    setOtcPolicyAccepted(false);
  };

  const handleSelectOtcPayment = () => {
    if (otcPolicyAccepted) {
      setPaymentMethod('otc');
      return;
    }
    setShowOtcPolicyModal(true);
  };

  const handleOtcPolicyAccept = () => {
    setOtcPolicyAccepted(true);
    setPaymentMethod('otc');
    setShowOtcPolicyModal(false);
  };

  const handleOtcPolicyReject = () => {
    setShowOtcPolicyModal(false);
    setPaymentMethod('card');
  };

  const subtotal = total;
  const isVoucherApplied = appliedCoupon?.isVoucher === true;

  // Auto-apply referral discount (only when no voucher/coupon is manually applied)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return; // guest checkout: no referral discount
    if (isVoucherApplied) return; // user chose a coupon; don't override

    let cancelled = false;

    const run = async () => {
      try {
        const res = await api.get("/user/referral/discount", {
          params: { subtotal },
        });

        if (cancelled) return;

        const discountAmount = Number(res?.data?.discountAmount ?? 0);
        const eligible = Boolean(res?.data?.eligible);
        const code = res?.data?.code || "REFERRAL";

        if (eligible && discountAmount > 0) {
          setAppliedCoupon({
            code,
            discount: discountAmount,
            isVoucher: false,
          });
        } else {
          setAppliedCoupon(null);
        }
      } catch (err) {
        // If referral endpoint fails, don't block checkout; just don't apply auto discount.
        if (!cancelled) setAppliedCoupon(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [subtotal, isVoucherApplied]);

  // Standard delivery: $50+ free, $25–$49 → $4.99, below $25 → $9.99
  const standardDeliveryFee =
    subtotal >= 50 ? 0 : subtotal >= 25 ? 4.99 : 9.99;
  const deliveryFee =
    deliveryType === 'express' ? standardDeliveryFee + EXPRESS_EXTRA : standardDeliveryFee;

  const taxAndConvenienceFee =
    subtotal * TAX_AND_CONVENIENCE_RATE + TAX_AND_CONVENIENCE_FIXED;

  let tip = 0;
  let tipLabel = '';

  if (tipInput) {
    tip = parseFloat(tipInput) || 0;
    tipLabel = 'Tip / Support your delivery partner';
  } else if (tipPercent > 0) {
    tip = (subtotal * tipPercent) / 100;
    tipLabel = `Tip (${tipPercent}%)`;
  }

  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalTotal =
    subtotal +
    deliveryFee +
    taxAndConvenienceFee +
    PACKAGING_FEE +
    tip -
    discountAmount;


  const handleFinalCheckout = async () => {
    const isGuest = selectedAddressId === GUEST_ADDRESS_ID;
    const guestAddr = isGuest ? addresses.find((a) => a._id === GUEST_ADDRESS_ID) : null;
    if (!selectedAddressId || (isGuest && !guestAddr)) {
      toast.error("Please select or add a delivery address first");
      return;
    }

    if (paymentMethod === 'otc') {
      if (!cardDetails.nameOnCard.trim()) {
        toast.error("Please enter the name for OTC payment");
        return;
      }
      if (!cardDetails.number) {
        toast.error("Please enter your OTC card number to proceed.");
        return;
      }
      const pinDigits = String(cardDetails.cvv || "").replace(/\D/g, "");
      if (pinDigits.length !== 4) {
        toast.error("Please enter a 4-digit OTC PIN");
        return;
      }
    }

    setIsInitializing(true);
    try {
      const payload = {
        items: items.map(i => ({
          product: i.product._id,
          quantity: i.quantity,
        })),
        tip,
        driverNote,
        paymentMethod,
        deliveryType,
        subtotal,
        deliveryFee,
        taxAndConvenienceFee,
        packagingFee: PACKAGING_FEE,
        discountAmount: discountAmount || 0,
        finalTotal,
      };
      if (isGuest && guestAddr) {
        payload.address = {
          name: guestAddr.name,
          phone: guestAddr.phone,
          fullAddress: guestAddr.fullAddress,
          city: guestAddr.city,
          state: guestAddr.state,
          pincode: guestAddr.pincode,
          addressType: guestAddr.addressType || "Home",
        };
      } else {
        payload.addressId = selectedAddressId;
      }

      // couponCode only for manual vouchers; referral discount is computed in backend
      if (appliedCoupon?.code && appliedCoupon?.isVoucher) {
        payload.couponCode = appliedCoupon.code;
      }

      if (paymentMethod === 'otc') {
        payload.cardNumber = cardDetails.number;
        payload.pin = String(cardDetails.cvv || "").replace(/\D/g, "").slice(0, 4);
        payload.name = cardDetails.nameOnCard;
      }

      const res = await api.post("/user/orderPayment", payload);

      if (res.success) {
        if (paymentMethod === 'card' && res.url) {
          window.location.href = res.url;
        } else {
          toast.success("Order placed successfully!");
          const oid = res.data?._id ?? res.data?.id;
          const vt = res.viewToken;
          const q =
            oid != null
              ? `order=${oid}${vt ? `&t=${encodeURIComponent(vt)}` : ""}`
              : "";
          navigate(q ? `/order-success?${q}` : "/order-success");
        }
      } else {
        toast.error(res.message || "Checkout failed");
      }
    } catch (err) {
      console.error(err);
      const msg =
        (typeof err?.message === "string" && err.message.trim() ? err.message : null) ||
        err?.response?.data?.message ||
        (typeof err?.response?.data?.error === "string" ? err.response.data.error : null) ||
        "Something went wrong";
      toast.error(msg);
    } finally {
      setIsInitializing(false);
    }
  };

  const validateNewAddressFields = () => {
    const errors = {};
    const name = String(newAddress.name ?? "").trim();
    const phone = String(newAddress.phone ?? "").trim();
    const fullAddress = String(newAddress.fullAddress ?? "").trim();
    const city = String(newAddress.city ?? "").trim();
    const pincode = String(newAddress.pincode ?? "").trim();
    const digitsInPhone = phone.replace(/\D/g, "");

    if (!name) errors.name = "Receiver's name is required.";
    if (!phone) errors.phone = "Phone number is required.";
    else if (digitsInPhone.length < 10)
      errors.phone = "Enter a valid phone number (at least 10 digits).";
    if (!fullAddress) errors.fullAddress = "Street address is required.";
    if (!city) errors.city = "City is required.";
    if (!pincode) errors.pincode = "ZIP / postal code is required.";
    else if (!/^[A-Za-z0-9][A-Za-z0-9\s-]{2,}$/.test(pincode))
      errors.pincode = "ZIP / postal code looks invalid.";

    const allowedTypes = ADDRESS_TYPE_OPTIONS.map((o) => o.value);
    if (!allowedTypes.includes(newAddress.addressType)) {
      errors.addressType = "Pick a valid address type (Home, Office, or Other).";
    }

    return errors;
  };

  const handleAddAddress = async () => {
    setAddressError("");
    const fieldErrs = validateNewAddressFields();
    setAddressFieldErrors(fieldErrs);
    if (Object.keys(fieldErrs).length > 0) {
      setAddressError("Please fix the fields highlighted below.");
      return;
    }

    const token = localStorage.getItem("token");

    // Guest checkout: use address for this order only, no API call
    if (!token) {
      const guestAddr = {
        _id: GUEST_ADDRESS_ID,
        name: newAddress.name,
        phone: newAddress.phone,
        fullAddress: newAddress.fullAddress,
        city: newAddress.city,
        state: newAddress.state,
        pincode: newAddress.pincode,
        addressType: newAddress.addressType || "Home",
      };
      setAddresses([guestAddr]);
      setSelectedAddressId(GUEST_ADDRESS_ID);
      setNewAddress({
        name: "",
        phone: "",
        fullAddress: "",
        city: "",
        state: "",
        pincode: "",
        addressType: "Home",
      });
      setAddressFieldErrors({});
      setShowNewAddressForm(false);
      toast.success("Address added. You can place your order.");
      return;
    }

    const loadingToast = toast.loading("Saving address...");
    try {
      const payload = {
        name: newAddress.name,
        phone: newAddress.phone,
        fullAddress: newAddress.fullAddress,
        city: newAddress.city,
        state: newAddress.state,
        pincode: newAddress.pincode,
        addressType: newAddress.addressType || "Home",
        isDefault: false,
      };

      const res = await api.post("/user/address", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.dismiss(loadingToast);

      if (res.success) {
        toast.success("Address saved successfully");
        setAddresses(prev => [...prev, res.data]);
        setSelectedAddressId(res.data._id);
        setNewAddress({
          name: "",
          phone: "",
          fullAddress: "",
          city: "",
          state: "",
          pincode: "",
          addressType: "Home",
        });
        setAddressFieldErrors({});
        setShowNewAddressForm(false);
      } else {
        setAddressError(res.message || "Failed to save address");
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      const msg = err?.response?.data?.message || err?.message || "Something went wrong while saving";
      setAddressError(msg);
      if (typeof msg === "string" && /addressType|address type|Work|Home|Other/i.test(msg)) {
        setAddressFieldErrors((fe) => ({ ...fe, addressType: msg }));
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return; // Guest: no saved addresses; they add one in checkout

    const fetchAddresses = async () => {
      try {
        const res = await api.get(`/user/getMyAddressList`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res?.success && Array.isArray(res.data)) {
          setAddresses(res.data);
          const defaultAddr = res.data.find((a) => a.isDefault);
          if (defaultAddr) setSelectedAddressId(defaultAddr._id);
        }
      } catch (err) {
        console.error("Fetch address error", err);
      }
    };

    fetchAddresses();
  }, []);

  useEffect(() => {
    if (!showCouponModal) return;

    const fetchVouchers = async () => {
      try {
        setIsLoadingVouchers(true);
        const res = await api.get("/user/vouchers");

        if (res.success) {
          setVouchers(res.data || []);
        }
      } catch (err) {
        console.error("Voucher fetch error", err);
        toast.error(
          err.message ||
          err?.response?.data?.message ||
          "Offers are currently unavailable. Please refresh or try again in a moment."
        );
      } finally {
        setIsLoadingVouchers(false);
      }
    };

    fetchVouchers();
  }, [showCouponModal]);

  useEffect(() => {
    if (!showOtcPolicyModal) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleOtcPolicyReject();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showOtcPolicyModal]);

  useEffect(() => {
    if (!items?.length) {
      setRecommendedProducts([]);
      return;
    }

    let cancelled = false;
    const loadRecommendations = async () => {
      try {
        setLoadingRecommendations(true);
        const response = await api.get('/user/products', {
          params: { page: 1, limit: 60, category: 'All', search: '' },
        });

        const allProducts = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];

        const cartIds = new Set(items.map((i) => i.product?._id || i.product?.id).filter(Boolean));
        const cartCategories = items
          .map((i) => String(i.product?.category || '').toLowerCase())
          .filter(Boolean);

        const scored = allProducts
          .filter((p) => {
            const pid = p?._id || p?.id;
            return pid && !cartIds.has(pid) && p?.inStock !== false;
          })
          .map((p) => {
            const productCategory = String(p?.category || '').toLowerCase();
            const sameCategory = cartCategories.some((c) =>
              productCategory && (productCategory === c || productCategory.includes(c) || c.includes(productCategory))
            );
            const hasDiscount = Number(p?.salePrice || 0) > 0 && Number(p?.price || 0) > Number(p?.salePrice || 0);
            const dealBoost = p?.hasDeal ? 4 : 0;
            const score = (sameCategory ? 5 : 0) + (hasDiscount ? 2 : 0) + dealBoost;
            return { product: p, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((x) => x.product);

        if (!cancelled) setRecommendedProducts(scored);
      } catch (error) {
        if (!cancelled) setRecommendedProducts([]);
      } finally {
        if (!cancelled) setLoadingRecommendations(false);
      }
    };

    loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const handleAddRecommended = (product) => {
    if (!product) return;
    const productToAdd = isVegetableCategory(product.category)
      ? { ...product, selectedWeight: 1, displayName: `${product.name} (1 lb)` }
      : product;
    const result = addToCart(productToAdd, 1);
    if (!result?.success) {
      toast.error(result?.message || 'Could not add item');
      return;
    }
    toast.success(`${product.name} added to cart`);
  };

  // Discount Process – trim code, support both response shapes, validate discount
  const handleApplyCoupon = async () => {
    const code = (coupon || '').trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a coupon code.');
      return;
    }
    setIsApplying(true);
    setAppliedCoupon(null); // clear previous so UI doesn't show stale discount while loading

    try {
      const res = await api.post("/user/applyCoupon", { code, subtotal });

      // Backend may return discount in res.data.discountAmount or res.discountAmount
      const rawDiscount = res?.data?.discountAmount ?? res?.discountAmount;
      const discountValue = Number(rawDiscount);
      const isValidDiscount = !Number.isNaN(discountValue) && discountValue >= 0;

      if (res?.success && isValidDiscount) {
        setAppliedCoupon({ code, discount: discountValue, isVoucher: true });
        setCoupon(code); // keep input in sync (trimmed + uppercase)
        setShowCouponModal(false);
        toast.success(
          `Success! You saved $${discountValue.toFixed(2)} with "${code}".`
        );
      } else if (res?.success && !isValidDiscount) {
        toast.error(res?.message || "This coupon code is not applicable to your current order.");
      } else {
        toast.error(res?.message || "This coupon code is not applicable to your current items.");
      }
    } catch (err) {
      const errorMessage =
        err?.message ||
        err?.response?.data?.message ||
        "Invalid coupon code. Please check and try again.";
      toast.error(errorMessage);
    } finally {
      setIsApplying(false);
    }
  };
  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Your cart is empty.</p>
          <Link to="/cart" className="text-[#3090cf] font-semibold hover:underline">Return to cart</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:py-8 sm:px-6 md:px-6 md:py-10 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10">

        {/* LEFT COLUMN: Checkout Flow (Shopify-style) */}
        <div className="lg:col-span-7 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-6 md:p-8">
              {/* Breadcrumb */}
              <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-500 mb-6 sm:mb-8" aria-label="Breadcrumb">
                <Link to="/cart" className="hover:text-[#3090cf]">Cart</Link>
                <span aria-hidden="true">›</span>
                <span className="text-slate-900 font-medium">Information</span>
                <span aria-hidden="true">›</span>
                <span className="text-slate-400">Shipping</span>
                <span aria-hidden="true">›</span>
                <span className="text-slate-400">Payment</span>
              </nav>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Checkout</h1>
              <p className="text-slate-500 text-sm mb-6 sm:mb-8">Contact and delivery details</p>

              {/* Contact / Shipping heading */}
              <h2 className="text-base font-semibold text-slate-800 mb-4">Shipping address</h2>

              {!showStripe ? (
                <div className="space-y-4">
                  {addresses.map(addr => (
                    <div
                      key={addr._id}
                      onClick={() => setSelectedAddressId(addr._id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all
        ${selectedAddressId === addr._id
                          ? "border-[#3090cf] bg-blue-50"
                          : "border-slate-200 hover:border-[#3090cf]/50"
                        }`}
                    >
                      <p className="font-bold text-gray-800">
                        {addr.name} ({addr.addressType === "Work" ? "Office" : addr.addressType || "Home"})
                      </p>
                      <p className="text-sm text-gray-600">
                        {addr.fullAddress}, {addr.city} - {addr.pincode}
                      </p>
                      <p className="text-sm text-gray-500">📞 {addr.phone}</p>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setAddressFieldErrors({});
                      setAddressError("");
                      setShowNewAddressForm(true);
                    }}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-600 hover:border-[#3090cf] hover:text-[#3090cf] transition-colors"
                  >
                    + Add new address
                  </button>

                </div>


              ) : (
                <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold text-sm">✓</span>
                      <h2 className="text-xl font-bold text-gray-800">Payment Details</h2>
                    </div>
                    <button onClick={() => setShowStripe(false)} className="text-blue-600 font-bold text-sm hover:underline">Edit Shipping</button>
                  </div>

                  <div className="flex flex-col items-center justify-center pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-3">Powered By Stripe</p>
                    <div className="flex space-x-4 opacity-40 grayscale">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="MC" className="h-6" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-4" />
                    </div>
                  </div>


                </div>
              )}

              {/* Payment method – vertical list, clean selection */}
              <div className="mt-10">
                <h2 className="text-base font-semibold text-slate-800 mb-4">Payment method</h2>
                <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={handleSelectCardPayment}
                    className={`w-full flex items-center gap-4 p-4 min-h-[52px] sm:min-h-0 text-left transition-colors border-b border-slate-100 last:border-b-0 ${paymentMethod === 'card' ? 'bg-blue-50 border-l-4 border-l-[#3090cf]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === 'card' ? 'border-[#3090cf] bg-white' : 'border-slate-300'}`}>
                      {paymentMethod === 'card' && <span className="w-2 h-2 rounded-full bg-[#3090cf]" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">Credit / Debit card</p>
                      <p className="text-sm text-slate-500">Pay securely with Stripe</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectOtcPayment}
                    className={`w-full flex items-center gap-4 p-4 min-h-[52px] sm:min-h-0 text-left transition-colors ${paymentMethod === 'otc' ? 'bg-blue-50 border-l-4 border-l-[#3090cf]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === 'otc' ? 'border-[#3090cf] bg-white' : 'border-slate-300'}`}>
                      {paymentMethod === 'otc' && <span className="w-2 h-2 rounded-full bg-[#3090cf]" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">OTC Card</p>
                      <p className="text-sm text-slate-500">Pay with OTC card number and PIN</p>
                    </div>
                  </button>
                </div>

                {paymentMethod === 'otc' && otcPolicyAccepted && (
                  <div className="mt-6 space-y-4">
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">OTC details</h4>

                    <PremiumInput
                      label="Name on Card"
                      placeholder="Full Name"
                      value={cardDetails.nameOnCard}
                      onChange={(e) => setCardDetails({ ...cardDetails, nameOnCard: e.target.value })}
                    />

                    <PremiumInput
                      label="Card Number"
                      placeholder="0000 0000 0000 0000"
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                    />

                    <PremiumInput
                      label="PIN"
                      type="password"
                      placeholder="****"
                      maxLength="4"
                      value={cardDetails.cvv}
                      onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                    />
                  </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link to="/cart" className="text-sm font-medium text-[#3090cf] hover:underline">
                  ← Return to cart
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Order summary (Shopify-style) */}
        <div className="lg:col-span-5 min-w-0">
          <div className="sticky top-20 sm:top-24 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 md:p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Order summary</h2>

              <div className="max-h-60 overflow-y-auto space-y-4 mb-8 pr-2 custom-scrollbar">
                {items.map((item) => (
                  <div key={item.product._id} className="flex items-center justify-between gap-3 group min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img src={item.product.image} alt="" className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 object-cover rounded-xl sm:rounded-2xl border border-gray-100 group-hover:scale-105 transition-transform" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 line-clamp-1">{item.product.name}</p>
                        <p className="text-xs text-gray-500 font-medium">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-gray-900 flex-shrink-0">${(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Recommended add-ons</h3>
                  <span className="text-[11px] text-slate-500">Before checkout</span>
                </div>
                {loadingRecommendations ? (
                  <div className="text-sm text-slate-400 py-3">Loading recommendations...</div>
                ) : recommendedProducts.length === 0 ? (
                  <div className="text-sm text-slate-400 py-3">No add-ons available right now.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recommendedProducts.map((p) => (
                      <div key={p._id || p.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-white"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{p.category || 'Product'}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#3090cf]">
                            ${Number(p.salePrice > 0 ? p.salePrice : p.price || 0).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddRecommended(p)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#3090cf] text-white hover:bg-[#2878b3]"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* --- IMPROVED COUPON SECTION --- */}
              <div className="mb-6">
                <div
                  onClick={() => setShowCouponModal(true)}
                  className="group cursor-pointer p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-400 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-xl">
                      🎟️
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800">
                        {appliedCoupon ? `Code: ${appliedCoupon.code}` : "Apply Coupon"}
                      </p>
                      <p className="text-[11px] text-blue-600 font-bold uppercase tracking-tight">
                        {appliedCoupon ? "Discount Applied!" : "Save more with available offers"}
                      </p>
                    </div>
                  </div>
                  <span className="text-blue-600 text-sm font-black group-hover:translate-x-1 transition-transform">
                    {appliedCoupon ? "CHANGE" : "VIEW →"}
                  </span>
                </div>

                {appliedCoupon && (
                  <div className="mt-2 flex justify-between items-center px-2">
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">SAVED ${discountAmount.toFixed(2)}</span>
                    <button onClick={() => { setAppliedCoupon(null); setCoupon('') }} className="text-[10px] text-red-500 font-bold underline">Remove</button>
                  </div>
                )}
              </div>
              {/* --- END COUPON SECTION --- */}

              {/* Delivery option */}
              <div className="mb-6">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-3 ml-1">
                  Delivery
                </label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${deliveryType === 'express' ? 'border-[#3090cf] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input
                      type="radio"
                      name="deliveryType"
                      checked={deliveryType === 'express'}
                      onChange={() => setDeliveryType('express')}
                      className="mt-1 accent-[#3090cf]"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Express</span>
                      <p className="text-xs text-slate-500 mt-0.5">$10 extra for priority 1-day delivery. Shipped within 24 hours.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${deliveryType === 'standard' ? 'border-[#3090cf] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input
                      type="radio"
                      name="deliveryType"
                      checked={deliveryType === 'standard'}
                      onChange={() => setDeliveryType('standard')}
                      className="mt-1 accent-[#3090cf]"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Standard</span>
                      <p className="text-xs text-slate-500 mt-0.5">Orders $50+ → Free. $25–$49 → $4.99. Below $25 → $9.99. Shipped within 24–48 hours.</p>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-slate-600 mt-2 ml-1">
                  {deliveryType === 'express'
                    ? `Express delivery: $${deliveryFee.toFixed(2)} — included in your total below.`
                    : `Standard delivery: ${deliveryFee === 0 ? 'Free — ' : `$${deliveryFee.toFixed(2)} — `}included in your total below.`}
                </p>
              </div>

              {/* Tip / Support your delivery partner */}
              <div className="mb-6">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-3 ml-1">
                  Tip / Support your delivery partner
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[5, 10, 15, 20].map(percent => (
                      <button
                        key={percent}
                        type="button"
                        onClick={() => {
                          if (tipPercent === percent) {
                            setTipPercent(0);
                          } else {
                            setTipPercent(percent);
                            setTipInput('');
                          }
                        }}
                        className={`py-3 min-h-[48px] sm:min-h-0 text-sm font-bold rounded-xl border-2 transition-all duration-200 ${tipPercent === percent
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-100 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                  <div className="relative max-w-full sm:max-w-xs">
                    <input
                      type="number"
                      placeholder="Custom amount ($)"
                      value={tipInput}
                      onChange={(e) => {
                        setTipInput(e.target.value);
                        setTipPercent(0);
                      }}
                      className={`w-full py-3 min-h-[48px] sm:min-h-0 pl-7 pr-3 text-sm font-bold rounded-xl border-2 outline-none transition-all ${tipInput
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white focus:border-gray-300 text-gray-600'
                        }`}
                    />
                    <span
                      className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${tipInput ? 'text-blue-700' : 'text-gray-400'}`}
                      aria-hidden
                    >
                      $
                    </span>
                  </div>
                </div>
              </div>

              {/* Billing section */}
              <div className="space-y-3 pt-6 border-t border-gray-50">
                <SummaryRow label="Subtotal" value={subtotal} />
                <SummaryRow
                  label="Delivery fee"
                  value={deliveryFee}
                  isFree={deliveryFee === 0}
                />
                <SummaryRow label="Convenience Fee" value={taxAndConvenienceFee} />
                <SummaryRow label="Packaging fee" value={PACKAGING_FEE} />
                {tip > 0 && (
                  <SummaryRow
                    label={tipLabel}
                    value={tip}
                    isTip
                  />
                )}
                {discountAmount > 0 && (
                  <SummaryRow
                    label="Coupon Discount"
                    value={discountAmount}
                    isDiscount
                  />
                )}


                <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-slate-200">
                  <span className="text-base font-bold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-[#3090cf]">USD ${finalTotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Proceed to payment below to complete your order.</p>
              </div>

              <div className="mt-8">
                <textarea
                  rows="2"
                  placeholder="Special instructions for the driver..."
                  className="w-full text-sm p-4 bg-gray-50 border-transparent rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-medium"
                  value={driverNote}
                  onChange={(e) => setDriverNote(e.target.value)}
                />
              </div>

              {/* <button
                disabled={!selectedAddressId || isInitializing}
                onClick={handleContinueToPayment}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50"
              >
                {isInitializing ? "Processing..." : "Continue to Payment"}
              </button> */}

              <button
                disabled={!selectedAddressId || isInitializing}
                onClick={handleFinalCheckout}
                className="w-full mt-6 min-h-[48px] sm:min-h-0 bg-[#3090cf] hover:bg-[#2878b3] text-white font-bold py-4 rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
              >
                {isInitializing
                  ? "Processing..."
                  : paymentMethod === 'card'
                    ? "Pay with Card"
                    : "Place Order (OTC)"}
              </button>

              {!selectedAddressId && (
                <p className="text-sm text-red-500 text-center mt-2">
                  Please select a delivery address
                </p>
              )}

            </div>

            {/* <div className="bg-blue-600 rounded-2xl p-4 text-center text-white">
              <p className="text-xs font-bold opacity-80">🛡 256-BIT SSL ENCRYPTED SECURE CHECKOUT</p>
            </div> */}
          </div>
        </div>
      </div>
      {showNewAddressForm && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowNewAddressForm(false)}
        >
          {/* Background Overlay with subtle blur */}
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />

          {/* Modal Card */}
          <div
            className="bg-white w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl relative my-auto animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 flex justify-between items-center border-b border-gray-50 flex-shrink-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Add New Address</h3>
                <p className="text-sm text-gray-500">Enter your delivery information</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAddressForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <span className="text-2xl text-gray-400">×</span>
              </button>
            </div>

            {addressError && (
              <div className="mx-4 sm:mx-8 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-shake">
                <span className="text-red-500 text-lg">⚠️</span>
                <p className="text-red-600 text-xs font-bold uppercase tracking-wide">{addressError}</p>
              </div>
            )}

            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-8 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-6">

                {/* Row 1: Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PremiumInput
                    label="Receiver's Name"
                    placeholder="Full name"
                    value={newAddress.name}
                    error={addressFieldErrors.name}
                    onChange={(e) => updateNewAddress({ name: e.target.value })}
                  />
                  <PremiumInput
                    label="Phone Number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Mobile number"
                    value={newAddress.phone}
                    error={addressFieldErrors.phone}
                    onChange={(e) => updateNewAddress({ phone: e.target.value })}
                  />
                </div>

                {/* Row 2: Full Address */}
                <PremiumInput
                  label="Full Address"
                  placeholder="House no, Building, Street, Area..."
                  value={newAddress.fullAddress}
                  error={addressFieldErrors.fullAddress}
                  onChange={(e) => updateNewAddress({ fullAddress: e.target.value })}
                />

                {/* Row 3: City, State, Pincode */}
                <div className="grid grid-cols-3 gap-3">
                  <PremiumInput
                    label="City"
                    placeholder="City"
                    value={newAddress.city}
                    error={addressFieldErrors.city}
                    onChange={(e) => updateNewAddress({ city: e.target.value })}
                  />
                  <PremiumInput
                    label="State"
                    placeholder="e.g. IL"
                    value={newAddress.state}
                    error={addressFieldErrors.state}
                    onChange={(e) => updateNewAddress({ state: e.target.value })}
                  />
                  <PremiumInput
                    label="Zip"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="Zipcode"
                    value={newAddress.pincode}
                    error={addressFieldErrors.pincode}
                    onChange={(e) => updateNewAddress({ pincode: e.target.value })}
                  />
                </div>

                {/* Address Type Selection */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 ml-1">
                    Address Type
                  </label>
                  <div className="flex gap-3">
                    {ADDRESS_TYPE_OPTIONS.map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateNewAddress({ addressType: value })}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${newAddress.addressType === value
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {addressFieldErrors.addressType ? (
                    <p className="text-xs text-red-600 mt-2 font-semibold">{addressFieldErrors.addressType}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-8 border-t border-gray-50 bg-gray-50/50 flex-shrink-0">
              <button
                type="button"
                onClick={handleAddAddress}
                className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
              >
                {localStorage.getItem("token") ? "Save Address & Continue" : "Use this address"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COUPON LISTING MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Background Overlay */}
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]"
            onClick={() => setShowCouponModal(false)}
          />

          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl relative animate-in slide-in-from-bottom sm:zoom-in duration-300 overflow-hidden flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Available Coupons</h3>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Select a voucher to save more</p>
              </div>
              <button
                onClick={() => setShowCouponModal(false)}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
              {/* Manual Input Section */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Have a promo code?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="E.g. SAVE20"
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={!coupon || isApplying}
                    className="px-5 bg-blue-600 text-white text-xs font-bold rounded-xl uppercase hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-md"
                  >
                    {isApplying ? '...' : 'Apply'}
                  </button>
                </div>
              </div>

              {/* Vouchers List */}
              <div className="space-y-3 pt-2">
                {isLoadingVouchers ? (
                  <div className="py-10 text-center animate-pulse text-gray-400 font-medium text-sm">Searching for best deals...</div>
                ) : vouchers.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm italic">No coupons available at the moment.</div>
                ) : (
                  vouchers.map((v) => (
                    <div
                      key={v._id}
                      onClick={() => v.isActive && setCoupon(v.code)}
                      className={`relative border-2 rounded-2xl p-4 cursor-pointer transition-all ${coupon === v.code ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-md font-bold text-gray-900">{v.code}</span>
                            {v.discountType === 'fixed' && (
                              <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">Flat Discount</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 line-clamp-1">{v.description || 'Valid on this order'}</p>

                          <div className="mt-3 flex gap-4">
                            <div>
                              <span className="block text-[9px] text-gray-400 uppercase font-bold">Benefit</span>
                              <span className="font-bold text-blue-600 text-sm">
                                {v.discountType === 'percentage' ? `${v.discountValue}% Off` : `$${v.discountValue} Off`}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 uppercase font-bold">Min. Spend</span>
                              <span className="font-bold text-gray-700 text-sm">${v.minPurchase}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoupon(v.code);
                            }}
                            className={`text-[10px] font-bold uppercase px-4 py-2 rounded-lg transition-all ${coupon === v.code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            {coupon === v.code ? 'Selected' : 'Use Code'}
                          </button>
                          <p className="text-[9px] text-gray-400 mt-2 font-medium">Ends: {new Date(v.endAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showOtcPolicyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="Close policy dialog"
            onClick={handleOtcPolicyReject}
          />
          <div
            className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="otc-policy-title"
          >
            <h3 id="otc-policy-title" className="text-lg font-bold text-slate-900 mb-3">
              OTC Card Payment &amp; Privacy Notice
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              When you enter your OTC Card number and PIN to complete your purchase, the information is securely encrypted and used only to process your order.
              In some cases, a temporary encrypted record of the card details may be stored.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleOtcPolicyReject}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={handleOtcPolicyAccept}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#3090cf] text-white font-bold text-sm hover:bg-[#2878b3] transition-colors shadow-md shadow-blue-100"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PremiumInput({ label, error, className, ...props }) {
  const err = typeof error === "string" && error.trim() ? error.trim() : "";
  return (
    <div className="flex flex-col group">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2 ml-1 group-focus-within:text-blue-600 transition-colors">
        {label}
      </label>
      <input
        {...props}
        aria-invalid={err ? "true" : undefined}
        className={`p-4 bg-gray-50 border-2 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-600/5 outline-none transition-all font-bold text-gray-800 placeholder:text-gray-300 text-sm ${
          err ? "border-red-300 focus:border-red-400" : "border-transparent focus:border-blue-600/20"
        } ${className || ""}`}
      />
      {err ? <p className="text-xs text-red-600 mt-1.5 font-semibold leading-snug">{err}</p> : null}
    </div>
  );
}

function SummaryRow({ label, value, isFree, isTip, isDiscount }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500 font-bold">{label}</span>
      <span className={`font-black 
        ${isFree ? 'text-green-500 uppercase' :
          isDiscount ? 'text-red-500' :
            isTip ? 'text-blue-500' :
              'text-gray-900'}`}>
        {isFree
          ? 'Free'
          : isDiscount
            ? `-$${Math.abs(value).toFixed(2)}`
            : `$${value.toFixed(2)}`}
      </span>
    </div>
  );
}