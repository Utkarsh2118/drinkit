import { Store } from '../types.ts';

export interface DeliveryEstimateResult {
  estimatedMinutes: number;
  estimatedRange: string;
  distanceKm: number;
  isDeliverable: boolean;
  storeId: string;
  storeName: string;
}

export class DeliveryEstimationService {
  /**
   * Haversine formula to compute great-circle distance between two GPS coordinates in kilometers
   */
  public static calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  /**
   * Computes quick-commerce delivery ETA based on:
   * - Store packing time (~6-8 min)
   * - Road travel time (avg 25 km/h urban speed = ~2.4 mins per km)
   * - Buffer / traffic delay (~4-5 mins)
   */
  public static estimateDelivery(
    store: Store,
    customerLat: number,
    customerLon: number
  ): DeliveryEstimateResult {
    const distanceKm = this.calculateDistanceKm(
      store.latitude,
      store.longitude,
      customerLat,
      customerLon
    );

    const isDeliverable = distanceKm <= store.serviceRadiusKm && store.deliveryEnabled;

    const prepMinutes = 7;
    const transitMinutes = Math.ceil(distanceKm * 2.5);
    const trafficBuffer = 5;
    const totalMinutes = prepMinutes + transitMinutes + trafficBuffer;

    const lowerBound = Math.max(15, totalMinutes - 3);
    const upperBound = totalMinutes + 4;

    return {
      estimatedMinutes: totalMinutes,
      estimatedRange: `${lowerBound}–${upperBound} min`,
      distanceKm,
      isDeliverable,
      storeId: store.id,
      storeName: store.name,
    };
  }

  /**
   * Finds the nearest active store for a given coordinate
   */
  public static findNearestStore(
    stores: Store[],
    lat: number,
    lon: number
  ): { store: Store; distanceKm: number } | null {
    const activeStores = stores.filter(s => s.isActive && s.deliveryEnabled);
    if (activeStores.length === 0) return null;

    let nearest = activeStores[0];
    let minDistance = this.calculateDistanceKm(nearest.latitude, nearest.longitude, lat, lon);

    for (let i = 1; i < activeStores.length; i++) {
      const dist = this.calculateDistanceKm(activeStores[i].latitude, activeStores[i].longitude, lat, lon);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = activeStores[i];
      }
    }

    return { store: nearest, distanceKm: minDistance };
  }
}
