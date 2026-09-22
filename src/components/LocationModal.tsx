import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Check,
  X,
  Clock,
  Store as StoreIcon,
  Search,
  Home,
  Briefcase,
  Plus,
  Compass,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  useLocation,
  POPULAR_LOCATIONS,
  LocationState,
  SavedAddress,
} from '../context/LocationContext.tsx';
import {
  locationService,
  GeocodedAddress,
  GeolocationException,
} from '../services/locationService.ts';
import { MapLocationPicker } from './MapLocationPicker.tsx';

type ModalView = 'list' | 'map' | 'add_address';

export const LocationModal: React.FC = () => {
  const {
    isLocationModalOpen,
    closeLocationModal,
    selectedLocation,
    selectLocation,
    savedAddresses,
    saveAddress,
    deleteSavedAddress,
    recentLocations,
    activeStore,
    estimatedDeliveryRange,
    isServiceable,
    setGpsAccuracy,
  } = useLocation();

  const [currentView, setCurrentView] = useState<ModalView>('list');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // GPS Detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [permissionError, setPermissionError] = useState<{
    title: string;
    message: string;
    canRetry: boolean;
  } | null>(null);

  // Map adjustment coordinates
  const [mapInitialCoords, setMapInitialCoords] = useState<{ lat: number; lon: number }>({
    lat: selectedLocation.latitude,
    lon: selectedLocation.longitude,
  });

  // Add Address Form State
  const [newAddrLabel, setNewAddrLabel] = useState<'home' | 'work' | 'other'>('home');
  const [newAddrFlat, setNewAddrFlat] = useState('');
  const [newAddrLandmark, setNewAddrLandmark] = useState('');
  const [newAddrPhone, setNewAddrPhone] = useState('+91 98765 43213');
  const [newAddrName, setNewAddrName] = useState('Pooja Nair');

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset states when modal is opened/closed
  useEffect(() => {
    if (isLocationModalOpen) {
      setCurrentView('list');
      setSearchQuery('');
      setSearchResults([]);
      setPermissionError(null);
      setIsDetecting(false);
      setMapInitialCoords({
        lat: selectedLocation.latitude,
        lon: selectedLocation.longitude,
      });
    }
  }, [isLocationModalOpen, selectedLocation]);

  // Handle Search input change with debounce
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (text.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await locationService.searchPlaces(text);
      setSearchResults(results);
      setIsSearching(false);
    }, 350);
  };

  // Handle GPS "Use my current location"
  const handleUseCurrentLocation = async () => {
    setIsDetecting(true);
    setPermissionError(null);

    try {
      const coords = await locationService.getCurrentPosition();
      setGpsAccuracy(coords.accuracy);

      // Reverse geocode to get actual human-readable address
      const geocoded = await locationService.reverseGeocode(coords.latitude, coords.longitude);

      // Set coordinates for the map picker and switch to map view for user confirmation
      setMapInitialCoords({
        lat: coords.latitude,
        lon: coords.longitude,
      });
      setCurrentView('map');
    } catch (err: any) {
      if (err instanceof GeolocationException) {
        if (err.code === 'PERMISSION_DENIED') {
          setPermissionError({
            title: 'Location access is turned off',
            message:
              'You can search for your location manually or enable location access in browser settings.',
            canRetry: true,
          });
        } else if (err.code === 'TIMEOUT') {
          setPermissionError({
            title: 'Location request timed out',
            message: 'Unable to detect your GPS signal. Please try again or search manually.',
            canRetry: true,
          });
        } else {
          setPermissionError({
            title: 'Location unavailable',
            message: err.message || 'Check your device location services.',
            canRetry: true,
          });
        }
      } else {
        setPermissionError({
          title: 'Location error',
          message: err.message || 'An unexpected error occurred while detecting location.',
          canRetry: true,
        });
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // Select a search result
  const handleSelectSearchResult = (res: GeocodedAddress) => {
    setMapInitialCoords({
      lat: res.latitude,
      lon: res.longitude,
    });
    setCurrentView('map');
  };

  // Select a saved address
  const handleSelectSavedAddress = async (saved: SavedAddress) => {
    const loc: LocationState = {
      label: saved.title || `${saved.label.toUpperCase()} — ${saved.addressLine1}`,
      addressLine: `${saved.flatNumber ? saved.flatNumber + ', ' : ''}${saved.addressLine1}, ${saved.city}`,
      postalCode: saved.postalCode,
      latitude: saved.latitude,
      longitude: saved.longitude,
      city: saved.city,
      state: saved.state,
    };
    await selectLocation(loc);
  };

  // Confirm location from Map Picker
  const handleConfirmFromMap = async (loc: LocationState) => {
    await selectLocation(loc);
  };

  // Submit Add Address
  const handleSaveNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    saveAddress({
      label: newAddrLabel,
      title: newAddrLabel === 'home' ? 'Home' : newAddrLabel === 'work' ? 'Work' : 'Other',
      fullName: newAddrName || 'Pooja Nair',
      phone: newAddrPhone || '+91 98765 43213',
      flatNumber: newAddrFlat,
      landmark: newAddrLandmark,
      addressLine1: selectedLocation.addressLine,
      city: selectedLocation.city || 'Bengaluru',
      state: selectedLocation.state || 'Karnataka',
      postalCode: selectedLocation.postalCode,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
    });
    setCurrentView('list');
  };

  if (!isLocationModalOpen) return null;

  return (
    <div
      id="drinkit-location-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div
        id="drinkit-location-modal-container"
        className="relative w-full sm:max-w-xl md:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] border border-slate-200 animate-slide-up"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            {currentView !== 'list' ? (
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="p-1.5 -ml-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Back to location list"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                {currentView === 'list' && 'Select Delivery Location'}
                {currentView === 'map' && 'Adjust Pin on Map'}
                {currentView === 'add_address' && 'Save Delivery Address'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                {currentView === 'list' && 'Quick-commerce delivery within 20–30 mins'}
                {currentView === 'map' && 'Drag map to align with your exact doorstep'}
                {currentView === 'add_address' && 'Save for instant 1-click checkout'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-location-modal"
            type="button"
            onClick={closeLocationModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW 1: Main Location Selector (Search + GPS + Saved + Hubs) */}
        {currentView === 'list' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="input-location-search"
                type="text"
                placeholder="Search area, street, landmark (e.g. LPU, Indiranagar)..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {isSearching && (
              <div className="flex items-center justify-center py-4 text-xs text-slate-500 font-semibold gap-2 bg-white rounded-2xl border border-slate-200 shadow-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Searching official places & coordinates...</span>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
                <div className="px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-50">
                  Search Results
                </div>
                {searchResults.map((res, idx) => (
                  <button
                    key={`${res.formattedAddress}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-emerald-50/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {res.label}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {res.addressLine}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 shrink-0 self-center" />
                  </button>
                ))}
              </div>
            )}

            {/* PRIMARY CTA: Use my current location */}
            <div className="bg-white rounded-2xl border border-emerald-200/80 p-3.5 sm:p-4 shadow-xs">
              <button
                id="btn-use-current-location"
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isDetecting}
                className="w-full flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0">
                    <Navigation
                      className={`w-5 h-5 ${isDetecting ? 'animate-spin' : ''}`}
                    />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                      <span>Use my current location</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                        GPS
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {isDetecting
                        ? 'Detecting your coordinates...'
                        : 'Detect location automatically via device GPS'}
                    </div>
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                  {isDetecting ? 'Locating...' : 'Locate'}
                </div>
              </button>

              {/* Permission Error State Banner */}
              {permissionError && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs animate-fade-in space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-900">{permissionError.title}</div>
                      <p className="text-rose-700 text-[11px] mt-0.5">
                        {permissionError.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const inputEl = document.getElementById('input-location-search');
                        if (inputEl) inputEl.focus();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-800 font-bold text-xs hover:bg-rose-100/50 transition-colors"
                    >
                      Search Manually
                    </button>
                    {permissionError.canRetry && (
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Try Again</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Map Picker Button */}
            <button
              type="button"
              onClick={() => {
                setMapInitialCoords({
                  lat: selectedLocation.latitude,
                  lon: selectedLocation.longitude,
                });
                setCurrentView('map');
              }}
              className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-colors text-left shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900">
                    Set delivery location on Map
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Drag pin to adjust exact delivery coordinates
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* SAVED ADDRESSES */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Saved Addresses
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentView('add_address')}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New</span>
                </button>
              </div>

              <div className="space-y-2">
                {savedAddresses.map((addr) => {
                  const isSelected =
                    Math.abs(selectedLocation.latitude - addr.latitude) < 0.001 &&
                    Math.abs(selectedLocation.longitude - addr.longitude) < 0.001;

                  return (
                    <div
                      key={addr.id}
                      className={`group w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className="flex-1 flex items-start gap-3 text-left min-w-0"
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {addr.label === 'home' ? (
                            <Home className="w-4 h-4" />
                          ) : addr.label === 'work' ? (
                            <Briefcase className="w-4 h-4" />
                          ) : (
                            <MapPin className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 capitalize">
                              {addr.title || addr.label}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                            {addr.flatNumber ? `${addr.flatNumber}, ` : ''}
                            {addr.addressLine1}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {addr.city} — {addr.postalCode}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => deleteSavedAddress(addr.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 transition-opacity"
                            title="Remove address"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PRESET ACTIVE HUBS */}
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                Active Fulfillment Zones
              </div>
              <div className="space-y-2">
                {POPULAR_LOCATIONS.map((loc) => {
                  const isSelected =
                    Math.abs(selectedLocation.latitude - loc.latitude) < 0.001 &&
                    Math.abs(selectedLocation.longitude - loc.longitude) < 0.001;

                  return (
                    <button
                      key={loc.label}
                      type="button"
                      onClick={() => selectLocation(loc)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                            <span>{loc.label}</span>
                            {isSelected && (
                              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{loc.addressLine}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-700 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Active Store & ETA summary */}
            {activeStore && (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <StoreIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate">{activeStore.name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isServiceable
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isServiceable ? 'Deliverable' : 'Outside Zone'}
                  </span>
                </div>
                <div className="text-slate-500 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" /> Delivery: {estimatedDeliveryRange}
                  </span>
                  <span>Radius: {activeStore.serviceRadiusKm} km</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Interactive Map Picker */}
        {currentView === 'map' && (
          <div className="flex-1 flex flex-col min-h-[420px] sm:min-h-[460px] bg-slate-100 overflow-hidden">
            <MapLocationPicker
              initialLat={mapInitialCoords.lat}
              initialLon={mapInitialCoords.lon}
              onConfirmLocation={handleConfirmFromMap}
              onCancel={() => setCurrentView('list')}
            />
          </div>
        )}

        {/* VIEW 3: Add New Saved Address */}
        {currentView === 'add_address' && (
          <form
            onSubmit={handleSaveNewAddress}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white"
          >
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span className="font-bold text-slate-800">Selected Pin:</span>{' '}
              {selectedLocation.addressLine}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Save as
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['home', 'work', 'other'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewAddrLabel(type)}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold capitalize flex items-center justify-center gap-1.5 transition-all ${
                      newAddrLabel === type
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {type === 'home' && <Home className="w-3.5 h-3.5" />}
                    {type === 'work' && <Briefcase className="w-3.5 h-3.5" />}
                    {type === 'other' && <MapPin className="w-3.5 h-3.5" />}
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                House / Flat / Floor / Building <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Flat 302, Tower B, Palm Meadows"
                value={newAddrFlat}
                onChange={(e) => setNewAddrFlat(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Landmark (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Behind Metro Station or Near Corner House"
                value={newAddrLandmark}
                onChange={(e) => setNewAddrLandmark(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={newAddrName}
                  onChange={(e) => setNewAddrName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={newAddrPhone}
                  onChange={(e) => setNewAddrPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition-colors"
              >
                Save Address & Deliver
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
