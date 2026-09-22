import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Review, ReviewStatus } from '../types.ts';

const router = Router();

// GET reviews for a product with pagination, ratings breakdown, and average
router.get('/product/:productId', (req, res) => {
  const { productId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 10));

  const allReviews = db.getReviews();
  const productReviews = allReviews.filter(
    r => r.productId === productId && (r.status === 'published' || !r.status)
  );

  const totalReviews = productReviews.length;
  const totalPages = Math.ceil(totalReviews / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedReviews = productReviews.slice(startIndex, startIndex + limit);

  // Rating distribution: 1 to 5 stars
  const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;

  for (const rev of productReviews) {
    const star = Math.min(5, Math.max(1, Math.round(rev.rating)));
    distribution[star] = (distribution[star] || 0) + 1;
    ratingSum += rev.rating;
  }

  const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 0;

  res.json({
    success: true,
    data: {
      reviews: paginatedReviews,
      pagination: {
        page,
        limit,
        totalReviews,
        totalPages,
        hasMore: page < totalPages,
      },
      analytics: {
        averageRating,
        totalReviews,
        distribution,
      },
    },
  });
});

// GET customer review eligibility for a product
router.get('/eligibility/:productId', authenticate, (req: AuthRequest, res: Response) => {
  const { productId } = req.params;
  const user = req.user!;

  const check = db.canUserReviewProduct(user.id, productId);
  res.json({
    success: true,
    data: check,
  });
});

// POST review (Customer verified purchase & validation)
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const { productId, rating, title, comment } = req.body;
  const user = req.user!;

  if (!productId || rating === undefined || !comment) {
    return res.status(400).json({
      success: false,
      message: 'Product, rating (1-5 stars), and review comment are required',
    });
  }

  const parsedRating = Number(rating);
  if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be a valid number between 1 and 5 stars',
    });
  }

  // Verify eligibility and check if already reviewed
  const eligibility = db.canUserReviewProduct(user.id, productId);
  if (!eligibility.eligible) {
    return res.status(400).json({
      success: false,
      message: eligibility.reason || 'You are not eligible to review this product',
      errorCode: eligibility.alreadyReviewed ? 'ALREADY_REVIEWED' : 'NOT_PURCHASED',
    });
  }

  const product = db.findProductById(productId);

  const newReview: Review = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    productId,
    productName: product?.name,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    orderId: eligibility.orderId,
    rating: Math.round(parsedRating),
    title: title ? String(title).trim() : 'Customer Review',
    comment: String(comment).trim(),
    isVerifiedPurchase: true,
    verifiedPurchase: true,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.addReview(newReview);

  res.status(201).json({
    success: true,
    message: 'Thank you! Your verified review has been published.',
    data: newReview,
  });
});

// ADMIN: Get all reviews with status filters, search, and pagination
router.get('/admin/all', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const status = req.query.status as ReviewStatus | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

  let reviews = db.getReviews();
  if (status && ['published', 'pending', 'hidden', 'flagged'].includes(status)) {
    reviews = reviews.filter(r => r.status === status);
  }

  const total = reviews.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = reviews.slice((page - 1) * limit, page * limit);

  res.json({
    success: true,
    data: {
      reviews: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  });
});

// ADMIN: Moderate review status (publish, hide, flag)
router.put('/admin/:id/status', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['published', 'pending', 'hidden', 'flagged'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be one of: published, pending, hidden, flagged',
    });
  }

  const updated = db.updateReviewStatus(id, status as ReviewStatus);
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  db.logAudit(
    req.user!.id,
    req.user!.name,
    req.user!.role,
    'REVIEW_MODERATED',
    'Review',
    id,
    `Moderated review ${id} to status: ${status}`
  );

  res.json({
    success: true,
    message: `Review marked as ${status}`,
    data: updated,
  });
});

// ADMIN: Delete a review permanently
router.delete('/admin/:id', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const deleted = db.deleteReview(id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  db.logAudit(
    req.user!.id,
    req.user!.name,
    req.user!.role,
    'REVIEW_DELETED',
    'Review',
    id,
    `Deleted review ${id}`
  );

  res.json({
    success: true,
    message: 'Review deleted successfully',
  });
});

export default router;
