import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.ts';
import { ProductRequest, Product } from '../types.ts';

const router = Router();

// Store staff or Admin submits a new product request
router.post('/', authenticate, requireRole(['staff', 'admin']), (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const {
    productName,
    brandName,
    categoryId,
    categoryName,
    description,
    variant,
    volumeOrWeight,
    imageUrl,
    suggestedSku,
    notes,
    storeId,
  } = req.body;

  if (!productName || !brandName || !categoryId) {
    return res.status(400).json({
      success: false,
      message: 'Product name, brand name, and category are required.',
    });
  }

  // Resolve store
  const targetStoreId = user.role === 'admin'
    ? (storeId || 'store_noida_sec18')
    : (user.assignedStoreId || 'store_noida_sec18');
  const store = db.getStores().find(s => s.id === targetStoreId);
  const storeName = store?.name || targetStoreId;

  const category = db.getCategories().find(c => c.id === categoryId);
  const resolvedCategoryName = categoryName || category?.name || 'General';

  const newRequest: ProductRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    storeId: targetStoreId,
    storeName,
    requestedByUserId: user.id,
    requestedByUserName: user.name,
    productName: productName.trim(),
    brandName: brandName.trim(),
    categoryId,
    categoryName: resolvedCategoryName,
    description: description ? description.trim() : '',
    variant: variant ? variant.trim() : '',
    volumeOrWeight: volumeOrWeight ? volumeOrWeight.trim() : 'Standard',
    imageUrl: imageUrl || '',
    suggestedSku: suggestedSku ? suggestedSku.trim() : '',
    notes: notes ? notes.trim() : '',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createProductRequest(newRequest);
  db.logAudit(
    user.id,
    user.name,
    user.role,
    'PRODUCT_REQUESTED',
    'ProductRequest',
    newRequest.id,
    `Requested new catalogue product "${newRequest.productName}" for store ${storeName}`
  );

  res.status(201).json({
    success: true,
    message: 'Product request submitted to Admin catalog team for approval.',
    data: newRequest,
  });
});

// GET all product requests (Staff sees their store, Admin sees all)
router.get('/', authenticate, requireRole(['staff', 'admin']), (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let requests = db.getProductRequests();

  if (user.role === 'staff' && user.assignedStoreId) {
    requests = requests.filter(r => r.storeId === user.assignedStoreId);
  }

  res.json({
    success: true,
    data: requests,
  });
});

// Admin approves product request and adds to global catalogue + provisions requesting store
router.post('/:id/approve', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const request = db.getProductRequests().find(r => r.id === req.params.id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Product request not found' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
  }

  const { price, mrp, initialStock, adminNotes } = req.body;

  const basePrice = Number(price) || 299;
  const baseMrp = Number(mrp) || Math.round(basePrice * 1.15);
  const stockQty = Number(initialStock) || 25;

  const slug = request.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const isAlcoholic = request.categoryId.includes('whisky') ||
    request.categoryId.includes('beer') ||
    request.categoryId.includes('vodka') ||
    request.categoryId.includes('rum') ||
    request.categoryId.includes('gin') ||
    request.categoryId.includes('wine') ||
    request.categoryId.includes('brandy') ||
    request.categoryId.includes('tequila');

  const newProduct: Product = {
    id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: request.productName,
    slug,
    brandId: `b_${request.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    brandName: request.brandName,
    categoryId: request.categoryId,
    categoryName: request.categoryName,
    subcategory: request.variant || 'Standard',
    price: basePrice,
    mrp: baseMrp,
    volume: request.volumeOrWeight || 'Standard',
    alcoholByVolume: isAlcoholic ? 40 : 0,
    isAlcoholic,
    description: request.description || `${request.productName} by ${request.brandName}`,
    tastingNotes: ['Quality Verified', 'Micro-Warehouse Fulfilled'],
    imageUrl: request.imageUrl || '',
    imageVerified: Boolean(request.imageUrl),
    imageStatus: request.imageUrl ? 'VALID' : 'MISSING_IMAGE',
    country: 'India',
    rating: 4.8,
    reviewCount: 0,
    isActive: true,
    status: 'ACTIVE',
    sku: request.suggestedSku || `SKU-${Date.now().toString().slice(-6)}`,
    createdBy: admin.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Create global product and provision stock for requesting store
  db.createProduct(newProduct, [
    { storeId: request.storeId, stock: stockQty, lowStockThreshold: 5 }
  ]);

  db.updateProductRequest(request.id, {
    status: 'APPROVED',
    adminNotes: adminNotes || 'Approved and provisioned in requesting store catalog.',
    reviewedByUserId: admin.id,
    reviewedByUserName: admin.name,
    createdProductId: newProduct.id,
  });

  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'PRODUCT_REQUEST_APPROVED',
    'Product',
    newProduct.id,
    `Approved product request for "${newProduct.name}" and provisioned ${stockQty} units for store ${request.storeName}`
  );

  res.json({
    success: true,
    message: `Product request approved! "${newProduct.name}" has been added to the global catalogue.`,
    data: {
      product: newProduct,
      request: db.getProductRequests().find(r => r.id === request.id),
    },
  });
});

// Admin rejects product request
router.post('/:id/reject', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const request = db.getProductRequests().find(r => r.id === req.params.id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Product request not found' });
  }

  const { adminNotes } = req.body;

  const updated = db.updateProductRequest(request.id, {
    status: 'REJECTED',
    adminNotes: adminNotes || 'Does not comply with state distribution requirements.',
    reviewedByUserId: admin.id,
    reviewedByUserName: admin.name,
  });

  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'PRODUCT_REQUEST_REJECTED',
    'ProductRequest',
    request.id,
    `Rejected product request "${request.productName}" for store ${request.storeName}`
  );

  res.json({
    success: true,
    message: 'Product request rejected.',
    data: updated,
  });
});

export default router;
