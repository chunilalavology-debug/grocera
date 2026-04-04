import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{title}</p>
                <p className="text-2xl font-black text-gray-900">{value}</p>
            </div>
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
        <div className="min-h-screen bg-[#F8F9FC] p-6 md:p-12 font-sans selection:bg-blue-100 selection:text-blue-600">
            <Toaster position="top-right" />

            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                    <div className="space-y-2">
                        <div className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                            Marketing Hub
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 tracking-tight">Vouchers</h1>
                        <p className="text-gray-500 font-medium">Manage and monitor your digital promotion assets.</p>
                    </div>
                    <button
                        onClick={() => { setEditingVoucher(null); setFormData({ code: '', discountType: 'percentage', discountValue: 0, minPurchase: 0, totalUsageLimit: '', endAt: '', isActive: true, maxDiscountAmount: '' }); setShowModal(true); }}
                        className="px-8 py-5 bg-gray-900 hover:bg-black text-white font-black rounded-3xl shadow-2xl shadow-gray-200 transition-all flex items-center gap-3 group active:scale-95"
                    >
                        <span className="text-2xl group-hover:rotate-90 transition-transform">+</span>
                        <span className="text-xs uppercase tracking-[0.15em]">Create Campaign</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    <StatCard title="Total Inventory" value={stats.total} icon="🏷️" color="bg-indigo-50 text-indigo-600" />
                    <StatCard title="Live Vouchers" value={stats.active} icon="⚡" color="bg-green-50 text-green-600" />
                    <StatCard title="Redemptions" value={stats.discounted} icon="🔥" color="bg-orange-50 text-orange-600" />
                </div>

                <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1 group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors">🔍</span>
                        <input
                            type="text"
                            placeholder="Find a voucher code..."
                            className="w-full pl-14 pr-6 py-5 bg-gray-50/50 rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 font-bold transition-all placeholder:text-gray-300"
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    {['Campaign Code', 'Benefit', 'Min. Order', 'Progress', 'Expires', 'Status', ''].map((h) => (
                                        <th key={h} className="py-7 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan="7" className="py-32 text-center text-sm font-black text-gray-300 animate-pulse uppercase tracking-[0.3em]">Syncing Data...</td></tr>
                                ) : vouchers.length === 0 ? (
                                    <tr><td colSpan="7" className="py-32 text-center text-sm font-black text-gray-300 uppercase tracking-[0.3em]">Zero Assets Found</td></tr>
                                ) : (
                                    vouchers.map(v => (
                                        <tr key={v._id} className="group hover:bg-gray-50/30 transition-colors">
                                            <td className="py-7 px-8">
                                                <div className="inline-flex px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs tracking-wider shadow-sm border border-blue-100/50 group-hover:scale-105 transition-transform">
                                                    {v.code}
                                                </div>
                                            </td>
                                            <td className="py-7 px-8">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-gray-900 text-lg">
                                                        {v.discountType === 'percentage' ? `${v.discountValue}%` : `$${v.discountValue}`}
                                                        <span className="ml-1 text-[10px] text-gray-400 uppercase">Off</span>
                                                    </span>
                                                    {v.maxDiscountAmount > 0 && <span className="text-[10px] font-bold text-blue-500/70 uppercase">Max $ {v.maxDiscountAmount}</span>}
                                                </div>
                                            </td>
                                            <td className="py-7 px-8 font-black text-gray-500 text-sm">$ {v.minPurchase || 0}</td>
                                            <td className="py-7 px-8">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase">
                                                        <span>{v.usedCount || 0} used</span>
                                                        <span>{v.totalUsageLimit || '∞'}</span>
                                                    </div>
                                                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${(v.usedCount / v.totalUsageLimit) > 0.8 ? 'bg-orange-400' : 'bg-blue-500'}`}
                                                            style={{ width: `${v.totalUsageLimit ? (v.usedCount / v.totalUsageLimit) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-7 px-8">
                                                <span className="text-xs font-black text-gray-400">
                                                    {v.endAt ? new Date(v.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '∞'}
                                                </span>
                                            </td>
                                            <td className="py-7 px-8">
                                                <div className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${v.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                                    {v.isActive ? '• Online' : '• Offline'}
                                                </div>
                                            </td>
                                            <td className="py-7 px-8 text-right">
                                                <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => {
                                                        setEditingVoucher(v);
                                                        setFormData({
                                                            code: v.code, discountType: v.discountType, discountValue: v.discountValue,
                                                            minPurchase: v.minPurchase, totalUsageLimit: v.totalUsageLimit,
                                                            endAt: v.endAt ? v.endAt.substring(0, 10) : '',
                                                            isActive: v.isActive, maxDiscountAmount: v.maxDiscountAmount || ''
                                                        });
                                                        setShowModal(true);
                                                    }} className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all">✏️</button>
                                                    <button onClick={() => handleDelete(v._id)} className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {total > pageSize && (
                        <div className="p-8 bg-gray-50/30 flex justify-center gap-4">
                            <button
                                disabled={pageNo === 1} onClick={() => setPageNo(p => p - 1)}
                                className="px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 hover:bg-gray-50 transition-all"
                            >
                                Previous
                            </button>
                            <button
                                disabled={pageNo * pageSize >= total} onClick={() => setPageNo(p => p + 1)}
                                className="px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 hover:bg-gray-50 transition-all"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
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