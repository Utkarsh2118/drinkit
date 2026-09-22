import { Router, Request, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';
import { PaymentService } from '../services/paymentService.ts';
import { ComplianceService } from '../services/compliance.ts';
import { DeliveryEstimationService } from '../services/deliveryEstimate.ts';
import { CouponService } from '../services/couponService.ts';
import { Order, OrderItem } from '../types.ts';

const router = Router();

/**
 * GET /api/payments/config
 * Returns public payment gateway key for client checkout initialization
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      keyId: PaymentService.getPublicKey(),
      isConfigured: PaymentService.isConfigured(),
      currency: 'INR',
      supportedMethods: ['upi', 'card', 'netbanking'],
    },
  });
});

/**
 * POST /api/payments/create-order
 * 1. Validates customer age & compliance
 * 2. Validates cart & inventory
 * 3. Atomically reserves stock (10-minute TTL)
 * 4. Creates gateway payment order
 */
router.post('/create-order', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items, storeId, deliveryAddress, couponCode } = req.body;
    const user = req.user!;

    // 1. Mandatory Age Compliance
    if (!user.isAgeVerified) {
      return res.status(403).json({
        success: false,
        message: 'Age verification (21+) is mandatory before purchasing alcoholic beverages.',
        errorCode: 'AGE_VERIFICATION_REQUIRED',
      });
    }

    // 2. Excise & Dry-Day Check
    const compliance = ComplianceService.checkOrderCompliance(items);
    if (!compliance.permitted) {
      return res.status(403).json({
        success: false,
        message: compliance.reason,
        errorCode: 'COMPLIANCE_RESTRICTION',
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: 'Delivery address is required.' });
    }

    const targetStore = db.getStores().find(s => s.id === storeId) || db.getStores()[0];

    // 3. Atomically reserve inventory for 10 minutes
    const reservationResult = db.createReservation(
      user.id,
      targetStore.id,
      items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      10 // 10 minutes TTL
    );

    if (!reservationResult.success || !reservationResult.reservation) {
      return res.status(409).json({
        success: false,
        message: reservationResult.reason || 'One or more items are out of stock. Please adjust your cart.',
        errorCode: 'INSUFFICIENT_STOCK',
        outOfStockItem: reservationResult.outOfStockItem,
      });
    }

    const reservation = reservationResult.reservation;

    // 4. Calculate verified order financial totals
    const products = db.getProducts();
    let subtotal = 0;
    for (const item of items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        subtotal += prod.price * item.quantity;
      }
    }

    let discount = 0;
    let appliedCouponCode: string | undefined = undefined;
    if (couponCode) {
      const valResult = CouponService.validateCoupon(
        couponCode,
        user.id,
        items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
        subtotal,
        targetStore.id
      );
      if (!valResult.isValid) {
        return res.status(400).json({
          success: false,
          message: `Coupon "${couponCode}" is invalid: ${valResult.message}`,
          errorCode: valResult.errorCode,
        });
      }
      discount = valResult.discount;
      appliedCouponCode = valResult.coupon ? valResult.coupon.code : String(couponCode).toUpperCase();
    }

    const deliveryFee = subtotal > 999 ? 0 : 35;
    const handlingFee = 15;
    const taxes = Math.round((subtotal - discount) * 0.05);
    const totalAmount = Math.max(0, subtotal - discount + deliveryFee + handlingFee + taxes);

    // 5. Create Payment Gateway Order via PaymentService
    const receipt = `rcpt_${reservation.id.slice(-8)}`;
    const gatewayOrder = await PaymentService.createPaymentOrder({
      amount: totalAmount,
      receipt,
      notes: {
        userId: user.id,
        reservationId: reservation.id,
        storeId: targetStore.id,
        itemsCount: String(items.length),
      },
    });

    res.json({
      success: true,
      data: {
        gatewayOrderId: gatewayOrder.gatewayOrderId,
        amount: gatewayOrder.amount,
        amountInPaise: gatewayOrder.amountInPaise,
        currency: gatewayOrder.currency,
        keyId: gatewayOrder.keyId,
        reservationId: reservation.id,
        expiresAt: reservation.expiresAt,
        isSandbox: gatewayOrder.isSandbox,
        breakdown: {
          subtotal,
          discount,
          couponCode: appliedCouponCode,
          deliveryFee,
          handlingFee,
          taxes,
          totalAmount,
        },
      },
    });
  } catch (err: any) {
    console.error('Error creating payment order:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment gateway order: ' + (err.message || 'Unknown server error'),
    });
  }
});

/**
 * POST /api/payments/verify-and-confirm
 * Backend verification: Customer cannot confirm without cryptographic signature verification
 */
router.post('/verify-and-confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      reservationId,
      storeId,
      deliveryAddress,
      couponCode,
      paymentMethod = 'upi',
    } = req.body;

    const user = req.user!;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification parameters missing (order_id, payment_id, signature required).',
        errorCode: 'INVALID_GATEWAY_PAYLOAD',
      });
    }

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: 'Active inventory reservation ID is required to finalize order.',
        errorCode: 'MISSING_RESERVATION',
      });
    }

    // 1. Verify Payment Signature cryptographically on backend
    const isSignatureValid = PaymentService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed. Possible payload tampering detected.',
        errorCode: 'SIGNATURE_VERIFICATION_FAILED',
      });
    }

    // 2. Validate Reservation
    const reservation = db.getReservation(reservationId);
    if (!reservation) {
      return res.status(410).json({
        success: false,
        message: 'Inventory reservation expired or not found. Please try checking out again.',
        errorCode: 'RESERVATION_EXPIRED',
      });
    }

    if (reservation.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: `Inventory reservation is already ${reservation.status.toLowerCase()}. Cannot process duplicate confirmation.`,
        errorCode: 'RESERVATION_NOT_ACTIVE',
      });
    }

    const targetStore = db.getStores().find(s => s.id === (storeId || reservation.storeId)) || db.getStores()[0];

    // 3. Assemble verified items
    const products = db.getProducts();
    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    for (const resvItem of reservation.items) {
      const prod = products.find(p => p.id === resvItem.productId);
      if (prod) {
        const itemSubtotal = prod.price * resvItem.quantity;
        subtotal += itemSubtotal;
        orderItems.push({
          productId: prod.id,
          productName: prod.name,
          productImage: prod.imageUrl,
          volume: prod.volume,
          price: prod.price,
          quantity: resvItem.quantity,
          subtotal: itemSubtotal,
        });
      }
    }

    let discount = 0;
    let appliedCouponCode: string | undefined = undefined;
    if (couponCode) {
      const valResult = CouponService.validateCoupon(
        couponCode,
        user.id,
        reservation.items,
        subtotal,
        targetStore.id
      );
      if (valResult.isValid) {
        discount = valResult.discount;
        appliedCouponCode = valResult.coupon ? valResult.coupon.code : String(couponCode).toUpperCase();
      } else {
        return res.status(400).json({
          success: false,
          message: `Coupon "${couponCode}" is no longer valid: ${valResult.message}`,
          errorCode: valResult.errorCode,
        });
      }
    }

    const deliveryFee = subtotal > 999 ? 0 : 35;
    const handlingFee = 15;
    const taxes = Math.round((subtotal - discount) * 0.05);
    const totalAmount = Math.max(0, subtotal - discount + deliveryFee + handlingFee + taxes);

    const eta = DeliveryEstimationService.estimateDelivery(
      targetStore,
      deliveryAddress?.latitude || targetStore.latitude + 0.015,
      deliveryAddress?.longitude || targetStore.longitude + 0.012
    );

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = `DRK-${Math.floor(1000 + Math.random() * 9000)}`;
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
    const invoiceNumber = db.generateInvoiceNumber();
    const nowIso = new Date().toISOString();

    const order: Order = {
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
      deliveryAddress: deliveryAddress || user.addresses[0] || {
        id: 'addr_temp',
        label: 'Home',
        fullName: user.name,
        phone: user.phone,
        addressLine1: 'Doorstep Delivery',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
      },
      items: orderItems,
      subtotal,
      discount,
      couponCode: appliedCouponCode,
      deliveryFee,
      handlingFee,
      taxes,
      totalAmount,
      paymentMethod: paymentMethod as any,
      paymentStatus: 'completed',
      paymentState: 'PAID',
      paymentGateway: 'razorpay',
      gatewayOrderId: razorpay_order_id,
      gatewayPaymentId: razorpay_payment_id,
      gatewaySignature: razorpay_signature,
      paymentId: razorpay_payment_id,
      reservationId: reservation.id,
      status: 'PLACED',
      statusTimeline: [
        {
          status: 'PLACED',
          timestamp: nowIso,
          note: `Payment verified via Razorpay (${razorpay_payment_id}). Invoice: ${invoiceNumber}. Verification PIN: ${deliveryOtp}`,
        },
      ],
      estimatedDeliveryTime: eta.estimatedRange,
      deliveryOtp,
      ageVerifiedAtDelivery: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 4. Create Order & Confirm Reservation (converts reserved stock to sold inventory atomically)
    db.createOrder(order);

    // 5. Record Coupon Redemption
    if (appliedCouponCode) {
      CouponService.recordCouponRedemption(appliedCouponCode, user.id, order.id);
    }

    res.status(201).json({
      success: true,
      message: 'Payment verified successfully! Your order has been placed.',
      data: order,
    });
  } catch (err: any) {
    console.error('Error verifying payment & confirming order:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment: ' + (err.message || 'Unknown server error'),
    });
  }
});

/**
 * GET /api/payments/reservations/:id
 * Fetches status of an active reservation
 */
router.get('/reservations/:id', authenticate, (req: AuthRequest, res: Response) => {
  const reservation = db.getReservation(req.params.id);
  if (!reservation) {
    return res.status(404).json({ success: false, message: 'Reservation not found or expired.' });
  }

  res.json({
    success: true,
    data: reservation,
  });
});

/**
 * POST /api/payments/release-reservation
 * Releases reserved inventory if user cancels or modal dismisses
 */
router.post('/release-reservation', authenticate, (req: AuthRequest, res: Response) => {
  const { reservationId, reason } = req.body;
  if (!reservationId) {
    return res.status(400).json({ success: false, message: 'reservationId is required' });
  }

  const released = db.releaseReservation(reservationId, reason || 'Cancelled by customer');
  res.json({
    success: true,
    released,
    message: released ? 'Inventory reservation released back to store.' : 'Reservation not found or already released.',
  });
});

/**
 * POST /api/payments/webhook
 * Razorpay Webhook listener with HMAC SHA256 signature verification & idempotency
 */
router.post('/webhook', (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // If webhook secret is configured, verify signature
  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    const isValid = PaymentService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }
  }

  const event = req.body;
  const eventId = event.event_id || event.id || `${event.event}_${Date.now()}`;

  // Idempotency check: avoid double processing
  if (PaymentService.isWebhookEventProcessed(eventId)) {
    return res.status(200).json({ success: true, message: 'Event already processed (idempotent).' });
  }

  try {
    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload?.payment?.entity;
        if (payment && payment.order_id) {
          const orders = db.getOrders();
          const order = orders.find(o => o.gatewayOrderId === payment.order_id);
          if (order && order.paymentState !== 'PAID') {
            order.paymentState = 'PAID';
            order.paymentStatus = 'completed';
            order.gatewayPaymentId = payment.id;
            order.paymentId = payment.id;
            db.saveToFile();
          }
        }
        break;
      }

      case 'payment.failed': {
        const payment = event.payload?.payment?.entity;
        if (payment && payment.notes?.reservationId) {
          db.releaseReservation(payment.notes.reservationId, 'Payment failed via gateway webhook');
        }
        break;
      }

      case 'refund.processed': {
        const refund = event.payload?.refund?.entity;
        if (refund && refund.payment_id) {
          const orders = db.getOrders();
          const order = orders.find(
            o => o.paymentId === refund.payment_id || o.gatewayPaymentId === refund.payment_id
          );
          if (order) {
            db.updateRefundDetails(order.id, {
              refundId: refund.id,
              gatewayRefundId: refund.id,
              amount: (refund.amount || 0) / 100,
              reason: 'Webhook confirmed refund',
              status: 'REFUNDED',
              initiatedAt: new Date(refund.created_at * 1000).toISOString(),
              completedAt: new Date().toISOString(),
            });
          }
        }
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    PaymentService.markWebhookEventProcessed(eventId);
    res.status(200).json({ success: true, received: true });
  } catch (err: any) {
    console.error('Error handling payment webhook event:', err);
    res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
});

export default router;
