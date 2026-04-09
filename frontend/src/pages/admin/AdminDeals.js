import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSearch } from '../../hooks/usePerformance';
import { resolveBrandingAssetUrl } from '../../utils/brandingAssets';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Tag,
  CalendarClock,
  Ban,
  Trash2,
  Pencil,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  Percent,
  ImageIcon,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { AdminBadge, AdminButton, ConfirmModal, AdminTableSkeleton } from '../../components/admin/ui';
import Select from 'react-select';

const DEAL_STATUS_TABS = [
  { id: 'All', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'Expired', label: 'Expired' },
  { id: 'Inactive', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'name-asc', label: 'Title A–Z' },
  { id: 'name-desc', label: 'Title Z–A' },
  { id: 'start-asc', label: 'Start date: earliest' },
  { id: 'start-desc', label: 'Start date: latest' },
];

const FORM_TO_API_DEAL_TYPE = { PERCENT: 'Percentage', FLAT: 'Fixed', BOGO: 'BOGO' };
const API_TO_FORM_DEAL_TYPE = { Percentage: 'PERCENT', Fixed: 'FLAT', BOGO: 'BOGO' };

function getDealThumbnailUrl(deal) {
  const first = Array.isArray(deal.productId) ? deal.productId[0] : null;
  const raw = first && typeof first === 'object' && first.image ? String(first.image).trim() : '';
  return raw ? resolveBrandingAssetUrl(raw) : '';
}

function formatDiscountLine(deal) {
  const t = String(deal.dealType || '');
  const v = deal.discountValue;
  if (t === 'BOGO') return 'BOGO';
  if (t === 'Percentage') return `${v != null ? v : '—'}% off`;
  if (t === 'Fixed') return `$${v != null ? Number(v).toFixed(2) : '—'} off`;
  return `${t || '—'} · ${v ?? '—'}`;
}

function getScheduleMeta(deal) {
  const now = new Date();
  const end = deal.endAt ? new Date(deal.endAt) : null;
  const start = deal.startAt ? new Date(deal.startAt) : null;
  if (end && end < now) return { label: 'Expired', variant: 'muted' };
  if (start && start > now) return { label: 'Scheduled', variant: 'warning' };
  return { label: 'Live', variant: 'success' };
}

function buildUpdatePayload(deal, overrides = {}) {
  const pids = (deal.productId || []).map((p) =>
    typeof p === 'object' && p != null ? String(p._id) : String(p),
  );
  const isBogo = deal.dealType === 'BOGO';
  const dv = isBogo ? 0 : Number(deal.discountValue) || 0;
  return {
    productId: pids,
    dealName: deal.dealName,
    dealType: deal.dealType,
    discountValue: dv,
    startAt: deal.startAt,
    endAt: deal.endAt,
    isActive: deal.isActive !== false,
    showOnProductPage: deal.showOnProductPage !== false,
    ...overrides,
  };
}

function AdminDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const { searchTerm, debouncedSearchTerm, handleSearchChange, setSearchTerm } = useSearch('', 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;
  const [statusTab, setStatusTab] = useState('All');
  const [sortKey, setSortKey] = useState('newest');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);
  const forcedSearchRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [productOptions, setProductOptions] = useState([]);

  const initialFormData = useMemo(
    () => ({
      dealName: '',
      dealType: 'PERCENT',
      discountValue: '',
      productId: [],
      startAt: '',
      endAt: '',
      perUserLimit: '',
      isActive: true,
      showOnProductPage: true,
    }),
    [],
  );
  const [formData, setFormData] = useState(initialFormData);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const selectWrapRef = useRef(null);
  const masterCheckboxRef = useRef(null);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState(null);
  const [singleDeleting, setSingleDeleting] = useState(false);
  const [bulkStatusWorking, setBulkStatusWorking] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

  const sortedDeals = useMemo(() => {
    const arr = [...deals];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name-asc':
          return String(a.dealName || '').localeCompare(String(b.dealName || ''));
        case 'name-desc':
          return String(b.dealName || '').localeCompare(String(a.dealName || ''));
        case 'start-asc':
          return new Date(a.startAt || 0) - new Date(b.startAt || 0);
        case 'start-desc':
          return new Date(b.startAt || 0) - new Date(a.startAt || 0);
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });
    return arr;
  }, [deals, sortKey]);

  const loadDealsData = useCallback(async () => {
    try {
      setLoading(true);
      const searchParam =
        forcedSearchRef.current !== null ? forcedSearchRef.current : debouncedSearchTerm || '';
      if (forcedSearchRef.current !== null) forcedSearchRef.current = null;

      const res = await api.get('/admin/deals', {
        params: {
          pageNo: page,
          size: limit,
          search: searchParam.trim() || undefined,
          status: statusTab !== 'All' ? statusTab : undefined,
        },
      });

      if (res?.error) {
        toast.error(res.message || 'Failed to fetch deals');
        setDeals([]);
        setTotal(0);
        return;
      }
      const inner = res?.data;
      setDeals(Array.isArray(inner?.list) ? inner.list : []);
      setTotal(typeof inner?.total === 'number' ? inner.total : 0);
    } catch (err) {
      toast.error(err?.message || 'Failed to fetch deals');
      setDeals([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearchTerm, statusTab]);

  useEffect(() => {
    loadDealsData();
  }, [loadDealsData]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearchTerm, statusTab]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const prodsRes = await api.get('/admin/products', {
          params: { page: 1, limit: 500, search: '', category: '' },
        });
        if (prodsRes?.success === false || prodsRes?.error) return;
        const list = Array.isArray(prodsRes?.data) ? prodsRes.data : [];
        setProductOptions(
          list.map((p) => ({
            value: String(p._id),
            label: p.name || String(p._id),
          })),
        );
      } catch {
        setProductOptions([]);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (selectWrapRef.current && !selectWrapRef.current.contains(e.target)) setSelectMenuOpen(false);
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const idsOnPage = useMemo(() => sortedDeals.map((d) => d._id).filter(Boolean), [sortedDeals]);
  const allOnPageSelected = idsOnPage.length > 0 && idsOnPage.every((id) => selectedIds.has(String(id)));
  const someOnPageSelected = idsOnPage.some((id) => selectedIds.has(String(id)));

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const toggleRow = (id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      idsOnPage.forEach((id) => next.add(String(id)));
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
        idsOnPage.forEach((id) => next.delete(String(id)));
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
    else loadDealsData();
  };

  const firstSelectedDeal = useMemo(() => {
    for (const id of selectedIds) {
      const d = sortedDeals.find((x) => String(x._id) === id);
      if (d) return d;
    }
    return null;
  }, [selectedIds, sortedDeals]);

  const dealStatsOnPage = useMemo(() => {
    const now = new Date();
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    for (const d of deals) {
      const end = d.endAt ? new Date(d.endAt) : null;
      const start = d.startAt ? new Date(d.startAt) : null;
      if (end && end < now) expired += 1;
      else if (start && start > now) scheduled += 1;
      else if (d.isActive !== false) active += 1;
    }
    return { active, scheduled, expired };
  }, [deals]);

  const statCards = [
    {
      label: 'Total deals',
      val: total,
      icon: Tag,
      accent: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: 'Live on page',
      val: dealStatsOnPage.active,
      icon: CheckCircle,
      accent: 'text-sky-700',
      bg: 'bg-sky-50',
    },
    {
      label: 'Scheduled (page)',
      val: dealStatsOnPage.scheduled,
      icon: CalendarClock,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Expired (page)',
      val: dealStatsOnPage.expired,
      icon: Ban,
      accent: 'text-slate-600',
      bg: 'bg-slate-100',
    },
  ];

  const openModal = useCallback(
    (deal = null) => {
      if (deal) {
        setEditingDeal(deal);
        setFormData({
          dealName: deal.dealName || '',
          dealType: API_TO_FORM_DEAL_TYPE[deal.dealType] || 'PERCENT',
          discountValue: deal.discountValue ?? '',
          productId: Array.isArray(deal.productId)
            ? deal.productId.map((p) => (typeof p === 'object' && p != null ? String(p._id) : String(p)))
            : [],
          startAt: deal.startAt ? String(deal.startAt).substring(0, 10) : '',
          endAt: deal.endAt ? String(deal.endAt).substring(0, 10) : '',
          perUserLimit: deal.perUserLimit || '',
          isActive: deal.isActive !== false,
          showOnProductPage: deal.showOnProductPage !== false,
        });
      } else {
        setEditingDeal(null);
        setFormData(initialFormData);
      }
      setShowModal(true);
    },
    [initialFormData],
  );

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingDeal(null);
    setFormData(initialFormData);
  }, [initialFormData]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const dealType = FORM_TO_API_DEAL_TYPE[formData.dealType];
      const isBogo = formData.dealType === 'BOGO';
      const discountValue = isBogo ? 0 : Number(formData.discountValue);
      if (!formData.productId?.length) {
        toast.error('Select at least one product');
        return;
      }
      if (!isBogo && (!Number.isFinite(discountValue) || discountValue <= 0)) {
        toast.error('Enter a valid discount value');
        return;
      }

      const payload = {
        dealName: formData.dealName.trim(),
        dealType,
        discountValue,
        productId: formData.productId.map(String),
        startAt: new Date(formData.startAt).toISOString(),
        endAt: new Date(`${formData.endAt}T23:59:59`).toISOString(),
        isActive: Boolean(formData.isActive),
        showOnProductPage: Boolean(formData.showOnProductPage),
      };

      try {
        let res;
        if (editingDeal) {
          res = await api.put(`/admin/deals/${editingDeal._id}`, payload);
        } else {
          res = await api.post('/admin/deals', payload);
        }
        if (res?.error) {
          toast.error(res.message || 'Request failed');
          return;
        }
        toast.success(editingDeal ? 'Deal updated' : 'Deal created');
        closeModal();
        loadDealsData();
      } catch (err) {
        toast.error(err?.message || 'Something went wrong');
      }
    },
    [formData, editingDeal, closeModal, loadDealsData],
  );

  const runDeleteOne = async () => {
    if (!singleDeleteId) return;
    setSingleDeleting(true);
    try {
      const res = await api.delete(`/admin/deals/${singleDeleteId}`);
      if (res?.error) {
        toast.error(res.message || 'Delete failed');
        return;
      }
      toast.success('Deal deleted');
      setSingleDeleteId(null);
      clearSelection();
      loadDealsData();
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setSingleDeleting(false);
    }
  };

  const runBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      for (const id of ids) {
        const res = await api.delete(`/admin/deals/${id}`);
        if (res?.error) throw new Error(res.message || 'Delete failed');
      }
      toast.success(`${ids.length} deal(s) deleted`);
      setBulkDeleteOpen(false);
      clearSelection();
      loadDealsData();
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const runBulkSetActive = async (isActive) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkStatusWorking(true);
    try {
      for (const id of ids) {
        const deal = deals.find((d) => String(d._id) === id);
        if (!deal) continue;
        const res = await api.put(`/admin/deals/${id}`, buildUpdatePayload(deal, { isActive }));
        if (res?.error) throw new Error(res.message || 'Update failed');
      }
      toast.success(isActive ? 'Selected deals enabled' : 'Selected deals disabled');
      clearSelection();
      loadDealsData();
    } catch (err) {
      toast.error(err?.message || 'Bulk update failed');
    } finally {
      setBulkStatusWorking(false);
    }
  };

  return (
    <div className="admin-design-scope mx-auto max-w-[1600px] space-y-6 pb-12 font-sans text-slate-900">
      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.size} deal(s)?`}
        description="This permanently removes the selected deals. Products will be unlinked where applicable."
        confirmLabel="Delete deals"
        cancelLabel="Cancel"
        variant="danger"
        loading={bulkDeleting}
        onClose={() => !bulkDeleting && setBulkDeleteOpen(false)}
        onConfirm={runBulkDelete}
      />
      <ConfirmModal
        open={Boolean(singleDeleteId)}
        title="Delete this deal?"
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={singleDeleting}
        onClose={() => !singleDeleting && setSingleDeleteId(null)}
        onConfirm={runDeleteOne}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="admin-stat-card">
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
      <p className="text-xs text-slate-500">
        Live, scheduled, and expired counts reflect the current page. Total deals is the full catalog count from the server.
      </p>

      <div className="admin-card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Deals</h1>
            <p className="mt-1 text-sm text-slate-500">Promotional pricing, bundles, and time-bound offers.</p>
          </div>
          <AdminButton variant="primary" size="md" onClick={() => openModal()}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add deal
          </AdminButton>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 pt-3 sm:px-6" role="tablist">
          {DEAL_STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.id}
              className={`relative mb-[-1px] rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                statusTab === tab.id
                  ? 'border border-b-0 border-slate-200 bg-white text-slate-900'
                  : 'border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              } `}
              onClick={() => {
                setStatusTab(tab.id);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6">
          <div className="relative min-w-[200px] flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search deals"
              value={searchTerm}
              onChange={(e) => {
                handleSearchChange(e);
                setPage(1);
              }}
              onKeyDown={onSearchKeyDown}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
              aria-label="Search deals"
            />
          </div>

          <div className="relative flex items-center gap-2">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-3" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="h-10 w-full min-w-[180px] appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-colors focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20 sm:w-auto"
              aria-label="Sort deals"
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
                <p className="text-xs text-slate-600">
                  Use status tabs for Active, Scheduled, Expired, or Inactive. Sort and search apply to the loaded
                  list.
                </p>
                <AdminButton
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setStatusTab('All');
                    setPage(1);
                    setSearchTerm('');
                    setFilterMenuOpen(false);
                  }}
                >
                  Reset filters
                </AdminButton>
              </div>
            ) : null}
          </div>

          <AdminButton variant="ghost" size="md" className="sm:ml-auto" onClick={() => loadDealsData()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </AdminButton>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-sky-200/60 bg-gradient-to-r from-sky-50/90 to-blue-50/50 px-4 py-3 sm:px-6">
            <LayoutGrid className="h-4 w-4 text-sky-700" />
            <span className="text-sm font-semibold text-sky-900">{selectedIds.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <AdminButton variant="secondary" size="sm" onClick={() => firstSelectedDeal && openModal(firstSelectedDeal)} disabled={!firstSelectedDeal}>
                <Pencil className="h-4 w-4" />
                Edit
              </AdminButton>
              <AdminButton
                variant="secondary"
                size="sm"
                onClick={() => runBulkSetActive(true)}
                disabled={bulkStatusWorking}
              >
                <ToggleRight className="h-4 w-4" />
                Enable
              </AdminButton>
              <AdminButton
                variant="secondary"
                size="sm"
                onClick={() => runBulkSetActive(false)}
                disabled={bulkStatusWorking}
              >
                <ToggleLeft className="h-4 w-4" />
                Disable
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

        <div className="hidden md:block">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-10 px-4 py-3" />
                  <th className="w-14 px-2 py-3" />
                  <th className="min-w-[180px] px-4 py-3">Deal</th>
                  <th className="min-w-[140px] px-4 py-3">Offer</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Listing</th>
                  <th className="min-w-[120px] px-4 py-3">Start</th>
                  <th className="min-w-[120px] px-4 py-3">End</th>
                  <th className="w-[100px] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <AdminTableSkeleton rows={10} cols={9} />
              ) : (
                <tbody className="divide-y divide-slate-100">
                  {sortedDeals.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                            <Tag className="h-7 w-7 text-slate-400" />
                          </div>
                          <p className="text-base font-medium text-slate-800">No deals found</p>
                          <p className="mt-1 text-sm text-slate-500">Try another tab, search, or add a deal.</p>
                          {searchTerm ? (
                            <AdminButton variant="secondary" size="sm" className="mt-4" onClick={() => setSearchTerm('')}>
                              Clear search
                            </AdminButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedDeals.map((deal) => {
                      const sel = selectedIds.has(String(deal._id));
                      const thumb = getDealThumbnailUrl(deal);
                      const sched = getScheduleMeta(deal);
                      const applies = Array.isArray(deal.productId)
                        ? deal.productId
                            .map((p) => (typeof p === 'object' && p ? p.name : p))
                            .filter(Boolean)
                            .join(', ')
                        : '—';
                      return (
                        <tr
                          key={deal._id}
                          className={`group transition-colors ${sel ? 'bg-sky-50/80' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-[#2878b3] focus:ring-[#2878b3]/30"
                              checked={sel}
                              onChange={() => toggleRow(deal._id)}
                              aria-label={`Select ${deal.dealName}`}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <div className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              {thumb ? (
                                <img src={thumb} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <ImageIcon className="h-5 w-5 text-slate-300" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="max-w-[220px] px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openModal(deal)}
                              className="text-left font-semibold text-slate-900 hover:text-[#2878b3] transition-colors"
                            >
                              {deal.dealName || '—'}
                            </button>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500" title={applies}>
                              {applies}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Percent className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="font-medium text-slate-800">{formatDiscountLine(deal)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <AdminBadge variant={sched.variant}>{sched.label}</AdminBadge>
                          </td>
                          <td className="px-4 py-3">
                            <AdminBadge variant={deal.isActive !== false ? 'success' : 'muted'}>
                              {deal.isActive !== false ? 'Active' : 'Inactive'}
                            </AdminBadge>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {deal.startAt
                              ? new Date(deal.startAt).toLocaleDateString(undefined, {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {deal.endAt
                              ? new Date(deal.endAt).toLocaleDateString(undefined, {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openModal(deal)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#2878b3]"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSingleDeleteId(String(deal._id))}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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

        <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : sortedDeals.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No deals found.</div>
          ) : (
            sortedDeals.map((deal) => {
              const sel = selectedIds.has(String(deal._id));
              const thumb = getDealThumbnailUrl(deal);
              const sched = getScheduleMeta(deal);
              return (
                <div
                  key={deal._id}
                  className={`flex gap-3 rounded-xl border p-3 ${sel ? 'border-sky-300 bg-sky-50/50' : 'border-slate-200 bg-white'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2878b3]"
                    checked={sel}
                    onChange={() => toggleRow(deal._id)}
                  />
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openModal(deal)} className="font-semibold text-slate-900 hover:text-[#2878b3] text-left">
                      {deal.dealName}
                    </button>
                    <p className="mt-1 text-xs text-slate-500">{formatDiscountLine(deal)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <AdminBadge variant={sched.variant}>{sched.label}</AdminBadge>
                      <AdminBadge variant={deal.isActive !== false ? 'success' : 'muted'}>
                        {deal.isActive !== false ? 'Active' : 'Inactive'}
                      </AdminBadge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {deal.startAt ? new Date(deal.startAt).toLocaleDateString() : '—'} →{' '}
                      {deal.endAt ? new Date(deal.endAt).toLocaleDateString() : '—'}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <AdminButton variant="secondary" size="sm" onClick={() => openModal(deal)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </AdminButton>
                      <AdminButton variant="danger" size="sm" onClick={() => setSingleDeleteId(String(deal._id))}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </AdminButton>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:px-6">
          <p className="text-sm text-slate-500">
            Page <span className="font-medium text-slate-800">{page}</span> of{' '}
            <span className="font-medium text-slate-800">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((x) => x - 1)}>
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

      {showModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{editingDeal ? 'Edit deal' : 'Add deal'}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="deal-name">
                  Deal name
                </label>
                <input
                  id="deal-name"
                  type="text"
                  name="dealName"
                  value={formData.dealName}
                  onChange={handleInputChange}
                  required
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
                  placeholder="e.g. Summer fruit sale"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="deal-type">
                    Type
                  </label>
                  <select
                    id="deal-type"
                    name="dealType"
                    value={formData.dealType}
                    onChange={handleInputChange}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
                  >
                    <option value="PERCENT">Percentage off</option>
                    <option value="FLAT">Fixed amount off</option>
                    <option value="BOGO">Buy one get one</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="deal-discount">
                    Discount value
                  </label>
                  <input
                    id="deal-discount"
                    type="number"
                    name="discountValue"
                    value={formData.discountValue}
                    onChange={handleInputChange}
                    required={formData.dealType !== 'BOGO'}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
                    placeholder={formData.dealType === 'BOGO' ? '0 for BOGO' : 'e.g. 15'}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Products</label>
                <Select
                  isMulti
                  options={productOptions}
                  value={productOptions.filter((opt) => formData.productId.includes(opt.value))}
                  onChange={(selected) => {
                    setFormData((prev) => ({
                      ...prev,
                      productId: selected.map((opt) => opt.value),
                    }));
                  }}
                  placeholder="Select products…"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: 40,
                      borderRadius: 8,
                      borderColor: '#e2e8f0',
                      fontSize: 14,
                    }),
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="deal-start">
                    Start date
                  </label>
                  <input
                    id="deal-start"
                    type="date"
                    name="startAt"
                    value={formData.startAt}
                    onChange={handleInputChange}
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="deal-end">
                    End date
                  </label>
                  <input
                    id="deal-end"
                    type="date"
                    name="endAt"
                    value={formData.endAt}
                    onChange={handleInputChange}
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#2878b3] focus:outline-none focus:ring-2 focus:ring-[#2878b3]/20"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="rounded border-slate-300 text-[#2878b3]" />
                  Deal is active
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="showOnProductPage"
                    checked={formData.showOnProductPage}
                    onChange={handleInputChange}
                    className="rounded border-slate-300 text-[#2878b3]"
                  />
                  Show on product page
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <AdminButton type="button" variant="secondary" size="md" onClick={closeModal}>
                  Cancel
                </AdminButton>
                <AdminButton type="submit" variant="primary" size="md">
                  {editingDeal ? 'Save changes' : 'Create deal'}
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminDeals;
