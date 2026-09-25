import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, Minus, Tag, Zap, ShieldCheck, ArrowRight, Sparkles, Check, AlertTriangle, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext.tsx';
import { useLocation } from '../context/LocationContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { api } from '../services/api.ts';
import { PlatformComplianceSettings } from '../types.ts';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onProceedToCheckout }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const {
    items,
    totalItemCount,
    subtotal,
    discount,
    deliveryFee,
    handlingFee,
    taxes,
    totalAmount,
    couponCode,
    appliedCoupon,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    isCartDrawerOpen,
    closeCartDrawer,
  } = useCart();

  const { selectedLocation, estimatedDeliveryRange } = useLocation();
  const [couponInput, setCouponInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [couponStatusMsg, setCouponStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [compliance, setCompliance] = useState<PlatformComplianceSettings | null>(null);

  useEffect(() => {
    if (isCartDrawerOpen) {
      api.get<PlatformComplianceSettings>('/compliance').then(setCompliance).catch(() => {});
    }
  }, [isCartDrawerOpen]);

  if (!isCartDrawerOpen) return null;

  // Calculate total alcoholic bottles
  const totalAlcoholicBottles = items.reduce((acc, item) => {
    if (!item.product.isAlcoholic) return acc;
    const match = (item.product.volume || '').match(/(\d+)\s*x/);
    const count = match ? parseInt(match[1], 10) : 1;
    return acc + item.quantity * count;
  }, 0);

  const maxBottles = compliance?.maxBottlesPerOrder || 6;
  const isBottleLimitExceeded = totalAlcoholicBottles > maxBottles;
  const isDryDayActive = Boolean(compliance?.dryDayActive && totalAlcoholicBottles > 0);

  const freeDeliveryThreshold = 999;
  const remainingForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);
  const freeDeliveryProgress = Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100));

  const popularCoupons = [
    { code: 'WELCOME50', desc: 'Flat ₹50 OFF on first order (Min ₹499)' },
    { code: 'CHEERS100', desc: 'Flat ₹100 OFF on orders > ₹1,499' },
    { code: 'PARTY15', desc: '15% OFF up to ₹350 (Min ₹2,000)' },
    { code: 'BEERLOVER20', desc: '20% OFF on all Beers (Max ₹250)' },
  ];

  const handleApplyCoupon = async (codeToApply: string) => {
    if (!codeToApply.trim()) return;
    setIsApplying(true);
    setCouponStatusMsg(null);
    const result = await applyCoupon(codeToApply.trim());
    setIsApplying(false);
    if (result.success) {
      setCouponStatusMsg({ type: 'success', text: result.message });
      setCouponInput('');
    } else {
      setCouponStatusMsg({ type: 'error', text: result.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-slide-left">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900 text-base">My Cart</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={closeCartDrawer}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Delivery Meter */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
              <Zap className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              <span>Delivering to {selectedLocation.label} in {estimatedDeliveryRange}</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">
              {remainingForFreeDelivery === 0 ? 'FREE Delivery unlocked! 🎉' : `Add ₹${remainingForFreeDelivery} for FREE delivery`}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${freeDeliveryProgress}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-xs">
                <Tag className="w-8 h-8 stroke-1" />
              </div>
              <div className="font-bold text-slate-900 text-base">Your cart is empty</div>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Explore our ice-cold craft beers, single malt whiskies, fine gins, and party snacks.
              </p>
              <button
                onClick={closeCartDrawer}
                className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs"
              >
                Browse Drinks
              </button>
            </div>
          ) : (
            <>
              {items.map(item => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 gap-3 shadow-xs"
                >
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-12 h-12 object-contain bg-slate-50 border border-slate-100 rounded-xl p-1 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-slate-900 text-xs truncate leading-tight">
                      {item.product.name}
                    </h5>
                    <div className="text-[10px] text-slate-500">{item.product.volume}</div>
                    <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                      ₹{item.product.price * item.quantity}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        (₹{item.product.price} each)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center bg-emerald-600 text-white rounded-lg p-0.5 shrink-0 shadow-xs">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded-md hover:bg-emerald-700 flex items-center justify-center text-white"
                    >
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <span className="text-xs font-bold text-white px-1.5">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded-md hover:bg-emerald-700 text-white flex items-center justify-center font-bold"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Coupon Section */}
              <div className="pt-2">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Offers & Coupons</span>
                    </span>
                    {appliedCoupon && (
                      <button
                        onClick={removeCoupon}
                        className="text-[11px] text-rose-600 hover:underline font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {couponStatusMsg && (
                    <div
                      className={`p-2 rounded-xl text-xs font-medium border flex items-center justify-between gap-2 ${
                        couponStatusMsg.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <span>{couponStatusMsg.text}</span>
                      <button
                        onClick={() => setCouponStatusMsg(null)}
                        className="text-[10px] opacity-70 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {appliedCoupon ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold flex items-center gap-1 text-emerald-900">
                          <Check className="w-3.5 h-3.5 text-emerald-700" /> {appliedCoupon.code} Applied
                        </span>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          {appliedCoupon.description || 'Promotion applied to order'}
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-700">-₹{discount}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter Coupon Code (e.g. WELCOME50)"
                          value={couponInput}
                          onChange={e => setCouponInput(e.target.value.toUpperCase())}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 font-semibold"
                        />
                        <button
                          onClick={() => handleApplyCoupon(couponInput)}
                          disabled={!couponInput.trim() || isApplying}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs"
                        >
                          {isApplying ? 'Checking...' : 'Apply'}
                        </button>
                      </div>

                      {/* Quick click chips */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                          Available Coupons
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {popularCoupons.map(c => (
                            <button
                              key={c.code}
                              onClick={() => handleApplyCoupon(c.code)}
                              className="text-left p-2 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center justify-between group"
                            >
                              <div>
                                <span className="text-[11px] font-extrabold text-emerald-700 tracking-wide">
                                  {c.code}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  {c.desc}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700">
                                Apply →
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bill Details */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs space-y-2 shadow-xs">
                <div className="font-extrabold text-slate-900 text-xs pb-1 border-b border-slate-100">
                  Bill Summary
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Item Total</span>
                  <span className="text-slate-900 font-semibold">₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Coupon Savings</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Delivery Fee</span>
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-700 font-bold">FREE</span>
                  ) : (
                    <span className="text-slate-900 font-semibold">₹{deliveryFee}</span>
                  )}
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Handling & Bottle Packaging</span>
                  <span className="text-slate-900 font-semibold">₹{handlingFee}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Excise & State GST (5%)</span>
                  <span className="text-slate-900 font-semibold">₹{taxes}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between font-extrabold text-sm text-slate-900">
                  <span>Grand Total</span>
                  <span className="text-slate-900 text-base font-black">₹{totalAmount}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Checkout CTA */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-white space-y-2.5">
            {/* Regulatory Compliance Feedback */}
            {isDryDayActive ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Dry Day Active:</span>
                  <p className="text-[11px] mt-0.5 text-rose-700">
                    Alcohol sales are legally prohibited today ({compliance?.dryDayReason || 'Statutory Excise Mandate'}). Please remove alcohol items to proceed.
                  </p>
                </div>
              </div>
            ) : isBottleLimitExceeded ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Excise Limit Exceeded:</span>
                  <p className="text-[11px] mt-0.5 text-amber-800">
                    Maximum {maxBottles} bottles of alcohol permitted per order under State Excise Rules. You currently have {totalAlcoholicBottles} bottles.
                  </p>
                </div>
              </div>
            ) : totalAlcoholicBottles > 0 ? (
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-medium">Excise Retail Carry Limit:</span>
                <span className="font-bold text-slate-800">{totalAlcoholicBottles} / {maxBottles} bottles</span>
              </div>
            ) : null}

            <button
              onClick={() => {
                if (isDryDayActive || isBottleLimitExceeded) return;
                closeCartDrawer();
                if (!user) {
                  navigate('/login?redirect=/checkout');
                } else {
                  onProceedToCheckout();
                }
              }}
              disabled={isDryDayActive || isBottleLimitExceeded}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-sm flex items-center justify-between shadow-md transition-all active:scale-98"
            >
              <div className="text-left leading-tight">
                <div className="text-[10px] uppercase font-bold text-emerald-100 tracking-wider">
                  Total Payable
                </div>
                <div className="text-base font-black">₹{totalAmount}</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-extrabold">
                <span>{isDryDayActive ? 'Dry Day — Paused' : isBottleLimitExceeded ? 'Exceeds Limit' : 'Proceed to Checkout'}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Age verified 21+ • Safe contactless delivery</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
