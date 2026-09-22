import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Order } from '../types.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';

export const DeliveryAgentView: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [inputOtp, setInputOtp] = useState<string>('');
  const [confirmedId21, setConfirmedId21] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [deliverySuccess, setDeliverySuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRiderOrders = async () => {
    try {
      const data = await api.get<Order[]>('/orders');
      setOrders(data);
    } catch (e) {
      console.warn('Error loading rider orders', e);
    }
  };

  useEffect(() => {
    fetchRiderOrders();
    const interval = setInterval(fetchRiderOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await api.post(`/orders/${orderId}/assign`, {
        deliveryAgentId: user?.id || 'usr_delivery_1',
        deliveryAgentName: user?.name || 'Vikram Singh',
        deliveryAgentPhone: user?.phone || '+91 9988776655',
      });
      fetchRiderOrders();
    } catch (err: any) {
      alert(err.message || 'Could not accept order');
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    try {
      await api.post(`/orders/${orderId}/status`, {
        status: 'OUT_FOR_DELIVERY',
        note: `Picked up by ${user?.name || 'Vikram'}. In transit with chilled safety seals intact.`,
      });
      fetchRiderOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to update transit status');
    }
  };

  const handleVerifyAndDeliver = async (orderId: string) => {
    setErrorMessage(null);
    if (!confirmedId21) {
      setErrorMessage('Excise Mandate: You must physically inspect Government Photo ID and confirm 21+ age.');
      return;
    }

    if (!inputOtp || inputOtp.length !== 4) {
      setErrorMessage('Please enter the 4-digit verification OTP provided by the customer.');
      return;
    }

    setIsCompleting(true);
    try {
      await api.post(`/orders/${orderId}/verify-delivery`, {
        otp: inputOtp.trim(),
        confirmedAge21Plus: true,
      });
      setDeliverySuccess('Order delivered! Age verification & OTP logged to state excise audit.');
      setInputOtp('');
      setConfirmedId21(false);
      setTimeout(() => setDeliverySuccess(null), 4000);
      fetchRiderOrders();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid delivery OTP or compliance check failure');
    } finally {
      setIsCompleting(false);
    }
  };

  const activeDeliveries = orders.filter(
    o => o.status === 'ASSIGNED' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'READY_FOR_PICKUP'
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Rider Header */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">{user?.name || 'Vikram Singh'}</h2>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                DRINKIT SPEED FLEET
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Assigned Hub: Indiranagar Core • Electric Scooter (KA-01-EQ-4421)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isOnline ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isOnline ? 'ONLINE (Accepting)' : 'OFFLINE'}
          </button>
          <button
            onClick={fetchRiderOrders}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {deliverySuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{deliverySuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Orders */}
      <div className="space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-600" />
          <span>Active Task Assignments ({activeDeliveries.length})</span>
        </h3>

        {activeDeliveries.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-2 shadow-xs">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto opacity-80" />
            <div className="text-sm font-extrabold text-slate-900">No active deliveries pending!</div>
            <p className="text-xs text-slate-500 font-medium">Stay online. New orders will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDeliveries.map(order => (
              <div
                key={order.id}
                className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-base font-black text-slate-900 font-mono">{order.orderNumber}</span>
                    <div className="text-xs text-slate-500 font-medium">Target ETA: {order.estimatedDeliveryTime}</div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Customer & Address Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Customer Information</div>
                    <div className="font-extrabold text-slate-900 text-sm">{order.userName}</div>
                    <a
                      href={`tel:${order.userPhone}`}
                      className="inline-flex items-center gap-1.5 text-emerald-700 font-bold hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{order.userPhone}</span>
                    </a>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Dropoff Destination</div>
                    <div className="flex items-start gap-1.5 text-slate-700">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-medium">
                        {order.deliveryAddress.addressLine1}, {order.deliveryAddress.city} ({order.deliveryAddress.postalCode})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottles in bag */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase mb-1 tracking-wider">
                    Items to Handover ({order.items.length})
                  </div>
                  <div className="space-y-1">
                    {order.items.map(i => (
                      <div key={i.productId} className="flex justify-between text-slate-700 font-medium">
                        <span>{i.quantity}x {i.productName}</span>
                        <span className="text-slate-400 font-normal">{i.volume}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflow Transitions */}
                <div className="pt-2 border-t border-slate-100">
                  {order.status === 'READY_FOR_PICKUP' && (
                    <button
                      onClick={() => handleAcceptOrder(order.id)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-xs transition-colors"
                    >
                      Accept Delivery Task
                    </button>
                  )}

                  {order.status === 'ASSIGNED' && (
                    <button
                      onClick={() => handleStartDelivery(order.id)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-xs transition-colors"
                    >
                      Confirm Hub Pickup & Start Delivery
                    </button>
                  )}

                  {order.status === 'OUT_FOR_DELIVERY' && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>Mandatory Regulatory Handover Protocol</span>
                      </div>

                      {/* Checkbox for 21+ physical ID check */}
                      <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={confirmedId21}
                          onChange={e => setConfirmedId21(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="font-medium leading-relaxed">
                          I have physically inspected recipient's original Government Photo ID and verified they are <strong>21 years of age or older</strong>.
                        </span>
                      </label>

                      {/* Customer OTP entry */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Customer 4-digit PIN"
                          maxLength={4}
                          value={inputOtp}
                          onChange={e => setInputOtp(e.target.value.trim())}
                          className="w-48 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-center text-sm tracking-widest focus:outline-none focus:border-emerald-500 font-bold"
                        />
                        <button
                          onClick={() => handleVerifyAndDeliver(order.id)}
                          disabled={isCompleting || !confirmedId21 || inputOtp.length !== 4}
                          className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shadow-xs"
                        >
                          {isCompleting ? 'Verifying...' : 'Verify & Handover'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
