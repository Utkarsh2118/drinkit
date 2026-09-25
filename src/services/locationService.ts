import { Store } from '../types.ts';

export interface GeocodedAddress {
  label: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface GeolocationPositionResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type GeolocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export class GeolocationException extends Error {
  code: GeolocationErrorCode;
  constructor(message: string, code: GeolocationErrorCode) {
    super(message);
    this.name = 'GeolocationException';
    this.code = code;
  }
}

export interface ServiceabilityResult {
  isServiceable: boolean;
  store: Store | null;
  estimatedDeliveryRange: string;
  distanceKm: number;
  reason?: string;
}

export const locationService = {
  /**
   * Request live device coordinates from browser Geolocation API
   */
  async getCurrentPosition(): Promise<GeolocationPositionResult> {
    if (!('geolocation' in navigator)) {
      throw new GeolocationException(
        'Geolocation is not supported by your browser or device.',
        'UNSUPPORTED'
      );
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
          });
        },
        (error) => {
          let code: GeolocationErrorCode = 'UNKNOWN';
          let message = error.message || 'Unable to retrieve location';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              code = 'PERMISSION_DENIED';
              message =
                'Location access was denied. You can search manually or grant location permission in your browser.';
              break;
            case error.POSITION_UNAVAILABLE:
              code = 'POSITION_UNAVAILABLE';
              message =
                'Current location is unavailable. Check your network or GPS connection.';
              break;
            case error.TIMEOUT:
              code = 'TIMEOUT';
              message = 'Location request timed out. Please try again.';
              break;
          }

          reject(new GeolocationException(message, code));
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
    });
  },

  /**
   * Reverse geocodes coordinates to a human-readable address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodedAddress> {
    try {
      const res = await fetch(`/api/location/reverse?lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      if (data.success && data.data) {
        return data.data;
      }
      throw new Error(data.message || 'Reverse geocoding failed');
    } catch (err: any) {
      // Fallback structured result with coordinates
      return {
        label: `Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
        addressLine: `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        city: '',
        state: '',
        postalCode: '',
        latitude,
        longitude,
        formattedAddress: `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`,
      };
    }
  },

  /**
   * Search for an area, street, or landmark
   */
  async searchPlaces(query: string): Promise<GeocodedAddress[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const res = await fetch(`/api/location/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('Place search request failed:', err);
      return [];
    }
  },

  /**
   * Check delivery zone & nearest store from backend
   */
  async checkServiceability(
    latitude: number,
    longitude: number,
    postalCode?: string
  ): Promise<ServiceabilityResult> {
    try {
      const queryParams = new URLSearchParams({
        lat: latitude.toString(),
        lon: longitude.toString(),
      });
      if (postalCode) {
        queryParams.append('postalCode', postalCode);
      }

      const res = await fetch(`/api/stores/nearest?${queryParams.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        const { store, deliveryEstimate, isServiceable } = data.data;
        return {
          isServiceable: Boolean(isServiceable),
          store: store || null,
          estimatedDeliveryRange: deliveryEstimate?.estimatedRange || '20–30 min',
          distanceKm: deliveryEstimate?.distanceKm || 0,
        };
      }

      return {
        isServiceable: false,
        store: null,
        estimatedDeliveryRange: '30–45 min',
        distanceKm: 0,
        reason: data.message || 'Store not serviceable',
      };
    } catch (err: any) {
      console.warn('Failed to verify serviceability with backend:', err);
      return {
        isServiceable: false,
        store: null,
        estimatedDeliveryRange: '25–35 min',
        distanceKm: 0,
        reason: 'Service check unavailable',
      };
    }
  },
};
