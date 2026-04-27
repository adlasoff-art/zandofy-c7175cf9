import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { CompareProvider } from "@/contexts/CompareContext";
import { CompareBar } from "@/components/CompareBar";
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
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { useCmsTheme } from "@/hooks/use-cms-theme";
import { usePlatformFont } from "@/hooks/usePlatformFont";
import { usePlatformBootstrap } from "@/hooks/use-platform-bootstrap";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { CookieConsent } from "@/components/CookieConsent";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import { AutomationPopup } from "@/components/AutomationPopup";
import { DynamicFavicon } from "@/components/DynamicFavicon";
import { UserPresenceTracker } from "@/components/UserPresenceTracker";
import { Suspense, lazy, ComponentType } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { BanGuard } from "@/components/BanGuard";
import { useGeoBlocking } from "@/hooks/useGeoBlocking";
import { GeoBlockScreen } from "@/components/security/GeoBlockScreen";

// Retry wrapper for lazy imports — auto-reloads on chunk failure
function lazyRetry(importFn: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    importFn().catch((error) => {
      const key = "chunk_reload_attempted";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
      throw error; // let ErrorBoundary handle if reload already tried
    })
  );
}

// Lazy-loaded routes
const Index = lazyRetry(() => import("./pages/Index"));
const CategoryPage = lazyRetry(() => import("./pages/CategoryPage"));
const ProductPage = lazyRetry(() => import("./pages/ProductPage"));
const StorePage = lazyRetry(() => import("./pages/StorePage"));
const StoresPage = lazyRetry(() => import("./pages/StoresPage"));
const MessagesPage = lazyRetry(() => import("./pages/MessagesPage"));
const AuthPage = lazyRetry(() => import("./pages/AuthPage"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const CheckoutPage = lazyRetry(() => import("./pages/CheckoutPage"));
const DashboardPage = lazyRetry(() => import("./pages/DashboardPage"));
const VendorDashboardPage = lazyRetry(() => import("./pages/VendorDashboardPage"));
const ShipperDashboardPage = lazyRetry(() => import("./pages/ShipperDashboardPage"));
const RiderDashboardPage = lazyRetry(() => import("./pages/RiderDashboardPage"));
const SearchPage = lazyRetry(() => import("./pages/SearchPage"));
const WishlistPage = lazyRetry(() => import("./pages/WishlistPage"));
const SharedWishlistPage = lazyRetry(() => import("./pages/SharedWishlistPage"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const AboutPage = lazyRetry(() => import("./pages/AboutPage"));
const FAQPage = lazyRetry(() => import("./pages/FAQPage"));
const HelpCenterPage = lazyRetry(() => import("./pages/HelpCenterPage"));
const TermsPage = lazyRetry(() => import("./pages/TermsPage"));
const PrivacyPage = lazyRetry(() => import("./pages/PrivacyPage"));
const TrackingPage = lazyRetry(() => import("./pages/TrackingPage"));
const BecomeVendorPage = lazyRetry(() => import("./pages/BecomeVendorPage"));
const BannedPage = lazyRetry(() => import("./pages/BannedPage"));
const DriverPage = lazyRetry(() => import("./pages/DriverPage"));
const AffiliateProgramPage = lazyRetry(() => import("./pages/AffiliateProgramPage"));
const LoyaltyProgramPage = lazyRetry(() => import("./pages/LoyaltyProgramPage"));
const CareersPage = lazyRetry(() => import("./pages/CareersPage"));
const SocialResponsibilityPage = lazyRetry(() => import("./pages/SocialResponsibilityPage"));
const BlogPage = lazyRetry(() => import("./pages/BlogPage"));
const BlogPostPage = lazyRetry(() => import("./pages/BlogPostPage"));
const ComparePage = lazyRetry(() => import("./pages/ComparePage"));
const AccountPage = lazyRetry(() => import("./pages/AccountPage"));
const PaymentReturnPage = lazyRetry(() => import("./pages/PaymentReturnPage"));
const OnboardingPage = lazyRetry(() => import("./pages/OnboardingPage"));
const PricingPage = lazyRetry(() => import("./pages/PricingPage"));
const TrendsPage = lazyRetry(() => import("./pages/TrendsPage"));
const PopularPage = lazyRetry(() => import("./pages/PopularPage"));
const CarrierDashboardPage = lazyRetry(() => import("./pages/CarrierDashboardPage"));

// Admin pages
const AdminDashboard = lazyRetry(() => import("./pages/admin/AdminDashboard"));
const AdminUsersPage = lazyRetry(() => import("./pages/admin/AdminUsersPage"));
const AdminCMSPage = lazyRetry(() => import("./pages/admin/AdminCMSPage"));
const AdminCategoriesPage = lazyRetry(() => import("./pages/admin/AdminCategoriesPage"));
const AdminOrdersPage = lazyRetry(() => import("./pages/admin/AdminOrdersPage"));
const AdminLogisticsPage = lazyRetry(() => import("./pages/admin/AdminLogisticsPage"));
const AdminForwardersPage = lazyRetry(() => import("./pages/admin/AdminForwardersPage"));
const AdminNotificationsPage = lazyRetry(() => import("./pages/admin/AdminNotificationsPage"));
const AdminSettingsPage = lazyRetry(() => import("./pages/admin/AdminSettingsPage"));
const AdminShippingPage = lazyRetry(() => import("./pages/admin/AdminShippingPage"));
const AdminGeographyPage = lazyRetry(() => import("./pages/admin/AdminGeographyPage"));
const AdminVendorApplicationsPage = lazyRetry(() => import("./pages/admin/AdminVendorApplicationsPage"));
const AdminStoreNamesPage = lazyRetry(() => import("./pages/admin/AdminStoreNamesPage"));
const AdminVendorSubscriptionsPage = lazyRetry(() => import("./pages/admin/AdminVendorSubscriptionsPage"));
const AdminVendorPricingPage = lazyRetry(() => import("./pages/admin/AdminVendorPricingPage"));
const AdminAuditPage = lazyRetry(() => import("./pages/admin/AdminAuditPage"));
const AdminLoyaltyPage = lazyRetry(() => import("./pages/admin/AdminLoyaltyPage"));
const AdminPointsPage = lazyRetry(() => import("./pages/admin/AdminPointsPage"));
const AdminCouponsPage = lazyRetry(() => import("./pages/admin/AdminCouponsPage"));
const AdminWithdrawalsPage = lazyRetry(() => import("./pages/admin/AdminWithdrawalsPage"));
const AdminReturnsPage = lazyRetry(() => import("./pages/admin/AdminReturnsPage"));
const AdminDisputesPage = lazyRetry(() => import("./pages/admin/AdminDisputesPage"));
const AdminExchangeRatesPage = lazyRetry(() => import("./pages/admin/AdminExchangeRatesPage"));
const AdminAffiliateTiersPage = lazyRetry(() => import("./pages/admin/AdminAffiliateTiersPage"));
const AdminSEOPage = lazyRetry(() => import("./pages/admin/AdminSEOPage"));
const AdminCountriesPage = lazyRetry(() => import("./pages/admin/AdminCountriesPage"));
const AdminPopupsPage = lazyRetry(() => import("./pages/admin/AdminPopupsPage"));
const AdminSupportPage = lazyRetry(() => import("./pages/admin/AdminSupportPage"));
const AdminProductModerationPage = lazyRetry(() => import("./pages/admin/AdminProductModerationPage"));
const AdminReviewModerationPage = lazyRetry(() => import("./pages/admin/AdminReviewModerationPage"));
const AdminVariantTypesPage = lazyRetry(() => import("./pages/admin/AdminVariantTypesPage"));
const AdminAnalyticsPage = lazyRetry(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminEmailTemplatesPage = lazyRetry(() => import("./pages/admin/AdminEmailTemplatesPage"));
const AdminKycPage = lazyRetry(() => import("./pages/admin/AdminKycPage"));
const AdminKybKycV2Page = lazyRetry(() => import("./pages/admin/AdminKybKycV2Page"));
const AdminFeaturedPlacementsPage = lazyRetry(() => import("./pages/admin/AdminFeaturedPlacementsPage"));
const AdminVendorAccountingPage = lazyRetry(() => import("./pages/admin/AdminVendorAccountingPage"));
const AdminFlashSalesPage = lazyRetry(() => import("./pages/admin/AdminFlashSalesPage"));
const AdminSupplierPlatformsPage = lazyRetry(() => import("./pages/admin/AdminSupplierPlatformsPage"));
const AdminStoreModerationPage = lazyRetry(() => import("./pages/admin/AdminStoreModerationPage"));
const AdminStoreTransfersPage = lazyRetry(() => import("./pages/admin/AdminStoreTransfersPage"));
const AdminOperatorsPage = lazyRetry(() => import("./pages/admin/AdminOperatorsPage"));
const AdminOperatorQuotaRequestsPage = lazyRetry(() => import("./pages/admin/AdminOperatorQuotaRequestsPage"));
const AdminOperatorRateCapsPage = lazyRetry(() => import("./pages/admin/AdminOperatorRateCapsPage"));
const AdminOperatorRatesPendingPage = lazyRetry(() => import("./pages/admin/AdminOperatorRatesPendingPage"));
const AdminOperatorRatesPage = lazyRetry(() => import("./pages/admin/AdminOperatorRatesPage"));
const AdminCoverageRequestsPage = lazyRetry(() => import("./pages/admin/AdminCoverageRequestsPage"));
const AdminOperatorsPerformancePage = lazyRetry(() => import("./pages/admin/AdminOperatorsPerformancePage"));
const AdminStoreChangeRequestsPage = lazyRetry(() => import("./pages/admin/AdminStoreChangeRequestsPage"));
const AdminServicePlansPage = lazyRetry(() => import("./pages/admin/AdminServicePlansPage"));
const AdminDeliveryPlansPage = lazyRetry(() => import("./pages/admin/AdminDeliveryPlansPage"));
const AdminServicePackagesPage = lazyRetry(() => import("./pages/admin/AdminServicePackagesPage"));
const AdminErrorReportsPage = lazyRetry(() => import("./pages/admin/AdminErrorReportsPage"));
const ImpersonatePage = lazyRetry(() => import("./pages/ImpersonatePage"));
const SourcingPage = lazyRetry(() => import("./pages/SourcingPage"));
const AdminProductSourcingPage = lazyRetry(() => import("./pages/admin/AdminProductSourcingPage"));

// Operator (Lot 11B Phase B2)
const BecomeOperatorPage = lazyRetry(() => import("./pages/BecomeOperatorPage"));
const BecomeForwarderPage = lazyRetry(() => import("./pages/BecomeForwarderPage"));
const OperatorLayout = lazyRetry(() => import("./layouts/OperatorLayout"));
const OperatorDashboardPage = lazyRetry(() => import("./pages/operator/OperatorDashboardPage"));
const OperatorOrdersPage = lazyRetry(() => import("./pages/operator/OperatorOrdersPage"));
const OperatorFleetPage = lazyRetry(() => import("./pages/operator/OperatorFleetPage"));
const OperatorCoveragePage = lazyRetry(() => import("./pages/operator/OperatorCoveragePage"));
const OperatorRatesPage = lazyRetry(() => import("./pages/operator/OperatorRatesPage"));
const OperatorBillingPage = lazyRetry(() => import("./pages/operator/OperatorBillingPage"));
const OperatorSettingsPage = lazyRetry(() => import("./pages/operator/OperatorSettingsPage"));
const ForwarderDashboardPage = lazyRetry(() => import("./pages/forwarder/ForwarderDashboardPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false } },
});

function SupportDrawerWrapper() {
  const { open, setOpen } = useSupportDrawer();
  return <SupportDrawer open={open} onOpenChange={setOpen} />;
}

/** Single bootstrap call → feeds branding/seo/themes/topbar/footer/geo etc. */
function PlatformBootstrap() { usePlatformBootstrap(); return null; }
function CmsThemeInjector() { useCmsTheme(); usePlatformFont(); return null; }

function GeoBlockGuard({ children }: { children: React.ReactNode }) {
  const { blocked, loading } = useGeoBlocking();
  if (loading) return null;
  if (blocked) return <GeoBlockScreen />;
  return <>{children}</>;
}

// Analytics is injected inside Router via a lazy component
import { useAnalyticsTracker, trackPWAPresence } from "@/hooks/use-analytics";
import { useAuth } from "@/contexts/AuthContext";
function AnalyticsTrackerInjector() {
  useAnalyticsTracker();
  const { user } = useAuth();
  // Track PWA presence on every session (persists across updates)
  useEffect(() => {
    trackPWAPresence(user?.id);
  }, [user?.id]);
  return null;
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
    <TooltipProvider>
      <AuthProvider>
        <PlatformBootstrap />
        <GeoBlockGuard>
        <ImpersonationProvider>
        <ImpersonationBanner />
        <CartProvider>
          <WishlistProvider>
          <CompareProvider>
          <I18nProvider>
          <ThemeProvider>
          <UIConfigProvider>
            <ErrorBoundary><CmsThemeInjector /></ErrorBoundary>
            <AnalyticsTrackerInjector />
            <DynamicFavicon />
            <UserPresenceTracker />
            <Toaster />
            <Sonner />
            <NotificationListener />
            <OrderAlertListener />
            <SupportDrawerProvider>
            <ScrollRestoration />
             <CartDrawer />
            <CompareBar />
            <SupportDrawerWrapper />
            <MobileBottomNav />
            <PWAInstallBanner />
            <PWAUpdatePrompt />
            <OfflineIndicator />
            <CookieConsent />
            <AnnouncementPopup />
            <AutomationPopup />
            <MaintenanceGuard>
            <BanGuard>
            <Suspense fallback={<PageLoadingSkeleton />}>
              <Routes>
                <Route path="/banned" element={<BannedPage />} />
                <Route path="/" element={<Index />} />
                <Route path="/product/:slug" element={<ProductPage />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/stores" element={<StoresPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/popular" element={<PopularPage />} />
                <Route path="/store/:id" element={<StorePage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/payment/return" element={<PaymentReturnPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/vendor" element={<VendorDashboardPage />} />
                <Route path="/shipper" element={<ShipperDashboardPage />} />
                <Route path="/rider" element={<RiderDashboardPage />} />
                <Route path="/carrier" element={<CarrierDashboardPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/wishlist/shared/:userId" element={<SharedWishlistPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/help-center" element={<HelpCenterPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/tracking" element={<TrackingPage />} />
                <Route path="/tracking/:ref" element={<TrackingPage />} />
                <Route path="/become-vendor" element={<BecomeVendorPage />} />
                <Route path="/driver" element={<DriverPage />} />
                <Route path="/affiliate-program" element={<AffiliateProgramPage />} />
                <Route path="/loyalty-program" element={<LoyaltyProgramPage />} />
                <Route path="/careers" element={<CareersPage />} />
                <Route path="/social-responsibility" element={<SocialResponsibilityPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/sourcing" element={<SourcingPage />} />
                {/* Admin routes */}
                <Route path="/admin" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminDashboard /></RoleGuard>} />
                <Route path="/admin/users" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminUsersPage /></RoleGuard>} />
                <Route path="/admin/cms" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminCMSPage /></RoleGuard>} />
                <Route path="/admin/categories" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminCategoriesPage /></RoleGuard>} />
                <Route path="/admin/variant-types" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminVariantTypesPage /></RoleGuard>} />
                <Route path="/admin/orders" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOrdersPage /></RoleGuard>} />
                <Route path="/admin/product-moderation" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminProductModerationPage /></RoleGuard>} />
                <Route path="/admin/review-moderation" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminReviewModerationPage /></RoleGuard>} />
                <Route path="/admin/support" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminSupportPage /></RoleGuard>} />
                <Route path="/admin/logistics" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminLogisticsPage /></RoleGuard>} />
                <Route path="/admin/forwarders" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminForwardersPage /></RoleGuard>} />
                <Route path="/admin/notifications" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminNotificationsPage /></RoleGuard>} />
                <Route path="/admin/settings" element={<RoleGuard allowedRoles={["admin"]}><AdminSettingsPage /></RoleGuard>} />
                <Route path="/admin/shipping" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminShippingPage /></RoleGuard>} />
                <Route path="/admin/geography" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminGeographyPage /></RoleGuard>} />
                <Route path="/admin/vendor-applications" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminVendorApplicationsPage /></RoleGuard>} />
                <Route path="/admin/store-names" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminStoreNamesPage /></RoleGuard>} />
                <Route path="/admin/vendor-subscriptions" element={<RoleGuard allowedRoles={["admin"]}><AdminVendorSubscriptionsPage /></RoleGuard>} />
                <Route path="/admin/vendor-pricing" element={<RoleGuard allowedRoles={["admin"]}><AdminVendorPricingPage /></RoleGuard>} />
                <Route path="/admin/audit" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminAuditPage /></RoleGuard>} />
                <Route path="/admin/error-reports" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminErrorReportsPage /></RoleGuard>} />
                <Route path="/admin/sourcing" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminProductSourcingPage /></RoleGuard>} />
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
                <Route path="/admin/analytics" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminAnalyticsPage /></RoleGuard>} />
                <Route path="/admin/email-templates" element={<RoleGuard allowedRoles={["admin"]}><AdminEmailTemplatesPage /></RoleGuard>} />
                <Route path="/admin/kyc" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminKycPage /></RoleGuard>} />
                <Route path="/admin/kyb-kyc-v2" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminKybKycV2Page /></RoleGuard>} />
                <Route path="/admin/featured-placements" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminFeaturedPlacementsPage /></RoleGuard>} />
                <Route path="/admin/vendor-accounting" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminVendorAccountingPage /></RoleGuard>} />
                <Route path="/admin/flash-sales" element={<RoleGuard allowedRoles={["admin"]}><AdminFlashSalesPage /></RoleGuard>} />
                <Route path="/admin/supplier-platforms" element={<RoleGuard allowedRoles={["admin"]}><AdminSupplierPlatformsPage /></RoleGuard>} />
                <Route path="/admin/store-moderation" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminStoreModerationPage /></RoleGuard>} />
                <Route path="/admin/store-transfers" element={<RoleGuard allowedRoles={["admin"]}><AdminStoreTransfersPage /></RoleGuard>} />
                <Route path="/admin/operators" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOperatorsPage /></RoleGuard>} />
                <Route path="/admin/operator-quota-requests" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOperatorQuotaRequestsPage /></RoleGuard>} />
                <Route path="/admin/operator-rate-caps" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOperatorRateCapsPage /></RoleGuard>} />
                <Route path="/admin/operator-rates-pending" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOperatorRatesPendingPage /></RoleGuard>} />
                <Route path="/admin/operators/:operatorId/rates" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOperatorRatesPage /></RoleGuard>} />
                <Route path="/admin/operators-performance" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminOperatorsPerformancePage /></RoleGuard>} />
                <Route path="/admin/coverage-requests" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminCoverageRequestsPage /></RoleGuard>} />
                <Route path="/admin/store-change-requests" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminStoreChangeRequestsPage /></RoleGuard>} />
                <Route path="/admin/service-plans" element={<RoleGuard allowedRoles={["admin"]}><AdminServicePlansPage /></RoleGuard>} />
                <Route path="/admin/delivery-plans" element={<RoleGuard allowedRoles={["admin", "manager"]}><AdminDeliveryPlansPage /></RoleGuard>} />
                <Route path="/admin/service-packages" element={<RoleGuard allowedRoles={["admin"]}><AdminServicePackagesPage /></RoleGuard>} />
                <Route path="/impersonate" element={<ImpersonatePage />} />
                {/* Operator (Lot 11B Phase B2) */}
                <Route path="/become-operator" element={<BecomeOperatorPage />} />
                <Route path="/become-forwarder" element={<BecomeForwarderPage />} />
                <Route
                  path="/operator"
                  element={
                    <RoleGuard allowedRoles={["operator", "admin", "manager"]}>
                      <OperatorLayout />
                    </RoleGuard>
                  }
                >
                  <Route index element={<OperatorDashboardPage />} />
                  <Route path="orders" element={<OperatorOrdersPage />} />
                  <Route path="fleet" element={<OperatorFleetPage />} />
                  <Route path="coverage" element={<OperatorCoveragePage />} />
                  <Route path="rates" element={<OperatorRatesPage />} />
                  <Route path="billing" element={<OperatorBillingPage />} />
                  <Route path="settings" element={<OperatorSettingsPage />} />
                </Route>
                <Route
                  path="/forwarder"
                  element={
                    <RoleGuard allowedRoles={["forwarder", "admin", "manager"]}>
                      <ForwarderDashboardPage />
                    </RoleGuard>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </BanGuard>
            </MaintenanceGuard>
            </SupportDrawerProvider>
          </UIConfigProvider>
          </ThemeProvider>
          </I18nProvider>
          </CompareProvider>
          </WishlistProvider>
        </CartProvider>
        </ImpersonationProvider>
        </GeoBlockGuard>
      </AuthProvider>
    </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
