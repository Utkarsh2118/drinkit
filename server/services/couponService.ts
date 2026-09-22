import { db } from '../db/database.ts';
import { Coupon, CouponValidationResult } from '../types.ts';

export interface CartItemValidationInput {
  productId?: string;
  quantity?: number;
  product?: {
    id: string;
    price?: number;
    categoryId?: string;
    [key: string]: any;
  };
}

export class CouponService {
  /**
   * Comprehensive backend coupon validation
   */
  public static validateCoupon(
    code: string,
    userId?: string,
    items: CartItemValidationInput[] = [],
    cartTotal: number = 0,
    storeId?: string
  ): CouponValidationResult {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) {
      return {
        isValid: false,
        discount: 0,
        message: 'Please enter a coupon code',
        errorCode: 'CODE_REQUIRED',
      };
    }

    const coupons = db.getCoupons();
    const coupon = coupons.find(c => c.code.toUpperCase() === cleanCode);

    if (!coupon) {
      return {
        isValid: false,
        discount: 0,
        message: `Coupon code "${cleanCode}" is invalid or does not exist`,
        errorCode: 'INVALID_CODE',
      };
    }

    const isActive = coupon.active !== undefined ? coupon.active : coupon.isActive;
    if (!isActive) {
      return {
        isValid: false,
        coupon,
        discount: 0,
        message: 'Coupon is inactive',
        errorCode: 'COUPON_INACTIVE',
      };
    }

    const now = new Date();

    // 1. Validate Expiry Date & Start Date
    const validFrom = coupon.startDate || coupon.validFrom;
    if (validFrom) {
      const fromDate = new Date(validFrom);
      if (now < fromDate) {
        return {
          isValid: false,
          coupon,
          discount: 0,
          message: `Coupon "${coupon.code}" will be active from ${fromDate.toLocaleDateString()}`,
          errorCode: 'COUPON_NOT_YET_VALID',
        };
      }
    }

    const validUntil = coupon.expiryDate || coupon.validUntil;
    if (validUntil) {
      const expiryDate = new Date(validUntil);
      // If provided as YYYY-MM-DD, set to end of that day (23:59:59)
      if (validUntil.length === 10) {
        expiryDate.setHours(23, 59, 59, 999);
      }
      if (now > expiryDate) {
        return {
          isValid: false,
          coupon,
          discount: 0,
          message: 'Coupon expired',
          errorCode: 'COUPON_EXPIRED',
        };
      }
    }

    // 2. Validate Platform-Wide Overall Usage Limit
    const overallLimit = coupon.usageLimit !== undefined ? coupon.usageLimit : coupon.overallUsageLimit;
    const overallCount = coupon.usedCount !== undefined ? coupon.usedCount : coupon.overallUsageCount;
    if (overallLimit !== undefined && overallLimit > 0) {
      if ((overallCount || 0) >= overallLimit) {
        return {
          isValid: false,
          coupon,
          discount: 0,
          message: 'Coupon has reached its maximum platform redemption limit',
          errorCode: 'OVERALL_LIMIT_EXCEEDED',
        };
      }
    }

    // 3. Validate User-Specific Usage Limit
    const userLimit = coupon.perUserLimit !== undefined ? coupon.perUserLimit : coupon.userUsageLimit;
    if (userLimit !== undefined && userLimit > 0 && userId) {
      const userOrders = db.getOrders().filter(o => 
        o.userId === userId && 
        o.couponCode && 
        o.couponCode.toUpperCase() === coupon.code.toUpperCase() &&
        o.status !== 'CANCELLED'
      );

      if (userOrders.length >= userLimit) {
        return {
          isValid: false,
          coupon,
          discount: 0,
          message: `You have already used coupon "${coupon.code}" the maximum allowed ${userLimit} time${userLimit > 1 ? 's' : ''}`,
          errorCode: 'USER_LIMIT_EXCEEDED',
        };
      }
    }

    // 4. Validate First Order / New Customer Only
    const isFirstOrderOnly = coupon.firstOrderOnly || coupon.newCustomerOnly;
    if (isFirstOrderOnly && userId) {
      const priorOrders = db.getOrders().filter(o => o.userId === userId && o.status !== 'CANCELLED');
      if (priorOrders.length > 0) {
        return {
          isValid: false,
          coupon,
          discount: 0,
          message: 'Coupon valid only for first order',
          errorCode: 'FIRST_ORDER_ONLY',
        };
      }
    }

    // 5. Validate Store Restrictions
    if (storeId && coupon.applicableStores && coupon.applicableStores.length > 0) {
      if (!coupon.applicableStores.includes(storeId)) {
        return {
          isValid: false,
          coupon,
          discount: 0,
          message: `Coupon "${coupon.code}" is not applicable at this store location`,
          errorCode: 'STORE_RESTRICTION',
        };
      }
    }

    // 6. Validate Product and Category Restrictions & Calculate Eligible Subtotal
    const allProducts = db.getProducts();
    let eligibleSubtotal = 0;
    let eligibleItemCount = 0;

    const applicableCategories = coupon.applicableCategories || coupon.applicableCategoryIds || [];
    const applicableProducts = coupon.applicableProducts || coupon.applicableProductIds || [];
    const excludedCategories = coupon.excludedCategoryIds || [];
    const excludedProducts = coupon.excludedProductIds || [];

    const hasCategoryRestrictions = Boolean(
      applicableCategories.length > 0 ||
      excludedCategories.length > 0 ||
      applicableProducts.length > 0 ||
      excludedProducts.length > 0
    );

    if (items && items.length > 0) {
      for (const item of items) {
        const prodId = item.productId || (item.product && item.product.id);
        const prod = allProducts.find(p => p.id === prodId) || (item.product && item.product.id ? item.product : undefined);
        if (!prod) continue;
        const qty = item.quantity || 1;

        let isItemEligible = true;

        // Check applicable categories
        if (applicableCategories.length > 0) {
          if (!prod.categoryId || !applicableCategories.includes(prod.categoryId)) {
            isItemEligible = false;
          }
        }

        // Check applicable products
        if (applicableProducts.length > 0) {
          if (!applicableProducts.includes(prod.id)) {
            isItemEligible = false;
          }
        }

        // Check excluded categories
        if (excludedCategories.length > 0) {
          if (prod.categoryId && excludedCategories.includes(prod.categoryId)) {
            isItemEligible = false;
          }
        }

        // Check excluded products
        if (excludedProducts.length > 0) {
          if (excludedProducts.includes(prod.id)) {
            isItemEligible = false;
          }
        }

        if (isItemEligible) {
          eligibleSubtotal += (prod.price || 0) * qty;
          eligibleItemCount += qty;
        }
      }
    } else {
      // If items array wasn't provided, use cartTotal
      eligibleSubtotal = cartTotal;
      eligibleItemCount = 1;
    }

    // If there were explicit restrictions and no items qualify
    if (hasCategoryRestrictions && eligibleSubtotal <= 0) {
      const categories = db.getCategories();
      const catNames = applicableCategories
        .map(cid => categories.find(c => c.id === cid)?.name || cid)
        .join(', ');

      return {
        isValid: false,
        coupon,
        discount: 0,
        eligibleSubtotal: 0,
        message: catNames
          ? `Coupon "${coupon.code}" is only applicable on ${catNames}`
          : `No items in your cart qualify for coupon "${coupon.code}"`,
        errorCode: 'RESTRICTION_NOT_MET',
      };
    }

    // 7. Validate Minimum Order Value Requirements
    const minOrder = coupon.minimumOrderValue !== undefined ? coupon.minimumOrderValue : coupon.minOrderValue;
    const qualifyingAmount = hasCategoryRestrictions ? eligibleSubtotal : (cartTotal || eligibleSubtotal);

    if (minOrder && qualifyingAmount < minOrder) {
      return {
        isValid: false,
        coupon,
        discount: 0,
        eligibleSubtotal,
        message: `Minimum order ₹${minOrder} required`,
        errorCode: 'MIN_ORDER_NOT_MET',
      };
    }

    // 8. Calculate Discount (Percentage vs Fixed, with Max Discount Cap)
    let calculatedDiscount = 0;
    const isPercentage = String(coupon.discountType).toLowerCase().includes('percent');
    const maxDisc = coupon.maximumDiscount !== undefined ? coupon.maximumDiscount : coupon.maxDiscount;

    if (isPercentage) {
      const rawDiscount = (eligibleSubtotal * coupon.discountValue) / 100;
      calculatedDiscount = maxDisc
        ? Math.min(rawDiscount, maxDisc)
        : rawDiscount;
    } else {
      // Fixed discount
      calculatedDiscount = Math.min(coupon.discountValue, eligibleSubtotal);
    }

    // Round to clean integer
    calculatedDiscount = Math.round(calculatedDiscount);

    return {
      isValid: true,
      coupon,
      discount: calculatedDiscount,
      eligibleSubtotal,
      message: `Coupon "${coupon.code}" applied! You saved ₹${calculatedDiscount}`,
      savingsBreakdown: {
        originalSubtotal: cartTotal || eligibleSubtotal,
        eligibleSubtotal,
        discount: calculatedDiscount,
        finalSubtotal: Math.max(0, (cartTotal || eligibleSubtotal) - calculatedDiscount),
      },
    };
  }

  /**
   * Record coupon redemption when an order is successfully confirmed
   */
  public static recordCouponRedemption(
    code: string,
    userId: string,
    orderId: string
  ): boolean {
    if (!code) return false;
    const cleanCode = code.trim().toUpperCase();
    const coupon = db.getCoupons().find(c => c.code.toUpperCase() === cleanCode);
    if (!coupon) return false;

    // Increment platform usage count
    coupon.overallUsageCount = (coupon.overallUsageCount || 0) + 1;
    db.saveToFile();

    // Log audit trail
    db.logAudit(
      userId,
      'System/User',
      'customer',
      'COUPON_REDEEMED',
      'Coupon',
      coupon.id,
      `Redeemed coupon "${coupon.code}" on Order ${orderId}. Overall usage count is now ${coupon.overallUsageCount}`
    );

    return true;
  }
}
