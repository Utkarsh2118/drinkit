import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Percent,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Sliders,
  Filter,
} from 'lucide-react';
import { Coupon } from '../../types.ts';
import { api } from '../../services/api.ts';

const AVAILABLE_CATEGORIES = [
  { id: 'cat_beer', name: 'Beer' },
  { id: 'cat_whisky', name: 'Whisky' },
  { id: 'cat_vodka', name: 'Vodka' },
  { id: 'cat_gin', name: 'Gin' },
  { id: 'cat_wine', name: 'Wine' },
  { id: 'cat_rum', name: 'Rum' },
  { id: 'cat_mixers', name: 'Mixers' },
  { id: 'cat_snacks', name: 'Snacks' },
];

export const CouponsTab: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form state for creating a new advanced coupon
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(15);
  const [maxDiscount, setMaxDiscount] = useState<number | ''>(250);
  const [minOrderValue, setMinOrderValue] = useState<number>(999);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [overallUsageLimit, setOverallUsageLimit] = useState<number | ''>(500);
  const [userUsageLimit, setUserUsageLimit] = useState<number | ''>(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<Coupon[]>('/coupons/admin/all');
      setCoupons(res || []);
    } catch (e: any) {
      console.warn('Failed to load coupons', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!code.trim()) {
      setActionError('Coupon code is required');
      return;
    }

    try {
      await api.post('/coupons/admin/create', {
        code: code.trim().toUpperCase(),
        description: description.trim() || `${discountValue}${discountType === 'percentage' ? '%' : '₹'} OFF`,
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrderValue) || 0,
        maxDiscount: maxDiscount !== '' ? Number(maxDiscount) : undefined,
        validFrom,
        validUntil,
        overallUsageLimit: overallUsageLimit !== '' ? Number(overallUsageLimit) : undefined,
        userUsageLimit: userUsageLimit !== '' ? Number(userUsageLimit) : undefined,
        applicableCategoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
      });

      setActionSuccess(`Coupon ${code.toUpperCase()} created successfully!`);
      setTimeout(() => setActionSuccess(null), 4000);
      setShowCreateModal(false);
      resetForm();
      fetchCoupons();
    } catch (e: any) {
      setActionError(e.message || 'Failed to create coupon');
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      await api.put(`/coupons/admin/${coupon.id}`, {
        isActive: !coupon.isActive,
      });
      fetchCoupons();
    } catch (e: any) {
      alert(e.message || 'Failed to update coupon status');
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}" permanently?`)) return;
    try {
      await api.delete(`/coupons/admin/${coupon.id}`);
      setActionSuccess(`Coupon ${coupon.code} deleted`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchCoupons();
    } catch (e: any) {
      alert(e.message || 'Failed to delete coupon');
    }
  };

  const resetForm = () => {
    setCode('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue(15);
    setMaxDiscount(250);
    setMinOrderValue(999);
    setOverallUsageLimit(500);
    setUserUsageLimit(1);
    setSelectedCategories([]);
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const activeCount = coupons.filter(c => c.isActive).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.overallUsageCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Metric Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">
              Advanced Coupon & Promotion Engine
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Create and enforce multi-factor discount rules, category gates, caps, and redemptions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Advanced Coupon</span>
          </button>
          <button
            onClick={fetchCoupons}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Refresh coupons"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Summary Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 text-xs font-medium">Total Coupons</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{coupons.length}</div>
          </div>
          <Tag className="w-6 h-6 text-emerald-600/70" />
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 text-xs font-medium">Active Campaigns</div>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">{activeCount}</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-600/70" />
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 text-xs font-medium">Total Verified Redemptions</div>
            <div className="text-2xl font-black text-blue-700 mt-0.5">{totalRedemptions}</div>
          </div>
          <DollarSign className="w-6 h-6 text-blue-600/70" />
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">Create Advanced Rule-Based Coupon</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Coupon Promo Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SUMMER25"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono uppercase font-bold tracking-wider focus:outline-emerald-600 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Auto-formatted to uppercase</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Description / Marketing Tagline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 25% OFF on craft beers"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-emerald-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed">Fixed Amount (₹ Flat)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Discount Value {discountType === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={discountType === 'percentage' ? 100 : 50000}
                    value={discountValue}
                    onChange={e => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    placeholder={discountType === 'percentage' ? 'e.g. 250' : 'N/A for fixed'}
                    disabled={discountType === 'fixed'}
                    value={maxDiscount}
                    onChange={e => setMaxDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 disabled:opacity-40"
                  />
                  <span className="text-[10px] text-slate-500">Limits maximum savings</span>
                </div>
              </div>

              {/* Minimum Order Value & Date Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Min Order Value (MOV ₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderValue}
                    onChange={e => setMinOrderValue(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Valid From</label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={e => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={e => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Overall Platform Usage Limit
                  </label>
                  <input
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={overallUsageLimit}
                    onChange={e =>
                      setOverallUsageLimit(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
                  />
                  <span className="text-[10px] text-slate-500">Max times coupon can be redeemed across all users</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Per-User Usage Limit
                  </label>
                  <input
                    type="number"
                    placeholder="1 for single-use"
                    value={userUsageLimit}
                    onChange={e =>
                      setUserUsageLimit(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
                  />
                  <span className="text-[10px] text-slate-500">Limits abuse per customer ID</span>
                </div>
              </div>

              {/* Category Restrictions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-slate-700 font-bold">
                  Category Restrictions (Optional)
                </label>
                <p className="text-[11px] text-slate-500">
                  Select categories where this coupon applies. If none selected, the coupon applies to all products.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {AVAILABLE_CATEGORIES.map(cat => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {cat.name} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-xs"
                >
                  Save & Launch Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coupons Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            All Configured Coupons ({coupons.length})
          </span>
          <span className="text-xs text-slate-500 font-medium">
            Validated authoritatively on backend
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
              <tr>
                <th className="p-3.5">Code & Description</th>
                <th className="p-3.5">Discount Offer</th>
                <th className="p-3.5">Min Order</th>
                <th className="p-3.5">Validity Window</th>
                <th className="p-3.5">Usage Telemetry</th>
                <th className="p-3.5">Restrictions</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    No coupons configured yet. Click "Create Advanced Coupon" to add one.
                  </td>
                </tr>
              ) : (
                coupons.map(coupon => {
                  const isExpired = new Date(coupon.validUntil) < new Date();
                  const usagePercent = coupon.overallUsageLimit
                    ? Math.min(100, Math.round(((coupon.overallUsageCount || 0) / coupon.overallUsageLimit) * 100))
                    : null;

                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Code */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-emerald-700 text-sm tracking-wider">
                            {coupon.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5 max-w-xs">
                          {coupon.description}
                        </div>
                      </td>

                      {/* Offer */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900">
                          {coupon.discountType === 'percentage'
                            ? `${coupon.discountValue}% OFF`
                            : `₹${coupon.discountValue} FLAT`}
                        </div>
                        {coupon.maxDiscount && (
                          <div className="text-[10px] text-slate-500 font-medium">
                            Cap: ₹{coupon.maxDiscount}
                          </div>
                        )}
                      </td>

                      {/* Min Order */}
                      <td className="p-3.5 font-bold text-slate-700">
                        {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : 'None'}
                      </td>

                      {/* Validity */}
                      <td className="p-3.5">
                        <div className="text-slate-700 font-mono text-[11px] font-medium">
                          {coupon.validFrom} → {coupon.validUntil}
                        </div>
                        {isExpired && (
                          <span className="text-[10px] font-bold text-rose-600">EXPIRED</span>
                        )}
                      </td>

                      {/* Usage Telemetry */}
                      <td className="p-3.5 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                          <span className="text-slate-900 font-extrabold">{coupon.overallUsageCount || 0}</span>
                          <span className="text-slate-400 font-medium">/ {coupon.overallUsageLimit || '∞'} uses</span>
                        </div>
                        {usagePercent !== null && (
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          Limit: {coupon.userUsageLimit ? `${coupon.userUsageLimit}/user` : 'Unlimited'}
                        </div>
                      </td>

                      {/* Restrictions */}
                      <td className="p-3.5">
                        {coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {coupon.applicableCategoryIds.map(catId => {
                              const found = AVAILABLE_CATEGORIES.find(c => c.id === catId);
                              return (
                                <span
                                  key={catId}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200"
                                >
                                  {found?.name || catId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">All Products</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleStatus(coupon)}
                          className={`text-[10px] font-extrabold px-2 py-1 rounded-full border transition-all ${
                            coupon.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {coupon.isActive ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDeleteCoupon(coupon)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Coupon"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
