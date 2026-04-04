import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearch } from '../../hooks/usePerformance';
import toast, { Toaster } from 'react-hot-toast';
import api from '../../services/api';
import {
  Edit2, Trash2, Plus, Search,
  Package, CheckCircle, XCircle, DollarSign,
  ChevronLeft, ChevronRight
} from 'lucide-react';

// Optimized Sub-component
const ProductTableRow = React.memo(({ product, onEdit, onDelete, calculateProfit }) => {
  const profit = calculateProfit(product.price, product.cost);
  const isHighProfit = profit !== 'N/A' && parseFloat(profit) > 20;
  const orderCount = Number(product.orderCount ?? product.timesOrdered ?? product.salesCount ?? 0) || 0;
  const showsHot = orderCount > 5;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
      <td className="py-4 px-4">
        <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border shadow-sm">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <Package className="text-gray-400" size={20} />
          )}
        </div>
      </td>

      {/* Product Name & Details */}
      <td className="py-4 px-4">
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 leading-tight">{product.name}</span>

          {/* UNIT - Name ke bilkul niche */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 mt-0.5 bg-green-50 w-fit px-1.5 rounded">
            Per {product.unit || 'piece'}
          </span>

          <div className="text-xs text-gray-400 truncate max-w-[180px] mt-1 italic">
            {product.description}
          </div>
        </div>
      </td>

      <td className="py-4 px-4 text-sm text-gray-600">{product.category || '–'}</td>

      <td className="py-4 px-4 font-semibold text-gray-800">${product.price}</td>

      <td className="py-4 px-4 text-gray-500 text-sm">${product.cost || 0}</td>

      <td className="py-4 px-4">
        <span className={`px-2 py-0.5 rounded text-[11px] font-black ${isHighProfit ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {profit === 'N/A' ? 'N/A' : `${profit}%`}
        </span>
      </td>

      <td className="py-4 px-4 text-center">
        <span className="font-mono bg-gray-50 border border-gray-200 px-2 py-1 rounded text-xs font-bold text-gray-700">
          {product.quantity || 0}
        </span>
      </td>

      <td className="py-4 px-4 text-center">
        <span className={`font-mono px-2 py-0.5 rounded text-[11px] font-bold ${showsHot ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-600'}`} title={showsHot ? 'Shows Hot badge on storefront' : 'Hot when > 5'}>
          {orderCount}
        </span>
      </td>

      <td className="py-4 px-4">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${product.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {product.inStock ? <CheckCircle /> : <XCircle />}
          {product.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </td>

      <td className="py-4 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(product)}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
            title="Edit Product"
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => onDelete(product._id)}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
            title="Delete Product"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
});

const ProductMobileCard = React.memo(({ product, onEdit, onDelete, calculateProfit }) => {
  const profit = calculateProfit(product.price, product.cost);
  const orderCount = Number(product.orderCount ?? product.timesOrdered ?? product.salesCount ?? 0) || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border shrink-0">
            {product.image ? (
              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="text-gray-400" size={20} />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{product.name}</p>
            <p className="text-xs text-gray-500 truncate">{product.category || '–'}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${product.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {product.inStock ? 'In Stock' : 'Out'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-500">Price:</span> <span className="font-semibold text-gray-800">${product.price || 0}</span></div>
        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-500">Cost:</span> <span className="font-semibold text-gray-800">${product.cost || 0}</span></div>
        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-500">Profit:</span> <span className="font-semibold text-gray-800">{profit === 'N/A' ? 'N/A' : `${profit}%`}</span></div>
        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-500">Qty:</span> <span className="font-semibold text-gray-800">{product.quantity || 0}</span></div>
        <div className="bg-gray-50 rounded-lg p-2 col-span-2"><span className="text-gray-500">Orders:</span> <span className="font-semibold text-gray-800">{orderCount}</span></div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => onEdit(product)} className="flex-1 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold">
          Edit
        </button>
        <button onClick={() => onDelete(product._id)} className="flex-1 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm font-semibold">
          Delete
        </button>
      </div>
    </div>
  );
});

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const selectedCategory = 'All';
  const { searchTerm, debouncedSearchTerm, handleSearchChange } = useSearch('', 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const [formData, setFormData] = useState({
    name: '', price: '', category: 'Daily Essentials', description: '',
    image: '', inStock: true, cost: '', quantity: '0', orderCount: '',
    salePrice: ''
  });

  const [showQuickModal, setShowQuickModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [fileLoader, setFileLoader] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const [importingCsv, setImportingCsv] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const csvInputRef = useRef(null);

  const [productStats, setProductStats] = useState({ total: 0, inStock: 0, outOfStock: 0, totalValue: 0 });

  const categories = [
    'All',
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
    'Turkish Drinks'
  ];


  // Data Loading
  const loadProductsData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/products", {
        params: { page, limit, search: debouncedSearchTerm || "", category: selectedCategory === "All" ? "" : selectedCategory }
      });
      setProducts(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setProductStats({
        total: res.pagination?.total || 0,
        inStock: res.stats?.inStock || 0,
        outOfStock: res.stats?.outOfStock || 0,
        totalValue: res.stats?.totalValue || 0,
      });
    } catch (err) {
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, selectedCategory]);

  useEffect(() => { loadProductsData(); }, [loadProductsData]);

  const calculateProfit = useCallback((price, cost) => {
    const p = parseFloat(price) || 0;
    const c = parseFloat(cost) || 0;
    if (p === 0) return '0.0';
    if (c === 0) return 'N/A';
    return (((p - c) / c) * 100).toFixed(1);
  }, []);

  const handleExcelUpload = async () => {
    if (!excelFile) {
      setUploadResult({ error: "Please select an Excel file" });
      return;
    }

    const formData = new FormData();
    formData.append("file", excelFile);

    try {
      setFileLoader(true);
      setUploadResult(null);

      const res = await api.post(
        `/admin/uploadBulkExcelProducts`, formData);

      const data = await res;

      if (data.error) {
        setUploadResult({
          error: data.message || "Upload failed",
        });
        return;
      }

      setUploadResult({
        successCount: data.successCount,
        failedCount: data.failedCount,
        failedRows: data.failedRows || [],
      });
    } catch (err) {
      console.error(err);
      setUploadResult({
        error: "Something went wrong while uploading",
      });
    } finally {
      setFileLoader(false);
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
      toast.success('Products CSV exported');
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
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/admin/products/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response?.success) {
        toast.success(`Imported ${response.importedCount || 0} products`);
        if (response.failedCount > 0) toast.error(`${response.failedCount} rows failed`);
        loadProductsData();
      } else {
        toast.error(response?.message || 'CSV import failed');
      }
    } catch (err) {
      toast.error(err?.message || 'CSV import failed');
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const openModal = useCallback((product = null) => {
    if (product) {
      setEditingProduct(product);
      const orderCount = product.orderCount ?? product.timesOrdered ?? product.salesCount ?? '';
      setFormData({
        name: product.name,
        price: product.price != null ? String(product.price) : '',
        salePrice: product.salePrice != null ? String(product.salePrice) : '',
        category: product.category,
        description: product.description,
        image: product.image || '',
        inStock: product.inStock,
        cost: product.cost != null ? String(product.cost) : '',
        quantity: product.quantity?.toString() || '',
        orderCount: orderCount !== '' && orderCount != null ? String(orderCount) : ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        price: '',
        salePrice: '',
        category: 'Daily Essentials',
        description: '',
        image: '',
        inStock: true,
        cost: '',
        quantity: '',
        orderCount: ''
      });
    }
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      salePrice: '',
      category: 'Daily Essentials',
      description: '',
      image: '',
      inStock: true,
      cost: '',
      quantity: '',
      orderCount: ''
    });
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      if (name === 'quantity') {
        const qty = parseInt(value) || 0;
        if (qty === 0) {
          newData.inStock = false;
        } else if (qty > 0 && !newData.inStock) {
          newData.inStock = true;
        }
      }

      return newData;
    });
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.price || !formData.category) {
      toast.warn("⚠️ Name, Price & Category required");
      return;
    }

    if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      toast.error("💰 Invalid price");
      return;
    }

    try {
      const quantity = parseInt(formData.quantity) || 0;
      const salePrice = formData.salePrice ? parseFloat(formData.salePrice) : 0;

      const productData = {
        name: formData.name,
        category: formData.category,
        description: formData.description || "",
        price: parseFloat(formData.price),
        salePrice,
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        quantity,
        inStock: quantity > 0,
        image: formData.image || "",
        ...(formData.orderCount !== '' && formData.orderCount != null && { orderCount: parseInt(formData.orderCount, 10) || 0 })
      };

      if (editingProduct) {
        await api.put(`/admin/products/${editingProduct._id}`, productData);
        toast.success("✨ Product updated");
      } else {
        await api.post(`/admin/products`, productData);
        toast.success("🎉 Product created");
      }

      loadProductsData();
      closeModal();

    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }

  }, [formData, editingProduct, closeModal, loadProductsData]);

  const handleDelete = useCallback(async (productId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this product?");
    if (!confirmDelete) return;

    try {
      await api.delete(`/admin/products/${productId}`);

      toast.success("🗑️ Product deleted successfully");

      loadProductsData();

    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete product");
    }
  }, [loadProductsData]);

  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
  };


  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans">
      <Toaster position="top-right" />

      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-green-600" /> Inventory
          </h1>
          <p className="text-gray-500">Manage your product catalog and stock levels</p>
        </div>
        <div className="grid w-full md:w-auto grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <button onClick={() => openModal()} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all active:scale-95 w-full">
            <Plus /> Add Product
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-all disabled:opacity-60 w-full"
          >
            Export CSV
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleImportCsv(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            disabled={importingCsv}
            className="flex items-center justify-center gap-2 bg-[#3090cf] hover:bg-[#246fa0] text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-all disabled:opacity-60 w-full"
          >
            {importingCsv ? 'Importing...' : 'Import CSV'}
          </button>
        </div>
      </div>

      {showQuickModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !fileLoader && setShowQuickModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">➕ Quick Add Products</h3>
              <button
                onClick={() => setShowQuickModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* LOADING STATE */}
              {fileLoader && (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 font-medium">Uploading Excel... please wait</p>
                </div>
              )}

              {/* FORM STATE */}
              {!fileLoader && !uploadResult && (
                <div className="space-y-6">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-400">Excel file (.xlsx)</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={(e) => setExcelFile(e.target.files[0])}
                    />
                  </label>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setShowQuickModal(false)}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExcelUpload}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
                    >
                      Upload & Save
                    </button>
                  </div>
                </div>
              )}

              {/* RESULT STATE */}
              {!fileLoader && uploadResult && (
                <div className="space-y-5">
                  {uploadResult.error ? (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      ❌ {uploadResult.error}
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                        ✅ File processed successfully!
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                          <div className="text-sm text-gray-500">Success</div>
                          <div className="text-3xl font-bold text-green-600">{uploadResult.successCount}</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                          <div className="text-sm text-gray-500">Failed</div>
                          <div className="text-3xl font-bold text-red-600">{uploadResult.failedCount}</div>
                        </div>
                      </div>

                      {/* Error Log */}
                      {uploadResult?.failedRows?.length > 0 && (
                        <div className="border border-red-200 rounded-lg overflow-hidden">
                          <div className="bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 border-b border-red-200">
                            Error Details
                          </div>
                          <div className="max-h-40 overflow-y-auto p-3 bg-white space-y-2 text-sm">
                            {uploadResult.failedRows.map((row, i) => (
                              <div key={i} className="text-red-700 flex gap-2">
                                <span className="font-mono font-bold">Row {row.row}:</span>
                                <span className="break-words">{row.error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setUploadResult(null);
                            setExcelFile(null);
                            loadProductsData();
                          }}
                          className="px-5 py-2.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                        >
                          Upload Another
                        </button>
                        <button
                          onClick={() => {
                            setShowQuickModal(false);
                            loadProductsData();
                          }}
                          className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
                        >
                          Finish
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {[
          { label: 'Total Products', val: productStats.total, icon: <Package />, color: 'blue' },
          { label: 'In Stock', val: productStats.inStock, icon: <CheckCircle />, color: 'green' },
          { label: 'Out of Stock', val: productStats.outOfStock, icon: <XCircle />, color: 'red' },
          { label: 'Inventory Value', val: `$${productStats.totalValue.toLocaleString()}`, icon: <DollarSign />, color: 'amber' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl ${colorMap[stat.color]}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search – search bar only; category is shown in table column below */}
      <div className="max-w-7xl mx-auto bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-sm sm:text-base"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Image</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Qty</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center" title="Hot badge when > 5">Orders</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="py-20 text-center text-gray-400">Loading inventory...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="10" className="py-20 text-center text-gray-400 text-lg">No products found matching filters.</td></tr>
              ) : (
                products.map(p => (
                  <ProductTableRow
                    key={p._id}
                    product={p}
                    calculateProfit={calculateProfit}
                    onEdit={openModal}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronLeft />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden max-w-7xl mx-auto space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">Loading inventory...</div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">No products found matching filters.</div>
        ) : (
          products.map((p) => (
            <ProductMobileCard
              key={p._id}
              product={p}
              calculateProfit={calculateProfit}
              onEdit={openModal}
              onDelete={handleDelete}
            />
          ))
        )}

        <div className="p-4 bg-white rounded-xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex-1 sm:flex-none p-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronLeft className="mx-auto" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex-1 sm:flex-none p-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronRight className="mx-auto" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal - Tailwind Modernized */}
      {showModal && (
        /* Increased z-index to z-[9999] to stay above any navbar/header */
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">

          {/* Added a wrapper to handle mobile height better */}
          <div className="bg-white w-full max-w-2xl rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-10 sm:zoom-in duration-300 flex flex-col max-h-[92vh] sm:max-h-[90vh] relative">

            {/* STICKY HEADER: Ensures title is always visible */}
            <div className="sticky top-0 z-10 px-6 py-4 sm:px-8 sm:py-5 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <p className="hidden sm:block text-xs text-gray-400 font-medium uppercase tracking-tight">Inventory Management</p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-xl">✕</span>
              </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Product Name */}
                <div className="md:col-span-2">
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Product Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Fresh Organic Bananas"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-gray-50/50"
                    required
                  />
                </div>

                {/* Category & Image URL */}
                <div className="space-y-5 col-span-1 md:col-span-1">
                  <div>
                    <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Category</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50 appearance-none">
                      {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Image URL</label>
                    <input name="image" value={formData.image} onChange={handleInputChange} placeholder="https://..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50" />
                  </div>
                </div>

                {/* Pricing & Stock Grid */}
                <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-1">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Price ($)</label>
                    <input name="price" type="number" step="0.01" value={formData.price} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50" required />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Sale Price ($)</label>
                    <input name="salePrice" type="number" step="0.01" value={formData.salePrice} onChange={handleInputChange} placeholder="Discounted sell price" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Stock Qty</label>
                    <input name="quantity" type="number" value={formData.quantity} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Times ordered</label>
                    <input name="orderCount" type="number" min="0" value={formData.orderCount} onChange={handleInputChange} placeholder="e.g. 6 → Hot badge" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50" />
                    <p className="text-[10px] text-gray-400 mt-1">Storefront shows &quot;Hot&quot; when &gt; 5. Leave empty if backend fills from orders.</p>
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Tell us more about the product..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50 resize-none"
                  ></textarea>
                </div>
              </div>
            </form>

            {/* STICKY FOOTER: Always stays at bottom */}
            <div className="sticky bottom-0 z-10 px-6 py-4 sm:px-8 sm:py-5 border-t border-gray-100 flex gap-3 justify-end bg-white">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="flex-[2] sm:flex-none px-10 py-3 rounded-xl bg-green-600 text-white font-bold shadow-lg shadow-green-200 hover:bg-green-700 active:scale-95 transition-all text-sm"
              >
                {editingProduct ? 'Save Changes' : 'Publish Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminProducts;