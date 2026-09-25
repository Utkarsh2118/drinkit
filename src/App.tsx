import React, { useState, useEffect, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LocationProvider } from './context/LocationContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { WishlistProvider } from './context/WishlistContext.tsx';
import { RouterProvider, useRouter } from './context/RouterContext.tsx';

import { ResponsibleBanner } from './components/ResponsibleBanner.tsx';
import { Header } from './components/Header.tsx';
import { AgeVerificationModal } from './components/AgeVerificationModal.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { StickyMobileCartBar } from './components/StickyMobileCartBar.tsx';
import { CustomerAuthModal } from './components/CustomerAuthModal.tsx';
import { PortalShell } from './components/PortalShell.tsx';

// Critical above-the-fold customer home view loaded eagerly
import { CustomerHome } from './views/CustomerHome.tsx';

// Code-split portals and secondary customer views (lazy loaded on demand)
const OrdersView = React.lazy(() =>
  import('./views/OrdersView.tsx').then(m => ({ default: m.OrdersView }))
);
const WishlistView = React.lazy(() =>
  import('./views/WishlistView.tsx').then(m => ({ default: m.WishlistView }))
);
const ProfileView = React.lazy(() =>
  import('./views/ProfileView.tsx').then(m => ({ default: m.ProfileView }))
);
const CustomerLoginView = React.lazy(() =>
  import('./views/CustomerLoginView.tsx').then(m => ({ default: m.CustomerLoginView }))
);
const StoreStaffView = React.lazy(() =>
  import('./views/StoreStaffView.tsx').then(m => ({ default: m.StoreStaffView }))
);
const DeliveryAgentView = React.lazy(() =>
  import('./views/DeliveryAgentView.tsx').then(m => ({ default: m.DeliveryAgentView }))
);
const AdminDashboardView = React.lazy(() =>
  import('./views/AdminDashboardView.tsx').then(m => ({ default: m.AdminDashboardView }))
);
const AdminLoginView = React.lazy(() =>
  import('./views/AdminLoginView.tsx').then(m => ({ default: m.AdminLoginView }))
);
const StoreLoginView = React.lazy(() =>
  import('./views/StoreLoginView.tsx').then(m => ({ default: m.StoreLoginView }))
);
const DeliveryLoginView = React.lazy(() =>
  import('./views/DeliveryLoginView.tsx').then(m => ({ default: m.DeliveryLoginView }))
);

// Heavy modals code-split to keep initial bundle lean
const OrderTrackingModal = React.lazy(() =>
  import('./components/OrderTrackingModal.tsx').then(m => ({ default: m.OrderTrackingModal }))
);
const CheckoutModal = React.lazy(() =>
  import('./components/CheckoutModal.tsx').then(m => ({ default: m.CheckoutModal }))
);
const LocationModal = React.lazy(() =>
  import('./components/LocationModal.tsx').then(m => ({ default: m.LocationModal }))
);

import { Product, Order } from './types.ts';

const ViewLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Loading DrinkIt...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-fade-in">
    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3" />
    <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">{label}</p>
  </div>
);

const AppContent: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAgeModalOpen, setIsAgeModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  // Handle direct /checkout URL with authentication guard
  useEffect(() => {
    if (currentPath === '/checkout') {
      if (!isAuthLoading) {
        if (!user) {
          navigate('/login?redirect=/checkout');
        } else {
          setIsCheckoutModalOpen(true);
        }
      }
    }
  }, [currentPath, user, isAuthLoading]);

  const handleOrderPlaced = (order: Order) => {
    setTrackingOrderId(order.id);
  };

  // --- 1. DEDICATED INTERNAL PORTAL ROUTES (STRICT ROLE SEPARATION & LAZY LOADED) ---

  // Admin Portal Routes
  if (currentPath === '/admin/login') {
    return (
      <Suspense fallback={<ViewLoadingFallback label="Loading Operations Command Login..." />}>
        <AdminLoginView />
      </Suspense>
    );
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
        <Suspense fallback={<ViewLoadingFallback label="Loading Operations Command Telemetry..." />}>
          <AdminDashboardView />
        </Suspense>
      </PortalShell>
    );
  }

  // Store Staff Portal Routes
  if (currentPath === '/store/login') {
    return (
      <Suspense fallback={<ViewLoadingFallback label="Loading Dark Store Login..." />}>
        <StoreLoginView />
      </Suspense>
    );
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
        <Suspense fallback={<ViewLoadingFallback label="Loading Fulfillment Queue..." />}>
          <StoreStaffView />
        </Suspense>
      </PortalShell>
    );
  }

  // Delivery Partner Portal Routes
  if (currentPath === '/delivery/login') {
    return (
      <Suspense fallback={<ViewLoadingFallback label="Loading Delivery Fleet Login..." />}>
        <DeliveryLoginView />
      </Suspense>
    );
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
        <Suspense fallback={<ViewLoadingFallback label="Loading Fleet Dispatch & Delivery Hub..." />}>
          <DeliveryAgentView />
        </Suspense>
      </PortalShell>
    );
  }

  // --- 2. CUSTOMER APPLICATION (HOME, ORDERS, WISHLIST, LOGIN, SEARCH) ---

  const activeCustomerView =
    currentPath === '/orders'
      ? 'orders'
      : currentPath === '/wishlist'
      ? 'wishlist'
      : currentPath === '/profile' || currentPath === '/account'
      ? 'profile'
      : currentPath === '/login'
      ? 'login'
      : 'home';

  const handleSetCustomerView = (view: string) => {
    if (view === 'orders') navigate('/orders');
    else if (view === 'wishlist') navigate('/wishlist');
    else if (view === 'profile') navigate('/profile');
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
        {activeCustomerView === 'login' && (
          <Suspense fallback={<ViewLoadingFallback label="Loading Secure Customer Sign-in..." />}>
            <CustomerLoginView />
          </Suspense>
        )}

        {activeCustomerView === 'home' && (
          <CustomerHome
            onSelectProduct={prod => setSelectedProduct(prod)}
            onOpenAgeModal={() => setIsAgeModalOpen(true)}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        )}

        {activeCustomerView === 'profile' && (
          <Suspense fallback={<ViewLoadingFallback label="Loading Profile & Account Settings..." />}>
            <ProfileView />
          </Suspense>
        )}

        {activeCustomerView === 'orders' && (
          <Suspense fallback={<ViewLoadingFallback label="Loading Your Order History & Live Tracking..." />}>
            <OrdersView
              onTrackOrder={orderId => setTrackingOrderId(orderId)}
              onBrowse={() => handleSetCustomerView('home')}
            />
          </Suspense>
        )}

        {activeCustomerView === 'wishlist' && (
          <Suspense fallback={<ViewLoadingFallback label="Loading Saved Drinks & Wishlist..." />}>
            <WishlistView
              onBrowse={() => handleSetCustomerView('home')}
              onSelectProduct={prod => setSelectedProduct(prod)}
            />
          </Suspense>
        )}
      </main>

      {/* Global Modals & Drawers */}
      <CustomerAuthModal />

      <Suspense fallback={null}>
        <LocationModal />
      </Suspense>

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

      {isCheckoutModalOpen && (
        <Suspense fallback={null}>
          <CheckoutModal
            isOpen={isCheckoutModalOpen}
            onClose={() => {
              setIsCheckoutModalOpen(false);
              if (currentPath === '/checkout') {
                navigate('/');
              }
            }}
            onOrderPlaced={handleOrderPlaced}
            onOpenAgeModal={() => setIsAgeModalOpen(true)}
          />
        </Suspense>
      )}

      {trackingOrderId && (
        <Suspense fallback={null}>
          <OrderTrackingModal
            orderId={trackingOrderId}
            onClose={() => setTrackingOrderId(null)}
          />
        </Suspense>
      )}

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
