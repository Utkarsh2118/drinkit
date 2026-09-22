import React from 'react';
import { Heart, ShoppingBag, Trash2, AlertCircle } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext.tsx';
import { Product } from '../types.ts';

interface WishlistViewProps {
  onBrowse: () => void;
  onSelectProduct: (product: Product) => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({ onBrowse, onSelectProduct }) => {
  const { wishlist, removeFromWishlist, moveToCart, isLoading } = useWishlist();

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            <span>Your Wishlist ({wishlist.length})</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">Synced securely with your DrinkIt customer profile</p>
        </div>
        {isLoading && (
          <span className="text-[11px] font-semibold text-emerald-800 animate-pulse">Syncing...</span>
        )}
      </div>

      {wishlist.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <div className="text-base font-extrabold text-slate-900">Your wishlist is empty</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Click the heart icon on any craft beer, single malt, or mixer to save it here for quick ordering.
          </p>
          <button
            onClick={onBrowse}
            className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-xs transition-colors"
          >
            Explore Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlist.map(product => {
            const isOutOfStock = product.stock !== undefined ? product.stock <= 0 : false;
            return (
              <div
                key={product.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition-all flex flex-col justify-between relative group"
              >
                <div
                  className="cursor-pointer flex items-center gap-3 mb-3"
                  onClick={() => onSelectProduct(product)}
                >
                  <div className="relative">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className={`w-16 h-16 object-contain bg-slate-50 rounded-xl p-1 shrink-0 border border-slate-100 ${
                        isOutOfStock ? 'opacity-60 grayscale-[40%]' : ''
                      }`}
                    />
                    {isOutOfStock && (
                      <span className="absolute inset-0 bg-slate-900/40 rounded-xl flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider">{product.brandName}</div>
                    <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{product.name}</h4>
                    <div className="text-[11px] text-slate-500 font-medium">{product.volume}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-black text-slate-900">₹{product.price}</span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          Currently unavailable
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                          In Stock ({product.stock})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => moveToCart(product)}
                    disabled={isOutOfStock}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs ${
                      isOutOfStock
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{isOutOfStock ? 'Currently Unavailable' : 'Move to Cart'}</span>
                  </button>
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
