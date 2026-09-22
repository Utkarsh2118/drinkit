import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Users,
  Building2,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Check,
  FileText,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { Product, Store, PlatformComplianceSettings } from '../types.ts';
import { api } from '../services/api.ts';
import { AnalyticsTab } from '../components/admin/AnalyticsTab.tsx';
import { CouponsTab } from '../components/admin/CouponsTab.tsx';

export const AdminDashboardView: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [compliance, setCompliance] = useState<PlatformComplianceSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'coupons' | 'catalog' | 'compliance' | 'audit'>('analytics');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Product Modal state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('Amrut Distilleries');
  const [newProductCategory, setNewProductCategory] = useState('cat_whisky');
  const [newProductPrice, setNewProductPrice] = useState(2450);
  const [newProductVolume, setNewProductVolume] = useState('750 ml');
  const [newProductABV, setNewProductABV] = useState(42.8);
  const [newProductAlcoholic, setNewProductAlcoholic] = useState(true);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [dash, prodRes, storesRes, compRes, logsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get<{ items: Product[] }>('/products?limit=100'),
        api.get<Store[]>('/stores'),
        api.get<PlatformComplianceSettings>('/admin/compliance'),
        api.get<any[]>('/admin/audit-logs'),
      ]);

      setDashboardData(dash);
      setProducts(prodRes.items || []);
      setStores(storesRes || []);
      setCompliance(compRes);
      setAuditLogs(logsRes || []);
    } catch (e) {
      console.warn('Error loading admin analytics', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    try {
      await api.post('/admin/products', {
        name: newProductName,
        brandName: newProductBrand,
        categoryId: newProductCategory,
        categoryName: newProductCategory === 'cat_beer' ? 'Beer' : 'Whisky',
        subcategory: 'Single Malt',
        price: Number(newProductPrice),
        mrp: Number(newProductPrice) + 200,
        volume: newProductVolume,
        alcoholByVolume: Number(newProductABV),
        isAlcoholic: newProductAlcoholic,
        description: 'Premium curated beverage.',
        tastingNotes: ['Complex', 'Smooth', 'Aromatic'],
        country: 'India',
        isFeatured: true,
      });

      setShowAddProduct(false);
      setNewProductName('');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to add product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Delete this product from catalog and purge micro-warehouse stock?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Could not delete product');
    }
  };

  const handleSaveCompliance = async () => {
    if (!compliance) return;
    try {
      await api.post('/admin/compliance', compliance);
      alert('Excise and compliance rules updated successfully!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update compliance');
    }
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="py-20 text-center text-slate-400 text-xs">
        Loading DrinkIt Enterprise Command Center...
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Executive Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900">DRINKIT Operations Command</h1>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              SUPER ADMIN
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time urban quick-commerce logistics, inventory reconciliation, and state excise compliance
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              activeTab === 'analytics' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analytics & Sales</span>
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              activeTab === 'coupons' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Coupons & Offers</span>
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              activeTab === 'catalog' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Catalog ({products.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              activeTab === 'compliance' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Excise & Compliance</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              activeTab === 'audit' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
          <button
            onClick={fetchAdminData}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Refresh analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab 1: Comprehensive Recharts Analytics Visualizations */}
      {activeTab === 'analytics' && (
        <AnalyticsTab onRefreshTrigger={fetchAdminData} />
      )}

      {/* Tab 2: Advanced Rule-Based Coupon Engine */}
      {activeTab === 'coupons' && (
        <CouponsTab />
      )}

      {/* Tab 3: Catalog CRUD */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Product Catalog Management
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Add, modify or delist drinks and automatically provision micro-warehouse stocks
              </p>
            </div>
            <button
              onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          </div>

          {/* New Product Modal */}
          {showAddProduct && (
            <form
              onSubmit={handleAddProduct}
              className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 text-xs shadow-xs"
            >
              <div className="font-extrabold text-slate-900 text-sm">Add Product to Catalog</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paul John Nirvana"
                    value={newProductName}
                    onChange={e => setNewProductName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Brand Name</label>
                  <input
                    type="text"
                    required
                    value={newProductBrand}
                    onChange={e => setNewProductBrand(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Category</label>
                  <select
                    value={newProductCategory}
                    onChange={e => setNewProductCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="cat_whisky">Whisky</option>
                    <option value="cat_beer">Beer</option>
                    <option value="cat_gin">Gin</option>
                    <option value="cat_vodka">Vodka</option>
                    <option value="cat_wine">Wine</option>
                    <option value="cat_mixers">Mixers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Volume</label>
                  <input
                    type="text"
                    required
                    value={newProductVolume}
                    onChange={e => setNewProductVolume(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">ABV %</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newProductABV}
                    onChange={e => setNewProductABV(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
                >
                  Save & Provision Stock
                </button>
              </div>
            </form>
          )}

          {/* Product Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Volume</th>
                  <th className="p-3.5">ABV</th>
                  <th className="p-3.5">Price</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 flex items-center gap-2.5">
                      <img src={p.imageUrl} alt={p.name} className="w-8 h-8 object-contain rounded-lg bg-slate-50 border border-slate-100" />
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{p.brandName}</div>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">{p.categoryName}</td>
                    <td className="p-3.5 text-slate-600 font-medium">{p.volume}</td>
                    <td className="p-3.5 text-emerald-700 font-extrabold">
                      {p.isAlcoholic ? `${p.alcoholByVolume}%` : '0%'}
                    </td>
                    <td className="p-3.5 font-black text-slate-900">₹{p.price}</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Excise & Compliance */}
      {activeTab === 'compliance' && compliance && (
        <div className="max-w-2xl space-y-5 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>State Excise Compliance & Legal Age Configuration</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Enforce state-mandated alcohol control laws across checkout and dispatch
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Legal Drinking Age (Years)
              </label>
              <input
                type="number"
                value={compliance.legalDrinkingAge}
                onChange={e =>
                  setCompliance({ ...compliance, legalDrinkingAge: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400">21 in Karnataka; 25 in Delhi/Maharashtra</span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Maximum Alcoholic Bottles Per Order
              </label>
              <input
                type="number"
                value={compliance.maxBottlesPerOrder}
                onChange={e =>
                  setCompliance({ ...compliance, maxBottlesPerOrder: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400">State retail carry limit</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compliance.dryDayActive}
                  onChange={e => setCompliance({ ...compliance, dryDayActive: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-extrabold text-slate-900 text-xs">
                  Declare Dry Day (Emergency Alcohol Lockout)
                </span>
              </label>
              <p className="text-[11px] text-slate-500 font-medium">
                When active, the platform strictly blocks all alcohol purchases across all stores in compliance with state election or national holidays.
              </p>
              {compliance.dryDayActive && (
                <input
                  type="text"
                  placeholder="Reason for Dry Day (e.g. State Election Day / National Holiday)"
                  value={compliance.dryDayReason || ''}
                  onChange={e => setCompliance({ ...compliance, dryDayReason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 font-bold"
                />
              )}
            </div>

            <button
              onClick={handleSaveCompliance}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-xs transition-colors"
            >
              Save Excise Settings
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Cryptographically Verifiable System & Delivery Audit Logs</span>
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-900">{log.actorName}</span>{' '}
                      <span className="text-[10px] text-slate-400 font-medium">({log.actorRole})</span>
                    </td>
                    <td className="p-3 font-mono text-emerald-700 font-extrabold">{log.action}</td>
                    <td className="p-3 text-slate-600 font-medium">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
