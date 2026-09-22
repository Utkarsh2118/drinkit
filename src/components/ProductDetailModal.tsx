import React, { useState, useEffect, useCallback } from 'react';
import { X, Star, ShieldCheck, Heart, Plus, Minus, Check, MessageSquare, AlertCircle } from 'lucide-react';
import { Product, Review } from '../types.ts';
import { useCart } from '../context/CartContext.tsx';
import { useWishlist } from '../context/WishlistContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user, setIsCustomerAuthModalOpen } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [pairings, setPairings] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [analytics, setAnalytics] = useState<{
    averageRating: number;
    totalReviews: number;
    distribution: { [key: number]: number };
  }>({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    reason?: string;
    alreadyReviewed?: boolean;
    orderId?: string;
  } | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchReviews = useCallback(async (prodId: string, pageNum: number, append: boolean = false) => {
    try {
      setIsLoadingReviews(true);
      const res = await api.get<{
        reviews: Review[];
        pagination: { page: number; totalPages: number; hasMore: boolean; totalReviews: number };
        analytics: { averageRating: number; totalReviews: number; distribution: { [key: number]: number } };
      }>(`/reviews/product/${prodId}?page=${pageNum}&limit=5`);

      if (res && res.reviews) {
        if (append) {
          setReviews(prev => [...prev, ...res.reviews]);
        } else {
          setReviews(res.reviews);
        }
        setHasMore(res.pagination?.hasMore || false);
        if (res.analytics) {
          setAnalytics(res.analytics);
        }
      }
    } catch (err) {
      console.warn('Failed to load reviews:', err);
    } finally {
      setIsLoadingReviews(false);
    }
  }, []);

  const checkEligibility = useCallback(async (prodId: string) => {
    if (!user) {
      setEligibility(null);
      return;
    }
    try {
      const data = await api.get<any>(`/reviews/eligibility/${prodId}`);
      setEligibility(data);
    } catch {
      setEligibility(null);
    }
  }, [user]);

  useEffect(() => {
    if (product) {
      setPage(1);
      setReviewMessage(null);
      fetchReviews(product.id, 1, false);
      checkEligibility(product.id);

      api
        .get<{ pairings: Product[] }>(`/products/${product.id}`)
        .then(data => {
          if (data.pairings) setPairings(data.pairings);
        })
        .catch(() => {});
    }
  }, [product, user, fetchReviews, checkEligibility]);

  if (!product) return null;

  const quantity = getItemQuantity(product.id);
  const isWishlisted = isInWishlist(product.id);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReviews(product.id, nextPage, true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingReview(true);
    setReviewMessage(null);

    try {
      const added = await api.post<Review>('/reviews', {
        productId: product.id,
        rating: newRating,
        title: newTitle.trim() || 'Customer Review',
        comment: newComment.trim(),
      });
      setReviews(prev => [added, ...prev]);
      setNewComment('');
      setNewTitle('');
      setReviewMessage({ type: 'success', text: 'Thank you! Your verified review has been published.' });
      checkEligibility(product.id);
      fetchReviews(product.id, 1, false);
    } catch (err: any) {
      setReviewMessage({ type: 'error', text: err.message || 'Could not submit review.' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{product.categoryName}</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">{product.brandName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Image & Key Attributes */}
            <div className="relative aspect-square bg-slate-50 rounded-2xl p-6 flex items-center justify-center border border-slate-100">
              <img src={product.imageUrl} alt={product.name} className="max-h-full max-w-full object-contain" />
              <button
                onClick={() => toggleWishlist(product)}
                className="absolute top-3 right-3 p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors shadow-xs"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            </div>

            {/* Product Meta */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {product.subcategory}
                </span>
                <span className="text-xs text-slate-500">{product.country}</span>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{product.name}</h2>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">₹{product.price}</span>
                {product.mrp > product.price && (
                  <span className="text-sm text-slate-400 line-through">₹{product.mrp}</span>
                )}
                <span className="text-xs text-emerald-700 font-bold">Inclusive of all taxes</span>
              </div>

              {/* Specs pill row */}
              <div className="grid grid-cols-3 gap-2 py-2">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500">Volume</div>
                  <div className="text-xs font-bold text-slate-900">{product.volume}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500">ABV Strength</div>
                  <div className="text-xs font-bold text-slate-900">
                    {product.isAlcoholic ? `${product.alcoholByVolume}%` : '0.0%'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500">Rating</div>
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{product.rating}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{product.description}</p>

              {/* Tasting Notes */}
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Tasting Profile
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.tastingNotes.map((note, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quantity Action */}
              <div className="pt-3">
                {quantity === 0 ? (
                  <button
                    onClick={() => addItem(product)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>ADD TO BAG • ₹{product.price}</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-emerald-500">
                    <span className="text-xs font-bold text-emerald-800 pl-2">Added to cart</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(product.id, -1)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-black text-slate-900">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, 1)}
                        className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-sm"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Suggested Pairings */}
          {pairings.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <div className="text-sm font-bold text-slate-900 mb-3">Best Paired With (Mixers & Snacks)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pairings.map(p => {
                  const pQty = getItemQuantity(p.id);
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs flex flex-col justify-between"
                    >
                      <img src={p.imageUrl} alt={p.name} className="w-full h-16 object-contain mb-1.5" />
                      <div className="text-[11px] font-bold text-slate-900 line-clamp-1">{p.name}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-black text-slate-900">₹{p.price}</span>
                        {pQty === 0 ? (
                          <button
                            onClick={() => addItem(p)}
                            className="h-6 px-2 rounded-md border border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-700 font-extrabold text-[10px] uppercase tracking-wider transition-colors shadow-xs"
                            title="Add to bag"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="h-6 flex items-center bg-emerald-600 text-white rounded-md px-0.5 shadow-xs">
                            <button
                              onClick={() => updateQuantity(p.id, -1)}
                              className="w-4 h-4 rounded hover:bg-emerald-700 flex items-center justify-center text-white"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
                            </button>
                            <span className="text-[11px] font-black text-white px-1 font-mono">{pQty}</span>
                            <button
                              onClick={() => updateQuantity(p.id, 1)}
                              className="w-4 h-4 rounded hover:bg-emerald-700 flex items-center justify-center text-white"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer Ratings & Reviews Section */}
          <div className="pt-5 border-t border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                <span>Customer Ratings & Reviews ({analytics.totalReviews || reviews.length})</span>
              </h3>
            </div>

            {/* Ratings Analytics Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-4 text-center sm:border-r border-slate-200 sm:pr-4">
                <div className="text-3xl font-black text-slate-900">
                  {analytics.averageRating > 0 ? analytics.averageRating : '4.8'}
                </div>
                <div className="flex justify-center items-center gap-1 my-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.round(analytics.averageRating || 4.8)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Based on {analytics.totalReviews || reviews.length} verified purchases
                </div>
              </div>

              {/* Star Distribution Bars */}
              <div className="sm:col-span-8 space-y-1.5">
                {[5, 4, 3, 2, 1].map(starNum => {
                  const count = analytics.distribution[starNum] || 0;
                  const total = analytics.totalReviews || 1;
                  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={starNum} className="flex items-center gap-2 text-xs">
                      <span className="w-6 font-bold text-slate-600 text-right">{starNum}★</span>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-8 text-[11px] text-slate-500 text-right font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Review Submission Area Based on Eligibility */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              {!user ? (
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Have you tried this drink? Sign in to submit a verified purchase review.</span>
                  </div>
                  <button
                    onClick={() => setIsCustomerAuthModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              ) : eligibility && eligibility.alreadyReviewed ? (
                <div className="flex items-center gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-3 rounded-xl font-medium">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>You have already submitted a verified review for this product. Thank you!</span>
                </div>
              ) : eligibility && !eligibility.eligible ? (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 p-3 rounded-xl font-medium">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Verified Purchase Only: Order this drink on DrinkIt to leave an authentic customer review.</span>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Write a Verified Review</span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Eligible Buyer
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">Rating:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Headline (e.g. Smooth oak finish, perfect for Old Fashioned)"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />

                  <textarea
                    placeholder="Share your detailed thoughts on aroma, taste, balance, and ice pairing..."
                    rows={3}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />

                  {reviewMessage && (
                    <div
                      className={`text-xs p-2.5 rounded-xl font-semibold flex items-center gap-1.5 ${
                        reviewMessage.type === 'success'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : 'bg-rose-100 text-rose-900 border border-rose-200'
                      }`}
                    >
                      {reviewMessage.type === 'success' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                      )}
                      <span>{reviewMessage.text}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingReview || !newComment.trim()}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs"
                    >
                      {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Review list */}
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No verified reviews yet. Be the first to try and review this drink!
                </div>
              ) : (
                reviews.map(r => (
                  <div key={r.id} className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{r.userName}</span>
                        {(r.isVerifiedPurchase || r.verifiedPurchase) && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                            <Check className="w-2.5 h-2.5" /> Verified Purchase
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-slate-700">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                            />
                          ))}
                        </div>
                        <span className="font-bold ml-1">{r.rating}.0</span>
                      </div>
                    </div>
                    {r.title && <h4 className="text-xs font-bold text-slate-900">{r.title}</h4>}
                    <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>
                    <div className="text-[10px] text-slate-400 pt-0.5">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* Pagination / Load more */}
              {hasMore && (
                <div className="text-center pt-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingReviews}
                    className="px-4 py-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200"
                  >
                    {isLoadingReviews ? 'Loading...' : 'Load More Reviews'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
