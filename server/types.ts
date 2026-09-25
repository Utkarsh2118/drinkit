export type UserRole = 'customer' | 'staff' | 'delivery' | 'admin';

export interface NotificationPreferences {
  orderUpdates: boolean;
  promoAlerts: boolean;
  deliverySms: boolean;
  emailAlerts: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  avatarUrl?: string;
  preferredLanguage?: 'en' | 'kn' | 'hi';
  notificationPreferences?: NotificationPreferences;
  isActive?: boolean;
  assignedStoreId?: string; // For staff
  dateOfBirth?: string; // YYYY-MM-DD
  age?: number;
  isAgeVerified: boolean;
  ageVerifiedAt?: string;
  jurisdiction?: string;
  addresses: Address[];
  createdAt: string;
  updatedAt?: string;
}

export interface SupportTicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole | string;
  message: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  orderId?: string;
  category: 'order' | 'delivery' | 'payment' | 'product' | 'account' | 'other';
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  messages: SupportTicketMessage[];
  createdAt: string;
  updatedAt: string;
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
  mrp: number; // Maximum retail price (shows discount)
  volume: string; // e.g. "750 ml", "330 ml", "1 L"
  alcoholByVolume: number; // e.g. 40.0, 5.0, 12.5 (0 for non-alcoholic mixers/snacks)
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
  imageSource?: string;
  imageVerified?: boolean;
  imageVerifiedAt?: string;
  priceSource?: string;
  priceVerified?: boolean;
  priceVerifiedAt?: string;
  availableStates?: string[];
  regionalPrices?: RegionalPrice[];
}

export interface RegionalPrice {
  market: string;
  state?: string;
  price: number;
  mrp?: number;
  currency: string;
  source: string;
  sourceType: 'official' | 'licensed_retailer' | 'authorized_distributor' | 'secondary_aggregator' | 'development';
  verified: boolean;
  verifiedAt: string;
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

export interface StoreInventoryItem {
  id: string;
  storeId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity?: number;
  lowStockThreshold: number;
  updatedAt: string;
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
  estimatedDeliveryTime: string; // e.g. "20-25 mins"
  deliveryOtp: string; // 4-digit verification code
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
  discountValue: number; // e.g. 20 for 20% or 100 for ₹100
  minOrderValue: number;
  minimumOrderValue?: number; // alias
  maxDiscount?: number; // Cap for percentage discount
  maximumDiscount?: number; // alias
  validFrom?: string; // Optional start date ISO string
  startDate?: string; // alias
  validUntil: string; // Expiry date ISO string
  expiryDate?: string; // alias
  isActive: boolean;
  active?: boolean; // alias
  overallUsageLimit?: number; // Total redemptions allowed across platform
  usageLimit?: number; // alias
  overallUsageCount: number; // Current redemption count
  usedCount?: number; // alias
  userUsageLimit?: number; // Max redemptions per individual user
  perUserLimit?: number; // alias
  applicableCategoryIds?: string[]; // Specific categories allowed (e.g. cat_beer, cat_whisky)
  applicableCategories?: string[]; // alias
  applicableProductIds?: string[]; // Specific products allowed
  applicableProducts?: string[]; // alias
  excludedCategoryIds?: string[]; // Excluded categories
  excludedProductIds?: string[]; // Excluded products
  applicableStores?: string[]; // Specific stores allowed (e.g. store_indiranagar)
  firstOrderOnly?: boolean; // Eligible only on first order
  newCustomerOnly?: boolean; // alias for firstOrderOnly
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

export type ReviewStatus = 'published' | 'pending' | 'hidden' | 'flagged';

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  orderId?: string;
  rating: number; // 1 to 5 stars
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  verifiedPurchase?: boolean;
  status?: ReviewStatus;
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

export interface DeliveryZone {
  id: string;
  name: string;
  city: string;
  state: string;
  postalCodes: string[];
  associatedStoreId: string;
  isActive: boolean;
  minOrderValue: number;
  baseDeliveryFee: number;
}

export type VerificationStatus = 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'FAILED';

export interface VerificationRecord {
  status: VerificationStatus;
  verifiedAt: string;
  verifiedAge: number;
  jurisdiction: string;
  method: 'SELF_DECLARATION_WITH_DOB' | 'GOVT_PHOTO_ID' | 'DOORSTEP_VERIFICATION';
  documentType?: 'AADHAAR' | 'DRIVING_LICENSE' | 'PASSPORT' | 'VOTER_ID' | 'NONE';
  expiresAt: string;
}

export interface JurisdictionRule {
  id: string;
  stateCode: string;
  stateName: string;
  minimumAgeSpirits: number;
  minimumAgeBeerWine: number;
  maxLitresPerOrder: number;
  maxBottlesPerOrder: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  allowedPostalCodesPrefix?: string[];
  restrictedPostalCodes?: string[];
}

export interface PlatformComplianceSettings {
  legalDrinkingAge: number; // e.g. 21 or 25
  jurisdiction: string; // "Karnataka, India (State Excise Act Compliant)", etc.
  dryDayActive: boolean;
  dryDayReason?: string;
  maxBottlesPerOrder: number;
  maxVolumeLitresPerOrder: number;
  operatingHoursOnly: boolean;
  operatingHoursStart: string; // "10:00"
  operatingHoursEnd: string;   // "22:30"
  requireIdProofAtDoorstep: boolean;
  verificationExpiryDays: number;
  restrictedPostalCodes: string[];
  exciseLicenseNumber: string;
  exciseLicenseValidUntil: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
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

