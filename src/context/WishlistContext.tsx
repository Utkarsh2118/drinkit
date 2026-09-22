import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product } from '../types.ts';
import { useCart } from './CartContext.tsx';
import { useAuth } from './AuthContext.tsx';
import { useLocation } from './LocationContext.tsx';
import { api } from '../services/api.ts';

interface WishlistContextType {
  wishlist: Product[];
  isLoading: boolean;
  toggleWishlist: (product: Product) => Promise<void>;
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  moveToCart: (product: Product) => void;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('drinkit_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { addItem, openCartDrawer } = useCart();
  const { user } = useAuth();
  const { activeStore } = useLocation();

  // Load wishlist from backend when authenticated or when active store changes
  const refreshWishlist = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const storeParam = activeStore?.id ? `?storeId=${activeStore.id}` : '';
      const data = await api.get<Product[]>(`/wishlist${storeParam}`);
      if (Array.isArray(data)) {
        setWishlist(data);
        localStorage.setItem('drinkit_wishlist', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Could not sync wishlist with backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, activeStore?.id]);

  useEffect(() => {
    if (user) {
      refreshWishlist();
    }
  }, [user, activeStore?.id, refreshWishlist]);

  // Keep local storage synchronized for offline/guest fallback
  useEffect(() => {
    localStorage.setItem('drinkit_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const addToWishlist = async (product: Product) => {
    const alreadyExists = wishlist.some(p => p.id === product.id);
    if (alreadyExists) return;

    // Optimistic UI update
    setWishlist(prev => [product, ...prev]);

    if (user) {
      try {
        await api.post('/wishlist', { productId: product.id });
      } catch (err) {
        console.error('Failed to persist wishlist item to backend:', err);
        // Rollback on network failure
        setWishlist(prev => prev.filter(p => p.id !== product.id));
      }
    }
  };

  const removeFromWishlist = async (productId: string) => {
    const previous = wishlist;
    // Optimistic UI update
    setWishlist(prev => prev.filter(p => p.id !== productId));

    if (user) {
      try {
        await api.delete(`/wishlist/${productId}`);
      } catch (err) {
        console.error('Failed to remove wishlist item from backend:', err);
        // Rollback on network failure
        setWishlist(previous);
      }
    }
  };

  const toggleWishlist = async (product: Product) => {
    const exists = wishlist.some(p => p.id === product.id);
    if (exists) {
      await removeFromWishlist(product.id);
    } else {
      await addToWishlist(product);
    }
  };

  const isInWishlist = (productId: string) => {
    return wishlist.some(p => p.id === productId);
  };

  const moveToCart = (product: Product) => {
    // Check stock availability
    const isOutOfStock = product.stock !== undefined && product.stock <= 0;
    if (isOutOfStock) {
      return;
    }
    addItem(product);
    removeFromWishlist(product.id);
    openCartDrawer();
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        isLoading,
        toggleWishlist,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        moveToCart,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
};
