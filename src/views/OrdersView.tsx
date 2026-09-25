import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, ChevronRight, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { Order } from '../types.ts';
import { api } from '../services/api.ts';
import { useCart } from '../context/CartContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

interface OrdersViewProps {
  onTrackOrder: (orderId: string) => void;
  onBrowse: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onTrackOrder, onBrowse }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { addItem, openCartDrawer } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchOrders = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.get<Order[]>('/orders');
      setOrders(data);
    } catch (e) {
      console.warn('Could not fetch orders', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center animate-fade-in">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl border border-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-2xs">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-1.5">Sign in to view orders</h2>
        <p className="text-slate-500 mb-6 text-xs max-w-sm mx-auto leading-relaxed">
          Log in with your mobile number to track live deliveries, review past orders, and download excise tax invoices.
        </p>
        <button
          onClick={() => navigate('/login?redirect=/orders')}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold shadow-sm transition-all text-sm flex items-center justify-center gap-2 mx-auto cursor-pointer"
        >
          <span>Sign In with Mobile OTP</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const handleReorder = (order: Order) => {
    order.items.forEach(item => {
      addItem({
        id: item.productId,
        name: item.productName,
        slug: item.productName.toLowerCase().replace(/\s+/g, '-'),
        brandId: 'reorder',
        brandName: 'DrinkIt',
        categoryId: 'cat_beverages',
        categoryName: 'Drinks',
        subcategory: 'Favorites',
        price: item.price,
        mrp: item.price,
        volume: item.volume,
        alcoholByVolume: 40,
        isAlcoholic: true,
        description: 'Reordered item',
        tastingNotes: [],
        imageUrl: item.productImage,
        country: 'India',
        rating: 5,
        reviewCount: 1,
        isActive: true,
      });
    });
    openCartDrawer();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'OUT_FOR_DELIVERY':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 animate-pulse';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Your Orders</h2>
          <p className="text-xs text-slate-500 font-medium">Track current deliveries & order history</p>
        </div>
        <button
          onClick={fetchOrders}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs transition-colors"
          title="Refresh orders"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-32 rounded-2xl bg-slate-100 border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <div className="text-base font-extrabold text-slate-900">No orders placed yet</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Your drinks will appear here with live GPS tracking and delivery verification PINs once placed.
          </p>
          <button
            onClick={onBrowse}
            className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-xs transition-colors"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {orders.map(order => (
            <div
              key={order.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition-all space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black text-slate-900 text-sm">{order.orderNumber}</span>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusBadge(
                      order.status
                    )}`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900">₹{order.totalAmount}</div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                {order.items.map(item => (
                  <div key={item.productId} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="truncate max-w-[280px] font-medium">
                      {item.quantity}x {item.productName} ({item.volume})
                    </span>
                    <span className="text-slate-900 font-bold">₹{item.subtotal}</span>
                  </div>
                ))}
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReorder(order)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    Reorder
                  </button>
                  <button
                    onClick={() => onTrackOrder(order.id)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors shadow-xs"
                  >
                    <span>Track Order</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
