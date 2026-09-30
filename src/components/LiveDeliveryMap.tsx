import React, { useMemo } from 'react';
import {
  APIProvider,
  Map,
  Marker,
} from '@vis.gl/react-google-maps';
import {
  Store as StoreIcon,
  MapPin,
  Navigation,
  Compass,
  Zap,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { DeliveryLocation, OrderStatus } from '../types.ts';

interface LiveDeliveryMapProps {
  status: OrderStatus;
  storeLocation: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  customerLocation: {
    addressLine: string;
    label?: string;
    latitude: number;
    longitude: number;
  };
  deliveryPartner: {
    id: string;
    name: string;
    phone: string;
    rating?: number;
  } | null;
  lastKnownLocation: DeliveryLocation | null;
  estimatedDeliveryTime?: string;
  isLiveConnected?: boolean;
}

export const LiveDeliveryMap: React.FC<LiveDeliveryMapProps> = ({
  status,
  storeLocation,
  customerLocation,
  deliveryPartner,
  lastKnownLocation,
  estimatedDeliveryTime = '20–25 min',
  isLiveConnected = true,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const isAssigned = Boolean(deliveryPartner);
  const isEnRoute = status === 'OUT_FOR_DELIVERY' || status === 'ARRIVING_SOON';
  const isAtStore = status === 'ASSIGNED' || status === 'DELIVERY_ASSIGNED' || status === 'PICKED_UP';
  const isDelivered = status === 'DELIVERED';
  const isCancelled = status === 'CANCELLED' || status === 'DELIVERY_FAILED';

  // Rider position: default to midway or store if GPS coordinate isn't received yet
  const riderPos = useMemo(() => {
    if (lastKnownLocation && typeof lastKnownLocation.latitude === 'number') {
      return { lat: lastKnownLocation.latitude, lng: lastKnownLocation.longitude };
    }
    if (storeLocation) {
      if (isAtStore) {
        return { lat: storeLocation.latitude + 0.001, lng: storeLocation.longitude + 0.001 };
      }
      if (isEnRoute) {
        // Interpolate between store and customer
        return {
          lat: storeLocation.latitude + (customerLocation.latitude - storeLocation.latitude) * 0.55,
          lng: storeLocation.longitude + (customerLocation.longitude - storeLocation.longitude) * 0.55,
        };
      }
    }
    return null;
  }, [lastKnownLocation, storeLocation, customerLocation, isAtStore, isEnRoute]);

  const mapCenter = useMemo(() => {
    if (riderPos) return riderPos;
    if (storeLocation) return { lat: storeLocation.latitude, lng: storeLocation.longitude };
    return { lat: customerLocation.latitude || 28.572, lng: customerLocation.longitude || 77.325 };
  }, [riderPos, storeLocation, customerLocation]);

  // If order is completed or cancelled, show clean non-tracking summary card
  if (isDelivered) {
    return (
      <div className="w-full h-48 sm:h-56 rounded-3xl bg-emerald-50/70 border border-emerald-200 p-6 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-xs">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="text-sm font-black text-slate-900">Your order has been delivered!</div>
        <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
          Handed over with 21+ verification. Live route telemetry has closed. Enjoy responsibly!
        </p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="w-full h-48 sm:h-56 rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-2 shadow-xs">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="text-sm font-black text-rose-900">Order Cancelled</div>
        <p className="text-xs text-rose-700 max-w-xs mt-1 font-medium">
          Delivery routing has ended. Any payment is being refunded.
        </p>
      </div>
    );
  }

  if (!isAssigned) {
    return (
      <div className="w-full h-52 sm:h-64 rounded-3xl bg-slate-50 border border-slate-200 p-6 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center mb-2 shadow-xs">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <div className="text-sm font-black text-slate-900">Assigning Nearest Speed Rider</div>
        <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
          {storeLocation?.name || 'DrinkIt Micro-Warehouse'} is packing your order. Live GPS tracking will unlock once a delivery partner accepts the dispatch.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 sm:h-80 rounded-3xl border border-slate-200 overflow-hidden shadow-xs bg-slate-900 select-none">
      {/* 1. Google Maps or High-Fidelity Vector Route Canvas */}
      {apiKey && !apiKey.startsWith('MY_') ? (
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={mapCenter}
            defaultZoom={15}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            className="w-full h-full"
          >
            {storeLocation && (
              <Marker
                position={{ lat: storeLocation.latitude, lng: storeLocation.longitude }}
                title={storeLocation.name}
              />
            )}
            <Marker
              position={{ lat: customerLocation.latitude, lng: customerLocation.longitude }}
              title="Your Doorstep"
            />
            {riderPos && (
              <Marker
                position={riderPos}
                title={`${deliveryPartner?.name || 'Rider'} (In Transit)`}
              />
            )}
          </Map>
        </APIProvider>
      ) : (
        /* High-fidelity Vector Interactive Map with Route Simulation */
        <div className="w-full h-full relative bg-radial from-slate-800 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
          {/* Subtle grid lines background */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* SVG Animated Route Line */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 240">
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
            {/* Background path line */}
            <path
              d="M 60 170 Q 150 90, 220 130 T 340 70"
              fill="none"
              stroke="#065f46"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Animated glowing path line */}
            <path
              d="M 60 170 Q 150 90, 220 130 T 340 70"
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="3.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
              className="animate-pulse"
            />
          </svg>

          {/* 1. Store Pin (Left) */}
          <div className="absolute left-6 bottom-10 flex flex-col items-center">
            <div className="w-10 h-10 rounded-2xl bg-white text-slate-900 border-2 border-emerald-500 shadow-xl flex items-center justify-center">
              <StoreIcon className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="mt-1 px-2 py-0.5 rounded-full bg-slate-900/90 text-white text-[10px] font-black border border-slate-700 shadow-md whitespace-nowrap">
              {storeLocation?.name?.split('—')[0] || 'Dark Store Hub'}
            </div>
          </div>

          {/* 2. Rider Pin (Dynamic Center Position) */}
          <div
            className={`absolute flex flex-col items-center transition-all duration-700 ${
              isAtStore ? 'left-24 bottom-14' : isEnRoute ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'right-28 top-16'
            }`}
          >
            <div className="relative">
              <span className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-ping" />
              <div className="relative w-12 h-12 rounded-2xl bg-emerald-600 text-white border-2 border-white shadow-2xl flex items-center justify-center">
                <Navigation className="w-6 h-6 fill-white rotate-45" />
              </div>
            </div>
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-lg flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span>{deliveryPartner?.name || 'Rider in Transit'}</span>
            </div>
          </div>

          {/* 3. Customer Destination Pin (Right) */}
          <div className="absolute right-6 top-8 flex flex-col items-center">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white border-2 border-white shadow-xl flex items-center justify-center animate-bounce-subtle">
              <MapPin className="w-5 h-5 fill-white" />
            </div>
            <div className="mt-1 px-2 py-0.5 rounded-full bg-slate-900/90 text-white text-[10px] font-black border border-slate-700 shadow-md whitespace-nowrap">
              Your Doorstep
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Bar Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-xs font-bold border border-slate-700/80 shadow-lg flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="tracking-wide">
            {isEnRoute ? 'Live GPS Navigation Active' : 'Rider at Hub Preparing Departure'}
          </span>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-lg flex items-center gap-1.5 pointer-events-auto">
          <Zap className="w-3.5 h-3.5 fill-white" />
          <span>{estimatedDeliveryTime}</span>
        </div>
      </div>

      {/* Floating Bottom Telemetry Pill */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 px-3.5 py-2 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2 truncate">
          <Radio className={`w-3.5 h-3.5 shrink-0 ${isLiveConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="truncate">
            {lastKnownLocation ? (
              <>Speed: ~{lastKnownLocation.speedKmH || 24} km/h • GPS Verified</>
            ) : (
              <>Delivery partner location active • Telematics streaming</>
            )}
          </span>
        </div>
        <span className="text-[10px] text-emerald-400 font-bold shrink-0 ml-2">
          DrinkIt Fleet
        </span>
      </div>
    </div>
  );
};
