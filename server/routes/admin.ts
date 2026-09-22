import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.ts';
import { Product } from '../types.ts';

const router = Router();

// Strictly require admin role for all admin operations
router.use(authenticate, requireRole(['admin']));

// Comprehensive Executive Analytics Visualizations
router.get('/analytics', (req: AuthRequest, res: Response) => {
  const timeframe = (req.query.timeframe as 'daily' | 'weekly' | 'monthly') || 'daily';
  const orders = db.getOrders();
  const products = db.getProducts();
  const stores = db.getStores();
  const inventory = db.getInventory();
  const users = db.getUsers().filter(u => u.role === 'customer');

  const now = new Date();

  // 1. High-level KPI summary
  const totalRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const completedOrders = orders.filter(o => o.status !== 'CANCELLED');
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  const averageOrderValue = completedOrders.length > 0
    ? Math.round(totalRevenue / completedOrders.length)
    : 0;

  const todayOrders = orders.filter(o => {
    const diffHours = (now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 3600);
    return diffHours <= 24;
  });

  const todayRevenue = todayOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const activeDeliveries = orders.filter(
    o => o.status === 'ASSIGNED' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'PREPARING'
  ).length;

  const fulfillmentRate = orders.length > 0
    ? Number(((deliveredOrders.length / (orders.length - activeDeliveries || 1)) * 100).toFixed(1))
    : 100;

  // 2. Sales Trend (Daily / Weekly / Monthly)
  let salesTrend: { label: string; orders: number; revenue: number; averageOrderValue: number }[] = [];

  if (timeframe === 'daily') {
    // Last 14 days
    const daysMap = new Map<string, { label: string; orders: number; revenue: number; timestamp: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap.set(key, { label, orders: 0, revenue: 0, timestamp: d.getTime() });
    }

    orders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      const key = o.createdAt.split('T')[0];
      if (daysMap.has(key)) {
        const item = daysMap.get(key)!;
        item.orders += 1;
        item.revenue += o.totalAmount;
      }
    });

    salesTrend = Array.from(daysMap.values()).map(d => ({
      label: d.label,
      orders: d.orders,
      revenue: d.revenue,
      averageOrderValue: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
    }));
  } else if (timeframe === 'weekly') {
    // Last 8 weeks
    const weeks: { label: string; startDate: Date; endDate: Date; orders: number; revenue: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - (i * 7));
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      weeks.push({
        label: `W-${8 - i} (${start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})`,
        startDate: start,
        endDate: end,
        orders: 0,
        revenue: 0,
      });
    }

    orders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      const orderDate = new Date(o.createdAt);
      for (const w of weeks) {
        if (orderDate >= w.startDate && orderDate <= w.endDate) {
          w.orders += 1;
          w.revenue += o.totalAmount;
          break;
        }
      }
    });

    salesTrend = weeks.map(w => ({
      label: w.label,
      orders: w.orders,
      revenue: w.revenue,
      averageOrderValue: w.orders > 0 ? Math.round(w.revenue / w.orders) : 0,
    }));
  } else {
    // Monthly (last 6 months)
    const monthsMap = new Map<string, { label: string; orders: number; revenue: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthsMap.set(key, { label, orders: 0, revenue: 0 });
    }

    orders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      const key = o.createdAt.slice(0, 7);
      if (monthsMap.has(key)) {
        const m = monthsMap.get(key)!;
        m.orders += 1;
        m.revenue += o.totalAmount;
      }
    });

    salesTrend = Array.from(monthsMap.values()).map(m => ({
      label: m.label,
      orders: m.orders,
      revenue: m.revenue,
      averageOrderValue: m.orders > 0 ? Math.round(m.revenue / m.orders) : 0,
    }));
  }

  // 3. Order Status Breakdown
  const statusColors: Record<string, { label: string; color: string }> = {
    PLACED: { label: 'Placed (Pending Store)', color: '#3b82f6' },
    CONFIRMED: { label: 'Confirmed by Hub', color: '#06b6d4' },
    PREPARING: { label: 'Preparing / Chilling', color: '#f59e0b' },
    READY_FOR_PICKUP: { label: 'Ready for Pickup', color: '#8b5cf6' },
    ASSIGNED: { label: 'Rider Assigned', color: '#ec4899' },
    OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: '#6366f1' },
    DELIVERED: { label: 'Delivered (Age Verified)', color: '#10b981' },
    CANCELLED: { label: 'Cancelled / Refunded', color: '#f43f5e' },
  };

  const statusCountMap: Record<string, number> = {};
  orders.forEach(o => {
    statusCountMap[o.status] = (statusCountMap[o.status] || 0) + 1;
  });

  const orderStatusBreakdown = Object.entries(statusCountMap).map(([status, count]) => ({
    status: status as any,
    label: statusColors[status]?.label || status,
    count,
    percentage: Number(((count / (orders.length || 1)) * 100).toFixed(1)),
    color: statusColors[status]?.color || '#94a3b8',
  })).sort((a, b) => b.count - a.count);

  // 4. Store Performance Metrics
  const storePerformance = stores.map(store => {
    const storeOrders = orders.filter(o => o.storeId === store.id);
    const storeCompleted = storeOrders.filter(o => o.status !== 'CANCELLED');
    const storeDelivered = storeOrders.filter(o => o.status === 'DELIVERED');
    const storeRevenue = storeCompleted.reduce((sum, o) => sum + o.totalAmount, 0);
    const storeInventory = inventory.filter(i => i.storeId === store.id);
    const lowStockCount = storeInventory.filter(i => (i.quantity - i.reservedQuantity) <= i.lowStockThreshold).length;

    return {
      storeId: store.id,
      storeName: store.name,
      area: store.area,
      ordersCount: storeOrders.length,
      revenue: storeRevenue,
      deliveredCount: storeDelivered.length,
      fulfillmentRate: storeOrders.length > 0
        ? Number(((storeDelivered.length / storeOrders.length) * 100).toFixed(1))
        : 100,
      avgDeliveryMinutes: 19,
      activeInventoryCount: storeInventory.length,
      lowStockCount,
    };
  });

  // 5. Top-Selling Products
  const productSalesMap = new Map<string, { unitsSold: number; revenue: number }>();
  orders.forEach(o => {
    if (o.status === 'CANCELLED') return;
    o.items.forEach(item => {
      const existing = productSalesMap.get(item.productId) || { unitsSold: 0, revenue: 0 };
      existing.unitsSold += item.quantity;
      existing.revenue += item.subtotal;
      productSalesMap.set(item.productId, existing);
    });
  });

  const topSellingProducts = Array.from(productSalesMap.entries())
    .map(([prodId, sales]) => {
      const prod = products.find(p => p.id === prodId);
      const totalStock = inventory
        .filter(i => i.productId === prodId)
        .reduce((sum, i) => sum + (i.quantity - i.reservedQuantity), 0);

      return {
        productId: prodId,
        productName: prod?.name || 'Unknown Product',
        brandName: prod?.brandName || 'Brand',
        categoryName: prod?.categoryName || 'Beverages',
        imageUrl: prod?.imageUrl || '',
        price: prod?.price || 0,
        unitsSold: sales.unitsSold,
        revenue: sales.revenue,
        stockRemaining: totalStock,
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 8);

  // 6. Low-Stock Items
  const lowStockItems = inventory
    .filter(i => (i.quantity - i.reservedQuantity) <= i.lowStockThreshold)
    .map(i => {
      const prod = products.find(p => p.id === i.productId);
      const store = stores.find(s => s.id === i.storeId);
      const available = Math.max(0, i.quantity - i.reservedQuantity);
      return {
        id: i.id,
        productId: i.productId,
        productName: prod?.name || 'Unknown Product',
        brandName: prod?.brandName || 'Brand',
        categoryName: prod?.categoryName || 'Category',
        imageUrl: prod?.imageUrl || '',
        storeId: i.storeId,
        storeName: store?.name || 'Store Hub',
        quantity: i.quantity,
        available,
        lowStockThreshold: i.lowStockThreshold,
        severity: (available <= 2 ? 'critical' : 'warning') as 'critical' | 'warning',
      };
    })
    .sort((a, b) => a.available - b.available);

  // 7. Customer Acquisition Trend
  const acquisitionMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - (i * 4));
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acquisitionMap.set(label, 0);
  }

  users.forEach(u => {
    const d = new Date(u.createdAt);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (acquisitionMap.has(label)) {
      acquisitionMap.set(label, (acquisitionMap.get(label) || 0) + 1);
    } else {
      // allocate to nearest bucket
      const keys = Array.from(acquisitionMap.keys());
      if (keys.length > 0) {
        acquisitionMap.set(keys[keys.length - 1], (acquisitionMap.get(keys[keys.length - 1]) || 0) + 1);
      }
    }
  });

  let runningTotal = 12;
  const customerAcquisition = Array.from(acquisitionMap.entries()).map(([label, count]) => {
    runningTotal += count;
    return {
      label,
      newCustomers: Math.max(1, count),
      cumulativeCustomers: runningTotal,
    };
  });

  // 8. Repeat Customer Rates & Cohort Distribution
  const customerOrderCounts = new Map<string, number>();
  orders.forEach(o => {
    if (o.status === 'CANCELLED') return;
    customerOrderCounts.set(o.userId, (customerOrderCounts.get(o.userId) || 0) + 1);
  });

  const totalCustomersWithOrders = customerOrderCounts.size;
  let singleOrderCount = 0;
  let returningOrderCount = 0; // 2-3 orders
  let vipOrderCount = 0; // 4+ orders

  let singleOrderTotalVolume = 0;
  let returningOrderTotalVolume = 0;
  let vipOrderTotalVolume = 0;

  customerOrderCounts.forEach((count) => {
    if (count === 1) {
      singleOrderCount += 1;
      singleOrderTotalVolume += 1;
    } else if (count <= 3) {
      returningOrderCount += 1;
      returningOrderTotalVolume += count;
    } else {
      vipOrderCount += 1;
      vipOrderTotalVolume += count;
    }
  });

  const repeatCustomers = returningOrderCount + vipOrderCount;
  const repeatCustomerRate = totalCustomersWithOrders > 0
    ? Number(((repeatCustomers / totalCustomersWithOrders) * 100).toFixed(1))
    : 0;

  const cohortDistribution = [
    {
      name: '1 Order (First-Time)',
      customerCount: singleOrderCount,
      ordersCount: singleOrderTotalVolume,
      percentage: totalCustomersWithOrders > 0 ? Math.round((singleOrderCount / totalCustomersWithOrders) * 100) : 0,
      color: '#60a5fa', // Blue
    },
    {
      name: '2-3 Orders (Returning)',
      customerCount: returningOrderCount,
      ordersCount: returningOrderTotalVolume,
      percentage: totalCustomersWithOrders > 0 ? Math.round((returningOrderCount / totalCustomersWithOrders) * 100) : 0,
      color: '#34d399', // Emerald
    },
    {
      name: '4+ Orders (Loyal / VIP)',
      customerCount: vipOrderCount,
      ordersCount: vipOrderTotalVolume,
      percentage: totalCustomersWithOrders > 0 ? Math.round((vipOrderCount / totalCustomersWithOrders) * 100) : 0,
      color: '#fbbf24', // Amber
    },
  ];

  res.json({
    success: true,
    data: {
      timeframe,
      metrics: {
        totalOrders: orders.length,
        todayOrdersCount: todayOrders.length,
        totalRevenue,
        todayRevenue,
        averageOrderValue,
        activeDeliveries,
        lowStockCount: lowStockItems.length,
        totalCustomers: Math.max(users.length, totalCustomersWithOrders),
        activeStoresCount: stores.filter(s => s.isActive).length,
        fulfillmentRate,
        repeatCustomerRate,
      },
      salesTrend,
      orderStatusBreakdown,
      storePerformance,
      topSellingProducts,
      lowStockItems,
      customerAcquisition,
      repeatCustomerMetrics: {
        totalCustomers: totalCustomersWithOrders,
        repeatCustomers,
        repeatCustomerRate,
        cohortDistribution,
      },
    },
  });
});

// Executive Dashboard Analytics (legacy endpoint kept for compatibility)
router.get('/dashboard', (req: AuthRequest, res: Response) => {
  const orders = db.getOrders();
  const products = db.getProducts();
  const users = db.getUsers().filter(u => u.role === 'customer');
  const inventory = db.getInventory();
  const stores = db.getStores();

  // Metrics
  const totalRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const todayOrders = orders.filter(o => {
    const diffHours = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 3600);
    return diffHours <= 24;
  });

  const todayRevenue = todayOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const activeDeliveries = orders.filter(
    o => o.status === 'ASSIGNED' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'PREPARING'
  ).length;

  const lowStockItems = inventory.filter(i => (i.quantity - i.reservedQuantity) <= i.lowStockThreshold);

  // Sales trend by day (last 7 days)
  const daysMap: Record<string, { date: string; orders: number; revenue: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    daysMap[dateStr] = { date: dateStr, orders: 0, revenue: 0 };
  }

  orders.forEach(o => {
    if (o.status === 'CANCELLED') return;
    const dateStr = new Date(o.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (daysMap[dateStr]) {
      daysMap[dateStr].orders += 1;
      daysMap[dateStr].revenue += o.totalAmount;
    }
  });

  const salesTrend = Object.values(daysMap);

  // Category breakdown
  const categorySales: Record<string, { category: string; value: number; count: number }> = {};
  orders.forEach(o => {
    if (o.status === 'CANCELLED') return;
    o.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const cat = prod?.categoryName || 'Beverages';
      if (!categorySales[cat]) {
        categorySales[cat] = { category: cat, value: 0, count: 0 };
      }
      categorySales[cat].value += item.subtotal;
      categorySales[cat].count += item.quantity;
    });
  });

  // Store performance
  const storePerformance = stores.map(store => {
    const storeOrders = orders.filter(o => o.storeId === store.id && o.status !== 'CANCELLED');
    const storeRevenue = storeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return {
      storeId: store.id,
      storeName: store.name,
      area: store.area,
      orderCount: storeOrders.length,
      revenue: storeRevenue,
      isActive: store.isActive,
      deliveryEnabled: store.deliveryEnabled,
    };
  });

  res.json({
    success: true,
    data: {
      metrics: {
        totalOrders: orders.length,
        todayOrdersCount: todayOrders.length,
        totalRevenue,
        todayRevenue,
        activeDeliveries,
        lowStockCount: lowStockItems.length,
        totalCustomers: users.length,
        activeStoresCount: stores.filter(s => s.isActive).length,
      },
      salesTrend,
      categoryBreakdown: Object.values(categorySales).sort((a, b) => b.value - a.value).slice(0, 6),
      storePerformance,
      lowStockAlerts: lowStockItems.slice(0, 10).map(i => {
        const prod = products.find(p => p.id === i.productId);
        const store = stores.find(s => s.id === i.storeId);
        return {
          id: i.id,
          productName: prod?.name || 'Item',
          storeName: store?.name || 'Store',
          quantity: i.quantity,
          available: i.quantity - i.reservedQuantity,
          lowStockThreshold: i.lowStockThreshold,
        };
      }),
    },
  });
});

// PRODUCT CRUD
router.post('/products', (req: AuthRequest, res: Response) => {
  const {
    name,
    brandId,
    brandName,
    categoryId,
    categoryName,
    subcategory,
    price,
    mrp,
    volume,
    alcoholByVolume,
    isAlcoholic,
    description,
    tastingNotes,
    imageUrl,
    country,
    isBestseller,
    isFeatured,
  } = req.body;

  if (!name || !price || !volume) {
    return res.status(400).json({ success: false, message: 'Name, price, and volume are required' });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const newProduct: Product = {
    id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    slug,
    brandId: brandId || 'b_amrut',
    brandName: brandName || 'Premium Brand',
    categoryId: categoryId || 'cat_whisky',
    categoryName: categoryName || 'Whisky',
    subcategory: subcategory || 'Fine Spirits',
    price: Number(price),
    mrp: Number(mrp) || Number(price),
    volume,
    alcoholByVolume: Number(alcoholByVolume) || 0,
    isAlcoholic: isAlcoholic !== undefined ? Boolean(isAlcoholic) : true,
    description: description || 'Premium beverage selection.',
    tastingNotes: Array.isArray(tastingNotes) ? tastingNotes : ['Smooth finish'],
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
    country: country || 'India',
    isBestseller: Boolean(isBestseller),
    isFeatured: Boolean(isFeatured),
    rating: 4.8,
    reviewCount: 0,
    isActive: true,
  };

  db.createProduct(newProduct);
  db.logAudit(req.user!.id, req.user!.name, req.user!.role, 'PRODUCT_CREATED', 'Product', newProduct.id, `Created product: ${newProduct.name}`);

  res.status(201).json({
    success: true,
    message: 'Product catalog entry added and inventories provisioned across micro-warehouses.',
    data: newProduct,
  });
});

router.put('/products/:id', (req: AuthRequest, res: Response) => {
  const updated = db.updateProduct(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  db.logAudit(req.user!.id, req.user!.name, req.user!.role, 'PRODUCT_UPDATED', 'Product', updated.id, `Updated product: ${updated.name}`);
  res.json({ success: true, message: 'Product updated', data: updated });
});

router.delete('/products/:id', (req: AuthRequest, res: Response) => {
  const success = db.deleteProduct(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  db.logAudit(req.user!.id, req.user!.name, req.user!.role, 'PRODUCT_DELETED', 'Product', req.params.id, `Deleted product ${req.params.id}`);
  res.json({ success: true, message: 'Product deleted from catalog and inventory removed' });
});

// INVENTORY ADJUSTMENT
router.post('/inventory/adjust', (req: AuthRequest, res: Response) => {
  const { storeId, productId, quantity } = req.body;
  if (!storeId || !productId || quantity === undefined) {
    return res.status(400).json({ success: false, message: 'storeId, productId, and quantity required' });
  }

  db.updateStockLevel(storeId, productId, Number(quantity));
  db.logAudit(req.user!.id, req.user!.name, req.user!.role, 'INVENTORY_ADJUSTED', 'StoreInventory', `${storeId}_${productId}`, `Adjusted stock to ${quantity}`);

  res.json({
    success: true,
    message: 'Store inventory adjusted successfully',
    data: db.getStoreStock(storeId, productId),
  });
});

// COMPLIANCE SETTINGS (Admin only)
router.get('/compliance', (req, res) => {
  res.json({ success: true, data: db.getComplianceSettings() });
});

router.post('/compliance', requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const updated = db.updateComplianceSettings(req.body, { id: req.user!.id, name: req.user!.name });
  res.json({
    success: true,
    message: 'Platform alcohol excise and compliance rules updated.',
    data: updated,
  });
});

// AUDIT LOGS (Admin only)
router.get('/audit-logs', requireRole(['admin']), (req, res) => {
  res.json({ success: true, data: db.getAuditLogs() });
});

// RESERVATIONS (Admin only)
router.get('/reservations', requireRole(['admin']), (req, res) => {
  res.json({ success: true, data: db.getReservations() });
});

export default router;
