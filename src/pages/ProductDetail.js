import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, ShoppingCart, Info, Heart, ZoomIn, Star } from 'lucide-react';
import { saveRecentlyViewedProduct } from './home/components/RecentlyViewedProducts';
import StarRating from '../components/StarRating';
const SITE_COLOR = '#3090cf';
const SITE_COLOR_HOVER = '#2680b8';
const STAR_GOLD = '#f5c542';
const weightOptions = [1, 2, 3, 5];

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedWeights, setRelatedWeights] = useState({});
  const [selectedVariants, setSelectedVariants] = useState({}); // { [variantName]: optionValue }
  const [productTab, setProductTab] = useState('description'); // description | additional | reviews
  const [localReviews, setLocalReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 0, author: '', comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const galleryScrollRef = React.useRef(null);
  const imageWrapRef = React.useRef(null);
  const [lens, setLens] = useState({ show: false, x: 0, y: 0, width: 400, height: 400 });
  const LENS_SIZE = 140;
  const LENS_ZOOM = 2.5;

  const handleImageMouseMove = (e) => {
    const el = imageWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLens((prev) => ({
      ...prev,
      x,
      y,
      show: true,
      width: rect.width,
      height: rect.height,
    }));
  };
  const handleImageMouseEnter = (e) => {
    const el = imageWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setLens({
      show: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    });
  };
  const handleImageMouseLeave = () => setLens((prev) => ({ ...prev, show: false }));

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

  const isVegetableProduct = (p) => p?.category?.toLowerCase().includes('vegetable') || p?.category === 'Fresh Vegetables' || p?.category === 'Vegetables';

  const handleRelatedAddToCart = (e, p) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login first to add items to cart');
      setTimeout(() => navigate('/login'), 500);
      return;
    }
    const pid = p._id || p.id;
    const weight = relatedWeights[pid] || 1;
    const itemToAdd = isVegetableProduct(p) ? { ...p, selectedWeight: weight, displayName: `${p.name} (${weight} lb)` } : p;
    try {
      const result = addToCart(itemToAdd, 1);
      if (result?.success !== false) toast.success('Added to cart');
      else toast.error(result?.message || 'Failed to add');
    } catch {
      toast.error('Failed to add to cart');
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

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (reviewForm.rating < 1) {
      toast.error('Please select a star rating');
      return;
    }
    if (!(reviewForm.comment || '').trim()) {
      toast.error('Please write a review');
      return;
    }
    setSubmittingReview(true);
    const newReview = {
      rating: reviewForm.rating,
      author: (reviewForm.author || '').trim() || 'Customer',
      comment: (reviewForm.comment || '').trim(),
      date: new Date().toISOString(),
    };
    try {
      const token = localStorage.getItem('token');
      if (token && product?._id) {
        try {
          await api.post('/user/products/review', { productId: product._id, ...newReview }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (apiErr) {
          // API may not have this endpoint; show review locally
        }
      }
      setLocalReviews((prev) => [newReview, ...prev]);
      setReviewForm({ rating: 0, author: '', comment: '' });
      toast.success('Thank you for your review!');
    } catch (err) {
      toast.error(err?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const allReviews = [...(product?.reviews || []), ...localReviews];
  const reviewCount = allReviews.length;

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

  const galleryImages = product
    ? (Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : product.image
          ? [product.image]
          : [])
    : [];
  const mainImageUrl = galleryImages[selectedImageIndex] || product?.image;

  // Initialize selected variants when product has variants
  useEffect(() => {
    if (!product) return;
    const variants = product.variants || product.variations || product.options;
    if (Array.isArray(variants) && variants.length > 0) {
      const initial = {};
      variants.forEach((v) => {
        const name = v.name || v.attribute || v.label;
        const opts = v.options || v.values || v.choices;
        if (name && Array.isArray(opts) && opts.length > 0) {
          initial[name] = opts[0];
        }
      });
      setSelectedVariants(initial);
    } else {
      setSelectedVariants({});
    }
  }, [product?._id]);

  useEffect(() => {
    if (!product?.category || !product?._id) return;
    const fetchRelated = async () => {
      setRelatedLoading(true);
      try {
        const res = await api.get('/user/products', {
          params: { category: product.category, limit: 6 },
        });
        const list = res?.data || [];
        const filtered = list.filter((p) => (p._id || p.id) !== product._id).slice(0, 4);
        setRelatedProducts(filtered);
      } catch {
        setRelatedProducts([]);
      } finally {
        setRelatedLoading(false);
      }
    };
    fetchRelated();
  }, [product?._id, product?.category]);

  // Save to recently viewed when product is loaded
  useEffect(() => {
    if (product?._id || product?.id) saveRecentlyViewedProduct(product);
  }, [product?._id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-[#f8fafc]">
      <div className="w-12 h-12 border-4 border-[#3090cf] border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-600 font-medium text-lg">Loading product...</p>
    </div>
  );

  if (error || !product) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-[#f8fafc]">
      <h2 className="text-2xl font-bold text-slate-800">Product Not Found</h2>
      <button onClick={() => navigate('/products')} className="mt-4 px-6 py-2.5 rounded-xl text-white font-semibold transition-colors hover:opacity-90" style={{ backgroundColor: SITE_COLOR }}>Back to Shop</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16 w-full min-w-0 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-1 text-slate-600 hover:text-[#3090cf] transition-colors font-semibold text-sm group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Products
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200/80 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            <div className="p-6 lg:p-8">
              <div
                ref={imageWrapRef}
                className="relative bg-slate-50/80 rounded-2xl flex items-center justify-center min-h-[340px] lg:min-h-[400px] p-6 overflow-hidden cursor-crosshair"
                onMouseMove={handleImageMouseMove}
                onMouseEnter={handleImageMouseEnter}
                onMouseLeave={handleImageMouseLeave}
              >
                {mainImageUrl ? (
                  <>
                    <img
                      src={mainImageUrl}
                      alt={product.name}
                      className="max-h-[360px] lg:max-h-[420px] w-auto object-contain drop-shadow-lg pointer-events-none select-none"
                      draggable={false}
                    />
                    {lens.show && (
                      <div
                        className="absolute pointer-events-none border-2 border-white shadow-xl rounded-full overflow-hidden z-10"
                        style={{
                          width: LENS_SIZE,
                          height: LENS_SIZE,
                          left: Math.max(0, Math.min(lens.x - LENS_SIZE / 2, lens.width - LENS_SIZE)),
                          top: Math.max(0, Math.min(lens.y - LENS_SIZE / 2, lens.height - LENS_SIZE)),
                          backgroundImage: `url(${mainImageUrl})`,
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: `${lens.width * LENS_ZOOM}px ${lens.height * LENS_ZOOM}px`,
                          backgroundPosition: `${(LENS_SIZE / 2 - lens.x * LENS_ZOOM)}px ${(LENS_SIZE / 2 - lens.y * LENS_ZOOM)}px`,
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => window.open(mainImageUrl, '_blank')}
                      className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg hover:opacity-90 transition-opacity z-10"
                      style={{ backgroundColor: SITE_COLOR }}
                      aria-label="Zoom / view full size"
                    >
                      <ZoomIn size={20} />
                    </button>
                  </>
                ) : (
                  <div className="text-center text-slate-400">
                    <span className="text-6xl">📦</span>
                    <p className="mt-2 text-sm font-medium">No image available</p>
                  </div>
                )}
              </div>
              {galleryImages.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  {galleryImages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => galleryScrollRef.current?.scrollBy({ left: -80, behavior: 'smooth' })}
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={22} strokeWidth={2.5} />
                    </button>
                  )}
                  <div
                    ref={galleryScrollRef}
                    className="flex gap-2 overflow-x-auto scroll-smooth pb-1 flex-1 min-w-0 no-scrollbar"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {galleryImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 bg-white transition-all ${
                          selectedImageIndex === idx ? 'ring-2 ring-[#3090cf]/30' : 'border-slate-200 hover:border-slate-300'
                        }`}
                        style={{ borderColor: selectedImageIndex === idx ? SITE_COLOR : undefined }}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  {galleryImages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => galleryScrollRef.current?.scrollBy({ left: 80, behavior: 'smooth' })}
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      aria-label="Next image"
                    >
                      <ChevronRight size={22} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 lg:p-10 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-100">
              {product.hasDeal && (
                <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold text-white mb-3 bg-rose-500">Sale!</span>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-[1.75rem] font-extrabold text-slate-900 leading-tight tracking-tight mb-2">
                {product.name}
              </h1>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const avgRating = reviewCount
                      ? Math.round(allReviews.reduce((a, r) => a + (r.rating || 0), 0) / reviewCount)
                      : 0;
                    const filled = star <= avgRating;
                    return (
                      <Star
                        key={star}
                        size={18}
                        className={filled ? '' : 'text-slate-200'}
                        style={filled ? { color: STAR_GOLD } : {}}
                        fill="currentColor"
                        strokeWidth={1}
                      />
                    );
                  })}
                </div>
                <span className="text-sm" style={{ color: SITE_COLOR }}>
                  ({reviewCount} customer review{reviewCount !== 1 ? 's' : ''})
                </span>
              </div>
              {/* Variants at top */}
              {(product.variants || product.variations || product.options)?.length > 0 && (
                <div className="mb-4 space-y-3">
                  {(product.variants || product.variations || product.options).map((v) => {
                    const name = v.name || v.attribute || v.label;
                    const opts = v.options || v.values || v.choices || [];
                    if (!name || !Array.isArray(opts) || opts.length === 0) return null;
                    const current = selectedVariants[name] ?? opts[0];
                    return (
                      <div key={name}>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{name}</span>
                        <div className="flex flex-wrap gap-2">
                          {opts.map((opt) => {
                            const val = typeof opt === 'object' ? (opt.value ?? opt.label ?? opt.name) : opt;
                            const isSelected = current === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setSelectedVariants((prev) => ({ ...prev, [name]: val }))}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                                  isSelected
                                    ? 'text-white border-transparent'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                                style={isSelected ? { backgroundColor: SITE_COLOR } : {}}
                              >
                                {typeof opt === 'object' ? (opt.label ?? opt.name ?? opt.value) : opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-baseline gap-3 mb-4">
                <span className="text-2xl sm:text-3xl font-bold" style={{ color: SITE_COLOR }}>
                  ${product.hasDeal ? product.finalPrice?.toFixed(2) : product.price?.toFixed(2)}
                </span>
                {product.hasDeal && product.originalPrice != null && (
                  <span className="text-lg text-slate-400 line-through">${product.originalPrice.toFixed(2)}</span>
                )}
              </div>
              <div className="mb-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Short description</h3>
                <p className="text-slate-600 leading-relaxed text-[15px]">{product.description || 'No description available.'}</p>
              </div>
              <div className="mb-5">
                {product.inStock !== false ? (
                  <span className="text-sm text-slate-600">{product.quantity ?? product.stockQuantity ?? 0} in stock</span>
                ) : (
                  <span className="text-sm font-semibold text-rose-600">Out of Stock</span>
                )}
              </div>

              {product.inStock !== false && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center border-2 border-slate-200 rounded-xl bg-white overflow-hidden h-11 min-h-[44px] touch-manipulation">
                      <button
                        onClick={() => isVegetable ? handleWeightChange(-1) : handleQuantityChange(-1)}
                        className="h-full px-4 hover:bg-slate-50 text-slate-600 text-lg font-bold transition-colors flex items-center justify-center"
                        aria-label="Decrease"
                      >−</button>
                      <span className="h-full px-4 flex items-center justify-center font-bold text-slate-800 border-x border-slate-200 min-w-[72px] text-sm bg-white">
                        {isVegetable ? `${selectedWeight} lb` : quantity}
                      </span>
                      <button
                        onClick={() => isVegetable ? handleWeightChange(1) : handleQuantityChange(1)}
                        className="h-full px-4 hover:bg-slate-50 text-slate-600 text-lg font-bold transition-colors flex items-center justify-center"
                        aria-label="Increase"
                      >+</button>
                    </div>
                    <button
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                      className="h-11 min-h-[44px] px-5 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed min-w-[140px] max-w-[200px] touch-manipulation"
                      style={{ backgroundColor: addingToCart ? '#94a3b8' : SITE_COLOR }}
                      onMouseOver={(e) => { if (!addingToCart) e.currentTarget.style.backgroundColor = SITE_COLOR_HOVER; }}
                      onMouseOut={(e) => { if (!addingToCart) e.currentTarget.style.backgroundColor = SITE_COLOR; }}
                    >
                      <ShoppingCart size={18} />
                      {addingToCart ? 'Adding...' : 'Add to cart'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product)}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2 min-h-[44px] touch-manipulation"
                    aria-label={isInWishlist(product._id || product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart size={18} className={isInWishlist(product._id || product.id) ? '' : ''} style={{ color: isInWishlist(product._id || product.id) ? SITE_COLOR : undefined }} fill={isInWishlist(product._id || product.id) ? 'currentColor' : 'none'} strokeWidth={2} />
                    Add to wishlist
                  </button>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100 space-y-2 text-sm text-slate-600">
                {product.type != null && <p><span className="font-semibold text-slate-700">Type:</span> {product.type}</p>}
                {product.mfg != null && <p><span className="font-semibold text-slate-700">MFG:</span> {typeof product.mfg === 'string' ? product.mfg : product.mfg}</p>}
                {product.life != null && <p><span className="font-semibold text-slate-700">LIFE:</span> {product.life}</p>}
                <p>
                  <span className="font-semibold text-slate-700">Categories:</span>{' '}
                  <Link to={`/products?category=${encodeURIComponent(product.category || '')}`} className="hover:underline" style={{ color: SITE_COLOR }}>
                    {product.category || 'Uncategorized'}
                  </Link>
                </p>
              </div>

              {product.nutritionInfo && (
                <div className="mt-10 pt-10 border-t border-slate-100">
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 mb-4">
                    <Info size={20} style={{ color: SITE_COLOR }} /> Nutrition Facts
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Calories', val: product.nutritionInfo.calories },
                      { label: 'Protein', val: product.nutritionInfo.protein, unit: 'g' },
                      { label: 'Carbs', val: product.nutritionInfo.carbs, unit: 'g' },
                      { label: 'Fat', val: product.nutritionInfo.fat, unit: 'g' }
                    ].map(item => item.val && (
                      <div key={item.label} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">{item.label}</p>
                        <p className="text-lg font-extrabold text-slate-800">{item.val}{item.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs: Description, Additional info, Reviews (left) | Product Tags + Products sidebar (right) */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex flex-wrap border-b border-slate-200">
              {[
                { id: 'description', label: 'Description' },
                { id: 'additional', label: 'Additional info' },
                { id: 'reviews', label: `Reviews (${reviewCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProductTab(tab.id)}
                  className="px-5 py-4 text-sm font-bold transition-colors rounded-t-lg"
                  style={{
                    color: productTab === tab.id ? SITE_COLOR : '#64748b',
                    backgroundColor: productTab === tab.id ? `${SITE_COLOR}12` : 'transparent',
                    borderBottom: productTab === tab.id ? `2px solid ${SITE_COLOR}` : '2px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-6">
              {productTab === 'description' && (
                <div className="text-slate-600 leading-relaxed text-[15px] whitespace-pre-line">
                  {product.longDescription || product.description || 'No description available.'}
                </div>
              )}
              {productTab === 'additional' && (
                <div className="space-y-3 text-sm">
                  {product.type != null && <p><span className="font-semibold text-slate-700">Type:</span> {product.type}</p>}
                  {product.mfg != null && <p><span className="font-semibold text-slate-700">MFG:</span> {product.mfg}</p>}
                  {product.life != null && <p><span className="font-semibold text-slate-700">LIFE:</span> {product.life}</p>}
                  <p>
                    <span className="font-semibold text-slate-700">Categories:</span>{' '}
                    <Link to={`/products?category=${encodeURIComponent(product.category || '')}`} className="hover:underline" style={{ color: SITE_COLOR }}>{product.category || 'Uncategorized'}</Link>
                  </p>
                  {product.unit && <p><span className="font-semibold text-slate-700">Unit:</span> {product.unit}</p>}
                  {product.specifications && (Array.isArray(product.specifications) ? product.specifications.length > 0 : Object.keys(product.specifications).length > 0) && (
                    <div className="pt-2">
                      {Array.isArray(product.specifications)
                        ? product.specifications.map((item, i) => (
                            <p key={i}>{typeof item === 'string' ? item : `${item.label || item.name}: ${item.value}`}</p>
                          ))
                        : Object.entries(product.specifications).map(([k, v]) => (
                            <p key={k}><span className="font-semibold text-slate-700">{k}:</span> {String(v)}</p>
                          ))}
                    </div>
                  )}
                </div>
              )}
              {productTab === 'reviews' && (
                <div className="space-y-6">
                  <form onSubmit={handleSubmitReview} className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900">Add a review</h4>
                    <div>
                      <span className="block text-xs font-semibold text-slate-600 mb-2">Your rating</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewForm((f) => ({ ...f, rating: star }))}
                            className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
                            style={{ color: star <= reviewForm.rating ? STAR_GOLD : '#cbd5e1' }}
                          >
                            <Star size={24} fill="currentColor" strokeWidth={1} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Your name (optional)</label>
                      <input
                        type="text"
                        value={reviewForm.author}
                        onChange={(e) => setReviewForm((f) => ({ ...f, author: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#3090cf]/30 focus:border-[#3090cf] outline-none text-sm"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Your review *</label>
                      <textarea
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#3090cf]/30 focus:border-[#3090cf] outline-none text-sm resize-none"
                        rows={4}
                        placeholder="Write your review..."
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: SITE_COLOR }}
                    >
                      {submittingReview ? 'Submitting...' : 'Submit review'}
                    </button>
                  </form>
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-900">Customer reviews</h4>
                    {allReviews.length === 0 ? (
                      <p className="text-slate-500 text-sm">No reviews yet. Be the first to review this product.</p>
                    ) : (
                      allReviews.map((r, i) => (
                        <div key={i} className="border-b border-slate-100 pb-4 last:border-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={14} fill="currentColor" className={s <= (r.rating || 0) ? '' : 'text-slate-200'} style={s <= (r.rating || 0) ? { color: STAR_GOLD } : {}} />
                              ))}
                            </div>
                            <span className="text-sm font-semibold text-slate-700">{r.author || r.userName || 'Customer'}</span>
                            {r.date && <span className="text-xs text-slate-400">{new Date(r.date).toLocaleDateString()}</span>}
                          </div>
                          <p className="text-sm text-slate-600">{r.comment || r.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Product Tags + Products sidebar */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 lg:sticky lg:top-4">
              <h3 className="text-base font-bold text-slate-900 mb-2 pb-2 border-b-2" style={{ borderColor: SITE_COLOR }}>Product Tags</h3>
              <div className="flex flex-wrap gap-2 mt-3">
                {(Array.isArray(product.tags) && product.tags.length > 0
                  ? product.tags
                  : [product.category, product.unit, 'Organic'].filter(Boolean)
                ).map((tag, i) => (
                  <Link
                    key={i}
                    to={`/products?search=${encodeURIComponent(typeof tag === 'string' ? tag : tag.label || tag)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
                    style={{ borderColor: `${SITE_COLOR}40`, color: SITE_COLOR, backgroundColor: `${SITE_COLOR}08` }}
                  >
                    <span className="text-slate-400 text-xs">×</span> {typeof tag === 'string' ? tag : (tag.label || tag.name)}
                  </Link>
                ))}
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-6 mb-2 pb-2 border-b-2" style={{ borderColor: SITE_COLOR }}>Products</h3>
              <div className="mt-3 space-y-4">
                {relatedLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-14 h-14 rounded-xl bg-slate-200 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 bg-slate-200 rounded w-full mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))
                ) : (
                  relatedProducts.slice(0, 5).map((p) => {
                    const pid = p._id || p.id;
                    const price = p.hasDeal ? p.finalPrice : p.price;
                    return (
                      <Link key={pid} to={`/products/${pid}`} className="flex gap-3 group">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:underline">{p.name}</p>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-sm font-bold" style={{ color: SITE_COLOR }}>${price?.toFixed(2)}</span>
                            {p.hasDeal && p.originalPrice != null && (
                              <span className="text-xs text-slate-400 line-through">${p.originalPrice.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-6 tracking-tight">Related Products</h2>
            {relatedLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse">
                    <div className="aspect-square bg-slate-200 rounded-xl mb-4" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-slate-100 rounded w-1/2 mb-4" />
                    <div className="flex gap-2"><div className="h-10 flex-1 bg-slate-100 rounded-xl" /><div className="h-10 w-20 bg-slate-100 rounded-xl" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 justify-items-center max-w-[520px] sm:max-w-none mx-auto">
                {relatedProducts.map((p, index) => {
                  const pid = p._id || p.id;
                  const price = p.hasDeal ? p.finalPrice : p.price;
                  const dealDiscountPct = p.dealId?.dealType === 'PERCENT' && p.dealId?.discountValue != null ? Number(p.dealId.discountValue) : p.hasDeal && p.originalPrice > 0 ? Math.round((1 - p.finalPrice / p.originalPrice) * 100) : 0;
                  const originalPrice = p.originalPrice ?? p.compareAtPrice;
                  const computedPct = (originalPrice != null && originalPrice > 0 && price < originalPrice) ? Math.round((1 - price / originalPrice) * 100) : 0;
                  const discountPct = p.discountPercentage != null ? Number(p.discountPercentage) : (dealDiscountPct || computedPct);
                  const hasDiscount = discountPct > 0;
                  const DISCOUNT_BADGE_PCT = 5;
                  const inStock = p.inStock !== false;
                  const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
                  const isNewlyAdded = (() => {
                    const date = p.createdAt || p.addedAt || p.created_at;
                    if (!date) return false;
                    return new Date(date).getTime() >= Date.now() - FIFTEEN_DAYS_MS;
                  })();
                  const orderCount = Number(p.orderCount ?? p.timesOrdered ?? p.salesCount ?? 0) || 0;
                  const isHot = orderCount > 5;
                  const rightBadge = !inStock ? null : isHot ? 'hot' : isNewlyAdded ? 'new' : 'sale';
                  const reviewCount = p.reviews?.length ?? p.reviewCount ?? 0;
                  const avgRating = reviewCount
                    ? (p.reviews || []).reduce((a, r) => a + (Number(r?.rating) || 0), 0) / (p.reviews?.length || 1)
                    : (p.rating ?? 0);
                  return (
                    <div
                      key={pid}
                      className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-300/80 transition-all duration-300 flex flex-col overflow-hidden w-full"
                    >
                      <span className="product-card__discount-tag absolute top-0 left-0 z-20 text-white text-xs font-bold pl-3 pr-4 py-1.5 min-w-[3rem] text-center rounded-tl-none rounded-bl-none rounded-tr-none rounded-br-xl shadow-sm" style={{ backgroundColor: '#e9aa42', color: '#fff' }}>
                        {DISCOUNT_BADGE_PCT}%
                      </span>
                      {rightBadge && (
                        <div className="absolute top-0 right-0 z-20 pointer-events-none flex flex-col items-end gap-1">
                          <span className="product-card__sale-tag inline-block text-[11px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-tr-xl rounded-br-none rounded-bl-xl rounded-tl-none text-white shadow-sm" style={{ backgroundColor: SITE_COLOR }}>
                            {rightBadge === 'hot' ? 'Hot' : rightBadge === 'new' ? 'New' : 'Sale'}
                          </span>
                        </div>
                      )}
                      <Link to={`/products/${pid}`} className="relative block aspect-square overflow-hidden bg-slate-100">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        {!p.inStock && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                            <span className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-full">Out of stock</span>
                          </div>
                        )}
                      </Link>
                      <div className="p-4 flex flex-col flex-grow">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{p.category}</span>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link to={`/products/${pid}`} className="min-w-0 flex-1">
                            <h3 className="text-slate-800 font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-[#3090cf] transition-colors">{p.name}</h3>
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(p); }}
                            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-[#3090cf] hover:bg-slate-200 hover:border-[#3090cf]/50 transition-all -mt-1"
                            aria-label={isInWishlist(pid) ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            <Heart size={20} className={isInWishlist(pid) ? 'text-[#3090cf]' : ''} fill={isInWishlist(pid) ? 'currentColor' : 'none'} strokeWidth={2} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{p.unit || 'piece'}</p>
                        <StarRating rating={avgRating} count={reviewCount} className="mb-2" />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-xl font-bold text-[#3090cf]">${price?.toFixed(2)}</span>
                            {p.hasDeal && <span className="text-sm text-slate-400 line-through">${p.originalPrice?.toFixed(2)}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleRelatedAddToCart(e, p)}
                            disabled={!p.inStock}
                            className="min-h-[40px] px-4 rounded-lg bg-[#3090cf] hover:bg-[#2680b8] disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors active:scale-[0.98] inline-flex items-center justify-center gap-1.5 touch-manipulation w-full sm:w-auto whitespace-nowrap"
                          >
                            <ShoppingCart size={18} strokeWidth={2.5} />
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default ProductDetail;