import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Tag,
  Loader2,
  ImageIcon,
  Link2,
  Upload,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import { getApiOrigin } from '../../config/apiBase';
import { SUBCATEGORIES_BY_MAIN } from '../../config/categories';
import '../../styles/pages/admin/AdminCategories.css';

/** Parent region — must match backend categoryMainValues */
const PARENT_OPTIONS = [
  { value: 'indian', label: 'Indian' },
  { value: 'american', label: 'American' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'turkish', label: 'Turkish' },
];

/** List filter tabs — must match backend allowedMain */
const MAIN_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'indian', label: 'Indian' },
  { id: 'american', label: 'American' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'turkish', label: 'Turkish' },
];

function parentLabel(main) {
  if (!main) return null;
  const o = PARENT_OPTIONS.find((p) => p.value === main);
  return o ? o.label : main;
}

/** Mirrors backend norm + storefront sub list — parent column when API omits inferredMain. */
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

const PLACEHOLDER_THUMB =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88"%3E%3Crect fill="%23f1f5f9" width="88" height="88" rx="10"/%3E%3Ctext fill="%2394a3b8" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="11"%3E—%3C/text%3E%3C/svg%3E';

function resolveImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  /** CRA /public assets (featured category JPGs) live on the storefront origin, not the API host */
  if (raw.startsWith('/featured-categories/') && typeof window !== 'undefined') {
    return `${window.location.origin}${raw}`;
  }
  const origin = getApiOrigin() || (typeof window !== 'undefined' ? window.location.origin : '');
  if (raw.startsWith('/')) return origin + raw;
  return `${origin}/${raw.replace(/^\//, '')}`;
}

function resolveProductThumbUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/featured-categories/') && typeof window !== 'undefined') {
    return `${window.location.origin}${raw}`;
  }
  const origin = getApiOrigin() || (typeof window !== 'undefined' ? window.location.origin : '');
  if (raw.startsWith('/')) return origin + raw;
  return `${origin}/${raw.replace(/^\//, '')}`;
}

/** Normalize admin list API (handles shape quirks / proxies). */
function normalizeCategoriesResponse(res) {
  const p = res && typeof res === 'object' ? res : {};
  let rows = [];
  if (Array.isArray(p.data)) rows = p.data;
  else if (Array.isArray(p.categories)) rows = p.categories;
  else if (p.data && typeof p.data === 'object' && Array.isArray(p.data.data)) rows = p.data.data;
  else if (p.data && typeof p.data === 'object' && Array.isArray(p.data.categories)) rows = p.data.categories;

  let pg = p.pagination && typeof p.pagination === 'object' ? p.pagination : null;
  if (!pg && p.data && typeof p.data === 'object' && p.data.pagination && typeof p.data.pagination === 'object') {
    pg = p.data.pagination;
  }
  if (!pg) pg = {};
  return {
    rows,
    pagination: {
      total: Number(pg.total) || 0,
      page: Number(pg.page) || 1,
      limit: Number(pg.limit) || 20,
      totalPages: Math.max(1, Number(pg.totalPages) || 1),
    },
  };
}

function CategoryThumbButton({ image, ariaLabel, onClick }) {
  const url = image ? resolveImageUrl(image) : null;
  const src = url || PLACEHOLDER_THUMB;
  return (
    <button type="button" className="admin-categories__thumb" onClick={onClick} title="Edit category" aria-label={ariaLabel}>
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = PLACEHOLDER_THUMB;
        }}
      />
    </button>
  );
}

function ProductRowThumb({ product }) {
  const [bad, setBad] = useState(false);
  const raw =
    product?.image || (Array.isArray(product?.images) && product.images[0]) || product?.imageUrl || '';
  const url = raw ? resolveProductThumbUrl(String(raw)) : null;
  return (
    <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
      {url && !bad ? (
        <img src={url} alt="" className="w-full h-full object-cover" onError={() => setBad(true)} />
      ) : (
        <Package size={18} strokeWidth={2} className="text-slate-400" />
      )}
    </div>
  );
}

const CategoryDashboard = () => {
  const imageInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState({
    id: null,
    name: '',
    status: 'Active',
    image: '',
    main: 'indian',
    sortOrder: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mainFilter, setMainFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: pageSize,
    totalPages: 1,
  });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [pmTarget, setPmTarget] = useState(null);
  const [pmInCategory, setPmInCategory] = useState([]);
  const [pmInLoading, setPmInLoading] = useState(false);
  const [pmMoveIds, setPmMoveIds] = useState(new Set());
  const [moveToCategoryName, setMoveToCategoryName] = useState('');
  const [pmAddSearch, setPmAddSearch] = useState('');
  const [pmAddRows, setPmAddRows] = useState([]);
  const [pmAddLoading, setPmAddLoading] = useState(false);
  const [pmAddSelected, setPmAddSelected] = useState(new Set());
  const [pmBusy, setPmBusy] = useState(false);
  /** Row id while PATCH /category/:id/isActive is in flight */
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchCategories = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const params = { search: debouncedSearch, page, limit: pageSize };
      if (mainFilter && mainFilter !== 'all') params.main = mainFilter;
      const res = await api.get('/admin/getCategories', { params });
      const { rows, pagination: pag } = normalizeCategoriesResponse(res);
      setPagination(pag);
      const formatted = rows.map((cat) => {
        const dbMain = cat.main && String(cat.main).trim() ? String(cat.main).toLowerCase() : '';
        const inferred = cat.inferredMain || clientInferMainFromName(cat.name);
        const effective = cat.effectiveMain || inferred || dbMain || '';
        const savedParent = dbMain && PARENT_OPTIONS.some((o) => o.value === dbMain);
        const apiCount = Number(cat.productCount) || 0;
        const thumb = String(cat.displayThumbnail || cat.image || '').trim() || '';
        return {
          id: cat._id,
          name: cat.name,
          count: apiCount,
          countInStock: Number(cat.productCountInStock) || 0,
          countAll: Number(cat.productCountAll) || 0,
          countFromCatalog: apiCount,
          /** Match storefront: missing isActive = active; only explicit false/0/"false" = Inactive. */
          status:
            cat.isActive === false ||
            cat.isActive === 0 ||
            (typeof cat.isActive === 'string' &&
              ['false', '0', 'no', ''].includes(String(cat.isActive).trim().toLowerCase()))
              ? 'Inactive'
              : 'Active',
          image: cat.image || '',
          displayThumbnail: thumb,
          main: cat.main || '',
          effectiveMain: effective,
          mainIsInferred: Boolean(cat.mainIsInferred) || (!savedParent && Boolean(inferred)),
          sortOrder: cat.sortOrder ?? 0,
        };
      });
      setCategories(formatted);
    } catch (err) {
      const msg = err?.message || 'Failed to fetch categories';
      setListError(msg);
      toast.error(msg);
      setCategories([]);
      setPagination((p) => ({ ...p, total: 0, totalPages: 1 }));
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, mainFilter, page, pageSize]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const otherCategoryNames = useMemo(() => {
    if (!pmTarget) return [];
    return categories.filter((c) => c.id !== pmTarget.id).map((c) => c.name);
  }, [categories, pmTarget]);

  const openEditModal = (row, editMode) => {
    let main = 'indian';
    if (editMode && row) {
      const m = row.main;
      if (m && PARENT_OPTIONS.some((p) => p.value === m)) {
        main = m;
      } else if (row.effectiveMain && PARENT_OPTIONS.some((p) => p.value === row.effectiveMain)) {
        main = row.effectiveMain;
      } else {
        const inferred = clientInferMainFromName(row.name);
        main = inferred || '';
      }
    }
    setCurrentCategory({
      id: row?.id || null,
      name: row?.name || '',
      status: row?.status || 'Active',
      image: row?.image || '',
      main,
      sortOrder: row?.sortOrder ?? 0,
    });
    setIsEditing(editMode);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Products keep their category text until you move them.')) return;
    try {
      const res = await api.delete(`/admin/deleteCategory/${id}`);
      if (res?.success) {
        toast.success('Category removed');
        fetchCategories();
      }
    } catch (error) {
      toast.error(error?.message || 'Delete failed');
    }
  };

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (currentCategory.id) fd.append('categoryId', String(currentCategory.id));
      const res = await api.post('/admin/category/upload-image', fd);
      if (res && res.success === false) {
        toast.error(res.message || 'Upload failed');
        return;
      }
      const url = res?.data?.imageUrl;
      if (!url || typeof url !== 'string') {
        toast.error('Upload did not return an image URL. Use JPG, PNG, or WebP under 5MB.');
        return;
      }
      setCurrentCategory((c) => ({ ...c, image: url }));
      toast.success(res?.message || 'Image saved');
      if (currentCategory.id) fetchCategories();
    } catch (err) {
      toast.error(err?.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleToggleCategoryActive = async (cat) => {
    if (!cat?.id) return;
    const nextActive = cat.status !== 'Active';
    setStatusUpdatingId(cat.id);
    try {
      await api.patch(`/admin/category/${cat.id}/isActive`, { isActive: nextActive });
      toast.success(nextActive ? 'Saved as active — visible on the shop' : 'Saved as inactive — hidden on the shop');
      await fetchCategories();
    } catch (err) {
      toast.error(err?.message || 'Could not update status in database');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentCategory.main) {
      toast.error('Select a parent category (Indian, American, Chinese, or Turkish).');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        name: currentCategory.name.trim(),
        image: currentCategory.image || '',
        /** Persist boolean so MongoDB matches the admin “Active / Inactive” choice. */
        isActive: currentCategory.status === 'Active',
        main: currentCategory.main,
        sortOrder: Number(currentCategory.sortOrder) || 0,
      };

      if (isEditing && currentCategory.id) {
        await api.put(`/admin/updateCategory/${currentCategory.id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/admin/createCategory', payload);
        toast.success('Category created');
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const loadProductsInCategory = useCallback(async (row) => {
    if (!row?.name) return;
    setPmInLoading(true);
    try {
      const res = await api.get('/admin/products', {
        params: { category: row.name, limit: 500, page: 1 },
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setPmInCategory(list);
      setPmMoveIds(new Set());
    } catch {
      toast.error('Could not load products in this category');
      setPmInCategory([]);
    } finally {
      setPmInLoading(false);
    }
  }, []);

  const openProductsModal = (row) => {
    setPmTarget(row);
    setMoveToCategoryName('');
    setPmAddSearch('');
    setPmAddRows([]);
    setPmAddSelected(new Set());
    setProductsModalOpen(true);
    loadProductsInCategory(row);
  };

  const closeProductsModal = () => {
    setProductsModalOpen(false);
    setPmTarget(null);
    setPmInCategory([]);
    setPmMoveIds(new Set());
    setPmAddSearch('');
    setPmAddRows([]);
    setPmAddSelected(new Set());
  };

  const fetchAddCandidates = useCallback(async () => {
    if (!pmTarget?.name) return;
    const q = pmAddSearch.trim();
    setPmAddLoading(true);
    try {
      const res = await api.get('/admin/products', {
        params: q ? { search: q, limit: 100, page: 1 } : { limit: 50, page: 1 },
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setPmAddRows(list);
      setPmAddSelected(new Set());
    } catch {
      toast.error('Search failed');
    } finally {
      setPmAddLoading(false);
    }
  }, [pmTarget, pmAddSearch]);

  useEffect(() => {
    if (!productsModalOpen || !pmTarget) return;
    const t = setTimeout(fetchAddCandidates, 350);
    return () => clearTimeout(t);
  }, [productsModalOpen, pmTarget, pmAddSearch, fetchAddCandidates]);

  const toggleMove = (id) => {
    setPmMoveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAdd = (id) => {
    setPmAddSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyMove = async () => {
    if (!pmTarget?.name || !moveToCategoryName) {
      toast.error('Choose a target category');
      return;
    }
    const ids = [...pmMoveIds];
    if (!ids.length) {
      toast.error('Select products to move');
      return;
    }
    setPmBusy(true);
    try {
      await api.post('/admin/bulkMoveProductsCategory', {
        productIds: ids,
        targetCategoryName: moveToCategoryName,
      });
      toast.success('Products moved');
      await loadProductsInCategory(pmTarget);
      fetchCategories();
      setPmMoveIds(new Set());
    } catch (err) {
      toast.error(err?.message || 'Move failed');
    } finally {
      setPmBusy(false);
    }
  };

  const applyAdd = async () => {
    if (!pmTarget?.name) return;
    const ids = [...pmAddSelected];
    if (!ids.length) {
      toast.error('Select products to add');
      return;
    }
    setPmBusy(true);
    try {
      await api.post('/admin/bulkAssignCategoryProducts', {
        categoryName: pmTarget.name,
        productIds: ids,
      });
      toast.success('Products added to category');
      await loadProductsInCategory(pmTarget);
      fetchCategories();
      setPmAddSelected(new Set());
    } catch (err) {
      toast.error(err?.message || 'Add failed');
    } finally {
      setPmBusy(false);
    }
  };

  const ParentCell = ({ effectiveMain, mainIsInferred }) => {
    const label = parentLabel(effectiveMain);
    if (!label) {
      return <span className="admin-categories__parent-pill admin-categories__parent-pill--muted">Not set</span>;
    }
    return (
      <span
        className="admin-categories__parent-pill"
        title={
          mainIsInferred
            ? 'Matched from storefront catalog. Open Edit and choose Parent to save it on the category.'
            : undefined
        }
      >
        {label}
        {mainIsInferred ? <span className="text-[10px] font-semibold opacity-75 ml-1">· auto</span> : null}
      </span>
    );
  };

  const RowActions = ({ cat, compact }) => (
    <div className={`flex ${compact ? 'flex-wrap' : 'flex-wrap justify-end'} gap-1.5`}>
      <button
        type="button"
        onClick={() => openEditModal(cat, true)}
        className="admin-categories__action-btn"
      >
        <Edit2 size={15} strokeWidth={2} /> Edit
      </button>
      <button type="button" onClick={() => openProductsModal(cat)} className="admin-categories__action-btn">
        <Link2 size={15} strokeWidth={2} /> Products
      </button>
      <button
        type="button"
        onClick={() => handleDelete(cat.id)}
        className="admin-categories__action-btn admin-categories__action-btn--danger"
        title="Delete"
      >
        <Trash2 size={15} strokeWidth={2} />
      </button>
    </div>
  );

  return (
    <div className="admin-categories">
      <Toaster position="top-center" />

      <header className="admin-categories__hero">
        <div className="admin-categories__hero-main">
          <div className="admin-categories__hero-icon" aria-hidden>
            <Tag size={24} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="admin-categories__title">Categories</h1>
          </div>
        </div>
        <button type="button" onClick={() => openEditModal(null, false)} className="admin-categories__btn-primary">
          <Plus size={20} strokeWidth={2} /> Add category
        </button>
      </header>

      <div className="admin-categories__search-wrap">
        <Search className="admin-categories__search-icon" size={18} strokeWidth={2} />
        <input
          type="search"
          placeholder="Search categories…"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="admin-categories__search-input"
          aria-label="Search categories"
        />
      </div>

      <div className="admin-categories__main-filters" role="tablist" aria-label="Filter by parent region">
        <span className="admin-categories__main-filters-label w-full sm:w-auto">Main category</span>
        {MAIN_FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mainFilter === tab.id}
            className={`admin-categories__main-tab ${mainFilter === tab.id ? 'admin-categories__main-tab--active' : ''}`}
            onClick={() => {
              setMainFilter(tab.id);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainFilter !== 'all' && !listLoading && !listError && categories.length === 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-4">
          No categories match <strong>{MAIN_FILTER_TABS.find((t) => t.id === mainFilter)?.label}</strong> for this page. Open{' '}
          <strong>All</strong> to see every row, or add categories whose names match the shop subcategories for that region.
        </p>
      )}

      <div className="admin-categories__panel admin-categories__table-panel">
        <div className="admin-categories__table-wrap">
          <table className="admin-categories__table">
            <thead>
              <tr>
                <th scope="col">Image</th>
                <th scope="col">Name</th>
                <th scope="col">Parent</th>
                <th scope="col" className="text-center w-16">
                  Sort
                </th>
                <th scope="col" className="text-center w-28">
                  Products
                </th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {listLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-500 text-sm">
                    <Loader2 className="animate-spin inline align-middle mr-2" size={20} strokeWidth={2} aria-hidden />
                    Loading categories…
                  </td>
                </tr>
              )}
              {!listLoading && listError && (
                <tr>
                  <td colSpan={7} className="p-4">
                    <div className="admin-categories__error-banner" role="alert">
                      <p className="admin-categories__error-banner-text">{listError}</p>
                      <button type="button" className="admin-categories__error-retry" onClick={() => fetchCategories()}>
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!listLoading && !listError && categories.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-500 text-sm">
                    No categories yet. Use &quot;Add category&quot;.
                  </td>
                </tr>
              )}
              {!listLoading &&
                !listError &&
                categories.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <CategoryThumbButton
                      image={cat.displayThumbnail || cat.image}
                      ariaLabel={`Edit ${cat.name}`}
                      onClick={() => openEditModal(cat, true)}
                    />
                  </td>
                  <td>
                    <button type="button" className="admin-categories__name-btn" onClick={() => openEditModal(cat, true)}>
                      {cat.name}
                    </button>
                  </td>
                  <td>
                    <ParentCell effectiveMain={cat.effectiveMain} mainIsInferred={cat.mainIsInferred} />
                  </td>
                  <td className="text-center text-slate-600 tabular-nums">{cat.sortOrder}</td>
                  <td className="text-center">
                    <button
                      type="button"
                      className="admin-categories__count-btn"
                      onClick={() => openProductsModal(cat)}
                      title={
                        cat.countFromCatalog > 0
                          ? 'Products whose category field matches this name (normalized). Click to manage.'
                          : 'No products use this category name yet. Use Add products to assign SKUs.'
                      }
                    >
                      <span className="tabular-nums font-semibold">{cat.count}</span>
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={statusUpdatingId === cat.id}
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border-0 cursor-pointer transition-opacity disabled:opacity-60 disabled:cursor-not-allowed ${
                        cat.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200/90'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/90'
                      }`}
                      title={
                        cat.status === 'Active'
                          ? 'Active on the shop — click to deactivate and hide from the storefront'
                          : 'Inactive — click to activate and show on the storefront'
                      }
                    >
                      {statusUpdatingId === cat.id ? (
                        <Loader2 className="animate-spin shrink-0" size={14} strokeWidth={2} aria-hidden />
                      ) : null}
                      {cat.status}
                    </button>
                  </td>
                  <td className="text-right">
                    <RowActions cat={cat} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!listLoading && !listError && pagination.total > 0 && (
        <nav className="admin-categories__pagination" aria-label="Category pages">
          <p className="admin-categories__pagination-meta">
            Showing{' '}
            <span className="tabular-nums">
              {(pagination.page - 1) * pageSize + 1}–{Math.min(pagination.page * pageSize, pagination.total)}
            </span>{' '}
            of <span className="tabular-nums">{pagination.total}</span>
          </p>
          <div className="admin-categories__pagination-actions">
            <button
              type="button"
              className="admin-categories__page-btn"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={18} strokeWidth={2} /> Previous
            </button>
            <span className="admin-categories__page-indicator tabular-nums">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className="admin-categories__page-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              aria-label="Next page"
            >
              Next <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>
        </nav>
      )}

      {isModalOpen && (
        <div className="admin-categories__modal-overlay z-[99999]">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-transparent"
            aria-label="Close"
            onClick={() => !loading && setIsModalOpen(false)}
          />
          <div className="admin-categories__modal z-10">
            <div className="flex justify-between items-start mb-5">
              <h2 className="admin-categories__modal-title">{isEditing ? 'Edit category' : 'New category'}</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 min-h-[44px] min-w-[44px] flex items-center justify-center border-0 bg-transparent cursor-pointer"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="admin-categories__field-label" htmlFor="cat-name">
                  Category name
                </label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  value={currentCategory.name}
                  onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                  className="admin-categories__input"
                  placeholder="e.g. Spices & Masalas"
                />
              </div>

              <div>
                <label className="admin-categories__field-label" htmlFor="cat-parent">
                  Parent category
                </label>
                <select
                  id="cat-parent"
                  value={currentCategory.main}
                  onChange={(e) => setCurrentCategory({ ...currentCategory, main: e.target.value })}
                  className="admin-categories__select"
                >
                  {isEditing && currentCategory.main === '' && <option value="">Select parent region…</option>}
                  {PARENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="admin-categories__field-label" htmlFor="cat-sort">
                  Sort order (lower first)
                </label>
                <input
                  id="cat-sort"
                  type="number"
                  min={0}
                  max={99999}
                  value={currentCategory.sortOrder}
                  onChange={(e) => setCurrentCategory({ ...currentCategory, sortOrder: e.target.value })}
                  className="admin-categories__input"
                />
              </div>

              <div>
                <span className="admin-categories__field-label">Image</span>
                <p className="text-xs text-slate-500 mb-2">JPG, PNG, or WebP — optimized on the server (max 5MB).</p>
                <div className="admin-categories__upload-zone">
                  <div className="admin-categories__upload-preview">
                    {currentCategory.image ? (
                      <img src={resolveImageUrl(currentCategory.image)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="text-slate-400" size={28} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      onChange={handleImageFile}
                      disabled={uploadingImage}
                      className="admin-categories__file-input"
                      id="cat-image-input"
                    />
                    <label htmlFor="cat-image-input" className="admin-categories__upload-btn w-fit cursor-pointer">
                      <Upload size={18} strokeWidth={2} />
                      {uploadingImage ? 'Uploading…' : 'Choose image'}
                    </label>
                    {uploadingImage && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Loader2 className="animate-spin" size={14} /> Compressing…
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <span className="admin-categories__field-label">Status</span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Active', 'Inactive'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setCurrentCategory({ ...currentCategory, status })}
                      className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors min-h-[48px] sm:min-h-[44px] ${
                        currentCategory.status === status
                          ? 'border-[var(--primary-color,#3090cf)] bg-[#f0f9ff] text-[var(--primary-color,#3090cf)]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} className="admin-categories__submit">
                {loading ? <Loader2 className="animate-spin inline" size={18} /> : isEditing ? 'Save changes' : 'Create category'}
              </button>
            </form>
          </div>
        </div>
      )}

      {productsModalOpen && pmTarget && (
        <div className="admin-categories__modal-overlay z-[99999]">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-transparent"
            aria-label="Close"
            onClick={() => !pmBusy && closeProductsModal()}
          />
          <div className="admin-categories__modal max-w-lg! w-full! max-h-[88vh] flex flex-col z-10 p-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h2 className="admin-categories__modal-title">Products in category</h2>
                  <p className="text-sm text-slate-600 mt-1 break-words">
                    <span className="font-semibold text-slate-800">{pmTarget.name}</span>
                    <span className="text-slate-400"> · </span>
                    {pmInLoading
                      ? 'Loading…'
                      : `${pmInCategory.length} in list · table count ${pmTarget.count ?? 0}${
                          pmTarget.countInStock != null &&
                          pmTarget.countAll != null &&
                          pmTarget.countInStock !== pmTarget.countAll
                            ? ` (${pmTarget.countInStock} in stock, ${pmTarget.countAll} assigned)`
                            : ''
                        }`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !pmBusy && closeProductsModal()}
                  className="p-2 rounded-lg hover:bg-slate-100 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center border-0 bg-transparent"
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">In this category</h3>
                <p className="text-xs text-slate-500 mb-2">Select products to move to another category.</p>
                <div className="border border-slate-200 rounded-xl max-h-[200px] overflow-y-auto">
                  {pmInLoading ? (
                    <div className="flex justify-center py-10 text-slate-400">
                      <Loader2 className="animate-spin" />
                    </div>
                  ) : pmInCategory.length === 0 ? (
                    <p className="text-sm text-slate-500 p-4 text-center">No products match this category name yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {pmInCategory.map((p) => (
                        <li key={p._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={pmMoveIds.has(p._id)}
                            onChange={() => toggleMove(p._id)}
                            className="rounded border-slate-300 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
                          />
                          <ProductRowThumb product={p} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-slate-800 block break-words">{p.name}</span>
                            <span className="text-[11px] text-slate-400">
                              {p.inStock === false ? 'Out of stock' : 'In stock'}
                              {typeof p.quantity === 'number' ? ` · Qty ${p.quantity}` : ''}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <select
                    value={moveToCategoryName}
                    onChange={(e) => setMoveToCategoryName(e.target.value)}
                    className="admin-categories__select flex-1"
                  >
                    <option value="">Move selected to…</option>
                    {otherCategoryNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pmBusy}
                    onClick={applyMove}
                    className="admin-categories__submit sm:w-auto! px-6 bg-slate-800 hover:bg-slate-900"
                  >
                    Move
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Add products</h3>
                <input
                  type="search"
                  placeholder="Search products…"
                  value={pmAddSearch}
                  onChange={(e) => setPmAddSearch(e.target.value)}
                  className="admin-categories__search-input mb-2 pl-4"
                />
                <div className="border border-slate-200 rounded-xl max-h-[220px] overflow-y-auto">
                  {pmAddLoading ? (
                    <div className="flex justify-center py-10 text-slate-400">
                      <Loader2 className="animate-spin" />
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {pmAddRows.map((p) => (
                        <li key={p._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={pmAddSelected.has(p._id)}
                            onChange={() => toggleAdd(p._id)}
                            className="rounded border-slate-300 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
                          />
                          <ProductRowThumb product={p} />
                          <span className="text-sm text-slate-800 flex-1 min-w-0 break-words">{p.name}</span>
                          <span className="text-xs text-slate-400 truncate max-w-[80px] hidden sm:inline">{p.category}</span>
                        </li>
                      ))}
                      {pmAddRows.length === 0 && (
                        <li className="px-3 py-6 text-center text-sm text-slate-500">Type to search products.</li>
                      )}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pmBusy}
                  onClick={applyAdd}
                  className="admin-categories__submit mt-3 bg-[var(--primary-color,#3090cf)] hover:opacity-95"
                >
                  Add selected to &quot;{pmTarget.name}&quot;
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDashboard;
