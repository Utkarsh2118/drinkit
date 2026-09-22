import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// GET /api/wishlist - Retrieve customer's saved items with availability status
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const storeId = (req.query.storeId as string) || db.getStores()[0]?.id;
  
  const rawProducts = db.getWishlist(userId);
  const inventory = db.getInventory();

  // Augment with active store stock availability
  const enrichedProducts = rawProducts.map(product => {
    let stock = product.stock || 0;
    if (storeId) {
      const inv = inventory.find(i => i.storeId === storeId && i.productId === product.id);
      if (inv) {
        stock = inv.availableQuantity !== undefined ? inv.availableQuantity : Math.max(0, inv.quantity - (inv.reservedQuantity || 0));
      }
    }
    return {
      ...product,
      stock,
      isAvailable: stock > 0,
      isOutOfStock: stock <= 0,
    };
  });

  res.json({
    success: true,
    data: enrichedProducts,
    count: enrichedProducts.length,
  });
});

// POST /api/wishlist - Add item to customer's wishlist
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: 'Product ID is required',
    });
  }

  const product = db.findProductById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found',
    });
  }

  const result = db.addToWishlist(userId, productId);

  res.json({
    success: true,
    message: result.message,
    data: result.wishlist,
  });
});

// DELETE /api/wishlist/:productId - Remove item from customer's wishlist
router.delete('/:productId', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { productId } = req.params;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: 'Product ID is required',
    });
  }

  const result = db.removeFromWishlist(userId, productId);

  res.json({
    success: true,
    message: result.message,
    data: result.wishlist,
  });
});

export default router;
