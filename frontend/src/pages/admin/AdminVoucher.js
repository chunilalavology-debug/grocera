import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import api from '../../services/api';
import toast, { Toaster } from "react-hot-toast";

const useSearch = (initial, delay) => {
    const [searchTerm, setSearchTerm] = useState(initial);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initial);

    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, delay);
        return () => { clearTimeout(handler); };
    }, [searchTerm, delay]);

    const handleSearchChange = (e) => setSearchTerm(e.target.value);
    return { searchTerm, debouncedSearchTerm, handleSearchChange };
};

const StatCard = ({ title, value, icon }) => (
    <div className="admin-stat-card">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-lg" aria-hidden>
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
        </div>
    </div>
);

const VoucherFormModal = ({ editingVoucher, showModal, closeModal, handleSubmit, formData, handleInputChange, isApplying }) => {
    if (!showModal) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">

            <div className="bg-white w-full max-w-2xl rounded-[24px] sm:rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in duration-300 flex flex-col max-h-[95vh]">
                <div className="px-6 sm:px-10 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                            {editingVoucher ? '✏️ Edit Campaign' : '🚀 Create New Voucher'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Campaign Configuration</p>
                    </div>
                    <button
                        onClick={closeModal}
                        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-white shadow-sm border border-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-all text-lg"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 sm:p-10 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Voucher Code</label>
                            <input
                                type="text" name="code" value={formData.code} onChange={handleInputChange} required
                                className="w-full p-3.5 sm:p-4 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700 uppercase"
                                placeholder="E.G. SAVE30"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Discount Type</label>
                            <div className="relative">
                                <select
                                    name="discountType" value={formData.discountType} onChange={handleInputChange}
                                    className="w-full p-3.5 sm:p-4 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                                >
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="fixed">Fixed Amount</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                            <input
                                type="text" name="description" value={formData.description || ''} onChange={handleInputChange}
                                className="w-full p-3.5 sm:p-4 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-medium text-slate-600"
                                placeholder="e.g. Special summer sale discount for loyal customers"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Value</label>
                            <input
                                type="number" name="discountValue" value={formData.discountValue} onChange={handleInputChange} required
                                className="w-full p-3.5 sm:p-4 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Max Cap Amount</label>
                            <input
                                type="number" name="maxDiscountAmount" value={formData.maxDiscountAmount} onChange={handleInputChange}
                                className="w-full p-3.5 sm:p-4 bg-blue-50/30 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                placeholder="Optional"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min Purchase</label>
                            <input
                                type="number" name="minPurchase" value={formData.minPurchase} onChange={handleInputChange}
                                className="w-full p-3.5 sm:p-4 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Limit</label>
                            <input
                                type="number" name="totalUsageLimit" value={formData.totalUsageLimit} onChange={handleInputChange}
                                className="w-full p-3.5 sm:p-4 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                placeholder="Unlimited"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry Date</label>
                            <input
                                type="date" name="endAt" value={formData.endAt} onChange={handleInputChange}
                                className="w-full p-3.5 sm:p-4 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                            />
                        </div>

                        <div className="flex items-center pt-4 md:pt-6">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative">
                                    <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="sr-only peer" />
                                    <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all shadow-inner"></div>
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-600">Active</span>
                            </label>
                        </div>
                    </div>

                    <div className="mt-10 mb-2 flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="w-full sm:flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]"
                        >
                            Discard
                        </button>
                        <button
                            type="submit"
                            disabled={isApplying}
                            className="w-full sm:flex-[2] py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50"
                        >
                            {isApplying ? 'Processing...' : (editingVoucher ? 'Update Changes' : 'Launch Campaign')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function AdminVoucher() {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [isApplying, setIsApplying] = useState(false);
    const [pageNo, setPageNo] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 8;

    const { searchTerm, debouncedSearchTerm, handleSearchChange } = useSearch('', 400);

    const [formData, setFormData] = useState({
        code: '', discountType: 'percentage', discountValue: 0,
        minPurchase: 0, totalUsageLimit: '', endAt: '',
        isActive: true, maxDiscountAmount: ''
    });

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const body = await api.get('/admin/vouchers', {
                params: { pageNo, size: pageSize, search: debouncedSearchTerm }
            });
            const inner = body?.data;
            setVouchers(inner?.list || []);
            setTotal(inner?.total ?? 0);
        } catch (error) {
            toast.error("Failed to sync database");
        } finally {
            setLoading(false);
        }
    }, [pageNo, debouncedSearchTerm]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsApplying(true);
        try {
            const payload = { ...formData, code: formData.code.toUpperCase() };
            const res = editingVoucher
                ? await api.put(`/admin/vouchers/${editingVoucher._id}`, payload)
                : await api.post('/admin/vouchers', payload);

            if (res?.error) {
                toast.error(res.message || "Process interrupted");
                return;
            }
            toast.success(editingVoucher ? "Database Updated" : "Campaign Launched");
            setShowModal(false);
            loadData();
        } catch (err) {
            toast.error("Process interrupted");
        } finally {
            setIsApplying(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Permanent deletion cannot be undone. Proceed?")) return;
        try {
            const res = await api.delete(`/admin/vouchers/${id}`);
            if (res?.error) {
                toast.error(res.message || "Deletion failed");
                return;
            }
            toast.success("Voucher Terminated");
            loadData();
        } catch (err) {
            toast.error("Deletion failed");
        }
    };

    const stats = useMemo(() => ({
        total: total,
        active: vouchers.filter(v => v.isActive).length,
        discounted: vouchers.reduce((acc, curr) => acc + (curr.usedCount || 0), 0)
    }), [vouchers, total]);

    return (
        <div className="admin-design-scope mx-auto max-w-[1600px] space-y-6 pb-12 font-sans text-slate-900">
            <Toaster position="top-right" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Total vouchers" value={stats.total} icon="🏷️" />
                <StatCard title="Live" value={stats.active} icon="⚡" />
                <StatCard title="Redemptions" value={stats.discounted} icon="🔥" />
            </div>

            <div className="admin-card-surface overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Vouchers</h1>
                        <p className="mt-1 text-sm text-slate-500">Promotion codes and usage limits.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setEditingVoucher(null); setFormData({ code: '', discountType: 'percentage', discountValue: 0, minPurchase: 0, totalUsageLimit: '', endAt: '', isActive: true, maxDiscountAmount: '' }); setShowModal(true); }}
                        className="admin-btn admin-btn--primary"
                    >
                        + Create voucher
                    </button>
                </div>

                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
                    <div className="relative max-w-xl">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                        <input
                            type="search"
                            placeholder="Search by code…"
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#008060] focus:outline-none focus:ring-2 focus:ring-[#008060]/20"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            aria-label="Search vouchers"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50/95">
                            <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Benefit</th>
                                <th className="px-4 py-3">Min. order</th>
                                <th className="px-4 py-3">Progress</th>
                                <th className="px-4 py-3">Expires</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="7" className="px-4 py-16 text-center text-sm text-slate-500">Loading…</td></tr>
                            ) : vouchers.length === 0 ? (
                                <tr><td colSpan="7" className="px-4 py-16 text-center text-sm text-slate-500">No vouchers yet.</td></tr>
                            ) : (
                                vouchers.map(v => (
                                    <tr key={v._id} className="hover:bg-slate-50/80">
                                        <td className="px-4 py-3">
                                            <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-xs font-semibold text-emerald-900">
                                                {v.code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">
                                                    {v.discountType === 'percentage' ? `${v.discountValue}%` : `$${v.discountValue}`}
                                                    <span className="ml-1 text-xs font-normal text-slate-500">off</span>
                                                </span>
                                                {v.maxDiscountAmount > 0 ? <span className="text-xs text-slate-500">Max ${v.maxDiscountAmount}</span> : null}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">${v.minPurchase || 0}</td>
                                        <td className="px-4 py-3">
                                            <div className="max-w-[120px] space-y-1">
                                                <div className="flex justify-between text-[10px] font-medium uppercase text-slate-400">
                                                    <span>{v.usedCount || 0}</span>
                                                    <span>{v.totalUsageLimit || '∞'}</span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className="h-full rounded-full bg-[var(--admin-primary)] transition-all duration-500"
                                                        style={{ width: `${v.totalUsageLimit ? Math.min(100, (v.usedCount / v.totalUsageLimit) * 100) : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {v.endAt ? new Date(v.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={v.isActive ? 'admin-badge admin-badge--primary' : 'admin-badge'}>
                                                {v.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingVoucher(v);
                                                        setFormData({
                                                            code: v.code, discountType: v.discountType, discountValue: v.discountValue,
                                                            minPurchase: v.minPurchase, totalUsageLimit: v.totalUsageLimit,
                                                            endAt: v.endAt ? v.endAt.substring(0, 10) : '',
                                                            isActive: v.isActive, maxDiscountAmount: v.maxDiscountAmount || ''
                                                        });
                                                        setShowModal(true);
                                                    }}
                                                    className="admin-btn admin-btn--secondary min-h-9 px-3 py-1.5 text-xs"
                                                >
                                                    Edit
                                                </button>
                                                <button type="button" onClick={() => handleDelete(v._id)} className="admin-btn admin-btn--danger min-h-9 px-3 py-1.5 text-xs">
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {total > pageSize ? (
                    <div className="flex flex-wrap justify-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                        <button
                            type="button"
                            disabled={pageNo === 1}
                            onClick={() => setPageNo(p => p - 1)}
                            className="admin-btn admin-btn--secondary disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            disabled={pageNo * pageSize >= total}
                            onClick={() => setPageNo(p => p + 1)}
                            className="admin-btn admin-btn--secondary disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                ) : null}
            </div>

            <VoucherFormModal
                showModal={showModal}
                editingVoucher={editingVoucher}
                closeModal={() => setShowModal(false)}
                handleSubmit={handleSubmit}
                formData={formData}
                isApplying={isApplying}
                handleInputChange={(e) => {
                    const { name, value, type, checked } = e.target;
                    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
                }}
            />
        </div>
    );
}