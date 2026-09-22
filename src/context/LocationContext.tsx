import React, { createContext, useContext, useState, useEffect } from 'react';
import { Store } from '../types.ts';
import { locationService, GeocodedAddress } from '../services/locationService.ts';

export interface LocationState {
  label: string;
  addressLine: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
}

export interface SavedAddress {
  id: string;
  label: 'home' | 'work' | 'other';
  title?: string;
  fullName: string;
  phone: string;
  flatNumber?: string;
  landmark?: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export const POPULAR_LOCATIONS: LocationState[] = [
  {
    label: 'Indiranagar Central',
    addressLine: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru',
    postalCode: '560038',
    latitude: 12.9784,
    longitude: 77.6408,
    city: 'Bengaluru',
    state: 'Karnataka',
  },
  {
    label: 'Koramangala South',
    addressLine: '80 Feet Road, 4th Block, Koramangala, Bengaluru',
    postalCode: '560034',
    latitude: 12.9352,
    longitude: 77.6245,
    city: 'Bengaluru',
    state: 'Karnataka',
  },
  {
    label: 'HSR Layout & BTM',
    addressLine: '27th Main Road, Sector 1, HSR Layout, Bengaluru',
    postalCode: '560102',
    latitude: 12.9121,
    longitude: 77.6446,
    city: 'Bengaluru',
    state: 'Karnataka',
  },
  {
    label: 'Whitefield Corridor',
    addressLine: 'ITPL Main Road, Prestige Shantiniketan, Bengaluru',
    postalCode: '560066',
    latitude: 12.9868,
    longitude: 77.7346,
    city: 'Bengaluru',
    state: 'Karnataka',
  },
  {
    label: 'LPU & Phagwara Express',
    addressLine: 'GT Road, Near LPU Main Gate, Phagwara, Punjab',
    postalCode: '144411',
    latitude: 31.2554,
    longitude: 75.7037,
    city: 'Phagwara',
    state: 'Punjab',
  },
];

const INITIAL_SAVED_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr_home_sample',
    label: 'home',
    title: 'Home',
    fullName: 'Pooja Nair',
    phone: '+91 98765 43213',
    flatNumber: 'Flat 402, Green Glen Heights',
    landmark: 'Near Corner House',
    addressLine1: 'HAL 2nd Stage, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    latitude: 12.9785,
    longitude: 77.6409,
    isDefault: true,
  },
  {
    id: 'addr_work_sample',
    label: 'work',
    title: 'Work / Office',
    fullName: 'Pooja Nair',
    phone: '+91 98765 43213',
    flatNumber: 'Level 5, WeWork',
    landmark: 'Prestige Tech Park',
    addressLine1: 'Outer Ring Road, Kadubeesanahalli',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560103',
    latitude: 12.9372,
    longitude: 77.6946,
    isDefault: false,
  },
];

interface LocationContextType {
  selectedLocation: LocationState;
  activeStore: Store | null;
  estimatedDeliveryRange: string;
  distanceKm: number;
  isServiceable: boolean;
  isLocationModalOpen: boolean;
  accuracyMeters: number | null;
  savedAddresses: SavedAddress[];
  recentLocations: LocationState[];
  openLocationModal: () => void;
  closeLocationModal: () => void;
  selectLocation: (loc: LocationState) => Promise<void>;
  saveAddress: (address: Omit<SavedAddress, 'id'>) => SavedAddress;
  deleteSavedAddress: (id: string) => void;
  setGpsAccuracy: (acc: number | null) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_LOC = 'drinkit_confirmed_location';
const LOCAL_STORAGE_KEY_ADDRS = 'drinkit_saved_addresses';
const LOCAL_STORAGE_KEY_RECENTS = 'drinkit_recent_locations';

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial location from localStorage or default to Indiranagar
  const [selectedLocation, setSelectedLocation] = useState<LocationState>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY_LOC);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached location', e);
    }
    return POPULAR_LOCATIONS[0];
  });

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY_ADDRS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached saved addresses', e);
    }
    return INITIAL_SAVED_ADDRESSES;
  });

  const [recentLocations, setRecentLocations] = useState<LocationState[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY_RECENTS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached recent locations', e);
    }
    return [POPULAR_LOCATIONS[0], POPULAR_LOCATIONS[1]];
  });

  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [estimatedDeliveryRange, setEstimatedDeliveryRange] = useState<string>('18–24 min');
  const [distanceKm, setDistanceKm] = useState<number>(1.8);
  const [isServiceable, setIsServiceable] = useState<boolean>(true);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  const fetchStoreForLocation = async (loc: LocationState) => {
    try {
      const result = await locationService.checkServiceability(
        loc.latitude,
        loc.longitude,
        loc.postalCode
      );

      setActiveStore(result.store);
      setEstimatedDeliveryRange(result.estimatedDeliveryRange);
      setDistanceKm(result.distanceKm);
      setIsServiceable(result.isServiceable);
    } catch (e) {
      console.warn('Could not resolve nearest store, using fallback check', e);
    }
  };

  useEffect(() => {
    fetchStoreForLocation(selectedLocation);
  }, [selectedLocation.latitude, selectedLocation.longitude, selectedLocation.postalCode]);

  const selectLocation = async (loc: LocationState) => {
    setSelectedLocation(loc);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_LOC, JSON.stringify(loc));

      // Append to recent locations if not already present
      setRecentLocations((prev) => {
        const filtered = prev.filter(
          (p) =>
            Math.abs(p.latitude - loc.latitude) > 0.001 ||
            Math.abs(p.longitude - loc.longitude) > 0.001
        );
        const updated = [loc, ...filtered].slice(0, 5);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_RECENTS, JSON.stringify(updated));
        } catch (e) {
          // ignore
        }
        return updated;
      });
    } catch (e) {
      console.warn('Failed to store location locally', e);
    }

    await fetchStoreForLocation(loc);
    setIsLocationModalOpen(false);
  };

  const saveAddress = (addressData: Omit<SavedAddress, 'id'>): SavedAddress => {
    const newAddress: SavedAddress = {
      ...addressData,
      id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };

    setSavedAddresses((prev) => {
      const updated = [newAddress, ...prev];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ADDRS, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist saved addresses', e);
      }
      return updated;
    });

    return newAddress;
  };

  const deleteSavedAddress = (id: string) => {
    setSavedAddresses((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ADDRS, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist saved addresses', e);
      }
      return updated;
    });
  };

  return (
    <LocationContext.Provider
      value={{
        selectedLocation,
        activeStore,
        estimatedDeliveryRange,
        distanceKm,
        isServiceable,
        isLocationModalOpen,
        accuracyMeters,
        savedAddresses,
        recentLocations,
        openLocationModal: () => setIsLocationModalOpen(true),
        closeLocationModal: () => setIsLocationModalOpen(false),
        selectLocation,
        saveAddress,
        deleteSavedAddress,
        setGpsAccuracy: setAccuracyMeters,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};
