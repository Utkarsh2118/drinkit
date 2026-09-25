import fs from 'fs';
import path from 'path';
import {
  User,
  Address,
  Category,
  Brand,
  Product,
  Store,
  StoreInventoryItem,
  Order,
  Coupon,
  Review,
  Notification,
  DeliveryZone,
  PlatformComplianceSettings,
  AuditLog,
  OrderStatus,
  InventoryReservation,
  CancellationDetails,
  RefundDetails,
  PaymentState,
  RefundStatus,
  ReviewStatus,
  WishlistItem,
  SupportTicket,
  SupportTicketMessage,
} from '../types.ts';
import {
  SEED_CATEGORIES,
  SEED_BRANDS,
  SEED_PRODUCTS,
  SEED_STORES,
  SEED_DELIVERY_ZONES,
  SEED_COUPONS,
  SEED_COMPLIANCE_SETTINGS,
  SEED_USERS,
} from '../seed/data.ts';

export interface DatabaseSchema {
  users: User[];
  categories: Category[];
  brands: Brand[];
  products: Product[];
  stores: Store[];
  inventory: StoreInventoryItem[];
  orders: Order[];
  reservations: InventoryReservation[];
  coupons: Coupon[];
  reviews: Review[];
  wishlists?: { [userId: string]: WishlistItem[] };
  notifications: Notification[];
  deliveryZones: DeliveryZone[];
  complianceSettings: PlatformComplianceSettings;
  auditLogs: AuditLog[];
  invoiceSequence: number;
  supportTickets?: SupportTicket[];
  revokedTokens?: string[];
  catalogueVersion?: number;
}

class DatabaseManager {
  private data: DatabaseSchema;
  private storageFilePath: string;
  private sweepIntervalTimer?: NodeJS.Timeout;

  // In-memory high-speed indexes (O(1) lookups for heavy catalog/store traffic)
  private productMap = new Map<string, Product>();
  private userMap = new Map<string, User>();
  private orderMap = new Map<string, Order>();
  private inventoryKeyMap = new Map<string, StoreInventoryItem>();

  constructor() {
    this.storageFilePath = path.join(process.cwd(), 'server', 'db', 'drinkit_data.json');
    this.data = this.loadOrInitialize();
    this.rebuildIndexes();

    // Periodic sweeper for expired inventory reservations (every 30 seconds)
    this.sweepIntervalTimer = setInterval(() => {
      try {
        this.sweepExpiredReservations();
      } catch (err) {
        console.error('Error sweeping expired reservations in background:', err);
      }
    }, 30000);
  }

  public rebuildIndexes(): void {
    this.productMap.clear();
    for (const p of this.data.products || []) {
      this.productMap.set(p.id, p);
    }

    this.userMap.clear();
    for (const u of this.data.users || []) {
      this.userMap.set(u.id, u);
    }

    this.orderMap.clear();
    for (const o of this.data.orders || []) {
      this.orderMap.set(o.id, o);
    }

    this.inventoryKeyMap.clear();
    for (const inv of this.data.inventory || []) {
      this.inventoryKeyMap.set(`${inv.storeId}:${inv.productId}:${inv.variantId || ''}`, inv);
    }
  }

  private loadOrInitialize(): DatabaseSchema {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.products && parsed.products.length > 0) {
          parsed.reservations = parsed.reservations || [];
          parsed.invoiceSequence = parsed.invoiceSequence || 1000;
          parsed.wishlists = parsed.wishlists || {};
          parsed.supportTickets = parsed.supportTickets || [];
          parsed.revokedTokens = parsed.revokedTokens || [];
          parsed.catalogueVersion = parsed.catalogueVersion || 0;

          // Migrate stores, zones, compliance, and products to UP + Delhi NCR if previous data had old regions
          const hasOldStores = (parsed.stores || []).some((s: any) => s.id === 'store_indiranagar' || s.city === 'Bengaluru' || s.state === 'Karnataka');
          const needsCatalogueV3 = parsed.catalogueVersion < 4 || hasOldStores || !parsed.stores || parsed.stores.length === 0;
          if (needsCatalogueV3) {
            parsed.stores = SEED_STORES;
            parsed.deliveryZones = SEED_DELIVERY_ZONES;
            parsed.complianceSettings = SEED_COMPLIANCE_SETTINGS;
            parsed.categories = SEED_CATEGORIES;
            parsed.brands = SEED_BRANDS;
            parsed.products = SEED_PRODUCTS;
            parsed.catalogueVersion = 4;
            // Re-generate store inventory with deliberate store-specific catalogue differences.
            parsed.inventory = [];
            for (const store of SEED_STORES) {
              for (const product of SEED_PRODUCTS) {
                const stateAllowed = !product.availableStates?.length || product.availableStates.includes(store.state);
                const productIndex = SEED_PRODUCTS.findIndex(p => p.id === product.id);
                const storeIndex = SEED_STORES.findIndex(s => s.id === store.id);
                const selectiveAvailability = ((productIndex + storeIndex) % 5) !== 4;
                if (!stateAllowed || !selectiveAvailability || !product.isActive) continue;
                const baseStock = product.isBestseller ? 24 : 12;
                const stockOffset = ((storeIndex + productIndex) % 4) * 4;
                parsed.inventory.push({
                  id: `inv_${store.id}_${product.id}`,
                  storeId: store.id,
                  productId: product.id,
                  quantity: baseStock + stockOffset,
                  reservedQuantity: 0,
                  availableQuantity: baseStock + stockOffset,
                  lowStockThreshold: 5,
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }

          // Ensure all users have profile fields initialized
          (parsed.users || []).forEach((u: any) => {
            if (u.isActive === undefined) u.isActive = true;
            if (!u.preferredLanguage) u.preferredLanguage = 'en';
            if (!u.notificationPreferences) {
              u.notificationPreferences = {
                orderUpdates: true,
                promoAlerts: true,
                deliverySms: true,
                emailAlerts: true,
              };
            }
            if (u.role === 'staff' && (!u.assignedStoreId || u.assignedStoreId === 'store_indiranagar')) {
              u.assignedStoreId = 'store_noida_sec18';
            }
            if (u.jurisdiction === 'Karnataka') {
              u.jurisdiction = 'Uttar Pradesh';
            }
          });

          // Ensure all reviews have status and verifiedPurchase normalized
          (parsed.reviews || []).forEach((r: any) => {
            if (!r.status) r.status = 'published';
            if (r.verifiedPurchase === undefined) r.verifiedPurchase = Boolean(r.isVerifiedPurchase);
            if (r.isVerifiedPurchase === undefined) r.isVerifiedPurchase = Boolean(r.verifiedPurchase);
          });

          // Ensure all inventory records have availableQuantity calculated
          (parsed.inventory || []).forEach((inv: StoreInventoryItem) => {
            inv.reservedQuantity = inv.reservedQuantity || 0;
            inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
          });

          // Ensure all historical orders have invoice numbers and paymentState
          (parsed.orders || []).forEach((o: any, idx: number) => {
            if (!o.invoiceNumber) {
              o.invoiceNumber = `DRK-2026-${String(idx + 1001).padStart(6, '0')}`;
            }
            if (!o.invoiceDate) {
              o.invoiceDate = o.createdAt;
            }
            if (!o.paymentState) {
              if (o.status === 'CANCELLED' || o.paymentStatus === 'refunded') {
                o.paymentState = 'REFUNDED';
              } else if (o.paymentStatus === 'completed') {
                o.paymentState = 'PAID';
              } else if (o.paymentStatus === 'failed') {
                o.paymentState = 'FAILED';
              } else {
                o.paymentState = 'PENDING';
              }
            }
          });
          // Synchronize coupons with new advanced seed definitions
          const existingCodeMap = new Map<string, Coupon>();
          (parsed.coupons || []).forEach((c: Coupon) => existingCodeMap.set(c.code.toUpperCase(), c));
          for (const sc of SEED_COUPONS) {
            if (!existingCodeMap.has(sc.code.toUpperCase())) {
              parsed.coupons.push(sc);
            } else {
              // Update rule definitions while preserving overall usage
              const existing = existingCodeMap.get(sc.code.toUpperCase())!;
              existing.applicableCategoryIds = sc.applicableCategoryIds;
              existing.applicableProductIds = sc.applicableProductIds;
              existing.userUsageLimit = sc.userUsageLimit;
              existing.overallUsageLimit = sc.overallUsageLimit;
              existing.minOrderValue = sc.minOrderValue;
              existing.maxDiscount = sc.maxDiscount;
              existing.description = sc.description;
            }
          }

          // Ensure users list has all sample customer personas
          const existingUserIds = new Set((parsed.users || []).map((u: any) => u.id));
          for (const su of SEED_USERS) {
            if (!existingUserIds.has(su.id)) {
              parsed.users.push(su);
            }
          }

          // Keep the regional catalogue version authoritative after migration.
          parsed.catalogueVersion = 4;

          // Ensure stores list has all configured stores
          const existingStoreIds = new Set((parsed.stores || []).map((s: any) => s.id));
          for (const ss of SEED_STORES) {
            if (!existingStoreIds.has(ss.id)) {
              parsed.stores.push(ss);
              // Initialize inventory for new store
              for (const prod of (parsed.products || [])) {
                const stateAllowed = !prod.availableStates?.length || prod.availableStates.includes(ss.state);
                if (!stateAllowed || !prod.isActive) continue;
                parsed.inventory.push({
                  id: `inv_${ss.id}_${prod.id}`,
                  storeId: ss.id,
                  productId: prod.id,
                  quantity: 15,
                  reservedQuantity: 0,
                  availableQuantity: 15,
                  lowStockThreshold: 5,
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }

          // Sync category image URLs from seed data
const seedCategoryMap = new Map(
  SEED_CATEGORIES.map(category => [category.id, category])
);

parsed.categories = (parsed.categories || []).map((existingCategory: Category) => {
  const seedCategory = seedCategoryMap.get(existingCategory.id);

  if (seedCategory?.imageUrl) {
    return {
      ...existingCategory,
      imageUrl: seedCategory.imageUrl,
    };
  }

  return existingCategory;
});

// Sync product image URLs from seed data
const seedProductMap = new Map(
  SEED_PRODUCTS.map(product => [product.id, product])
);

parsed.products = (parsed.products || []).map((existingProduct: Product) => {
  const seedProduct = seedProductMap.get(existingProduct.id);

  if (seedProduct?.imageUrl) {
    return {
      ...existingProduct,
      imageUrl: seedProduct.imageUrl,
    };
  }

  return existingProduct;
});

          // Ensure delivery zones are synced
          const existingZoneIds = new Set((parsed.deliveryZones || []).map((z: any) => z.id));
          for (const sz of SEED_DELIVERY_ZONES) {
            if (!existingZoneIds.has(sz.id)) {
              parsed.deliveryZones.push(sz);
            }
          }

          // If orders list doesn't have sufficient historical depth for analytics, enrich with historical data
          if (!parsed.orders || parsed.orders.length < 15) {
            const historical = this.generateRichHistoricalOrders();
            parsed.orders = [...(parsed.orders || []), ...historical];
          }

          this.save(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read existing database file, re-seeding default data:', e);
    }

    return this.createSeedData();
  }

  private generateRichHistoricalOrders(): Order[] {
    const historicalOrders: Order[] = [];
    const stores = SEED_STORES;
    const products = SEED_PRODUCTS;
    const users = SEED_USERS.filter(u => u.role === 'customer');

    const statuses: OrderStatus[] = [
      'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED',
      'DELIVERED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'PREPARING', 'CANCELLED'
    ];

    const couponsUsed = ['WELCOME50', 'CHEERS100', 'PARTY15', 'BEERFEST20', 'MALTLUXE', undefined, undefined];

    // Distribute 45 orders across the last 30 days
    for (let i = 0; i < 45; i++) {
      // Days ago: from 0 to 29 days ago
      const daysAgo = Math.floor(Math.pow(Math.random(), 1.2) * 28);
      const hoursAgo = Math.floor(Math.random() * 24);
      const orderDate = new Date(Date.now() - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000);

      const customer = users[i % users.length];
      const store = stores[i % stores.length];
      const status = daysAgo === 0 ? statuses[i % statuses.length] : (i % 9 === 0 ? 'CANCELLED' : 'DELIVERED');

      // Pick 1 to 3 random products
      const p1 = products[(i * 3 + 1) % products.length];
      const p2 = products[(i * 5 + 4) % products.length];
      const p3 = (i % 2 === 0) ? products[(i * 7 + 2) % products.length] : null;

      const orderItems = [
        {
          productId: p1.id,
          productName: p1.name,
          productImage: p1.imageUrl,
          volume: p1.volume,
          price: p1.price,
          quantity: (i % 3) + 1,
          subtotal: p1.price * ((i % 3) + 1),
        },
        {
          productId: p2.id,
          productName: p2.name,
          productImage: p2.imageUrl,
          volume: p2.volume,
          price: p2.price,
          quantity: 1,
          subtotal: p2.price,
        }
      ];

      if (p3) {
        orderItems.push({
          productId: p3.id,
          productName: p3.name,
          productImage: p3.imageUrl,
          volume: p3.volume,
          price: p3.price,
          quantity: 1,
          subtotal: p3.price,
        });
      }

      const subtotal = orderItems.reduce((acc, item) => acc + item.subtotal, 0);
      const couponCode = couponsUsed[i % couponsUsed.length];
      const discount = couponCode === 'CHEERS100' ? 100 : (couponCode === 'WELCOME50' ? 50 : (couponCode === 'PARTY15' ? 250 : 0));
      const deliveryFee = subtotal > 999 ? 0 : 35;
      const handlingFee = 15;
      const taxes = Math.round((subtotal - discount) * 0.05);
      const totalAmount = Math.max(0, subtotal - discount + deliveryFee + handlingFee + taxes);

      historicalOrders.push({
        id: `ord_hist_${i + 100}`,
        orderNumber: `DRK-${8000 + i}`,
        userId: customer.id,
        userEmail: customer.email,
        userName: customer.name,
        userPhone: customer.phone,
        storeId: store.id,
        storeName: store.name,
        deliveryAddress: customer.addresses[0] || {
          id: `addr_hist_${i}`,
          label: 'home',
          fullName: customer.name,
          phone: customer.phone,
          addressLine1: `${store.area} Residency`,
          city: store.city,
          state: store.state,
          postalCode: store.postalCodes[0],
          latitude: store.latitude,
          longitude: store.longitude,
          isDefault: true,
        },
        items: orderItems,
        subtotal,
        discount,
        couponCode,
        deliveryFee,
        handlingFee,
        taxes,
        totalAmount,
        paymentMethod: (i % 3 === 0) ? 'card' : ((i % 3 === 1) ? 'upi' : 'netbanking'),
        paymentStatus: status === 'CANCELLED' ? 'refunded' : 'completed',
        paymentId: `pay_hist_${i + 500}`,
        status,
        statusTimeline: [
          { status: 'PLACED', timestamp: orderDate.toISOString(), note: 'Order placed & payment received' },
          { status: 'DELIVERED', timestamp: new Date(orderDate.getTime() + 22 * 60 * 1000).toISOString(), note: 'Delivered in 22 mins' }
        ],
        deliveryAgentId: 'usr_delivery',
        deliveryAgentName: 'Vikram Singh (Rider)',
        deliveryAgentPhone: '+91 98765 43212',
        estimatedDeliveryTime: '20 mins',
        deliveryOtp: String(1000 + (i * 123) % 9000),
        ageVerifiedAtDelivery: status === 'DELIVERED',
        createdAt: orderDate.toISOString(),
        updatedAt: new Date(orderDate.getTime() + 22 * 60 * 1000).toISOString(),
      });
    }

    return historicalOrders;
  }

  private createSeedData(): DatabaseSchema {
    // Generate deliberately store-specific inventories; no universal availability.
    const inventory: StoreInventoryItem[] = [];
    for (const store of SEED_STORES) {
      const storeIndex = SEED_STORES.findIndex(s => s.id === store.id);
      for (const product of SEED_PRODUCTS) {
        const stateAllowed = !product.availableStates?.length || product.availableStates.includes(store.state);
        const productIndex = SEED_PRODUCTS.findIndex(p => p.id === product.id);
        const selectiveAvailability = ((productIndex + storeIndex) % 5) !== 4;
        if (!stateAllowed || !selectiveAvailability || !product.isActive) continue;
        const baseStock = product.isBestseller ? 24 : 12;
        const stockOffset = ((storeIndex + productIndex) % 4) * 4;
        inventory.push({
          id: `inv_${store.id}_${product.id}`,
          storeId: store.id,
          productId: product.id,
          quantity: baseStock + stockOffset,
          reservedQuantity: 0,
          availableQuantity: baseStock + stockOffset,
          lowStockThreshold: 5,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Seed initial demo orders so order tracking and rider dashboards have real active orders
    const demoOrders: Order[] = [
      {
        id: 'ord_demo_active_1',
        orderNumber: 'DRK-9281',
        userId: 'usr_customer',
        userEmail: 'customer@drinkit.demo',
        userName: 'Pooja Nair',
        userPhone: '+91 98765 43213',
        storeId: 'store_noida_sec18',
        storeName: 'DrinkIt Hub — Noida Sector 18 & NCR Core',
        deliveryAddress: SEED_USERS[3].addresses[0],
        items: [
          {
            productId: 'prod_royal_stag_deluxe',
            productName: 'Royal Stag Deluxe Whisky',
            productImage: 'https://www.bswliquor.com/cdn/shop/products/royal_stag_deluxe.png?v=1753126462&width=2400',
            volume: '750 ml',
            price: 675,
            quantity: 1,
            subtotal: 675,
          },
          {
            productId: 'prod_redbull_250',
            productName: 'Red Bull Energy Drink',
            productImage: 'https://image.aapkabazar.co/product/401/1697090583516.png?type=png',
            volume: '250 ml',
            price: 125,
            quantity: 2,
            subtotal: 250,
          },
          {
            productId: 'prod_bisleri_1l',
            productName: 'Bisleri Packaged Drinking Water',
            productImage: 'https://prithvienterprises.co.in/cdn/shop/files/sliding_images_jpeg_10b8b01a_8b71_4448_becb_16d4247ef05cjpgts1707312326_c0082670-b46c-4a72-80a6-9ac911e3b778.jpg?v=1746382045',
            volume: '1 L',
            price: 20,
            quantity: 1,
            subtotal: 20,
          }
        ],
        subtotal: 945,
        discount: 0,
        couponCode: undefined,
        deliveryFee: 35,
        handlingFee: 15,
        taxes: 47,
        totalAmount: 1042,
        paymentMethod: 'upi',
        paymentStatus: 'completed',
        paymentId: 'pay_mock_9921',
        status: 'OUT_FOR_DELIVERY',
        statusTimeline: [
          { status: 'PLACED', timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(), note: 'Order placed & payment verified' },
          { status: 'CONFIRMED', timestamp: new Date(Date.now() - 16 * 60 * 1000).toISOString(), note: 'Store confirmed order' },
          { status: 'PREPARING', timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(), note: 'Bottles packed and chilled' },
          { status: 'READY_FOR_PICKUP', timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), note: 'Bag sealed with tamper-evident tape' },
          { status: 'ASSIGNED', timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(), note: 'Rider Vikram Singh assigned' },
          { status: 'OUT_FOR_DELIVERY', timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), note: 'Rider en route with thermal bag' },
        ],
        deliveryAgentId: 'usr_delivery',
        deliveryAgentName: 'Vikram Singh (Rider)',
        deliveryAgentPhone: '+91 98765 43212',
        estimatedDeliveryTime: '7 mins',
        deliveryOtp: '4829',
        ageVerifiedAtDelivery: false,
        createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      },
      {
        id: 'ord_demo_delivered_2',
        orderNumber: 'DRK-8410',
        userId: 'usr_customer',
        userEmail: 'customer@drinkit.demo',
        userName: 'Pooja Nair',
        userPhone: '+91 98765 43213',
        storeId: 'store_noida_sec18',
        storeName: 'DrinkIt Hub — Noida Sector 18 & NCR Core',
        deliveryAddress: SEED_USERS[3].addresses[0],
        items: [
          {
            productId: 'prod_kingfisher_premium',
            productName: 'Kingfisher Premium Lager Beer',
            productImage: 'https://images.unsplash.com/photo-1608270199182-4faeb9ff7584?w=600&auto=format&fit=crop&q=80',
            volume: '650 ml Bottle',
            price: 140,
            quantity: 3,
            subtotal: 420,
          },
          {
            productId: 'prod_haldiram_aloo_bhujia_200',
            productName: "Haldiram's Nagpur Spicy Aloo Bhujia",
            productImage: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop&q=80',
            volume: '200g Pack',
            price: 55,
            quantity: 2,
            subtotal: 110,
          }
        ],
        subtotal: 530,
        discount: 50,
        couponCode: 'WELCOME50',
        deliveryFee: 35,
        handlingFee: 15,
        taxes: 85,
        totalAmount: 1625,
        paymentMethod: 'card',
        paymentStatus: 'completed',
        paymentId: 'pay_mock_8122',
        status: 'DELIVERED',
        statusTimeline: [
          { status: 'PLACED', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
          { status: 'CONFIRMED', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000).toISOString() },
          { status: 'PREPARING', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString() },
          { status: 'READY_FOR_PICKUP', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString() },
          { status: 'ASSIGNED', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString() },
          { status: 'OUT_FOR_DELIVERY', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString() },
          { status: 'DELIVERED', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 28 * 60 * 1000).toISOString(), note: 'Delivered and 21+ ID verified' },
        ],
        deliveryAgentId: 'usr_delivery',
        deliveryAgentName: 'Vikram Singh (Rider)',
        deliveryAgentPhone: '+91 98765 43212',
        estimatedDeliveryTime: 'Delivered',
        deliveryOtp: '7102',
        ageVerifiedAtDelivery: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 28 * 60 * 1000).toISOString(),
      }
    ];

    const demoReviews: Review[] = [
      {
        id: 'rev_1',
        productId: 'prod_royal_stag_deluxe',
        userId: 'usr_customer',
        userName: 'Pooja Nair',
        rating: 5,
        title: 'Delivered ice-cold in 18 minutes!',
        comment: 'Authentic sealed bottle with batch sticker. Arrived lightning fast for our Friday get-together.',
        isVerifiedPurchase: true,
        verifiedPurchase: true,
        status: 'published',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'rev_2',
        productId: 'prod_budweiser_magnum',
        userId: 'usr_customer',
        userName: 'Karan M.',
        rating: 5,
        title: 'Chilled lagers and crisp packaging',
        comment: 'Ice cold cans with zero dents. Rider verified my digital ID in 5 seconds. Super smooth.',
        isVerifiedPurchase: true,
        verifiedPurchase: true,
        status: 'published',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const demoNotifications: Notification[] = [
      {
        id: 'notif_1',
        userId: 'usr_customer',
        title: '🚴 Order Out For Delivery!',
        message: 'Your order #DRK-9281 is on the way. Rider Vikram Singh will arrive in ~7 mins.',
        type: 'order',
        isRead: false,
        link: '/orders/ord_demo_active_1',
        createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif_2',
        userId: 'usr_customer',
        title: '🎉 Weekend Party Offer Active!',
        message: 'Use code CHEERS100 to get ₹100 OFF on your favorite malts and craft beers.',
        type: 'promo',
        isRead: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const demoAuditLogs: AuditLog[] = [
      {
        id: 'aud_1',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        userId: 'usr_customer',
        userName: 'Pooja Nair',
        role: 'customer',
        action: 'ORDER_PLACED',
        entity: 'Order',
        entityId: 'ord_demo_active_1',
        details: 'Order placed for ₹3675 with Indiranagar Central Store',
      },
      {
        id: 'aud_2',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        userId: 'usr_store',
        userName: 'Rohan Verma',
        role: 'staff',
        action: 'ORDER_PREPARED',
        entity: 'Order',
        entityId: 'ord_demo_active_1',
        details: 'Order items packed and inventory committed',
      }
    ];

    const initialData: DatabaseSchema = {
      users: SEED_USERS,
      categories: SEED_CATEGORIES,
      brands: SEED_BRANDS,
      products: SEED_PRODUCTS,
      stores: SEED_STORES,
      inventory,
      orders: demoOrders,
      coupons: SEED_COUPONS,
      reviews: demoReviews,
      notifications: demoNotifications,
      deliveryZones: SEED_DELIVERY_ZONES,
      complianceSettings: SEED_COMPLIANCE_SETTINGS,
      auditLogs: demoAuditLogs,
      reservations: [],
      invoiceSequence: 1047,
    };

    this.save(initialData);
    return initialData;
  }

  private save(data: DatabaseSchema) {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
      this.rebuildIndexes();
    } catch (e) {
      console.error('Failed to save database snapshot to disk:', e);
    }
  }

  public persist() {
    this.save(this.data);
  }

  // --- GETTERS ---
  public getUsers(): User[] { return this.data.users; }
  public getCategories(): Category[] { return this.data.categories; }
  public getBrands(): Brand[] { return this.data.brands; }
  public getProducts(): Product[] { return this.data.products; }
  public getStores(): Store[] { return this.data.stores; }
  public getInventory(): StoreInventoryItem[] { return this.data.inventory; }
  public getOrders(): Order[] { return this.data.orders; }
  public getCoupons(): Coupon[] { return this.data.coupons; }
  public getReviews(): Review[] { return this.data.reviews; }
  public getNotifications(): Notification[] { return this.data.notifications; }
  public getDeliveryZones(): DeliveryZone[] { return this.data.deliveryZones; }
  public getComplianceSettings(): PlatformComplianceSettings { return this.data.complianceSettings; }
  public getAuditLogs(): AuditLog[] { return this.data.auditLogs; }

  // --- USER METHODS ---
  public findUserById(id: string): User | undefined {
    return this.userMap.get(id) || this.data.users.find(u => u.id === id);
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserByPhone(phone: string): User | undefined {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (!clean) return undefined;
    return this.data.users.find(u => {
      const uClean = (u.phone || '').replace(/\D/g, '').slice(-10);
      return uClean === clean;
    });
  }

  public createUser(user: User): User {
    this.data.users.push(user);
    this.logAudit(user.id, user.name, user.role, 'USER_REGISTERED', 'User', user.id, `New user registered: ${user.email}`);
    this.persist();
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.persist();
    return this.data.users[idx];
  }

  // --- ADDRESS METHODS ---
  public getUserAddresses(userId: string): Address[] {
    const user = this.findUserById(userId);
    return user ? (user.addresses || []) : [];
  }

  public addUserAddress(userId: string, address: Address): Address[] {
    const user = this.findUserById(userId);
    if (!user) return [];
    user.addresses = user.addresses || [];

    // Enforce single default address logic:
    // If new address is default or user has no previous addresses, set as default and clear others
    if (address.isDefault || user.addresses.length === 0) {
      address.isDefault = true;
      user.addresses.forEach(a => { a.isDefault = false; });
    } else {
      const hasDefault = user.addresses.some(a => a.isDefault);
      if (!hasDefault) {
        address.isDefault = true;
      }
    }

    user.addresses.push(address);
    this.persist();
    return user.addresses;
  }

  public updateUserAddress(userId: string, addressId: string, updates: Partial<Address>): Address[] | null {
    const user = this.findUserById(userId);
    if (!user || !user.addresses) return null;
    const idx = user.addresses.findIndex(a => a.id === addressId);
    if (idx === -1) return null;

    if (updates.isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }

    user.addresses[idx] = {
      ...user.addresses[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Ensure at least one default remains if addresses exist
    const hasDefault = user.addresses.some(a => a.isDefault);
    if (!hasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    this.persist();
    return user.addresses;
  }

  public deleteUserAddress(userId: string, addressId: string): Address[] | null {
    const user = this.findUserById(userId);
    if (!user || !user.addresses) return null;
    const idx = user.addresses.findIndex(a => a.id === addressId);
    if (idx === -1) return null;

    const wasDefault = user.addresses[idx].isDefault;
    user.addresses.splice(idx, 1);

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    this.persist();
    return user.addresses;
  }

  public setDefaultUserAddress(userId: string, addressId: string): Address[] | null {
    const user = this.findUserById(userId);
    if (!user || !user.addresses) return null;
    const exists = user.addresses.some(a => a.id === addressId);
    if (!exists) return null;

    user.addresses.forEach(a => {
      a.isDefault = (a.id === addressId);
      if (a.id === addressId) {
        a.updatedAt = new Date().toISOString();
      }
    });

    this.persist();
    return user.addresses;
  }

  // --- PRODUCT METHODS ---
  public findProductById(id: string): Product | undefined {
    return this.productMap.get(id) || this.data.products.find(p => p.id === id);
  }

  public createProduct(product: Product): Product {
    this.data.products.unshift(product);
    // Initialize inventory across all active stores for this new product
    for (const store of this.data.stores) {
      this.data.inventory.push({
        id: `inv_${store.id}_${product.id}`,
        storeId: store.id,
        productId: product.id,
        quantity: 25,
        reservedQuantity: 0,
        lowStockThreshold: 5,
        updatedAt: new Date().toISOString(),
      });
    }
    this.persist();
    return product;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | null {
    const idx = this.data.products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.data.products[idx] = { ...this.data.products[idx], ...updates };
    this.persist();
    return this.data.products[idx];
  }

  public deleteProduct(id: string): boolean {
    const prevLen = this.data.products.length;
    this.data.products = this.data.products.filter(p => p.id !== id);
    this.data.inventory = this.data.inventory.filter(i => i.productId !== id);
    this.persist();
    return this.data.products.length < prevLen;
  }

  // --- INVENTORY & RESERVATION METHODS ---
  public sweepExpiredReservations(): number {
    const now = Date.now();
    let expiredCount = 0;
    this.data.reservations = this.data.reservations || [];

    for (const resv of this.data.reservations) {
      if (resv.status === 'ACTIVE' && new Date(resv.expiresAt).getTime() <= now) {
        // Release reserved stock back to store inventory
        for (const item of resv.items) {
          const inv = this.data.inventory.find(i => i.storeId === resv.storeId && i.productId === item.productId);
          if (inv) {
            inv.reservedQuantity = Math.max(0, inv.reservedQuantity - item.quantity);
            inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
            inv.updatedAt = new Date().toISOString();
          }
        }
        resv.status = 'EXPIRED';
        resv.releaseReason = 'Reservation expired (auto-released)';
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.persist();
    }
    return expiredCount;
  }

  public getStoreStock(
    storeId: string,
    productId: string,
    variantId?: string
  ): { available: number; reserved: number; total: number; lowStockThreshold: number } {
    let item = variantId
      ? this.inventoryKeyMap.get(`${storeId}:${productId}:${variantId}`)
      : null;

    if (!item) {
      item = this.inventoryKeyMap.get(`${storeId}:${productId}:`);
    }
    if (!item && variantId) {
      item = this.data.inventory.find(i => i.storeId === storeId && i.productId === productId);
    }
    if (!item) {
      item = this.data.inventory.find(i => i.storeId === storeId && i.productId === productId);
    }

    if (!item) {
      return { available: 0, reserved: 0, total: 0, lowStockThreshold: 5 };
    }
    const available = Math.max(0, item.quantity - (item.reservedQuantity || 0));
    item.availableQuantity = available;
    return { available, reserved: item.reservedQuantity || 0, total: item.quantity, lowStockThreshold: item.lowStockThreshold || 5 };
  }

  /**
   * Atomically reserve stock for checkout with TTL (default 10 minutes)
   * Validates availableQuantity >= requestedQuantity before incrementing reservedQuantity
   */
  public createReservation(
    userId: string,
    storeId: string,
    items: { productId: string; variantId?: string; quantity: number }[],
    ttlMinutes: number = 10
  ): { success: boolean; reservation?: InventoryReservation; reason?: string; outOfStockItem?: string } {
    this.sweepExpiredReservations();

    // Helper to find inventory item
    const findInv = (storeId: string, productId: string, variantId?: string) => {
      let inv = variantId
        ? this.data.inventory.find(i => i.storeId === storeId && i.productId === productId && i.variantId === variantId)
        : null;
      if (!inv) {
        inv = this.data.inventory.find(i => i.storeId === storeId && i.productId === productId && !i.variantId);
      }
      if (!inv && variantId) {
        inv = this.data.inventory.find(i => i.storeId === storeId && i.productId === productId);
      }
      return inv;
    };

    // Pass 1: Atomic validation of every requested item & variant
    for (const item of items) {
      const inv = findInv(storeId, item.productId, item.variantId);
      if (!inv) {
        const prod = this.findProductById(item.productId);
        const variant = prod?.variants?.find(v => v.id === item.variantId);
        const label = variant ? `${prod?.name} (${variant.name})` : (prod?.name || item.productId);
        return {
          success: false,
          reason: `Item "${label}" is not stocked at this store.`,
          outOfStockItem: item.variantId || item.productId,
        };
      }
      const available = inv.quantity - (inv.reservedQuantity || 0);
      if (available < item.quantity) {
        const prod = this.findProductById(item.productId);
        const variant = prod?.variants?.find(v => v.id === item.variantId);
        const label = variant ? `${prod?.name} (${variant.name})` : (prod?.name || item.productId);
        return {
          success: false,
          reason: `Insufficient stock for "${label}". Only ${Math.max(0, available)} available, but ${item.quantity} requested.`,
          outOfStockItem: item.variantId || item.productId,
        };
      }
    }

    // Pass 2: Atomically increment reservedQuantity and update availableQuantity
    for (const item of items) {
      const inv = findInv(storeId, item.productId, item.variantId);
      if (inv) {
        inv.reservedQuantity = (inv.reservedQuantity || 0) + item.quantity;
        inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
        inv.updatedAt = new Date().toISOString();
      }
    }

    const reservationId = `resv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const reservation: InventoryReservation = {
      id: reservationId,
      userId,
      storeId,
      items: items.map(i => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      status: 'ACTIVE',
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.data.reservations = this.data.reservations || [];
    this.data.reservations.unshift(reservation);
    this.persist();

    return { success: true, reservation };
  }

  /**
   * Confirms a reservation upon verified payment:
   * Permanently converts reserved stock into deducted inventory
   */
  public confirmReservation(reservationId: string, orderId: string): boolean {
    this.sweepExpiredReservations();
    const resv = this.data.reservations?.find(r => r.id === reservationId);
    if (!resv || resv.status !== 'ACTIVE') {
      return false;
    }

    for (const item of resv.items) {
      let inv = item.variantId
        ? this.data.inventory.find(i => i.storeId === resv.storeId && i.productId === item.productId && i.variantId === item.variantId)
        : null;
      if (!inv) {
        inv = this.data.inventory.find(i => i.storeId === resv.storeId && i.productId === item.productId);
      }
      if (inv) {
        inv.quantity = Math.max(0, inv.quantity - item.quantity);
        inv.reservedQuantity = Math.max(0, (inv.reservedQuantity || 0) - item.quantity);
        inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
        inv.updatedAt = new Date().toISOString();
      }
    }

    resv.status = 'CONFIRMED';
    resv.orderId = orderId;
    this.persist();
    return true;
  }

  /**
   * Manually releases a reservation (e.g. customer cancels checkout or payment gateway rejects)
   */
  public releaseReservation(reservationId: string, reason?: string): boolean {
    const resv = this.data.reservations?.find(r => r.id === reservationId);
    if (!resv || resv.status !== 'ACTIVE') {
      return false;
    }

    for (const item of resv.items) {
      let inv = item.variantId
        ? this.data.inventory.find(i => i.storeId === resv.storeId && i.productId === item.productId && i.variantId === item.variantId)
        : null;
      if (!inv) {
        inv = this.data.inventory.find(i => i.storeId === resv.storeId && i.productId === item.productId);
      }
      if (inv) {
        inv.reservedQuantity = Math.max(0, (inv.reservedQuantity || 0) - item.quantity);
        inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
        inv.updatedAt = new Date().toISOString();
      }
    }

    resv.status = 'RELEASED';
    resv.releaseReason = reason || 'Payment cancelled or abandoned';
    this.persist();
    return true;
  }

  public getReservations(): InventoryReservation[] {
    this.sweepExpiredReservations();
    return this.data.reservations || [];
  }

  public getReservation(reservationId: string): InventoryReservation | undefined {
    this.sweepExpiredReservations();
    return this.data.reservations?.find(r => r.id === reservationId);
  }

  public reserveInventory(storeId: string, items: { productId: string; variantId?: string; quantity: number }[]): boolean {
    const res = this.createReservation('anon_checkout', storeId, items, 10);
    return res.success;
  }

  public releaseInventory(storeId: string, items: { productId: string; variantId?: string; quantity: number }[]) {
    for (const item of items) {
      let inv = item.variantId
        ? this.data.inventory.find(i => i.storeId === storeId && i.productId === item.productId && i.variantId === item.variantId)
        : null;
      if (!inv) {
        inv = this.data.inventory.find(i => i.storeId === storeId && i.productId === item.productId);
      }
      if (inv) {
        inv.reservedQuantity = Math.max(0, (inv.reservedQuantity || 0) - item.quantity);
        inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
        inv.updatedAt = new Date().toISOString();
      }
    }
    this.persist();
  }

  public deductInventory(storeId: string, items: { productId: string; variantId?: string; quantity: number }[]) {
    for (const item of items) {
      let inv = item.variantId
        ? this.data.inventory.find(i => i.storeId === storeId && i.productId === item.productId && i.variantId === item.variantId)
        : null;
      if (!inv) {
        inv = this.data.inventory.find(i => i.storeId === storeId && i.productId === item.productId);
      }
      if (inv) {
        inv.quantity = Math.max(0, inv.quantity - item.quantity);
        inv.reservedQuantity = Math.max(0, (inv.reservedQuantity || 0) - item.quantity);
        inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
        inv.updatedAt = new Date().toISOString();
      }
    }
    this.persist();
  }

  public updateStockLevel(storeId: string, productId: string, newTotalQuantity: number, variantId?: string) {
    let inv = variantId
      ? this.data.inventory.find(i => i.storeId === storeId && i.productId === productId && i.variantId === variantId)
      : null;
    if (!inv && !variantId) {
      inv = this.data.inventory.find(i => i.storeId === storeId && i.productId === productId && !i.variantId);
    }

    if (inv) {
      inv.quantity = Math.max(0, newTotalQuantity);
      inv.availableQuantity = Math.max(0, inv.quantity - (inv.reservedQuantity || 0));
      inv.updatedAt = new Date().toISOString();
    } else {
      this.data.inventory.push({
        id: `inv_${storeId}_${productId}${variantId ? `_${variantId}` : ''}`,
        storeId,
        productId,
        variantId,
        quantity: Math.max(0, newTotalQuantity),
        reservedQuantity: 0,
        availableQuantity: Math.max(0, newTotalQuantity),
        lowStockThreshold: 5,
        updatedAt: new Date().toISOString(),
      });
    }
    this.persist();
  }

  // --- INVOICE GENERATION ---
  public generateInvoiceNumber(): string {
    const currentYear = new Date().getFullYear();
    this.data.invoiceSequence = (this.data.invoiceSequence || 1000) + 1;
    const seqStr = String(this.data.invoiceSequence).padStart(6, '0');
    this.persist();
    return `DRK-${currentYear}-${seqStr}`;
  }

  // --- ORDER METHODS ---
  public createOrder(order: Order): Order {
    if (!order.invoiceNumber) {
      order.invoiceNumber = this.generateInvoiceNumber();
    }
    if (!order.invoiceDate) {
      order.invoiceDate = order.createdAt;
    }
    if (!order.paymentState) {
      order.paymentState = order.paymentStatus === 'completed' ? 'PAID' : 'PENDING';
    }

    // If order was created from a reservation, confirm the reservation and deduct inventory
    if (order.reservationId) {
      this.confirmReservation(order.reservationId, order.id);
    } else {
      // Legacy fallback: deduct inventory directly
      this.deductInventory(
        order.storeId,
        order.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      );
    }

    this.data.orders.unshift(order);
    this.logAudit(
      order.userId,
      order.userName,
      'customer',
      'ORDER_CREATED',
      'Order',
      order.id,
      `Order ${order.orderNumber} (Invoice: ${order.invoiceNumber}) created for ₹${order.totalAmount}`
    );
    this.createNotification({
      id: `notif_${Date.now()}`,
      userId: order.userId,
      title: '🛒 Order Placed Successfully!',
      message: `Your order #${order.orderNumber} (Invoice: ${order.invoiceNumber}) for ₹${order.totalAmount} has been confirmed. Delivery in ~${order.estimatedDeliveryTime}.`,
      type: 'order',
      isRead: false,
      link: `/orders/${order.id}`,
      createdAt: new Date().toISOString(),
    });
    this.persist();
    return order;
  }

  public findOrderById(id: string): Order | undefined {
    return this.orderMap.get(id) || this.data.orders.find(o => o.id === id);
  }

  public findOrderByInvoice(invoiceNumber: string): Order | undefined {
    return this.data.orders.find(
      o => o.invoiceNumber?.toUpperCase() === invoiceNumber.toUpperCase() || o.orderNumber === invoiceNumber
    );
  }

  /**
   * Cancellation & Refund with strict eligibility check
   * Allowed: PLACED, CONFIRMED, PREPARING
   * Disallowed: OUT_FOR_DELIVERY, DELIVERED, CANCELLED
   */
  public cancelOrder(
    orderId: string,
    reasonCategory: CancellationDetails['reasonCategory'],
    customExplanation?: string,
    actor?: { id: string; name: string; role: string }
  ): { success: boolean; order?: Order; message: string; isPaidOnline?: boolean } {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    const eligibleStatuses: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING'];
    if (!eligibleStatuses.includes(order.status)) {
      if (order.status === 'OUT_FOR_DELIVERY') {
        return {
          success: false,
          message: 'Order cannot be cancelled because the delivery rider is already on the way with your package.',
        };
      }
      if (order.status === 'DELIVERED') {
        return {
          success: false,
          message: 'Delivered orders cannot be cancelled.',
        };
      }
      if (order.status === 'CANCELLED') {
        return {
          success: false,
          message: 'Order is already cancelled.',
        };
      }
      return {
        success: false,
        message: `Order with status "${order.status}" is not eligible for cancellation.`,
      };
    }

    // Set cancellation details
    order.status = 'CANCELLED';
    order.cancellationReason = `${reasonCategory}${customExplanation ? ': ' + customExplanation : ''}`;
    order.cancellationDetails = {
      reasonCategory,
      customExplanation,
      cancelledAt: new Date().toISOString(),
      cancelledBy: actor || {
        id: order.userId,
        name: order.userName,
        role: 'customer',
      },
    };

    order.statusTimeline.push({
      status: 'CANCELLED',
      timestamp: new Date().toISOString(),
      note: `Cancelled (${reasonCategory}): ${customExplanation || 'Customer request'}`,
    });

    // Restore sold inventory idempotently back to store stock
    if (!(order as any).inventoryRestoredOnCancel) {
      for (const item of order.items) {
        const inv = this.data.inventory.find(i => i.storeId === order.storeId && i.productId === item.productId);
        if (inv) {
          inv.quantity += item.quantity;
          inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
          inv.updatedAt = new Date().toISOString();
        }
      }
      (order as any).inventoryRestoredOnCancel = true;
    }

    // If reservation was still active, release it
    if (order.reservationId) {
      this.releaseReservation(order.reservationId, `Order ${order.orderNumber} cancelled`);
    }

    const isPaidOnline =
      order.paymentState === 'PAID' ||
      (order.paymentStatus === 'completed' && order.paymentMethod !== 'cod');

    if (isPaidOnline) {
      order.paymentState = 'REFUND_PENDING';
      order.refundDetails = {
        amount: order.totalAmount,
        reason: `Cancellation: ${reasonCategory}`,
        status: 'REFUND_PENDING',
        initiatedAt: new Date().toISOString(),
      };
    } else {
      order.paymentState = 'CANCELLED';
    }

    order.updatedAt = new Date().toISOString();

    this.logAudit(
      actor?.id || order.userId,
      actor?.name || order.userName,
      actor?.role || 'customer',
      'ORDER_CANCELLED',
      'Order',
      order.id,
      `Order cancelled (${reasonCategory}). Total: ₹${order.totalAmount}`
    );

    this.createNotification({
      id: `notif_${Date.now()}`,
      userId: order.userId,
      title: '❌ Order Cancelled',
      message: isPaidOnline
        ? `Order #${order.orderNumber} has been cancelled. A 100% refund of ₹${order.totalAmount} has been initiated to your original payment method.`
        : `Order #${order.orderNumber} has been cancelled.`,
      type: 'order',
      isRead: false,
      link: `/orders/${order.id}`,
      createdAt: new Date().toISOString(),
    });

    this.persist();
    return { success: true, order, message: 'Order successfully cancelled.', isPaidOnline };
  }

  public updateRefundDetails(orderId: string, refundDetails: RefundDetails): Order | null {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.refundDetails = refundDetails;
    if (refundDetails.status === 'REFUNDED') {
      order.paymentState = 'REFUNDED';
      order.paymentStatus = 'refunded';
    } else if (refundDetails.status === 'REFUND_FAILED') {
      order.paymentState = 'FAILED';
    } else if (refundDetails.status === 'REFUND_PROCESSING') {
      order.paymentState = 'REFUND_PENDING';
    }
    order.updatedAt = new Date().toISOString();
    this.persist();
    return order;
  }

  public updateOrderStatus(orderId: string, newStatus: OrderStatus, note?: string, actor?: { id: string; name: string; role: string }): Order | null {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    if (newStatus === 'CANCELLED') {
      const res = this.cancelOrder(orderId, 'Other', note, actor);
      return res.order || null;
    }

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    order.statusTimeline.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: note || `Status updated to ${newStatus}`,
    });

    if (newStatus === 'DELIVERED') {
      order.ageVerifiedAtDelivery = true;
      this.createNotification({
        id: `notif_${Date.now()}`,
        userId: order.userId,
        title: '✨ Order Delivered!',
        message: `Order #${order.orderNumber} was successfully delivered. Enjoy responsibly!`,
        type: 'order',
        isRead: false,
        link: `/orders/${order.id}`,
        createdAt: new Date().toISOString(),
      });
    } else if (newStatus === 'OUT_FOR_DELIVERY') {
      this.createNotification({
        id: `notif_${Date.now()}`,
        userId: order.userId,
        title: '🚴 Rider On The Way!',
        message: `Order #${order.orderNumber} is out for delivery with ${order.deliveryAgentName || 'your delivery partner'}. Keep PIN ${order.deliveryOtp} ready!`,
        type: 'order',
        isRead: false,
        link: `/orders/${order.id}`,
        createdAt: new Date().toISOString(),
      });
    }

    if (actor) {
      this.logAudit(actor.id, actor.name, actor.role, 'ORDER_STATUS_UPDATED', 'Order', orderId, `Order status changed to ${newStatus}`);
    }

    this.persist();
    return order;
  }

  public assignOrderRider(orderId: string, riderId: string, riderName: string, riderPhone: string): Order | null {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;
    order.deliveryAgentId = riderId;
    order.deliveryAgentName = riderName;
    order.deliveryAgentPhone = riderPhone;
    if (order.status === 'READY_FOR_PICKUP' || order.status === 'PREPARING' || order.status === 'CONFIRMED') {
      order.status = 'ASSIGNED';
      order.statusTimeline.push({
        status: 'ASSIGNED',
        timestamp: new Date().toISOString(),
        note: `Assigned to delivery agent ${riderName}`,
      });
    }
    this.persist();
    return order;
  }

  // --- WISHLIST ---
  public getWishlist(userId: string): Product[] {
    if (!this.data.wishlists) this.data.wishlists = {};
    const items = this.data.wishlists[userId] || [];
    const products = this.data.products;
    return items
      .map(item => products.find(p => p.id === item.productId))
      .filter((p): p is Product => Boolean(p));
  }

  public addToWishlist(userId: string, productId: string): { success: boolean; wishlist: Product[]; message: string } {
    if (!this.data.wishlists) this.data.wishlists = {};
    if (!this.data.wishlists[userId]) this.data.wishlists[userId] = [];

    const prod = this.findProductById(productId);
    if (!prod) {
      return { success: false, wishlist: this.getWishlist(userId), message: 'Product not found' };
    }

    const alreadyIn = this.data.wishlists[userId].some(item => item.productId === productId);
    if (!alreadyIn) {
      this.data.wishlists[userId].unshift({
        productId,
        userId,
        addedAt: new Date().toISOString(),
      });
      this.persist();
    }
    return {
      success: true,
      wishlist: this.getWishlist(userId),
      message: alreadyIn ? 'Product is already in your wishlist' : 'Added to wishlist',
    };
  }

  public removeFromWishlist(userId: string, productId: string): { success: boolean; wishlist: Product[]; message: string } {
    if (!this.data.wishlists) this.data.wishlists = {};
    if (!this.data.wishlists[userId]) this.data.wishlists[userId] = [];

    this.data.wishlists[userId] = this.data.wishlists[userId].filter(item => item.productId !== productId);
    this.persist();
    return {
      success: true,
      wishlist: this.getWishlist(userId),
      message: 'Removed from wishlist',
    };
  }

  public isInWishlist(userId: string, productId: string): boolean {
    if (!this.data.wishlists || !this.data.wishlists[userId]) return false;
    return this.data.wishlists[userId].some(item => item.productId === productId);
  }

  // --- REVIEWS & RATINGS ---
  public canUserReviewProduct(userId: string, productId: string): {
    eligible: boolean;
    orderId?: string;
    hasPurchased: boolean;
    alreadyReviewed: boolean;
    reason?: string;
  } {
    // 1. Check if user already reviewed this product
    const existingReview = this.data.reviews.find(r => r.userId === userId && r.productId === productId);
    if (existingReview) {
      return {
        eligible: false,
        hasPurchased: true,
        alreadyReviewed: true,
        reason: 'You have already reviewed this product',
      };
    }

    // 2. Check if customer purchased this product in any delivered or completed order
    const eligibleOrders = this.data.orders.filter(o =>
      o.userId === userId &&
      (o.status === 'DELIVERED' || o.status === 'CONFIRMED' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'PLACED') &&
      o.items.some(i => i.productId === productId)
    );

    if (eligibleOrders.length === 0) {
      return {
        eligible: false,
        hasPurchased: false,
        alreadyReviewed: false,
        reason: 'Only customers who have purchased this drink can write a verified review',
      };
    }

    return {
      eligible: true,
      orderId: eligibleOrders[0].id,
      hasPurchased: true,
      alreadyReviewed: false,
    };
  }

  public updateReviewStatus(reviewId: string, status: ReviewStatus): Review | null {
    const rev = this.data.reviews.find(r => r.id === reviewId);
    if (!rev) return null;
    rev.status = status;
    rev.updatedAt = new Date().toISOString();

    // Recalculate product rating considering only published reviews
    const publishedProductReviews = this.data.reviews.filter(r => r.productId === rev.productId && r.status === 'published');
    const prod = this.findProductById(rev.productId);
    if (prod) {
      if (publishedProductReviews.length > 0) {
        const avg = publishedProductReviews.reduce((sum, r) => sum + r.rating, 0) / publishedProductReviews.length;
        prod.rating = Number(avg.toFixed(1));
        prod.reviewCount = publishedProductReviews.length;
      } else {
        prod.rating = 0;
        prod.reviewCount = 0;
      }
    }
    this.persist();
    return rev;
  }

  public deleteReview(reviewId: string): boolean {
    const revIndex = this.data.reviews.findIndex(r => r.id === reviewId);
    if (revIndex === -1) return false;
    const rev = this.data.reviews[revIndex];
    this.data.reviews.splice(revIndex, 1);

    const publishedProductReviews = this.data.reviews.filter(r => r.productId === rev.productId && r.status === 'published');
    const prod = this.findProductById(rev.productId);
    if (prod) {
      if (publishedProductReviews.length > 0) {
        const avg = publishedProductReviews.reduce((sum, r) => sum + r.rating, 0) / publishedProductReviews.length;
        prod.rating = Number(avg.toFixed(1));
        prod.reviewCount = publishedProductReviews.length;
      } else {
        prod.rating = 0;
        prod.reviewCount = 0;
      }
    }
    this.persist();
    return true;
  }

  public addReview(review: Review): Review {
    this.data.reviews.unshift(review);
    // Recalculate product rating
    const productReviews = this.data.reviews.filter(r => r.productId === review.productId);
    const avg = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    const prod = this.findProductById(review.productId);
    if (prod) {
      prod.rating = Number(avg.toFixed(1));
      prod.reviewCount = productReviews.length;
    }
    this.persist();
    return review;
  }

  public createNotification(notif: Notification): Notification {
    this.data.notifications.unshift(notif);
    this.persist();
    return notif;
  }

  public findNotificationById(id: string): Notification | undefined {
    return this.data.notifications.find(x => x.id === id);
  }

  public markNotificationAsRead(id: string): boolean {
    const n = this.data.notifications.find(x => x.id === id);
    if (n) {
      n.isRead = true;
      this.persist();
      return true;
    }
    return false;
  }

  // --- TOKEN REVOCATION ---
  public revokeToken(token: string) {
    if (!this.data.revokedTokens) this.data.revokedTokens = [];
    if (!this.data.revokedTokens.includes(token)) {
      this.data.revokedTokens.push(token);
      this.persist();
    }
  }

  public isTokenRevoked(token: string): boolean {
    if (!this.data.revokedTokens) return false;
    return this.data.revokedTokens.includes(token);
  }

  // --- SUPPORT TICKETS ---
  public getSupportTickets(): SupportTicket[] {
    return this.data.supportTickets || [];
  }

  public findSupportTicketById(id: string): SupportTicket | undefined {
    return (this.data.supportTickets || []).find(t => t.id === id);
  }

  public getUserSupportTickets(userId: string): SupportTicket[] {
    return (this.data.supportTickets || []).filter(t => t.userId === userId);
  }

  public createSupportTicket(ticket: SupportTicket): SupportTicket {
    if (!this.data.supportTickets) this.data.supportTickets = [];
    this.data.supportTickets.unshift(ticket);
    this.logAudit(ticket.userId, ticket.userName, 'customer', 'SUPPORT_TICKET_CREATED', 'SupportTicket', ticket.id, `Created ticket ${ticket.ticketNumber}: ${ticket.subject}`);
    this.persist();
    return ticket;
  }

  public addSupportTicketMessage(ticketId: string, message: SupportTicketMessage, newStatus?: SupportTicket['status']): SupportTicket | null {
    if (!this.data.supportTickets) return null;
    const ticket = this.data.supportTickets.find(t => t.id === ticketId);
    if (!ticket) return null;
    ticket.messages.push(message);
    ticket.updatedAt = new Date().toISOString();
    if (newStatus) {
      ticket.status = newStatus;
    }
    this.persist();
    return ticket;
  }

  public updateSupportTicketStatus(ticketId: string, status: SupportTicket['status'], actor?: { id: string; name: string; role: string }): SupportTicket | null {
    if (!this.data.supportTickets) return null;
    const ticket = this.data.supportTickets.find(t => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    if (actor) {
      this.logAudit(actor.id, actor.name, actor.role, 'SUPPORT_TICKET_STATUS_UPDATED', 'SupportTicket', ticket.id, `Status updated to ${status}`);
    }
    this.persist();
    return ticket;
  }

  public saveToFile() {
    this.persist();
  }

  // --- COUPON METHODS ---
  public findCouponById(id: string): Coupon | undefined {
    return this.data.coupons.find(c => c.id === id);
  }

  public findCouponByCode(code: string): Coupon | undefined {
    return this.data.coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
  }

  public createCoupon(coupon: Coupon): Coupon {
    this.data.coupons.unshift(coupon);
    this.persist();
    return coupon;
  }

  public updateCoupon(id: string, updates: Partial<Coupon>): Coupon | null {
    const idx = this.data.coupons.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.data.coupons[idx] = { ...this.data.coupons[idx], ...updates };
    this.persist();
    return this.data.coupons[idx];
  }

  public deleteCoupon(id: string): boolean {
    const prevLen = this.data.coupons.length;
    this.data.coupons = this.data.coupons.filter(c => c.id !== id);
    this.persist();
    return this.data.coupons.length < prevLen;
  }

  // --- COMPLIANCE & AUDIT ---
  public updateComplianceSettings(settings: Partial<PlatformComplianceSettings>, actor?: { id: string; name: string }): PlatformComplianceSettings {
    this.data.complianceSettings = { ...this.data.complianceSettings, ...settings };
    if (actor) {
      this.logAudit(actor.id, actor.name, 'admin', 'COMPLIANCE_UPDATED', 'Compliance', 'settings', JSON.stringify(settings));
    }
    this.persist();
    return this.data.complianceSettings;
  }

  public logAudit(userId: string, userName: string, role: string, action: string, entity: string, entityId: string, details: string) {
    this.data.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId,
      userName,
      role,
      action,
      entity,
      entityId,
      details,
    });
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
  }
}

export const db = new DatabaseManager();
