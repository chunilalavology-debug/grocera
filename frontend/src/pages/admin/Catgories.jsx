import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Layers, Tag, Loader2 } from 'lucide-react';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';

const CategoryDashboard = () => {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState({ name: '', status: 'Active' });
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCategories = async () => {
        try {
            const { data } = await api.get("/admin/getCategories", {
                params: { search: searchQuery, page: 1, limit: 50 }
            });
            if (data) {
                const formatted = data.map(cat => ({
                    id: cat._id,
                    name: cat.name,
                    count: cat.productCount || 0, // Agar backend se count aa raha ho
                    status: cat.isActive ? "Active" : "Inactive"
                }));
                setCategories(formatted);
            }
        } catch (error) {
            toast.error("Failed to fetch categories");
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [searchQuery]);

    const handleOpenModal = (category = { name: '', status: 'Active' }, editMode = false) => {
        setCurrentCategory(category);
        setIsEditing(editMode);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This action cannot be undone.")) return;
        try {
            const { success } = await api.delete(`/admin/deleteCategory/${id}`);
            if (success) {
                toast.success("Category removed");
                fetchCategories();
            }
        } catch (error) {
            toast.error(error?.message || "Delete failed");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = { name: currentCategory.name };

            if (isEditing) {
                await api.put(`/admin/updateCategory/${currentCategory.id}`, payload);
                toast.success("Updated successfully");
            } else {
                await api.post("/admin/createCategory", payload);
                toast.success("Category created");
            }
            setIsModalOpen(false);
            fetchCategories();
        } catch (err) {
            toast.error(err?.message || "Operation failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-[#f1f5f9] p-4 md:p-10 font-sans">
            <Toaster position="top-center" />

            {/* --- Header Section --- */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-white">
                <div className="flex items-center gap-5">
                    <div className="bg-blue-600 p-4 rounded-3xl shadow-lg shadow-blue-200 text-white">
                        <Layers size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Category Lab</h1>
                        <p className="text-slate-400 font-bold text-sm tracking-widest uppercase mt-1 italic">Zippyyy Control Panel</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="w-full md:w-auto bg-blue-600 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3 transform active:scale-95"
                >
                    <Plus size={22} strokeWidth={3} /> NEW CATEGORY
                </button>
            </div>

            {/* --- Search Box --- */}
            <div className="max-w-7xl mx-auto mb-10">
                <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={24} />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-16 pr-8 py-5 bg-white border-2 border-transparent focus:border-blue-500 rounded-[2rem] shadow-sm outline-none font-bold text-slate-600 text-lg transition-all"
                    />
                </div>
            </div>

            {/* --- Categories Grid --- */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {categories.map((cat) => (
                    <div key={cat.id} className="group bg-white rounded-[3rem] p-8 border border-white shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-10">
                            <div className={`p-5 rounded-[1.5rem] ${cat.status === 'Active' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Tag size={28} />
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border-2 ${cat.status === 'Active' ? 'border-blue-100 text-blue-600 bg-blue-50' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>
                                {cat.status}
                            </span>
                        </div>

                        <h3 className="font-black text-2xl text-slate-800 mb-2">{cat.name}</h3>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-tighter mb-8 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            {cat.count} Products linked
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleOpenModal(cat, true)}
                                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-blue-600 transition-all flex justify-center items-center gap-2 shadow-lg"
                            >
                                <Edit2 size={16} strokeWidth={3} /> EDIT
                            </button>
                            <button
                                onClick={() => handleDelete(cat.id)}
                                className="px-5 py-4 bg-red-50 text-red-500 rounded-2xl font-black hover:bg-red-500 hover:text-white transition-all border border-red-100"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* --- FIXED MODAL (Z-INDEX FIX) --- */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[99999]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        onClick={() => !loading && setIsModalOpen(false)}
                    ></div>

                    {/* Modal Content */}
                    <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl relative z-10 animate-in fade-in zoom-in slide-in-from-bottom-10 duration-300 border border-white">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                    <Edit2 size={20} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                    {isEditing ? 'Update Category' : 'New Category'}
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="bg-slate-100 p-2 rounded-full text-slate-400 hover:bg-red-500 hover:text-white transition-all"
                            >
                                <X size={24} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Category Title</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={currentCategory.name}
                                    onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 focus:bg-white rounded-2xl px-6 py-5 outline-none transition-all font-bold text-xl text-slate-700"
                                    placeholder="Enter category name..."
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Visibility Status</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {['Active', 'Inactive'].map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setCurrentCategory({ ...currentCategory, status })}
                                            className={`py-5 rounded-2xl font-black transition-all border-4 ${currentCategory.status === status ? 'bg-blue-600 border-blue-100 text-white shadow-xl shadow-blue-100' : 'bg-white border-slate-50 text-slate-300 hover:border-slate-100'}`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl hover:bg-blue-600 shadow-2xl transition-all uppercase tracking-[0.2em] mt-4 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : (isEditing ? 'Save Changes' : 'Publish Now')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryDashboard;