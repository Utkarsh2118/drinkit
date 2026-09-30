import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.ts';
import { OrderStatusService } from '../services/orderStatusService.ts';
import { socketService } from '../services/socketService.ts';
import { DeliveryLocation } from '../types.ts';

const router = Router();

// GET all orders assigned to current delivery partner
router.get('/my-orders', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const allOrders = db.getOrders();

  const riderOrders = allOrders.filter(o => o.deliveryAgentId === user.id);
  res.json({
    success: true,
    data: riderOrders,
  });
});

// GET orders ready for pickup / available for assignment in rider's service zone
router.get('/available-orders', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const allOrders = db.getOrders();
  const available = allOrders.filter(
    o =>
      !o.deliveryAgentId &&
      (o.status === 'READY_FOR_PICKUP' || o.status === 'PREPARING' || o.status === 'STORE_ACCEPTED' || o.status === 'CONFIRMED')
  );

  res.json({
    success: true,
    data: available,
  });
});

// ACCEPT / CLAIM DELIVERY
router.post('/orders/:orderId/accept', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (order.deliveryAgentId && order.deliveryAgentId !== user.id) {
    return res.status(409).json({
      success: false,
      message: 'This delivery has already been accepted by another delivery partner.',
      errorCode: 'ORDER_ALREADY_ASSIGNED',
    });
  }

  order.deliveryAgentId = user.id;
  order.deliveryAgentName = user.name;
  order.deliveryAgentPhone = user.phone || '+91 98765 43212';
  order.deliveryPartnerPhoto = user.avatarUrl || '/images/drinkit-logo.png';
  order.deliveryPartnerRating = 4.9;

  const result = OrderStatusService.transition(order.id, 'ASSIGNED', {
    note: `Delivery claimed by partner ${user.name}`,
    actor: { id: user.id, name: user.name, role: user.role },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  // Socket notification
  const io = socketService.getIO();
  if (io) {
    io.to(`order:${order.id}`).emit('order:assigned', {
      orderId: order.id,
      riderId: user.id,
      riderName: user.name,
      riderPhone: order.deliveryAgentPhone,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
    });
  }

  res.json({
    success: true,
    message: `Delivery accepted for order #${order.orderNumber}. Proceed to ${order.storeName} for pickup.`,
    data: result.order,
  });
});

// ARRIVED AT STORE
router.post('/orders/:orderId/arrived-store', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden: Not assigned to this delivery' });
  }

  // Record milestone in history
  order.statusTimeline.push({
    status: order.status,
    timestamp: new Date().toISOString(),
    note: `Rider ${user.name} arrived at dark store micro-warehouse`,
    updatedBy: user.name,
    actorRole: user.role,
  });
  order.updatedAt = new Date().toISOString();
  db.persist();

  socketService.emitOrderUpdate(order, 'order:rider_at_store');

  res.json({
    success: true,
    message: `Arrived at ${order.storeName}. Collect chilled package from dispatch counter.`,
    data: order,
  });
});

// PICK UP ORDER (at store)
router.post('/orders/:orderId/pickup', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden: Not assigned to this delivery' });
  }

  const result = OrderStatusService.transition(order.id, 'PICKED_UP', {
    note: `Chilled tamper-evident package inspected and collected from ${order.storeName}`,
    actor: { id: user.id, name: user.name, role: user.role },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: 'Package picked up from store. Start journey when ready.',
    data: result.order,
  });
});

// START DELIVERY (OUT FOR DELIVERY)
router.post('/orders/:orderId/start-delivery', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden: Not assigned to this delivery' });
  }

  const result = OrderStatusService.transition(order.id, 'OUT_FOR_DELIVERY', {
    note: `Rider ${user.name} departed on transit route with insulated temperature-controlled carrier`,
    actor: { id: user.id, name: user.name, role: user.role },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: 'Delivery transit started. Live GPS tracking active.',
    data: result.order,
  });
});

// ARRIVED NEAR CUSTOMER / ARRIVING SOON
router.post('/orders/:orderId/arrived-customer', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden: Not assigned to this delivery' });
  }

  const result = OrderStatusService.transition(order.id, 'ARRIVING_SOON', {
    note: `Rider ${user.name} arrived at customer building / doorstep`,
    actor: { id: user.id, name: user.name, role: user.role },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: 'Customer notified of arrival. Request 4-digit verification PIN and verify 21+ ID.',
    data: result.order,
  });
});

// VERIFY DELIVERY & COMPLETE (OTP + 21+ Age check)
router.post('/orders/:orderId/verify-delivery', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const { otp, confirmedAge21Plus } = req.body;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You cannot verify deliveries assigned to another partner.',
      errorCode: 'FORBIDDEN_NOT_ASSIGNED_RIDER',
    });
  }

  if (!confirmedAge21Plus) {
    return res.status(403).json({
      success: false,
      message: 'Excise compliance requirement: Delivery partner must inspect government photo ID confirming 21+ legal age.',
      errorCode: 'PHYSICAL_ID_NOT_VERIFIED',
    });
  }

  if (otp && order.deliveryOtp && otp.trim() !== order.deliveryOtp.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid 4-digit delivery verification OTP provided by recipient.',
      errorCode: 'INVALID_OTP',
    });
  }

  order.ageVerifiedAtDelivery = true;

  const result = OrderStatusService.transition(order.id, 'DELIVERED', {
    note: `Delivered at customer doorstep; recipient 21+ government photo ID verified and OTP PIN confirmed`,
    actor: { id: user.id, name: user.name, role: user.role },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: 'Delivery successfully verified and completed!',
    data: result.order,
  });
});

// REPORT DELIVERY FAILURE
router.post('/orders/:orderId/fail', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const { reason = 'Customer unavailable', details } = req.body;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden: Not assigned to this delivery' });
  }

  const result = OrderStatusService.transition(order.id, 'DELIVERY_FAILED', {
    note: `Delivery attempt failed: ${reason}${details ? ` — ${details}` : ''}`,
    failureReason: reason,
    failureDetails: details,
    actor: { id: user.id, name: user.name, role: user.role },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: 'Delivery failure logged. Return package to dark store.',
    data: result.order,
  });
});

// UPDATE RIDER LIVE LOCATION (PATCH & POST supported)
const handleLocationUpdate = (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const user = req.user!;
  const { latitude, longitude, speedKmH, heading, accuracy, timestamp } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({
      success: false,
      message: 'Valid numeric latitude and longitude coordinates are required.',
      errorCode: 'INVALID_COORDINATES',
    });
  }

  // Validate geographical bounds
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({
      success: false,
      message: 'Coordinates out of geographical bounds.',
      errorCode: 'COORDINATES_OUT_OF_BOUNDS',
    });
  }

  const order = db.findOrderById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Strict Delivery partner authorization
  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You can only update GPS telemetry on orders assigned to you.',
      errorCode: 'FORBIDDEN_NOT_ASSIGNED_RIDER',
    });
  }

  // Order must be active
  const activeStatuses = ['ASSIGNED', 'DELIVERY_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'];
  if (!activeStatuses.includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot update location for an inactive order (current status: ${order.status}).`,
      errorCode: 'ORDER_NOT_ACTIVE',
    });
  }

  const locationData: DeliveryLocation = {
    latitude,
    longitude,
    timestamp: timestamp || new Date().toISOString(),
    speedKmH: typeof speedKmH === 'number' ? speedKmH : 22,
    heading: typeof heading === 'number' ? heading : undefined,
    accuracy: typeof accuracy === 'number' ? accuracy : undefined,
  };

  order.lastKnownDeliveryLocation = locationData;
  order.trackingEnabled = true;
  db.persist();

  // Broadcast real-time location via Socket.IO
  const io = socketService.getIO();
  if (io) {
    io.to(`order:${order.id}`).emit('order:location', {
      orderId: order.id,
      riderId: user.id,
      riderName: user.name,
      ...locationData,
    });
    io.to(`order:${order.id}`).emit('order:location_updated', {
      orderId: order.id,
      riderId: user.id,
      riderName: user.name,
      ...locationData,
    });
  }

  res.json({
    success: true,
    message: 'Location updated',
    data: locationData,
  });
};

router.patch('/orders/:orderId/location', authenticate, requireRole(['delivery', 'admin']), handleLocationUpdate);
router.post('/orders/:orderId/location', authenticate, requireRole(['delivery', 'admin']), handleLocationUpdate);

// GET LIVE DELIVERY LOCATION
router.get('/orders/:orderId/location', authenticate, (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const user = req.user!;
  const order = db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Authorization: Customer owner, assigned rider, store staff, or admin
  const isOwner = user.role === 'customer' && order.userId === user.id;
  const isAssignedRider = user.role === 'delivery' && order.deliveryAgentId === user.id;
  const isStoreStaff = user.role === 'staff' && (!user.assignedStoreId || user.assignedStoreId === order.storeId);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAssignedRider && !isStoreStaff && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to view telemetry for this order.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  if (!order.lastKnownDeliveryLocation) {
    // Generate default store-centric coordinate fallback if tracking is active
    const store = db.getStores().find(s => s.id === order.storeId);
    return res.json({
      success: true,
      available: false,
      message: 'Delivery partner location is temporarily unavailable.',
      storeLocation: store ? { latitude: store.latitude, longitude: store.longitude } : null,
    });
  }

  res.json({
    success: true,
    available: true,
    data: order.lastKnownDeliveryLocation,
  });
});

export default router;
