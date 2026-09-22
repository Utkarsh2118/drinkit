import React from 'react';
import { Plus, Minus, Star, Heart, Zap } from 'lucide-react';
import { Product } from '../types.ts';
import { useCart } from '../context/CartContext.tsx';
import { useWishlist } from '../context/WishlistContext.tsx';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const quantity = getItemQuantity(product.id);
  const isWishlisted = isInWishlist(product.id);
  const discountPercent =
    product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <div className="group relative flex flex-col justify-between bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-2.5 sm:p-3 transition-colors shadow-xs">
      {/* Product Image Stage */}
      <div
        className="relative w-full aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 flex items-center justify-center p-2.5 sm:p-3 cursor-pointer border border-slate-100"
        onClick={() => onSelect(product)}
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
        />

        {/* Wishlist Button - 44px hit boundary with comfortable touch */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            toggleWishlist(product);
          }}
          className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1.5 rounded-full bg-white/95 border border-slate-200 hover:border-rose-300 text-slate-400 hover:text-rose-500 shadow-xs transition-colors z-10 touch-manipulation"
          title={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Discount badge */}
        {discountPercent > 0 && (
          <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs">
            {discountPercent}% OFF
          </span>
        )}

        {/* Delivery speed badge */}
        <span className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/95 border border-slate-200 text-slate-700 flex items-center gap-1 shadow-xs">
          <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600 shrink-0" />
          <span>20 MIN</span>
        </span>

        {/* ABV or Zero-Alcohol pill */}
        <span className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/95 border border-slate-200 text-slate-600 shadow-xs">
          {product.isAlcoholic ? `${product.alcoholByVolume}% ABV` : '0% Alc'}
        </span>
      </div>

      {/* Product Content & Typography Hierarchy */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Brand Name */}
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 truncate">
            {product.brandName}
          </div>

          {/* Product Name */}
          <h4
            onClick={() => onSelect(product)}
            className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 hover:text-emerald-700 transition-colors cursor-pointer mb-1 min-h-[2rem] sm:min-h-[2.5rem]"
            title={product.name}
          >
            {product.name}
          </h4>

          {/* Volume Specification */}
          <div className="text-[10px] sm:text-xs text-slate-500 font-semibold mb-2">
            {product.volume}
          </div>
        </div>

        {/* Footer: Price Information & Compact 'ADD' / Quantity Control */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Price Hierarchy */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap leading-none">
              <span className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight">
                ₹{product.price}
              </span>
              {product.mrp > product.price && (
                <span className="text-[9px] sm:text-[11px] text-slate-400 line-through font-medium">
                  ₹{product.mrp}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-500 mt-1">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-400 shrink-0" />
              <span className="font-bold text-slate-700">{product.rating}</span>
              <span className="text-slate-400 hidden xs:inline">({product.reviewCount || 18})</span>
            </div>
          </div>

          {/* Compact 'ADD' Button / Quantity Control Stepper */}
          <div className="shrink-0">
            {quantity === 0 ? (
              <button
                type="button"
                onClick={() => addItem(product)}
                className="h-8 sm:h-8.5 px-3 sm:px-4 rounded-xl border border-emerald-600 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-700 font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center shadow-xs touch-manipulation min-w-[54px]"
                title={`Add ${product.name} to cart`}
              >
                ADD
              </button>
            ) : (
              <div className="h-8 sm:h-8.5 flex items-center bg-emerald-600 text-white rounded-xl px-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => updateQuantity(product.id, -1)}
                  className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 flex items-center justify-center text-white active:scale-90 transition-transform touch-manipulation"
                  aria-label="Decrease quantity"
                  title="Decrease quantity"
                >
                  <Minus className="w-3 h-3 stroke-[3]" />
                </button>
                <span className="text-xs sm:text-sm font-black text-white px-1.5 sm:px-2 min-w-[20px] text-center font-mono">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(product.id, 1)}
                  className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 flex items-center justify-center text-white active:scale-90 transition-transform touch-manipulation"
                  aria-label="Increase quantity"
                  title="Increase quantity"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
