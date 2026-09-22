import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { CouponService } from '../services/couponService.ts';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Coupon } from '../types.ts';

const router = Router();

// PUBLIC: Get active coupons for customer discovery
router.get('/', (req, res) => {
  const coupons = db.getCoupons().filter(c => c.isActive);
  res.json({ success: true, data: coupons });
});

// VALIDATE: Advanced validation supporting all business rules
router.post('/validate', (req, res) => {
  const { code, items = [], cartTotal = 0, userId, storeId } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a coupon code',
      errorCode: 'CODE_REQUIRED',
    });
  }

  const result = CouponService.validateCoupon(
    code,
    userId,
    Array.isArray(items) ? items : [],
    Number(cartTotal) || 0,
    storeId
  );

  if (!result.isValid) {
    return res.status(400).json({
      success: false,
      message: result.message,
      errorCode: result.errorCode,
      eligibleSubtotal: result.eligibleSubtotal,
    });
  }

  res.json({
    success: true,
    message: result.message,
    data: {
      coupon: result.coupon,
      discount: result.discount,
      eligibleSubtotal: result.eligibleSubtotal,
      savingsBreakdown: result.savingsBreakdown,
      message: result.message,
    },
  });
});

// ADMIN: Get all coupons with detailed metrics & usage counts
router.get('/admin/all', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const coupons = db.getCoupons();
  res.json({ success: true, data: coupons });
});

// ADMIN: Create a new advanced coupon
router.post('/admin/create', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minOrderValue,
    minimumOrderValue,
    maxDiscount,
    maximumDiscount,
    validFrom,
    startDate,
    validUntil,
    expiryDate,
    overallUsageLimit,
    usageLimit,
    userUsageLimit,
    perUserLimit,
    applicableCategoryIds,
    applicableCategories,
    applicableProductIds,
    applicableProducts,
    excludedCategoryIds,
    excludedProductIds,
    applicableStores,
    firstOrderOnly,
    newCustomerOnly,
  } = req.body;

  if (!code || !discountType || discountValue === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Code, discount type, and discount value are required',
    });
  }

  const cleanCode = String(code).trim().toUpperCase();
  const existing = db.findCouponByCode(cleanCode);
  if (existing) {
    return res.status(400).json({
      success: false,
      message: `A coupon with code "${cleanCode}" already exists`,
    });
  }

  const normType = String(discountType).toLowerCase().includes('percent') ? 'percentage' : 'fixed';
  const finalMinOrder = minimumOrderValue !== undefined ? Number(minimumOrderValue) : (Number(minOrderValue) || 0);
  const finalMaxDisc = maximumDiscount !== undefined ? Number(maximumDiscount) : (maxDiscount ? Number(maxDiscount) : undefined);
  const finalValidFrom = startDate || validFrom || new Date().toISOString().split('T')[0];
  const finalValidUntil = expiryDate || validUntil || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const finalOverallLimit = usageLimit !== undefined ? Number(usageLimit) : (overallUsageLimit ? Number(overallUsageLimit) : undefined);
  const finalUserLimit = perUserLimit !== undefined ? Number(perUserLimit) : (userUsageLimit ? Number(userUsageLimit) : undefined);

  const newCoupon: Coupon = {
    id: `coup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    code: cleanCode,
    description: description || `${discountValue}${normType === 'percentage' ? '%' : '₹'} OFF`,
    discountType: normType,
    discountValue: Number(discountValue),
    minOrderValue: finalMinOrder,
    minimumOrderValue: finalMinOrder,
    maxDiscount: finalMaxDisc,
    maximumDiscount: finalMaxDisc,
    validFrom: finalValidFrom,
    startDate: finalValidFrom,
    validUntil: finalValidUntil,
    expiryDate: finalValidUntil,
    isActive: true,
    active: true,
    overallUsageLimit: finalOverallLimit,
    usageLimit: finalOverallLimit,
    overallUsageCount: 0,
    usedCount: 0,
    userUsageLimit: finalUserLimit,
    perUserLimit: finalUserLimit,
    applicableCategoryIds: Array.isArray(applicableCategories) ? applicableCategories : (Array.isArray(applicableCategoryIds) ? applicableCategoryIds : []),
    applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : (Array.isArray(applicableCategoryIds) ? applicableCategoryIds : []),
    applicableProductIds: Array.isArray(applicableProducts) ? applicableProducts : (Array.isArray(applicableProductIds) ? applicableProductIds : []),
    applicableProducts: Array.isArray(applicableProducts) ? applicableProducts : (Array.isArray(applicableProductIds) ? applicableProductIds : []),
    excludedCategoryIds: Array.isArray(excludedCategoryIds) ? excludedCategoryIds : [],
    excludedProductIds: Array.isArray(excludedProductIds) ? excludedProductIds : [],
    applicableStores: Array.isArray(applicableStores) ? applicableStores : [],
    firstOrderOnly: Boolean(firstOrderOnly || newCustomerOnly),
    newCustomerOnly: Boolean(firstOrderOnly || newCustomerOnly),
  };

  db.createCoupon(newCoupon);
  db.logAudit(
    req.user!.id,
    req.user!.name,
    req.user!.role,
    'COUPON_CREATED',
    'Coupon',
    newCoupon.id,
    `Created coupon "${newCoupon.code}" with type ${newCoupon.discountType} and value ${newCoupon.discountValue}`
  );

  res.status(201).json({
    success: true,
    message: `Coupon "${newCoupon.code}" created successfully`,
    data: newCoupon,
  });
});

// ADMIN: Update coupon rules or status
router.put('/admin/:id', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const coupon = db.findCouponById(req.params.id);
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }

  const updated = db.updateCoupon(req.params.id, req.body);
  db.logAudit(
    req.user!.id,
    req.user!.name,
    req.user!.role,
    'COUPON_UPDATED',
    'Coupon',
    req.params.id,
    `Updated coupon "${coupon.code}" rules`
  );

  res.json({
    success: true,
    message: `Coupon "${coupon.code}" updated`,
    data: updated,
  });
});

// ADMIN: Delete a coupon
router.delete('/admin/:id', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const coupon = db.findCouponById(req.params.id);
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }

  db.deleteCoupon(req.params.id);
  db.logAudit(
    req.user!.id,
    req.user!.name,
    req.user!.role,
    'COUPON_DELETED',
    'Coupon',
    req.params.id,
    `Deleted coupon "${coupon.code}"`
  );

  res.json({
    success: true,
    message: `Coupon "${coupon.code}" removed`,
  });
});

export default router;
