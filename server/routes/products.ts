import { Router } from 'express';
import { db } from '../db/database.ts';

const router = Router();

// GET all categories
router.get('/categories', (req, res) => {
  const categories = db.getCategories();
  const products = db.getProducts();

  const enriched = categories.map(cat => ({
    ...cat,
    itemCount: products.filter(p => p.categoryId === cat.id && p.isActive).length,
  }));

  res.json({ success: true, data: enriched });
});

// GET all brands
router.get('/brands', (req, res) => {
  const brands = db.getBrands();
  res.json({ success: true, data: brands });
});

// GET search suggestions (for quick-commerce search popup: "whis...", shows Whisky, Whisky under 2000, Brands)
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

  const allProducts = db.getProducts().filter(p => p.isActive);
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

  // Generate relevant search phrase completions
  const querySet = new Set<string>();
  // 1. Check popular queries that match
  popularQueries.forEach(pq => {
    if (pq.toLowerCase().includes(q)) querySet.add(pq);
  });
  // 2. Add matching brand names
  brands.forEach(b => querySet.add(b.name));
  // 3. Add top matching product names as suggested queries
  products.slice(0, 4).forEach(p => querySet.add(p.name));
  // 4. Check category contextual completions
  if (q.includes('bee') || q.includes('lag') || q.includes('ale')) {
    querySet.add('Chilled Beer 6-Pack');
    querySet.add('Craft Wheat Beer');
  } else if (q.includes('whi') || q.includes('sco') || q.includes('malt')) {
    querySet.add('Single Malt Whisky');
    querySet.add('Blended Scotch');
    querySet.add('Whisky under ₹3000');
  } else if (q.includes('gin') || q.includes('ton')) {
    querySet.add('London Dry Gin');
    querySet.add('Gin & Tonic Combo');
  }

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

// GET products list with location-aware store inventory
router.get('/', (req, res) => {
  const {
    q,
    category,
    subcategory,
    brand,
    storeId,
    minPrice,
    maxPrice,
    minRating,
    availableOnly,
    isAlcoholic,
    bestsellersOnly,
    featuredOnly,
    newArrivalsOnly,
    sort,
    limit,
    offset,
  } = req.query;

  let products = db.getProducts().filter(p => p.isActive);

  // Search query across name, brand, category, and tags
  if (q) {
    const term = String(q).toLowerCase();
    products = products.filter(
      p =>
        p.name.toLowerCase().includes(term) ||
        p.brandName.toLowerCase().includes(term) ||
        p.categoryName.toLowerCase().includes(term) ||
        p.subcategory.toLowerCase().includes(term) ||
        p.volume.toLowerCase().includes(term) ||
        p.variants?.some(v => v.volume.toLowerCase().includes(term) || v.name.toLowerCase().includes(term)) ||
        p.tastingNotes.some(t => t.toLowerCase().includes(term))
    );
  }

  // Category filter
  if (category) {
    products = products.filter(p => p.categoryId === category || p.categoryName.toLowerCase() === String(category).toLowerCase());
  }

  // Subcategory filter
  if (subcategory) {
    products = products.filter(p => p.subcategory.toLowerCase() === String(subcategory).toLowerCase());
  }

  // Brand filter
  if (brand) {
    products = products.filter(p => p.brandId === brand || p.brandName.toLowerCase() === String(brand).toLowerCase());
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

  // Rating / availability filters
  if (minRating) {
    products = products.filter(p => p.rating >= Number(minRating));
  }
  if (availableOnly === 'true') {
    products = products.filter(p => p.inStock !== false);
  }

  // Flags
  if (bestsellersOnly === 'true') {
    products = products.filter(p => p.isBestseller);
  }
  if (featuredOnly === 'true') {
    products = products.filter(p => p.isFeatured);
  }
  if (newArrivalsOnly === 'true') {
    products = products.filter(p => p.isNewArrival);
  }

  // Attach authoritative store stock and hide products not catalogued for the selected store.
  const targetStoreId = String(storeId || 'store_noida_sec18');
  const targetStore = db.getStores().find(s => s.id === targetStoreId);
  if (!targetStore) {
    return res.status(400).json({ success: false, message: 'Invalid store selection' });
  }
  products = products.filter(product => {
    const stateAllowed = !product.availableStates?.length || product.availableStates.includes(targetStore.state);
    const stock = db.getStoreStock(targetStoreId, product.id);
    return stateAllowed && stock.exists;
  });
  const enrichedProducts = products.map(product => {
    const stockInfo = db.getStoreStock(targetStoreId, product.id);
    return {
      ...product,
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
    // Default: bestsellers & featured first
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

  // Suggested pairings (mixers, snacks, ice)
  const pairings = db
    .getProducts()
    .filter(p => {
      if (!p.isActive) return false;
      if (!(p.categoryId === 'cat_mixers' || p.categoryId === 'cat_snacks' || p.categoryId.startsWith('cat_party'))) return false;
      const pairingStock = db.getStoreStock(storeId, p.id);
      return pairingStock.exists && pairingStock.available > 0;
    })
    .slice(0, 6);

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

export default router;
