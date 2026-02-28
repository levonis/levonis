// App component - main application entry point - v11 (premium loading)
import { Suspense, lazy, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import LanguageProvider from "@/components/LanguageProvider";
import { CartProvider } from "@/hooks/useCart";
import { useDailyLogin } from "@/hooks/useDailyLogin";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useOnlineHeartbeat } from "@/hooks/useOnlineHeartbeat";
import Header from "@/components/Header";
import AppNavBar from "@/components/AppNavBar";
import CommunityTopBar from "@/components/community/CommunityTopBar";
import AnnouncementBar from "@/components/AnnouncementBar";
import AdminRoute from "@/components/AdminRoute";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireCommunityProfile from "@/components/auth/RequireCommunityProfile";
// EmailVerificationBanner available for post-login verification


// Lazy load unified chat button (global floating button)
const UnifiedChatButton = lazy(() => import("@/components/UnifiedChatButton"));
const LevoHelpBot = lazy(() => import("@/components/LevoHelpBot"));
const InstallPrompt = lazy(() => import("@/components/pwa/InstallPrompt"));
const SpriteDebugPage = lazy(() => import("@/components/games/SpriteDebug"));

// Eager load Home page for best initial load
import Home from "./pages/Home";

// Lazy load all other routes
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Categories = lazy(() => import("./pages/Categories"));
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const UserInfo = lazy(() => import("./pages/UserInfo"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Notifications = lazy(() => import("./pages/Notifications"));
const MyCustomRequests = lazy(() => import("./pages/MyCustomRequests"));
const UserAddresses = lazy(() => import("./pages/UserAddresses"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const AdminBanners = lazy(() => import("./pages/AdminBanners"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminPointsSettings = lazy(() => import("./pages/AdminPointsSettings"));
const AdminChats = lazy(() => import("./pages/AdminChats"));
const AdminLoyaltyLevels = lazy(() => import("./pages/AdminLoyaltyLevels"));
const AdminDefaultSettings = lazy(() => import("./pages/AdminDefaultSettings"));
const AdminWallet = lazy(() => import("./pages/AdminWallet"));
const AdminWalletSettings = lazy(() => import("./pages/AdminWalletSettings"));
const AdminInvoiceTemplates = lazy(() => import("./pages/AdminInvoiceTemplates"));
const AdminSavedInvoices = lazy(() => import("./pages/AdminSavedInvoices"));
const AdminFinancials = lazy(() => import("./pages/AdminFinancials"));
const AdminPartialPaymentSettings = lazy(() => import("./pages/AdminPartialPaymentSettings"));

const RewardsHub = lazy(() => import("./pages/RewardsHub"));
const ConfirmDelivery = lazy(() => import("./pages/ConfirmDelivery"));
const ProductShop = lazy(() => import("./pages/ProductShop"));
const ProductsWithGifts = lazy(() => import("./pages/ProductsWithGifts"));
const ProductOffersPage = lazy(() => import("./pages/ProductOffersPage"));
const AdminCompetitions = lazy(() => import("./pages/AdminCompetitions"));
const AdminProductOffers = lazy(() => import("./pages/AdminProductOffers"));
const AdminTicketBundles = lazy(() => import("./pages/AdminTicketBundles"));
const AdminShipmentRequests = lazy(() => import("./pages/AdminShipmentRequests"));
const AdminShippingSettings = lazy(() => import("./pages/AdminShippingSettings"));
const AdminCommunityMerchants = lazy(() => import("./pages/AdminCommunityMerchants"));
const AdminBadgeSettings = lazy(() => import("./pages/AdminBadgeSettings"));
const AdminAvatarFrames = lazy(() => import("./pages/AdminAvatarFrames"));
const AdminLevoCommunity = lazy(() => import("./pages/AdminLevoCommunity"));
const AdminCommunityCustomers = lazy(() => import("./pages/AdminCommunityCustomers"));
const AdminCommunityComplaints = lazy(() => import("./pages/AdminCommunityComplaints"));
const AdminCommunityMessages = lazy(() => import("./pages/AdminCommunityMessages"));
const CommunityMessages = lazy(() => import("./pages/CommunityMessages"));
const CommunityCustomerDashboard = lazy(() => import("./pages/CommunityCustomerDashboard"));
const CommunityMerchantProfessionalDashboard = lazy(() => import("./pages/CommunityMerchantProfessionalDashboard"));
const CommunityCustomerNewRequest = lazy(() => import("./pages/CommunityCustomerNewRequest"));
const CommunityCustomerRequests = lazy(() => import("./pages/CommunityCustomerRequests"));
const CommunityCustomerProfile = lazy(() => import("./pages/CommunityCustomerProfile"));
const CommunityCustomerTrack = lazy(() => import("./pages/CommunityCustomerTrack"));
const CommunityMerchantsProducts = lazy(() => import("./pages/CommunityMerchantsProducts"));
const CommunityRequestsBrowse = lazy(() => import("./pages/CommunityRequestsBrowse"));
const CommunityMerchantsPages = lazy(() => import("./pages/CommunityMerchantsPages"));
const CommunityMerchantSignup = lazy(() => import("./pages/CommunityMerchantSignup"));
const CommunityMerchantStore = lazy(() => import("./pages/CommunityMerchantStore"));
const CommunityMerchantOrders = lazy(() => import("./pages/CommunityMerchantOrders"));
const CommunityAllMerchantsProducts = lazy(() => import("./pages/CommunityAllMerchantsProducts"));
const CommunityMerchantStorePage = lazy(() => import("./pages/CommunityMerchantStorePage"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const SellerProfile = lazy(() => import("./pages/SellerProfile"));
const MyPurchasedProducts = lazy(() => import("./pages/MyPurchasedProducts"));
const MyOfferPurchases = lazy(() => import("./pages/MyOfferPurchases"));
const AdminOfferPurchases = lazy(() => import("./pages/AdminOfferPurchases"));
const AdminRedeemableProducts = lazy(() => import("./pages/AdminRedeemableProducts"));
const AdminCartRequests = lazy(() => import("./pages/AdminCartRequests"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const CommunityHome = lazy(() => import("./pages/CommunityHome"));
const OffersStoragePage = lazy(() => import("./pages/OffersStoragePage"));
const ChatOrderCheckout = lazy(() => import("./pages/ChatOrderCheckout"));
const CompetitionHistory = lazy(() => import("./pages/CompetitionHistory"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));
const AdminStories = lazy(() => import("./pages/AdminStories"));
const AdminDeliveredOrders = lazy(() => import("./pages/AdminDeliveredOrders"));
const AdminGiveawaysCoupons = lazy(() => import("./pages/AdminGiveawaysCoupons"));
const AdminGameMusic = lazy(() => import("./pages/AdminGameMusic"));
const AdminPriceMatch = lazy(() => import("./pages/AdminPriceMatch"));
const AdminWishes = lazy(() => import("./pages/AdminWishes"));
const Wishes = lazy(() => import("./pages/Wishes"));
const MerchantGiveaways = lazy(() => import("./pages/MerchantGiveaways"));
const MiniGames = lazy(() => import("./pages/MiniGames"));
const CustomerSpecialCoupons = lazy(() => import("./pages/CustomerSpecialCoupons"));
const CommunityCart = lazy(() => import("./pages/CommunityCart"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Simple loading fallback
const SuspenseLoader = () => (
  <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

function AppContent() {
  useDailyLogin();
  useMessageNotifications();
  useOnlineHeartbeat();
  const location = useLocation();
  const isGamesPage = location.pathname === "/games";
  
  return (
    <>
      <AnnouncementBar />
      <main style={{ paddingTop: 0 }}>
        <Suspense fallback={<SuspenseLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/category/:slug" element={<CategoryDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/user-info" element={<UserInfo />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/my-requests" element={<MyCustomRequests />} />
            <Route path="/addresses" element={<UserAddresses />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/order/:orderId" element={<OrderDetail />} />
            <Route path="/my-orders/:orderId/confirm" element={<ConfirmDelivery />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Secure Admin Routes - Using obfuscated path */}
            <Route path={ADMIN_BASE_PATH} element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/notifications`} element={<AdminRoute><AdminNotifications /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/announcements`} element={<AdminRoute><AdminAnnouncements /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/banners`} element={<AdminRoute><AdminBanners /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/coupons`} element={<AdminRoute><AdminCoupons /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/orders`} element={<AdminRoute><AdminOrders /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/points-settings`} element={<AdminRoute><AdminPointsSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/chats`} element={<AdminRoute><AdminChats /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/loyalty-levels`} element={<AdminRoute><AdminLoyaltyLevels /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/default-settings`} element={<AdminRoute><AdminDefaultSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/wallet`} element={<AdminRoute><AdminWallet /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/wallet-settings`} element={<AdminRoute><AdminWalletSettings /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/invoice-templates`} element={<AdminRoute><AdminInvoiceTemplates /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/saved-invoices`} element={<AdminRoute><AdminSavedInvoices /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/financials`} element={<AdminRoute><AdminFinancials /></AdminRoute>} />
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
            <Route path={`${ADMIN_BASE_PATH}/game-music`} element={<AdminRoute><AdminGameMusic /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/wishes`} element={<AdminRoute><AdminWishes /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/price-match`} element={<AdminRoute><AdminPriceMatch /></AdminRoute>} />
            {/* Block old /admin paths - redirect to 404 to prevent enumeration */}
            <Route path="/admin/*" element={<NotFound />} />
            <Route path="/admin" element={<NotFound />} />
            
            {/* Community (requires login + complete profile) */}
            <Route path="/community" element={<RequireCommunityProfile><CommunityHome /></RequireCommunityProfile>} />
            <Route path="/community/reels" element={<ReelsPage />} />
            <Route path="/community/messages" element={<RequireCommunityProfile><CommunityMessages /></RequireCommunityProfile>} />
            <Route path="/community/customer/dashboard" element={<RequireCommunityProfile><CommunityCustomerDashboard /></RequireCommunityProfile>} />
            <Route path="/community/merchant/dashboard" element={<RequireCommunityProfile><CommunityMerchantProfessionalDashboard /></RequireCommunityProfile>} />
            <Route path="/community/customer/requests" element={<RequireCommunityProfile><CommunityCustomerRequests /></RequireCommunityProfile>} />
            <Route path="/community/customer/new" element={<RequireCommunityProfile><CommunityCustomerNewRequest /></RequireCommunityProfile>} />
            <Route path="/community/customer/profile" element={<RequireAuth><CommunityCustomerProfile /></RequireAuth>} />
            <Route path="/community/merchant/signup" element={<RequireCommunityProfile><CommunityMerchantSignup /></RequireCommunityProfile>} />
            <Route path="/community/merchant/store" element={<RequireCommunityProfile><CommunityMerchantStore /></RequireCommunityProfile>} />
            <Route path="/community/merchant/orders" element={<RequireCommunityProfile><CommunityMerchantOrders /></RequireCommunityProfile>} />
            <Route path="/community/customer/track" element={<RequireCommunityProfile><CommunityCustomerTrack /></RequireCommunityProfile>} />
            <Route path="/community/merchants/products" element={<RequireCommunityProfile><CommunityMerchantsProducts /></RequireCommunityProfile>} />
            <Route path="/community/merchants/all-products" element={<CommunityAllMerchantsProducts />} />
            <Route path="/community/requests" element={<RequireCommunityProfile><CommunityRequestsBrowse /></RequireCommunityProfile>} />
            <Route path="/community/merchants" element={<RequireCommunityProfile><CommunityMerchantsPages /></RequireCommunityProfile>} />
            <Route path="/community/store/:merchantId" element={<CommunityMerchantStorePage />} />
            <Route path="/store/:merchantId" element={<CommunityMerchantStorePage />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/seller/:id" element={<SellerProfile />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/profile/settings" element={<RequireAuth><ProfileSettings /></RequireAuth>} />
            <Route path="/rewards" element={<RewardsHub />} />
            <Route path="/games" element={<MiniGames />} />
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
            <Route path="/printer-protection" element={<Navigate to="/rewards" replace />} />
            <Route path="/my-printers" element={<Navigate to="/rewards" replace />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {/* Bottom/Side Navigation Bar */}
      {!isGamesPage && <AppNavBar />}
      {/* Add bottom padding on mobile for the nav bar */}
      {!isGamesPage && <div className="h-16 md:hidden" />}
      {!isGamesPage && (
        <>
          {/* Levo Help Bot - floating assistant (above chat button) */}
          <Suspense fallback={null}>
            <LevoHelpBot />
          </Suspense>
          {/* PWA Install Prompt */}
          <Suspense fallback={null}>
            <InstallPrompt />
          </Suspense>
        </>
      )}
    </>
  );
}

export default function App() {
  // Create QueryClient inside the component using useState to ensure single instance
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000, // 10 minutes - reduced refetching
        gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
        retry: 1,
        refetchOnWindowFocus: false, // Prevent refetch on tab switch
        refetchOnReconnect: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <AppContent />
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
