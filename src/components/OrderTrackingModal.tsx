import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  Clock,
  Package,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Phone,
  ArrowRight,
  RefreshCw,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Order, OrderStatus } from '../types.ts';
import { api } from '../services/api.ts';
import { InvoiceModal } from './InvoiceModal.tsx';
import { LiveDeliveryMap } from './LiveDeliveryMap.tsx';
import { useOrderTracking } from '../services/socketClient.ts';

interface OrderTrackingModalProps {
  orderId: string | null;
  onClose: () => void;
  onOrderUpdated?: () => void;
  isFullPageView?: boolean;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  orderId,
  onClose,
  onOrderUpdated,
  isFullPageView = false,
}) => {
  const {
    order,
    status,
    estimatedDeliveryTime,
    storeLocation,
    customerLocation,
    deliveryPartner,
    lastKnownLocation,
    statusTimeline,
    deliveryOtp,
    isLiveConnected,
    isLoading,
    refetch,
  } = useOrderTracking(orderId);

  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);
  const [cancelReasonCategory, setCancelReasonCategory] = useState<
    'Order placed by mistake' | 'Delivery taking too long' | 'Changed mind' | 'Found better price' | 'Other'
  >('Order placed by mistake');
  const [customExplanation, setCustomExplanation] = useState<string>('');
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);

  if (!orderId) return null;

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);

    try {
      const response = await api.post<{ success: boolean; message: string; data: Order }>(
        `/orders/${orderId}/cancel`,
        {
          reasonCategory: cancelReasonCategory,
          customExplanation: customExplanation.trim() || undefined,
        }
      );

      setCancelMessage(response.message || 'Order cancelled successfully.');
      setShowCancelDialog(false);
      refetch();
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      setCancelError(err.message || 'Could not cancel order.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Complete Order Lifecycle Steps as specified in User Request
  const LIFECYCLE_STEPS: { key: OrderStatus; label: string; desc: string; icon: any }[] = [
    { key: 'PLACED', label: 'Order Placed', desc: 'Payment verified & stock reserved', icon: Clock },
    { key: 'CONFIRMED', label: 'Order Confirmed', desc: 'Central routing confirmed', icon: CheckCircle },
    { key: 'STORE_ACCEPTED', label: 'Store Accepted', desc: 'Dark store accepted ticket', icon: Package },
    { key: 'PREPARING', label: 'Preparing', desc: 'Chilled bottles being packed', icon: Sparkles },
    { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', desc: 'Tamper-sealed at dispatch counter', icon: ShieldCheck },
    { key: 'ASSIGNED', label: 'Delivery Partner Assigned', desc: 'Speed rider on duty', icon: Truck },
    { key: 'PICKED_UP', label: 'Picked Up', desc: 'Inspected & secured in carrier', icon: Package },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'Rider en route to your doorstep', icon: NavigationIcon },
    { key: 'ARRIVING_SOON', label: 'Arriving Soon', desc: 'Within 500m of destination', icon: Zap },
    { key: 'DELIVERED', label: 'Delivered', desc: 'Doorstep 21+ ID verification complete', icon: CheckCircle2 },
  ];

  // Map status hierarchy
  const statusLevels: Record<string, number> = {
    PLACED: 1,
    CONFIRMED: 2,
    STORE_ACCEPTED: 3,
    PREPARING: 4,
    READY_FOR_PICKUP: 5,
    ASSIGNED: 6,
    DELIVERY_ASSIGNED: 6,
    PICKED_UP: 7,
    OUT_FOR_DELIVERY: 8,
    ARRIVING_SOON: 9,
    DELIVERED: 10,
  };

  const currentLevel = statusLevels[status] || 1;

  const getStepState = (stepKey: OrderStatus) => {
    if (status === 'CANCELLED') return 'cancelled';
    const stepLevel = statusLevels[stepKey] || 1;
    if (currentLevel > stepLevel) return 'completed';
    if (currentLevel === stepLevel) return 'active';
    return 'upcoming';
  };

  const getStepTimestamp = (stepKey: OrderStatus) => {
    if (!statusTimeline || statusTimeline.length === 0) return null;
    const entry = statusTimeline.find(
      (t: any) =>
        t.status === stepKey ||
        (stepKey === 'ASSIGNED' && t.status === 'DELIVERY_ASSIGNED') ||
        (stepKey === 'DELIVERY_ASSIGNED' && t.status === 'ASSIGNED')
    );
    if (!entry || !entry.timestamp) return null;
    try {
      const d = new Date(entry.timestamp);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const canCancel =
    order &&
    ['PLACED', 'CONFIRMED', 'STORE_ACCEPTED', 'PREPARING'].includes(status) &&
    status !== 'DELIVERED' &&
    status !== 'CANCELLED';

  const modalContent = (
    <div className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-scale-up">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-black text-slate-900 text-base sm:text-lg">Order Tracking</span>
            {order && (
              <span className="text-xs font-mono font-black bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                #{order.orderNumber}
              </span>
            )}
            {/* Status Pill */}
            <span
              className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                status === 'DELIVERED'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : status === 'CANCELLED' || status === 'DELIVERY_FAILED'
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : status === 'OUT_FOR_DELIVERY' || status === 'ARRIVING_SOON'
                  ? 'bg-emerald-600 text-white border-emerald-600 animate-pulse'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2">
            <span>⚡ Estimated arrival: <strong className="text-slate-900">{estimatedDeliveryTime}</strong></span>
            {storeLocation && <span>• Hub: {storeLocation.name.split('—')[0]}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {order && (
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              title="View Excise Tax Invoice"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Tax Invoice</span>
            </button>
          )}
          <button
            onClick={refetch}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Refresh telematics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Close tracking"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area (Two Columns on Desktop, Single Stack on Mobile) */}
      <div className="p-4 sm:p-6 overflow-y-auto bg-slate-50/50 flex-1">
        {isLoading && !order ? (
          <div className="py-20 text-center text-slate-500 text-xs animate-pulse font-medium">
            Connecting to DrinkIt Delivery Dispatch Network...
          </div>
        ) : order ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN (lg:col-span-7): Status, Steps, Partner, Details */}
            <div className="lg:col-span-7 space-y-4">
              {/* Delivery OTP Box */}
              {status !== 'DELIVERED' && status !== 'CANCELLED' && status !== 'DELIVERY_FAILED' && (
                <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">
                      Doorstep Verification PIN
                    </div>
                    <div className="text-xs text-emerald-700 mt-0.5 font-medium">
                      Share this 4-digit code with your rider upon arrival
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono tracking-widest text-emerald-950 bg-white px-4 py-2 rounded-2xl border border-emerald-300 shadow-sm">
                    {deliveryOtp || order.deliveryOtp}
                  </div>
                </div>
              )}

              {/* Delivery Partner Card */}
              {deliveryPartner && (
                <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-base shadow-xs">
                      {deliveryPartner.photo ? (
                        <img
                          src={deliveryPartner.photo}
                          alt={deliveryPartner.name}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        deliveryPartner.name[0]
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {deliveryPartner.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                          ★ {deliveryPartner.rating || 4.9}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        DrinkIt Speed Fleet Partner • Insulated Backpack
                      </div>
                    </div>
                  </div>

                  <a
                    href={`tel:${deliveryPartner.phone}`}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors border border-emerald-200 shadow-2xs"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Call Rider</span>
                  </a>
                </div>
              )}

              {/* ORDER PROGRESS TIMELINE (Complete 10 Steps with Timestamps) */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Order Progress
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    {status === 'DELIVERED' ? 'Complete' : 'In Transit'}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const state = getStepState(step.key);
                    const timestamp = getStepTimestamp(step.key);
                    const StepIcon = step.icon;

                    return (
                      <div key={step.key} className="flex items-start gap-3 relative">
                        {idx < LIFECYCLE_STEPS.length - 1 && (
                          <div
                            className={`absolute left-3.5 top-7 bottom-0 w-0.5 -mb-3 transition-colors ${
                              state === 'completed' ? 'bg-emerald-600' : 'bg-slate-200'
                            }`}
                          />
                        )}

                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${
                            state === 'completed'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : state === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600 shadow-xs'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                        >
                          <StepIcon className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-bold truncate ${
                                state === 'active'
                                  ? 'text-emerald-800 font-black'
                                  : state === 'completed'
                                  ? 'text-slate-900'
                                  : 'text-slate-400'
                              }`}
                            >
                              {step.label}
                            </span>
                            {timestamp && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {timestamp}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{step.desc}</p>
                        </div>

                        {state === 'completed' && (
                          <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                            ✓ Done
                          </span>
                        )}
                        {state === 'active' && (
                          <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0 animate-pulse">
                            ● Active
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Cancellation Action */}
              {canCancel && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="w-full py-2.5 rounded-2xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors shadow-2xs"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN (lg:col-span-5): Live Map & Order Summary */}
            <div className="lg:col-span-5 space-y-4">
              {/* LIVE DELIVERY MAP */}
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Live Delivery Map</span>
                  {isLiveConnected && (
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Live GPS Stream
                    </span>
                  )}
                </div>

                <LiveDeliveryMap
                  status={status}
                  storeLocation={storeLocation}
                  customerLocation={customerLocation}
                  deliveryPartner={deliveryPartner}
                  lastKnownLocation={lastKnownLocation}
                  estimatedDeliveryTime={estimatedDeliveryTime}
                  isLiveConnected={isLiveConnected}
                />
              </div>

              {/* Delivery Address Card */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Delivery Address</span>
                </div>
                <div className="font-bold text-slate-900">{customerLocation.label || 'Home'}</div>
                <p className="text-slate-500 leading-relaxed">{customerLocation.addressLine}</p>
                {order.deliveryAddress?.phone && (
                  <div className="text-[11px] text-slate-400">Recipient Contact: {order.deliveryAddress.phone}</div>
                )}
              </div>

              {/* Order Summary Card */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
                <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Order Summary ({order.items.length} items)
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-700">
                      <div className="truncate max-w-[200px]">
                        <span className="font-bold text-slate-900">{item.quantity}x</span>{' '}
                        <span>{item.productName}</span>{' '}
                        <span className="text-[10px] text-slate-400">({item.volume})</span>
                      </div>
                      <span className="font-black text-slate-900 shrink-0">₹{item.subtotal}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span>₹{order.subtotal}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Discount</span>
                      <span>-₹{order.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>Delivery & Handling</span>
                    <span>₹{(order.deliveryFee || 0) + (order.handlingFee || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black text-slate-900 pt-1 border-t border-slate-100">
                    <span>Total Amount</span>
                    <span className="text-sm">₹{order.totalAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                    <span>Payment Method:</span>
                    <span className="font-bold uppercase text-slate-700">{order.paymentMethod}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        {modalContent}
      </div>

      {/* Invoice Modal Popup */}
      {showInvoiceModal && order && (
        <InvoiceModal order={order} onClose={() => setShowInvoiceModal(false)} />
      )}

      {/* Cancellation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xl text-xs animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="font-black text-slate-900 text-sm">Cancel Order</div>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Are you sure you want to cancel this order? If paid online, a 100% refund will be processed immediately.
            </p>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Reason for Cancellation</label>
              <select
                value={cancelReasonCategory}
                onChange={(e: any) => setCancelReasonCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="Order placed by mistake">Order placed by mistake</option>
                <option value="Delivery taking too long">Delivery taking too long</option>
                <option value="Changed mind">Changed mind</option>
                <option value="Found better price">Found better price</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Details (Optional)</label>
              <textarea
                rows={2}
                placeholder="Help us improve our delivery service..."
                value={customExplanation}
                onChange={e => setCustomExplanation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            {cancelError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-medium">
                {cancelError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper component for Navigation Icon
const NavigationIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);
