import React from 'react';
import { Home, Heart, Package, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../context/CartContext.tsx';
import { useWishlist } from '../context/WishlistContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface MobileBottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeView, setActiveView }) => {
  const { totalItemCount, totalAmount, openCartDrawer } = useCart();
  const { wishlist } = useWishlist();
  const { user } = useAuth();

  return (
    <nav
      aria-label="Mobile navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg"
    >
      {/* Home */}
      <button
        type="button"
        onClick={() => setActiveView('home')}
        className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 gap-0.5 text-[10px] font-extrabold transition-colors ${
          activeView === 'home' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <Home className="w-5 h-5" />
        <span>Drinks</span>
      </button>

      {/* Wishlist */}
      <button
        type="button"
        onClick={() => setActiveView('wishlist')}
        className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 gap-0.5 text-[10px] font-extrabold transition-colors relative ${
          activeView === 'wishlist' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <div className="relative">
          <Heart className={`w-5 h-5 ${wishlist.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
          {wishlist.length > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center shadow-xs">
              {wishlist.length}
            </span>
          )}
        </div>
        <span>Wishlist</span>
      </button>

      {/* Customer Orders */}
      <button
        type="button"
        onClick={() => setActiveView('orders')}
        className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 gap-0.5 text-[10px] font-extrabold transition-colors ${
          activeView === 'orders' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <Package className="w-5 h-5" />
        <span>Orders</span>
      </button>

      {/* Cart Button */}
      <button
        type="button"
        onClick={openCartDrawer}
        className="flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 gap-0.5 text-[10px] font-extrabold text-emerald-700 relative"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5 text-slate-700" />
          {totalItemCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-600 text-white text-[8px] font-black flex items-center justify-center shadow-xs">
              {totalItemCount}
            </span>
          )}
        </div>
        <span className="text-slate-900 font-extrabold font-mono">
          {totalAmount > 0 ? `₹${totalAmount}` : 'Cart'}
        </span>
      </button>

      {/* Profile */}
      <button
        type="button"
        onClick={() => setActiveView('profile')}
        className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 gap-0.5 text-[10px] font-extrabold transition-colors ${
          activeView === 'profile' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        {user?.avatarUrl ? (
          <div className="w-5 h-5 rounded-full overflow-hidden border border-emerald-500">
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <User className="w-5 h-5" />
        )}
        <span>Profile</span>
      </button>
    </nav>
  );
};
