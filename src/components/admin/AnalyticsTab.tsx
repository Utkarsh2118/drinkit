import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Users,
  Repeat,
  RefreshCw,
  Package,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { AnalyticsData } from '../../types.ts';
import { api } from '../../services/api.ts';

interface AnalyticsTabProps {
  onRefreshTrigger?: () => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ onRefreshTrigger }) => {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockSuccessMsg, setRestockSuccessMsg] = useState<string | null>(null);

  const fetchAnalytics = async (tf: 'daily' | 'weekly' | 'monthly') => {
    setIsLoading(true);
    try {
      const res = await api.get<AnalyticsData>(`/admin/analytics?timeframe=${tf}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe]);

  const handleQuickRestock = async (item: AnalyticsData['lowStockItems'][0]) => {
    setRestockingId(item.id);
    try {
      await api.post('/admin/inventory/adjust', {
        storeId: item.storeId,
        productId: item.productId,
        quantity: item.quantity + 25,
      });
      setRestockSuccessMsg(`Restocked +25 units for ${item.productName} at ${item.storeName}`);
      setTimeout(() => setRestockSuccessMsg(null), 4000);
      await fetchAnalytics(timeframe);
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (e: any) {
      alert(e.message || 'Restock failed');
    } finally {
      setRestockingId(null);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="py-24 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
        <span>Synthesizing live store orders, repeat cohorts, and sales telemetry...</span>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalOrders: 0,
    todayOrdersCount: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    averageOrderValue: 0,
    activeDeliveries: 0,
    lowStockCount: 0,
    totalCustomers: 0,
    activeStoresCount: 0,
    fulfillmentRate: 0,
    repeatCustomerRate: 0,
  };

  return (
    <div className="space-y-6">
      {/* Timeframe & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Executive Business Intelligence & Order Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Real-time urban telemetry across all {metrics.activeStoresCount} DrinkIt micro-warehouses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['daily', 'weekly', 'monthly'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  timeframe === tf
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf === 'daily' ? 'Daily (14d)' : tf === 'weekly' ? 'Weekly (8w)' : 'Monthly (6m)'}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(timeframe)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {restockSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fade-in font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{restockSuccessMsg}</span>
          </div>
          <button onClick={() => setRestockSuccessMsg(null)} className="text-slate-400 hover:text-slate-700 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Total Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900">₹{metrics.totalRevenue.toLocaleString()}</div>
          <div className="text-[10px] text-emerald-700 mt-1 font-bold">
            Today: ₹{metrics.todayRevenue.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{metrics.totalOrders}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">
            {metrics.todayOrdersCount} placed in 24h
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Avg Order Value</span>
            <ArrowUpRight className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900">₹{metrics.averageOrderValue}</div>
          <div className="text-[10px] text-blue-700 mt-1 font-bold">Per completed cart</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Active Deliveries</span>
            <Truck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{metrics.activeDeliveries}</div>
          <div className="text-[10px] text-purple-700 mt-1 font-bold">
            SLA: {metrics.fulfillmentRate}%
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Repeat Buyers</span>
            <Repeat className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-indigo-600">{metrics.repeatCustomerRate}%</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">
            {metrics.totalCustomers} total customers
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600">{metrics.lowStockCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Reorder needed</div>
        </div>
      </div>

      {/* Row 1: Sales & Orders Trajectory Chart */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Sales & Order Trajectory ({timeframe.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Aggregated beverage revenue and total order volumes across delivery hubs
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
              Revenue (₹ INR)
            </span>
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              Orders Volume
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.salesTrend || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="salesRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                yAxisId="revenue"
                stroke="#059669"
                fontSize={11}
                tickFormatter={v => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                tickLine={false}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                stroke="#3b82f6"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  color: '#0f172a',
                }}
                formatter={(value: any, name?: any) => {
                  if (name === 'revenue') return [`₹${Number(value).toLocaleString()}`, 'Revenue'];
                  if (name === 'orders') return [value, 'Orders Placed'];
                  return [value, String(name || '')];
                }}
              />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#salesRevenueGrad)"
              />
              <Bar
                yAxisId="orders"
                dataKey="orders"
                fill="#3b82f6"
                opacity={0.8}
                radius={[4, 4, 0, 0]}
                barSize={18}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Order Status Breakdown & Store Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Order Status Breakdown
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Live distribution of orders from hub placement to age-verified doorstep delivery
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.orderStatusBreakdown || []}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {(data?.orderStatusBreakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      color: '#0f172a',
                    }}
                    formatter={(val: any, name?: any) => [`${val} orders`, String(name || '')]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-xs">
              {(data?.orderStatusBreakdown || []).slice(0, 6).map(item => (
                <div key={item.status} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 font-medium truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono">
                    <span className="font-extrabold text-slate-900">{item.count}</span>
                    <span className="text-[10px] text-slate-500 font-medium">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Store Micro-Warehouse Performance */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Micro-Warehouse Fulfillment Metrics
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Revenue & order fulfillment across dark stores
              </p>
            </div>
            <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> All Hubs Active
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.storePerformance || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="area" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    color: '#0f172a',
                  }}
                  formatter={(val: any, name?: any) => {
                    if (name === 'revenue') return [`₹${Number(val).toLocaleString()}`, 'Store Revenue'];
                    if (name === 'ordersCount') return [val, 'Orders Processed'];
                    return [val, String(name || '')];
                  }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="revenue" />
                <Bar dataKey="ordersCount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="ordersCount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Customer Acquisition & Repeat Customer Cohorts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Acquisition Trend */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>New Customer Acquisition Velocity</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Registration rate and cumulative active consumer base
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.customerAcquisition || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    color: '#0f172a',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeCustomers"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#custGrad)"
                  name="Total Buyers"
                />
                <Bar
                  dataKey="newCustomers"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                  name="New Signups"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Repeat Customer Rates & Cohorts */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Repeat className="w-4 h-4 text-emerald-600" />
                <span>Repeat Purchase Rate & Loyalty Cohorts</span>
              </h3>
              <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {data?.repeatCustomerMetrics?.repeatCustomerRate || 0}% Repeat Rate
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Breakdown of one-time vs returning urban customers
            </p>
          </div>

          <div className="space-y-3 py-2">
            {(data?.repeatCustomerMetrics?.cohortDistribution || []).map(cohort => (
              <div key={cohort.name} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cohort.color }} />
                    <span className="font-bold text-slate-900">{cohort.name}</span>
                  </div>
                  <div className="font-mono text-xs">
                    <span className="font-bold text-slate-900">{cohort.customerCount} customers</span>
                    <span className="text-slate-500 ml-1.5 font-medium">({cohort.ordersCount} orders)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(8, cohort.percentage)}%`,
                      backgroundColor: cohort.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Total Transacting Customers:</span>
            <span className="font-extrabold text-slate-900 font-mono">
              {data?.repeatCustomerMetrics?.totalCustomers || 0} Accounts
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Top-Selling Products & Low-Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top-Selling Products */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Top-Selling Products Leaderboard
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Ranked by consumer demand and volume across cities
              </p>
            </div>
            <span className="text-xs text-emerald-700 font-bold">Volume (Units)</span>
          </div>

          <div className="space-y-2.5">
            {(data?.topSellingProducts || []).map((prod, idx) => (
              <div
                key={prod.productId}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-center font-mono font-bold text-slate-400">#{idx + 1}</span>
                  <img
                    src={prod.imageUrl}
                    alt={prod.productName}
                    className="w-10 h-10 object-contain rounded-xl bg-white border border-slate-100 p-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{prod.productName}</div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {prod.brandName} • {prod.categoryName}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-extrabold text-emerald-700 font-mono">
                    {prod.unitsSold} sold
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    ₹{prod.revenue.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low-Stock Reorder Alerts */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Low-Stock Micro-Warehouse Alerts</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Replenish inventory to prevent order cancellation
              </p>
            </div>
            <span className="text-xs font-bold text-rose-700 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200">
              {data?.lowStockItems?.length || 0} Action Items
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {(!data?.lowStockItems || data.lowStockItems.length === 0) ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                All micro-warehouses are safely above reorder thresholds!
              </div>
            ) : (
              data.lowStockItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-10 h-10 object-contain rounded-xl bg-white border border-slate-100 p-1 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{item.productName}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                        <MapPin className="w-2.5 h-2.5 text-slate-400" />
                        <span>{item.storeName}</span>
                      </div>
                      <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                        Stock: {item.available} units (Threshold: {item.lowStockThreshold})
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        item.severity === 'critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.severity}
                    </span>
                    <button
                      onClick={() => handleQuickRestock(item)}
                      disabled={restockingId === item.id}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] shadow-xs transition-colors"
                    >
                      {restockingId === item.id ? 'Restocking...' : '+25 Stock'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
