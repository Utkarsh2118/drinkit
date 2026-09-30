import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Flame,
  ArrowUpDown,
  Tag,
  ShoppingBag,
  Heart,
  Search,
  AlertTriangle,
  MapPin,
  Check,
} from 'lucide-react';
import { Product, Category, Order } from '../types.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { ProductRail } from '../components/ProductRail.tsx';
import { ActiveOrderBanner } from '../components/ActiveOrderBanner.tsx';
import { useLocation } from '../context/LocationContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { api } from '../services/api.ts';

interface PartyBundle {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  items: {
    categorySlot: string;
    product: Product;
    quantity: number;
  }[];
  totalPrice: number;
  totalMrp: number;
  savings: number;
  isAvailable: boolean;
}

interface CustomerHomeProps {
  onSelectProduct: (product: Product) => void;
  onOpenAgeModal: () => void;
  onTrackOrder?: (orderId: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

interface CategoryMeta {
  id: string;
  name: string;
  shortName: string;
  imageUrl: string;
}

const QUICK_COMMERCE_CATEGORIES: CategoryMeta[] = [
  { id: 'all', name: 'Everything', shortName: 'All', imageUrl: '/images/categories/all.webp' },
  { id: 'cat_whisky', name: 'Whisky', shortName: 'Whisky', imageUrl: '/images/categories/whisky.webp' },
  { id: 'cat_beer', name: 'Beer', shortName: 'Beer', imageUrl: '/images/categories/beer.webp' },
  { id: 'cat_vodka', name: 'Vodka', shortName: 'Vodka', imageUrl: '/images/categories/vodka.webp' },
  { id: 'cat_rum', name: 'Rum', shortName: 'Rum', imageUrl: '/images/categories/rum.webp' },
  { id: 'cat_gin', name: 'Gin', shortName: 'Gin', imageUrl: '/images/categories/gin.webp' },
  { id: 'cat_wine', name: 'Wine', shortName: 'Wine', imageUrl: '/images/categories/wine.webp' },
  { id: 'cat_mixers', name: 'Soda & Mixers', shortName: 'Mixers', imageUrl: '/images/categories/mixers.webp' },
  { id: 'cat_water', name: 'Water', shortName: 'Water', imageUrl: '/images/categories/water.webp' },
  { id: 'cat_softdrinks', name: 'Soft Drinks', shortName: 'Soft Drinks', imageUrl: '/images/categories/softdrinks.webp' },
  { id: 'cat_energy', name: 'Energy Drinks', shortName: 'Energy', imageUrl: '/images/categories/energy.webp' },
  { id: 'cat_juices', name: 'Juices', shortName: 'Juices', imageUrl: '/images/categories/juices.webp' },
  { id: 'cat_snacks', name: 'Chips & Namkeen', shortName: 'Snacks', imageUrl: '/images/categories/snacks.webp' },
  { id: 'cat_party_glasses', name: 'Disposable Glasses', shortName: 'Glasses', imageUrl: '/images/categories/party_glasses.webp' },
  { id: 'cat_party_plates', name: 'Disposable Plates', shortName: 'Plates', imageUrl: '/images/categories/party_plates.webp' },
  { id: 'cat_party_napkins', name: 'Napkins', shortName: 'Napkins', imageUrl: '/images/categories/party_napkins.webp' },
  { id: 'cat_party', name: 'Party Essentials', shortName: 'Party', imageUrl: '/images/categories/party.webp' },
];

export const CustomerHome: React.FC<CustomerHomeProps> = ({
  onSelectProduct,
  onOpenAgeModal,
  onTrackOrder,
  searchQuery,
  onClearSearch,
}) => {
  const { activeStore, estimatedDeliveryRange, selectedLocation, isServiceable, openLocationModal } = useLocation();
  const { user } = useAuth();
  const { addMultipleItems, openCartDrawer } = useCart();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [partyBundles, setPartyBundles] = useState<PartyBundle[]>([]);
  const [recentlyAddedBundleId, setRecentlyAddedBundleId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [specialFilter, setSpecialFilter] = useState<'none' | 'bestseller' | 'deals'>('none');
  const [alcoholFilter, setAlcoholFilter] = useState<'all' | 'alcoholic' | 'non-alcoholic'>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price-low' | 'price-high' | 'rating' | 'newest'>('popular');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userPastProducts, setUserPastProducts] = useState<Product[]>([]);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollCatLeft, setCanScrollCatLeft] = useState(false);
  const [canScrollCatRight, setCanScrollCatRight] = useState(true);

  // Check category scroller bounds
  const checkCatScroll = () => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollCatLeft(el.scrollLeft > 10);
    setCanScrollCatRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    checkCatScroll();
    el.addEventListener('scroll', checkCatScroll, { passive: true });
    window.addEventListener('resize', checkCatScroll);
    return () => {
      el.removeEventListener('scroll', checkCatScroll);
      window.removeEventListener('resize', checkCatScroll);
    };
  }, []);

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === 'left' ? -280 : 280,
      behavior: 'smooth',
    });
  };

  // Load categories and party bundles
  useEffect(() => {
    api
      .get<Category[]>(`/products/categories?storeId=${activeStore?.id || 'store_noida_sec18'}`)
      .then(cats => setCategories(cats))
      .catch(() => {});

    api
      .get<PartyBundle[]>(`/products/bundles?storeId=${activeStore?.id || 'store_noida_sec18'}`)
      .then(res => setPartyBundles(res || []))
      .catch(() => {});
  }, [activeStore]);

  const handleAddBundleToCart = (bundle: PartyBundle) => {
    addMultipleItems(bundle.items.map(i => ({ product: i.product, quantity: i.quantity })));
    setRecentlyAddedBundleId(bundle.id);
    setTimeout(() => {
      setRecentlyAddedBundleId(null);
    }, 2500);
    openCartDrawer();
  };

  // Fetch products
  useEffect(() => {
    setIsLoading(true);
    let url = `/products?storeId=${activeStore?.id || 'store_noida_sec18'}&sort=${sortBy}&limit=120`;

    if (selectedCategory !== 'all') {
      url += `&category=${selectedCategory}`;
    }
    if (selectedSubcategory !== 'all') {
      url += `&subcategory=${encodeURIComponent(selectedSubcategory)}`;
    }
    if (alcoholFilter === 'alcoholic') {
      url += `&isAlcoholic=true`;
    } else if (alcoholFilter === 'non-alcoholic') {
      url += `&isAlcoholic=false`;
    }
    if (searchQuery && searchQuery.trim()) {
      url += `&q=${encodeURIComponent(searchQuery.trim())}`;
    }

    api
      .get<{ items: Product[]; totalCount: number }>(url)
      .then(res => {
        setAllProducts(res.items || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedCategory, selectedSubcategory, alcoholFilter, sortBy, activeStore, searchQuery]);

  // Load user past orders for "Buy Again"
  useEffect(() => {
    if (user) {
      api
        .get<Order[]>('/orders')
        .then(orders => {
          if (orders && orders.length > 0) {
            const productIds = new Set<string>();
            orders.forEach(o => o.items?.forEach(i => productIds.add(i.productId)));
            const matched = allProducts.filter(p => productIds.has(p.id));
            if (matched.length > 0) {
              setUserPastProducts(matched);
            }
          }
        })
        .catch(() => {});
    }
  }, [user, allProducts]);

  const activeCategoryObj = categories.find(c => c.id === selectedCategory);

  // Distinct curated horizontal rails
  const chilledBeers = useMemo(
    () => allProducts.filter(p => p.categoryId === 'cat_beer' && p.isActive).slice(0, 10),
    [allProducts]
  );
  const bestSellers = useMemo(
    () => allProducts.filter(p => p.isBestseller && p.isActive).slice(0, 10),
    [allProducts]
  );
  const dealsNearYou = useMemo(
    () =>
      allProducts
        .filter(p => p.mrp > p.price && p.isActive)
        .sort((a, b) => b.mrp - b.price - (a.mrp - a.price))
        .slice(0, 10),
    [allProducts]
  );
  const whiskies = useMemo(
    () => allProducts.filter(p => p.categoryId === 'cat_whisky' && p.isActive).slice(0, 10),
    [allProducts]
  );
  const ginAndSpirits = useMemo(
    () =>
      allProducts
        .filter(
          p =>
            (p.categoryId === 'cat_gin' || p.categoryId === 'cat_tequila' || p.categoryId === 'cat_vodka') &&
            p.isActive
        )
        .slice(0, 10),
    [allProducts]
  );
  const wineCollection = useMemo(
    () =>
      allProducts
        .filter(p => (p.categoryId === 'cat_wine' || p.categoryId === 'cat_sparkling') && p.isActive)
        .slice(0, 10),
    [allProducts]
  );
  const mixersAndSnacks = useMemo(
    () =>
      allProducts
        .filter(
          p =>
            (p.categoryId === 'cat_mixers' ||
              p.categoryId === 'cat_snacks' ||
              p.categoryId === 'cat_softdrinks' ||
              p.categoryId.startsWith('cat_party')) &&
            p.isActive
        )
        .slice(0, 10),
    [allProducts]
  );
  const buyAgainItems = useMemo(() => {
    if (userPastProducts.length > 0) {
      return userPastProducts.slice(0, 10);
    }
    // Fallback repeat favorites
    return allProducts.filter(p => p.isBestseller).slice(0, 8);
  }, [userPastProducts, allProducts]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedSubcategory('all');
    setSpecialFilter('none');
    if (searchQuery && onClearSearch) {
      onClearSearch();
    }
  };

  const handleSelectFilter = (filterType: 'bestseller' | 'deals') => {
    setSpecialFilter(filterType);
    setSelectedCategory('all');
    setSelectedSubcategory('all');
    if (searchQuery && onClearSearch) {
      onClearSearch();
    }
  };

  const handleResetToHome = () => {
    setSelectedCategory('all');
    setSelectedSubcategory('all');
    setSpecialFilter('none');
    setAlcoholFilter('all');
    if (searchQuery && onClearSearch) {
      onClearSearch();
    }
  };

  // Determine if we should show the full category/search grid view OR the homepage rails
  const isFilteredView = searchQuery || selectedCategory !== 'all' || specialFilter !== 'none';

  // Products to show in filtered grid view
  const filteredProducts = useMemo(() => {
    if (specialFilter === 'bestseller') {
      return allProducts.filter(p => p.isBestseller);
    }
    if (specialFilter === 'deals') {
      return allProducts.filter(p => p.mrp > p.price);
    }
    return allProducts;
  }, [allProducts, specialFilter]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 animate-fade-in">
      {/* Active Order Banner (Live Quick-Commerce Tracking) */}
      {onTrackOrder && <ActiveOrderBanner onTrackOrder={onTrackOrder} />}

      {/* ========================================================= */}
      {/* 0. OUTSIDE DELIVERY ZONE BANNER (IF UNSERVICEABLE)       */}
      {/* ========================================================= */}
      {!isServiceable && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-amber-900">
                DrinkIt isn't available at this location yet
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                We're not delivering to <strong>{selectedLocation.label}</strong> yet. You can browse our catalog, or switch your delivery address to our active zones in UP & Delhi NCR.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openLocationModal}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-colors shrink-0 shadow-xs active:scale-95"
          >
            Change Location
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. COMPLIANCE NOTICE */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
        <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          Alcohol availability, minimum age, store licensing and delivery rules depend on the selected jurisdiction and licensed store. Final eligibility is checked again at checkout.
        </p>
      </div>

      {/* ========================================================= */}
      {/* 1. SEARCH ACTIVE NOTIFICATION (IF SEARCHING)             */}
      {/* ========================================================= */}
      {searchQuery && searchQuery.trim() && (
        <div className="flex items-center justify-between p-3.5 bg-white border border-emerald-300 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <Search className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-slate-900">
                Search results for <span className="text-emerald-700 font-extrabold">"{searchQuery}"</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {allProducts.length} item{allProducts.length === 1 ? '' : 's'} available in {activeStore?.name || 'Noida & Delhi NCR'}
              </div>
            </div>
          </div>
          {onClearSearch && (
            <button
              onClick={onClearSearch}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. COMPACT PROMOTIONAL AREA (HERO ALTERNATIVE)           */}
      {/* 1 main banner + 2 compact side tiles (adaptive layout)   */}
      {/* ========================================================= */}
      {!isFilteredView && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Main Primary Promo Banner */}
          <div
            onClick={() => handleSelectCategory('cat_beer')}
            className="lg:col-span-2 cursor-pointer group relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white p-3.5 xs:p-4 sm:p-5 flex items-center justify-between min-h-[145px] xs:min-h-[160px] sm:min-h-[190px] shadow-xs hover:shadow-md transition-all"
          >
            {/* Background subtle radial illumination */}
            <div className="absolute right-0 top-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-[62%] sm:max-w-[65%] flex flex-col justify-between h-full">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 text-emerald-300 text-[9px] xs:text-[10px] font-black uppercase tracking-wider mb-1.5 sm:mb-2 border border-white/10 backdrop-blur-xs">
                  <Zap className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span>20-Min Chilled Delivery</span>
                </div>
                <h3 className="text-base xs:text-lg sm:text-2xl font-black leading-tight tracking-tight text-white font-sans">
                  Everything for the Party
                </h3>
                <p className="text-[11px] xs:text-xs sm:text-sm text-emerald-100/90 mt-1 font-medium line-clamp-2">
                  Browse live store inventory for beers, whisky, mixers, snacks and party essentials
                </p>
              </div>

              <div className="pt-2 sm:pt-3">
                <span className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-white text-emerald-900 font-extrabold text-[11px] sm:text-xs shadow-xs group-hover:bg-emerald-50 transition-colors">
                  <span>Explore Beers</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* Drink Imagery Showcase */}
            <div className="relative shrink-0 flex items-center justify-center pl-2 sm:pr-4">
              <div className="w-24 h-24 xs:w-28 xs:h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-emerald-950/40 p-1 border border-emerald-700/40 shadow-inner">
                <img
                  src="/images/products/beer/corona-extra-330ml.webp"
                  alt="Chilled Beers"
                  className="w-full h-full object-contain rounded-xl group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          </div>

          {/* Compact Side Promotional Tiles (Tablet: 2 cols side-by-side, Desktop: stacked) */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:flex lg:flex-col gap-3">
            {/* Side Tile 1: Single Malt Reserve */}
            <div
              onClick={() => handleSelectCategory('cat_whisky')}
              className="flex-1 cursor-pointer group rounded-2xl bg-gradient-to-r from-amber-900 to-amber-950 text-white p-3.5 flex items-center justify-between shadow-xs hover:shadow-md transition-all border border-amber-800/30"
            >
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 mb-0.5">
                  Single Malt Reserve
                </div>
                <div className="text-sm font-black text-white leading-tight">
                  Craft & Imported Malts
                </div>
                <div className="text-[11px] text-amber-200/80 font-medium mt-0.5">
                  100% Genuine state certified
                </div>
                <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1 mt-1.5">
                  <span>View Whiskies</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-amber-700/40 ml-2 bg-amber-950/60 p-1">
                <img
                  src="/images/products/whisky/royal-stag-deluxe.webp"
                  alt="Whiskies"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Side Tile 2: Artisanal Mixers & Munchies */}
            <div
              onClick={() => handleSelectCategory('cat_mixers')}
              className="flex-1 cursor-pointer group rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white p-3.5 flex items-center justify-between shadow-xs hover:shadow-md transition-all border border-slate-800"
            >
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 mb-0.5">
                  Mixers & Munchies
                </div>
                <div className="text-sm font-black text-white leading-tight">
                  Artisanal Tonics & Soda
                </div>
                <div className="text-[11px] text-slate-300 font-medium mt-0.5">
                  Zero alcohol & party snacks
                </div>
                <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 mt-1.5">
                  <span>Browse Mixers</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-800 ml-2 bg-slate-900/60 p-1">
                <img
                  src="/images/products/drinks/thums-up-750ml.webp"
                  alt="Tonics & Mixers"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SHOP BY CATEGORY (CRITICAL COMPACT SCROLLER)          */}
      {/* Clean circular/squircle image cards with labels below     */}
      {/* ========================================================= */}
      <section className="relative">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Shop by Category
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Explore beers, spirits, wines and mixers
            </p>
          </div>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => handleSelectCategory('all')}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <span>Reset to All</span>
            </button>
          )}
        </div>

        {/* Compact Scroller Container with Desktop Controls */}
        <div className="relative group/cats">
          {canScrollCatLeft && (
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              aria-label="Scroll categories left"
              className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 hover:text-slate-900 items-center justify-center transition-all focus:outline-none"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}

          <div
            ref={categoryScrollRef}
            className="flex items-start gap-2.5 sm:gap-3.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {QUICK_COMMERCE_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none snap-start"
                  title={cat.name}
                >
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-1 bg-white border transition-all flex items-center justify-center overflow-hidden shadow-xs ${
                      isSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-600/25 bg-emerald-50/60 shadow-sm'
                        : 'border-slate-200/90 group-hover:border-slate-300 group-hover:shadow-sm'
                    }`}
                  >
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  </div>
                  <span
                    className={`text-[11px] sm:text-xs text-center font-bold truncate max-w-[72px] sm:max-w-[84px] leading-tight transition-colors ${
                      isSelected ? 'text-emerald-800 font-black' : 'text-slate-700 group-hover:text-slate-900'
                    }`}
                  >
                    {cat.shortName}
                  </span>
                </button>
              );
            })}
          </div>

          {canScrollCatRight && (
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              aria-label="Scroll categories right"
              className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 hover:text-slate-900 items-center justify-center transition-all focus:outline-none"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. IF FILTERED / CATEGORY VIEW: SHOW DETAILED GRID       */}
      {/* ========================================================= */}
      {isFilteredView ? (
        <div className="space-y-4">
          {/* Header for Filtered Collection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetToHome}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Back to All Drinks</span>
                </button>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : specialFilter === 'bestseller'
                  ? 'Best Sellers'
                  : specialFilter === 'deals'
                  ? 'Deals Near You'
                  : activeCategoryObj?.name || 'Category Drinks'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {activeCategoryObj?.description ||
                  `Showing ${filteredProducts.length} drink items in ${activeStore?.name || 'your area'}`}
              </p>
            </div>

            {/* Sort & Quick Alcohol Filter */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap text-xs">
              {/* Alcohol Type Chip */}
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                <button
                  onClick={() => setAlcoholFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
                    alcoholFilter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setAlcoholFilter('alcoholic')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
                    alcoholFilter === 'alcoholic' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  21+ Alcoholic
                </button>
                <button
                  onClick={() => setAlcoholFilter('non-alcoholic')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
                    alcoholFilter === 'non-alcoholic' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mixers & Zero
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="popular">Most Popular</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="newest">New Arrivals</option>
                </select>
              </div>
            </div>
          </div>

          {/* Subcategory Pills (if available) */}
          {activeCategoryObj?.subcategories && activeCategoryObj.subcategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedSubcategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedSubcategory === 'all'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                All {activeCategoryObj.name}
              </button>
              {activeCategoryObj.subcategories.map(sub => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedSubcategory === sub
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3.5 md:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <div key={n} className="h-64 rounded-2xl bg-white animate-pulse border border-slate-200" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl mx-auto">
                🔍
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  No drinks found matching your criteria
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Try clearing your search or switching to another category in the {activeStore?.name || 'hub'}.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleResetToHome}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-extrabold rounded-xl shadow-xs hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Back to All Drinks</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3.5 md:gap-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================= */
        /* 5. PARTY BUNDLES & CONCISE PRODUCT RAILS                  */
        /* ========================================================= */
        <div className="space-y-7 sm:space-y-9">
          {/* Party Bundles & Packs Showcase */}
          {partyBundles.length > 0 && (
            <section className="rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-emerald-500/10 border border-amber-200/90 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider uppercase">
                      Party Commerce
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-800">
                      <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                      1-Click Complete Packs
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1 tracking-tight">
                    Party Bundles & Packs
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Pre-curated party essentials dynamically bundled from {activeStore?.name || 'your local store'} inventory
                  </p>
                </div>
                <div className="text-[11px] text-slate-600 font-bold bg-white/80 border border-amber-200/80 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                  ⚡ Guaranteed delivery in {estimatedDeliveryRange}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {partyBundles.map(bundle => {
                  const isAdded = recentlyAddedBundleId === bundle.id;

                  return (
                    <div
                      key={bundle.id}
                      className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-400 p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black tracking-wide uppercase border border-amber-200">
                            {bundle.badge}
                          </span>
                          {bundle.savings > 0 && (
                            <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Save ₹{bundle.savings}
                            </span>
                          )}
                        </div>

                        <h3 className="font-black text-slate-900 text-base mt-2 group-hover:text-amber-900 transition-colors">
                          {bundle.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                          {bundle.tagline}
                        </p>

                        {/* Items included preview */}
                        <div className="mt-3 space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Pack Includes:
                          </div>
                          <div className="space-y-1">
                            {bundle.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="text-slate-800 font-semibold truncate text-[11px]">
                                    {item.product.name}
                                  </span>
                                </div>
                                <span className="text-slate-500 text-[11px] font-bold">
                                  {item.quantity}x • ₹{item.product.price * item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-black text-slate-900">₹{bundle.totalPrice}</span>
                            {bundle.totalMrp > bundle.totalPrice && (
                              <span className="text-xs text-slate-400 line-through">₹{bundle.totalMrp}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            {bundle.items.reduce((s, i) => s + i.quantity, 0)} items in pack
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddBundleToCart(bundle)}
                          disabled={!bundle.isAvailable}
                          className={`px-3.5 py-2 rounded-xl font-black text-xs transition-all shadow-xs flex items-center gap-1.5 ${
                            isAdded
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Added to Cart!</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Add Pack to Cart</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* RAIL 0: Chilled Beers */}
          <ProductRail
            id="rail-beer"
            title="Chilled Beers"
            subtitle="Ice-cold lagers, craft wheat beers & strong pints • 20-30 min delivery"
            badge="SUPER CHILLED"
            products={chilledBeers}
            onSelectProduct={onSelectProduct}
            onSeeAll={() => handleSelectCategory('cat_beer')}
          />
          {/* RAIL 1: Deals Near You */}
          <ProductRail id="rail-deals" title="Deals Near You" subtitle="Products and prices available at your selected store" products={dealsNearYou} onSelectProduct={onSelectProduct} onSeeAll={() => handleSelectFilter('deals')} />

          {/* RAIL 2: Shop by Category / Best Sellers */}
          <ProductRail
            id="rail-bestsellers"
            title="Best Sellers"
            subtitle="Top trending bottles in your neighbourhood"
            badge="TRENDING"
            products={bestSellers}
            onSelectProduct={onSelectProduct}
            onSeeAll={() => handleSelectFilter('bestseller')}
          />

          {/* RAIL 3: Deals Near You */}
          <ProductRail id="rail-snacks" title="Snacks & Munchies" subtitle="Namkeen, chips and party snacks" products={allProducts.filter(p => p.categoryId === 'cat_snacks').slice(0, 10)} onSelectProduct={onSelectProduct} onSeeAll={() => handleSelectCategory('cat_snacks')} />

          {/* RAIL 4: Whisky & Single Malts */}
          <ProductRail
            id="rail-whisky"
            title="Whisky & Single Malts"
            subtitle="Scotch, Bourbon & Indian single malts"
            products={whiskies}
            onSelectProduct={onSelectProduct}
            onSeeAll={() => handleSelectCategory('cat_whisky')}
          />

          {/* RAIL 5: Gin & Craft Spirits */}
          <ProductRail
            id="rail-gin"
            title="Gin & Craft Spirits"
            subtitle="London dry, botanicals & premium tequila"
            products={ginAndSpirits}
            onSelectProduct={onSelectProduct}
            onSeeAll={() => handleSelectCategory('cat_gin')}
          />

          {/* RAIL 6: Wine Collection */}
          <ProductRail
            id="rail-wine"
            title="Wine Collection"
            subtitle="Red, white & sparkling wines"
            products={wineCollection}
            onSelectProduct={onSelectProduct}
            onSeeAll={() => handleSelectCategory('cat_wine')}
          />

          {/* RAIL 7: Mixers & Party Munchies */}
          <ProductRail id="rail-refreshments" title="Drinks & Refreshments" subtitle="Water, soft drinks, energy drinks and mixers" badge="ZERO ALCOHOL" products={mixersAndSnacks} onSelectProduct={onSelectProduct} onSeeAll={() => handleSelectCategory('cat_softdrinks')} />

          <ProductRail id="rail-party" title="Party Essentials" subtitle="Glasses, plates, napkins and serving supplies" products={allProducts.filter(p => p.categoryId.startsWith('cat_party')).slice(0, 10)} onSelectProduct={onSelectProduct} onSeeAll={() => handleSelectCategory('cat_party')} />

          {/* RAIL 8: Buy Again */}
          <ProductRail
            id="rail-buy-again"
            title="Buy Again"
            subtitle="Quick 1-tap re-order from previous purchases & popular staples"
            badge="QUICK RE-ORDER"
            products={buyAgainItems}
            onSelectProduct={onSelectProduct}
            onSeeAll={() => handleSelectFilter('bestseller')}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. FOOTER & RESPONSIBLE CONSUMPTION NOTICE                */}
      {/* ========================================================= */}
      <footer className="pt-8 pb-4 text-center border-t border-slate-200/80">
        <div className="flex flex-col items-center justify-center mb-3">
          <img
            src="/images/drinkit-logo.png"
            alt="DrinkIt — Liquor Delivery App"
            className="w-28 sm:w-36 h-auto object-contain drop-shadow-xs"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 font-bold mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Licensed Micro-Warehouse Partner • UP & Delhi State Excise Compliant</span>
        </div>
        <p className="text-[11px] text-slate-400 max-w-xl mx-auto leading-relaxed">
          Alcohol sale & delivery restricted strictly to individuals 21 years of age and above. Physical government photo ID verification mandatory upon doorstep delivery. Drink responsibly. Never drink and drive.
        </p>
      </footer>
    </div>
  );
};
