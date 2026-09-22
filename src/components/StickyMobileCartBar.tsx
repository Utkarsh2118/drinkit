import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext.tsx';

interface StickyMobileCartBarProps {
  onOpenCart?: () => void;
}

export const StickyMobileCartBar: React.FC<StickyMobileCartBarProps> = ({ onOpenCart }) => {
  const { totalItemCount, totalAmount, openCartDrawer, isCartDrawerOpen } = useCart();

  // Only show if items exist in cart and cart drawer is not currently open
  if (totalItemCount === 0 || isCartDrawerOpen) {
    return null;
  }

  const handleClick = () => {
    if (onOpenCart) {
      onOpenCart();
    } else {
      openCartDrawer();
    }
  };

  return (
    <div
      className="sm:hidden fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 animate-fade-in pointer-events-none"
    >
      <button
        type="button"
        onClick={handleClick}
        className="pointer-events-auto w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow-lg shadow-emerald-900/20 flex items-center justify-between transition-all active:scale-98 border border-emerald-500/40"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs font-black tracking-tight">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} • ₹{totalAmount}
            </div>
            <div className="text-[10px] text-emerald-100 font-semibold">
              ⚡ Delivery in 20-30 mins
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-colors shrink-0">
          <span>View Cart</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      </button>
    </div>
  );
};
