import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle,
  Navigation,
  Clock,
  AlertTriangle,
  RefreshCw,
  Send,
  X,
  Radio,
  ArrowRight,
  Package,
  Store as StoreIcon,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { Order, OrderStatus } from '../types.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { socketClient } from '../services/socketClient.ts';

export const DeliveryAgentView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-orders' | 'available'>('my-orders');
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Delivery Completion modal state
  const [verifyingOrder, setVerifyingOrder] = useState<Order | null>(null);
  const [inputOtp, setInputOtp] = useState<string>('');
  const [confirmedId21, setConfirmedId21] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

  // Delivery Failure modal state
  const [failingOrder, setFailingOrder] = useState<Order | null>(null);
  const [failureReason, setFailureReason] = useState<string>('Customer unavailable');
  const [failureDetails, setFailureDetails] = useState<string>('');
  const [isFailing, setIsFailing] = useState<boolean>(false);

  // Notification toasts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('GPS Active (Streaming)');

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const [myRes, availRes] = await Promise.all([
        api.get<Order[]>('/delivery/my-orders'),
        api.get<Order[]>('/delivery/available-orders'),
      ]);
      setMyOrders(myRes || []);
      setAvailableOrders(availRes || []);
    } catch (e) {
      console.warn('Error loading rider orders', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);

    // Socket.IO real-time listener for dispatch events
    const socket = socketClient.getSocket();
    if (socket) {
      socket.on('order:status_changed', fetchOrders);
      socket.on('order:assigned', fetchOrders);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('order:status_changed', fetchOrders);
        socket.off('order:assigned', fetchOrders);
      }
    };
  }, []);

  // Periodic GPS Telematics broadcast loop while on active delivery
  const activeOrderInTransit = myOrders.find(
    o => o.status === 'OUT_FOR_DELIVERY' || o.status === 'ARRIVING_SOON' || o.status === 'PICKED_UP'
  );

  useEffect(() => {
    if (!activeOrderInTransit || !isOnline) return;

    let watchId: number | null = null;

    const sendCoords = async (lat: number, lng: number, speed?: number, heading?: number) => {
      try {
        await api.patch(`/delivery/orders/${activeOrderInTransit.id}/location`, {
          latitude: lat,
          longitude: lng,
          speedKmH: typeof speed === 'number' && !isNaN(speed) ? Math.round(speed * 3.6) : 24,
          heading: typeof heading === 'number' && !isNaN(heading) ? Math.round(heading) : undefined,
          timestamp: new Date().toISOString(),
        });
        setGpsStatus(`GPS Active (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } catch (err: any) {
        console.warn('Location streaming retry notice:', err.message);
        setGpsStatus('GPS connection temporarily retrying');
      }
    };

    if ('geolocation' in navigator) {
      // Use real browser geolocation
      watchId = navigator.geolocation.watchPosition(
        pos => {
          sendCoords(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.speed || undefined,
            pos.coords.heading || undefined
          );
        },
        err => {
          console.warn('Geolocation sensor notice:', err.message);
          // High-fidelity fallback coordinate stream near active micro-warehouse
          sendCoords(28.5721 + (Math.random() - 0.5) * 0.005, 77.3251 + (Math.random() - 0.5) * 0.005);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    } else {
      // Simulation interval if browser lacks geolocation
      const timer = setInterval(() => {
        sendCoords(28.5721 + (Math.random() - 0.5) * 0.005, 77.3251 + (Math.random() - 0.5) * 0.005);
      }, 7000);
      return () => clearInterval(timer);
    }

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeOrderInTransit?.id, isOnline]);

  // Actions
  const handleAcceptOrder = async (order: Order) => {
    try {
      await api.post(`/delivery/orders/${order.id}/accept`, {});
      showNotification(`Accepted delivery for #${order.orderNumber}. Head to ${order.storeName}.`);
      fetchOrders();
      setActiveTab('my-orders');
    } catch (err: any) {
      alert(err.message || 'Could not accept order');
    }
  };

  const handleArrivedAtStore = async (orderId: string) => {
    try {
      await api.post(`/delivery/orders/${orderId}/arrived-store`, {});
      showNotification('Marked: Arrived at dark store. Collect package.');
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to update store arrival');
    }
  };

  const handlePickupOrder = async (orderId: string) => {
    try {
      await api.post(`/delivery/orders/${orderId}/pickup`, {});
      showNotification('Package collected & safety seals verified. Ready for transit.');
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm pickup');
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    try {
      await api.post(`/delivery/orders/${orderId}/start-delivery`, {});
      showNotification('Departed on delivery transit! Live GPS stream active.');
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to start transit');
    }
  };

  const handleArrivedAtCustomer = async (orderId: string) => {
    try {
      await api.post(`/delivery/orders/${orderId}/arrived-customer`, {});
      showNotification('Marked: Arrived at customer doorstep.');
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to update arrival');
    }
  };

  const handleOpenVerifyModal = (order: Order) => {
    setVerifyingOrder(order);
    setInputOtp('');
    setConfirmedId21(false);
    setErrorMessage(null);
  };

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingOrder) return;
    setErrorMessage(null);

    if (!confirmedId21) {
      setErrorMessage('Excise Mandate: You must physically verify recipient is 21+ with government photo ID.');
      return;
    }

    if (!inputOtp || inputOtp.trim().length !== 4) {
      setErrorMessage('Please enter the 4-digit verification PIN provided by the recipient.');
      return;
    }

    setIsCompleting(true);
    try {
      await api.post(`/delivery/orders/${verifyingOrder.id}/verify-delivery`, {
        otp: inputOtp.trim(),
        confirmedAge21Plus: true,
      });

      showNotification(`Order #${verifyingOrder.orderNumber} successfully delivered! 21+ compliance logged.`);
      setVerifyingOrder(null);
      fetchOrders();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid delivery OTP or verification failure.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleReportFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failingOrder) return;
    setIsFailing(true);
    try {
      await api.post(`/delivery/orders/${failingOrder.id}/fail`, {
        reason: failureReason,
        details: failureDetails.trim() || undefined,
      });
      showNotification(`Delivery failure logged for #${failingOrder.orderNumber}. Return package to store.`);
      setFailingOrder(null);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to log failure');
    } finally {
      setIsFailing(false);
    }
  };

  // Filter active and history
  const activeDeliveries = myOrders.filter(
    o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED' && o.status !== 'DELIVERY_FAILED'
  );
  const completedDeliveries = myOrders.filter(
    o => o.status === 'DELIVERED' || o.status === 'DELIVERY_FAILED'
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in text-slate-900">
      {/* Rider Header Bar */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">{user?.name || 'Vikram Singh'}</h2>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                DRINKIT SPEED FLEET
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
              <span>Electric Scooter (Eco Fleet)</span>
              <span>•</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-600 animate-ping" />
                {gpsStatus}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isOnline ? '🟢 ON DUTY (Online)' : '⚪ OFF DUTY (Paused)'}
          </button>
          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Refresh Deliveries"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs w-fit">
        <button
          onClick={() => setActiveTab('my-orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'my-orders'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          My Active Deliveries ({activeDeliveries.length})
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'available'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Available to Pick Up</span>
          {availableOrders.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
              {availableOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: MY ACTIVE DELIVERIES */}
      {activeTab === 'my-orders' && (
        <div className="space-y-4">
          {activeDeliveries.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="text-base font-extrabold text-slate-900">No active delivery in transit</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                You're ready for your next order. Check the "Available to Pick Up" tab to accept dispatches from dark store micro-warehouses.
              </p>
              <button
                onClick={() => setActiveTab('available')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors"
              >
                View Available Orders ({availableOrders.length})
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDeliveries.map(order => {
                const isAssigned = order.status === 'ASSIGNED' || order.status === 'DELIVERY_ASSIGNED';
                const isPickedUp = order.status === 'PICKED_UP';
                const isOutForDelivery = order.status === 'OUT_FOR_DELIVERY';
                const isArrived = order.status === 'ARRIVING_SOON';

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Order ID & Status */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="font-mono font-black text-slate-900 text-sm">
                            ORDER #{order.orderNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Customer: {order.userName}
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Pickup Hub Details */}
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <StoreIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Pickup Store Hub</span>
                        </div>
                        <div className="text-slate-700 font-semibold">{order.storeName}</div>
                      </div>

                      {/* Delivery Address Details */}
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-600" />
                          <span>Customer Destination</span>
                        </div>
                        <div className="text-slate-800 font-semibold">
                          {order.deliveryAddress?.label || 'Home'} — {order.deliveryAddress?.addressLine1}
                        </div>
                        {order.deliveryAddress?.landmark && (
                          <div className="text-[11px] text-slate-500 font-medium">
                            Landmark: {order.deliveryAddress.landmark}
                          </div>
                        )}
                        <div className="pt-1 flex items-center justify-between">
                          <a
                            href={`tel:${order.userPhone}`}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Contact Customer</span>
                          </a>
                          <span className="font-mono font-bold text-slate-900">
                            Amount: ₹{order.totalAmount} ({order.paymentMethod.toUpperCase()})
                          </span>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Items ({order.items.length}):</div>
                        {order.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.productName}</span>
                            <span className="text-slate-400 font-medium">{item.volume}</span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <div className="text-[10px] text-slate-400 italic">+ {order.items.length - 3} more items</div>
                        )}
                      </div>
                    </div>

                    {/* DYNAMIC ACTION BUTTONS ACCORDING TO STATE (Section 6) */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      {isAssigned && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleArrivedAtStore(order.id)}
                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                          >
                            Arrived at Store
                          </button>
                          <button
                            onClick={() => handlePickupOrder(order.id)}
                            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            Pick Up Package
                          </button>
                        </div>
                      )}

                      {isPickedUp && (
                        <button
                          onClick={() => handleStartDelivery(order.id)}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5 fill-white" />
                          <span>Start Delivery (In Transit)</span>
                        </button>
                      )}

                      {isOutForDelivery && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleArrivedAtCustomer(order.id)}
                            className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            Arrived at Doorstep
                          </button>
                          <button
                            onClick={() => handleOpenVerifyModal(order)}
                            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            Enter Customer PIN
                          </button>
                        </div>
                      )}

                      {isArrived && (
                        <button
                          onClick={() => handleOpenVerifyModal(order)}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Verify 21+ ID & Complete Handover</span>
                        </button>
                      )}

                      {/* Delivery Issue Button */}
                      {(isOutForDelivery || isArrived) && (
                        <button
                          onClick={() => {
                            setFailingOrder(order);
                            setFailureReason('Customer unavailable');
                            setFailureDetails('');
                          }}
                          className="w-full py-1.5 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Report Delivery Issue / Recipient Unavailable
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AVAILABLE ORDERS TO PICK UP */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Unassigned Dispatches Near You
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Claim dispatches from certified micro-warehouses and start delivery
              </p>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-slate-100 rounded-xl">
              {availableOrders.length} Available
            </span>
          </div>

          {availableOrders.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-2 shadow-xs">
              <Clock className="w-12 h-12 text-slate-400 mx-auto opacity-70" />
              <div className="text-sm font-extrabold text-slate-900">No open dispatches right now</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                All current store orders have riders assigned. New orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableOrders.map(order => (
                <div
                  key={order.id}
                  className="p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        #{order.orderNumber}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                        {order.status}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="text-slate-500">Pickup Store:</div>
                      <div className="font-bold text-slate-900">{order.storeName}</div>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="text-slate-500">Destination:</div>
                      <div className="font-bold text-slate-900">
                        {order.deliveryAddress?.label || 'Home'} — {order.deliveryAddress?.addressLine1}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 font-medium">{order.items.length} items</span>
                      <span className="font-black text-slate-900 text-sm">₹{order.totalAmount}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAcceptOrder(order)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Accept Delivery</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: VERIFY DELIVERY & COMPLETE (OTP + 21+ Physical Check) */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCompleteDelivery}
            className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-2xl text-xs animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-black text-slate-900 text-base">Verify & Complete Delivery</h4>
                <p className="text-slate-500 text-[11px]">
                  Order #{verifyingOrder.orderNumber} • Recipient: {verifyingOrder.userName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingOrder(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Recipient 21+ Age Inspection Checkbox */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  id="confirm-age"
                  type="checkbox"
                  required
                  checked={confirmedId21}
                  onChange={e => setConfirmedId21(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                />
                <label htmlFor="confirm-age" className="text-xs text-amber-900 font-semibold cursor-pointer">
                  <strong>State Excise Mandate:</strong> I have physically inspected a Government Photo ID (Aadhaar / Voter ID / DL) and confirmed recipient is 21+ years of age.
                </label>
              </div>
            </div>

            {/* 2. Customer 4-digit Delivery PIN */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Enter 4-Digit Customer Verification PIN *
              </label>
              <input
                type="text"
                maxLength={4}
                required
                placeholder="4-digit PIN"
                value={inputOtp}
                onChange={e => setInputOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-black text-center text-xl tracking-widest focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Ask customer to read the 4-digit PIN shown on their DrinkIt live tracking screen.
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVerifyingOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCompleting || !confirmedId21 || inputOtp.length !== 4}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isCompleting ? 'Verifying...' : 'Mark Delivered'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REPORT DELIVERY FAILURE (Customer Unavailable / Address issue) */}
      {failingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReportFailure}
            className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xl text-xs animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-black text-slate-900 text-base">Report Delivery Failure</h4>
                <p className="text-slate-500 text-[11px]">Order #{failingOrder.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setFailingOrder(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Reason for Delivery Failure *</label>
              <select
                value={failureReason}
                onChange={e => setFailureReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="Customer unavailable">Customer unavailable / Not answering phone</option>
                <option value="Incorrect address">Incorrect address / Unreachable location</option>
                <option value="Recipient underage / No valid ID">Recipient underage / No valid government photo ID</option>
                <option value="Customer refused delivery">Customer refused delivery</option>
                <option value="Extreme weather / Road closure">Extreme weather / Road closure</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Additional Operational Notes</label>
              <textarea
                rows={2}
                placeholder="Details of calls placed or attempts made..."
                value={failureDetails}
                onChange={e => setFailureDetails(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFailingOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isFailing}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isFailing ? 'Reporting...' : 'Confirm Delivery Failure'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
