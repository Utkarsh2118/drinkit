export type UserRole = 'customer' | 'staff' | 'delivery' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  dateOfBirth?: string;
  age?: number;
  isAgeVerified: boolean;
  ageVerifiedAt?: string;
  jurisdiction?: string;
  addresses: Address[];
}

export interface Address {
  id: string;
  label: 'home' | 'work' | 'office' | 'hostel' | 'other' | string;
  fullName: string;
  recipientName?: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  area?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  deliveryInstructions?: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string; // e.g. "375 ml", "750 ml", "1 L", "Pack of 6"
  volume: string; // e.g. "375 ml"
  unit?: string; // "ml" | "pack" | "can" | "bottle"
  price: number; // authoritative variant selling price
  mrp: number; // maximum retail price
  sku?: string;
  barcode?: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  subcategories: string[];
  itemCount?: number;
  isActive: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  countryOfOrigin: string;
  logoUrl: string;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  subcategory: string;
  price: number;
  mrp: number;
  volume: string;
  alcoholByVolume: number;
  isAlcoholic: boolean;
  description: string;
  tastingNotes: string[];
  imageUrl: string;
  country: string;
  isBestseller?: boolean;
  isNewArrival?: boolean;
  isFeatured?: boolean;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  stock?: number;
  inStock?: boolean;
  tags?: string[];
  variants?: ProductVariant[];
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  area: string;
  city: string;
  state: string;
  postalCodes: string[];
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  operatingHours: {
    open: string; // "10:00"
    close: string; // "23:00"
  };
  isActive: boolean;
  deliveryEnabled: boolean;
}

export interface InventoryReservation {
  id: string;
  userId: string;
  storeId: string;
  items: { productId: string; variantId?: string; quantity: number }[];
  status: 'ACTIVE' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED';
  expiresAt: string;
  createdAt: string;
  orderId?: string;
  releaseReason?: string;
}

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentState =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type RefundStatus =
  | 'NONE'
  | 'REFUND_PENDING'
  | 'REFUND_PROCESSING'
  | 'REFUNDED'
  | 'REFUND_FAILED';

export interface RefundDetails {
  refundId?: string;
  gatewayRefundId?: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface CancellationDetails {
  reasonCategory:
    | 'Changed my mind'
    | 'Ordered by mistake'
    | 'Payment issue'
    | 'Delivery taking too long'
    | 'Product unavailable'
    | 'Other';
  customExplanation?: string;
  cancelledAt: string;
  cancelledBy: {
    id: string;
    name: string;
    role: string;
  };
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  volume: string;
  price: number;
  quantity: number;
  subtotal: number;
  variantId?: string;
  variantName?: string;
  variantSku?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone: string;
  storeId: string;
  storeName: string;
  deliveryAddress: Address;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  deliveryFee: number;
  handlingFee: number;
  taxes: number;
  totalAmount: number;
  paymentMethod: 'card' | 'upi' | 'netbanking' | 'cod';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentState?: PaymentState;
  paymentGateway?: 'razorpay' | 'cashfree' | 'cod' | 'sandbox';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  paymentId?: string;
  reservationId?: string;
  status: OrderStatus;
  statusTimeline: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }[];
  deliveryAgentId?: string;
  deliveryAgentName?: string;
  deliveryAgentPhone?: string;
  estimatedDeliveryTime: string;
  deliveryOtp: string;
  ageVerifiedAtDelivery: boolean;
  cancellationReason?: string;
  cancellationDetails?: CancellationDetails;
  refundDetails?: RefundDetails;
  createdAt: string;
  updatedAt: string;
}

export type DiscountType = 'percentage' | 'fixed' | 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  minimumOrderValue?: number;
  maxDiscount?: number;
  maximumDiscount?: number;
  validFrom?: string;
  startDate?: string;
  validUntil: string;
  expiryDate?: string;
  isActive: boolean;
  active?: boolean;
  overallUsageLimit?: number;
  usageLimit?: number;
  overallUsageCount: number;
  usedCount?: number;
  userUsageLimit?: number;
  perUserLimit?: number;
  applicableCategoryIds?: string[];
  applicableCategories?: string[];
  applicableProductIds?: string[];
  applicableProducts?: string[];
  excludedCategoryIds?: string[];
  excludedProductIds?: string[];
  applicableStores?: string[];
  firstOrderOnly?: boolean;
  newCustomerOnly?: boolean;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon?: Coupon;
  discount: number;
  message: string;
  errorCode?: string;
  eligibleSubtotal?: number;
  savingsBreakdown?: {
    originalSubtotal: number;
    eligibleSubtotal: number;
    discount: number;
    finalSubtotal: number;
  };
}

export interface AnalyticsData {
  timeframe: 'daily' | 'weekly' | 'monthly';
  metrics: {
    totalOrders: number;
    todayOrdersCount: number;
    totalRevenue: number;
    todayRevenue: number;
    averageOrderValue: number;
    activeDeliveries: number;
    lowStockCount: number;
    totalCustomers: number;
    activeStoresCount: number;
    fulfillmentRate: number; // percentage e.g. 96.4
    repeatCustomerRate: number; // percentage e.g. 62.5
  };
  salesTrend: {
    label: string;
    orders: number;
    revenue: number;
    averageOrderValue: number;
  }[];
  orderStatusBreakdown: {
    status: OrderStatus;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  storePerformance: {
    storeId: string;
    storeName: string;
    area: string;
    ordersCount: number;
    revenue: number;
    deliveredCount: number;
    fulfillmentRate: number;
    avgDeliveryMinutes: number;
    activeInventoryCount: number;
    lowStockCount: number;
  }[];
  topSellingProducts: {
    productId: string;
    productName: string;
    brandName: string;
    categoryName: string;
    imageUrl: string;
    price: number;
    unitsSold: number;
    revenue: number;
    stockRemaining: number;
  }[];
  lowStockItems: {
    id: string;
    productId: string;
    productName: string;
    brandName: string;
    categoryName: string;
    imageUrl: string;
    storeId: string;
    storeName: string;
    quantity: number;
    available: number;
    lowStockThreshold: number;
    severity: 'critical' | 'warning';
  }[];
  customerAcquisition: {
    label: string;
    newCustomers: number;
    cumulativeCustomers: number;
  }[];
  repeatCustomerMetrics: {
    totalCustomers: number;
    repeatCustomers: number;
    repeatCustomerRate: number;
    cohortDistribution: {
      name: string;
      customerCount: number;
      ordersCount: number;
      percentage: number;
      color: string;
    }[];
  };
}

export type ReviewStatus = 'published' | 'pending' | 'hidden' | 'flagged';

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  orderId?: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface WishlistItem {
  productId: string;
  userId: string;
  addedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'promo' | 'system';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface PlatformComplianceSettings {
  legalDrinkingAge: number;
  jurisdiction: string;
  dryDayActive: boolean;
  dryDayReason?: string;
  maxBottlesPerOrder: number;
  operatingHoursOnly: boolean;
  requireIdProofAtDoorstep: boolean;
}

export interface CartItem {
  product: Product;
  variant?: ProductVariant;
  quantity: number;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  volume: string;
  quantity: number;
  price: number;
  subtotal: number;
  hsnCode: string;
  taxRate: number;
  taxAmount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orderId: string;
  orderNumber: string;
  seller: {
    storeId: string;
    storeName: string;
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    gstin: string;
    exciseLicense: string;
    fssaiLicense: string;
  };
  customer: {
    userId: string;
    name: string;
    phone: string;
    deliveryAddress: Address;
  };
  items: InvoiceItem[];
  totals: {
    subtotal: number;
    discount: number;
    deliveryFee: number;
    handlingFee: number;
    taxes: number;
    totalAmount: number;
    couponCode?: string;
  };
  paymentMethod: string;
  paymentState: string;
  qrVerificationPayload: string;
}

