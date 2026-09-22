import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Order, OrderStatus } from '../types.ts';
import { api } from '../services/api.ts';
import { InvoiceModal } from './InvoiceModal.tsx';

interface OrderTrackingModalProps {
  orderId: string | null;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  orderId,
  onClose,
  onOrderUpdated,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);
  const [cancelReasonCategory, setCancelReasonCategory] = useState<'Order placed by mistake' | 'Delivery taking too long' | 'Changed mind' | 'Found better price' | 'Other'>('Order placed by mistake');
  const [customExplanation, setCustomExplanation] = useState<string>('');
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const data = await api.get<Order>(`/orders/${orderId}`);
      setOrder(data);
    } catch (e) {
      console.warn('Could not load order tracking data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 4000); // Poll every 4 seconds for live rider & warehouse updates
    return () => clearInterval(interval);
  }, [orderId]);

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
      await fetchOrder();
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      setCancelError(err.message || 'Could not cancel order.');
    } finally {
      setIsCancelling(false);
    }
  };

  const steps: { key: OrderStatus; label: string; desc: string; icon: any }[] = [
    { key: 'PLACED', label: 'Order Placed', desc: 'Payment verified & stock secured', icon: Clock },
    { key: 'PREPARING', label: 'Packing at Hub', desc: 'Chilled bottles packed & tamper-sealed', icon: Package },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'Rider on the way to your doorstep', icon: Truck },
    { key: 'DELIVERED', label: 'Delivered', desc: '21+ ID confirmed & handover complete', icon: CheckCircle },
  ];

  const getStepState = (stepKey: OrderStatus) => {
    if (!order) return 'upcoming';
    if (order.status === 'CANCELLED') return 'cancelled';

    const orderHierarchy: Record<string, number> = {
      PLACED: 1,
      CONFIRMED: 1,
      PREPARING: 2,
      READY_FOR_PICKUP: 2,
      ASSIGNED: 3,
      OUT_FOR_DELIVERY: 3,
      DELIVERED: 4,
    };

    const currentLevel = orderHierarchy[order.status] || 1;
    const stepLevel = orderHierarchy[stepKey] || 1;

    if (currentLevel > stepLevel) return 'completed';
    if (currentLevel === stepLevel) return 'active';
    return 'upcoming';
  };

  const canCancel =
    order &&
    order.status !== 'DELIVERED' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'OUT_FOR_DELIVERY';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base">Order Details</span>
                {order && (
                  <span className="text-xs font-mono font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                    {order.orderNumber}
                  </span>
                )}
                {order?.invoiceNumber && (
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                    {order.invoiceNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                ⚡ ETA: {order?.estimatedDeliveryTime || '20 min'} • {order?.storeName}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {order && (
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                  title="View Tax Invoice"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="hidden sm:inline">Invoice</span>
                </button>
              )}
              <button
                onClick={fetchOrder}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Refresh status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 bg-slate-50/50">
            {isLoading && !order ? (
              <div className="py-12 text-center text-slate-500 text-xs animate-pulse font-medium">
                Connecting to DrinkIt Delivery Dispatch Network...
              </div>
            ) : order ? (
              <>
                {/* Cancelled Alert & Refund Details */}
                {order.status === 'CANCELLED' && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Order Cancelled</span>
                    </div>
                    {order.cancellationReason && (
                      <div className="text-[11px] text-rose-800">
                        Reason: <span className="font-semibold">{order.cancellationReason}</span>
                      </div>
                    )}
                    {order.refundDetails && (
                      <div className="pt-2 border-t border-rose-200 text-[11px] text-rose-900 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold">Refund Amount:</span>
                          <span className="font-mono font-black text-xs">₹{order.refundDetails.amount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Refund Status:</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {order.refundDetails.status}
                          </span>
                        </div>
                        {order.refundDetails.refundId && (
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                            <span>Ref ID:</span>
                            <span>{order.refundDetails.refundId}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery OTP Callout Box */}
                {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-xs">
                    <div>
                      <div className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">
                        Doorstep Verification PIN
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Share this 4-digit code with your rider upon arrival
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono tracking-widest text-emerald-950 bg-white px-3.5 py-1.5 rounded-xl border border-emerald-300 shadow-xs">
                      {order.deliveryOtp}
                    </div>
                  </div>
                )}

                {/* Status Stepper */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                  <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Delivery Timeline
                  </div>

                  <div className="space-y-4">
                    {steps.map((step, idx) => {
                      const state = getStepState(step.key);
                      const Icon = step.icon;

                      return (
                        <div key={step.key} className="flex items-start gap-3 relative">
                          {idx < steps.length - 1 && (
                            <div
                              className={`absolute left-4 top-7 bottom-0 w-0.5 -mb-4 ${
                                state === 'completed' ? 'bg-emerald-600' : 'bg-slate-200'
                              }`}
                            />
                          )}

                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${
                              state === 'completed'
                                ? 'bg-emerald-600 text-white'
                                : state === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="flex-1">
                            <div
                              className={`font-bold text-xs ${
                                state === 'active'
                                  ? 'text-emerald-800'
                                  : state === 'completed'
                                  ? 'text-slate-900'
                                  : 'text-slate-400'
                              }`}
                            >
                              {step.label}
                            </div>
                            <div className="text-[11px] text-slate-500">{step.desc}</div>
                          </div>

                          {state === 'completed' && (
                            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              Done
                            </span>
                          )}
                          {state === 'active' && (
                            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded animate-pulse">
                              In Progress
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Agent Card */}
                {order.deliveryAgentName && (
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold">
                        {order.deliveryAgentName[0]}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{order.deliveryAgentName}</div>
                        <div className="text-[10px] text-slate-500">Assigned DrinkIt Delivery Partner</div>
                      </div>
                    </div>
                    <a
                      href={`tel:${order.deliveryAgentPhone || '9876543210'}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Call Rider</span>
                    </a>
                  </div>
                )}

                {/* Order Items Summary */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">Order Summary ({order.items.length} items)</span>
                    <button
                      onClick={() => setShowInvoiceModal(true)}
                      className="text-emerald-700 font-bold text-[11px] hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      <span>View Invoice</span>
                    </button>
                  </div>
                  {order.items.map(i => (
                    <div key={i.productId} className="flex items-center justify-between text-slate-600">
                      <span className="truncate max-w-[240px]">
                        {i.quantity}x {i.productName} ({i.volume})
                      </span>
                      <span className="font-semibold text-slate-900">₹{i.subtotal}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-100 flex justify-between font-extrabold text-slate-900 text-sm">
                    <span>Paid Total ({order.paymentMethod.toUpperCase()})</span>
                    <span className="font-black text-slate-900">₹{order.totalAmount}</span>
                  </div>
                </div>

                {cancelMessage && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    {cancelMessage}
                  </div>
                )}

                {/* Cancellation Modal / Accordion */}
                {showCancelDialog ? (
                  <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3 shadow-xs animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-rose-950 text-xs">Confirm Order Cancellation</span>
                      <button
                        onClick={() => setShowCancelDialog(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        Back
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Please select a reason:
                      </label>
                      <select
                        value={cancelReasonCategory}
                        onChange={e => setCancelReasonCategory(e.target.value as any)}
                        className="w-full p-2 text-xs bg-white border border-rose-200 rounded-xl text-slate-900 focus:border-rose-400"
                      >
                        <option value="Order placed by mistake">Order placed by mistake</option>
                        <option value="Delivery taking too long">Delivery taking too long</option>
                        <option value="Changed mind">Changed mind</option>
                        <option value="Found better price">Found better price</option>
                        <option value="Other">Other reason</option>
                      </select>

                      <textarea
                        rows={2}
                        placeholder="Additional notes (optional)"
                        value={customExplanation}
                        onChange={e => setCustomExplanation(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-rose-200 rounded-xl text-slate-900 placeholder-slate-400 focus:border-rose-400"
                      />
                    </div>

                    <div className="text-[10px] text-rose-800 leading-tight">
                      ✓ A 100% full refund of ₹{order.totalAmount} will be immediately refunded to your original payment method, and items will be restocked to the hub.
                    </div>

                    {cancelError && (
                      <div className="text-xs text-rose-700 font-bold">{cancelError}</div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmCancel}
                        disabled={isCancelling}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs disabled:opacity-50"
                      >
                        {isCancelling ? 'Cancelling & Refunding...' : 'Confirm Cancellation & Refund'}
                      </button>
                      <button
                        onClick={() => setShowCancelDialog(false)}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                      >
                        Keep Order
                      </button>
                    </div>
                  </div>
                ) : (
                  canCancel && (
                    <button
                      onClick={() => setShowCancelDialog(true)}
                      className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors shadow-xs"
                    >
                      Cancel Order (100% Instant Refund)
                    </button>
                  )
                )}

                {order.status === 'OUT_FOR_DELIVERY' && (
                  <div className="text-center text-[11px] text-slate-500 font-medium">
                    🚴 Rider is en route. Doorstep cancellation is restricted for safety & temperature integrity.
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">Order details unavailable.</div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      <InvoiceModal
        orderId={orderId}
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
      />
    </>
  );
};
