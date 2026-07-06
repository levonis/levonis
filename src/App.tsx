// App component - main application entry point - v11 (premium loading)
import { Suspense, useEffect, useState } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import LanguageProvider from "@/components/LanguageProvider";
import { useLanguage } from "@/lib/i18n";
import ScrollRestoration from "@/components/ScrollRestoration";
import { CartProvider } from "@/hooks/useCart";
import AdminRoute from "@/components/AdminRoute";

// Defer chrome and non-critical hooks for faster first paint on mobile
import AppNavBar from "@/components/AppNavBar";
const DeferredEffects = lazyWithRetry(() => import("@/components/DeferredEffects"));
import { IslandProvider, useIsland } from "@/island/IslandContext";
import { PageSearchProvider } from "@/island/PageSearchContext";
import { useGlobalNavSearchItems } from "@/island/useGlobalNavSearchItems";
import { DynamicIsland } from "@/island/DynamicIsland";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireCommunityProfile from "@/components/auth/RequireCommunityProfile";
import NativeAuthGate from "@/components/auth/NativeAuthGate";
// EmailVerificationBanner available for post-login verification
const AppBackground = lazyWithRetry(() => import("@/components/AppBackground"));
const ProfileOrb = lazyWithRetry(() => import("@/components/ProfileOrb"));
import ProfileExpansionShell from "@/components/ProfileExpansionShell";
import { ProfileTransitionProvider } from "@/components/ProfileTransitionProvider";


// Lazy load unified chat button (global floating button)
const UnifiedChatButton = lazyWithRetry(() => import("@/components/UnifiedChatButton"));
const LevoHelpBot = lazyWithRetry(() => import("@/components/LevoHelpBot"));
const InstallPrompt = lazyWithRetry(() => import("@/components/pwa/InstallPrompt"));
const SpriteDebugPage = lazyWithRetry(() => import("@/components/games/SpriteDebug"));

// Keep the active landing route in the primary app graph. Lazy-loading the
// root route caused the production/preview proxy to occasionally fail fetching
// /src/pages/Home.tsx as a dynamic module, leaving users on the static fallback
// screen. Other routes remain lazy-loaded behind Suspense.
import Home from "./pages/Home";
const SearchResults = lazyWithRetry(() => import("./pages/SearchResults"));

const ProductDetail = lazyWithRetry(() => import("./pages/ProductDetail"));
// Categories landing page removed — /categories now redirects to /
const CategoryDetail = lazyWithRetry(() => import("./pages/CategoryDetail"));
const Cart = lazyWithRetry(() => import("./pages/Cart"));
const UserInfo = lazyWithRetry(() => import("./pages/UserInfo"));
const Favorites = lazyWithRetry(() => import("./pages/Favorites"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const NotificationSettings = lazyWithRetry(() => import("./pages/NotificationSettings"));
const TelegramSettings = lazyWithRetry(() => import("./pages/TelegramSettings"));
const MyCustomRequests = lazyWithRetry(() => import("./pages/MyCustomRequests"));
const UserAddresses = lazyWithRetry(() => import("./pages/UserAddresses"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const AdminNotifications = lazyWithRetry(() => import("./pages/AdminNotifications"));
const AdminAnnouncements = lazyWithRetry(() => import("./pages/AdminAnnouncements"));
const AdminBanners = lazyWithRetry(() => import("./pages/AdminBanners"));
const AdminCoupons = lazyWithRetry(() => import("./pages/AdminCoupons"));
const MyOrders = lazyWithRetry(() => import("./pages/MyOrders"));
const Donations = lazyWithRetry(() => import("./pages/Donations"));
const OrderDetail = lazyWithRetry(() => import("./pages/OrderDetail"));
const AdminOrders = lazyWithRetry(() => import("./pages/AdminOrders"));
const AdminPointsSettings = lazyWithRetry(() => import("./pages/AdminPointsSettings"));
const AdminChats = lazyWithRetry(() => import("./pages/AdminChats"));
const AdminLoyaltyLevels = lazyWithRetry(() => import("./pages/AdminLoyaltyLevels"));
const AdminSubscriptionTiers = lazyWithRetry(() => import("./pages/AdminSubscriptionTiers"));
const AdminTradeInPrinters = lazyWithRetry(() => import("./pages/AdminTradeInPrinters"));
const AdminTradeInRequests = lazyWithRetry(() => import("./pages/AdminTradeInRequests"));
const MyTradeInRequests = lazyWithRetry(() => import("./pages/MyTradeInRequests"));
const AdminDefaultSettings = lazyWithRetry(() => import("./pages/AdminDefaultSettings"));
const AdminWallet = lazyWithRetry(() => import("./pages/AdminWallet"));
const AdminWalletSettings = lazyWithRetry(() => import("./pages/AdminWalletSettings"));
const AdminInvoiceTemplates = lazyWithRetry(() => import("./pages/AdminInvoiceTemplates"));
const AdminSavedInvoices = lazyWithRetry(() => import("./pages/AdminSavedInvoices"));
const AdminFinancials = lazyWithRetry(() => import("./pages/AdminFinancials"));
const AdminDonations = lazyWithRetry(() => import("./pages/AdminDonations"));
const AdminPartialPaymentSettings = lazyWithRetry(() => import("./pages/AdminPartialPaymentSettings"));
const DownloadApp = lazyWithRetry(() => import("./pages/DownloadApp"));
const AdminAppVersions = lazyWithRetry(() => import("./pages/admin/AdminAppVersions"));
const AdminPrinterAdvisor = lazyWithRetry(() => import("./pages/AdminPrinterAdvisor"));

const RewardsHub = lazyWithRetry(() => import("./pages/RewardsHub"));
const MyLevelPrizes = lazyWithRetry(() => import("./pages/MyLevelPrizes"));
const MyReferral = lazyWithRetry(() => import("./pages/MyReferral"));
const ConfirmDelivery = lazyWithRetry(() => import("./pages/ConfirmDelivery"));
const ProductShop = lazyWithRetry(() => import("./pages/ProductShop"));
const ProductsWithGifts = lazyWithRetry(() => import("./pages/ProductsWithGifts"));
const ProductOffersPage = lazyWithRetry(() => import("./pages/ProductOffersPage"));
const AdminCompetitions = lazyWithRetry(() => import("./pages/AdminCompetitions"));
const AdminProductOffers = lazyWithRetry(() => import("./pages/AdminProductOffers"));
const AdminTicketBundles = lazyWithRetry(() => import("./pages/AdminTicketBundles"));
const AdminShipmentRequests = lazyWithRetry(() => import("./pages/AdminShipmentRequests"));
const AdminShippingSettings = lazyWithRetry(() => import("./pages/AdminShippingSettings"));
const AdminCommunityMerchants = lazyWithRetry(() => import("./pages/AdminCommunityMerchants"));
const AdminBadgeSettings = lazyWithRetry(() => import("./pages/AdminBadgeSettings"));
const AdminAvatarFrames = lazyWithRetry(() => import("./pages/AdminAvatarFrames"));
const AdminLevoCommunity = lazyWithRetry(() => import("./pages/AdminLevoCommunity"));
const AdminCommunityCustomers = lazyWithRetry(() => import("./pages/AdminCommunityCustomers"));
const AdminCommunityComplaints = lazyWithRetry(() => import("./pages/AdminCommunityComplaints"));
const AdminCommunityMessages = lazyWithRetry(() => import("./pages/AdminCommunityMessages"));
const CommunityMessages = lazyWithRetry(() => import("./pages/CommunityMessages"));
const CommunityCustomerDashboard = lazyWithRetry(() => import("./pages/CommunityCustomerDashboard"));
const CommunityMerchantProfessionalDashboard = lazyWithRetry(() => import("./pages/CommunityMerchantProfessionalDashboard"));
const CommunityCustomerNewRequest = lazyWithRetry(() => import("./pages/CommunityCustomerNewRequest"));
const CommunityCustomerRequests = lazyWithRetry(() => import("./pages/CommunityCustomerRequests"));
const CommunityCustomerProfile = lazyWithRetry(() => import("./pages/CommunityCustomerProfile"));
const CommunityCustomerTrack = lazyWithRetry(() => import("./pages/CommunityCustomerTrack"));
const CommunityMerchantsProducts = lazyWithRetry(() => import("./pages/CommunityMerchantsProducts"));
const CommunityRequestsBrowse = lazyWithRetry(() => import("./pages/CommunityRequestsBrowse"));
const CommunityMerchantsPages = lazyWithRetry(() => import("./pages/CommunityMerchantsPages"));
const CommunityMerchantSignup = lazyWithRetry(() => import("./pages/CommunityMerchantSignup"));
const CommunityMerchantStore = lazyWithRetry(() => import("./pages/CommunityMerchantStore"));
const CommunityMerchantOrders = lazyWithRetry(() => import("./pages/CommunityMerchantOrders"));
const CommunityAllMerchantsProducts = lazyWithRetry(() => import("./pages/CommunityAllMerchantsProducts"));
const CommunityMerchantStorePage = lazyWithRetry(() => import("./pages/CommunityMerchantStorePage"));
const MerchantStandalone = lazyWithRetry(() => import("./pages/MerchantStandalone"));
const PublicProfile = lazyWithRetry(() => import("./pages/PublicProfile"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const ProfileSettings = lazyWithRetry(() => import("./pages/ProfileSettings"));
const SellerProfile = lazyWithRetry(() => import("./pages/SellerProfile"));
const MyPurchasedProducts = lazyWithRetry(() => import("./pages/MyPurchasedProducts"));
const MyOfferPurchases = lazyWithRetry(() => import("./pages/MyOfferPurchases"));
const AdminOfferPurchases = lazyWithRetry(() => import("./pages/AdminOfferPurchases"));
const AdminRedeemableProducts = lazyWithRetry(() => import("./pages/AdminRedeemableProducts"));
const AdminCartRequests = lazyWithRetry(() => import("./pages/AdminCartRequests"));
const AdminUsers = lazyWithRetry(() => import("./pages/AdminUsers"));
const CommunityHome = lazyWithRetry(() => import("./pages/CommunityHome"));
const CommunityQuoteFromLink = lazyWithRetry(() => import("./pages/CommunityQuoteFromLink"));
const OffersStoragePage = lazyWithRetry(() => import("./pages/OffersStoragePage"));
const ChatOrderCheckout = lazyWithRetry(() => import("./pages/ChatOrderCheckout"));
const CompetitionHistory = lazyWithRetry(() => import("./pages/CompetitionHistory"));
const ReelsPage = lazyWithRetry(() => import("./pages/ReelsPage"));
const AdminStories = lazyWithRetry(() => import("./pages/AdminStories"));
const AdminDeliveredOrders = lazyWithRetry(() => import("./pages/AdminDeliveredOrders"));
const AdminGiveawaysCoupons = lazyWithRetry(() => import("./pages/AdminGiveawaysCoupons"));
const AdminGamesSettings = lazyWithRetry(() => import("./pages/AdminGamesSettings"));
const AdminPriceMatch = lazyWithRetry(() => import("./pages/AdminPriceMatch"));
const AdminPrintMaterials = lazyWithRetry(() => import("./pages/AdminPrintMaterials"));

const AdminWishes = lazyWithRetry(() => import("./pages/AdminWishes"));
const AdminProductBundles = lazyWithRetry(() => import("./pages/AdminProductBundles"));
const AdminFinancialDrafts = lazyWithRetry(() => import("./pages/AdminFinancialDrafts"));
const AdminInventory = lazyWithRetry(() => import("./pages/AdminInventory"));
const AdminAssistants = lazyWithRetry(() => import("./pages/AdminAssistants"));
const AdminReviews = lazyWithRetry(() => import("./pages/AdminReviews"));
const AdminPriceProtection = lazyWithRetry(() => import("./pages/AdminPriceProtection"));
const PriceProtection = lazyWithRetry(() => import("./pages/PriceProtection"));
const AdminWinners = lazyWithRetry(() => import("./pages/AdminWinners"));
const AdminProductColorQa = lazyWithRetry(() => import("./pages/AdminProductColorQa"));
const AdminRandomFilament = lazyWithRetry(() => import("./pages/AdminRandomFilament"));
const AdminRandomFilamentTargeting = lazyWithRetry(() => import("./pages/AdminRandomFilamentTargeting"));
const RandomFilament = lazyWithRetry(() => import("./pages/RandomFilament"));
const Wishes = lazyWithRetry(() => import("./pages/Wishes"));
const MerchantGiveaways = lazyWithRetry(() => import("./pages/MerchantGiveaways"));
const MiniGames = lazyWithRetry(() => import("./pages/MiniGames"));
const GameWinnersPage = lazyWithRetry(() => import("./pages/GameWinnersPage"));
const GameWinnersArchive = lazyWithRetry(() => import("./pages/GameWinnersArchive"));
const CustomerSpecialCoupons = lazyWithRetry(() => import("./pages/CustomerSpecialCoupons"));
const CommunityCart = lazyWithRetry(() => import("./pages/CommunityCart"));
const ProductBundles = lazyWithRetry(() => import("./pages/ProductBundles"));
const BundleDetail = lazyWithRetry(() => import("./pages/BundleDetail"));
const ActivatePrinter = lazyWithRetry(() => import("./pages/ActivatePrinter"));
const WarrantyDashboard = lazyWithRetry(() => import("./pages/WarrantyDashboard"));
const AdminPrinterProtection = lazyWithRetry(() => import("./pages/AdminPrinterProtection"));

const AdminLevoCards = lazyWithRetry(() => import("./pages/AdminLevoCards"));
const AdminLevoCardOrders = lazyWithRetry(() => import("./pages/AdminLevoCardOrders"));
const AdminUserCardCycles = lazyWithRetry(() => import("./pages/AdminUserCardCycles"));
const AdminProtectionPlanBenefits = lazyWithRetry(() => import("./pages/AdminProtectionPlanBenefits"));
const AdminChunkErrors = lazyWithRetry(() => import("./pages/AdminChunkErrors"));
const AdminUrlAnalytics = lazyWithRetry(() => import("./pages/AdminUrlAnalytics"));
const StlLibrary = lazyWithRetry(() => import("./pages/StlLibrary"));
const StlFileDetails = lazyWithRetry(() => import("./pages/StlFileDetails"));
const StlLibraryUpload = lazyWithRetry(() => import("./pages/StlLibraryUpload"));
const AdminStlLibrary = lazyWithRetry(() => import("./pages/AdminStlLibrary"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const About = lazyWithRetry(() => import("./pages/About"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const Faq = lazyWithRetry(() => import("./pages/Faq"));
const BambuVsCreality = lazyWithRetry(() => import("./pages/guides/BambuVsCreality"));

import PageFade from "@/components/PageFade";
import TopProgressBar from "@/components/TopProgressBar";
import PrefetchOnHover from "@/components/PrefetchOnHover";
import ViewTransitions from "@/components/ViewTransitions";
import ImageQualityBoost from "@/components/ImageQualityBoost";
import RouteAwareSkeleton from "@/components/RouteAwareSkeleton";
import ChunkReloadBoundary from "@/components/ChunkReloadBoundary";

function RouteSuspenseFallback() {
  return <RouteAwareSkeleton />;
}


function DeferredGlobalNavSearch() {
  useGlobalNavSearchItems();
  return null;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { visible: islandVisible } = useIsland();
  const { t } = useLanguage();
  const [mountedSearch, setMountedSearch] = useState(false);
  useEffect(() => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: any) => number)
      | undefined;
    const cb = () => setMountedSearch(true);
    const id = ric ? ric(cb, { timeout: 2000 }) : window.setTimeout(cb, 800);
    return () => {
      if (ric && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(id);
      else clearTimeout(id as number);
    };
  }, []);
  const isGamesPage = location.pathname === "/games";
  const isReelsPage = location.pathname.startsWith("/community/reels");
  const isAuthPage = location.pathname === "/auth";
  const isStandaloneStore = location.pathname.startsWith("/s/");
  const isAdminInventory = location.pathname.startsWith(`${ADMIN_BASE_PATH}/inventory`);
  const hideChrome = isGamesPage || isReelsPage || isAuthPage || isStandaloneStore || isAdminInventory;

  useEffect(() => {
    if (isReelsPage) return;

    document.body.style.overflow = "";
    document.body.style.overflowY = "";
    document.body.style.position = "";
    document.body.style.inset = "";
    document.body.style.width = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.overflowY = "";
  }, [location.pathname, isReelsPage]);

  // Wildcard subdomain support: <slug>.levonisiq.com → /s/<slug>
  // Only triggers on actual subdomains (skips id-preview, www, root).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const RESERVED = new Set([
      "levonisiq.com",
      "www.levonisiq.com",
      "levonis.lovable.app",
    ]);
    if (RESERVED.has(host)) return;
    if (host.includes("lovable.app") || host.includes("localhost")) return;
    const parts = host.split(".");
    // Only treat as merchant subdomain if exactly: <slug>.levonisiq.com
    if (parts.length === 3 && parts[1] === "levonisiq" && parts[2] === "com") {
      const slug = parts[0];
      if (slug && slug !== "www" && !location.pathname.startsWith("/s/")) {
        navigate(`/s/${slug}${location.pathname === "/" ? "" : location.pathname}`, {
          replace: true,
        });
      }
    }
  }, [navigate, location.pathname]);

  // Padding mirrors island visibility so the layout breathes in/out smoothly.
  const mainPaddingTop = hideChrome || !islandVisible ? 0 : 64;

  return (
    <>
      <Suspense fallback={null}>
        <AppBackground />
      </Suspense>
      <ScrollRestoration />
      <TopProgressBar />
      <PrefetchOnHover />
      <ViewTransitions />
      <ImageQualityBoost />
      {mountedSearch && <DeferredGlobalNavSearch />}
      <Suspense fallback={null}>
        <DeferredEffects />
      </Suspense>
      {!isAuthPage && !isStandaloneStore && <DynamicIsland />}
      {!isAuthPage && !isStandaloneStore && (
        <Suspense fallback={null}>
          <ProfileOrb />
        </Suspense>
      )}
      {!isAuthPage && !isStandaloneStore && (
        <ProfileExpansionShell>
          <Suspense fallback={null}>
            <RequireAuth>
              <Profile />
            </RequireAuth>
          </Suspense>
        </ProfileExpansionShell>
      )}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:shadow-lg"
      >
        {t('a11y_skip_to_main')}
      </a>
      <main
        id="main-content"
        style={{ paddingTop: mainPaddingTop }}
        className="relative z-10 transition-[padding] duration-300 ease-[cubic-bezier(.32,.72,0,1)]"
      >
        <Suspense fallback={<RouteSuspenseFallback />}>
          <ChunkReloadBoundary fallback={<RouteSuspenseFallback />}>
          <PageFade>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/guides/bambu-lab-vs-creality" element={<BambuVsCreality />} />
            <Route path="/search" element={<SearchResults />} />
            
            <Route path="/index" element={<Navigate to="/" replace />} />
            <Route path="/products" element={<Navigate to="/" replace />} />
            <Route path="/products/*" element={<Navigate to="/" replace />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/categories" element={<Navigate to="/" replace />} />
            <Route path="/category/:slug" element={<CategoryDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/bundles" element={<ProductBundles />} />
            <Route path="/bundles/:id" element={<BundleDetail />} />
            <Route path="/user-info" element={<UserInfo />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/telegram-settings" element={<TelegramSettings />} />
            <Route path="/my-requests" element={<MyCustomRequests />} />
            <Route path="/addresses" element={<UserAddresses />} />
            <Route path="/my-orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
            <Route path="/order/:orderId" element={<RequireAuth><OrderDetail /></RequireAuth>} />
            <Route path="/my-orders/:orderId/confirm" element={<RequireAuth><ConfirmDelivery /></RequireAuth>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/download-app" element={<DownloadApp />} />
            <Route path="/download" element={<DownloadApp />} />
            <Route path={`${ADMIN_BASE_PATH}/app-versions`} element={<AdminRoute><AdminAppVersions /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/printer-advisor`} element={<AdminRoute><AdminPrinterAdvisor /></AdminRoute>} />

            
            {/* Secure Admin Routes - Using obfuscated path */}
            <Route path={ADMIN_BASE_PATH} element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/url-analytics`} element={<AdminRoute><AdminUrlAnalytics /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/notifications`} element={<AdminRoute><AdminNotifications /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/announcements`} element={<AdminRoute><AdminAnnouncements /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/banners`} element={<AdminRoute><AdminBanners /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/coupons`} element={<AdminRoute><AdminCoupons /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/orders`} element={<AdminRoute><AdminOrders /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/points-settings`} element={<AdminRoute><AdminPointsSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/subscription-tiers`} element={<AdminRoute><AdminSubscriptionTiers /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/chats`} element={<AdminRoute><AdminChats /></AdminRoute>} />

            <Route path={`${ADMIN_BASE_PATH}/loyalty-levels`} element={<AdminRoute><AdminLoyaltyLevels /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/default-settings`} element={<AdminRoute><AdminDefaultSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/wallet`} element={<AdminRoute><AdminWallet /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/wallet-settings`} element={<AdminRoute><AdminWalletSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/invoice-templates`} element={<AdminRoute><AdminInvoiceTemplates /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/saved-invoices`} element={<AdminRoute><AdminSavedInvoices /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/financials`} element={<AdminRoute requireFullAdmin><AdminFinancials /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/assistants`} element={<AdminRoute requireFullAdmin><AdminAssistants /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/donations`} element={<AdminRoute><AdminDonations /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/partial-payment-settings`} element={<AdminRoute><AdminPartialPaymentSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/competitions`} element={<AdminRoute><AdminCompetitions /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/product-offers`} element={<AdminRoute><AdminProductOffers /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/ticket-bundles`} element={<AdminRoute><AdminTicketBundles /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/shipment-requests`} element={<AdminRoute><AdminShipmentRequests /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/offer-purchases`} element={<AdminRoute><AdminOfferPurchases /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/shipping-settings`} element={<AdminRoute><AdminShippingSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/redeemable-products`} element={<AdminRoute><AdminRedeemableProducts /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/cart-requests`} element={<AdminRoute><AdminCartRequests /></AdminRoute>} />
            {/* Levo Community Management */}
            <Route path={`${ADMIN_BASE_PATH}/levo-community`} element={<AdminRoute><AdminLevoCommunity /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/levo-community/merchants`} element={<AdminRoute><AdminCommunityMerchants /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/levo-community/customers`} element={<AdminRoute><AdminCommunityCustomers /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/levo-community/complaints`} element={<AdminRoute><AdminCommunityComplaints /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/levo-community/messages`} element={<AdminRoute><AdminCommunityMessages /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/levo-community/badge-settings`} element={<AdminRoute><AdminBadgeSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/levo-community/avatar-frames`} element={<AdminRoute><AdminAvatarFrames /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/users`} element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/stories`} element={<AdminRoute><AdminStories /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/delivered-orders`} element={<AdminRoute><AdminDeliveredOrders /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/giveaways-coupons`} element={<AdminRoute><AdminGiveawaysCoupons /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/games-settings`} element={<AdminRoute><AdminGamesSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/wishes`} element={<AdminRoute><AdminWishes /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/price-match`} element={<AdminRoute><AdminPriceMatch /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/print-materials`} element={<AdminRoute><AdminPrintMaterials /></AdminRoute>} />

            <Route path={`${ADMIN_BASE_PATH}/product-bundles`} element={<AdminRoute><AdminProductBundles /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/financial-drafts`} element={<AdminRoute requireFullAdmin><AdminFinancialDrafts /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/inventory`} element={<AdminRoute requireFullAdmin><AdminInventory /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/reviews`} element={<AdminRoute><AdminReviews /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/price-protection`} element={<AdminRoute><AdminPriceProtection /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/winners`} element={<AdminRoute><AdminWinners /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/product-color-qa`} element={<AdminRoute><AdminProductColorQa /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/random-filament`} element={<AdminRoute><AdminRandomFilament /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/random-filament-targeting`} element={<AdminRoute><AdminRandomFilamentTargeting /></AdminRoute>} />
            {/* Block old /admin paths - redirect to 404 to prevent enumeration */}
            <Route path="/admin/*" element={<NotFound />} />
            <Route path="/admin" element={<NotFound />} />
            
            {/* Community (requires login + complete profile) */}
            <Route path="/community" element={<RequireCommunityProfile><CommunityHome /></RequireCommunityProfile>} />
            <Route path="/community/reels" element={<ReelsPage />} />
            <Route path="/community/messages" element={<RequireAuth><CommunityMessages /></RequireAuth>} />
            <Route path="/chats" element={<RequireAuth><CommunityMessages /></RequireAuth>} />
            <Route path="/community/customer/dashboard" element={<RequireCommunityProfile><CommunityCustomerDashboard /></RequireCommunityProfile>} />
            <Route path="/community/merchant/dashboard" element={<RequireCommunityProfile><CommunityMerchantProfessionalDashboard /></RequireCommunityProfile>} />
            <Route path="/community/customer/requests" element={<RequireCommunityProfile><CommunityCustomerRequests /></RequireCommunityProfile>} />
            <Route path="/community/customer/new" element={<RequireCommunityProfile><CommunityCustomerNewRequest /></RequireCommunityProfile>} />
            <Route path="/community/customer/profile" element={<RequireAuth><CommunityCustomerProfile /></RequireAuth>} />
            <Route path="/community/auto-levo" element={<RequireCommunityProfile><CommunityQuoteFromLink /></RequireCommunityProfile>} />
            <Route path="/community/quote-from-link" element={<Navigate to="/community/auto-levo" replace />} />
            <Route path="/community/merchant/signup" element={<RequireAuth><CommunityMerchantSignup /></RequireAuth>} />
            <Route path="/community/merchant/store" element={<RequireCommunityProfile><CommunityMerchantStore /></RequireCommunityProfile>} />
            <Route path="/community/merchant/orders" element={<RequireCommunityProfile><CommunityMerchantOrders /></RequireCommunityProfile>} />
            <Route path="/community/customer/track" element={<RequireCommunityProfile><CommunityCustomerTrack /></RequireCommunityProfile>} />
            <Route path="/community/merchants/products" element={<RequireCommunityProfile><CommunityMerchantsProducts /></RequireCommunityProfile>} />
            <Route path="/community/merchants/all-products" element={<CommunityAllMerchantsProducts />} />
            <Route path="/community/requests" element={<RequireCommunityProfile><CommunityRequestsBrowse /></RequireCommunityProfile>} />
            <Route path="/community/merchants" element={<RequireCommunityProfile><CommunityMerchantsPages /></RequireCommunityProfile>} />
            <Route path="/community/store/:merchantId" element={<CommunityMerchantStorePage />} />
            {/* STL Library */}
            <Route path="/community/stl-library" element={<RequireAuth><StlLibrary /></RequireAuth>} />
            <Route path="/community/stl-library/upload" element={<RequireAuth><StlLibraryUpload /></RequireAuth>} />
            <Route path="/community/stl-library/:id" element={<RequireAuth><StlFileDetails /></RequireAuth>} />
            <Route path={`${ADMIN_BASE_PATH}/stl-library`} element={<AdminRoute><AdminStlLibrary /></AdminRoute>} />
            <Route path="/store/:merchantId" element={<CommunityMerchantStorePage />} />
            {/* Standalone merchant storefront — feels like a separate site */}
            <Route path="/s/:slug" element={<MerchantStandalone />} />
            <Route path="/s/:slug/dashboard" element={<MerchantStandalone />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/seller/:id" element={<SellerProfile />} />
            {/* /profile is rendered by ProfileExpansionShell at app level (overlay) */}
            <Route path="/profile" element={<div />} />
            <Route path="/profile/settings" element={<RequireAuth><ProfileSettings /></RequireAuth>} />
            <Route path="/price-protection" element={<RequireAuth><PriceProtection /></RequireAuth>} />
            <Route path="/random-filament" element={<RandomFilament />} />
            <Route path="/rewards" element={<RewardsHub />} />
            <Route path="/my-referral" element={<RequireAuth><MyReferral /></RequireAuth>} />
            <Route path="/my-prizes" element={<RequireAuth><MyLevelPrizes /></RequireAuth>} />
            <Route path="/games" element={<MiniGames />} />
            <Route path="/games/winners" element={<GameWinnersPage />} />
            <Route path="/games/winners/archive" element={<GameWinnersArchive />} />
            <Route path="/sprite-debug" element={<Suspense fallback={<div>Loading...</div>}><SpriteDebugPage /></Suspense>} />
            <Route path="/shop" element={<ProductShop />} />
            <Route path="/products-gifts" element={<ProductsWithGifts />} />
            <Route path="/my-products" element={<MyPurchasedProducts />} />
            <Route path="/my-offer-purchases" element={<MyOfferPurchases />} />
            <Route path="/product-offers" element={<ProductOffersPage />} />
            <Route path="/offers" element={<OffersStoragePage />} />
            <Route path="/merchant-giveaways" element={<MerchantGiveaways />} />
            <Route path="/special-coupons" element={<CustomerSpecialCoupons />} />
            <Route path="/wishes" element={<Wishes />} />
            <Route path="/community/cart" element={<RequireAuth><CommunityCart /></RequireAuth>} />
            <Route path="/community/checkout/:orderId" element={<RequireAuth><ChatOrderCheckout /></RequireAuth>} />
            
            {/* Redirect old routes to rewards hub */}
            <Route path="/my-points" element={<Navigate to="/rewards" replace />} />
            <Route path="/competitions" element={<Navigate to="/rewards" replace />} />
            <Route path="/competitions/history" element={<CompetitionHistory />} />
            <Route path={`${ADMIN_BASE_PATH}/printer-protection`} element={<AdminRoute><AdminPrinterProtection /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/loyalty-card-codes`} element={<Navigate to={`${ADMIN_BASE_PATH}/levo-cards`} replace />} />
            <Route path={`${ADMIN_BASE_PATH}/loyalty-code-redemptions`} element={<Navigate to={`${ADMIN_BASE_PATH}/levo-cards`} replace />} />
            <Route path={`${ADMIN_BASE_PATH}/levo-cards`} element={<AdminRoute><AdminLevoCards /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/levo-card-orders`} element={<AdminRoute><AdminLevoCardOrders /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/loyalty/card-orders`} element={<Navigate to={`${ADMIN_BASE_PATH}/levo-card-orders`} replace />} />
            <Route path={`${ADMIN_BASE_PATH}/user-card-cycles`} element={<AdminRoute><AdminUserCardCycles /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/protection-plan-benefits`} element={<AdminRoute><AdminProtectionPlanBenefits /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/chunk-errors`} element={<AdminRoute><AdminChunkErrors /></AdminRoute>} />
            <Route path="/printer-protection" element={<Navigate to={`${ADMIN_BASE_PATH}/printer-protection`} replace />} />
            <Route path="/my-printers" element={<Navigate to="/rewards?tab=insurance&sub=status" replace />} />
            <Route path="/activate-printer" element={<ActivatePrinter />} />
            <Route path="/warranty-dashboard/:printerId" element={<Navigate to="/rewards?tab=insurance&sub=status" replace />} />

            {/* Backward-compat redirects for removed/renamed routes — keeps old links working without heavy NotFound mounts */}
            <Route path="/bundle" element={<Navigate to="/bundles" replace />} />
            <Route path="/bundle/:id" element={<Navigate to="/bundles" replace />} />
            <Route path="/wallet" element={<Navigate to="/profile" replace />} />
            <Route path="/marketplace" element={<Navigate to="/community/merchant/store" replace />} />
            <Route path="/marketplace/*" element={<Navigate to="/community/merchant/store" replace />} />

            {/* Defense-in-depth: any unmatched path under ADMIN_BASE_PATH still
                forces admin verification before showing 404, so unknown admin
                paths cannot be probed without auth. */}
            <Route path={`${ADMIN_BASE_PATH}/*`} element={<AdminRoute><NotFound /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </PageFade>
          </ChunkReloadBoundary>
        </Suspense>
      </main>
      {/* Bottom/Side Navigation Bar */}
      {!hideChrome && (
        <Suspense fallback={null}>
          <AppNavBar />
        </Suspense>
      )}
      {!hideChrome && <div className="h-16 md:hidden" />}
      {!hideChrome &&
      <>
          {/* Levo Help Bot - only on home page */}
          {location.pathname === "/" && (
            <Suspense fallback={null}>
              <LevoHelpBot />
            </Suspense>
          )}
          {/* PWA Install Prompt */}
          <Suspense fallback={null}>
            <InstallPrompt />
          </Suspense>
        </>
      }
    </>);

}

export default function App() {
  // Create QueryClient inside the component using useState to ensure single instance
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000, // 10 minutes - reduced refetching
        gcTime: 24 * 60 * 60 * 1000, // 24h - keep cache for persistence
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      }
    }
  }));

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined as any,
      key: "lvn-rq-cache-v1",
      throttleTime: 1000,
    })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "v2-direct-sale-array",
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => {
            // Don't persist queries flagged ephemeral or per-user mutable
            const key = Array.isArray(q.queryKey) ? String(q.queryKey[0] ?? "") : "";
            if (!key) return false;
            // Skip user-private / realtime caches
            const skip = ["cart", "notifications", "messages", "auth", "online", "wallet", "session"];
            return !skip.some((s) => key.toLowerCase().includes(s));
          },
        },
      }}
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <IslandProvider>
                  <PageSearchProvider>
                    <ProfileTransitionProvider>
                      <NativeAuthGate>
                        <AppContent />
                      </NativeAuthGate>
                    </ProfileTransitionProvider>
                  </PageSearchProvider>
                </IslandProvider>
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PersistQueryClientProvider>);

}