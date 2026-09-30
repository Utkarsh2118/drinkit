import React, { useState, useEffect } from 'react';
import { Truck, ChevronRight, Zap, Clock, ShieldCheck } from 'lucide-react';
import { Order } from '../types.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { socketClient } from '../services/socketClient.ts';

interface ActiveOrderBannerProps {
  onTrackOrder: (orderId: string) => void;
}

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({ onTrackOrder }) => {
  const { user } = useAuth();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const fetchActiveOrder = async () => {
    if (!user) {
      setActiveOrder(null);
      return;
    }
    try {
      const orders = await api.get<Order[]>('/orders');
      if (Array.isArray(orders)) {
        // Find most recent order that is not terminal
        const terminalStatuses = ['DELIVERED', 'CANCELLED', 'REFUNDED', 'DELIVERY_FAILED'];
        const active = orders.find(o => !terminalStatuses.includes(o.status));
        setActiveOrder(active || null);
      }
    } catch {
      // Quiet fail if guest or offline
    }
  };

  useEffect(() => {
    fetchActiveOrder();

    // Re-check periodically
    const timer = setInterval(fetchActiveOrder, 8000);

    // Listen to real-time socket events for customer
    const socket = socketClient.getSocket();
    if (socket) {
      socket.on('customer:order_updated', fetchActiveOrder);
      socket.on('order:status_changed', fetchActiveOrder);
      socket.on('order:delivered', fetchActiveOrder);
    }

    return () => {
      clearInterval(timer);
      if (socket) {
        socket.off('customer:order_updated', fetchActiveOrder);
        socket.off('order:status_changed', fetchActiveOrder);
        socket.off('order:delivered', fetchActiveOrder);
      }
    };
  }, [user]);

  if (!activeOrder) return null;

  return (
    <div className="mb-4 p-3.5 sm:p-4 rounded-3xl bg-linear-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white shadow-md border border-emerald-700/60 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner">
          <Truck className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-black text-emerald-300">
              ORDER #{activeOrder.orderNumber}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              {activeOrder.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-xs text-slate-200 font-medium mt-0.5 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>
              Arriving in{' '}
              <strong className="text-white font-bold">
                {activeOrder.estimatedDeliveryTime || '20–30 min'}
              </strong>
            </span>
            {activeOrder.deliveryOtp && (
              <span className="ml-1 text-[11px] text-emerald-200 font-mono">
                • PIN: {activeOrder.deliveryOtp}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => onTrackOrder(activeOrder.id)}
        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
      >
        <span>Track Order</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
