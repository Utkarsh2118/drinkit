import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Navigation,
  MapPin,
  Check,
  AlertTriangle,
  Compass,
  Store as StoreIcon,
  Plus,
  Minus,
  RotateCcw,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { locationService, GeocodedAddress, ServiceabilityResult } from '../services/locationService.ts';
import { LocationState, useLocation } from '../context/LocationContext.tsx';

interface MapLocationPickerProps {
  initialLat: number;
  initialLon: number;
  onConfirmLocation: (loc: LocationState) => void;
  onCancel?: () => void;
}

// Controller component to pan map when coordinates change programmatically
const MapController: React.FC<{ targetPos: { lat: number; lng: number } | null }> = ({ targetPos }) => {
  const map = useMap();

  useEffect(() => {
    if (map && targetPos) {
      map.panTo(targetPos);
    }
  }, [map, targetPos]);

  return null;
};

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  initialLat,
  initialLon,
  onConfirmLocation,
  onCancel,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [position, setPosition] = useState<{ lat: number; lng: number }>({
    lat: initialLat || 12.9784,
    lng: initialLon || 77.6408,
  });
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);

  const [geocodedAddress, setGeocodedAddress] = useState<GeocodedAddress | null>(null);
  const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load address and check serviceability whenever position changes
  const resolvePosition = useCallback(async (lat: number, lng: number) => {
    setIsLoadingAddress(true);
    setErrorMessage(null);
    try {
      const [address, service] = await Promise.all([
        locationService.reverseGeocode(lat, lng),
        locationService.checkServiceability(lat, lng),
      ]);
      setGeocodedAddress(address);
      setServiceability(service);
    } catch (err: any) {
      console.warn('Failed to reverse geocode or check store:', err);
      setErrorMessage('Could not load address details. You can still confirm coordinates.');
    } finally {
      setIsLoadingAddress(false);
    }
  }, []);

  // Debounced reverse geocoding on user pan/drag
  const handlePositionChange = (newLat: number, newLng: number) => {
    setPosition({ lat: newLat, lng: newLng });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      resolvePosition(newLat, newLng);
    }, 450);
  };

  useEffect(() => {
    resolvePosition(position.lat, position.lng);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Handle GPS "Locate Me" button click
  const handleLocateMe = async () => {
    setIsLocatingDevice(true);
    setErrorMessage(null);
    try {
      const pos = await locationService.getCurrentPosition();
      setPosition({ lat: pos.latitude, lng: pos.longitude });
      setPanTarget({ lat: pos.latitude, lng: pos.longitude });
      setGpsAccuracy(pos.accuracy);
      resolvePosition(pos.latitude, pos.longitude);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to detect current GPS location.');
    } finally {
      setIsLocatingDevice(false);
    }
  };

  const handleConfirm = () => {
    const loc: LocationState = {
      label: geocodedAddress?.label || `Pin (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`,
      addressLine: geocodedAddress?.addressLine || geocodedAddress?.formattedAddress || `Lat: ${position.lat}, Lon: ${position.lng}`,
      postalCode: geocodedAddress?.postalCode || '560038',
      latitude: position.lat,
      longitude: position.lng,
      city: geocodedAddress?.city,
      state: geocodedAddress?.state,
    };
    onConfirmLocation(loc);
  };

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden rounded-2xl relative">
      {/* Interactive Map Canvas */}
      <div className="relative flex-1 min-h-[280px] sm:min-h-[340px] bg-slate-100 overflow-hidden">
        {apiKey && !apiKey.startsWith('MY_') ? (
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={position}
              defaultZoom={16}
              gestureHandling={'greedy'}
              disableDefaultUI={true}
              className="w-full h-full"
              onCameraChanged={(ev) => {
                const newCenter = ev.detail.center;
                if (newCenter) {
                  handlePositionChange(newCenter.lat, newCenter.lng);
                }
              }}
              onClick={(ev) => {
                if (ev.detail.latLng) {
                  const newLat = ev.detail.latLng.lat;
                  const newLng = ev.detail.latLng.lng;
                  setPosition({ lat: newLat, lng: newLng });
                  setPanTarget({ lat: newLat, lng: newLng });
                  resolvePosition(newLat, newLng);
                }
              }}
            >
              <MapController targetPos={panTarget} />
            </Map>
          </APIProvider>
        ) : (
          /* Visual fallback if API key not present */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-100 text-center relative select-none">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-inner mb-3">
              <Compass className="w-8 h-8 animate-pulse" />
            </div>
            <h4 className="font-extrabold text-slate-800 text-sm">Interactive Map Preview</h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Move coordinates below or use GPS to adjust your location.
            </p>
            <div className="mt-4 flex gap-2 text-xs font-mono bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
              <span>Lat: {position.lat.toFixed(5)}</span>
              <span>Lon: {position.lng.toFixed(5)}</span>
            </div>
          </div>
        )}

        {/* Center Target Pin Marker (fixed in center of map viewport) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 -translate-y-4">
          <div className="flex flex-col items-center animate-bounce-subtle">
            <div className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold shadow-lg flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Order will be delivered here</span>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
                <MapPin className="w-5 h-5 fill-white text-emerald-600" />
              </div>
              {/* Pulsing base beacon */}
              <div className="absolute -bottom-1 w-3 h-1.5 bg-slate-900/40 rounded-full blur-[1px]"></div>
            </div>
          </div>
        </div>

        {/* Floating Controls Overlay */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
          {/* Locate Me (GPS) Button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocatingDevice}
            title="Use current GPS location"
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-lg flex items-center justify-center text-slate-700 hover:text-emerald-600 active:scale-95 transition-all"
          >
            <Navigation
              className={`w-5 h-5 text-emerald-600 ${isLocatingDevice ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Accuracy Warning Pill if accuracy > 100m */}
        {gpsAccuracy && gpsAccuracy > 100 && (
          <div className="absolute top-3 left-3 right-16 z-20">
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/90 text-white text-xs font-semibold backdrop-blur-md shadow-md flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">
                Approximate GPS (~{Math.round(gpsAccuracy)}m). Drag map to pinpoint door.
              </span>
            </div>
          </div>
        )}

        {/* Error message banner */}
        {errorMessage && (
          <div className="absolute bottom-3 left-3 right-3 z-20">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white text-xs font-medium shadow-lg flex items-center justify-between gap-2">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-white/80 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Address & Serviceability Confirmation Drawer */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col gap-3.5 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                Delivering to
              </div>
              {isLoadingAddress ? (
                <div className="flex items-center gap-2 py-1 text-xs text-slate-500 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Fetching exact address...</span>
                </div>
              ) : (
                <>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                    {geocodedAddress?.label || 'Pinpoint Location'}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                    {geocodedAddress?.addressLine || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Micro Delivery Status Badge */}
          {serviceability && (
            <div
              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                serviceability.isServiceable
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}
            >
              {serviceability.isServiceable ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{serviceability.estimatedDeliveryRange}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Outside Zone</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Outside delivery zone notice */}
        {serviceability && !serviceability.isServiceable && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">DrinkIt isn't available at this location yet.</span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                We're not delivering to this location yet. Please drag the pin into our active fulfillment area in Bengaluru or LPU/Phagwara.
              </p>
            </div>
          </div>
        )}

        {/* Store Hub info if serviceable */}
        {serviceability && serviceability.isServiceable && serviceability.store && (
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <div className="flex items-center gap-1.5 truncate">
              <StoreIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Fulfilled by: <strong>{serviceability.store.name}</strong></span>
            </div>
            <span className="font-semibold shrink-0 text-slate-700">~{serviceability.distanceKm.toFixed(1)} km</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoadingAddress}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm transition-all shadow-md active:scale-[0.99] ${
              serviceability?.isServiceable === false
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {serviceability?.isServiceable === false
                ? 'Confirm Location Anyway'
                : 'Confirm Delivery Location'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
