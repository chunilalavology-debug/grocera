import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  ChevronDown,
  Trash2,
  MoreVertical,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { useSearch } from '../../hooks/usePerformance';
import './AdminMessages.css';

const PAGE_SIZE = 25;

function formatListDate(dateString) {
  if (!dateString) return '—';
  const dt = new Date(dateString);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function snippetFromMessage(text, max = 80) {
  if (!text) return '—';
  const oneLine = String(text).replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

const TABS = [
  { id: 'all', label: 'All', filter: 'all', folder: 'inbox', countKey: 'total' },
  { id: 'new', label: 'New', filter: 'new', folder: 'inbox', countKey: 'unread' },
  { id: 'replied', label: 'Replied', filter: 'replied', folder: 'inbox', countKey: 'replied' },
  { id: 'resolved', label: 'Resolved', filter: 'resolved', folder: 'inbox', countKey: 'resolved' },
  { id: 'trash', label: 'Trash', filter: 'all', folder: 'trash', countKey: 'trash' },
];

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminMessages() {
  const navigate = useNavigate();
  const { searchTerm, debouncedSearchTerm, handleSearchChange, setSearchTerm } = useSearch('', 200);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [folder, setFolder] = useState('inbox');
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [rowBusyId, setRowBusyId] = useState(null);
  const [searchKick, setSearchKick] = useState(0);
  const pendingImmediateSearchRef = useRef(null);

  const selectWrapRef = useRef(null);
  const moreWrapRef = useRef(null);
  const masterCheckboxRef = useRef(null);
  const prevFilterKeyRef = useRef(null);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        q: debouncedSearchTerm.trim(),
        filter,
        folder,
        dateFrom,
        dateTo,
        sortOrder,
        searchKick,
      }),
    [debouncedSearchTerm, filter, folder, dateFrom, dateTo, sortOrder, searchKick]
  );

  useLayoutEffect(() => {
    if (prevFilterKeyRef.current === null) {
      prevFilterKeyRef.current = filterKey;
      return;
    }
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      flushSync(() => setPage(1));
    }
  }, [filterKey]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get('/admin/messages/stats');
      if (response?.success) {
        setStats(response.stats || {});
      }
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = debouncedSearchTerm.trim();
        const immediate = pendingImmediateSearchRef.current;
        if (immediate != null) {
          pendingImmediateSearchRef.current = null;
          q = String(immediate).trim();
        }
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          status: folder === 'trash' ? 'all' : filter,
          folder,
          sortOrder,
        });
        if (q) params.set('search', q);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const response = await api.get(`/admin/messages?${params.toString()}`);
        if (cancelled) return;

        if (response && response.success) {
          setMessages(Array.isArray(response.data) ? response.data : []);
          setTotalPages(Math.max(1, response.totalPages || 1));
          setTotalCount(response.totalMessages ?? response.total ?? 0);
          if (typeof response.currentPage === 'number' && response.currentPage !== page) {
            setPage(response.currentPage);
          }
        } else {
          setMessages([]);
          if (response?.message) toast.error(String(response.message));
        }
      } catch (e) {
        if (!cancelled) {
          setMessages([]);
          toast.error(e?.message || 'Could not load messages');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, filterKey, debouncedSearchTerm, filter, folder, dateFrom, dateTo, sortOrder]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filterKey]);

  const buildParams = useCallback(
    (forPage) => {
      const params = new URLSearchParams({
        page: String(forPage),
        limit: String(PAGE_SIZE),
        status: folder === 'trash' ? 'all' : filter,
        folder,
        sortOrder,
      });
      const qt = debouncedSearchTerm.trim();
      if (qt) params.set('search', qt);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return params;
    },
    [debouncedSearchTerm, filter, folder, dateFrom, dateTo, sortOrder]
  );

  const refresh = useCallback(async () => {
    await loadStats();
    setLoading(true);
    try {
      const response = await api.get(`/admin/messages?${buildParams(page).toString()}`);
      if (response?.success) {
        setMessages(Array.isArray(response.data) ? response.data : []);
        setTotalPages(Math.max(1, response.totalPages || 1));
        setTotalCount(response.totalMessages ?? response.total ?? 0);
        if (typeof response.currentPage === 'number') setPage(response.currentPage);
      }
    } catch (e) {
      toast.error(e?.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }, [buildParams, page, loadStats]);

  useEffect(() => {
    const onDoc = (e) => {
      if (selectWrapRef.current && !selectWrapRef.current.contains(e.target)) setSelectMenuOpen(false);
      if (moreWrapRef.current && !moreWrapRef.current.contains(e.target)) setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pageIds = messages.map((m) => String(m._id));
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (el) el.indeterminate = somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

  const clearSelection = () => setSelectedIds(new Set());

  const selectByFilter = (mode) => {
    const next = new Set();
    for (const m of messages) {
      const id = String(m._id);
      const unread = m.status === 'new';
      if (mode === 'all') next.add(id);
      else if (mode === 'read' && !unread) next.add(id);
      else if (mode === 'unread' && unread) next.add(id);
    }
    setSelectedIds(next);
    setSelectMenuOpen(false);
  };

  const toggleMasterCheckbox = () => {
    if (allPageSelected) clearSelection();
    else setSelectedIds(new Set(pageIds));
  };

  const toggleSelectOne = (id, e) => {
    e.stopPropagation();
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const afterMutation = useCallback(async () => {
    setSelectedIds(new Set());
    await loadStats();
    try {
      const response = await api.get(`/admin/messages?${buildParams(page).toString()}`);
      if (response?.success) {
        setMessages(Array.isArray(response.data) ? response.data : []);
        setTotalPages(Math.max(1, response.totalPages || 1));
        setTotalCount(response.totalMessages ?? response.total ?? 0);
        if (typeof response.currentPage === 'number') setPage(response.currentPage);
      }
    } catch {
      /* ignore; list effect will retry on next navigation */
    }
  }, [buildParams, page, loadStats]);

  const moveToTrashSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(`Move ${ids.length} message(s) to Trash? You can restore them later.`)) return;
    setDeleting(true);
    try {
      const res = await api.post('/admin/messages/delete-many', { ids });
      if (res?.success) {
        const n = res.movedCount ?? res.deletedCount ?? ids.length;
        toast.success(`Moved ${n} message(s) to Trash`);
        await afterMutation();
      } else if (res?.message) toast.error(String(res.message));
    } catch (e) {
      toast.error(e?.message || 'Could not move to Trash');
    } finally {
      setDeleting(false);
    }
  };

  const restoreSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setRestoring(true);
    try {
      const res = await api.post('/admin/messages/restore-many', { ids });
      if (res?.success) {
        toast.success(`Restored ${res.restoredCount ?? ids.length} message(s)`);
        await afterMutation();
      } else if (res?.message) toast.error(String(res.message));
    } catch (e) {
      toast.error(e?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const permanentDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(`Permanently delete ${ids.length} message(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await api.post('/admin/messages/permanent-delete-many', { ids });
      if (res?.success) {
        toast.success(`Permanently deleted ${res.deletedCount ?? ids.length} message(s)`);
        await afterMutation();
      } else if (res?.message) toast.error(String(res.message));
    } catch (e) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const moveOneToTrash = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Move this message to Trash?')) return;
    setRowBusyId(String(id));
    try {
      const res = await api.delete(`/admin/messages/${encodeURIComponent(String(id))}`);
      if (res?.success) {
        toast.success('Moved to Trash');
        await afterMutation();
      } else if (res?.message) toast.error(String(res.message));
    } catch (err) {
      toast.error(err?.message || 'Could not delete');
    } finally {
      setRowBusyId(null);
    }
  };

  const restoreOne = async (id, e) => {
    e.stopPropagation();
    setRowBusyId(String(id));
    try {
      const res = await api.post('/admin/messages/restore-many', { ids: [String(id)] });
      if (res?.success) {
        toast.success('Restored');
        await afterMutation();
      } else if (res?.message) toast.error(String(res.message));
    } catch (err) {
      toast.error(err?.message || 'Restore failed');
    } finally {
      setRowBusyId(null);
    }
  };

  const deleteOneForever = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Permanently delete this message?')) return;
    setRowBusyId(String(id));
    try {
      const res = await api.post('/admin/messages/permanent-delete-many', { ids: [String(id)] });
      if (res?.success) {
        toast.success('Deleted permanently');
        await afterMutation();
      } else if (res?.message) toast.error(String(res.message));
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setRowBusyId(null);
    }
  };

  const openRow = (msg) => {
    const id = msg?._id != null ? String(msg._id) : '';
    if (!id) {
      toast.error('Invalid message id');
      return;
    }
    navigate(`/admin/messages/${id}`);
  };

  const setTab = (tab) => {
    setActiveTab(tab.id);
    setFilter(tab.filter);
    setFolder(tab.folder || 'inbox');
    clearSelection();
    setSelectMenuOpen(false);
  };

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pendingImmediateSearchRef.current = searchTerm;
      setSearchKick((k) => k + 1);
    }
  };

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === '7d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      setDateFrom(toYmd(start));
      setDateTo(toYmd(now));
    } else if (preset === '30d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      setDateFrom(toYmd(start));
      setDateTo(toYmd(now));
    }
  };

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + messages.length, totalCount);

  const tabCount = (key) => {
    const n = stats[key];
    return typeof n === 'number' ? n : 0;
  };

  const searchBar = (
    <div className="admin-msg-inbox__search-row">
      <div className="admin-msg-inbox__search-wrap">
        <Search size={22} className="admin-msg-inbox__search-icon" aria-hidden />
        <input
          type="search"
          className="admin-msg-inbox__search-input"
          placeholder="Search name, email, or message…"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={onSearchKeyDown}
          aria-label="Search messages"
          disabled={loading && messages.length === 0}
          enterKeyHint="search"
        />
        <span
          className="admin-msg-inbox__filter-icon"
          title="Searches name, email, phone, subject, and message body (server-side)."
        >
          <ListFilter size={20} />
        </span>
      </div>
    </div>
  );

  const toolbarFilters = (
    <div className="admin-msg-table__filters">
      <label className="admin-msg-table__filter">
        <span className="admin-msg-table__filter-label">Date range</span>
        <select
          className="admin-msg-table__select"
          value={datePreset}
          onChange={(e) => applyDatePreset(e.target.value)}
          aria-label="Date preset"
        >
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {datePreset === 'custom' ? (
        <>
          <label className="admin-msg-table__filter">
            <span className="admin-msg-table__filter-label">From</span>
            <input
              type="date"
              className="admin-msg-table__date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDatePreset('custom');
              }}
            />
          </label>
          <label className="admin-msg-table__filter">
            <span className="admin-msg-table__filter-label">To</span>
            <input
              type="date"
              className="admin-msg-table__date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset('custom');
              }}
            />
          </label>
        </>
      ) : null}
      <label className="admin-msg-table__filter">
        <span className="admin-msg-table__filter-label">Order</span>
        <select
          className="admin-msg-table__select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          aria-label="Sort by date"
        >
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </label>
    </div>
  );

  if (loading && messages.length === 0) {
    return (
      <div className="admin-msg-inbox admin-design-scope font-sans">
        <Toaster position="top-right" />
        {searchBar}
        <div className="admin-msg-inbox__tabs" role="tablist">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" className="admin-msg-inbox__tab" disabled>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="admin-msg-inbox__loading">
          <div className="admin-msg-inbox__spinner" />
          <p>Loading messages…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-msg-inbox admin-design-scope font-sans">
      <Toaster position="top-right" />
      {searchBar}

      <div className="admin-msg-inbox__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`admin-msg-inbox__tab ${activeTab === tab.id ? 'admin-msg-inbox__tab--active' : ''}`}
            onClick={() => setTab(tab)}
          >
            {tab.label}
            {tab.countKey ? <span className="admin-msg-inbox__tab-count">{tabCount(tab.countKey)}</span> : null}
          </button>
        ))}
      </div>

      {toolbarFilters}

      <div className="admin-msg-inbox__toolbar admin-msg-table__toolbar">
        <div className="admin-msg-inbox__toolbar-left">
          <div className="admin-msg-inbox__select-cluster" ref={selectWrapRef}>
            <input
              ref={masterCheckboxRef}
              type="checkbox"
              className="admin-msg-inbox__checkbox"
              checked={allPageSelected}
              onChange={toggleMasterCheckbox}
              aria-label="Select all on this page"
            />
            <button
              type="button"
              className="admin-msg-inbox__select-arrow"
              aria-expanded={selectMenuOpen}
              aria-haspopup="menu"
              aria-label="Selection options"
              onClick={(e) => {
                e.stopPropagation();
                setSelectMenuOpen((o) => !o);
                setMoreMenuOpen(false);
              }}
            >
              <ChevronDown size={18} />
            </button>
            {selectMenuOpen ? (
              <ul className="admin-msg-inbox__select-menu" role="menu">
                <li>
                  <button type="button" role="menuitem" onClick={() => selectByFilter('all')}>
                    All
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      clearSelection();
                      setSelectMenuOpen(false);
                    }}
                  >
                    None
                  </button>
                </li>
                <li>
                  <button type="button" role="menuitem" onClick={() => selectByFilter('read')}>
                    Read
                  </button>
                </li>
                <li>
                  <button type="button" role="menuitem" onClick={() => selectByFilter('unread')}>
                    Unread
                  </button>
                </li>
              </ul>
            ) : null}
          </div>

          <button
            type="button"
            className="admin-msg-inbox__toolbar-btn"
            title="Refresh"
            disabled={loading}
            aria-label="Refresh"
            onClick={() => {
              void refresh();
            }}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          {selectedIds.size > 0 && folder === 'inbox' ? (
            <button
              type="button"
              className="admin-msg-inbox__toolbar-btn admin-msg-inbox__toolbar-btn--delete"
              title="Move to Trash"
              disabled={deleting}
              aria-label={`Move ${selectedIds.size} selected to Trash`}
              onClick={() => void moveToTrashSelected()}
            >
              <Trash2 size={20} />
            </button>
          ) : null}
          {selectedIds.size > 0 && folder === 'trash' ? (
            <>
              <button
                type="button"
                className="admin-msg-inbox__toolbar-btn"
                title="Restore"
                disabled={restoring}
                aria-label={`Restore ${selectedIds.size} selected`}
                onClick={() => void restoreSelected()}
              >
                <RotateCcw size={20} />
              </button>
              <button
                type="button"
                className="admin-msg-inbox__toolbar-btn admin-msg-inbox__toolbar-btn--delete"
                title="Delete forever"
                disabled={deleting}
                aria-label={`Permanently delete ${selectedIds.size} selected`}
                onClick={() => void permanentDeleteSelected()}
              >
                <Trash2 size={20} />
              </button>
            </>
          ) : null}

          <div className="admin-msg-inbox__more-wrap" ref={moreWrapRef}>
            <button
              type="button"
              className="admin-msg-inbox__toolbar-btn"
              aria-label="More"
              onClick={() => {
                setMoreMenuOpen((o) => !o);
                setSelectMenuOpen(false);
              }}
            >
              <MoreVertical size={20} />
            </button>
            {moreMenuOpen ? (
              <ul className="admin-msg-inbox__select-menu admin-msg-inbox__select-menu--narrow" role="menu">
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void refresh();
                      setMoreMenuOpen(false);
                    }}
                  >
                    Refresh list
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      clearSelection();
                      setMoreMenuOpen(false);
                    }}
                  >
                    Clear selection
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-msg-table__wrap">
        {messages.length === 0 ? (
          <div className="admin-msg-inbox__empty admin-msg-table__empty">
            <p>{debouncedSearchTerm.trim() ? 'No messages match your search or filters.' : 'No messages in this view.'}</p>
            {debouncedSearchTerm.trim() ? (
              <button type="button" className="admin-msg-inbox__link-btn" onClick={() => setSearchTerm('')}>
                Clear search
              </button>
            ) : null}
          </div>
        ) : (
          <table className="admin-msg-table admin-msg-table--desktop">
            <thead>
              <tr>
                <th className="admin-msg-table__th-check" scope="col" aria-label="Select" />
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col">Message</th>
                <th scope="col">Date</th>
                <th scope="col" className="admin-msg-table__th-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => {
                const id = String(msg._id);
                const busy = rowBusyId === id;
                const selected = selectedIds.has(id);
                return (
                  <tr
                    key={id}
                    tabIndex={0}
                    className={`admin-msg-table__row admin-msg-table__row--clickable ${selected ? 'admin-msg-table__row--selected' : ''} ${msg.status === 'new' ? 'admin-msg-table__row--unread' : ''}`}
                    onClick={() => {
                      if (!busy) openRow(msg);
                    }}
                    onKeyDown={(e) => {
                      if (busy) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openRow(msg);
                      }
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="admin-msg-inbox__checkbox"
                        checked={selected}
                        onChange={(e) => toggleSelectOne(id, e)}
                        aria-label={`Select ${msg.name || msg.email || 'message'}`}
                      />
                    </td>
                    <td className="admin-msg-table__cell-name">{msg.name || '—'}</td>
                    <td className="admin-msg-table__cell-email">{msg.email || '—'}</td>
                    <td className="admin-msg-table__cell-phone">{msg.phone || '—'}</td>
                    <td className="admin-msg-table__cell-msg">{snippetFromMessage(msg.message)}</td>
                    <td className="admin-msg-table__cell-date">{formatListDate(msg.createdAt)}</td>
                    <td className="admin-msg-table__cell-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="admin-msg-table__icon-btn"
                        title="View"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          openRow(msg);
                        }}
                      >
                        <Eye size={18} />
                      </button>
                      {folder === 'inbox' ? (
                        <button
                          type="button"
                          className="admin-msg-table__icon-btn admin-msg-table__icon-btn--danger"
                          title="Move to Trash"
                          disabled={busy || deleting}
                          onClick={(e) => void moveOneToTrash(id, e)}
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="admin-msg-table__icon-btn"
                            title="Restore"
                            disabled={busy || restoring}
                            onClick={(e) => void restoreOne(id, e)}
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button
                            type="button"
                            className="admin-msg-table__icon-btn admin-msg-table__icon-btn--danger"
                            title="Delete forever"
                            disabled={busy || deleting}
                            onClick={(e) => void deleteOneForever(id, e)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {messages.length > 0 ? (
        <div className="admin-msg-card-list" aria-label="Messages (mobile view)">
          {messages.map((msg) => {
            const id = String(msg._id);
            const busy = rowBusyId === id;
            const selected = selectedIds.has(id);
            return (
              <div
                key={`card-${id}`}
                className={`admin-msg-card ${msg.status === 'new' ? 'admin-msg-card--unread' : ''} ${selected ? 'admin-msg-card--selected' : ''}`}
              >
                <div className="admin-msg-card__top">
                  <input
                    type="checkbox"
                    className="admin-msg-inbox__checkbox"
                    checked={selected}
                    onChange={(e) => toggleSelectOne(id, e)}
                    aria-label={`Select ${msg.name || msg.email || 'message'}`}
                  />
                  <button
                    type="button"
                    className="admin-msg-card__main"
                    disabled={busy}
                    onClick={() => openRow(msg)}
                  >
                    <span className="admin-msg-card__name">{msg.name || '—'}</span>
                    <span className="admin-msg-card__snippet">{snippetFromMessage(msg.message)}</span>
                    <span className="admin-msg-card__meta">
                      {msg.email || '—'} · {formatListDate(msg.createdAt)}
                    </span>
                  </button>
                </div>
                <div className="admin-msg-card__actions">
                  <button
                    type="button"
                    className="admin-msg-table__icon-btn"
                    title="View"
                    disabled={busy}
                    onClick={() => openRow(msg)}
                  >
                    <Eye size={18} />
                  </button>
                  {folder === 'inbox' ? (
                    <button
                      type="button"
                      className="admin-msg-table__icon-btn admin-msg-table__icon-btn--danger"
                      title="Move to Trash"
                      disabled={busy || deleting}
                      onClick={(e) => void moveOneToTrash(id, e)}
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="admin-msg-table__icon-btn"
                        title="Restore"
                        disabled={busy || restoring}
                        onClick={(e) => void restoreOne(id, e)}
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button
                        type="button"
                        className="admin-msg-table__icon-btn admin-msg-table__icon-btn--danger"
                        title="Delete forever"
                        disabled={busy || deleting}
                        onClick={(e) => void deleteOneForever(id, e)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="admin-msg-inbox__pager-footer">
          <span className="admin-msg-inbox__pager-text">
            {rangeStart}–{rangeEnd} of {totalCount}
          </span>
          <div className="admin-msg-inbox__pager-btns">
            <button
              type="button"
              className="admin-msg-inbox__pager-btn"
              title="Previous page"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="admin-msg-inbox__pager-btn"
              title="Next page"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
      ) : totalCount > 0 ? (
        <div className="admin-msg-inbox__pager-footer">
          <span className="admin-msg-inbox__pager-text">
            {rangeStart}–{rangeEnd} of {totalCount}
          </span>
        </div>
      ) : null}
    </div>
  );
}
