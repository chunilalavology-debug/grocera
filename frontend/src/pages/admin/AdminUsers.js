import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  Shield,
  Trash2,
  Pencil,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useSearch } from '../../hooks/usePerformance';
import { AdminBadge, AdminButton, ConfirmModal, AdminTableSkeleton } from '../../components/admin/ui';
import AdminUserAvatar from '../../components/AdminUserAvatar';

const LIMIT = 15;

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'name-asc', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'oldest', label: 'Oldest first' },
];

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'admin', label: 'Admin' },
  { value: 'co-admin', label: 'Co-admin' },
  { value: 'moderator', label: 'Moderator' },
];

function isStaffRole(role) {
  return ['admin', 'co-admin', 'moderator'].includes(role);
}

function roleColumnLabel(role) {
  return isStaffRole(role) ? 'Admin' : 'User';
}

function displayName(u) {
  if (u?.name && String(u.name).trim()) return String(u.name).trim();
  const fn = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
  if (fn) return fn;
  return u?.email || 'User';
}

function currentUserId(cu) {
  if (!cu) return null;
  return String(cu.id || cu._id || '');
}

export default function AdminUsers() {
  const { isAdmin, user: currentUser } = useAuth();
  const meId = currentUserId(currentUser);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { searchTerm, debouncedSearchTerm, handleSearchChange, setSearchTerm } = useSearch('', 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ activeUsers: 0, inactiveUsers: 0, adminUsers: 0 });
  const [totalUsers, setTotalUsers] = useState(0);

  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState('newest');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const selectWrapRef = useRef(null);
  const masterCheckboxRef = useRef(null);
  const forcedSearchRef = useRef(null);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState('customer');
  const [editSaving, setEditSaving] = useState(false);

  const sortedUsers = useMemo(() => {
    const arr = [...users];
    arr.sort((a, b) => {
      const na = displayName(a).toLowerCase();
      const nb = displayName(b).toLowerCase();
      switch (sortKey) {
        case 'name-asc':
          return na.localeCompare(nb);
        case 'name-desc':
          return nb.localeCompare(na);
        case 'oldest':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });
    return arr;
  }, [users, sortKey]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const searchParam =
        forcedSearchRef.current !== null ? forcedSearchRef.current : debouncedSearchTerm.trim();
      if (forcedSearchRef.current !== null) forcedSearchRef.current = null;

      const params = {
        page,
        limit: LIMIT,
        role: filterRole,
        search: searchParam || undefined,
        status: filterStatus === 'all' ? undefined : filterStatus,
      };

      const res = await api.get('/admin/users', { params });
      const list = Array.isArray(res?.users) ? res.users : [];
      setUsers(list);
      setTotalPages(res?.totalPages || 1);
      setTotalUsers(res?.totalUsers ?? list.length);
      const st = res?.stats || {};
      setStats({
        activeUsers: st.activeUsers ?? 0,
        inactiveUsers: st.inactiveUsers ?? 0,
        adminUsers: st.adminUsers ?? 0,
      });
    } catch (err) {
      toast.error(err?.message || 'Failed to load users');
      setUsers([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, filterRole, filterStatus]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearchTerm, filterRole, filterStatus]);

  useEffect(() => {
    const onDoc = (e) => {
      if (selectWrapRef.current && !selectWrapRef.current.contains(e.target)) setSelectMenuOpen(false);
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const idsOnPage = useMemo(
    () => sortedUsers.map((u) => u._id).filter(Boolean).map(String),
    [sortedUsers]
  );
  const selectableIds = useMemo(
    () => idsOnPage.filter((id) => id !== meId),
    [idsOnPage, meId]
  );

  const allOnPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = selectableIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const toggleRow = (id) => {
    const sid = String(id);
    if (sid === meId) return;
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
      selectableIds.forEach((id) => next.add(id));
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
        selectableIds.forEach((id) => next.delete(id));
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
    else loadUsers();
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditRole(u.role || 'customer');
  };

  const saveEditRole = async () => {
    if (!editUser?._id) return;
    setEditSaving(true);
    try {
      await api.patch(`/admin/users/${editUser._id}/role`, { role: editRole });
      toast.success('Role updated');
      setEditUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err?.message || 'Failed to update role');
    } finally {
      setEditSaving(false);
    }
  };

  const runDeleteOne = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await api.delete(`/admin/user/delete/${deleteTarget}`);
      if (res?.status) {
        toast.success('User removed');
        setDeleteTarget(null);
        clearSelection();
        loadUsers();
      } else {
        toast.error(res?.message || 'Delete failed');
      }
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleUserStatus = async (u) => {
    if (!u?._id || String(u._id) === meId) return;
    try {
      const res = await api.put(`/admin/user/status/${u._id}`, {});
      if (res?.status) {
        toast.success(u.isActive ? 'User deactivated' : 'User activated');
        loadUsers();
      } else {
        toast.error(res?.message || 'Update failed');
      }
    } catch (err) {
      toast.error(err?.message || 'Update failed');
    }
  };

  const runBulkDelete = async () => {
    const ids = [...selectedIds].map(String).filter((id) => id !== meId);
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      for (const id of ids) {
        await api.delete(`/admin/user/delete/${id}`);
      }
      toast.success('Selected users removed');
      setBulkDeleteOpen(false);
      clearSelection();
      loadUsers();
    } catch (err) {
      toast.error(err?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkSetActive = async (activate) => {
    const ids = [...selectedIds].map(String).filter((id) => id !== meId);
    if (!ids.length) return;
    setBulkStatusLoading(true);
    try {
      for (const id of ids) {
        const u = users.find((x) => String(x._id) === id);
        if (!u) continue;
        if (activate && !u.isActive) {
          await api.put(`/admin/user/status/${id}`, {});
        } else if (!activate && u.isActive) {
          await api.put(`/admin/user/status/${id}`, {});
        }
      }
      toast.success(activate ? 'Users activated' : 'Users deactivated');
      clearSelection();
      loadUsers();
    } catch (err) {
      toast.error(err?.message || 'Bulk update failed');
    } finally {
      setBulkStatusLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total (this view)',
      val: totalUsers,
      icon: Users,
      accent: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: 'Active',
      val: stats.activeUsers,
      icon: UserCheck,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Inactive',
      val: stats.inactiveUsers,
      icon: UserX,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Admin roles',
      val: stats.adminUsers,
      icon: Shield,
      accent: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-design-scope mx-auto max-w-[1600px] space-y-6 pb-12 font-sans text-slate-900">
      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.size} user(s)?`}
        description="This removes selected accounts from the list (soft delete). This cannot be undone from the dashboard."
        confirmLabel="Delete users"
        cancelLabel="Cancel"
        variant="danger"
        loading={bulkDeleting}
        onClose={() => !bulkDeleting && setBulkDeleteOpen(false)}
        onConfirm={runBulkDelete}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this user?"
        description="The account will be marked as deleted and removed from the active user list."
        confirmLabel="Delete user"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteLoading}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={runDeleteOne}
      />

      {editUser ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => !editSaving && setEditUser(null)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Edit user</h2>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => !editSaving && setEditUser(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">{displayName(editUser)}</p>
            <p className="text-xs text-slate-500">{editUser.email}</p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AdminButton variant="ghost" size="md" onClick={() => setEditUser(null)} disabled={editSaving}>
                Cancel
              </AdminButton>
              <AdminButton variant="primary" size="md" onClick={saveEditRole} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save role'}
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}

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

      <div className="admin-card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Users</h1>
            <p className="mt-1 text-sm text-slate-500">Manage accounts, roles, and access status.</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg bg-[#008060] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#006e52] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008060] focus-visible:ring-offset-2"
            onClick={() =>
              toast('New customers sign up on the storefront. To promote someone to admin, change their role after they have an account.', {
                icon: 'ℹ️',
              })
            }
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add user
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6">
          <div className="relative min-w-[200px] flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => {
                handleSearchChange(e);
                setPage(1);
              }}
              onKeyDown={onSearchKeyDown}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
              aria-label="Search users"
            />
          </div>

          <div className="relative flex items-center gap-2">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-3" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="h-10 w-full min-w-[180px] appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-colors focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20 sm:w-auto"
              aria-label="Sort users"
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
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
                <select
                  value={filterRole}
                  onChange={(e) => {
                    setFilterRole(e.target.value);
                    setPage(1);
                  }}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                >
                  <option value="all">All roles</option>
                  <option value="customer">User</option>
                  <option value="admin">Admin</option>
                </select>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <AdminButton
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setFilterRole('all');
                    setFilterStatus('all');
                    setPage(1);
                    setFilterMenuOpen(false);
                  }}
                >
                  Reset filters
                </AdminButton>
              </div>
            ) : null}
          </div>

          <AdminButton
            variant="ghost"
            size="md"
            className="sm:ml-auto"
            onClick={() => loadUsers()}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </AdminButton>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200/60 bg-gradient-to-r from-emerald-50/90 to-teal-50/50 px-4 py-3 sm:px-6">
            <LayoutGrid className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-900">{selectedIds.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <AdminButton
                variant="secondary"
                size="sm"
                disabled={bulkStatusLoading}
                onClick={() => bulkSetActive(true)}
              >
                <UserCheck className="h-4 w-4" />
                Activate
              </AdminButton>
              <AdminButton
                variant="secondary"
                size="sm"
                disabled={bulkStatusLoading}
                onClick={() => bulkSetActive(false)}
              >
                <UserX className="h-4 w-4" />
                Deactivate
              </AdminButton>
              <AdminButton variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkStatusLoading}>
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
              className="h-4 w-4 rounded border-slate-300 text-[#008060] focus:ring-[#008060]/30"
              checked={allOnPageSelected && selectableIds.length > 0}
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
              <ul
                className="absolute left-0 top-full z-40 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                role="menu"
              >
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
                  <th className="min-w-[160px] px-4 py-3">Name</th>
                  <th className="min-w-[200px] px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="w-[100px] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <AdminTableSkeleton rows={10} cols={8} />
              ) : (
                <tbody className="divide-y divide-slate-100">
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                            <Users className="h-7 w-7 text-slate-400" />
                          </div>
                          <p className="text-base font-medium text-slate-800">No users found</p>
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
                    sortedUsers.map((u) => {
                      const id = String(u._id);
                      const sel = selectedIds.has(id);
                      const isSelf = id === meId;
                      const name = displayName(u);
                      return (
                        <tr
                          key={id}
                          className={`group transition-colors ${sel ? 'bg-sky-50/80' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              disabled={isSelf}
                              className="h-4 w-4 rounded border-slate-300 text-[#008060] focus:ring-[#008060]/30 disabled:opacity-40"
                              checked={sel}
                              onChange={() => toggleRow(u._id)}
                              aria-label={`Select ${name}`}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <div className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              <AdminUserAvatar
                                user={{ ...u, name: displayName(u) }}
                                className="flex h-full w-full !min-h-0 items-center justify-center !rounded-lg border-0 text-sm font-semibold"
                              />
                            </div>
                          </td>
                          <td className="max-w-[220px] px-4 py-3">
                            <span className="font-semibold text-slate-900">{name}</span>
                            {isSelf ? (
                              <p className="mt-0.5 text-xs font-medium text-[#008060]">You</p>
                            ) : null}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={u.email}>
                            {u.email}
                          </td>
                          <td className="px-4 py-3">
                            <AdminBadge variant={isStaffRole(u.role) ? 'info' : 'neutral'}>
                              {roleColumnLabel(u.role)}
                            </AdminBadge>
                          </td>
                          <td className="px-4 py-3">
                            <AdminBadge variant={u.isActive ? 'success' : 'muted'}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </AdminBadge>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isSelf ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#008060]"
                                  title="Edit role"
                                  onClick={() => openEdit(u)}
                                >
                                  <Pencil className="h-4 w-4" strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title="Delete"
                                  onClick={() => setDeleteTarget(id)}
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                                </button>
                              </div>
                            )}
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
          ) : sortedUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No users found.</div>
          ) : (
            sortedUsers.map((u) => {
              const id = String(u._id);
              const sel = selectedIds.has(id);
              const isSelf = id === meId;
              const name = displayName(u);
              return (
                <div
                  key={id}
                  className={`flex gap-3 rounded-xl border p-3 ${sel ? 'border-sky-300 bg-sky-50/50' : 'border-slate-200 bg-white'}`}
                >
                  <input
                    type="checkbox"
                    disabled={isSelf}
                    className="mt-2 h-5 w-5 shrink-0 rounded border-slate-300 text-[#008060]"
                    checked={sel}
                    onChange={() => toggleRow(u._id)}
                  />
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <AdminUserAvatar
                      user={{ ...u, name: displayName(u) }}
                      className="flex h-full w-full !min-h-0 items-center justify-center !rounded-lg border-0 text-sm font-semibold"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{u.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AdminBadge variant={isStaffRole(u.role) ? 'info' : 'neutral'}>{roleColumnLabel(u.role)}</AdminBadge>
                      <AdminBadge variant={u.isActive ? 'success' : 'muted'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </AdminBadge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </p>
                    {!isSelf ? (
                      <div className="mt-3 flex gap-2">
                        <AdminButton variant="secondary" size="sm" className="min-h-[40px]" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </AdminButton>
                        <AdminButton variant="danger" size="sm" className="min-h-[40px]" onClick={() => setDeleteTarget(id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </AdminButton>
                        <AdminButton variant="ghost" size="sm" className="min-h-[40px]" onClick={() => toggleUserStatus(u)}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </AdminButton>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[#008060]">Your account</p>
                    )}
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
            <AdminButton variant="secondary" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((x) => x + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
