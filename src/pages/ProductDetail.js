import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ChevronLeft, ShoppingCart, Repeat, Info } from 'lucide-react';

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const [isAlreadySubscribed, setIsAlreadySubscribed] = useState(false);

  const [isSubscribe, setIsSubscribe] = useState(false);
  const [frequency, setFrequency] = useState("DAILY");
  const [days, setDays] = useState([]);
  const [startDate, setStartDate] = useState("");

  const NON_SUBSCRIPTION_CATEGORIES = ["spices", "masala", "rice", "grains", "lentils", "pulses", "snacks", "sweets", "frozen", "pooja", "idol"];
  const weightOptions = [1, 2, 3, 5];

  const isSubscribable = product?.category
    ? !NON_SUBSCRIPTION_CATEGORIES.some((c) => product.category.toLowerCase().includes(c))
    : false;

  const isVegetable = product?.category?.toLowerCase().includes('vegetable') ||
    product?.category === 'Fresh Vegetables' ||
    product?.category === 'Vegetables';

  // --- Handlers ---
  const handleWeightChange = (change) => {
    const currentIndex = weightOptions.indexOf(selectedWeight);
    let newIndex = Math.max(0, Math.min(weightOptions.length - 1, currentIndex + change));
    setSelectedWeight(weightOptions[newIndex]);
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    const stock = product?.quantity || product?.stockQuantity || 999;
    if (newQuantity >= 1 && newQuantity <= stock) setQuantity(newQuantity);
  };

  const toggleDay = (day) => {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSubscribe = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error("Please login to subscribe");
      return;
    }
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }
    if (frequency === "WEEKLY" && days.length === 0) {
      toast.error("Please select at least one day");
      return;
    }

    const toastId = toast.loading("Creating subscription...");
    try {
      await api.post("/user/subscription/create", {
        productId: product._id,
        quantity: isVegetable ? selectedWeight : quantity,
        frequency,
        days,
        startDate,
      }, { headers: { 'Authorization': `Bearer ${token}` } });

      toast.success("Subscription created successfully! ✅", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to create subscription", { id: toastId });
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    let token = localStorage.getItem('token');

    if (!token) {

      toast.error("Please login first to add items to cart");

      setTimeout(() => {
        navigate('/login');
      }, 500); // 0.5 sec delay
    }
    try {
      setAddingToCart(true);
      const itemToAdd = isVegetable ? {
        ...product,
        selectedWeight,
        displayName: `${product.name} (${selectedWeight} lb)`
      } : product;

      await addToCart(itemToAdd, isVegetable ? 1 : quantity);
      navigate('/cart');
    } catch (err) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/user/products/getById?id=${id}`);
        const data = response.data || response.product || response;
        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

  const checkSubscription = async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await api.get(
        `/user/checkSubscription?productId=${productId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data?.isSubscribed) {
        setIsAlreadySubscribed(true);

        setIsSubscribe(true);
        setFrequency(res.data.subscription.frequency);
        setDays(res.data.subscription.days || []);
        setStartDate(res.data.subscription.startDate);
      }
    } catch (err) {
      console.error("Subscription check failed", err);
    }
  };

  useEffect(() => {
    if (product?._id) {
      checkSubscription(product._id);
    }
  }, [product]);


  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-medium text-lg">Loading fresh products...</p>
    </div>
  );

  if (error || !product) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h2 className="text-2xl font-bold text-gray-800">Product Not Found</h2>
      <button onClick={() => navigate('/products')} className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg transition-colors hover:bg-emerald-700">Back to Shop</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center text-gray-600 hover:text-emerald-600 transition-colors font-medium group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back to Products
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">

            <div className="bg-gray-100/50 flex items-center justify-center p-8 min-h-[400px]">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="max-h-[500px] w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="text-center">
                  <span className="text-6xl">📦</span>
                  <p className="mt-2 text-gray-400">No image available</p>
                </div>
              )}
            </div>

            <div className="p-8 lg:p-12 flex flex-col">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
                  {product.category}
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
                  {product.name}
                </h1>
              </div>

              <div className="flex items-baseline space-x-3 mb-6">
                <span className="text-3xl font-bold text-emerald-600">
                  ${product.hasDeal ? product.finalPrice.toFixed(2) : product.price?.toFixed(2)}
                </span>
                {product.hasDeal && (
                  <>
                    <span className="text-xl text-gray-400 line-through">${product.originalPrice.toFixed(2)}</span>
                    <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-bold">
                      SAVE {product.dealId?.dealType === 'PERCENT' ? `${product.dealId.discountValue}%` : `$${product.discountAmount}`}
                    </span>
                  </>
                )}
              </div>

              <div className="mb-8">
                {product.inStock ? (
                  <span className="flex items-center text-sm text-green-600 bg-green-50 w-fit px-3 py-1 rounded-full border border-green-100 font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    In Stock ({product.quantity || product.stockQuantity} available)
                  </span>
                ) : (
                  <span className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">Out of Stock</span>
                )}
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Description</h3>
                <p className="text-gray-600 leading-relaxed">{product.description || 'No description available.'}</p>
              </div>

              {product.inStock && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
                    <div className="w-full sm:w-auto">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        {isVegetable ? 'Select Weight' : 'Quantity'}
                      </label>
                      <div className="flex items-center border-2 border-gray-200 rounded-xl w-fit bg-white">
                        <button
                          onClick={() => isVegetable ? handleWeightChange(-1) : handleQuantityChange(-1)}
                          className="px-4 py-2 hover:bg-gray-50 text-gray-600 text-xl font-bold transition-colors"
                        >-</button>
                        <span className="px-6 py-2 font-bold text-gray-800 border-x-2 border-gray-200 min-w-[80px] text-center">
                          {isVegetable ? `${selectedWeight} lb` : quantity}
                        </span>
                        <button
                          onClick={() => isVegetable ? handleWeightChange(1) : handleQuantityChange(1)}
                          className="px-4 py-2 hover:bg-gray-50 text-gray-600 text-xl font-bold transition-colors"
                        >+</button>
                      </div>
                    </div>

                    <button
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                      className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-emerald-100"
                    >
                      <ShoppingCart size={20} />
                      {addingToCart ? 'Adding...' : 'Add to Cart'}
                    </button>
                  </div>

                  {isSubscribable && (
                    <div className={`mt-8 border-2 rounded-2xl p-6 transition-all duration-300 ${isSubscribe ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-lg ${isSubscribe ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-600 shadow-sm'}`}>
                            <Repeat size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">Subscribe & Save</h4>
                            <p className="text-sm text-gray-500">Fresh items, zero effort.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={isSubscribe} disabled={isAlreadySubscribed} onChange={() => setIsSubscribe(!isSubscribe)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>

                      {isSubscribe && (
                        <div className="space-y-4 pt-4 border-t border-emerald-100 overflow-hidden">
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Delivery Frequency</label>
                            <div className="grid grid-cols-2 gap-2">
                              {['DAILY', 'WEEKLY'].map(freq => (
                                <button
                                  key={freq}
                                  onClick={() => setFrequency(freq)}
                                  className={`py-2 rounded-lg text-sm font-bold transition-all ${frequency === freq ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                                >
                                  {freq}
                                </button>
                              ))}
                            </div>
                          </div>

                          {frequency === "WEEKLY" && (
                            <div className="flex flex-wrap gap-2">
                              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                                <button
                                  key={day}
                                  onClick={() => toggleDay(day)}
                                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${days.includes(day) ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-white text-gray-500 border border-gray-100'}`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Start Date</label>
                              <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={handleSubscribe}
                                disabled={isAlreadySubscribed}
                                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-bold disabled:bg-gray-400"
                              >
                                {isAlreadySubscribed ? "Already Subscribed" : "Subscribe Now"}
                              </button>

                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {product.nutritionInfo && (
                <div className="mt-10 pt-10 border-t border-gray-100">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                    <Info size={20} className="text-emerald-500" /> Nutrition Facts
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Calories', val: product.nutritionInfo.calories },
                      { label: 'Protein', val: product.nutritionInfo.protein, unit: 'g' },
                      { label: 'Carbs', val: product.nutritionInfo.carbs, unit: 'g' },
                      { label: 'Fat', val: product.nutritionInfo.fat, unit: 'g' }
                    ].map(item => item.val && (
                      <div key={item.label} className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-tighter">{item.label}</p>
                        <p className="text-lg font-extrabold text-gray-800">{item.val}{item.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProductDetail;