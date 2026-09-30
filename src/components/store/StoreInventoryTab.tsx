import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Edit3,
  Check,
  X,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Store, Product } from '../../types.ts';
import { api } from '../../services/api.ts';
import { ProductImage } from '../ProductImage.tsx';

interface StoreInventoryItem {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  available: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  storePrice?: number;
  productName: string;
  brandName: string;
  categoryName: string;
  price: number;
  mrp: number;
  volume: string;
  sku: string;
  imageUrl?: string;
  imageVerified?: boolean;
  imageStatus?: any;
}

interface StoreInventoryTabProps {
  store: Store;
  inventory: StoreInventoryItem[];
  onInventoryUpdated: () => void;
}

export const StoreInventoryTab: React.FC<StoreInventoryTabProps> = ({
  store,
  inventory,
  onInventoryUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Add Product to Store Modal
  const [showAddToStoreModal, setShowAddToStoreModal] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [newStockQty, setNewStockQty] = useState<number>(25);
  const [newLowStockThreshold, setNewLowStockThreshold] = useState<number>(5);
  const [newIsAvailable, setNewIsAvailable] = useState<boolean>(true);
  const [newStorePrice, setNewStorePrice] = useState<number>(0);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Request New Product Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [reqName, setReqName] = useState('');
  const [reqBrand, setReqBrand] = useState('');
  const [reqCategory, setReqCategory] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqVariant, setReqVariant] = useState('');
  const [reqVolumeWeight, setReqVolumeWeight] = useState('750 ml');
  const [reqSuggestedSku, setReqSuggestedSku] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqImageUrl, setReqImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Stock Modal
  const [editingItem, setEditingItem] = useState<StoreInventoryItem | null>(null);
  const [editStockQty, setEditStockQty] = useState<number>(0);
  const [editLowThreshold, setEditLowThreshold] = useState<number>(5);
  const [editStorePrice, setEditStorePrice] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch categories & global products for Add to Store
  const loadGlobalCatalog = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get<{ items: Product[] }>('/products?manage=true&limit=300'),
        api.get<any[]>('/products/categories'),
      ]);
      setCatalogProducts(prodRes.items || []);
      setCategories(catRes || []);
      if (catRes && catRes.length > 0 && !reqCategory) {
        setReqCategory(catRes[0].id);
      }
    } catch (e) {
      console.warn('Failed to load global catalog', e);
    }
  };

  useEffect(() => {
    loadGlobalCatalog();
  }, []);

  // Filtered store inventory items
  const filteredInventory = inventory.filter(item => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        item.productName.toLowerCase().includes(q) ||
        item.brandName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (categoryFilter && item.categoryName !== categoryFilter) return false;
    if (availabilityFilter) {
      if (availabilityFilter === 'AVAILABLE' && !item.isAvailable) return false;
      if (availabilityFilter === 'DISABLED' && item.isAvailable) return false;
    }
    if (stockStatusFilter) {
      if (stockStatusFilter === 'OUT_OF_STOCK' && item.available > 0) return false;
      if (stockStatusFilter === 'LOW_STOCK' && (item.available === 0 || item.available > item.lowStockThreshold)) return false;
      if (stockStatusFilter === 'IN_STOCK' && item.available <= item.lowStockThreshold) return false;
    }
    return true;
  });

  // Unique categories in current inventory
  const uniqueCategories = Array.from(new Set(inventory.map(i => i.categoryName))).filter(Boolean);

  // Quick adjust stock
  const handleQuickAdjust = async (item: StoreInventoryItem, delta: number) => {
    const nextQty = Math.max(0, item.quantity + delta);
    try {
      await api.patch(`/stores/${store.id}/inventory/${item.productId}`, {
        quantity: nextQty,
      });
      showToast(`Updated stock for ${item.productName} to ${nextQty}.`);
      onInventoryUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  // Toggle availability
  const handleToggleAvailability = async (item: StoreInventoryItem) => {
    const nextState = !item.isAvailable;
    try {
      await api.patch(`/stores/${store.id}/inventory/${item.productId}`, {
        isAvailable: nextState,
      });
      showToast(`${item.productName} is now ${nextState ? 'ENABLED' : 'DISABLED'} for this store.`);
      onInventoryUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle availability');
    }
  };

  // Open Edit Stock Modal
  const handleOpenEdit = (item: StoreInventoryItem) => {
    setEditingItem(item);
    setEditStockQty(item.quantity);
    setEditLowThreshold(item.lowStockThreshold || 5);
    setEditStorePrice(item.storePrice || item.price);
  };

  // Save Edit Stock
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      await api.patch(`/stores/${store.id}/inventory/${editingItem.productId}`, {
        quantity: Number(editStockQty),
        lowStockThreshold: Number(editLowThreshold),
        storePrice: Number(editStorePrice),
      });
      showToast(`Inventory updated for ${editingItem.productName}.`);
      setEditingItem(null);
      onInventoryUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update store inventory');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Select Product in Add to Store flow
  const handleSelectProductForAdd = (prod: Product) => {
    setSelectedProduct(prod);
    setSelectedVariant(prod.volume || 'Standard');
    setNewStorePrice(prod.price);
    setNewStockQty(25);
    setNewLowStockThreshold(5);
    setNewIsAvailable(true);
  };

  // Save Product to Store Inventory
  const handleSaveProductToStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmittingAdd(true);
    try {
      await api.post(`/stores/${store.id}/inventory`, {
        productId: selectedProduct.id,
        quantity: Number(newStockQty),
        lowStockThreshold: Number(newLowStockThreshold),
        isAvailable: Boolean(newIsAvailable),
        storePrice: Number(newStorePrice) !== selectedProduct.price ? Number(newStorePrice) : undefined,
      });
      showToast(`Added "${selectedProduct.name}" to ${store.name} inventory.`);
      setShowAddToStoreModal(false);
      setSelectedProduct(null);
      onInventoryUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to add product to store inventory');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Image Upload for New Product Request
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      alert('Only PNG, JPG/JPEG, and WEBP formats are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const token = localStorage.getItem('drinkit_token') || sessionStorage.getItem('drinkit_token');
      const response = await fetch('/api/products/upload-image', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.message || 'Image upload failed');
      }

      setReqImageUrl(resData.imageUrl);
      showToast('Packshot uploaded for request.');
    } catch (err: any) {
      alert(err.message || 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Submit Product Request
  const handleSubmitProductRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqName.trim() || !reqBrand.trim() || !reqCategory) {
      alert('Please fill in Product Name, Brand, and Category.');
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const categoryObj = categories.find(c => c.id === reqCategory);
      await api.post('/product-requests', {
        productName: reqName.trim(),
        brandName: reqBrand.trim(),
        categoryId: reqCategory,
        categoryName: categoryObj?.name || 'General',
        description: reqDescription.trim(),
        variant: reqVariant.trim(),
        volumeOrWeight: reqVolumeWeight.trim(),
        imageUrl: reqImageUrl || null,
        suggestedSku: reqSuggestedSku.trim() || undefined,
        notes: reqNotes.trim() || undefined,
        storeId: store.id,
      });

      showToast(`Product request for "${reqName}" submitted to Admin for approval.`);
      setShowRequestModal(false);
      setReqName('');
      setReqBrand('');
      setReqDescription('');
      setReqVariant('');
      setReqVolumeWeight('750 ml');
      setReqSuggestedSku('');
      setReqNotes('');
      setReqImageUrl('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit product request');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Products available to be added to this store
  const existingProductIds = new Set(inventory.map(i => i.productId));
  const availableToAdd = catalogProducts.filter(p => {
    if (existingProductIds.has(p.id)) return false;
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.categoryName?.toLowerCase().includes(q) ||
        p.volume?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="p-1 rounded hover:bg-emerald-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Store Inventory Management</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Manage local shelf stock, micro-warehouse availability, and stock new catalog drinks for {store.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddToStoreModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product to Store</span>
          </button>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Request New Product</span>
          </button>
          <button
            onClick={onInventoryUpdated}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Refresh Inventory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by title, brand, SKU..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
        >
          <option value="">All Categories</option>
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={stockStatusFilter}
          onChange={e => setStockStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
        >
          <option value="">All Stock Levels</option>
          <option value="IN_STOCK">In Stock (Healthy)</option>
          <option value="LOW_STOCK">Low Stock (≤ Threshold)</option>
          <option value="OUT_OF_STOCK">Out of Stock (0)</option>
        </select>

        <select
          value={availabilityFilter}
          onChange={e => setAvailabilityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
        >
          <option value="">All Availability</option>
          <option value="AVAILABLE">Enabled (Live)</option>
          <option value="DISABLED">Disabled (Hidden)</option>
        </select>

        <span className="text-xs text-slate-500 font-bold ml-auto">
          {filteredInventory.length} / {inventory.length} items
        </span>
      </div>

      {/* Main Inventory Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Current Stock</th>
                <th className="p-3.5">Low Stock</th>
                <th className="p-3.5">Price</th>
                <th className="p-3.5">Availability</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    No store inventory matches current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredInventory.map(item => {
                  const isOutOfStock = item.available === 0;
                  const isLowStock = !isOutOfStock && item.available <= (item.lowStockThreshold || 5);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Image + Details */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                            <ProductImage
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-contain"
                              imageVerified={item.imageVerified}
                              imageStatus={item.imageStatus}
                            />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 leading-tight">
                              {item.productName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {item.brandName} • {item.volume}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-500">
                        {item.sku}
                      </td>

                      {/* Category */}
                      <td className="p-3.5 font-medium text-slate-700">
                        {item.categoryName}
                      </td>

                      {/* Current Stock */}
                      <td className="p-3.5">
                        <span
                          className={`font-mono font-black px-2 py-0.5 rounded text-[11px] ${
                            isOutOfStock
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLowStock
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {item.available} units
                        </span>
                        {item.reservedQuantity > 0 && (
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            ({item.reservedQuantity} reserved)
                          </div>
                        )}
                      </td>

                      {/* Low Stock Threshold */}
                      <td className="p-3.5 text-slate-500 font-mono">
                        {item.lowStockThreshold || 5} units
                      </td>

                      {/* Price */}
                      <td className="p-3.5">
                        <div className="font-black text-slate-900">
                          ₹{item.storePrice || item.price}
                        </div>
                        {item.mrp > (item.storePrice || item.price) && (
                          <div className="text-[10px] text-slate-400 line-through">
                            ₹{item.mrp}
                          </div>
                        )}
                      </td>

                      {/* Availability (Live toggle) */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors border ${
                            item.isAvailable
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {item.isAvailable ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Enabled</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-400" />
                              <span>Disabled</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-800'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Quick Add/Remove */}
                          <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                            <button
                              onClick={() => handleQuickAdjust(item, -5)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Remove 5 units"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-slate-900 px-1 text-[11px]">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuickAdjust(item, +10)}
                              className="p-1 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                              title="Add 10 units"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Full Update Stock Modal */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors"
                            title="Update Stock & Threshold"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Edit Stock Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xl text-xs animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-black text-slate-900 text-sm">Update Store Stock</h4>
                <p className="text-[11px] text-slate-500">{editingItem.productName} ({store.name})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Current Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editStockQty}
                  onChange={e => setEditStockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editLowThreshold}
                  onChange={e => setEditLowThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Store Selling Price (₹)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editStorePrice}
                  onChange={e => setEditStorePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Regional pricing override for {store.state}. Global catalogue price: ₹{editingItem.price}.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Update Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Add Existing Product to Store Stock (Section 11) */}
      {showAddToStoreModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xl text-xs max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-black text-slate-900 text-base">Add Product to Store Inventory</h4>
                <p className="text-slate-500 text-[11px]">
                  Select from global catalogue and stock in {store.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddToStoreModal(false);
                  setSelectedProduct(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!selectedProduct ? (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search global catalogue to add to store..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>

                <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                  {availableToAdd.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-medium">
                      No matching products available to add. All products may already be stocked in this store.
                    </div>
                  ) : (
                    availableToAdd.map(prod => (
                      <div
                        key={prod.id}
                        onClick={() => handleSelectProductForAdd(prod)}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                            <ProductImage
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-contain"
                              imageVerified={prod.imageVerified}
                              imageStatus={prod.imageStatus}
                            />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">{prod.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {prod.brandName} • {prod.volume} • {prod.categoryName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-900">₹{prod.price}</span>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold text-xs transition-colors"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProductToStore} className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    <ProductImage
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain"
                      imageVerified={selectedProduct.imageVerified}
                      imageStatus={selectedProduct.imageStatus}
                    />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm">{selectedProduct.name}</div>
                    <div className="text-xs text-slate-600 font-medium">
                      {selectedProduct.brandName} • {selectedProduct.categoryName}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-[10px] text-emerald-700 font-bold hover:underline mt-1 block"
                    >
                      ← Choose different product
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Variant / Volume</label>
                    <input
                      type="text"
                      value={selectedVariant}
                      onChange={e => setSelectedVariant(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Stock Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newStockQty}
                      onChange={e => setNewStockQty(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Low Stock Threshold</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newLowStockThreshold}
                      onChange={e => setNewLowStockThreshold(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Store Selling Price (₹)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newStorePrice}
                      onChange={e => setNewStorePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Store Availability</div>
                    <div className="text-[10px] text-slate-500">
                      Enable immediately for customer browsing and ordering in {store.name}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newIsAvailable}
                    onChange={e => setNewIsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdd}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-50"
                  >
                    {isSubmittingAdd ? 'Saving...' : 'Save to Store Stock'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Store Manager Request New Product (Section 12) */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitProductRequest}
            className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xl text-xs max-h-[90vh] overflow-y-auto animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-black text-slate-900 text-base">Request New Product</h4>
                <p className="text-slate-500 text-[11px]">
                  Request admin catalog team to approve & provision a new SKU for {store.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Corona Extra Cerveza"
                    value={reqName}
                    onChange={e => setReqName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grupo Modelo / AB InBev"
                    value={reqBrand}
                    onChange={e => setReqBrand(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category *</label>
                  <select
                    value={reqCategory}
                    onChange={e => setReqCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Volume / Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 330 ml or 400g"
                    value={reqVolumeWeight}
                    onChange={e => setReqVolumeWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Variant Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Pint Bottle / 6-Pack"
                    value={reqVariant}
                    onChange={e => setReqVariant(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Suggested SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. SKU-BEER-CORONA-330"
                    value={reqSuggestedSku}
                    onChange={e => setReqSuggestedSku(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Flavour notes, provenance, or packaging details..."
                  value={reqDescription}
                  onChange={e => setReqDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Product Packshot (Optional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    {reqImageUrl ? (
                      <ProductImage
                        src={reqImageUrl}
                        alt="Request preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleImageFileChange}
                      className="hidden"
                      id="req-image-file"
                    />
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="req-image-file"
                        className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>{reqImageUrl ? 'Replace Image' : 'Upload Image'}</span>
                      </label>
                      {reqImageUrl && (
                        <button
                          type="button"
                          onClick={() => setReqImageUrl('')}
                          className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      PNG, JPG, WEBP up to 5MB. Stored directly in file storage.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes for Admin / Demand Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. High customer demand during weekend cricket match; local distributor has stock ready."
                  value={reqNotes}
                  onChange={e => setReqNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingRequest || isUploadingImage}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingRequest ? 'Submitting...' : 'Request Product'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
