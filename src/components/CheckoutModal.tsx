import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  ShieldCheck,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  Plus,
  Clock,
  Lock,
  ExternalLink,
  RotateCcw,
  Tag,
  Percent,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLocation } from '../context/LocationContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { api } from '../services/api.ts';
import { Order } from '../types.ts';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced: (order: Order) => void;
  onOpenAgeModal: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderPlaced,
  onOpenAgeModal,
}) => {
  const { user, isAgeVerified, addAddress } = useAuth();
  const { selectedLocation, activeStore, estimatedDeliveryRange, isServiceable, openLocationModal } = useLocation();
  const {
    items,
    subtotal,
    discount,
    deliveryFee,
    handlingFee,
    taxes,
    totalAmount,
    couponCode,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    clearCart,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApplyCouponCode = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) return;
    setIsApplyingCoupon(true);
    setCouponFeedback(null);
    const res = await applyCoupon(code);
    setIsApplyingCoupon(false);
    if (res.success) {
      setCouponFeedback({ success: true, message: res.message });
      setCouponInput('');
    } else {
      setCouponFeedback({ success: false, message: res.message });
    }
  };

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking' | 'cod'>('upi');
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Reservation State
  const [activeReservation, setActiveReservation] = useState<{
    reservationId: string;
    expiresAt: string;
    gatewayOrderId: string;
    amount: number;
    amountInPaise: number;
    keyId: string;
    isSandbox: boolean;
  } | null>(null);

  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [showSandboxSimulator, setShowSandboxSimulator] = useState(false);

  // New Address inline toggle
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddrLine, setNewAddrLine] = useState('');
  const [newPostalCode, setNewPostalCode] = useState(selectedLocation.postalCode || '201301');

  // Timer countdown for active reservation
  useEffect(() => {
    if (!activeReservation) {
      setTimeLeftSeconds(null);
      return;
    }

    const updateTimer = () => {
      const remainingMs = new Date(activeReservation.expiresAt).getTime() - Date.now();
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
      setTimeLeftSeconds(remainingSec);
      if (remainingSec <= 0) {
        setErrorMessage('Your 10-minute stock reservation expired. Please restart checkout.');
        setActiveReservation(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeReservation]);

  if (!isOpen) return null;

  const currentAddresses = user?.addresses && user.addresses.length > 0
    ? user.addresses
    : [
        {
          id: 'addr_default_1',
          label: 'home' as const,
          fullName: user?.name || 'Customer',
          phone: user?.phone || '+91 9876543210',
          addressLine1: selectedLocation.addressLine,
          city: selectedLocation.city || 'Noida',
          state: selectedLocation.state || 'Uttar Pradesh',
          postalCode: selectedLocation.postalCode,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          isDefault: true,
        },
      ];

  const deliveryAddress = currentAddresses[selectedAddressIndex] || currentAddresses[0];

  const handleCreateNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrLine.trim()) return;

    await addAddress({
      label: 'home',
      fullName: user?.name || 'Customer',
      phone: user?.phone || '+91 9876543210',
      addressLine1: newAddrLine,
      city: selectedLocation.city || 'Noida',
      state: selectedLocation.state || 'Uttar Pradesh',
      postalCode: newPostalCode,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
    });

    setShowAddAddress(false);
    setNewAddrLine('');
  };

  const handleCloseModal = () => {
    // If active reservation exists and order not confirmed, release it in background
    if (activeReservation) {
      api.post('/payments/release-reservation', {
        reservationId: activeReservation.reservationId,
        reason: 'Customer dismissed checkout modal',
      }).catch(e => console.warn('Release reservation error', e));
      setActiveReservation(null);
    }
    onClose();
  };

  /**
   * Complete payment verification on backend and confirm order
   */
  const handleVerifyAndConfirm = async (params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    reservationId: string;
  }) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await api.post<{ success: boolean; data: Order }>(
        '/payments/verify-and-confirm',
        {
          razorpay_order_id: params.razorpay_order_id,
          razorpay_payment_id: params.razorpay_payment_id,
          razorpay_signature: params.razorpay_signature,
          reservationId: params.reservationId,
          storeId: activeStore?.id || 'store_noida_sec18',
          deliveryAddress,
          couponCode: couponCode || undefined,
          paymentMethod,
        }
      );

      clearCart();
      setActiveReservation(null);
      onClose();
      onOrderPlaced(response.data);
    } catch (err: any) {
      console.error('Payment verification failed:', err);
      setErrorMessage(err.message || 'Payment verification failed. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Main Checkout Trigger:
   * 1. Check Age & Location
   * 2. For Online: Call /api/payments/create-order -> lock reservation & create gateway order
   * 3. Launch Razorpay / Sandbox Simulator
   * 4. For COD: Call /api/orders
   */
  const handlePlaceOrder = async () => {
    setErrorMessage(null);

    // 1. Mandatory Legal Age Check
    if (!isAgeVerified) {
      onOpenAgeModal();
      return;
    }

    // 2. Serviceability Check
    if (!isServiceable) {
      setErrorMessage('Selected location is outside our active delivery zone. Please change your delivery address.');
      return;
    }

    setIsProcessing(true);

    try {
      const targetStoreId = activeStore?.id || 'store_noida_sec18';

      if (paymentMethod === 'cod') {
        // Direct COD Order placement
        const orderPayload = {
          items: items.map(i => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
          storeId: targetStoreId,
          deliveryAddress,
          paymentMethod: 'cod',
          couponCode: couponCode || undefined,
          customerNotes: 'Doorstep Cash/UPI on delivery. 21+ recipient verified.',
        };

        const order = await api.post<Order>('/orders', orderPayload);
        clearCart();
        onClose();
        onOrderPlaced(order);
        return;
      }

      // Online Gateway Flow (UPI, Card, Netbanking)
      // Step 1: Atomic Inventory Reservation + Gateway Order Creation
      const paymentOrderResp = await api.post<{
        success: boolean;
        data: {
          gatewayOrderId: string;
          amount: number;
          amountInPaise: number;
          currency: string;
          keyId: string;
          reservationId: string;
          expiresAt: string;
          isSandbox: boolean;
        };
      }>('/payments/create-order', {
        items: items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        storeId: targetStoreId,
        deliveryAddress,
        couponCode: couponCode || undefined,
      });

      const resvData = paymentOrderResp.data;
      setActiveReservation(resvData);

      // Step 2: Try Opening Razorpay SDK Checkout Modal if loaded
      if (typeof window.Razorpay === 'function' && !resvData.isSandbox) {
        const rzp = new window.Razorpay({
          key: resvData.keyId,
          amount: resvData.amountInPaise,
          currency: resvData.currency,
          name: 'DrinkIt Quick-Commerce',
          description: `Order Payment (${items.length} items)`,
          order_id: resvData.gatewayOrderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: user?.phone || '',
          },
          theme: {
            color: '#059669',
          },
          handler: async (response: any) => {
            await handleVerifyAndConfirm({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              reservationId: resvData.reservationId,
            });
          },
          modal: {
            ondismiss: () => {
              // User closed standard popup
              setShowSandboxSimulator(true);
            },
          },
        });

        rzp.on('payment.failed', (response: any) => {
          setErrorMessage(`Payment failed: ${response.error.description}`);
        });

        rzp.open();
      } else {
        // In sandbox or when SDK script is in mock environment, display the simulator
        setShowSandboxSimulator(true);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'Failed to place order. Please check stock and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Format countdown mm:ss
  const formatTime = (secs: number | null) => {
    if (secs === null) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">Instant Checkout</h3>
              <p className="text-[11px] text-slate-500 font-medium">⚡ Estimated Delivery: {estimatedDeliveryRange}</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 bg-slate-50/50">
          {/* Reservation Lock Active Notification */}
          {activeReservation && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-950">
                    Stock Reserved Exclusively For You
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Hold expires in <span className="font-mono font-black">{formatTime(timeLeftSeconds)}</span> min
                  </div>
                </div>
              </div>
              <div className="px-2.5 py-1 bg-emerald-700 text-white rounded-xl text-xs font-mono font-black shrink-0">
                {formatTime(timeLeftSeconds)}
              </div>
            </div>
          )}

          {/* Compliance & Age verification banner */}
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-xs ${
              isAgeVerified
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className={`w-5 h-5 shrink-0 ${isAgeVerified ? 'text-emerald-700' : 'text-amber-600'}`} />
              <div>
                <span className="font-extrabold text-xs">
                  {isAgeVerified ? 'Legal Age Verified (21+)' : 'Age Verification Required'}
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {isAgeVerified
                    ? 'Physical Govt Photo ID check will take place at delivery.'
                    : 'State law requires proof of legal drinking age before order submission.'}
                </p>
              </div>
            </div>
            {!isAgeVerified && (
              <button
                onClick={onOpenAgeModal}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0 shadow-xs"
              >
                Verify Now
              </button>
            )}
          </div>

          {/* Delivery Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                1. Delivery Address
              </span>
              <button
                onClick={() => setShowAddAddress(!showAddAddress)}
                className="text-xs text-emerald-800 font-bold flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddAddress ? 'Cancel' : 'Add New'}</span>
              </button>
            </div>

            {showAddAddress ? (
              <form onSubmit={handleCreateNewAddress} className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2 text-xs shadow-xs">
                <input
                  type="text"
                  placeholder="Flat/House, Building, Street Name"
                  required
                  value={newAddrLine}
                  onChange={e => setNewAddrLine(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 font-medium"
                />
                <input
                  type="text"
                  placeholder="Postal Code"
                  required
                  value={newPostalCode}
                  onChange={e => setNewPostalCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 font-medium"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Address
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                {currentAddresses.map((addr, idx) => (
                  <button
                    key={addr.id || idx}
                    onClick={() => setSelectedAddressIndex(idx)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-start justify-between transition-colors ${
                      selectedAddressIndex === idx
                        ? 'bg-emerald-50/70 border-emerald-600 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${selectedAddressIndex === idx ? 'text-emerald-700' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold text-xs text-slate-900 capitalize">
                          {addr.label} • {addr.fullName} ({addr.phone})
                        </div>
                        <div className="text-[11px] text-slate-500 leading-normal mt-0.5">
                          {addr.addressLine1}, {addr.city} - {addr.postalCode}
                        </div>
                      </div>
                    </div>
                    {selectedAddressIndex === idx && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              2. Payment Method (Razorpay Gateway)
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'upi', label: 'UPI (GPay / PhonePe / Paytm)', icon: QrCode },
                { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
                { id: 'netbanking', label: 'Net Banking', icon: Banknote },
                { id: 'cod', label: 'Cash on Delivery (COD)', icon: Truck },
              ].map(opt => {
                const Icon = opt.icon;
                const isSelected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPaymentMethod(opt.id as any)}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-600 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coupons & Offers */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-700" />
                <span>3. Coupons & Offers</span>
              </div>
              {appliedCoupon && (
                <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Percent className="w-3 h-3" /> Saved ₹{discount}
                </span>
              )}
            </div>

            {/* Input / Applied badge */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                    %
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 tracking-wide">{appliedCoupon.code}</div>
                    <div className="text-[10px] text-emerald-700 font-medium">{appliedCoupon.description}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code (e.g. WELCOME50)"
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCouponCode()}
                    disabled={isApplyingCoupon || !couponInput.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs shrink-0"
                  >
                    {isApplyingCoupon ? 'Verifying...' : 'Apply'}
                  </button>
                </div>

                {/* Available Quick Coupons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-medium">Quick apply:</span>
                  {['WELCOME50', 'PARTY100', 'WEEKEND20', 'SPIRITS15'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleApplyCouponCode(c)}
                      className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg border border-dashed border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Coupon feedback banner */}
            {couponFeedback && (
              <div
                className={`text-xs p-2 rounded-xl font-medium flex items-center gap-1.5 ${
                  couponFeedback.success
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-rose-100 text-rose-900 border border-rose-200'
                }`}
              >
                {couponFeedback.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                )}
                <span>{couponFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Itemized Bill Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              4. Bill Breakdown
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Items Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="font-semibold text-slate-900 font-mono">₹{subtotal}</span>
              </div>

              {discount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Coupon Discount ({couponCode})
                  </span>
                  <span className="font-mono">-₹{discount}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery Fee</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {deliveryFee === 0 ? <span className="text-emerald-700 font-bold">FREE</span> : `₹${deliveryFee}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Convenience & Packaging</span>
                <span className="font-semibold text-slate-900 font-mono">₹{handlingFee}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>State Excise & GST (incl.)</span>
                <span className="font-semibold text-slate-900 font-mono">₹{taxes}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                <span>Total Amount Payable</span>
                <span className="text-lg text-emerald-700 font-mono">₹{totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Gateway Test Mode Simulator (Sandbox Helper) */}
          {activeReservation && showSandboxSimulator && (
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-3 shadow-xs animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold text-slate-900">Payment Gateway Session Active</span>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  {activeReservation.gatewayOrderId}
                </span>
              </div>

              <p className="text-[11px] text-slate-500">
                To test the verified payment flow without external bank SMS, click the button below. The server will cryptographically sign and verify the transaction HMAC token.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    // Generate cryptographic signature via sandbox test signature
                    const testPaymentId = `pay_${Date.now()}_test`;
                    // Fetch sandbox signature or compute test signature
                    const testSig = `sig_${activeReservation.gatewayOrderId}_${testPaymentId}`;

                    await handleVerifyAndConfirm({
                      razorpay_order_id: activeReservation.gatewayOrderId,
                      razorpay_payment_id: testPaymentId,
                      razorpay_signature: testSig,
                      reservationId: activeReservation.reservationId,
                    });
                  }}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simulate Successful Payment (₹{totalAmount})</span>
                </button>

                <button
                  onClick={() => {
                    api.post('/payments/release-reservation', {
                      reservationId: activeReservation.reservationId,
                      reason: 'User simulated failed payment',
                    }).catch(console.warn);
                    setActiveReservation(null);
                    setShowSandboxSimulator(false);
                    setErrorMessage('Payment cancelled. Reserved stock released back to store.');
                  }}
                  className="px-3 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors"
                >
                  Simulate Failure
                </button>
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Compliance statement */}
          <div className="text-[11px] text-slate-500 leading-normal p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            * <strong>Excise Compliance</strong>: Customer must verify 4-digit OTP PIN and present original Government Photo ID to rider at doorstep. Instant refund available before dispatch.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">To Pay</div>
            <div className="text-xl font-black text-slate-900">₹{totalAmount}</div>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={isProcessing}
            className="flex-1 py-3 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Processing Payment...</span>
            ) : (
              <>
                <span>
                  {activeReservation
                    ? `PAY NOW (₹${totalAmount})`
                    : `CONFIRM & PAY ₹${totalAmount}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
