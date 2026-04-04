import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Assuming useSearch is available for filtering
import './AdminDeals.css';
import api from '../../services/api';
import Select from "react-select";


// --- Mock/Placeholder Imports ---
// Replace these with your actual component paths if needed
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

/**
 * Renders a single row in the deals table.
 */
const DealTableRow = React.memo(({ deal, onEdit, onDelete }) => {
    const getStatus = useCallback(() => {
        const now = new Date();
        const start = deal.startAt ? new Date(deal.startAt) : null;
        const end = deal.endAt ? new Date(deal.endAt) : null;
        if (end && end < now) return { text: '❌ Expired', class: 'expired' };
        if (start && start > now) return { text: '📅 Scheduled', class: 'scheduled' };
        if (deal.isActive) return { text: '✅ Active', class: 'active' };
        return { text: '⏸ Inactive', class: 'inactive' };
    }, [deal.startAt, deal.endAt, deal.isActive]);

    const status = getStatus();

    return (
        <div className="admin-deals-table-row">
            {/* 1. Name */}
            <div className="col-name" data-label="Deal Name">
                <span className="deal-name">{deal.dealName}</span>
            </div>

            {/* 2. Type & Discount */}
            <div className="col-type-discount" data-label="Type/Discount">
                <span className={`deal-type-badge ${String(deal.dealType || '').toLowerCase().replace(/\s/g, '-')}`}>{deal.dealType}</span>
                <span className="deal-discount">{deal.discountValue}</span>
            </div>

            {/* 3. Applies To */}
            <div className="col-applies-to" data-label="Applies To">
                {Array.isArray(deal.productId) && deal.productId.length > 0
                    ? deal.productId.map(p => (typeof p === 'object' && p ? p.name : p)).filter(Boolean).join(', ')
                    : '—'}
            </div>



            {/* 4. Start Time */}
            <div className="col-start-time" data-label="Starts">
                {new Date(deal.startAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                })}
            </div>

            {/* 5. End Time */}
            <div className="col-end-time" data-label="Ends">
                <span className={`end-date-text ${status.class === 'expired' ? 'expired-text' : ''}`}>
                    {new Date(deal.endAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    })}

                </span>
            </div>

            {/* 6. Status */}
            <div className="col-status" data-label="Status">
                <span className={`deals-status-badge ${deal.isActive ? 'active' : 'inactive'}`}>
                    {deal.isActive ? '✅ Active' : '⏸ Inactive'}
                </span>
            </div>



            {/* 7. Actions */}
            <div className="col-actions" data-label="Actions">
                <button
                    className="btn-edit"
                    onClick={() => onEdit(deal)}
                >
                    ✏ Edit
                </button>
                <button
                    className="btn-delete"
                    onClick={() => onDelete(deal._id)}
                >
                    🗑 Delete
                </button>
            </div>
        </div>
    );
});

DealTableRow.displayName = 'DealTableRow';

const FORM_TO_API_DEAL_TYPE = { PERCENT: 'Percentage', FLAT: 'Fixed', BOGO: 'BOGO' };
const API_TO_FORM_DEAL_TYPE = { Percentage: 'PERCENT', Fixed: 'FLAT', BOGO: 'BOGO' };

function AdminDeals() {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDeal, setEditingDeal] = useState(null);
    const [filterStatus, setFilterStatus] = useState('All');
    const [page, setPage] = useState(1);
    const [limit] = useState(10);

    const { searchTerm, debouncedSearchTerm, handleSearchChange } = useSearch('', 300);
    const [productOptions, setProductOptions] = useState([]);
    // Initial Form State
    const initialFormData = useMemo(() => ({
        dealName: '',
        dealType: 'PERCENT',     // PERCENT | FLAT | BOGO
        discountValue: '',
        productId: [],           // array of product ids
        startAt: '',
        endAt: '',
        perUserLimit: '',
        isActive: true,
        showOnProductPage: true,
    }), []);

    const [formData, setFormData] = useState(initialFormData);
    const [total, setTotal] = useState(0);

    const loadDealsData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/deals', {
                params: {
                    pageNo: page,
                    size: limit,
                    search: debouncedSearchTerm?.trim() || undefined,
                    status: filterStatus !== 'All' ? filterStatus : undefined,
                },
            });
            if (res?.error) {
                setDeals([]);
                setTotal(0);
                return;
            }
            const inner = res?.data;
            setDeals(inner?.list || []);
            setTotal(inner?.total ?? 0);
        } catch {
            setDeals([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [page, limit, debouncedSearchTerm, filterStatus]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const prodsRes = await api.get('/admin/products', {
                    params: { page: 1, limit: 500, search: '', category: '' },
                });
                const list = Array.isArray(prodsRes?.data) ? prodsRes.data : [];
                setProductOptions(
                    list.map((p) => ({
                        value: String(p._id),
                        label: p.name || String(p._id),
                    }))
                );
            } catch {
                setProductOptions([]);
            }
        };
        fetchProducts();
    }, []);

    useEffect(() => {
        loadDealsData();
    }, [loadDealsData]);

    // --- Stats Calculation ---
    const dealStats = useMemo(() => {
        const now = new Date();
        return {
            total: deals.length,
            active: deals.filter(d =>
                new Date(d.startAt) <= now && new Date(d.endAt) >= now
            ).length,
            scheduled: deals.filter(d =>
                new Date(d.startAt) > now
            ).length,
            expired: deals.filter(d =>
                new Date(d.endAt) < now
            ).length,
        };
    }, [deals]);


    // --- Modal Handlers ---
    const openModal = useCallback((deal = null) => {
        if (deal) {
            setEditingDeal(deal);

            setFormData({
                dealName: deal.dealName || '',
                dealType: API_TO_FORM_DEAL_TYPE[deal.dealType] || 'PERCENT',
                discountValue: deal.discountValue ?? '',
                productId: Array.isArray(deal.productId)
                    ? deal.productId.map((p) =>
                          typeof p === 'object' && p != null ? String(p._id) : String(p)
                      )
                    : [],
                startAt: deal.startAt
                    ? deal.startAt.substring(0, 10)
                    : '',
                endAt: deal.endAt
                    ? deal.endAt.substring(0, 10)
                    : '',
                perUserLimit: deal.perUserLimit || '',
                isActive: deal.isActive ?? true,
                showOnProductPage: deal.showOnProductPage ?? true,
            });
        } else {
            setEditingDeal(null);
            setFormData(initialFormData);
        }

        setShowModal(true);
    }, [initialFormData]);


    const closeModal = useCallback(() => {
        setShowModal(false);
        setEditingDeal(null);
        setFormData(initialFormData);
    }, [initialFormData]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }, []);

    // --- CRUD Handlers (Placeholders) ---
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        const dealType = FORM_TO_API_DEAL_TYPE[formData.dealType];
        const isBogo = formData.dealType === 'BOGO';
        const discountValue = isBogo ? 0 : Number(formData.discountValue);
        if (!formData.productId?.length) {
            alert('Select at least one product');
            return;
        }
        if (!isBogo && (!Number.isFinite(discountValue) || discountValue <= 0)) {
            alert('Enter a valid discount value');
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
                alert(res.message || 'Request failed');
                return;
            }
            alert(editingDeal ? 'Deal updated successfully' : 'Deal created successfully');
            closeModal();
            loadDealsData();
        } catch (err) {
            console.error(err);
            alert('Something went wrong');
        }
    }, [formData, editingDeal, closeModal, loadDealsData]);


    const handleDelete = useCallback(async (dealId) => {
        if (!window.confirm("Are you sure you want to delete this deal?")) return;

        try {
            const res = await api.delete(`/admin/deals/${dealId}`);

            if (res?.error) {
                alert(res.message || "Delete failed");
                return;
            }

            alert("Deal deleted successfully");
            loadDealsData();

        } catch (err) {
            console.error(err);
            alert("Something went wrong");
        }
    }, [loadDealsData]);


    // --- Render ---

    if (loading) {
        return (
            <div className="admin-deals-container">
                <div className="loading-section">
                    <div className="loading-spinner"></div>
                    <p>Loading deals...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-deals-container">
            {/* --- Header & Add Button --- */}
            <div className="admin-deals-header">
                <div className="header-content">
                    <h1>🤝 Deals Management</h1>
                    <p>Manage promotional campaigns, limited-time offers, and bulk discounts.</p>
                </div>
                <button className="btn-primary" onClick={() => openModal()}>
                    ➕ Create New Deal
                </button>
            </div>

            {/* --- Stats --- */}
            <div className="deals-stats">
                <div className="deals-stat-card">
                    <div className="deals-stat-icon">📊</div>
                    <div className="deals-stat-info">
                        <span className="deals-stat-number">{dealStats.total}</span>
                        <span className="deals-stat-label">Total Deals</span>
                    </div>
                </div>
                <div className="deals-stat-card">
                    <div className="deals-stat-icon">✅</div>
                    <div className="deals-stat-info">
                        <span className="deals-stat-number">{dealStats.active}</span>
                        <span className="deals-stat-label">Currently Active</span>
                    </div>
                </div>
                <div className="deals-stat-card">
                    <div className="deals-stat-icon">📅</div>
                    <div className="deals-stat-info">
                        <span className="deals-stat-number">{dealStats.scheduled}</span>
                        <span className="deals-stat-label">Scheduled</span>
                    </div>
                </div>
                <div className="deals-stat-card">
                    <div className="deals-stat-icon">❌</div>
                    <div className="deals-stat-info">
                        <span className="deals-stat-number">{dealStats.expired}</span>
                        <span className="deals-stat-label">Expired</span>
                    </div>
                </div>
            </div>

            {/* --- Filters & Search --- */}
            <div className="deals-filters">
                <div className="deals-search-section">
                    <div className="deals-search-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by deal name..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="search-input"
                        />
                    </div>
                </div>

                <div className="status-filters">
                    {['All', 'Active', 'Expired'].map(status => (
                        <button
                            key={status}
                            className={`status-btn ${filterStatus === status ? 'active' : ''}`}
                            onClick={() => {
                                setFilterStatus(status)
                                setPage(1);
                            }}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- Deals Table --- */}
            {deals.length === 0 ? (
                <div className="no-deals">
                    <div className="no-deals-icon">🤝</div>
                    <h3>No deals found</h3>
                    <p>Adjust your filters or create a new deal.</p>
                </div>
            ) : (
                <div className="deals-table">
                    <div className="admin-deals-table-header">
                        <div className="col-name">Deal Name</div>
                        <div className="col-type-discount">Type / Discount</div>
                        <div className="col-applies-to">Applies To</div>
                        <div className="col-start-time">Starts</div>
                        <div className="col-end-time">Ends</div>
                        <div className="col-status">Status</div>
                        <div className="col-actions">Actions</div>
                    </div>

                    {deals.map(deal => (
                        <DealTableRow
                            key={deal._id}
                            deal={deal}
                            onEdit={openModal}
                            onDelete={handleDelete}
                        />
                    ))}
                    {/* --- Pagination --- */}
                    <div className="pagination">
                        <button
                            className="page-btn"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            ⬅ Prev
                        </button>

                        <span className="page-info">
                            Page <strong>{page}</strong> of <strong>{Math.max(1, Math.ceil(total / limit) || 1)}</strong>
                        </span>

                        <button
                            className="page-btn"
                            disabled={page >= Math.max(1, Math.ceil(total / limit) || 1)}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next ➡
                        </button>
                    </div>


                </div>
            )}

            {/* --- Modal Component (Voucher Form Style) --- */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="deals-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingDeal ? '✏ Edit Deal' : '➕ Create New Deal'}</h2>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="deal-form">
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label htmlFor="name">Deal Name *</label>
                                    <input type="text" id="name" name="dealName" value={formData.dealName} onChange={handleInputChange} required placeholder="E.g., Summer Fruit Sale" />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="type">Deal Type *</label>
                                    <select
                                        id="type"
                                        name="dealType"
                                        value={formData.dealType}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="PERCENT">Percentage Off</option>
                                        <option value="FLAT">Fixed Price Reduction</option>
                                        <option value="BOGO">Buy One Get One</option>
                                    </select>

                                </div>

                                <div className="form-group">
                                    <label htmlFor="discount">Discount/Mechanism *</label>
                                    <input type="number" id="discount" name="discountValue" value={formData.discountValue} onChange={handleInputChange} required={formData.dealType !== 'BOGO'} placeholder="E.g., 15% or $5 off (0 for BOGO)" />
                                </div>

                                <div className="form-group">
                                    <label>Applies To *</label>
                                    <Select
                                        isMulti
                                        options={productOptions}
                                        value={productOptions.filter(opt =>
                                            formData.productId.includes(opt.value)
                                        )}
                                        onChange={(selected) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                productId: selected.map(opt => opt.value)
                                            }));
                                        }}
                                        placeholder="Select products..."
                                        classNamePrefix="react-select"
                                    />
                                </div>



                                <div className="form-group">
                                    <label htmlFor="startTime">Start Date</label>
                                    <input type="date" id="startTime" name="startAt" value={formData.startAt} onChange={handleInputChange} required />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="endTime">End Date</label>
                                    <input type="date" id="endTime" name="endAt" value={formData.endAt} onChange={handleInputChange} required />
                                </div>

                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingDeal ? '💾 Update Deal' : '➕ Create Deal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDeals;