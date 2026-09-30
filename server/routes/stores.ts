import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { DeliveryEstimationService } from '../services/deliveryEstimate.ts';
import { authenticate, optionalAuth, requireRole, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// GET all stores
router.get('/', (req, res) => {
  const stores = db.getStores();
  res.json({ success: true, data: stores });
});

// GET delivery zones
router.get('/zones', (req, res) => {
  const zones = db.getDeliveryZones();
  res.json({ success: true, data: zones });
});

// Resolve nearest store by location (lat/lon or postalCode)
router.get('/nearest', (req, res) => {
  const { lat, lon, postalCode } = req.query;

  const stores = db.getStores();
  let selectedStore = stores[0]; // fallback
  let distanceKm = 2.4;

  if (postalCode) {
    const matchedZone = db.getDeliveryZones().find(z => z.postalCodes.includes(String(postalCode)));
    if (matchedZone) {
      const store = stores.find(s => s.id === matchedZone.associatedStoreId);
      if (store) {
        selectedStore = store;
      }
    }
  }

  if (lat && lon) {
    const latNum = parseFloat(String(lat));
    const lonNum = parseFloat(String(lon));
    if (!isNaN(latNum) && !isNaN(lonNum)) {
      const nearest = DeliveryEstimationService.findNearestStore(stores, latNum, lonNum);
      if (nearest) {
        selectedStore = nearest.store;
        distanceKm = nearest.distanceKm;
      }
    }
  }

  const estimate = DeliveryEstimationService.estimateDelivery(
    selectedStore,
    parseFloat(String(lat)) || selectedStore.latitude + 0.015,
    parseFloat(String(lon)) || selectedStore.longitude + 0.012
  );

  res.json({
    success: true,
    data: {
      store: selectedStore,
      deliveryEstimate: estimate,
      serviceRadiusKm: selectedStore.serviceRadiusKm,
      isServiceable: estimate.isDeliverable,
    },
  });
});

// GET single store with inventory breakdown
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const store = db.getStores().find(s => s.id === req.params.id);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  // Enforce staff store boundary: Staff can only access internal inventory for their assigned store
  if (req.user && req.user.role === 'staff' && req.user.assignedStoreId && req.user.assignedStoreId !== store.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Store staff cannot view internal inventory for an unauthorized store.',
      errorCode: 'FORBIDDEN_STORE_MISMATCH',
    });
  }

  const inventory = db.getInventory().filter(i => i.storeId === store.id);
  const products = db.getProducts();

  const inventoryDetails = inventory.map(inv => {
    const prod = products.find(p => p.id === inv.productId);
    return {
      ...inv,
      productName: prod?.name || 'Unknown',
      brandName: prod?.brandName || '',
      categoryName: prod?.categoryName || '',
      price: inv.storePrice !== undefined ? inv.storePrice : (prod?.price || 0),
      mrp: prod?.mrp || 0,
      volume: prod?.volume || '',
      sku: prod?.sku || `SKU-${inv.productId.slice(-6)}`,
      imageUrl: prod?.imageUrl || '',
      imageVerified: prod?.imageVerified,
      imageStatus: prod?.imageStatus,
      isAvailable: inv.isAvailable !== false,
      lowStockThreshold: inv.lowStockThreshold !== undefined ? inv.lowStockThreshold : 5,
      available: Math.max(0, inv.quantity - inv.reservedQuantity),
    };
  });

  res.json({
    success: true,
    data: {
      store,
      inventory: inventoryDetails,
    },
  });
});

// Store staff / Admin adds existing global product to store inventory
router.post('/:storeId/inventory', authenticate, requireRole(['staff', 'admin']), (req: AuthRequest, res: Response) => {
  const { storeId } = req.params;
  const { productId, quantity, lowStockThreshold, isAvailable, storePrice } = req.body;
  const user = req.user!;

  if (!productId || quantity === undefined) {
    return res.status(400).json({ success: false, message: 'productId and quantity are required.' });
  }

  // Strict Store Staff RBAC
  if (user.role === 'staff' && user.assignedStoreId && user.assignedStoreId !== storeId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Store staff cannot add inventory to an unauthorized store.',
      errorCode: 'FORBIDDEN_STORE_MISMATCH',
    });
  }

  const product = db.findProductById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found in global catalogue.' });
  }

  const store = db.getStores().find(s => s.id === storeId);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found.' });
  }

  const inv = db.addProductToStoreInventory(storeId, productId, {
    quantity: Number(quantity),
    lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
    isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
    storePrice: storePrice !== undefined ? Number(storePrice) : undefined,
  });

  db.logAudit(
    user.id,
    user.name,
    user.role,
    'STORE_PRODUCT_ADDED',
    'StoreInventory',
    `${storeId}_${productId}`,
    `${user.name} added "${product.name}" with ${quantity} stock to store ${store.name}`
  );

  res.status(201).json({
    success: true,
    message: `Added "${product.name}" to ${store.name} inventory.`,
    data: inv,
  });
});

// Store staff / Admin updates store-specific inventory item (stock, low stock threshold, availability)
router.patch('/:storeId/inventory/:productId', authenticate, requireRole(['staff', 'admin']), (req: AuthRequest, res: Response) => {
  const { storeId, productId } = req.params;
  const user = req.user!;

  // Strict Store Staff RBAC
  if (user.role === 'staff' && user.assignedStoreId && user.assignedStoreId !== storeId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Store staff cannot modify inventory for an unauthorized store.',
      errorCode: 'FORBIDDEN_STORE_MISMATCH',
    });
  }

  const product = db.findProductById(productId);
  const updated = db.updateStoreInventoryItem(storeId, productId, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Inventory record not found in this store.' });
  }

  db.logAudit(
    user.id,
    user.name,
    user.role,
    'STORE_INVENTORY_UPDATED',
    'StoreInventory',
    `${storeId}_${productId}`,
    `${user.name} updated store inventory for "${product?.name || productId}"`
  );

  res.json({
    success: true,
    message: 'Store inventory updated successfully.',
    data: updated,
  });
});

// Store staff / Admin removes a product from store inventory
router.delete('/:storeId/inventory/:productId', authenticate, requireRole(['staff', 'admin']), (req: AuthRequest, res: Response) => {
  const { storeId, productId } = req.params;
  const user = req.user!;

  // Strict Store Staff RBAC
  if (user.role === 'staff' && user.assignedStoreId && user.assignedStoreId !== storeId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Store staff cannot remove inventory from an unauthorized store.',
      errorCode: 'FORBIDDEN_STORE_MISMATCH',
    });
  }

  const product = db.findProductById(productId);
  const success = db.removeProductFromStoreInventory(storeId, productId);
  if (!success) {
    return res.status(404).json({ success: false, message: 'Product not catalogued in this store.' });
  }

  db.logAudit(
    user.id,
    user.name,
    user.role,
    'STORE_PRODUCT_REMOVED',
    'StoreInventory',
    `${storeId}_${productId}`,
    `${user.name} removed "${product?.name || productId}" from store inventory`
  );

  res.json({
    success: true,
    message: 'Product removed from store inventory.',
  });
});

// Legacy inventory adjustment route
router.post('/inventory/adjust', authenticate, requireRole(['staff', 'admin']), (req: AuthRequest, res: Response) => {
  const { storeId, productId, quantity } = req.body;
  if (!storeId || !productId || quantity === undefined) {
    return res.status(400).json({ success: false, message: 'storeId, productId, and quantity required' });
  }

  const user = req.user!;
  if (user.role === 'staff' && user.assignedStoreId && user.assignedStoreId !== storeId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Store staff cannot adjust inventory for an unauthorized store.',
      errorCode: 'FORBIDDEN_STORE_MISMATCH',
    });
  }

  db.updateStockLevel(storeId, productId, Number(quantity));
  db.logAudit(req.user!.id, req.user!.name, req.user!.role, 'INVENTORY_ADJUSTED', 'StoreInventory', `${storeId}_${productId}`, `Adjusted stock to ${quantity}`);

  res.json({
    success: true,
    message: 'Store inventory adjusted successfully',
    data: db.getStoreStock(storeId, productId),
  });
});

export default router;
