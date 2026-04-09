import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSearch } from '../../hooks/usePerformance';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  XCircle,
  DollarSign,
  Trash2,
  Eye,
  Pencil,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
} from 'lucide-react';
import { AdminBadge, AdminButton, ConfirmModal, AdminTableSkeleton } from '../../components/admin/ui';

const CATEGORY_NAMES = [
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

const STOCK_TABS = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'Active' },
  { id: 'out', label: 'Out of stock' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'name-asc', label: 'Title A–Z' },
  { id: 'name-desc', label: 'Title Z–A' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'stock-asc', label: 'Inventory: low to high' },
  { id: 'stock-desc', label: 'Inventory: high to low' },
];

function AdminProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { searchTerm, debouncedSearchTerm, handleSearchChange, setSearchTerm } = useSearch('', 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockTab, setStockTab] = useState('all');
  const [sortKey, setSortKey] = useState('newest');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  const [productStats, setProductStats] = useState({
    total: 0,
    inStock: 0,
    outOfStock: 0,
    totalValue: 0,
  });

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const selectWrapRef = useRef(null);
  const masterCheckboxRef = useRef(null);
  const forcedSearchRef = useRef(null);

  const [importingCsv, setImportingCsv] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [csvUploadPct, setCsvUploadPct] = useState(null);
  const [csvImportReport, setCsvImportReport] = useState(null);
  const csvInputRef = useRef(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name-asc':
          return String(a.name || '').localeCompare(String(b.name || ''));
        case 'name-desc':
          return String(b.name || '').localeCompare(String(a.name || ''));
        case 'price-asc':
          return Number(a.price || 0) - Number(b.price || 0);
        case 'price-desc':
          return Number(b.price || 0) - Number(a.price || 0);
        case 'stock-asc':
          return Number(a.quantity || 0) - Number(b.quantity || 0);
        case 'stock-desc':
          return Number(b.quantity || 0) - Number(a.quantity || 0);
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });
    return arr;
  }, [products, sortKey]);

  const loadProductsData = useCallback(async () => {
    try {
      setLoading(true);
      const searchParam =
        forcedSearchRef.current !== null ? forcedSearchRef.current : debouncedSearchTerm || '';
      if (forcedSearchRef.current !== null) forcedSearchRef.current = null;

      const res = await api.get('/admin/products', {
        params: {
          page,
          limit,
          search: searchParam,
          category: categoryFilter === 'All' ? '' : categoryFilter,
          stock: stockTab,
        },
      });

      if (res && res.success === false) {
        toast.error(res.message || 'Failed to fetch products');
        setProducts([]);
        return;
      }
      const list = Array.isArray(res?.data) ? res.data : [];
      setProducts(list);
      setTotalPages(res.pagination?.totalPages || 1);
      if (typeof res.pagination?.currentPage === 'number') {
        setPage(res.pagination.currentPage);
      }
      setProductStats({
        total: res.pagination?.total ?? list.length,
        inStock: res.stats?.inStock || 0,
        outOfStock: res.stats?.outOfStock || 0,
        totalValue: res.stats?.totalValue || 0,
      });
    } catch (err) {
      toast.error(err?.message || 'Failed to fetch products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, categoryFilter, stockTab, limit]);

  useEffect(() => {
    loadProductsData();
  }, [loadProductsData]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearchTerm, categoryFilter, stockTab]);

  useEffect(() => {
    const onDoc = (e) => {
      if (selectWrapRef.current && !selectWrapRef.current.contains(e.target)) setSelectMenuOpen(false);
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const idsOnPage = useMemo(() => sortedProducts.map((p) => p._id).filter(Boolean), [sortedProducts]);
  const allOnPageSelected =
    idsOnPage.length > 0 && idsOnPage.every((id) => selectedIds.has(id));
  const someOnPageSelected = idsOnPage.some((id) => selectedIds.has(id));

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      idsOnPage.forEach((id) => next.add(id));
      return next;
    });
    setSelectMenuOpen(false);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMenuOpen(false);
  };

  const toggleMaster = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idsOnPage.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      selectAllOnPage();
    }
  };

  const onSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    forcedSearchRef.current = searchTerm.trim();
    if (page !== 1) setPage(1);
    else loadProductsData();
  };

  const firstSelectedId = useMemo(() => {
    for (const id of selectedIds) {
      if (sortedProducts.some((p) => p._id === id)) return id;
    }
    return [...selectedIds][0];
  }, [selectedIds, sortedProducts]);

  const goViewOrEdit = () => {
    if (!firstSelectedId) return;
    navigate(`/admin/products/${firstSelectedId}`);
  };

  const runBulkDelete = async () => {
    const ids = [...selectedIds].map(String);
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      for (const pid of ids) {
        await api.delete(`/admin/products/${pid}`);
      }
      toast.success('Products deleted');
      setBulkDeleteOpen(false);
      clearSelection();
      loadProductsData();
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDownloadSampleCsv = async () => {
    try {
      const blob = await api.get('/admin/products/csv-sample', {
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
        throw new Error(payload?.message || 'Sample download failed');
      }
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'grocera-products-sample.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Sample CSV downloaded');
    } catch (err) {
      toast.error(err?.message || 'Sample download failed');
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const blob = await api.get('/admin/products/export-csv', {
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
      link.download = `products-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Products exported');
    } catch (err) {
      toast.error(err?.message || 'CSV export failed');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleImportCsv = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a .csv file');
      return;
    }
    try {
      setImportingCsv(true);
      setCsvUploadPct(0);
      setCsvImportReport(null);
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/admin/products/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 360000,
        onUploadProgress: (ev) => {
          if (ev.total) setCsvUploadPct(Math.round((ev.loaded / ev.total) * 100));
        },
      });
      setCsvUploadPct(100);
      if (response?.success) {
        toast.success(
          `Imported ${response.importedCount || 0} row(s)${response.batches ? ` in ${response.batches} batch(es)` : ''}`
        );
        if (response.failedCount > 0) {
          toast.error(`${response.failedCount} row(s) skipped — see report below`);
        }
        setCsvImportReport({
          imported: response.importedCount ?? 0,
          failed: response.failedCount ?? 0,
          rows: response.failedRows || [],
          truncated: Boolean(response.failedRowsTruncated),
        });
        loadProductsData();
      } else {
        toast.error(response?.message || 'CSV import failed');
      }
    } catch (err) {
      toast.error(err?.message || 'CSV import failed');
    } finally {
      setImportingCsv(false);
      setCsvUploadPct(null);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const statCards = [
    {
      label: 'Total products',
      val: productStats.total,
      icon: Package,
      accent: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: 'Active inventory',
      val: productStats.inStock,
      icon: CheckCircle,
      accent: 'text-sky-700',
      bg: 'bg-sky-50',
    },
    {
      label: 'Out of stock',
      val: productStats.outOfStock,
      icon: XCircle,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Inventory value',
      val: `$${Number(productStats.totalValue || 0).toLocaleString()}`,
      icon: DollarSign,
      accent: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div className="admin-design-scope mx-auto max-w-[1600px] space-y-6 pb-12 font-sans text-slate-900">
      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.size} product(s)?`}
        description="This permanently removes selected products from your catalog. This action cannot be undone."
        confirmLabel="Delete products"
        cancelLabel="Cancel"
        variant="danger"
        loading={bulkDeleting}
        onClose={() => !bulkDeleting && setBulkDeleteOpen(false)}
        onConfirm={runBulkDelete}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="admin-stat-card"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.accent}`} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main surface */}
      <div className="admin-card-surface overflow-hidden">
        {/* Page header */}
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Products</h1>
            <p className="mt-1 text-sm text-slate-500">Manage your catalog, inventory, and pricing.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton variant="secondary" size="md" type="button" onClick={handleDownloadSampleCsv}>
              Download sample CSV
            </AdminButton>
            <AdminButton variant="secondary" size="md" disabled={exportingCsv} onClick={handleExportCsv}>
              {exportingCsv ? 'Exporting…' : 'Export'}
            </AdminButton>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleImportCsv(e.target.files?.[0])}
            />
            <AdminButton variant="secondary" size="md" disabled={importingCsv} onClick={() => csvInputRef.current?.click()}>
              {importingCsv
                ? csvUploadPct != null
                  ? `Upload ${csvUploadPct}%`
                  : 'Processing…'
                : 'Import CSV'}
            </AdminButton>
            <Link
              to="/admin/products/new"
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg bg-[#2878b3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1f6396] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2878b3] focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add product
            </Link>
          </div>
        </div>

        {csvImportReport ? (
          <div className="border-b border-amber-100 bg-amber-50/90 px-5 py-3 sm:px-6 text-sm text-amber-950">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p>
                <span className="font-semibold">Last CSV import:</span> {csvImportReport.imported} row(s) applied
                {csvImportReport.failed > 0 ? `, ${csvImportReport.failed} skipped` : ''}.
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-amber-900 underline decoration-amber-700/50 hover:decoration-amber-900"
                onClick={() => setCsvImportReport(null)}
              >
                Dismiss
              </button>
            </div>
            {csvImportReport.rows?.length > 0 ? (
              <ul className="mt-2 max-h-36 list-inside list-disc overflow-y-auto text-xs text-amber-900/90">
                {csvImportReport.rows.slice(0, 40).map((r, idx) => (
                  <li key={`${r.row}-${idx}`}>
                    Row {r.row}: {r.error}
                  </li>
                ))}
              </ul>
            ) : null}
            {csvImportReport.truncated ? (
              <p className="mt-2 text-xs text-amber-800/90">Additional errors were truncated on the server.</p>
            ) : null}
          </div>
        ) : null}

        {/* Status tabs */}
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 pt-3 sm:px-6" role="tablist">
          {STOCK_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={stockTab === tab.id}
              className={`relative mb-[-1px] rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                stockTab === tab.id
                  ? 'border border-b-0 border-slate-200 bg-white text-slate-900'
                  : 'border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              } `}
              onClick={() => {
                setStockTab(tab.id);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar: search, sort, filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6">
          <div className="relative min-w-[200px] flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search products"
              value={searchTerm}
              onChange={(e) => {
                handleSearchChange(e);
                setPage(1);
              }}
              onKeyDown={onSearchKeyDown}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
              aria-label="Search products"
            />
          </div>

          <div className="relative flex items-center gap-2">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-3" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="h-10 w-full min-w-[180px] appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-colors focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20 sm:w-auto"
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative" ref={filterMenuRef}>
            <AdminButton
              variant="secondary"
              size="md"
              className="w-full sm:w-auto"
              onClick={() => setFilterMenuOpen((o) => !o)}
              aria-expanded={filterMenuOpen}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${filterMenuOpen ? 'rotate-180' : ''}`} />
            </AdminButton>
            {filterMenuOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,280px)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
                >
                  <option value="All">All categories</option>
                  {CATEGORY_NAMES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <AdminButton
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setCategoryFilter('All');
                    setPage(1);
                    setFilterMenuOpen(false);
                  }}
                >
                  Reset category
                </AdminButton>
              </div>
            ) : null}
          </div>

          <AdminButton
            variant="ghost"
            size="md"
            className="sm:ml-auto"
            onClick={() => loadProductsData()}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </AdminButton>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-sky-200/60 bg-gradient-to-r from-sky-50/90 to-blue-50/50 px-4 py-3 sm:px-6">
            <LayoutGrid className="h-4 w-4 text-sky-700" />
            <span className="text-sm font-semibold text-sky-900">{selectedIds.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <AdminButton variant="secondary" size="sm" onClick={goViewOrEdit} disabled={!firstSelectedId}>
                <Eye className="h-4 w-4" />
                View
              </AdminButton>
              <AdminButton variant="secondary" size="sm" onClick={goViewOrEdit} disabled={!firstSelectedId}>
                <Pencil className="h-4 w-4" />
                Edit
              </AdminButton>
              <AdminButton variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </AdminButton>
              <AdminButton variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </AdminButton>
            </div>
          </div>
        ) : null}

        {/* Selection + row tools (Gmail-style) */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-2 sm:px-4">
          <div className="relative flex items-center" ref={selectWrapRef}>
            <input
              ref={masterCheckboxRef}
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-[#2878b3] focus:ring-[#2878b3]/30"
              checked={allOnPageSelected && idsOnPage.length > 0}
              onChange={toggleMaster}
              aria-label="Select all on this page"
            />
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-expanded={selectMenuOpen}
              onClick={() => setSelectMenuOpen((o) => !o)}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {selectMenuOpen ? (
              <ul className="absolute left-0 top-full z-40 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="menu">
                <li>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={selectAllOnPage}
                  >
                    All
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={clearSelection}
                  >
                    None
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>

        {/* Table desktop */}
        <div className="hidden md:block">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-10 px-4 py-3" />
                  <th className="w-14 px-2 py-3" />
                  <th className="min-w-[200px] px-4 py-3">Product</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Inventory</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                </tr>
              </thead>
              {loading ? (
                <AdminTableSkeleton rows={10} cols={7} />
              ) : (
                <tbody className="divide-y divide-slate-100">
                  {sortedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                            <Package className="h-7 w-7 text-slate-400" />
                          </div>
                          <p className="text-base font-medium text-slate-800">No products found</p>
                          <p className="mt-1 text-sm text-slate-500">Try adjusting search or filters.</p>
                          {searchTerm ? (
                            <AdminButton variant="secondary" size="sm" className="mt-4" onClick={() => setSearchTerm('')}>
                              Clear search
                            </AdminButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedProducts.map((p) => {
                      const sel = selectedIds.has(p._id);
                      const qty = Number(p.quantity) || 0;
                      const low = qty === 0 || p.inStock === false;
                      return (
                        <tr
                          key={p._id}
                          className={`group transition-colors ${sel ? 'bg-sky-50/80' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-[#2878b3] focus:ring-[#2878b3]/30"
                              checked={sel}
                              onChange={() => toggleRow(p._id)}
                              aria-label={`Select ${p.name}`}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <div className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              {p.image ? (
                                <img src={p.image} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="h-5 w-5 text-slate-300" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            <Link
                              to={`/admin/products/${p._id}`}
                              className="font-semibold text-slate-900 hover:text-[#2878b3] transition-colors"
                            >
                              {p.name}
                            </Link>
                            {p.unit ? (
                              <p className="mt-0.5 text-xs text-slate-500">Per {p.unit}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <AdminBadge variant={p.inStock ? 'success' : 'muted'}>
                              {p.inStock ? 'Active' : 'Out of stock'}
                            </AdminBadge>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-medium tabular-nums ${low ? 'text-red-600' : 'text-slate-700'}`}
                            >
                              {qty} in stock
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.category || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                            ${Number(p.price || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No products found.</div>
          ) : (
            sortedProducts.map((p) => {
              const sel = selectedIds.has(p._id);
              const qty = Number(p.quantity) || 0;
              const low = qty === 0 || p.inStock === false;
              return (
                <div
                  key={p._id}
                  className={`flex gap-3 rounded-xl border p-3 ${sel ? 'border-sky-300 bg-sky-50/50' : 'border-slate-200 bg-white'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2878b3]"
                    checked={sel}
                    onChange={() => toggleRow(p._id)}
                  />
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {p.image ? (
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-6 w-6 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/products/${p._id}`} className="font-semibold text-slate-900 hover:text-[#2878b3]">
                      {p.name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.category} ·{' '}
                      <span className={low ? 'font-semibold text-red-600' : ''}>{qty} in stock</span> · $
                      {Number(p.price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:px-6">
          <p className="text-sm text-slate-500">
            Page <span className="font-medium text-slate-800">{page}</span> of{' '}
            <span className="font-medium text-slate-800">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <AdminButton
              variant="secondary"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((x) => x - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((x) => x + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminProducts;
