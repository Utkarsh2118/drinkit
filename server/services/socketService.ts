import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth.ts';
import { db } from '../db/database.ts';
import { User, Order } from '../types.ts';

interface AuthenticatedSocket extends Socket {
  user?: User;
}

class SocketService {
  private io: SocketIOServer | null = null;

  public init(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // Controlled by Express CORS
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    // 1. Authenticate Socket Handshake using JWT
    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace(/^Bearer\s+/, '') ||
          socket.handshake.query?.token;

        if (!token) {
          return next(new Error('Socket Authentication Error: Token is missing.'));
        }

        const payload = verifyToken(String(token));
        if (!payload) {
          return next(new Error('Socket Authentication Error: Token is expired or invalid.'));
        }

        const user = db.findUserById(payload.id);
        if (!user || user.isActive === false) {
          return next(new Error('Socket Authentication Error: User account not found or inactive.'));
        }

        socket.user = user;
        next();
      } catch (err: any) {
        next(new Error('Socket Authentication Failed: ' + (err.message || 'Unknown error')));
      }
    });

    // 2. Connection Handling with Strict Event & Room Authorization
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const user = socket.user;
      if (!user) {
        socket.disconnect(true);
        return;
      }

      // Automatically join private user notification channel
      socket.join(`user:${user.id}`);

      // Role-specific auto-joins
      if (user.role === 'admin') {
        socket.join('admin:operations');
      } else if (user.role === 'staff' && user.assignedStoreId) {
        socket.join(`store:${user.assignedStoreId}`);
      }

      // Authorize joining specific order room
      socket.on('join:order', (data: { orderId: string }, callback?: (res: any) => void) => {
        try {
          const { orderId } = data || {};
          if (!orderId) {
            if (callback) callback({ success: false, message: 'orderId is required' });
            return;
          }

          const order = db.findOrderById(orderId);
          if (!order) {
            if (callback) callback({ success: false, message: 'Order not found' });
            return;
          }

          // Strict Authorization Check:
          // Allowed:
          // 1. Customer who owns the order
          // 2. Staff assigned to that order's store
          // 3. Delivery rider assigned to the order
          // 4. Admin
          const isOwner = user.role === 'customer' && order.userId === user.id;
          const isStoreStaff = user.role === 'staff' && (user.assignedStoreId === order.storeId || !user.assignedStoreId);
          const isAssignedRider = user.role === 'delivery' && (order.deliveryAgentId === user.id || !order.deliveryAgentId);
          const isAdmin = user.role === 'admin';

          if (!isOwner && !isStoreStaff && !isAssignedRider && !isAdmin) {
            socket.emit('error:unauthorized', {
              message: 'Forbidden: You do not have permission to subscribe to telemetry for this order.',
              orderId,
            });
            if (callback) callback({ success: false, message: 'Unauthorized room subscription' });
            return;
          }

          socket.join(`order:${orderId}`);
          if (callback) callback({ success: true, message: `Subscribed to order:${orderId}` });
        } catch (err: any) {
          if (callback) callback({ success: false, message: err.message });
        }
      });

      // Authorize Delivery Agent Location Broadcasts
      socket.on('delivery:location_update', (data: {
        orderId: string;
        latitude: number;
        longitude: number;
        speedKmH?: number;
      }, callback?: (res: any) => void) => {
        try {
          // Strictly require delivery rider role
          if (user.role !== 'delivery' && user.role !== 'admin') {
            socket.emit('error:unauthorized', { message: 'Only authorized delivery partners can broadcast live coordinates.' });
            if (callback) callback({ success: false, message: 'Forbidden: Role DELIVERY required' });
            return;
          }

          const { orderId, latitude, longitude, speedKmH } = data || {};
          if (!orderId || typeof latitude !== 'number' || typeof longitude !== 'number') {
            if (callback) callback({ success: false, message: 'orderId, latitude, and longitude are required' });
            return;
          }

          const order = db.findOrderById(orderId);
          if (!order) {
            if (callback) callback({ success: false, message: 'Order not found' });
            return;
          }

          // Rider can only update location on an order assigned to THEM
          if (user.role === 'delivery' && order.deliveryAgentId && order.deliveryAgentId !== user.id) {
            socket.emit('error:unauthorized', {
              message: 'Forbidden: You cannot update delivery location for an order assigned to another rider.',
            });
            if (callback) callback({ success: false, message: 'Unauthorized: Not assigned to this order' });
            return;
          }

          // Broadcast sanitized coordinates to order room (customer tracking modal & staff)
          this.io?.to(`order:${orderId}`).emit('order:location_updated', {
            orderId,
            riderId: user.id,
            riderName: user.name,
            latitude,
            longitude,
            speedKmH: speedKmH || 24,
            timestamp: new Date().toISOString(),
          });

          if (callback) callback({ success: true, receivedAt: new Date().toISOString() });
        } catch (err: any) {
          if (callback) callback({ success: false, message: err.message });
        }
      });

      socket.on('disconnect', () => {
        // Cleanup handled automatically by Socket.io
      });
    });

    console.log('⚡ DrinkIt Secure Real-Time Socket.IO Subsystem Initialized');
  }

  /**
   * Broadcast order status update to relevant rooms
   */
  public emitOrderUpdate(order: Order, eventType: string = 'order:status_changed') {
    if (!this.io) return;
    // Broadcast to specific order room
    this.io.to(`order:${order.id}`).emit(eventType, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusTimeline: order.statusTimeline,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      updatedAt: order.updatedAt,
    });

    // Notify customer privately
    this.io.to(`user:${order.userId}`).emit('customer:order_updated', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    });

    // Notify dark store staff
    this.io.to(`store:${order.storeId}`).emit('store:order_updated', {
      orderId: order.id,
      status: order.status,
    });

    // Notify Admin operations room
    this.io.to('admin:operations').emit('admin:order_event', {
      orderId: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
    });
  }

  public getIO() {
    return this.io;
  }
}

export const socketService = new SocketService();
