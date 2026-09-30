import { Order, OrderStatus, OrderStatusHistoryEntry, User } from '../types.ts';
import { db } from '../db/database.ts';
import { socketService } from './socketService.ts';

// Allowed forward transitions matrix
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_PENDING'],
  CONFIRMED: ['STORE_ACCEPTED', 'PREPARING', 'CANCELLED'],
  STORE_ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['ASSIGNED', 'DELIVERY_ASSIGNED', 'PICKED_UP', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED', 'DELIVERY_FAILED'],
  DELIVERY_ASSIGNED: ['PICKED_UP', 'CANCELLED', 'DELIVERY_FAILED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED'],
  OUT_FOR_DELIVERY: ['ARRIVING_SOON', 'DELIVERED', 'DELIVERY_FAILED'],
  ARRIVING_SOON: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERED: ['REFUND_INITIATED', 'REFUNDED'],
  CANCELLED: ['REFUND_INITIATED', 'REFUNDED'],
  REFUND_INITIATED: ['REFUNDED'],
  REFUNDED: [],
  PAYMENT_PENDING: ['CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'CANCELLED'],
  DELIVERY_FAILED: ['OUT_FOR_DELIVERY', 'CANCELLED', 'REFUND_INITIATED', 'REFUNDED'],
};

// Automatic ETA computation based on current status
export function calculateEtaForStatus(status: OrderStatus, currentEta?: string): string {
  switch (status) {
    case 'PLACED':
    case 'CONFIRMED':
      return '25–35 min';
    case 'STORE_ACCEPTED':
      return '20–30 min';
    case 'PREPARING':
      return '15–25 min';
    case 'READY_FOR_PICKUP':
      return '12–20 min';
    case 'ASSIGNED':
    case 'DELIVERY_ASSIGNED':
      return '10–18 min';
    case 'PICKED_UP':
      return '10–15 min';
    case 'OUT_FOR_DELIVERY':
      return '8–12 min';
    case 'ARRIVING_SOON':
      return '2–5 min';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    case 'DELIVERY_FAILED':
      return 'Delivery Failed';
    case 'REFUNDED':
      return 'Refunded';
    default:
      return currentEta || 'Delivery time will be updated shortly';
  }
}

export class OrderStatusService {
  /**
   * Validate if a status transition is permissible for the actor
   */
  public static validateTransition(
    order: Order,
    nextStatus: OrderStatus,
    actor: { id: string; name: string; role: string; assignedStoreId?: string }
  ): { valid: boolean; message?: string } {
    // Admin has superuser override authority (logged in audit)
    if (actor.role === 'admin') {
      return { valid: true };
    }

    // Customer can only cancel eligible orders
    if (actor.role === 'customer') {
      if (nextStatus === 'CANCELLED') {
        const cancellableStatuses: OrderStatus[] = ['PLACED', 'CONFIRMED', 'STORE_ACCEPTED', 'PREPARING'];
        if (!cancellableStatuses.includes(order.status)) {
          return {
            valid: false,
            message: `Order cannot be cancelled once packed for dispatch (current status: ${order.status}).`,
          };
        }
        return { valid: true };
      }
      return {
        valid: false,
        message: 'Forbidden: Customers cannot manually alter order delivery statuses.',
      };
    }

    // Store Staff authority
    if (actor.role === 'staff') {
      if (actor.assignedStoreId && order.storeId !== actor.assignedStoreId) {
        return {
          valid: false,
          message: 'Forbidden: Store staff cannot modify orders from another store.',
        };
      }

      const staffAllowed: OrderStatus[] = ['STORE_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'];
      if (!staffAllowed.includes(nextStatus)) {
        return {
          valid: false,
          message: `Store staff can only update store preparation states (${staffAllowed.join(', ')}).`,
        };
      }
    }

    // Delivery Partner authority
    if (actor.role === 'delivery') {
      if (order.deliveryAgentId && order.deliveryAgentId !== actor.id) {
        return {
          valid: false,
          message: 'Forbidden: You are not the assigned delivery partner for this order.',
        };
      }

      const riderAllowed: OrderStatus[] = [
        'ASSIGNED',
        'DELIVERY_ASSIGNED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'ARRIVING_SOON',
        'DELIVERED',
        'DELIVERY_FAILED',
      ];
      if (!riderAllowed.includes(nextStatus)) {
        return {
          valid: false,
          message: `Delivery partner can only transition delivery states (${riderAllowed.join(', ')}).`,
        };
      }
    }

    // Transition graph check
    const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(nextStatus) && order.status !== nextStatus) {
      return {
        valid: false,
        message: `Invalid transition: Cannot move order from ${order.status} directly to ${nextStatus}.`,
      };
    }

    return { valid: true };
  }

  /**
   * Transition order to new status, record immutable history, update ETA, and broadcast real-time events
   */
  public static transition(
    orderId: string,
    nextStatus: OrderStatus,
    options: {
      note?: string;
      actor: { id: string; name: string; role: string; assignedStoreId?: string };
      failureReason?: string;
      failureDetails?: string;
      location?: { latitude: number; longitude: number };
    }
  ): { success: boolean; order?: Order; message?: string } {
    const order = db.findOrderById(orderId);
    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    const validation = this.validateTransition(order, nextStatus, options.actor);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Update ETA automatically based on new status
    const newEta = calculateEtaForStatus(nextStatus, order.estimatedDeliveryTime);
    order.estimatedDeliveryTime = newEta;
    order.status = nextStatus;
    order.updatedAt = new Date().toISOString();

    if (nextStatus === 'OUT_FOR_DELIVERY' || nextStatus === 'ARRIVING_SOON' || nextStatus === 'PICKED_UP') {
      order.trackingEnabled = true;
    } else if (nextStatus === 'DELIVERED' || nextStatus === 'CANCELLED' || nextStatus === 'DELIVERY_FAILED') {
      order.trackingEnabled = false;
    }

    if (options.failureReason) {
      order.failureReason = options.failureReason;
      order.failureDetails = options.failureDetails;
    }

    // Ensure status history is never overwritten; append with actor role and note
    if (!order.statusTimeline) {
      order.statusTimeline = [];
    }

    const historyEntry: OrderStatusHistoryEntry = {
      status: nextStatus,
      timestamp: new Date().toISOString(),
      note: options.note || `Status updated to ${nextStatus}`,
      updatedBy: options.actor.name,
      actorRole: options.actor.role,
    };
    order.statusTimeline.push(historyEntry);

    // Audit log
    db.logAudit(
      options.actor.id,
      options.actor.name,
      options.actor.role,
      'ORDER_STATUS_TRANSITION',
      'Order',
      order.id,
      `Order status moved to ${nextStatus}${options.note ? ` (${options.note})` : ''}`
    );

    // Customer Notification
    this.createCustomerNotification(order, nextStatus);

    // Persist changes
    db.persist();

    // Broadcast Real-Time Socket.IO Events
    this.emitRealtimeEvents(order, nextStatus);

    return { success: true, order };
  }

  /**
   * Broadcast structured Socket.IO events to rooms
   */
  private static emitRealtimeEvents(order: Order, status: OrderStatus) {
    const io = socketService.getIO();
    if (!io) return;

    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusTimeline: order.statusTimeline,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      trackingEnabled: order.trackingEnabled,
      deliveryAgentName: order.deliveryAgentName,
      deliveryAgentPhone: order.deliveryAgentPhone,
      deliveryAgentId: order.deliveryAgentId,
      lastKnownDeliveryLocation: order.lastKnownDeliveryLocation,
      updatedAt: order.updatedAt,
    };

    // 1. Specific order room (for customer tracking modal & store live board)
    io.to(`order:${order.id}`).emit('order:status', payload);
    io.to(`order:${order.id}`).emit('order:status_changed', payload);
    io.to(`order:${order.id}`).emit('order:eta', {
      orderId: order.id,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
    });

    if (status === 'DELIVERED') {
      io.to(`order:${order.id}`).emit('order:delivered', {
        orderId: order.id,
        deliveredAt: order.updatedAt,
        orderNumber: order.orderNumber,
      });
    }

    // 2. Customer user channel
    io.to(`user:${order.userId}`).emit('customer:order_updated', payload);

    // 3. Store channel
    io.to(`store:${order.storeId}`).emit('store:order_updated', payload);

    // 4. Admin operations channel
    io.to('admin:operations').emit('admin:order_event', payload);
  }

  /**
   * Create contextual customer notification for important status milestones
   */
  private static createCustomerNotification(order: Order, status: OrderStatus) {
    let title = '';
    let message = '';

    switch (status) {
      case 'CONFIRMED':
        title = '✅ Order Confirmed';
        message = `Your order #${order.orderNumber} is confirmed and routed to ${order.storeName}.`;
        break;
      case 'STORE_ACCEPTED':
        title = '🏪 Store Accepted Order';
        message = `${order.storeName} accepted your order and began preparation.`;
        break;
      case 'PREPARING':
        title = '❄️ Chilled Bottles Being Packed';
        message = `Store staff are carefully packing your tamper-sealed chilled drinks.`;
        break;
      case 'READY_FOR_PICKUP':
        title = '📦 Packed & Sealed';
        message = `Your order is packed in insulated packaging, awaiting rider pickup.`;
        break;
      case 'ASSIGNED':
      case 'DELIVERY_ASSIGNED':
        title = '🛵 Delivery Partner Assigned';
        message = `${order.deliveryAgentName || 'Rider'} has been assigned to your order.`;
        break;
      case 'PICKED_UP':
        title = '🎒 Order Picked Up';
        message = `${order.deliveryAgentName || 'Rider'} picked up your package from the hub.`;
        break;
      case 'OUT_FOR_DELIVERY':
        title = '🚀 Out for Delivery!';
        message = `Your rider is on the way! ETA: ${order.estimatedDeliveryTime}. Verification PIN: ${order.deliveryOtp}.`;
        break;
      case 'ARRIVING_SOON':
        title = '🔔 Rider Arriving Soon!';
        message = `Your rider is less than 5 minutes away. Keep your 4-digit PIN ${order.deliveryOtp} ready!`;
        break;
      case 'DELIVERED':
        title = '🎉 Order Delivered!';
        message = `Order #${order.orderNumber} has been delivered. Enjoy responsibly!`;
        break;
      case 'CANCELLED':
        title = '❌ Order Cancelled';
        message = `Order #${order.orderNumber} was cancelled. Any online payment will be refunded 100%.`;
        break;
      case 'DELIVERY_FAILED':
        title = '⚠️ Delivery Attempt Issue';
        message = `Delivery attempt for #${order.orderNumber} could not be completed: ${order.failureReason || 'Customer unavailable'}. Support will reach out.`;
        break;
      default:
        return;
    }

    db.createNotification({
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: order.userId,
      title,
      message,
      type: 'order',
      isRead: false,
      link: `/orders/${order.id}`,
      createdAt: new Date().toISOString(),
    });
  }
}
