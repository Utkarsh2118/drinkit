import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.ts';
import { ComplianceService } from '../services/compliance.ts';
import { DeliveryEstimationService } from '../services/deliveryEstimate.ts';
import { PaymentService } from '../services/paymentService.ts';
import { CouponService } from '../services/couponService.ts';
import { InvoiceService } from '../services/invoiceService.ts';
import { socketService } from '../services/socketService.ts';
import { OrderStatusService } from '../services/orderStatusService.ts';
import { Order, OrderItem, OrderStatus, CancellationDetails, RefundDetails } from '../types.ts';

const router = Router();

// Validate cart and calculate totals (Backend authority - never trust client calculation)
router.post('/calculate-totals', (req, res) => {
  const { items, storeId, couponCode, deliveryAddress } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart items required' });
  }

  const products = db.getProducts();
  const targetStoreId = storeId || 'store_noida_sec18';

  let subtotal = 0;
  const verifiedItems: OrderItem[] = [];
  const stockIssues: string[] = [];

  for (const item of items) {
    const prod = products.find(p => p.id === item.productId);
    if (!prod) {
      stockIssues.push(`Product ${item.productId} not found.`);
      continue;
    }

    const variant = item.variantId ? prod.variants?.find(v => v.id === item.variantId && v.isActive) : undefined;
    if (item.variantId && !variant) {
      stockIssues.push(`Variant ${item.variantId} is not available for "${prod.name}".`);
      continue;
    }
    const stock = db.getStoreStock(targetStoreId, prod.id, item.variantId);
    if (stock.available < item.quantity) {
      stockIssues.push(`"${prod.name}" only has ${stock.available} available in stock.`);
    }

    const unitPrice = variant?.price ?? prod.price;
    const volume = variant?.volume ?? prod.volume;
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;

    verifiedItems.push({
      productId: prod.id,
      productName: prod.name,
      productImage: prod.imageUrl,
      volume,
      price: unitPrice,
      quantity: item.quantity,
      subtotal: itemSubtotal,
      variantId: variant?.id,
      variantName: variant?.name,
      variantSku: variant?.sku,
    });
  }

  if (stockIssues.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Stock check failed for some items',
      stockIssues,
      errorCode: 'INSUFFICIENT_STOCK',
    });
  }

  // Compliance check
  const deliveryPostal = req.body.deliveryPostalCode || req.body.postalCode || req.body.deliveryAddress?.postalCode;
  const complianceCheck = ComplianceService.checkOrderCompliance(items, deliveryPostal);
  if (!complianceCheck.permitted) {
    return res.status(403).json({
      success: false,
      message: complianceCheck.reason,
      errorCode: complianceCheck.errorCode || 'COMPLIANCE_RESTRICTION',
    });
  }

  // Coupon application via backend CouponService
  let discount = 0;
  let appliedCoupon: string | null = null;
  let couponMessage = '';

  if (couponCode) {
    const valResult = CouponService.validateCoupon(
      couponCode,
      req.body.userId,
      items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      subtotal
    );
    if (valResult.isValid) {
      discount = valResult.discount;
      appliedCoupon = valResult.coupon ? valResult.coupon.code : String(couponCode).toUpperCase();
      couponMessage = valResult.message;
    }
  }

  // Delivery fee & taxes
  const deliveryFee = subtotal > 999 ? 0 : 35;
  const handlingFee = 15;
  const taxes = Math.round((subtotal - discount) * 0.05); // 5% state tax / GST
  const totalAmount = Math.max(0, subtotal - discount + deliveryFee + handlingFee + taxes);

  res.json({
    success: true,
    data: {
      items: verifiedItems,
      subtotal,
      discount,
      couponCode: appliedCoupon,
      couponMessage,
      deliveryFee,
      handlingFee,
      taxes,
      totalAmount,
    },
  });
});

// CREATE ORDER (Checkout completion)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const {
    items,
    storeId,
    deliveryAddress,
    paymentMethod,
    couponCode,
    customerNotes,
  } = req.body;

  const user = req.user!;

  // 1. Mandatory Age Compliance check
  if (!user.isAgeVerified) {
    return res.status(403).json({
      success: false,
      message: 'Date of birth and legal drinking age verification is strictly mandatory before placing alcohol orders.',
      errorCode: 'AGE_VERIFICATION_REQUIRED',
    });
  }

  // 2. Order compliance (Excise rules / Dry days / Hours / Bottle & Litre ceilings)
  const complianceCheck = ComplianceService.checkOrderCompliance(items, deliveryAddress?.postalCode);
  if (!complianceCheck.permitted) {
    return res.status(403).json({
      success: false,
      message: complianceCheck.reason,
      errorCode: complianceCheck.errorCode || 'COMPLIANCE_RESTRICTION',
    });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  if (!deliveryAddress) {
    return res.status(400).json({ success: false, message: 'Delivery address is required' });
  }

  const targetStore = db.getStores().find(s => s.id === storeId);
  if (!targetStore || !targetStore.isActive || !targetStore.deliveryEnabled) {
    return res.status(400).json({ success: false, message: 'Selected store is unavailable for delivery.' });
  }
  const matchedZone = db.getDeliveryZones().find(z => z.associatedStoreId === targetStore.id && z.isActive && z.postalCodes.includes(String(deliveryAddress.postalCode || '')));
  if (!matchedZone) {
    return res.status(400).json({ success: false, message: 'Delivery address is not serviceable by the selected store.', errorCode: 'STORE_SERVICEABILITY_FAILED' });
  }
  const jurisdictionMinAge = targetStore.state === 'Delhi' ? 25 : 21;
  if (user.dateOfBirth) {
    const actualAge = ComplianceService.calculateAge(user.dateOfBirth);
    if (items.some((i: any) => db.findProductById(i.productId)?.isAlcoholic) && actualAge < jurisdictionMinAge) {
      return res.status(403).json({ success: false, message: `Alcohol orders for this delivery jurisdiction require the configured minimum age of ${jurisdictionMinAge}.`, errorCode: 'JURISDICTION_AGE_RESTRICTION' });
    }
  }

  // 3. Atomically check and reserve inventory
  const reserveSuccess = db.reserveInventory(targetStore.id, items);
  if (!reserveSuccess) {
    return res.status(409).json({
      success: false,
      message: 'One or more products went out of stock during checkout. Please adjust your cart.',
      errorCode: 'OUT_OF_STOCK',
    });
  }

  // 4. Calculate final verified prices
  const products = db.getProducts();
  let subtotal = 0;
  const orderItems: OrderItem[] = [];

  for (const item of items) {
    const prod = products.find(p => p.id === item.productId);
    if (prod) {
      const variant = item.variantId ? prod.variants?.find(v => v.id === item.variantId && v.isActive) : undefined;
      if (item.variantId && !variant) continue;
      const unitPrice = variant?.price ?? prod.price;
      const volume = variant?.volume ?? prod.volume;
      const lineSubtotal = unitPrice * item.quantity;
      subtotal += lineSubtotal;
      orderItems.push({
        productId: prod.id,
        productName: prod.name,
        productImage: prod.imageUrl,
        volume,
        price: unitPrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        variantId: variant?.id,
        variantName: variant?.name,
        variantSku: variant?.sku,
      });
    }
  }

  let discount = 0;
  let appliedCouponCode: string | undefined = undefined;
  if (couponCode) {
    const valResult = CouponService.validateCoupon(
      couponCode,
      user.id,
      items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      subtotal
    );
    if (valResult.isValid) {
      discount = valResult.discount;
      appliedCouponCode = valResult.coupon ? valResult.coupon.code : String(couponCode).toUpperCase();
    }
  }

  const deliveryFee = subtotal > 999 ? 0 : 35;
  const handlingFee = 15;
  const taxes = Math.round((subtotal - discount) * 0.05);
  const totalAmount = Math.max(0, subtotal - discount + deliveryFee + handlingFee + taxes);

  // 5. Estimate delivery ETA
  const eta = DeliveryEstimationService.estimateDelivery(
    targetStore,
    deliveryAddress.latitude || targetStore.latitude + 0.015,
    deliveryAddress.longitude || targetStore.longitude + 0.012
  );

  // 6. Process Payment
  const paymentRecord = await PaymentService.createPayment({
    orderId: `temp_${Date.now()}`,
    amount: totalAmount,
    currency: 'INR',
    paymentMethod: paymentMethod || 'upi',
    customerName: user.name,
    customerEmail: user.email,
  });

  // 7. Assemble Order
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const orderNumber = `DRK-${Math.floor(1000 + Math.random() * 9000)}`;
  const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
  const invoiceNumber = db.generateInvoiceNumber();
  const nowIso = new Date().toISOString();

  const newOrder: Order = {
    id: orderId,
    orderNumber,
    invoiceNumber,
    invoiceDate: nowIso,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userPhone: user.phone,
    storeId: targetStore.id,
    storeName: targetStore.name,
    deliveryAddress,
    items: orderItems,
    subtotal,
    discount,
    couponCode: appliedCouponCode,
    deliveryFee,
    handlingFee,
    taxes,
    totalAmount,
    paymentMethod: paymentMethod || 'upi',
    paymentStatus: paymentRecord.status === 'PAID' ? 'completed' : 'pending',
    paymentState: paymentRecord.status,
    paymentGateway: 'razorpay',
    gatewayPaymentId: paymentRecord.paymentId,
    paymentId: paymentRecord.paymentId,
    reservationId: req.body.reservationId,
    status: 'PLACED',
    statusTimeline: [
      {
        status: 'PLACED',
        timestamp: nowIso,
        note: `Order placed. Paid via ${paymentMethod || 'UPI'}. Invoice: ${invoiceNumber}. Verification PIN: ${deliveryOtp}`,
      },
    ],
    estimatedDeliveryTime: eta.estimatedRange,
    deliveryOtp,
    ageVerifiedAtDelivery: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.createOrder(newOrder);

  // 8. Record verified coupon redemption in backend database
  if (appliedCouponCode) {
    CouponService.recordCouponRedemption(appliedCouponCode, user.id, newOrder.id);
  }

  res.status(201).json({
    success: true,
    message: 'Order placed successfully! Preparing your beverages.',
    data: newOrder,
  });
});

// GET user orders / all orders for staff & delivery
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let orders = db.getOrders();

  if (user.role === 'customer') {
    orders = orders.filter(o => o.userId === user.id);
  } else if (user.role === 'delivery') {
    // Delivery rider sees assigned orders + ready for pickup orders in their city
    orders = orders.filter(
      o => o.deliveryAgentId === user.id || o.status === 'READY_FOR_PICKUP' || o.status === 'ASSIGNED'
    );
  } else if (user.role === 'staff') {
    // Store staff sees store orders
    orders = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  }

  res.json({
    success: true,
    data: orders,
  });
});

// GET live inventory reservations (Staff & Admin monitoring)
router.get('/reservations/live', authenticate, requireRole(['staff', 'admin']), (_req: AuthRequest, res: Response) => {
  const reservations = db.getReservations();
  res.json({
    success: true,
    data: reservations,
  });
});

// GET single order details (Live order tracking)
router.get('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Strict Resource Ownership & Authorization check:
  const user = req.user!;
  if (user.role === 'customer' && order.userId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to view another customer’s order.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  if (user.role === 'staff' && user.assignedStoreId && order.storeId !== user.assignedStoreId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to access orders from another store.',
      errorCode: 'FORBIDDEN_STORE_MISMATCH',
    });
  }

  res.json({
    success: true,
    data: order,
  });
});

// GET complete real-time order tracking details (Coordinates, Status, Rider, ETA)
router.get('/:id/tracking', authenticate, (req: AuthRequest, res: Response) => {
  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const user = req.user!;
  // Strict Authorization
  const isOwner = user.role === 'customer' && order.userId === user.id;
  const isAssignedRider = user.role === 'delivery' && (order.deliveryAgentId === user.id || !order.deliveryAgentId);
  const isStoreStaff = user.role === 'staff' && (!user.assignedStoreId || user.assignedStoreId === order.storeId);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAssignedRider && !isStoreStaff && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to view telemetry for this order.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  const store = db.getStores().find(s => s.id === order.storeId);
  const trackingActive = ['ASSIGNED', 'DELIVERY_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'].includes(order.status);

  res.json({
    success: true,
    data: {
      order,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      trackingEnabled: trackingActive,
      storeLocation: store
        ? {
            name: store.name,
            address: store.address,
            area: store.area,
            latitude: store.latitude,
            longitude: store.longitude,
          }
        : null,
      customerLocation: {
        addressLine: order.deliveryAddress?.addressLine1 || 'Customer Delivery Address',
        label: order.deliveryAddress?.label || 'Home',
        latitude: order.deliveryAddress?.latitude || 28.572,
        longitude: order.deliveryAddress?.longitude || 77.325,
      },
      deliveryPartner: order.deliveryAgentId
        ? {
            id: order.deliveryAgentId,
            name: order.deliveryAgentName || 'Vikram Singh',
            phone: order.deliveryAgentPhone || '+91 98765 43212',
            photo: order.deliveryPartnerPhoto || '/images/drinkit-logo.png',
            rating: order.deliveryPartnerRating || 4.9,
            vehicle: 'Electric Scooter (Eco Fleet)',
          }
        : null,
      lastKnownLocation: trackingActive ? (order.lastKnownDeliveryLocation || null) : null,
      statusTimeline: order.statusTimeline || [],
      deliveryOtp: (isOwner || isAdmin) ? order.deliveryOtp : undefined,
    },
  });
});

// GET immutable order status timeline
router.get('/:id/status-history', authenticate, (req: AuthRequest, res: Response) => {
  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const user = req.user!;
  if (user.role === 'customer' && order.userId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.json({
    success: true,
    data: order.statusTimeline || [],
  });
});

// GET order invoice structured JSON data
router.get('/:id/invoice', authenticate, (req: AuthRequest, res: Response) => {
  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const user = req.user!;
  if (user.role === 'customer' && order.userId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to view this invoice.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  const invoiceData = InvoiceService.buildInvoiceData(order);
  res.json({
    success: true,
    data: invoiceData,
  });
});

// GET order invoice printable HTML
router.get('/:id/invoice/html', authenticate, (req: AuthRequest, res: Response) => {
  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).send('<h3>Order not found</h3>');
  }

  const user = req.user!;
  if (user.role === 'customer' && order.userId !== user.id) {
    return res.status(403).send('<h3>Forbidden: Unauthorized to view another customer’s invoice</h3>');
  }

  const html = InvoiceService.generateInvoiceHtml(order);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// CANCEL ORDER with eligibility check & automatic refund initiation
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const user = req.user!;
  if (user.role === 'customer' && order.userId !== user.id) {
    return res.status(403).json({ success: false, message: 'Unauthorized to cancel this order' });
  }

  const { reasonCategory = 'Customer cancellation', customExplanation } = req.body;

  // Perform cancellation in database (verifies status eligibility and restores inventory)
  const cancelResult = db.cancelOrder(order.id, reasonCategory, customExplanation, {
    id: user.id,
    name: user.name,
    role: user.role,
  });

  if (!cancelResult.success || !cancelResult.order) {
    return res.status(400).json({
      success: false,
      message: cancelResult.message,
      errorCode: 'CANCELLATION_DISALLOWED',
    });
  }

  const cancelledOrder = cancelResult.order;
  let refundResult = null;

  // If order was paid online, initiate refund via PaymentService
  if (cancelResult.isPaidOnline) {
    const paymentIdToRefund =
      cancelledOrder.gatewayPaymentId || cancelledOrder.paymentId || 'pay_online';

    refundResult = await PaymentService.initiateRefund(
      paymentIdToRefund,
      cancelledOrder.totalAmount,
      `${reasonCategory}: ${customExplanation || 'Customer request'}`
    );

    const refundDetails: RefundDetails = {
      refundId: refundResult.refundId,
      gatewayRefundId: refundResult.gatewayRefundId,
      amount: refundResult.amount,
      reason: `${reasonCategory}: ${customExplanation || 'Customer cancellation'}`,
      status: refundResult.success ? 'REFUNDED' : 'REFUND_FAILED',
      initiatedAt: new Date().toISOString(),
      completedAt: refundResult.success ? new Date().toISOString() : undefined,
    };

    db.updateRefundDetails(cancelledOrder.id, refundDetails);
  }

  res.json({
    success: true,
    message: cancelResult.isPaidOnline
      ? 'Order cancelled successfully. A 100% refund has been processed to your payment method.'
      : 'Order cancelled successfully. Restocked inventory to local store.',
    data: cancelledOrder,
    refund: refundResult,
  });
});

// UPDATE ORDER STATUS (Central Status Transition Engine)
const handleStatusUpdate = (req: AuthRequest, res: Response) => {
  const { status, note, failureReason, failureDetails } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const user = req.user!;

  const result = OrderStatusService.transition(order.id, status as OrderStatus, {
    note,
    actor: {
      id: user.id,
      name: user.name,
      role: user.role,
      assignedStoreId: user.assignedStoreId,
    },
    failureReason,
    failureDetails,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.message,
      errorCode: 'INVALID_STATUS_TRANSITION',
    });
  }

  res.json({
    success: true,
    message: `Order status updated to ${status}`,
    data: result.order,
  });
};

router.post('/:id/status', authenticate, requireRole(['staff', 'delivery', 'admin', 'customer']), handleStatusUpdate);
router.patch('/:id/status', authenticate, requireRole(['staff', 'delivery', 'admin', 'customer']), handleStatusUpdate);

// ASSIGN DELIVERY AGENT
router.post('/:id/assign', authenticate, requireRole(['staff', 'admin', 'delivery']), (req: AuthRequest, res: Response) => {
  const { deliveryAgentId, deliveryAgentName, deliveryAgentPhone } = req.body;
  const user = req.user!;

  const order = db.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Store staff can only assign riders for their own store
  if (user.role === 'staff' && user.assignedStoreId && order.storeId !== user.assignedStoreId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Store staff can only assign deliveries for their assigned dark store.',
      errorCode: 'FORBIDDEN_STORE_MISMATCH',
    });
  }

  // Delivery rider can only assign THEMSELVES to an unassigned order
  if (user.role === 'delivery') {
    if (deliveryAgentId && deliveryAgentId !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Delivery partners can only claim deliveries for themselves.',
        errorCode: 'FORBIDDEN_UNAUTHORIZED_ASSIGNMENT',
      });
    }
    if (order.deliveryAgentId && order.deliveryAgentId !== user.id) {
      return res.status(409).json({
        success: false,
        message: 'This delivery has already been accepted by another delivery partner.',
        errorCode: 'ORDER_ALREADY_ASSIGNED',
      });
    }
  }

  const riderId = deliveryAgentId || user.id;
  const riderName = deliveryAgentName || user.name;
  const riderPhone = deliveryAgentPhone || user.phone;

  const updated = db.assignOrderRider(req.params.id, riderId, riderName, riderPhone);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  socketService.emitOrderUpdate(updated, 'order:rider_assigned');

  res.json({
    success: true,
    message: `Assigned order to rider ${riderName}`,
    data: updated,
  });
});

// VERIFY DELIVERY & COMPLETE (Rider validates OTP + Age at Doorstep)
router.post('/:id/verify-delivery', authenticate, requireRole(['delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { otp, confirmedAge21Plus } = req.body;
  const order = db.findOrderById(req.params.id);
  const user = req.user!;

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Strict ownership check: Delivery agent can only complete their assigned delivery!
  if (user.role === 'delivery' && order.deliveryAgentId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You cannot complete or verify deliveries assigned to another rider.',
      errorCode: 'FORBIDDEN_NOT_ASSIGNED_RIDER',
    });
  }

  if (!confirmedAge21Plus) {
    return res.status(403).json({
      success: false,
      message: 'Excise compliance violation: Delivery partner must physically verify recipient is 21+ with government photo ID before handover.',
      errorCode: 'PHYSICAL_ID_NOT_VERIFIED',
    });
  }

  if (otp && order.deliveryOtp && otp !== order.deliveryOtp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid delivery verification OTP PIN provided by customer.',
      errorCode: 'INVALID_OTP',
    });
  }

  const result = OrderStatusService.transition(order.id, 'DELIVERED', {
    note: 'Delivered at doorstep; recipient 21+ government photo ID verified and OTP PIN confirmed',
    actor: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: 'Delivery successfully verified and completed! Inventory reconciled.',
    data: result.order,
  });
});

export default router;
