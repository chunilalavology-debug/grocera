import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { ArrowLeft, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { AdminBadge, AdminButton, AdminCard, ConfirmModal } from '../../components/admin/ui';

const CATEGORY_OPTIONS = [
  'Daily Essentials',
  'Fruits',
  'Vegetables',
  'Exotics',
  'Pooja Items',
  'God Idols',
  'American Breakfast',
  'American Snacks',
  'American Sauces',
  'Chinese Noodles',
  'Chinese Sauces',
  'Chinese Snacks',
  'Turkish Sweets',
  'Turkish Staples',
  'Turkish Drinks',
];

const emptyForm = () => ({
  name: '',
  price: '',
  comparePrice: '',
  salePrice: '',
  category: 'Daily Essentials',
  description: '',
  image: '',
  inStock: true,
  cost: '',
  quantity: '',
  unit: 'piece',
  sku: '',
  badge: '',
  isDeal: false,
  dealPrice: '',
  isDisable: false,
});

const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20';

const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';

function AdminProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [dragOver, setDragOver] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isNew) {
      setFormData(emptyForm());
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/admin/products/${id}`);
        if (!res?.success || !res.data) {
          toast.error(res?.message || 'Product not found');
          navigate('/admin/products');
          return;
        }
        if (cancelled) return;
        const p = res.data;
        setFormData({
          name: p.name || '',
          price: p.price != null ? String(p.price) : '',
          comparePrice: p.comparePrice != null ? String(p.comparePrice) : '',
          salePrice: p.salePrice != null ? String(p.salePrice) : '',
          category: p.category || 'Daily Essentials',
          description: p.description || '',
          image: p.image || '',
          inStock: Boolean(p.inStock),
          cost: p.cost != null ? String(p.cost) : '',
          quantity: p.quantity != null ? String(p.quantity) : '',
          unit: p.unit || 'piece',
          sku: p.sku != null ? String(p.sku) : '',
          badge: p.badge != null ? String(p.badge) : '',
          isDeal: Boolean(p.isDeal),
          dealPrice: p.dealPrice != null ? String(p.dealPrice) : '',
          isDisable: Boolean(p.isDisable),
        });
      } catch (e) {
        toast.error(e?.message || 'Failed to load product');
        navigate('/admin/products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isNew, navigate]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };
      if (name === 'quantity') {
        const qty = parseInt(value, 10) || 0;
        if (qty === 0) next.inStock = false;
        else if (qty > 0 && !next.inStock) next.inStock = true;
      }
      return next;
    });
  }, []);

  const applyImageFromFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please drop an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, image: String(reader.result || '') }));
      toast.success('Image loaded — save to keep (stored as data URL)');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!formData.name?.trim() || !formData.price || !formData.category) {
        toast.error('Name, price, and category are required');
        return;
      }
      if (Number.isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
        toast.error('Enter a valid price');
        return;
      }

      const quantity = parseInt(formData.quantity, 10) || 0;
      const salePrice = formData.salePrice ? parseFloat(formData.salePrice) : 0;
      const comparePrice = formData.comparePrice ? parseFloat(formData.comparePrice) : 0;
      const dealPrice = formData.dealPrice ? parseFloat(formData.dealPrice) : 0;
      const productData = {
        name: formData.name.trim(),
        category: formData.category,
        description: (formData.description || '').trim() || '—',
        price: parseFloat(formData.price),
        comparePrice: Number.isFinite(comparePrice) ? comparePrice : 0,
        salePrice,
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        quantity,
        inStock: quantity > 0,
        image: formData.image || '',
        unit: (formData.unit || 'piece').trim() || 'piece',
        sku: (formData.sku || '').trim(),
        badge: (formData.badge || '').trim().toLowerCase(),
        isDeal: Boolean(formData.isDeal),
        dealPrice: formData.isDeal && Number.isFinite(dealPrice) ? dealPrice : 0,
        isDisable: Boolean(formData.isDisable),
      };

      setSaving(true);
      try {
        if (isNew) {
          await api.post('/admin/products', productData);
          toast.success('Product created');
        } else {
          await api.put(`/admin/products/${id}`, productData);
          toast.success('Product updated');
        }
        navigate('/admin/products');
      } catch (err) {
        toast.error(err?.message || 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [formData, id, isNew, navigate]
  );

  const runDelete = async () => {
    if (isNew) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success('Product deleted');
      setDeleteOpen(false);
      navigate('/admin/products');
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-design-scope flex min-h-[50vh] flex-col items-center justify-center gap-4 text-slate-500" role="status">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--admin-primary)]" aria-hidden />
        <span className="text-sm font-medium">Loading product…</span>
      </div>
    );
  }

  const qty = parseInt(formData.quantity, 10) || 0;
  const priceNum = parseFloat(formData.price) || 0;

  return (
    <div className="admin-design-scope relative mx-auto max-w-[1600px] space-y-6 pb-28 font-sans text-slate-900">
      <ConfirmModal
        open={deleteOpen}
        title="Delete this product?"
        description="This permanently removes the product from your catalog."
        confirmLabel="Delete"
        loading={deleting}
        onClose={() => !deleting && setDeleteOpen(false)}
        onConfirm={runDelete}
      />

      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-[var(--admin-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Products
          </Link>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {isNew ? 'Add product' : 'Edit product'}
          </h1>
        </div>
        {!isNew ? (
          <AdminButton variant="danger" size="md" type="button" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </AdminButton>
        ) : null}
      </div>

      <form id="product-edit-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-8">
            <AdminCard title="Product details" subtitle="Title, category, and description shown to customers.">
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="p-name">
                    Title
                  </label>
                  <input
                    id="p-name"
                    name="name"
                    className={inputClass}
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. Organic basmati rice"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="p-category">
                      Category
                    </label>
                    <select
                      id="p-category"
                      name="category"
                      className={inputClass}
                      value={formData.category}
                      onChange={handleInputChange}
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="p-unit">
                      Unit
                    </label>
                    <input
                      id="p-unit"
                      name="unit"
                      className={inputClass}
                      value={formData.unit}
                      onChange={handleInputChange}
                      placeholder="piece, kg, pack…"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="p-desc">
                    Description
                  </label>
                  <textarea
                    id="p-desc"
                    name="description"
                    rows={8}
                    className={`${inputClass} min-h-[180px] resize-y py-3 leading-relaxed`}
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Full product description for your storefront…"
                  />
                </div>
              </div>
            </AdminCard>

            <AdminCard title="Media" subtitle="Paste an image URL or drop a file to embed as data (long URLs — prefer hosting then link).">
              <div
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
                  dragOver ? 'border-[#2878b3] bg-sky-50/60' : 'border-slate-200 bg-slate-50/50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) applyImageFromFile(f);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => applyImageFromFile(e.target.files?.[0])}
                />
                <ImagePlus className="mb-3 h-10 w-10 text-slate-400" />
                <p className="text-center text-sm font-medium text-slate-700">Drag and drop an image here</p>
                <p className="mt-1 text-center text-xs text-slate-500">or</p>
                <AdminButton variant="secondary" size="sm" type="button" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                  Upload file
                </AdminButton>
              </div>
              <div className="mt-4">
                <label className={labelClass} htmlFor="p-image">
                  Image URL
                </label>
                <input
                  id="p-image"
                  name="image"
                  className={inputClass}
                  value={formData.image}
                  onChange={handleInputChange}
                  placeholder="https://…"
                />
              </div>
              {formData.image ? (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <img src={formData.image} alt="Preview" className="max-h-56 w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              ) : null}
            </AdminCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:col-span-4">
            <AdminCard title="Status">
              <div className="flex flex-wrap items-center gap-3">
                <AdminBadge variant={formData.inStock && qty > 0 ? 'success' : 'muted'}>
                  {formData.inStock && qty > 0 ? 'Active' : 'Inactive'}
                </AdminBadge>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="inStock"
                    checked={formData.inStock}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-slate-300 text-[#2878b3] focus:ring-[#2878b3]/30"
                  />
                  Track as in stock
                </label>
              </div>
            </AdminCard>

            <AdminCard title="Inventory">
              <div>
                <label className={labelClass} htmlFor="p-qty">
                  Quantity
                </label>
                <input
                  id="p-qty"
                  name="quantity"
                  type="number"
                  min="0"
                  className={inputClass}
                  value={formData.quantity}
                  onChange={handleInputChange}
                />
                <p className="mt-2 text-xs text-slate-500">Quantity 0 marks the product as out of stock.</p>
              </div>
            </AdminCard>

            <AdminCard title="Pricing">
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="p-price">
                    Price (selling price)
                  </label>
                  <input
                    id="p-price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="p-compare">
                    Compare-at price (original / MSRP)
                  </label>
                  <input
                    id="p-compare"
                    name="comparePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={formData.comparePrice}
                    onChange={handleInputChange}
                    placeholder="Leave empty if not on sale"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    When higher than selling price, storefront shows strike-through and discount %.
                  </p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="p-sale">
                    Legacy sale price (optional)
                  </label>
                  <input
                    id="p-sale"
                    name="salePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={formData.salePrice}
                    onChange={handleInputChange}
                    placeholder="Older catalog: promo below list price"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="p-cost">
                    Cost per item
                  </label>
                  <input
                    id="p-cost"
                    name="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={formData.cost}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Preview total (qty × price)</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    ${(qty * priceNum).toFixed(2)}
                  </p>
                </div>
              </div>
            </AdminCard>

            <AdminCard title="SKU, badge & hot deals">
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="p-sku">
                    SKU
                  </label>
                  <input
                    id="p-sku"
                    name="sku"
                    className={inputClass}
                    value={formData.sku}
                    onChange={handleInputChange}
                    placeholder="Optional — used for CSV upsert"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="p-badge">
                    Badge
                  </label>
                  <select
                    id="p-badge"
                    name="badge"
                    className={inputClass}
                    value={formData.badge}
                    onChange={handleInputChange}
                  >
                    <option value="">None</option>
                    <option value="hot">Hot</option>
                    <option value="sale">Sale</option>
                    <option value="new">New</option>
                    <option value="trending">Trending</option>
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="isDeal"
                    checked={formData.isDeal}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-slate-300 text-[#2878b3] focus:ring-[#2878b3]/30"
                  />
                  Hot deal (show on Hot Deals page)
                </label>
                {formData.isDeal ? (
                  <div>
                    <label className={labelClass} htmlFor="p-dealprice">
                      Deal price (optional)
                    </label>
                    <input
                      id="p-dealprice"
                      name="dealPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputClass}
                      value={formData.dealPrice}
                      onChange={handleInputChange}
                      placeholder="Shelf price for this deal"
                    />
                  </div>
                ) : null}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="isDisable"
                    checked={formData.isDisable}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-slate-300 text-[#2878b3] focus:ring-[#2878b3]/30"
                  />
                  Draft — hide from storefront
                </label>
              </div>
            </AdminCard>
          </div>
        </div>
      </form>

      {/* Sticky save bar — offset for desktop sidebar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(15,23,42,0.06)] lg:left-[280px]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <p className="mr-auto hidden text-xs text-slate-500 sm:block">Unsaved changes are lost if you leave without saving.</p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="md" type="button" onClick={() => navigate('/admin/products')}>
              Discard
            </AdminButton>
            <AdminButton
              variant="primary"
              size="md"
              type="submit"
              form="product-edit-form"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : isNew ? (
                'Save product'
              ) : (
                'Save'
              )}
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminProductEdit;
