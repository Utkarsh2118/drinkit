import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  ShoppingBag,
  Heart,
  Bell,
  User,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Truck,
  Building2,
  Lock,
  LogOut,
  Zap,
  X,
  TrendingUp,
  Package,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Loader2,
  Trash2,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLocation } from '../context/LocationContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useWishlist } from '../context/WishlistContext.tsx';
import { api } from '../services/api.ts';
import { Notification, Product } from '../types.ts';

interface HeaderProps {
  onOpenAgeModal: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onSelectProduct?: (product: Product) => void;
}

const RECENT_SEARCHES_STORAGE_KEY = 'drinkit_recent_searches';

const INITIAL_POPULAR_QUERIES = [
  'Bira 91 White',
  'Kingfisher Ultra',
  'Corona Extra Chilled',
  'Single Malt Whisky',
  'Glenfiddich 12',
  'Bombay Sapphire Gin',
  'Svami Artisanal Tonic',
  'Whisky under ₹2500',
  'Chilled Beer 6-Pack',
  'Bar Snacks & Peanuts',
];

const getInitialRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 8);
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return ['Bira 91 White', 'Kingfisher Ultra', 'Single Malt Whisky', 'Svami Tonic'];
};

// Curated high-converting quick-commerce queries
const QUICK_COMMERCE_SUGGESTIONS = [
  { label: 'Craft Beer', icon: '🍺', query: 'Beer' },
  { label: 'Single Malt', icon: '🥃', query: 'Single Malt' },
  { label: 'Bira 91', icon: '⚡', query: 'Bira' },
  { label: 'Gin & Tonic', icon: '🍸', query: 'Gin' },
  { label: 'Kingfisher Ultra', icon: '🍻', query: 'Kingfisher' },
  { label: 'Artisanal Tonic', icon: '🥤', query: 'Tonic' },
  { label: 'Zero Alcohol', icon: '🌿', query: 'Zero' },
  { label: 'Cocktail Mixers', icon: '🍹', query: 'Mixer' },
  { label: 'Bar Snacks', icon: '🥜', query: 'Snacks' },
];

const POPULAR_CATEGORIES = [
  { name: 'Chilled Beers', sub: 'Lagers, Ales, IPAs', query: 'Beer' },
  { name: 'Whiskies & Single Malts', sub: 'Scotch, Bourbon, Rye', query: 'Whisky' },
  { name: 'Gins & Craft Spirits', sub: 'London Dry, Botanical', query: 'Gin' },
  { name: 'Mixers & Tonics', sub: 'Ginger Ale, Club Soda', query: 'Mixers' },
];

export const Header: React.FC<HeaderProps> = ({
  onOpenAgeModal,
  activeView,
  setActiveView,
  searchQuery: externalSearchQuery,
  setSearchQuery: externalSetSearchQuery,
  onSelectProduct,
}) => {
  const {
    user,
    logout,
    isLoggingOut,
    isAgeVerified,
  } = useAuth();
  const { selectedLocation, estimatedDeliveryRange, openLocationModal, isServiceable } = useLocation();
  const { totalItemCount, totalAmount, openCartDrawer } = useCart();
  const { wishlist } = useWishlist();

  // Local fallback if parent doesn't manage search state directly
  const [internalQuery, setInternalQuery] = useState('');
  const query = externalSearchQuery !== undefined ? externalSearchQuery : internalQuery;
  const setQuery = (q: string) => {
    if (externalSetSearchQuery) {
      externalSetSearchQuery(q);
    } else {
      setInternalQuery(q);
    }
  };

  const [suggestions, setSuggestions] = useState<any>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(getInitialRecentSearches);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  useEffect(() => {
    if (user) {
      api
        .get<Notification[]>('/notifications')
        .then(data => setNotifications(data || []))
        .catch(() => {});
    }
  }, [user]);

  // Debounced live search suggestions (fetches backend without reloading the page)
  useEffect(() => {
    let isMounted = true;
    const trimmed = query.trim();

    if (trimmed.length >= 1) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        api
          .get(`/products/suggestions?q=${encodeURIComponent(trimmed)}`)
          .then(res => {
            if (isMounted) {
              setSuggestions(res);
            }
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) {
              setIsSearching(false);
            }
          });
      }, 200);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      // When query is empty, fetch popular & trending queries for dropdown
      api
        .get('/products/suggestions')
        .then(res => {
          if (isMounted) {
            setSuggestions(res);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) {
            setIsSearching(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [query]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideDesktopSearch = searchContainerRef.current?.contains(target);
      const isInsideMobileSearch = mobileSearchContainerRef.current?.contains(target);

      if (!isInsideDesktopSearch && !isInsideMobileSearch) {
        setIsSearchFocused(false);
      }
      if (profileContainerRef.current && !profileContainerRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const next = [trimmed, ...prev.filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const removeRecentSearch = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRecentSearches(prev => {
      const next = prev.filter(item => item !== termToRemove);
      try {
        localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch (e) {}
  };

  const handleApplyQuery = (searchWord: string) => {
    const trimmed = searchWord.trim();
    setQuery(trimmed);
    if (trimmed) {
      saveRecentSearch(trimmed);
    }
    setIsSearchFocused(false);
    if (activeView !== 'home') {
      setActiveView('home');
    }
  };

  const handleClearQuery = () => {
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        handleApplyQuery(query.trim());
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
    }
  };

  const popularList: string[] =
    suggestions?.popularQueries && suggestions.popularQueries.length > 0
      ? suggestions.popularQueries
      : INITIAL_POPULAR_QUERIES;

  const hasQuery = Boolean(query.trim());
  const hasRecent = recentSearches.length > 0;
  const hasMatchingProducts = Boolean(suggestions?.products && suggestions.products.length > 0);
  const hasQuickQueries = Boolean(suggestions?.quickQueries && suggestions.quickQueries.length > 0);

  // Quick-Commerce search dropdown supporting Recent, Popular, and Live Debounced Suggestions
  const renderSearchDropdown = (isMobile = false) => (
    <div
      className={`absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 p-3 sm:p-3.5 space-y-3.5 animate-scale-up ${
        isMobile ? 'max-h-[70vh]' : 'max-h-[75vh]'
      } overflow-y-auto`}
    >
      {/* Debounced Fetch Status Spinner */}
      {isSearching && (
        <div className="flex items-center gap-2 px-1 text-xs text-slate-500 font-medium pb-1.5 border-b border-slate-100">
          <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
          <span>Searching 20-min delivery inventory...</span>
        </div>
      )}

      {/* STATE 1: Empty Query - Show Recent Searches, Popular/Trending Searches, & Curated Categories */}
      {!hasQuery && (
        <>
          {/* Recent Searches */}
          {hasRecent && (
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Recent Searches
                </span>
                <button
                  type="button"
                  onMouseDown={clearRecentSearches}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1"
                  title="Clear all recent search queries"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map(term => (
                  <div
                    key={term}
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyQuery(term);
                    }}
                    className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer transition-all"
                  >
                    <Clock className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[140px] sm:max-w-[180px]">{term}</span>
                    <button
                      type="button"
                      onMouseDown={e => removeRecentSearch(term, e)}
                      className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                      title="Remove this search"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Popular / Trending Searches */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Popular on DrinkIt
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                ⚡ Trending Now
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {popularList.map((item, idx) => (
                <button
                  key={item}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyQuery(item);
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-200 text-left transition-colors group"
                >
                  <span className="w-5 h-5 rounded-md bg-white border border-slate-200 group-hover:border-emerald-300 text-slate-500 group-hover:text-emerald-700 text-[10px] font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 truncate flex-1">
                    {item}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Curated Categories */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mb-1.5">
              Curated Drink Categories
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {POPULAR_CATEGORIES.map(cat => (
                <button
                  key={cat.name}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyQuery(cat.query);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{cat.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{cat.sub}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* STATE 2: Active Query - Live Debounced Query Suggestions & In-Stock Matching Products */}
      {hasQuery && (
        <>
          {/* Quick Query Autocomplete Suggestions */}
          {hasQuickQueries && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mb-1.5 flex items-center justify-between">
                <span>Suggested Searches</span>
                <span className="text-[10px] text-slate-400 font-medium">Press Enter to search</span>
              </div>
              <div className="space-y-0.5">
                {suggestions.quickQueries.map((qq: string) => (
                  <button
                    key={qq}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyQuery(qq);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 group-hover:text-emerald-900 truncate">
                      <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                      <span className="truncate">{qq}</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching In-Stock Drinks with Quick-Dispatch Info */}
          {hasMatchingProducts && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  Drinks in Stock Near You
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  ⚡ 20 Min Drop
                </span>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                {suggestions.products.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      setIsSearchFocused(false);
                      saveRecentSearch(p.name);
                      if (onSelectProduct) {
                        onSelectProduct(p);
                      } else {
                        handleApplyQuery(p.name);
                      }
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                          {p.brandName}
                        </div>
                        <div className="text-slate-900 font-bold text-xs truncate group-hover:text-emerald-700">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span>{p.volume}</span>
                          {p.alcoholByVolume ? (
                            <span className="text-[9px] font-semibold px-1 rounded bg-slate-100 text-slate-600">
                              {p.alcoholByVolume}% ABV
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold px-1 rounded bg-emerald-50 text-emerald-700">
                              Zero Alcohol
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <div className="text-xs font-black text-slate-900 font-mono">₹{p.price}</div>
                      {p.mrp && p.mrp > p.price && (
                        <div className="text-[10px] text-slate-400 line-through font-medium font-mono">
                          ₹{p.mrp}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Categories and Brands Chips */}
          {((suggestions?.categories && suggestions.categories.length > 0) ||
            (suggestions?.brands && suggestions.brands.length > 0)) && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
              {suggestions?.categories?.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyQuery(c.name);
                  }}
                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold transition-colors"
                >
                  In Category: {c.name}
                </button>
              ))}
              {suggestions?.brands?.map((b: any) => (
                <button
                  key={b.id}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleApplyQuery(b.name);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-[11px] font-bold transition-colors"
                >
                  Brand: {b.name}
                </button>
              ))}
            </div>
          )}

          {/* Fallback if no matching products or suggestions */}
          {!isSearching && !hasMatchingProducts && !hasQuickQueries && (
            <div className="p-3 text-center">
              <div className="text-xs font-bold text-slate-800">
                No direct drink matches for "{query}"
              </div>
              <div className="text-[11px] text-slate-500 mt-1 mb-2.5">
                Try searching for chilled beers, single malts, craft gin, or mixers.
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {QUICK_COMMERCE_SUGGESTIONS.slice(0, 4).map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleApplyQuery(item.query);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Main Desktop & Mobile Primary Bar */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 py-2.5">
          {/* LEFT: DrinkIt Logo + Prominent Location Selector */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* DrinkIt Brand Logo */}
            <button
              onClick={() => {
                setActiveView('home');
                setQuery('');
              }}
              className="flex items-center group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xl shrink-0"
              title="DrinkIt - 20 Min Drink Delivery"
            >
              <img
                src="/images/drinkit-logo.svg"
                alt="DrinkIt - Liquor Delivery"
                className="w-20 h-14 sm:w-24 sm:h-16 object-contain object-center drop-shadow-sm group-hover:scale-[1.02] transition-transform duration-200"
              />
            </button>

            {/* Prominent Location Selector */}
            <button
              onClick={openLocationModal}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-left group focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              title="Change Delivery Micro-Warehouse / Address"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex flex-col max-w-[100px] xs:max-w-[130px] sm:max-w-[160px] lg:max-w-[190px]">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                    Deliver to
                  </span>
                  {!isServiceable ? (
                    <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100/80 px-1 rounded">
                      Outside Area
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/60 px-1 rounded sm:hidden">
                      ⚡ {estimatedDeliveryRange.replace('mins', 'm')}
                    </span>
                  )}
                </div>
                <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1 leading-tight">
                  <span className="truncate">{selectedLocation.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 transition-transform" />
                </div>
              </div>
              <div
                className={`hidden sm:flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                  isServiceable
                    ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                    : 'text-amber-800 bg-amber-50 border border-amber-200'
                }`}
              >
                <span>{isServiceable ? '⚡' : '⚠️'}</span>
                <span>{isServiceable ? estimatedDeliveryRange : 'Unserviceable'}</span>
              </div>
            </button>
          </div>

          {/* CENTER: Compact Search Bar with Suggested Quick-Commerce Queries (Desktop >= 1024px) */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-2 lg:mx-4 hidden lg:block">
            <div className="relative">
              <input
                type="text"
                placeholder="Search chilled beer, single malts, gin, mixers, snacks..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 focus:outline-none text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-medium transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              {query && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Suggestions & Autocomplete Dropdown */}
            {isSearchFocused && renderSearchDropdown(false)}
          </div>

          {/* RIGHT: Right-Aligned Icons for Cart, Profile, & Companion Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Wishlist Icon (Tablet & Desktop) */}
            <button
              onClick={() => setActiveView('wishlist')}
              className={`hidden md:flex p-2 rounded-xl border transition-colors relative ${
                activeView === 'wishlist'
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Saved Drinks Wishlist"
            >
              <Heart className={`w-4 h-4 ${wishlist.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {wishlist.length}
                </span>
              )}
            </button>

            {/* Notification Bell (Tablet & Desktop) */}
            <div ref={notifContainerRef} className="relative hidden sm:block">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 relative transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.isRead) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white" />
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 animate-scale-up">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="font-extrabold text-slate-900 text-xs">Dispatch Notifications</span>
                    <span className="text-[10px] text-slate-500 font-medium">{notifications.length} alerts</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-4 font-medium">No new notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border text-xs ${
                            n.isRead ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-emerald-50/60 border-emerald-200 text-slate-900'
                          }`}
                        >
                          <div className="font-bold text-emerald-800 text-xs">{n.title}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu Trigger & Dropdown or Login Action */}
            {!user ? (
              <button
                onClick={() => setActiveView('login')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-xs transition-transform active:scale-95 shrink-0"
                title="Customer Sign In"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            ) : (
              <div ref={profileContainerRef} className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  title="User Profile & Settings"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : user?.name ? (
                      user.name.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <span className="hidden md:inline text-xs font-bold text-slate-800 truncate max-w-[90px]">
                    {user?.name?.split(' ')[0] || 'Customer'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 text-xs animate-scale-up">
                    {/* User Profile Card */}
                    <div
                      onClick={() => {
                        setActiveView('profile');
                        setShowProfileMenu(false);
                      }}
                      className="p-3 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded-xl mb-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-sm overflow-hidden shrink-0">
                          {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                          ) : user?.name ? (
                            user.name.charAt(0).toUpperCase()
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 text-xs truncate">{user?.name || 'Customer'}</div>
                          <div className="text-[10px] text-slate-500 truncate">{user?.phone || user?.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/80">
                        <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          Customer
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAgeModal();
                            setShowProfileMenu(false);
                          }}
                          className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>{isAgeVerified ? '21+ Verified' : 'Verify Age'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Fast Navigation */}
                    <div className="space-y-0.5 mb-2 pb-2 border-b border-slate-100">
                      <button
                        onClick={() => {
                          setActiveView('profile');
                          setShowProfileMenu(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
                          activeView === 'profile' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>My Profile & Settings</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveView('orders');
                          setShowProfileMenu(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
                          activeView === 'orders' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        <Package className="w-4 h-4 text-emerald-600" />
                        <span>My Orders & Live Tracking</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveView('wishlist');
                          setShowProfileMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors ${
                          activeView === 'wishlist' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Heart className="w-4 h-4 text-rose-500" />
                          <span>Saved Drinks Wishlist</span>
                        </div>
                        {wishlist.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            {wishlist.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Customer Account & Logout */}
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        disabled={isLoggingOut}
                        onClick={async () => {
                          await logout();
                          setShowProfileMenu(false);
                          setActiveView('home');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isLoggingOut ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                            <span>Logging out...</span>
                          </>
                        ) : (
                          <>
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Log Out</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick-Commerce Cart Button */}
            <button
              onClick={openCartDrawer}
              className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-transform active:scale-95 shrink-0"
              title="View Cart Drawer"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4" />
                {totalItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-white text-emerald-800 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {totalItemCount}
                  </span>
                )}
              </div>
              <span className="font-mono font-black tracking-tight">₹{totalAmount}</span>
              <span className="hidden sm:inline text-[11px] font-extrabold uppercase tracking-wider text-emerald-100 border-l border-emerald-500 pl-2">
                Cart
              </span>
            </button>
          </div>
        </div>

        {/* Tablet & Mobile Row 2 Search Bar (<1024px / lg:hidden) */}
        <div ref={mobileSearchContainerRef} className="lg:hidden pb-2.5 pt-0.5 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search beer, single malt, gin, tonics, snacks..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-3 pointer-events-none" />
            {query && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="absolute right-2.5 top-2.5 sm:top-3 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Suggestions & Autocomplete Dropdown for Tablet & Mobile */}
          {isSearchFocused && renderSearchDropdown(true)}

          {/* Quick Suggestion Chips Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-2 pb-0.5">
            {QUICK_COMMERCE_SUGGESTIONS.slice(0, 8).map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleApplyQuery(item.query)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
