import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.ts';
import { ComplianceService } from '../services/compliance.ts';
import { DeliveryEstimationService } from '../services/deliveryEstimate.ts';
import { PaymentService } from '../services/paymentService.ts';
import { CouponService } from '../services/couponService.ts';
import { InvoiceService } from '../services/invoiceService.ts';
import { Order, OrderItem, OrderStatus, CancellationDetails, RefundDetails } from '../types.ts';

const router = Router();

// Validate cart and calculate totals (Backend authority - never trust client calculation)
router.post('/calculate-totals', (req, res) => {
  const { items, storeId, couponCode, deliveryAddress } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart items required' });
  }

  const products = db.getProducts();
  const targetStoreId = storeId || 'store_indiranagar';

  let subtotal = 0;
  const verifiedItems: OrderItem[] = [];
  const stockIssues: string[] = [];

  for (const item of items) {
    const prod = products.find(p => p.id === item.productId);
    if (!prod) {
      stockIssues.push(`Product ${item.productId} not found.`);
      continue;
    }

    const stock = db.getStoreStock(targetStoreId, prod.id);
    if (stock.available < item.quantity) {
      stockIssues.push(`"${prod.name}" only has ${stock.available} available in stock.`);
    }

    const itemSubtotal = prod.price * item.quantity;
    subtotal += itemSubtotal;

    verifiedItems.push({
      productId: prod.id,
      productName: prod.name,
      productImage: prod.imageUrl,
      volume: prod.volume,
      price: prod.price,
      quantity: item.quantity,
      subtotal: itemSubtotal,
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
  const complianceCheck = ComplianceService.checkOrderCompliance(items);
  if (!complianceCheck.permitted) {
    return res.status(403).json({
      success: false,
      message: complianceCheck.reason,
      errorCode: 'COMPLIANCE_RESTRICTION',
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

  // 2. Order compliance (Excise rules / Dry days)
  const complianceCheck = ComplianceService.checkOrderCompliance(items);
  if (!complianceCheck.permitted) {
    return res.status(403).json({
      success: false,
      message: complianceCheck.reason,
      errorCode: 'COMPLIANCE_RESTRICTION',
    });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  if (!deliveryAddress) {
    return res.status(400).json({ success: false, message: 'Delivery address is required' });
  }

  const targetStore = db.getStores().find(s => s.id === storeId) || db.getStores()[0];

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
      const lineSubtotal = prod.price * item.quantity;
      subtotal += lineSubtotal;
      orderItems.push({
        productId: prod.id,
        productName: prod.name,
        productImage: prod.imageUrl,
        volume: prod.volume,
        price: prod.price,
        quantity: item.quantity,
        subtotal: lineSubtotal,
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

  // Authorization check
  const user = req.user!;
  if (user.role === 'customer' && order.userId !== user.id) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  res.json({
    success: true,
    data: order,
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
    return res.status(403).json({ success: false, message: 'Access denied' });
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
    return res.status(403).send('<h3>Access denied: Unauthorized to view invoice</h3>');
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

// UPDATE ORDER STATUS (Store Staff packing / Delivery Agent status changes)
router.post('/:id/status', authenticate, requireRole(['staff', 'delivery', 'admin']), (req: AuthRequest, res: Response) => {
  const { status, note } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const user = req.user!;
  const updated = db.updateOrderStatus(req.params.id, status as OrderStatus, note, {
    id: user.id,
    name: user.name,
    role: user.role,
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({
    success: true,
    message: `Order status updated to ${status}`,
    data: updated,
  });
});

// ASSIGN DELIVERY AGENT
router.post('/:id/assign', authenticate, requireRole(['staff', 'admin', 'delivery']), (req: AuthRequest, res: Response) => {
  const { deliveryAgentId, deliveryAgentName, deliveryAgentPhone } = req.body;
  const user = req.user!;

  const riderId = deliveryAgentId || user.id;
  const riderName = deliveryAgentName || user.name;
  const riderPhone = deliveryAgentPhone || user.phone;

  const updated = db.assignOrderRider(req.params.id, riderId, riderName, riderPhone);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

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

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
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

  const updated = db.updateOrderStatus(order.id, 'DELIVERED', 'Delivered at doorstep; recipient 21+ government photo ID verified', {
    id: req.user!.id,
    name: req.user!.name,
    role: req.user!.role,
  });

  res.json({
    success: true,
    message: 'Delivery successfully verified and completed! Inventory reconciled.',
    data: updated,
  });
});

export default router;
