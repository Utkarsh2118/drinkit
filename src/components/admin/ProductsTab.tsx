import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Copy,
  Archive,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  X,
  Check,
  AlertTriangle,
  Layers,
  Store as StoreIcon,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  ChevronDown,
  Building2,
  Package,
} from 'lucide-react';
import { Product, Store, ProductRequest, ProductStatus, ProductImageStatus } from '../../types.ts';
import { api } from '../../services/api.ts';
import { ProductImage } from '../ProductImage.tsx';

interface ProductsTabProps {
  stores: Store[];
  onCatalogChanged?: () => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({ stores, onCatalogChanged }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'requests'>('products');
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedStore, setSelectedStore] = useState('');

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Inventory Management Modal state
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedProductForInventory, setSelectedProductForInventory] = useState<Product | null>(null);
  const [storeStockMap, setStoreStockMap] = useState<{ [storeId: string]: { quantity: number; lowStockThreshold: number; isAvailable: boolean } }>({});
  const [isSavingInventory, setIsSavingInventory] = useState(false);

  // Approve Request Modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<ProductRequest | null>(null);
  const [approvePrice, setApprovePrice] = useState(299);
  const [approveMrp, setApproveMrp] = useState(349);
  const [approveStock, setApproveStock] = useState(25);
  const [approveNotes, setApproveNotes] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formShortDescription, setFormShortDescription] = useState('');
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formMrp, setFormMrp] = useState<number>(0);
  const [formVolume, setFormVolume] = useState('750 ml');
  const [formWeight, setFormWeight] = useState('');
  const [formPackSize, setFormPackSize] = useState('1 Unit');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formAbv, setFormAbv] = useState<number>(40);
  const [formIsAlcoholic, setFormIsAlcoholic] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageStatus, setFormImageStatus] = useState<ProductImageStatus>('MISSING_IMAGE');
  const [formCountry, setFormCountry] = useState('India');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formStatus, setFormStatus] = useState<ProductStatus>('ACTIVE');
  const [formIsBestseller, setFormIsBestseller] = useState(false);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formInitialStock, setFormInitialStock] = useState<number>(20);
  const [formInitialStoreId, setFormInitialStoreId] = useState<string>('all');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCatalogData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, reqRes, catRes, brandRes] = await Promise.all([
        api.get<{ items: Product[] }>('/products?manage=true&limit=250'),
        api.get<ProductRequest[]>('/product-requests'),
        api.get<any[]>('/products/categories'),
        api.get<any[]>('/products/brands'),
      ]);

      setProducts(prodRes.items || []);
      setRequests(reqRes || []);
      setCategories(catRes || []);
      setBrands(brandRes || []);
    } catch (err) {
      console.warn('Error loading admin catalog data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData();
  }, []);

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Open Add Product Modal
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingProductId(null);
    setFormName('');
    setFormBrand('Amrut Distilleries');
    setFormCategory('cat_whisky');
    setFormSubcategory('Single Malt Whisky');
    setFormDescription('Artisanal micro-distilled premium spirit.');
    setFormShortDescription('Premium Indian Single Malt');
    setFormPrice(2450);
    setFormMrp(2650);
    setFormVolume('750 ml');
    setFormWeight('750g');
    setFormPackSize('1 Bottle');
    setFormSku(`SKU-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormBarcode(`890${Math.floor(100000000 + Math.random() * 900000000)}`);
    setFormAbv(42.8);
    setFormIsAlcoholic(true);
    setFormImageUrl('');
    setFormImageStatus('MISSING_IMAGE');
    setFormCountry('India');
    setFormIsActive(true);
    setFormStatus('ACTIVE');
    setFormIsBestseller(false);
    setFormIsFeatured(false);
    setFormInitialStock(20);
    setFormInitialStoreId('all');
    setShowProductModal(true);
  };

  // Open Edit Product Modal
  const handleOpenEditModal = (product: Product) => {
    setModalMode('edit');
    setEditingProductId(product.id);
    setFormName(product.name);
    setFormBrand(product.brandName);
    setFormCategory(product.categoryId);
    setFormSubcategory(product.subcategory || '');
    setFormDescription(product.description || '');
    setFormShortDescription(product.shortDescription || '');
    setFormPrice(product.price);
    setFormMrp(product.mrp);
    setFormVolume(product.volume);
    setFormWeight(product.weight || '');
    setFormPackSize(product.packSize || '1 Unit');
    setFormSku(product.sku || `SKU-${product.id.slice(-6)}`);
    setFormBarcode(product.barcode || '');
    setFormAbv(product.alcoholByVolume || 0);
    setFormIsAlcoholic(product.isAlcoholic);
    setFormImageUrl(product.imageUrl || '');
    setFormImageStatus(product.imageStatus || (product.imageUrl ? 'VALID' : 'MISSING_IMAGE'));
    setFormCountry(product.country || 'India');
    setFormIsActive(product.isActive !== false);
    setFormStatus(product.status || (product.isActive ? 'ACTIVE' : 'INACTIVE'));
    setFormIsBestseller(Boolean(product.isBestseller));
    setFormIsFeatured(Boolean(product.isFeatured));
    setShowProductModal(true);
  };

  // Duplicate Product
  const handleDuplicateProduct = (product: Product) => {
    setModalMode('add');
    setEditingProductId(null);
    setFormName(`${product.name} (Copy)`);
    setFormBrand(product.brandName);
    setFormCategory(product.categoryId);
    setFormSubcategory(product.subcategory || '');
    setFormDescription(product.description || '');
    setFormShortDescription(product.shortDescription || '');
    setFormPrice(product.price);
    setFormMrp(product.mrp);
    setFormVolume(product.volume);
    setFormWeight(product.weight || '');
    setFormPackSize(product.packSize || '1 Unit');
    setFormSku(`SKU-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormBarcode('');
    setFormAbv(product.alcoholByVolume || 0);
    setFormIsAlcoholic(product.isAlcoholic);
    setFormImageUrl(product.imageUrl || '');
    setFormImageStatus(product.imageStatus || 'MISSING_IMAGE');
    setFormCountry(product.country || 'India');
    setFormIsActive(true);
    setFormStatus('ACTIVE');
    setFormIsBestseller(false);
    setFormIsFeatured(false);
    setFormInitialStock(15);
    setFormInitialStoreId('all');
    setShowProductModal(true);
  };

  // Handle File Upload
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

      setFormImageUrl(resData.imageUrl);
      setFormImageStatus('VALID');
      showNotification('Product packshot uploaded successfully.');
    } catch (err: any) {
      alert(err.message || 'Image upload failed');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove Image with confirmation
  const handleRemoveImage = () => {
    if (window.confirm('Remove product image? The product card will display "Image unavailable".')) {
      setFormImageUrl('');
      setFormImageStatus('MISSING_IMAGE');
      showNotification('Product image removed.');
    }
  };

  // Save Product (Create or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice || !formVolume.trim()) {
      alert('Please fill in required fields (Product Name, Price, Volume).');
      return;
    }

    const categoryObj = categories.find(c => c.id === formCategory);
    const categoryName = categoryObj?.name || 'Beverages';

    try {
      if (modalMode === 'add') {
        let storeInventory: { storeId: string; stock: number; lowStockThreshold: number }[] = [];
        if (formInitialStoreId === 'all') {
          storeInventory = stores.map(s => ({
            storeId: s.id,
            stock: Number(formInitialStock) || 15,
            lowStockThreshold: 5,
          }));
        } else {
          storeInventory = [
            {
              storeId: formInitialStoreId,
              stock: Number(formInitialStock) || 15,
              lowStockThreshold: 5,
            },
          ];
        }

        await api.post('/products', {
          name: formName.trim(),
          brandName: formBrand.trim(),
          categoryId: formCategory,
          categoryName,
          subcategory: formSubcategory.trim(),
          description: formDescription.trim(),
          shortDescription: formShortDescription.trim(),
          price: Number(formPrice),
          mrp: Number(formMrp) || Math.round(Number(formPrice) * 1.15),
          volume: formVolume.trim(),
          weight: formWeight.trim(),
          packSize: formPackSize.trim(),
          sku: formSku.trim(),
          barcode: formBarcode.trim(),
          alcoholByVolume: Number(formAbv),
          isAlcoholic: formIsAlcoholic,
          imageUrl: formImageUrl,
          imageStatus: formImageStatus,
          country: formCountry,
          isActive: formIsActive,
          status: formStatus,
          isBestseller: formIsBestseller,
          isFeatured: formIsFeatured,
          storeInventory,
        });

        showNotification(`Product "${formName}" created and inventory provisioned.`);
      } else {
        await api.patch(`/products/${editingProductId}`, {
          name: formName.trim(),
          brandName: formBrand.trim(),
          categoryId: formCategory,
          categoryName,
          subcategory: formSubcategory.trim(),
          description: formDescription.trim(),
          shortDescription: formShortDescription.trim(),
          price: Number(formPrice),
          mrp: Number(formMrp),
          volume: formVolume.trim(),
          weight: formWeight.trim(),
          packSize: formPackSize.trim(),
          sku: formSku.trim(),
          barcode: formBarcode.trim(),
          alcoholByVolume: Number(formAbv),
          isAlcoholic: formIsAlcoholic,
          imageUrl: formImageUrl,
          imageStatus: formImageStatus,
          country: formCountry,
          isActive: formIsActive,
          status: formStatus,
          isBestseller: formIsBestseller,
          isFeatured: formIsFeatured,
        });

        showNotification(`Product "${formName}" updated successfully.`);
      }

      setShowProductModal(false);
      fetchCatalogData();
      if (onCatalogChanged) onCatalogChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
    }
  };

  // Archive Product
  const handleArchiveProduct = async (product: Product) => {
    if (!window.confirm(`Archive "${product.name}"? It will be safely hidden from customers while preserving all order history.`)) {
      return;
    }

    try {
      await api.post(`/products/${product.id}/archive`);
      showNotification(`"${product.name}" archived.`);
      fetchCatalogData();
      if (onCatalogChanged) onCatalogChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to archive product');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete product "${product.name}"? If it has historical order dependencies, it will be automatically archived.`)) {
      return;
    }

    try {
      const res = await api.delete<{ success: boolean; archived: boolean; message: string }>(`/products/${product.id}`);
      showNotification(res.message || 'Product deleted.');
      fetchCatalogData();
      if (onCatalogChanged) onCatalogChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
    }
  };

  // Open Inventory Management Modal for a Product across all dark stores
  const handleOpenInventoryModal = async (product: Product) => {
    setSelectedProductForInventory(product);
    setShowInventoryModal(true);
    try {
      const res = await api.get<{ product: Product; stores: { store: Store; inventory: any }[] }>(`/products/${product.id}/inventory`);
      const map: { [storeId: string]: { quantity: number; lowStockThreshold: number; isAvailable: boolean } } = {};
      res.stores.forEach(s => {
        map[s.store.id] = {
          quantity: s.inventory ? s.inventory.quantity : 0,
          lowStockThreshold: s.inventory ? s.inventory.lowStockThreshold : 5,
          isAvailable: s.inventory ? s.inventory.isAvailable !== false : true,
        };
      });
      setStoreStockMap(map);
    } catch (err: any) {
      console.warn('Failed to load inventory breakdown', err);
    }
  };

  // Save Inventory Across Stores
  const handleSaveInventory = async () => {
    if (!selectedProductForInventory) return;
    setIsSavingInventory(true);
    try {
      const updates = Object.keys(storeStockMap).map(storeId => ({
        storeId,
        quantity: storeStockMap[storeId].quantity,
        lowStockThreshold: storeStockMap[storeId].lowStockThreshold,
        isAvailable: storeStockMap[storeId].isAvailable,
      }));

      await api.put(`/products/${selectedProductForInventory.id}/inventory`, { stores: updates });
      showNotification(`Stock levels updated across ${updates.length} micro-warehouses.`);
      setShowInventoryModal(false);
      fetchCatalogData();
      if (onCatalogChanged) onCatalogChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to update store inventory');
    } finally {
      setIsSavingInventory(false);
    }
  };

  // Approve Store Manager Product Request
  const handleApproveRequest = async () => {
    if (!selectedRequestForApproval) return;
    try {
      await api.post(`/product-requests/${selectedRequestForApproval.id}/approve`, {
        price: approvePrice,
        mrp: approveMrp,
        initialStock: approveStock,
        adminNotes: approveNotes,
      });

      showNotification(`Request approved and "${selectedRequestForApproval.productName}" added to global catalogue.`);
      setShowApproveModal(false);
      fetchCatalogData();
      if (onCatalogChanged) onCatalogChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to approve request');
    }
  };

  // Reject Request
  const handleRejectRequest = async (req: ProductRequest) => {
    const notes = window.prompt(`Provide reason for rejecting request for "${req.productName}":`, 'Unavailable with certified state distributor.');
    if (notes === null) return;

    try {
      await api.post(`/product-requests/${req.id}/reject`, { adminNotes: notes });
      showNotification(`Request for "${req.productName}" rejected.`);
      fetchCatalogData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    }
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.categoryName?.toLowerCase().includes(q) ||
        p.subcategory?.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (selectedCategory && p.categoryId !== selectedCategory) return false;
    if (selectedBrand && p.brandName !== selectedBrand) return false;
    if (selectedStatus) {
      const pStatus = p.status || (p.isArchived ? 'ARCHIVED' : (p.isActive ? 'ACTIVE' : 'INACTIVE'));
      if (pStatus !== selectedStatus) return false;
    }
    return true;
  });

  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner Alert */}
      {actionMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="p-1 rounded hover:bg-emerald-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Subtab Navigation & Main Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('products')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'products'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'requests'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Product Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCatalogData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Refresh Catalogue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>ADD PRODUCT</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'products' && (
        <>
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
            <div className="relative md:col-span-2">
              <input
                type="text"
                placeholder="Search products by name, brand, SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Brands</option>
              {brands.map(b => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Products Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Image</th>
                    <th className="p-3.5">Product Name & SKU</th>
                    <th className="p-3.5">Brand</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Variant</th>
                    <th className="p-3.5">Price & MRP</th>
                    <th className="p-3.5">Stock</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                        No products match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const imageBadge =
                        !p.imageUrl || p.imageStatus === 'MISSING_IMAGE' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            ⚪ No Image
                          </span>
                        ) : p.imageStatus === 'VALID' || p.imageVerified ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🟢 Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            🟡 Review
                          </span>
                        );

                      const pStatus = p.status || (p.isArchived ? 'ARCHIVED' : (p.isActive ? 'ACTIVE' : 'INACTIVE'));

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Image with status */}
                          <td className="p-3.5">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                              <ProductImage
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-contain"
                                imageVerified={p.imageVerified}
                                imageStatus={p.imageStatus}
                              />
                            </div>
                            <div className="mt-1">{imageBadge}</div>
                          </td>

                          {/* Product Name */}
                          <td className="p-3.5">
                            <div className="font-extrabold text-slate-900 max-w-[200px] leading-tight">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {p.sku || `SKU-${p.id.slice(-6)}`}
                            </div>
                          </td>

                          {/* Brand */}
                          <td className="p-3.5 text-slate-700 font-semibold">{p.brandName}</td>

                          {/* Category */}
                          <td className="p-3.5">
                            <span className="text-[11px] font-bold text-slate-800">{p.categoryName}</span>
                            <div className="text-[10px] text-slate-400">{p.subcategory}</div>
                          </td>

                          {/* Variant / Volume */}
                          <td className="p-3.5 text-slate-600 font-medium">
                            <div>{p.volume}</div>
                            {p.isAlcoholic && (
                              <span className="text-[10px] text-amber-700 font-bold">
                                {p.alcoholByVolume}% ABV
                              </span>
                            )}
                          </td>

                          {/* Price */}
                          <td className="p-3.5">
                            <div className="font-black text-slate-900">₹{p.price}</div>
                            {p.mrp > p.price && (
                              <div className="text-[10px] text-slate-400 line-through">₹{p.mrp}</div>
                            )}
                          </td>

                          {/* Stock */}
                          <td className="p-3.5">
                            <span
                              className={`font-mono font-black px-2 py-0.5 rounded text-[11px] ${
                                (p.stock || 0) === 0
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : (p.stock || 0) <= 5
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {p.stock !== undefined ? `${p.stock} units` : 'In Stock'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-3.5">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                pStatus === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pStatus === 'OUT_OF_STOCK'
                                  ? 'bg-amber-100 text-amber-800'
                                  : pStatus === 'ARCHIVED'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {pStatus}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditModal(p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors"
                                title="Edit Product"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenInventoryModal(p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                                title="Manage Store Stock"
                              >
                                <StoreIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicateProduct(p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-colors"
                                title="Duplicate Product"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {pStatus !== 'ARCHIVED' && (
                                <button
                                  onClick={() => handleArchiveProduct(p)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                                  title="Archive Product"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-700 transition-colors"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </>
      )}

      {/* Subtab: Product Requests from Store Managers */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Store Manager New Product Requests</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review catalogue requests from local dark store managers and provision approved SKUs.
              </p>
            </div>
            <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-slate-100 text-slate-700">
              Total Requests: {requests.length}
            </span>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[800px]">
                <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Store & Requester</th>
                    <th className="p-3.5">Requested Product</th>
                    <th className="p-3.5">Brand</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Variant / Vol</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                        No pending product requests from store managers.
                      </td>
                    </tr>
                  ) : (
                    requests.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{r.storeName}</div>
                          <div className="text-[10px] text-slate-400">By: {r.requestedByUserName}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-extrabold text-slate-900">{r.productName}</div>
                          {r.suggestedSku && (
                            <div className="text-[10px] text-slate-400 font-mono">Suggested: {r.suggestedSku}</div>
                          )}
                          {r.notes && <div className="text-[11px] text-slate-500 italic mt-0.5">"{r.notes}"</div>}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-700">{r.brandName}</td>
                        <td className="p-3.5 text-slate-600">{r.categoryName}</td>
                        <td className="p-3.5 text-slate-600 font-medium">
                          {r.volumeOrWeight} {r.variant && `• ${r.variant}`}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              r.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          {r.status === 'PENDING' ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedRequestForApproval(r);
                                  setApprovePrice(299);
                                  setApproveMrp(349);
                                  setApproveStock(25);
                                  setApproveNotes('Approved by Admin');
                                  setShowApproveModal(true);
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRequest(r)}
                                className="px-3 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold rounded-lg transition-colors border border-slate-200"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {r.adminNotes || 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD / EDIT PRODUCT MODAL
         ======================================================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {modalMode === 'add' ? 'Add New Product' : 'Edit Product'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure catalogue specifications, verified imagery, state excise compliance, and micro-warehouse stock.
                </p>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-6">
              {/* SECTION 1: PRODUCT INFORMATION */}
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>1. Product Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Product Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Stag Deluxe Whisky"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Royal Stag"
                      value={formBrand}
                      onChange={e => setFormBrand(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Subcategory</label>
                    <input
                      type="text"
                      placeholder="e.g. Indian Premium Grain Whisky"
                      value={formSubcategory}
                      onChange={e => setFormSubcategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Description</label>
                    <textarea
                      rows={3}
                      placeholder="Detailed tasting profile and packaging notes..."
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Short Description (for card badges)</label>
                    <input
                      type="text"
                      placeholder="e.g. Smooth blend of imported scotch and Indian spirits"
                      value={formShortDescription}
                      onChange={e => setFormShortDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: PRODUCT IMAGE */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>2. Product Image & Packaging Packshot</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold normal-case">
                    PNG, JPG, WEBP • Max 5MB
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  {/* Image Stage Preview */}
                  <div className="w-28 h-28 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                    {formImageUrl ? (
                      <img
                        src={formImageUrl}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <ImageIcon className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-400 font-bold leading-tight block">
                          No Image
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-2.5 text-center sm:text-left">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        {formImageUrl ? 'Packshot Uploaded' : 'Upload Packshot'}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {formImageUrl
                          ? 'This image will be shown on the storefront. If removed, the card shows a clean "Image unavailable" placeholder.'
                          : 'Upload an official verified bottle or packaging packshot. No random images will be assigned.'}
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>{isUploadingImage ? 'Uploading...' : formImageUrl ? 'REPLACE' : 'UPLOAD'}</span>
                      </button>

                      {formImageUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 font-bold text-xs transition-colors"
                        >
                          REMOVE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: PRODUCT DETAILS (SKU & Barcode) */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>3. Product Details & Barcode</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">SKU</label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-10492"
                      value={formSku}
                      onChange={e => setFormSku(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Barcode / EAN</label>
                    <input
                      type="text"
                      placeholder="e.g. 89010304928"
                      value={formBarcode}
                      onChange={e => setFormBarcode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Country of Origin</label>
                    <input
                      type="text"
                      value={formCountry}
                      onChange={e => setFormCountry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: VARIANT & MEASUREMENTS */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>4. Variant & Strength</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Volume / Size <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 750 ml"
                      value={formVolume}
                      onChange={e => setFormVolume(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Weight</label>
                    <input
                      type="text"
                      placeholder="e.g. 750g"
                      value={formWeight}
                      onChange={e => setFormWeight(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pack Size</label>
                    <input
                      type="text"
                      placeholder="e.g. 1 Bottle"
                      value={formPackSize}
                      onChange={e => setFormPackSize(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Alcohol (ABV %)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formAbv}
                      onChange={e => setFormAbv(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: PRICING */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                  <span className="font-mono text-emerald-600 font-black">₹</span>
                  <span>5. Pricing</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Selling Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formPrice}
                      onChange={e => setFormPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Maximum Retail Price MRP (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formMrp}
                      onChange={e => setFormMrp(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: AVAILABILITY & STATUS */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>6. Availability & Storefront Status</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as ProductStatus)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ACTIVE">ACTIVE (Visible in Store)</option>
                      <option value="INACTIVE">INACTIVE (Hidden)</option>
                      <option value="OUT_OF_STOCK">OUT OF STOCK</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="bestseller-toggle"
                      checked={formIsBestseller}
                      onChange={e => setFormIsBestseller(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="bestseller-toggle" className="text-xs font-bold text-slate-700">
                      Bestseller Badge
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="featured-toggle"
                      checked={formIsFeatured}
                      onChange={e => setFormIsFeatured(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="featured-toggle" className="text-xs font-bold text-slate-700">
                      Featured Promo
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION 7: STORE INVENTORY (Add Mode only) */}
              {modalMode === 'add' && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                    <StoreIcon className="w-4 h-4 text-emerald-600" />
                    <span>7. Initial Micro-Warehouse Stock Provisioning</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Provision Stock For</label>
                      <select
                        value={formInitialStoreId}
                        onChange={e => setFormInitialStoreId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="all">All Dark Stores ({stores.length} hubs)</option>
                        {stores.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.city})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Stock Quantity per Store
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formInitialStock}
                        onChange={e => setFormInitialStock(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-colors"
                >
                  {modalMode === 'add' ? 'SAVE & PROVISION PRODUCT' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MANAGE STORE INVENTORY MODAL (Admin: per-product across stores)
         ======================================================== */}
      {showInventoryModal && selectedProductForInventory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Manage Store Inventory: {selectedProductForInventory.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust micro-warehouse stock and availability across all regional stores.
                </p>
              </div>
              <button
                onClick={() => setShowInventoryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-3">
                {stores.map(store => {
                  const current = storeStockMap[store.id] || { quantity: 0, lowStockThreshold: 5, isAvailable: true };
                  return (
                    <div
                      key={store.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">{store.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {store.area}, {store.city} • State: {store.state}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={current.isAvailable}
                            onChange={e =>
                              setStoreStockMap(prev => ({
                                ...prev,
                                [store.id]: { ...current, isAvailable: e.target.checked },
                              }))
                            }
                            className="rounded text-emerald-600"
                          />
                          <span>Active</span>
                        </label>

                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-500">Stock:</span>
                          <input
                            type="number"
                            min={0}
                            value={current.quantity}
                            onChange={e =>
                              setStoreStockMap(prev => ({
                                ...prev,
                                [store.id]: { ...current, quantity: Number(e.target.value) },
                              }))
                            }
                            className="w-18 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-mono font-bold text-center focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInventoryModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveInventory}
                  disabled={isSavingInventory}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSavingInventory ? 'Saving...' : 'UPDATE ALL STORES'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          APPROVE PRODUCT REQUEST MODAL
         ======================================================== */}
      {showApproveModal && selectedRequestForApproval && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div>
              <h3 className="text-base font-black text-slate-900">Approve Product Request</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Approving "{selectedRequestForApproval.productName}" will add it to the global catalogue and provision stock for {selectedRequestForApproval.storeName}.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={approvePrice}
                    onChange={e => setApprovePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={approveMrp}
                    onChange={e => setApproveMrp(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Provisioning Stock for {selectedRequestForApproval.storeName}
                </label>
                <input
                  type="number"
                  min={1}
                  value={approveStock}
                  onChange={e => setApproveStock(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Approval Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Verified with state distributor list."
                  value={approveNotes}
                  onChange={e => setApproveNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveRequest}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs"
              >
                APPROVE & PROVISION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
