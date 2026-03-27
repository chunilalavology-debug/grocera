import React, { useEffect, useMemo, useState } from "react";
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

  const loadContacts = async (pageNo = 1, status = statusFilter) => {
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
  };

  useEffect(() => {
    loadContacts(1, statusFilter);
    setPage(1);
  }, [statusFilter]);

  const statusPillClass = useMemo(
    () => ({
      new: "bg-blue-100 text-blue-700",
      read: "bg-slate-100 text-slate-700",
      responded: "bg-green-100 text-green-700",
      closed: "bg-red-100 text-red-700",
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Contacts</h1>
          <p className="text-sm text-slate-500">Customer contact form submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadContacts(page, statusFilter)}
            className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-14 text-center text-slate-500 text-sm">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="py-14 text-center text-slate-500 text-sm">No contacts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{c.name || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.email || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-[260px] truncate">{c.subject || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${statusPillClass[c.status] || "bg-slate-100 text-slate-700"}`}>
                        {c.status || "new"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(c.createdAt).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetails(c._id)}
                        className="text-sm font-semibold text-[#3090cf] hover:text-[#246fa0] underline underline-offset-2"
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

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
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
            className="px-3 py-1.5 rounded border border-slate-300 bg-white disabled:opacity-50"
          >
            Prev
          </button>
          <span>
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
            className="px-3 py-1.5 rounded border border-slate-300 bg-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[9999] bg-black/45 p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{selected.subject || "Contact Details"}</h3>
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