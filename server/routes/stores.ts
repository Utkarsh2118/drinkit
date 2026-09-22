import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { DeliveryEstimationService } from '../services/deliveryEstimate.ts';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.ts';

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
router.get('/:id', (req, res) => {
  const store = db.getStores().find(s => s.id === req.params.id);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
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
      price: prod?.price || 0,
      imageUrl: prod?.imageUrl || '',
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

// Store staff / Admin inventory adjustment
router.post('/inventory/adjust', authenticate, requireRole(['staff', 'admin']), (req: AuthRequest, res: Response) => {
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

export default router;
