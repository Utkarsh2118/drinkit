import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { LocationProvider } from './context/LocationContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { WishlistProvider } from './context/WishlistContext.tsx';
import { RouterProvider, useRouter } from './context/RouterContext.tsx';

import { ResponsibleBanner } from './components/ResponsibleBanner.tsx';
import { Header } from './components/Header.tsx';
import { LocationModal } from './components/LocationModal.tsx';
import { AgeVerificationModal } from './components/AgeVerificationModal.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { CheckoutModal } from './components/CheckoutModal.tsx';
import { OrderTrackingModal } from './components/OrderTrackingModal.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { StickyMobileCartBar } from './components/StickyMobileCartBar.tsx';
import { CustomerAuthModal } from './components/CustomerAuthModal.tsx';
import { PortalShell } from './components/PortalShell.tsx';

import { CustomerHome } from './views/CustomerHome.tsx';
import { OrdersView } from './views/OrdersView.tsx';
import { WishlistView } from './views/WishlistView.tsx';
import { CustomerLoginView } from './views/CustomerLoginView.tsx';
import { StoreStaffView } from './views/StoreStaffView.tsx';
import { DeliveryAgentView } from './views/DeliveryAgentView.tsx';
import { AdminDashboardView } from './views/AdminDashboardView.tsx';
import { AdminLoginView } from './views/AdminLoginView.tsx';
import { StoreLoginView } from './views/StoreLoginView.tsx';
import { DeliveryLoginView } from './views/DeliveryLoginView.tsx';

import { Product, Order } from './types.ts';

const AppContent: React.FC = () => {
  const { currentPath, navigate } = useRouter();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAgeModalOpen, setIsAgeModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  const handleOrderPlaced = (order: Order) => {
    setTrackingOrderId(order.id);
  };

  // --- 1. DEDICATED INTERNAL PORTAL ROUTES (STRICT ROLE SEPARATION) ---

  // Admin Portal Routes
  if (currentPath === '/admin/login') {
    return <AdminLoginView />;
  }

  if (currentPath === '/admin' || currentPath === '/admin/dashboard') {
    return (
      <PortalShell
        requiredRole="admin"
        portalTitle="Operations Command"
        portalSubtitle="Enterprise multi-store inventory, excise compliance & telemetry"
        portalBadge="SUPER ADMIN"
        portalColor="amber"
        loginPath="/admin/login"
      >
        <AdminDashboardView />
      </PortalShell>
    );
  }

  // Store Staff Portal Routes
  if (currentPath === '/store/login') {
    return <StoreLoginView />;
  }

  if (currentPath === '/store' || currentPath === '/store/dashboard') {
    return (
      <PortalShell
        requiredRole="staff"
        portalTitle="Dark Store Operations Hub"
        portalSubtitle="Indiranagar Micro-Warehouse • Fulfillment Queue & Shelf Stock"
        portalBadge="STORE STAFF"
        portalColor="indigo"
        loginPath="/store/login"
      >
        <StoreStaffView />
      </PortalShell>
    );
  }

  // Delivery Partner Portal Routes
  if (currentPath === '/delivery/login') {
    return <DeliveryLoginView />;
  }

  if (currentPath === '/delivery' || currentPath === '/delivery/dashboard') {
    return (
      <PortalShell
        requiredRole="delivery"
        portalTitle="Delivery Partner Portal"
        portalSubtitle="DrinkIt Speed Fleet • Live Navigation & 21+ OTP Verification"
        portalBadge="RIDER FLEET"
        portalColor="cyan"
        loginPath="/delivery/login"
      >
        <DeliveryAgentView />
      </PortalShell>
    );
  }

  // --- 2. CUSTOMER APPLICATION (HOME, ORDERS, WISHLIST, LOGIN, SEARCH) ---

  const activeCustomerView =
    currentPath === '/orders'
      ? 'orders'
      : currentPath === '/wishlist'
      ? 'wishlist'
      : currentPath === '/login'
      ? 'login'
      : 'home';

  const handleSetCustomerView = (view: string) => {
    if (view === 'orders') navigate('/orders');
    else if (view === 'wishlist') navigate('/wishlist');
    else if (view === 'login') navigate('/login');
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#f8f9f7] text-slate-900 flex flex-col selection:bg-emerald-500 selection:text-white font-sans">
      {/* Top Regulatory Compliance Banner */}
      <ResponsibleBanner />

      {/* Pure Customer Navigation Header (No Operational Role Switcher) */}
      <Header
        activeView={activeCustomerView}
        setActiveView={handleSetCustomerView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectProduct={prod => setSelectedProduct(prod)}
        onOpenAgeModal={() => setIsAgeModalOpen(true)}
      />

      {/* Main Views Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-10">
        {activeCustomerView === 'login' && <CustomerLoginView />}

        {activeCustomerView === 'home' && (
          <CustomerHome
            onSelectProduct={prod => setSelectedProduct(prod)}
            onOpenAgeModal={() => setIsAgeModalOpen(true)}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        )}

        {activeCustomerView === 'orders' && (
          <OrdersView
            onTrackOrder={orderId => setTrackingOrderId(orderId)}
            onBrowse={() => handleSetCustomerView('home')}
          />
        )}

        {activeCustomerView === 'wishlist' && (
          <WishlistView
            onBrowse={() => handleSetCustomerView('home')}
            onSelectProduct={prod => setSelectedProduct(prod)}
          />
        )}
      </main>

      {/* Global Modals & Drawers */}
      <CustomerAuthModal />

      <LocationModal />

      <AgeVerificationModal
        isOpen={isAgeModalOpen}
        onClose={() => setIsAgeModalOpen(false)}
      />

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <CartDrawer
        onProceedToCheckout={() => setIsCheckoutModalOpen(true)}
      />

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        onOrderPlaced={handleOrderPlaced}
        onOpenAgeModal={() => setIsAgeModalOpen(true)}
      />

      <OrderTrackingModal
        orderId={trackingOrderId}
        onClose={() => setTrackingOrderId(null)}
      />

      {/* Sticky Mobile Floating Cart Bar (Appears when cart has items) */}
      <StickyMobileCartBar />

      {/* Mobile Bottom Navigation (Customer Only: Home, Wishlist, Orders, Cart) */}
      <MobileBottomNav
        activeView={activeCustomerView}
        setActiveView={handleSetCustomerView}
      />
    </div>
  );
};

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <LocationProvider>
          <CartProvider>
            <WishlistProvider>
              <AppContent />
            </WishlistProvider>
          </CartProvider>
        </LocationProvider>
      </AuthProvider>
    </RouterProvider>
  );
}
