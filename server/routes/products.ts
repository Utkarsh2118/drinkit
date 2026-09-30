import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { partyBundleService } from '../services/partyBundleService.ts';
import { authenticate, optionalAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { productUpload, deleteUploadedImage } from '../utils/upload.ts';
import { Product, ProductStatus } from '../types.ts';

const router = Router();

// GET all categories
router.get('/categories', (req, res) => {
  const storeId = String(req.query.storeId || 'store_noida_sec18');
  const store = db.getStores().find(s => s.id === storeId);
  const categories = db.getCategories();
  const products = db.getProducts();

  const enriched = categories.map(cat => ({
    ...cat,
    itemCount: products.filter(p => {
      if (!p.isActive || p.isArchived || p.status === 'ARCHIVED' || p.categoryId !== cat.id) return false;
      if (store && p.availableStates?.length && !p.availableStates.includes(store.state)) return false;
      return db.getInventory().some(i => i.storeId === storeId && i.productId === p.id);
    }).length,
  }));

  res.json({ success: true, data: enriched });
});

// GET all brands
router.get('/brands', (req, res) => {
  const brands = db.getBrands();
  res.json({ success: true, data: brands });
});

// GET search suggestions (for quick-commerce search popup)
router.get('/suggestions', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();

  const popularQueries = [
    'Bira 91 White',
    'Kingfisher Ultra',
    'Corona Extra Chilled',
    'Single Malt Whisky',
    'Glenfiddich 12',
    'Bombay Sapphire Gin',
    'Svami Artisanal Tonic',
    'Chilled Beer 6-Pack',
    'Whisky under ₹2500',
    'Bar Snacks & Peanuts',
  ];

  if (!q) {
    return res.json({
      success: true,
      data: {
        categories: [],
        brands: [],
        products: [],
        quickQueries: ['Whisky under ₹2500', 'Chilled Beer Packs', 'London Dry Gin', 'Single Malts', 'Zero-Alcohol Beers'],
        popularQueries,
      },
    });
  }

  const allProducts = db.getProducts().filter(p => p.isActive && !p.isArchived && p.status !== 'ARCHIVED');
  const categories = db
    .getCategories()
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 3)
    .map(c => ({ id: c.id, name: c.name, type: 'category' }));

  const brands = db
    .getBrands()
    .filter(b => b.name.toLowerCase().includes(q))
    .slice(0, 3)
    .map(b => ({ id: b.id, name: b.name, type: 'brand' }));

  const products = allProducts
    .filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.categoryName?.toLowerCase().includes(q) ||
        p.subcategory?.toLowerCase().includes(q) ||
        p.volume?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.variants?.some(v => v.volume.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)) ||
        p.tastingNotes?.some(t => t.toLowerCase().includes(q))
    )
    .slice(0, 6)
    .map(p => ({
      id: p.id,
      name: p.name,
      brandName: p.brandName,
      price: p.price,
      mrp: p.mrp,
      volume: p.volume,
      imageUrl: p.imageUrl,
      alcoholByVolume: p.alcoholByVolume,
      isAlcoholic: p.isAlcoholic,
      type: 'product',
    }));

  const querySet = new Set<string>();
  popularQueries.forEach(pq => {
    if (pq.toLowerCase().includes(q)) querySet.add(pq);
  });
  brands.forEach(b => querySet.add(b.name));
  products.slice(0, 4).forEach(p => querySet.add(p.name));

  res.json({
    success: true,
    data: {
      categories,
      brands,
      products,
      quickQueries: Array.from(querySet).slice(0, 5),
      popularQueries,
    },
  });
});

// GET dynamic party bundles for store
router.get('/bundles', (req, res) => {
  const storeId = String(req.query.storeId || 'store_noida_sec18');
  const bundles = partyBundleService.getBundlesForStore(storeId);
  res.json({ success: true, data: bundles });
});

// GET smart pairings for a product in store
router.get('/pairings/:id', (req, res) => {
  const storeId = String(req.query.storeId || 'store_noida_sec18');
  const pairings = partyBundleService.getSmartPairings(req.params.id, storeId);
  res.json({ success: true, data: pairings });
});

// POST upload product image directly (Multer, for Add Product modal & preview)
router.post(
  '/upload-image',
  authenticate as any,
  requireRole(['admin', 'staff']) as any,
  productUpload.single('image') as any,
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const publicUrl = `/uploads/products/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Product image uploaded successfully.',
      imageUrl: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }
);

// GET products list with location-aware store inventory (or global catalog for admin/staff management)
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const {
    q,
    category,
    subcategory,
    brand,
    storeId,
    status,
    minPrice,
    maxPrice,
    minRating,
    availableOnly,
    isAlcoholic,
    bestsellersOnly,
    featuredOnly,
    newArrivalsOnly,
    includeInactive,
    manage,
    sort,
    limit,
    offset,
  } = req.query;

  const isManagementQuery = manage === 'true' || includeInactive === 'true';
  let allProducts = db.getProducts();

  // For regular customer queries, exclude archived and inactive products
  if (!isManagementQuery) {
    allProducts = allProducts.filter(p => p.isActive && !p.isArchived && p.status !== 'ARCHIVED');
  }

  let products = allProducts;

  // Search query across name, brand, category, subcategory, SKU, and tags
  if (q) {
    const term = String(q).toLowerCase();
    products = products.filter(
      p =>
        p.name.toLowerCase().includes(term) ||
        p.brandName.toLowerCase().includes(term) ||
        p.categoryName.toLowerCase().includes(term) ||
        p.subcategory.toLowerCase().includes(term) ||
        p.volume.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.variants?.some(v => v.volume.toLowerCase().includes(term) || v.name.toLowerCase().includes(term)) ||
        p.tastingNotes?.some(t => t.toLowerCase().includes(term))
    );
  }

  // Category filter
  if (category) {
    products = products.filter(
      p => p.categoryId === category || p.categoryName.toLowerCase() === String(category).toLowerCase()
    );
  }

  // Subcategory filter
  if (subcategory) {
    products = products.filter(p => p.subcategory.toLowerCase() === String(subcategory).toLowerCase());
  }

  // Brand filter
  if (brand) {
    products = products.filter(
      p => p.brandId === brand || p.brandName.toLowerCase() === String(brand).toLowerCase()
    );
  }

  // Status filter (ACTIVE, INACTIVE, ARCHIVED, OUT_OF_STOCK)
  if (status) {
    products = products.filter(p => {
      const pStatus = p.status || (p.isArchived ? 'ARCHIVED' : (p.isActive ? 'ACTIVE' : 'INACTIVE'));
      return pStatus === status;
    });
  }

  // Alcohol filter
  if (isAlcoholic !== undefined) {
    const boolVal = isAlcoholic === 'true';
    products = products.filter(p => p.isAlcoholic === boolVal);
  }

  // Price range
  if (minPrice) {
    products = products.filter(p => p.price >= Number(minPrice));
  }
  if (maxPrice) {
    products = products.filter(p => p.price <= Number(maxPrice));
  }

  // Rating filter
  if (minRating) {
    products = products.filter(p => p.rating >= Number(minRating));
  }

  // If management mode (Admin / Store Manager product catalogue), attach global stock & store information
  if (isManagementQuery) {
    const enriched = products.map(product => {
      const allStoreInv = db.getInventory().filter(i => i.productId === product.id);
      const totalStock = allStoreInv.reduce((sum, inv) => sum + inv.quantity, 0);
      const currentStatus: ProductStatus = product.isArchived
        ? 'ARCHIVED'
        : (!product.isActive ? 'INACTIVE' : (totalStock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE'));

      const imageStatus = !product.imageUrl
        ? 'MISSING_IMAGE'
        : (product.imageStatus || (product.imageVerified ? 'VALID' : 'UNVERIFIED'));

      return {
        ...product,
        status: currentStatus,
        stock: totalStock,
        inStock: totalStock > 0,
        imageStatus,
        storeInventoryCount: allStoreInv.length,
      };
    });

    const pageLimit = Number(limit) || 150;
    const pageOffset = Number(offset) || 0;
    const paginated = enriched.slice(pageOffset, pageOffset + pageLimit);

    return res.json({
      success: true,
      data: {
        items: paginated,
        totalCount: enriched.length,
      },
    });
  }

  // Customer scope: Attach authoritative store stock & filter by store jurisdiction
  const targetStoreId = String(storeId || 'store_noida_sec18');
  const targetStore = db.getStores().find(s => s.id === targetStoreId);
  if (!targetStore) {
    return res.status(400).json({ success: false, message: 'Invalid store selection' });
  }

  products = products.filter(product => {
    const stateAllowed = !product.availableStates?.length || product.availableStates.includes(targetStore.state);
    const storeInv = db.getInventory().find(i => i.storeId === targetStoreId && i.productId === product.id);
    return stateAllowed && storeInv !== undefined && storeInv.isAvailable !== false;
  });

  const enrichedProducts = products.map(product => {
    const stockInfo = db.getStoreStock(targetStoreId, product.id);
    const storeInv = db.getInventory().find(i => i.storeId === targetStoreId && i.productId === product.id);
    return {
      ...product,
      price: storeInv?.storePrice || product.price,
      stock: stockInfo.available,
      inStock: stockInfo.available > 0,
      storeId: targetStoreId,
    };
  });

  // Sorting
  if (sort === 'price-low') {
    enrichedProducts.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-high') {
    enrichedProducts.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    enrichedProducts.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'newest') {
    enrichedProducts.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0));
  } else {
    enrichedProducts.sort((a, b) => {
      const scoreA = (a.isBestseller ? 2 : 0) + (a.isFeatured ? 1 : 0);
      const scoreB = (b.isBestseller ? 2 : 0) + (b.isFeatured ? 1 : 0);
      return scoreB - scoreA;
    });
  }

  const pageLimit = Number(limit) || 100;
  const pageOffset = Number(offset) || 0;
  const paginated = enrichedProducts.slice(pageOffset, pageOffset + pageLimit);

  res.json({
    success: true,
    data: {
      items: paginated,
      totalCount: enrichedProducts.length,
      storeId: targetStoreId,
    },
  });
});

// GET single product details
router.get('/:id', (req, res) => {
  const product = db.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const storeId = String(req.query.storeId || 'store_noida_sec18');
  const stockInfo = db.getStoreStock(storeId, product.id);
  const reviews = db.getReviews().filter(r => r.productId === product.id);
  const pairings = partyBundleService.getSmartPairings(product.id, storeId);

  res.json({
    success: true,
    data: {
      ...product,
      stock: stockInfo.available,
      inStock: stockInfo.available > 0,
      storeId,
      reviews,
      pairings,
    },
  });
});

// POST Admin creates new product
router.post('/', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
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
    weight,
    packSize,
    sku,
    barcode,
    alcoholByVolume,
    isAlcoholic,
    description,
    shortDescription,
    tastingNotes,
    imageUrl,
    country,
    isBestseller,
    isFeatured,
    availableStates,
    availableCities,
    isActive,
    storeInventory,
  } = req.body;

  if (!name || price === undefined || !volume) {
    return res.status(400).json({
      success: false,
      message: 'Product Name, Price, and Volume/Weight are required.',
    });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const now = new Date().toISOString();

  const newProduct: Product = {
    id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    slug,
    brandId: brandId || `b_${(brandName || 'Brand').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    brandName: brandName || 'Brand',
    categoryId: categoryId || 'cat_whisky',
    categoryName: categoryName || 'Beverages',
    subcategory: subcategory || 'Standard',
    price: Number(price),
    mrp: mrp ? Number(mrp) : Math.round(Number(price) * 1.15),
    volume: volume.trim(),
    weight: weight ? weight.trim() : undefined,
    packSize: packSize ? packSize.trim() : undefined,
    sku: sku ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
    barcode: barcode ? barcode.trim() : undefined,
    alcoholByVolume: alcoholByVolume !== undefined ? Number(alcoholByVolume) : 0,
    isAlcoholic: isAlcoholic !== undefined ? Boolean(isAlcoholic) : false,
    description: description ? description.trim() : `${name} by ${brandName || 'Brand'}`,
    shortDescription: shortDescription ? shortDescription.trim() : undefined,
    tastingNotes: Array.isArray(tastingNotes) ? tastingNotes : ['Verified Pack'],
    imageUrl: imageUrl || '',
    imageVerified: Boolean(imageUrl),
    imageStatus: imageUrl ? 'VALID' : 'MISSING_IMAGE',
    imageSource: imageUrl ? 'Admin Upload' : undefined,
    country: country || 'India',
    rating: 4.8,
    reviewCount: 0,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    status: isActive !== false ? 'ACTIVE' : 'INACTIVE',
    availableStates: Array.isArray(availableStates) ? availableStates : ['Uttar Pradesh', 'Delhi'],
    availableCities: Array.isArray(availableCities) ? availableCities : ['Noida', 'Lucknow', 'Delhi'],
    createdBy: admin.name,
    createdAt: now,
    updatedAt: now,
  };

  const created = db.createProduct(newProduct, storeInventory);
  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'PRODUCT_CREATED',
    'Product',
    created.id,
    `Admin ${admin.name} created product "${created.name}" (SKU: ${created.sku})`
  );

  res.status(201).json({
    success: true,
    message: `Product "${created.name}" created successfully.`,
    data: created,
  });
});

// PUT / PATCH Admin updates product
router.patch('/:id', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const product = db.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const updates = { ...req.body, updatedBy: admin.name };
  if (updates.name && !updates.slug) {
    updates.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  if (updates.isActive !== undefined && !updates.status) {
    updates.status = updates.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  const updated = db.updateProduct(req.params.id, updates);
  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'PRODUCT_UPDATED',
    'Product',
    req.params.id,
    `Admin ${admin.name} updated product "${product.name}"`
  );

  res.json({
    success: true,
    message: 'Product updated successfully.',
    data: updated,
  });
});

router.put('/:id', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const product = db.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const updates = { ...req.body, updatedBy: admin.name };
  const updated = db.updateProduct(req.params.id, updates);
  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'PRODUCT_UPDATED',
    'Product',
    req.params.id,
    `Admin ${admin.name} updated product "${product.name}"`
  );

  res.json({
    success: true,
    message: 'Product updated successfully.',
    data: updated,
  });
});

// DELETE Admin deletes or archives product
router.delete('/:id', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const product = db.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const result = db.deleteProduct(req.params.id);
  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    result.archived ? 'PRODUCT_ARCHIVED' : 'PRODUCT_DELETED',
    'Product',
    req.params.id,
    `Admin ${admin.name} ${result.archived ? 'archived' : 'permanently deleted'} product "${product.name}"`
  );

  res.json({
    success: true,
    archived: result.archived,
    message: result.message,
  });
});

// POST Admin archives product explicitly
router.post('/:id/archive', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const archived = db.archiveProduct(req.params.id);
  if (!archived) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'PRODUCT_ARCHIVED',
    'Product',
    req.params.id,
    `Admin ${admin.name} archived product "${archived.name}"`
  );

  res.json({
    success: true,
    message: `Product "${archived.name}" has been archived and hidden from the customer storefront.`,
    data: archived,
  });
});

// POST Admin uploads/replaces image for a specific product
router.post(
  '/:id/image',
  authenticate as any,
  requireRole(['admin', 'staff']) as any,
  productUpload.single('image') as any,
  (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const product = db.findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    // Safely delete previous uploaded image if it was in /uploads/products/
    if (product.imageUrl) {
      deleteUploadedImage(product.imageUrl);
    }

    const newImageUrl = `/uploads/products/${req.file.filename}`;
    const updated = db.updateProduct(product.id, {
      imageUrl: newImageUrl,
      imageVerified: true,
      imageStatus: 'VALID',
      imageSource: 'Admin Upload',
      updatedBy: user.name,
    });

    db.logAudit(
      user.id,
      user.name,
      user.role,
      'PRODUCT_IMAGE_UPDATED',
      'Product',
      product.id,
      `${user.role === 'admin' ? 'Admin' : 'Staff'} ${user.name} uploaded new packshot for "${product.name}"`
    );

    res.json({
      success: true,
      message: 'Product image updated successfully.',
      imageUrl: newImageUrl,
      data: updated,
    });
  }
);

// DELETE Admin removes image from product
router.delete('/:id/image', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const product = db.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (product.imageUrl) {
    deleteUploadedImage(product.imageUrl);
  }

  const updated = db.updateProduct(product.id, {
    imageUrl: '',
    imageVerified: false,
    imageStatus: 'MISSING_IMAGE',
    imageSource: 'Image Removed by Admin',
    updatedBy: admin.name,
  });

  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'PRODUCT_IMAGE_REMOVED',
    'Product',
    product.id,
    `Admin ${admin.name} removed image for product "${product.name}"`
  );

  res.json({
    success: true,
    message: 'Product image removed. Product will display "Image unavailable" until a verified packshot is uploaded.',
    data: updated,
  });
});

// GET Admin views inventory breakdown across all stores for this product
router.get('/:id/inventory', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const product = db.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const breakdown = db.getProductInventoryAcrossStores(product.id);
  res.json({
    success: true,
    data: {
      product,
      stores: breakdown,
    },
  });
});

// PUT Admin updates stock across multiple stores for this product
router.put('/:id/inventory', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const admin = req.user!;
  const product = db.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const { stores } = req.body;
  if (!Array.isArray(stores)) {
    return res.status(400).json({ success: false, message: 'stores array is required' });
  }

  db.updateProductInventoryAcrossStores(product.id, stores);
  db.logAudit(
    admin.id,
    admin.name,
    admin.role,
    'INVENTORY_MULTI_UPDATE',
    'Product',
    product.id,
    `Admin ${admin.name} updated stock levels across ${stores.length} micro-warehouses for "${product.name}"`
  );

  res.json({
    success: true,
    message: 'Store inventories updated successfully.',
    data: db.getProductInventoryAcrossStores(product.id),
  });
});

export default router;
