import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { CartDrawer } from "@/components/CartDrawer";
import { SupportDrawer } from "@/components/support/SupportDrawer";
import { SupportDrawerProvider, useSupportDrawer } from "@/contexts/SupportDrawerContext";
import { UIConfigProvider } from "@/contexts/UIConfigContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationListener } from "@/components/NotificationToast";
import { OrderAlertListener } from "@/components/OrderAlertListener";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { useCmsTheme } from "@/hooks/use-cms-theme";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { CookieConsent } from "@/components/CookieConsent";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import { Suspense, lazy } from "react";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { BanGuard } from "@/components/BanGuard";

// Lazy-loaded routes
const Index = lazy(() => import("./pages/Index"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const StorePage = lazy(() => import("./pages/StorePage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const VendorDashboardPage = lazy(() => import("./pages/VendorDashboardPage"));
const ShipperDashboardPage = lazy(() => import("./pages/ShipperDashboardPage"));
const RiderDashboardPage = lazy(() => import("./pages/RiderDashboardPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TrackingPage = lazy(() => import("./pages/TrackingPage"));
const BecomeVendorPage = lazy(() => import("./pages/BecomeVendorPage"));
const BannedPage = lazy(() => import("./pages/BannedPage"));
const DriverPage = lazy(() => import("./pages/DriverPage"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminCMSPage = lazy(() => import("./pages/admin/AdminCMSPage"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminLogisticsPage = lazy(() => import("./pages/admin/AdminLogisticsPage"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminShippingPage = lazy(() => import("./pages/admin/AdminShippingPage"));
const AdminVendorApplicationsPage = lazy(() => import("./pages/admin/AdminVendorApplicationsPage"));
const AdminStoreNamesPage = lazy(() => import("./pages/admin/AdminStoreNamesPage"));
const AdminVendorSubscriptionsPage = lazy(() => import("./pages/admin/AdminVendorSubscriptionsPage"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const AdminLoyaltyPage = lazy(() => import("./pages/admin/AdminLoyaltyPage"));
const AdminPointsPage = lazy(() => import("./pages/admin/AdminPointsPage"));
const AdminCouponsPage = lazy(() => import("./pages/admin/AdminCouponsPage"));
const AdminWithdrawalsPage = lazy(() => import("./pages/admin/AdminWithdrawalsPage"));
const AdminReturnsPage = lazy(() => import("./pages/admin/AdminReturnsPage"));
const AdminDisputesPage = lazy(() => import("./pages/admin/AdminDisputesPage"));
const AdminExchangeRatesPage = lazy(() => import("./pages/admin/AdminExchangeRatesPage"));
const AdminAffiliateTiersPage = lazy(() => import("./pages/admin/AdminAffiliateTiersPage"));
const AdminSEOPage = lazy(() => import("./pages/admin/AdminSEOPage"));
const AdminCountriesPage = lazy(() => import("./pages/admin/AdminCountriesPage"));
const AdminPopupsPage = lazy(() => import("./pages/admin/AdminPopupsPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminProductModerationPage = lazy(() => import("./pages/admin/AdminProductModerationPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

function SupportDrawerWrapper() {
  const { open, setOpen } = useSupportDrawer();
  return <SupportDrawer open={open} onOpenChange={setOpen} />;
}

function CmsThemeInjector() { useCmsTheme(); return null; }

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
          <I18nProvider>
          <ThemeProvider>
          <UIConfigProvider>
            <CmsThemeInjector />
            <Toaster />
            <Sonner />
            <NotificationListener />
            <OrderAlertListener />
            <ScrollRestoration />
            <CartDrawer />
            <SupportDrawerProvider>
              <SupportDrawerWrapper />
            </SupportDrawerProvider>
            <MobileBottomNav />
            <PWAInstallBanner />
            <OfflineIndicator />
            <CookieConsent />
            <AnnouncementPopup />
            <MaintenanceGuard>
            <BanGuard>
            <Suspense fallback={<PageLoadingSkeleton />}>
              <Routes>
                <Route path="/banned" element={<BannedPage />} />
                <Route path="/" element={<Index />} />
                <Route path="/product/:id" element={<ProductPage />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/store/:id" element={<StorePage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/vendor" element={<VendorDashboardPage />} />
                <Route path="/shipper" element={<ShipperDashboardPage />} />
                <Route path="/rider" element={<RiderDashboardPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/tracking" element={<TrackingPage />} />
                <Route path="/become-vendor" element={<BecomeVendorPage />} />
                <Route path="/driver" element={<DriverPage />} />
                {/* Admin routes */}
                <Route path="/admin" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminDashboard /></RoleGuard>} />
                <Route path="/admin/users" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminUsersPage /></RoleGuard>} />
                <Route path="/admin/cms" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminCMSPage /></RoleGuard>} />
                <Route path="/admin/categories" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminCategoriesPage /></RoleGuard>} />
                <Route path="/admin/orders" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOrdersPage /></RoleGuard>} />
                <Route path="/admin/support" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminSupportPage /></RoleGuard>} />
                <Route path="/admin/logistics" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminLogisticsPage /></RoleGuard>} />
                <Route path="/admin/notifications" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminNotificationsPage /></RoleGuard>} />
                <Route path="/admin/settings" element={<RoleGuard allowedRoles={["admin"]}><AdminSettingsPage /></RoleGuard>} />
                <Route path="/admin/shipping" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminShippingPage /></RoleGuard>} />
                <Route path="/admin/vendor-applications" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminVendorApplicationsPage /></RoleGuard>} />
                <Route path="/admin/store-names" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminStoreNamesPage /></RoleGuard>} />
                <Route path="/admin/vendor-subscriptions" element={<RoleGuard allowedRoles={["admin"]}><AdminVendorSubscriptionsPage /></RoleGuard>} />
                <Route path="/admin/audit" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminAuditPage /></RoleGuard>} />
                <Route path="/admin/loyalty" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminLoyaltyPage /></RoleGuard>} />
                <Route path="/admin/points" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminPointsPage /></RoleGuard>} />
                <Route path="/admin/coupons" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminCouponsPage /></RoleGuard>} />
                <Route path="/admin/withdrawals" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminWithdrawalsPage /></RoleGuard>} />
                <Route path="/admin/returns" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminReturnsPage /></RoleGuard>} />
                <Route path="/admin/disputes" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminDisputesPage /></RoleGuard>} />
                <Route path="/admin/exchange-rates" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminExchangeRatesPage /></RoleGuard>} />
                <Route path="/admin/affiliate-tiers" element={<RoleGuard allowedRoles={["admin"]}><AdminAffiliateTiersPage /></RoleGuard>} />
                <Route path="/admin/seo" element={<RoleGuard allowedRoles={["admin"]}><AdminSEOPage /></RoleGuard>} />
                <Route path="/admin/countries" element={<RoleGuard allowedRoles={["admin"]}><AdminCountriesPage /></RoleGuard>} />
                <Route path="/admin/popups" element={<RoleGuard allowedRoles={["admin"]}><AdminPopupsPage /></RoleGuard>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </BanGuard>
            </MaintenanceGuard>
          </UIConfigProvider>
          </ThemeProvider>
          </I18nProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
