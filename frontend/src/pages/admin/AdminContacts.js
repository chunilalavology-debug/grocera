import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["all", "new", "read", "responded", "closed"];

export default function AdminContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1, totalContacts: 0, currentPage: 1 });
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadContacts = useCallback(async (pageNo = 1, status = statusFilter) => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/contacts?page=${pageNo}&limit=20&status=${status}`);
      setContacts(res?.contacts || []);
      setMeta({
        totalPages: res?.totalPages || 1,
        totalContacts: res?.totalContacts || 0,
        currentPage: res?.currentPage || pageNo,
      });
    } catch (err) {
      toast.error(err?.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadContacts(1, statusFilter);
    setPage(1);
  }, [statusFilter, loadContacts]);

  const statusPillClass = useMemo(
    () => ({
      new: "admin-badge admin-badge--primary",
      read: "admin-badge",
      responded: "admin-badge",
      closed: "admin-badge",
    }),
    []
  );

  const openDetails = async (id) => {
    try {
      setDetailsLoading(true);
      const res = await api.get(`/admin/contacts/${id}`);
      setSelected(res?.contact || null);
      loadContacts(page, statusFilter);
    } catch (err) {
      toast.error(err?.message || "Failed to open contact");
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="admin-design-scope mx-auto max-w-[1600px] space-y-6 pb-12 font-sans text-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="admin-shell-title">Manage contacts</h1>
          <p className="admin-shell-desc">Customer contact form submissions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select min-w-[160px] max-w-[220px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadContacts(page, statusFilter)}
            className="admin-btn admin-btn--secondary"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-card-surface overflow-hidden">
        {loading ? (
          <div className="py-14 text-center text-sm text-slate-500">Loading contacts…</div>
        ) : contacts.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-500">No contacts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/95">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{c.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[260px] truncate">{c.subject || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={statusPillClass[c.status] || "admin-badge"}>
                        {c.status || "new"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{new Date(c.createdAt).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetails(c._id)}
                        className="text-sm font-semibold text-[var(--admin-primary)] hover:text-[var(--admin-primary-hover)] underline underline-offset-2"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>Total: {meta.totalContacts}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              loadContacts(next, statusFilter);
            }}
            className="admin-btn admin-btn--secondary disabled:opacity-50"
          >
            Prev
          </button>
          <span className="tabular-nums">
            {meta.currentPage} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              loadContacts(next, statusFilter);
            }}
            className="admin-btn admin-btn--secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4">
          <div className="admin-card-surface w-full max-w-3xl overflow-hidden shadow-lg shadow-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="admin-section-heading">{selected.subject || "Contact details"}</h3>
              <button type="button" className="text-2xl text-slate-400 hover:text-slate-600" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              {detailsLoading ? (
                <p className="text-sm text-slate-500">Loading details...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p><span className="font-semibold text-slate-700">Name:</span> {selected.name || "-"}</p>
                    <p><span className="font-semibold text-slate-700">Email:</span> {selected.email || "-"}</p>
                    <p><span className="font-semibold text-slate-700">Query Type:</span> {selected.queryType || "-"}</p>
                    <p><span className="font-semibold text-slate-700">Status:</span> {selected.status || "-"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700 mb-1">Message</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.message || "-"}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}