import React, { useState, useEffect } from 'react';
import {
  Building2,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { Order, Store } from '../types.ts';
import { api } from '../services/api.ts';

export const StoreStaffView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeData, setStoreData] = useState<{ store: Store; inventory: any[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'inventory'>('queue');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchStoreOps = async () => {
    setIsLoading(true);
    try {
      const ordersData = await api.get<Order[]>('/orders');
      setOrders(ordersData.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'));

      const storeRes = await api.get<{ store: Store; inventory: any[] }>('/stores/store_indiranagar');
      setStoreData(storeRes);
    } catch (e) {
      console.warn('Error loading store staff data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreOps();
    const timer = setInterval(fetchStoreOps, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: string, note: string) => {
    try {
      await api.post(`/orders/${orderId}/status`, { status: nextStatus, note });
      setActionSuccess(`Order updated to ${nextStatus}!`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchStoreOps();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleAdjustStock = async (productId: string, newQuantity: number) => {
    try {
      await api.post('/stores/inventory/adjust', {
        storeId: 'store_indiranagar',
        productId,
        quantity: Math.max(0, newQuantity),
      });
      fetchStoreOps();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  const filteredInventory = storeData?.inventory.filter(item =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.brandName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Store Header */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">
                {storeData?.store.name || 'Indiranagar Micro-Warehouse (Hub #01)'}
              </h2>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                ACTIVE FULFILLMENT
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {storeData?.store.address} • Operating 10:00 AM - 11:30 PM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              activeTab === 'queue'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Fulfillment Queue ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Store Inventory ({storeData?.inventory.length || 0})
          </button>
          <button
            onClick={fetchStoreOps}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
          {actionSuccess}
        </div>
      )}

      {/* Tab 1: Fulfillment Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>Live Orders Requiring Packing & Handover</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Auto-refreshing live orders</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-2 shadow-xs">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto opacity-80" />
              <div className="text-sm font-extrabold text-slate-900">All orders packed!</div>
              <p className="text-xs text-slate-500 font-medium">No pending orders awaiting fulfillment right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.map(order => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="font-mono font-black text-slate-900 text-sm">{order.orderNumber}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{order.userName} ({order.userPhone})</div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                      {order.status}
                    </span>
                  </div>

                  {/* Bottle items list */}
                  <div className="space-y-1.5 text-xs">
                    {order.items.map(i => (
                      <div key={i.productId} className="flex items-center justify-between text-slate-700">
                        <span className="font-bold text-slate-900">
                          {i.quantity}x {i.productName}
                        </span>
                        <span className="text-slate-500 font-medium">{i.volume}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                    <span className="font-medium">Target ETA: {order.estimatedDeliveryTime}</span>
                    <span className="font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                      OTP: {order.deliveryOtp}
                    </span>
                  </div>

                  {/* Actions based on current status */}
                  <div className="flex items-center gap-2 pt-1">
                    {order.status === 'PLACED' && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(order.id, 'PREPARING', 'Store staff began chilled packing')
                        }
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                      >
                        Start Packing Bottles
                      </button>
                    )}

                    {order.status === 'PREPARING' && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(
                            order.id,
                            'READY_FOR_PICKUP',
                            'Packed in tamper-evident sealed insulated bag. Ready for pickup.'
                          )
                        }
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                      >
                        Mark Ready For Pickup
                      </button>
                    )}

                    {order.status === 'READY_FOR_PICKUP' && (
                      <div className="w-full text-center py-2 text-xs text-amber-800 font-bold bg-amber-50 border border-amber-200 rounded-xl">
                        Awaiting Delivery Rider Pickup
                      </div>
                    )}

                    {order.status === 'OUT_FOR_DELIVERY' && (
                      <div className="w-full text-center py-2 text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 rounded-xl">
                        Rider {order.deliveryAgentName || 'Vikram'} Out for Delivery
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Store Inventory */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Search store inventory..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredInventory.length} products
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Price</th>
                  <th className="p-3.5">Available</th>
                  <th className="p-3.5">Reserved</th>
                  <th className="p-3.5 text-right">Adjust Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map(item => {
                  const isLow = item.available <= item.lowStockThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{item.brandName}</div>
                      </td>
                      <td className="p-3.5 text-slate-600 font-medium">{item.categoryName}</td>
                      <td className="p-3.5 font-extrabold text-slate-900">₹{item.price}</td>
                      <td className="p-3.5">
                        <span
                          className={`font-black px-2 py-0.5 rounded ${
                            isLow ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {item.available} units
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 font-medium">{item.reservedQuantity}</td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                          <button
                            onClick={() => handleAdjustStock(item.productId, item.quantity - 5)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Decrease 5"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-slate-900 px-1">{item.quantity}</span>
                          <button
                            onClick={() => handleAdjustStock(item.productId, item.quantity + 10)}
                            className="p-1 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                            title="Add 10"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
