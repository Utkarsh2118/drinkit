import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem, Coupon } from '../types.ts';
import { api } from '../services/api.ts';

interface CartContextType {
  items: CartItem[];
  totalItemCount: number;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  handlingFee: number;
  taxes: number;
  totalAmount: number;
  couponCode: string | null;
  appliedCoupon: Coupon | null;
  addItem: (product: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('drinkit_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('drinkit_cart', JSON.stringify(items));
  }, [items]);

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Recalculate discount whenever subtotal or coupon changes
  useEffect(() => {
    if (!appliedCoupon) {
      setDiscount(0);
      return;
    }

    if (subtotal < appliedCoupon.minOrderValue) {
      setDiscount(0);
      return;
    }

    if (appliedCoupon.discountType === 'percentage') {
      const raw = (subtotal * appliedCoupon.discountValue) / 100;
      setDiscount(appliedCoupon.maxDiscount ? Math.min(raw, appliedCoupon.maxDiscount) : raw);
    } else {
      setDiscount(appliedCoupon.discountValue);
    }
  }, [subtotal, appliedCoupon]);

  const deliveryFee = subtotal > 999 || subtotal === 0 ? 0 : 35;
  const handlingFee = subtotal > 0 ? 15 : 0;
  const taxes = subtotal > 0 ? Math.round((subtotal - discount) * 0.05) : 0;
  const totalAmount = Math.max(0, subtotal - discount + deliveryFee + handlingFee + taxes);

  const addItem = (product: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setItems(prev => {
      return prev
        .map(i => {
          if (i.product.id === productId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setCouponCode(null);
    setAppliedCoupon(null);
    setDiscount(0);
  };

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await api.post<any>('/coupons/validate', {
        code: code.trim(),
        items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        cartTotal: subtotal,
      });

      const couponData = res.coupon || {
        id: `c_${res.code || code}`,
        code: res.code || code.toUpperCase(),
        description: res.description || 'Special Promotion',
        discountType: res.discountType || 'fixed',
        discountValue: res.discountValue || res.discount,
        minOrderValue: 0,
        validUntil: '2026-12-31',
        isActive: true,
        overallUsageCount: 0,
      };

      setCouponCode(couponData.code);
      setAppliedCoupon(couponData);
      setDiscount(res.discount);
      return {
        success: true,
        message: res.message || `Code "${couponData.code}" applied! Saved ₹${res.discount}`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || `Coupon "${code}" could not be applied`,
      };
    }
  };

  const removeCoupon = () => {
    setCouponCode(null);
    setAppliedCoupon(null);
    setDiscount(0);
  };

  const getItemQuantity = (productId: string) => {
    const item = items.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalItemCount,
        subtotal,
        discount,
        deliveryFee,
        handlingFee,
        taxes,
        totalAmount,
        couponCode,
        appliedCoupon,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        applyCoupon,
        removeCoupon,
        isCartDrawerOpen,
        openCartDrawer: () => setIsCartDrawerOpen(true),
        closeCartDrawer: () => setIsCartDrawerOpen(false),
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
