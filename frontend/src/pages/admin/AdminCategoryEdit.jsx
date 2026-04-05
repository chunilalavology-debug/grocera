import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { ArrowLeft, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { getApiOrigin } from '../../config/apiBase';
import { SUBCATEGORIES_BY_MAIN } from '../../config/categories';
import '../../styles/pages/admin/AdminCategoryEdit.css';

const PARENT_OPTIONS = [
  { value: 'indian', label: 'Indian' },
  { value: 'american', label: 'American' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'turkish', label: 'Turkish' },
];

function normCatKey(s) {
  return String(s == null ? '' : s)
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function clientInferMainFromName(name) {
  const nk = normCatKey(name);
  if (!nk) return '';
  for (const mainId of Object.keys(SUBCATEGORIES_BY_MAIN)) {
    const subs = SUBCATEGORIES_BY_MAIN[mainId] || [];
    for (const sub of subs) {
      if (normCatKey(sub.value) === nk || normCatKey(sub.name) === nk) return mainId;
    }
  }
  return '';
}

function resolveImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/featured-categories/') && typeof window !== 'undefined') {
    return `${window.location.origin}${raw}`;
  }
  const origin = getApiOrigin() || (typeof window !== 'undefined' ? window.location.origin : '');
  if (raw.startsWith('/')) return origin + raw;
  return `${origin}/${raw.replace(/^\//, '')}`;
}

function AdminCategoryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const imageInputRef = useRef(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    name: '',
    status: 'Active',
    image: '',
    main: 'indian',
    sortOrder: 0,
    featuredOnHome: true,
    homeDisplayTitle: '',
  });

  useEffect(() => {
    if (isNew) {
      setForm({
        name: '',
        status: 'Active',
        image: '',
        main: 'indian',
        sortOrder: 0,
        featuredOnHome: true,
        homeDisplayTitle: '',
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/admin/getCategory/${id}`);
        if (!res?.success || !res.data) {
          toast.error(res?.message || 'Category not found');
          navigate('/admin/categories');
          return;
        }
        if (cancelled) return;
        const c = res.data;
        const dbMain = c.main && String(c.main).trim() ? String(c.main).toLowerCase() : '';
        let main = 'indian';
        if (dbMain && PARENT_OPTIONS.some((p) => p.value === dbMain)) {
          main = dbMain;
        } else {
          const inferred = clientInferMainFromName(c.name);
          if (inferred && PARENT_OPTIONS.some((p) => p.value === inferred)) main = inferred;
        }
        const inactive =
          c.isActive === false ||
          c.isActive === 0 ||
          (typeof c.isActive === 'string' &&
            ['false', '0', 'no', ''].includes(String(c.isActive).trim().toLowerCase()));
        setForm({
          name: c.name || '',
          status: inactive ? 'Inactive' : 'Active',
          image: c.image || '',
          main,
          sortOrder: c.sortOrder ?? 0,
          featuredOnHome: c.featuredOnHome !== false,
          homeDisplayTitle: c.homeDisplayTitle != null ? String(c.homeDisplayTitle) : '',
        });
      } catch (e) {
        toast.error(e?.message || 'Failed to load category');
        navigate('/admin/categories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isNew, navigate]);

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (!isNew && id) fd.append('categoryId', String(id));
      const res = await api.post('/admin/category/upload-image', fd);
      if (res && res.success === false) {
        toast.error(res.message || 'Upload failed');
        return;
      }
      const url = res?.data?.imageUrl;
      if (!url || typeof url !== 'string') {
        toast.error('Upload did not return an image URL.');
        return;
      }
      setForm((prev) => ({ ...prev, image: url }));
      toast.success(res?.message || 'Image saved');
    } catch (err) {
      toast.error(err?.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!form.main) {
        toast.error('Select a parent category.');
        return;
      }
      setSaving(true);
      try {
        const payload = {
          name: form.name.trim(),
          image: form.image || '',
          isActive: form.status === 'Active',
          main: form.main,
          sortOrder: Number(form.sortOrder) || 0,
          featuredOnHome: Boolean(form.featuredOnHome),
          homeDisplayTitle: String(form.homeDisplayTitle || '').trim(),
        };
        if (isNew) {
          const res = await api.post('/admin/createCategory', payload);
          if (res?.success === false) {
            toast.error(res?.message || 'Could not create category');
            return;
          }
          toast.success('Category created');
        } else {
          const res = await api.put(`/admin/updateCategory/${id}`, payload);
          if (res?.success === false) {
            toast.error(res?.message || 'Could not update category');
            return;
          }
          toast.success('Category updated');
        }
        navigate('/admin/categories');
      } catch (err) {
        toast.error(err?.message || 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [form, id, isNew, navigate]
  );

  const handleDelete = useCallback(async () => {
    if (isNew) return;
    if (!window.confirm('Delete this category? Products keep their category text until you move them.')) return;
    try {
      const res = await api.delete(`/admin/deleteCategory/${id}`);
      if (res?.success === false) {
        toast.error(res.message || 'Delete failed');
        return;
      }
      toast.success('Category removed');
      navigate('/admin/categories');
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    }
  }, [id, isNew, navigate]);

  if (loading) {
    return (
      <div className="admin-design-scope admin-cat-edit__loading" role="status">
        <Loader2 size={32} className="animate-spin text-[var(--admin-primary)]" aria-hidden />
        <span>Loading…</span>
      </div>
    );
  }

  const imgSrc = form.image ? resolveImageUrl(form.image) : null;

  return (
    <div className="admin-design-scope admin-cat-edit">
      <div className="admin-cat-edit__top">
        <Link to="/admin/categories" className="admin-cat-edit__back">
          <ArrowLeft size={18} aria-hidden />
          Categories
        </Link>
        <h1 className="admin-cat-edit__title">{isNew ? 'Add category' : 'Edit category'}</h1>
      </div>

      <form className="admin-cat-edit__card" onSubmit={handleSubmit}>
        <label className="admin-cat-edit__label" htmlFor="ac-name">
          Category name
        </label>
        <input
          id="ac-name"
          className="admin-cat-edit__input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          placeholder="e.g. Spices & Masalas"
        />

        <label className="admin-cat-edit__label" htmlFor="ac-parent">
          Parent category
        </label>
        <select
          id="ac-parent"
          className="admin-cat-edit__select"
          value={form.main}
          onChange={(e) => setForm((f) => ({ ...f, main: e.target.value }))}
        >
          {PARENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="admin-cat-edit__label" htmlFor="ac-sort">
          Sort order
        </label>
        <input
          id="ac-sort"
          type="number"
          min={0}
          max={99999}
          className="admin-cat-edit__input"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
        />

        <label className="admin-cat-edit__label" htmlFor="ac-home-title">
          Homepage title (optional)
        </label>
        <input
          id="ac-home-title"
          className="admin-cat-edit__input"
          value={form.homeDisplayTitle}
          onChange={(e) => setForm((f) => ({ ...f, homeDisplayTitle: e.target.value }))}
          placeholder="Leave blank to use category name on the home strip"
          maxLength={80}
        />

        <label className="admin-cat-edit__label flex items-center gap-2 cursor-pointer font-normal">
          <input
            type="checkbox"
            checked={form.featuredOnHome}
            onChange={(e) => setForm((f) => ({ ...f, featuredOnHome: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Show on homepage featured categories
        </label>
        <p className="text-xs text-slate-500 -mt-2 mb-2">
          Uncheck to hide this category from the home page strip (it can stay active for the catalog).
        </p>

        <span className="admin-cat-edit__label">Image</span>
        <p className="text-xs text-slate-500 mb-2">JPG, PNG, or WebP (max 5MB).</p>
        <div className="flex flex-wrap gap-4 items-start mb-4">
          <div className="w-24 h-24 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
            {imgSrc ? (
              <img src={imgSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="text-slate-400" size={28} />
            )}
          </div>
          <div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleImageFile}
              disabled={uploadingImage}
              className="hidden"
              id="ac-img"
            />
            <label htmlFor="ac-img" className="admin-cat-edit__btn cursor-pointer inline-flex">
              <Upload size={16} className="mr-1" />
              {uploadingImage ? 'Uploading…' : 'Choose image'}
            </label>
          </div>
        </div>

        <span className="admin-cat-edit__label">Status</span>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {['Active', 'Inactive'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setForm((f) => ({ ...f, status }))}
              className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                form.status === status
                  ? 'border-[#3090cf] bg-[#f0f9ff] text-[#3090cf]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="admin-cat-edit__actions">
          {!isNew ? (
            <button type="button" className="admin-cat-edit__btn admin-cat-edit__btn--danger" onClick={handleDelete}>
              Delete
            </button>
          ) : (
            <span />
          )}
          <Link to="/admin/categories" className="admin-cat-edit__btn">
            Cancel
          </Link>
          <button type="submit" className="admin-cat-edit__btn admin-cat-edit__btn--primary" disabled={saving}>
            {saving ? <Loader2 className="animate-spin inline mr-1" size={16} /> : null}
            {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AdminCategoryEdit;
