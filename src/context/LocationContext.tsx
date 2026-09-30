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
    label: 'Lucknow — Hazratganj & Gomti Nagar',
    addressLine: 'Vipin Khand, Near Riverside Mall, Gomti Nagar, Lucknow',
    postalCode: '226010',
    latitude: 26.8500,
    longitude: 80.9995,
    city: 'Lucknow',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Noida Sector 18 & Central NCR',
    addressLine: 'Pocket E, Atta Market, Sector 18, Noida',
    postalCode: '201301',
    latitude: 28.5708,
    longitude: 77.3271,
    city: 'Noida',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Central Delhi — Connaught Place',
    addressLine: 'Outer Circle, Connaught Place, New Delhi',
    postalCode: '110001',
    latitude: 28.6315,
    longitude: 77.2167,
    city: 'New Delhi',
    state: 'Delhi',
  },
  {
    label: 'South Delhi — Saket & GK',
    addressLine: 'Community Centre, Saket District Centre, New Delhi',
    postalCode: '110017',
    latitude: 28.5244,
    longitude: 77.2167,
    city: 'South Delhi',
    state: 'Delhi',
  },
  {
    label: 'Greater Noida — Pari Chowk & Alpha',
    addressLine: 'Commercial Belt, Alpha 1, Greater Noida',
    postalCode: '201308',
    latitude: 28.4744,
    longitude: 77.5040,
    city: 'Greater Noida',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Ghaziabad — Indirapuram & Raj Nagar',
    addressLine: 'Kala Patthar Road, Nyay Khand 2, Indirapuram, Ghaziabad',
    postalCode: '201014',
    latitude: 28.6434,
    longitude: 77.3704,
    city: 'Ghaziabad',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Kanpur — Civil Lines & Swaroop Nagar',
    addressLine: 'The Mall Road, Civil Lines, Kanpur',
    postalCode: '208001',
    latitude: 26.4716,
    longitude: 80.3458,
    city: 'Kanpur',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Agra — Sanjay Place & Tajganj',
    addressLine: 'Fatehabad Road, Tajganj, Agra',
    postalCode: '282001',
    latitude: 27.1610,
    longitude: 78.0421,
    city: 'Agra',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Varanasi — Sigra & Cantt',
    addressLine: 'Vidyapeeth Road, Sigra, Varanasi',
    postalCode: '221002',
    latitude: 25.3176,
    longitude: 82.9739,
    city: 'Varanasi',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Prayagraj — Civil Lines & Katra',
    addressLine: 'MG Marg, Civil Lines, Prayagraj',
    postalCode: '211001',
    latitude: 25.4358,
    longitude: 81.8463,
    city: 'Prayagraj',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Meerut — Shastri Nagar & Civil Lines',
    addressLine: 'Garh Road, Shastri Nagar, Meerut',
    postalCode: '250004',
    latitude: 28.9845,
    longitude: 77.7064,
    city: 'Meerut',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Bareilly — Civil Lines & Rampur Garden',
    addressLine: 'Station Road, Civil Lines, Bareilly',
    postalCode: '243001',
    latitude: 28.3670,
    longitude: 79.4304,
    city: 'Bareilly',
    state: 'Uttar Pradesh',
  },
  {
    label: 'Gorakhpur — Golghar & Civil Lines',
    addressLine: 'Park Road, Golghar, Gorakhpur',
    postalCode: '273001',
    latitude: 26.7606,
    longitude: 83.3732,
    city: 'Gorakhpur',
    state: 'Uttar Pradesh',
  },
  {
    label: 'North Delhi — Model Town & Civil Lines',
    addressLine: 'Mall Road, Model Town, North Delhi',
    postalCode: '110009',
    latitude: 28.7041,
    longitude: 77.1025,
    city: 'North Delhi',
    state: 'Delhi',
  },
  {
    label: 'East Delhi — Preet Vihar & Mayur Vihar',
    addressLine: 'Vikas Marg, Preet Vihar, East Delhi',
    postalCode: '110092',
    latitude: 28.6280,
    longitude: 77.2770,
    city: 'East Delhi',
    state: 'Delhi',
  },
  {
    label: 'West Delhi — Rajouri Garden & Punjabi Bagh',
    addressLine: 'Ring Road, Rajouri Garden, West Delhi',
    postalCode: '110027',
    latitude: 28.6692,
    longitude: 77.1230,
    city: 'West Delhi',
    state: 'Delhi',
  },
];

const INITIAL_SAVED_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr_home_sample',
    label: 'home',
    title: 'Home',
    fullName: 'Pooja Nair',
    phone: '+91 98765 43213',
    flatNumber: 'Tower 4, Flat 602, ATS Greens',
    landmark: 'Sector 93A',
    addressLine1: 'Noida Expressway',
    city: 'Noida',
    state: 'Uttar Pradesh',
    postalCode: '201304',
    latitude: 28.5173,
    longitude: 77.3821,
    isDefault: true,
  },
  {
    id: 'addr_work_sample',
    label: 'work',
    title: 'Work / Office',
    fullName: 'Pooja Nair',
    phone: '+91 98765 43213',
    flatNumber: 'DLF Cyber City / Saket Centre',
    landmark: 'Near Select Citywalk',
    addressLine1: 'Press Enclave Road, Saket',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110017',
    latitude: 28.5244,
    longitude: 77.2167,
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
  // Load initial location from localStorage or default to Noida & NCR
  const [selectedLocation, setSelectedLocation] = useState<LocationState>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY_LOC);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed.state &&
          parsed.city &&
          parsed.postalCode &&
          parsed.state !== 'Karnataka' &&
          parsed.city !== 'Bengaluru'
        ) {
          return parsed;
        }
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
