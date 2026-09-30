import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Order, OrderStatus, DeliveryLocation } from '../types.ts';
import { api } from './api.ts';

class SocketClientService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  public getSocket(): Socket | null {
    const token = localStorage.getItem('drinkit_token') || sessionStorage.getItem('drinkit_token');
    if (!token) {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      return null;
    }

    // Reuse existing socket if token hasn't changed
    if (this.socket && this.socket.connected && this.currentToken === token) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentToken = token;
    this.socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Connected to DrinkIt real-time telematics socket');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Realtime socket connection notice:', err.message);
    });

    return this.socket;
  }

  public subscribeToOrder(orderId: string, onUpdate?: (data: any) => void) {
    const sock = this.getSocket();
    if (!sock) return () => {};

    sock.emit('join:order', { orderId }, (res: any) => {
      if (res && !res.success) {
        console.warn('Order subscription notice:', res.message);
      }
    });

    return () => {
      // Cleanup handled automatically on room leave or disconnect
    };
  }

  public sendLocation(orderId: string, location: { latitude: number; longitude: number; speedKmH?: number }) {
    const sock = this.getSocket();
    if (sock && sock.connected) {
      sock.emit('delivery:location_update', {
        orderId,
        ...location,
      });
    }
  }
}

export const socketClient = new SocketClientService();

export interface TrackingData {
  order: Order | null;
  status: OrderStatus;
  estimatedDeliveryTime: string;
  trackingEnabled: boolean;
  storeLocation: {
    name: string;
    address: string;
    area?: string;
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
    photo?: string;
    rating?: number;
    vehicle?: string;
  } | null;
  lastKnownLocation: DeliveryLocation | null;
  statusTimeline: any[];
  deliveryOtp?: string;
  isLiveConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * High-performance React hook for real-time order tracking
 * Combines HTTP initialization with Socket.IO live updates & polling fallback
 */
export function useOrderTracking(orderId: string | null) {
  const [data, setData] = useState<TrackingData>({
    order: null,
    status: 'PLACED',
    estimatedDeliveryTime: '20–25 min',
    trackingEnabled: false,
    storeLocation: null,
    customerLocation: {
      addressLine: '',
      latitude: 28.572,
      longitude: 77.325,
    },
    deliveryPartner: null,
    lastKnownLocation: null,
    statusTimeline: [],
    isLiveConnected: false,
    isLoading: true,
    error: null,
  });

  const fetchTracking = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get<any>(`/orders/${orderId}/tracking`);
      if (res) {
        setData(prev => ({
          ...prev,
          order: res.order || null,
          status: res.status || res.order?.status || 'PLACED',
          estimatedDeliveryTime: res.estimatedDeliveryTime || res.order?.estimatedDeliveryTime || '20–25 min',
          trackingEnabled: Boolean(res.trackingEnabled),
          storeLocation: res.storeLocation || null,
          customerLocation: res.customerLocation || prev.customerLocation,
          deliveryPartner: res.deliveryPartner || null,
          lastKnownLocation: res.lastKnownLocation || prev.lastKnownLocation,
          statusTimeline: res.statusTimeline || res.order?.statusTimeline || [],
          deliveryOtp: res.deliveryOtp || res.order?.deliveryOtp,
          isLoading: false,
          error: null,
        }));
      }
    } catch (err: any) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to load tracking data',
      }));
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    fetchTracking();

    // Connect Real-Time Socket
    const socket = socketClient.getSocket();
    let isSubscribed = true;

    if (socket) {
      socketClient.subscribeToOrder(orderId);

      const handleStatus = (payload: any) => {
        if (!isSubscribed || payload.orderId !== orderId) return;
        setData(prev => ({
          ...prev,
          status: payload.status || prev.status,
          statusTimeline: payload.statusTimeline || prev.statusTimeline,
          estimatedDeliveryTime: payload.estimatedDeliveryTime || prev.estimatedDeliveryTime,
          trackingEnabled: payload.trackingEnabled !== undefined ? payload.trackingEnabled : prev.trackingEnabled,
          deliveryPartner: payload.deliveryAgentName
            ? {
                id: payload.deliveryAgentId || prev.deliveryPartner?.id || '',
                name: payload.deliveryAgentName,
                phone: payload.deliveryAgentPhone || prev.deliveryPartner?.phone || '',
                rating: prev.deliveryPartner?.rating || 4.9,
              }
            : prev.deliveryPartner,
          isLiveConnected: true,
        }));
      };

      const handleLocation = (payload: any) => {
        if (!isSubscribed || payload.orderId !== orderId) return;
        setData(prev => ({
          ...prev,
          lastKnownLocation: {
            latitude: payload.latitude,
            longitude: payload.longitude,
            speedKmH: payload.speedKmH,
            heading: payload.heading,
            timestamp: payload.timestamp || new Date().toISOString(),
          },
          isLiveConnected: true,
        }));
      };

      const handleEta = (payload: any) => {
        if (!isSubscribed || payload.orderId !== orderId) return;
        setData(prev => ({
          ...prev,
          estimatedDeliveryTime: payload.estimatedDeliveryTime || prev.estimatedDeliveryTime,
        }));
      };

      const handleDelivered = (payload: any) => {
        if (!isSubscribed || payload.orderId !== orderId) return;
        setData(prev => ({
          ...prev,
          status: 'DELIVERED',
          trackingEnabled: false,
          estimatedDeliveryTime: 'Delivered',
        }));
      };

      socket.on('order:status', handleStatus);
      socket.on('order:status_changed', handleStatus);
      socket.on('order:location', handleLocation);
      socket.on('order:location_updated', handleLocation);
      socket.on('order:eta', handleEta);
      socket.on('order:delivered', handleDelivered);

      setData(prev => ({ ...prev, isLiveConnected: socket.connected }));

      return () => {
        isSubscribed = false;
        socket.off('order:status', handleStatus);
        socket.off('order:status_changed', handleStatus);
        socket.off('order:location', handleLocation);
        socket.off('order:location_updated', handleLocation);
        socket.off('order:eta', handleEta);
        socket.off('order:delivered', handleDelivered);
      };
    }

    // Safety fallback: poll every 6s only if socket is unavailable
    const fallbackPoll = setInterval(() => {
      fetchTracking();
    }, 6000);

    return () => {
      isSubscribed = false;
      clearInterval(fallbackPoll);
    };
  }, [orderId, fetchTracking]);

  return { ...data, refetch: fetchTracking };
}
