// App component - main application entry point - v4
import { Suspense, lazy, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { useDailyLogin } from "@/hooks/useDailyLogin";
import Header from "@/components/Header";
import AnnouncementBar from "@/components/AnnouncementBar";
import DecorativeFrame from "@/components/DecorativeFrame";
import AdminRoute from "@/components/AdminRoute";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";
import { Loader2 } from "lucide-react";

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

const MyPoints = lazy(() => import("./pages/MyPoints"));
const ConfirmDelivery = lazy(() => import("./pages/ConfirmDelivery"));
const Competitions = lazy(() => import("./pages/Competitions"));
const CompetitionHistory = lazy(() => import("./pages/CompetitionHistory"));
const ProductShop = lazy(() => import("./pages/ProductShop"));
const ProductsWithGifts = lazy(() => import("./pages/ProductsWithGifts"));
const ProductOffersPage = lazy(() => import("./pages/ProductOffersPage"));
const AdminCompetitions = lazy(() => import("./pages/AdminCompetitions"));
const AdminProductOffers = lazy(() => import("./pages/AdminProductOffers"));
const AdminTicketBundles = lazy(() => import("./pages/AdminTicketBundles"));
const AdminShipmentRequests = lazy(() => import("./pages/AdminShipmentRequests"));
const AdminMarketplace = lazy(() => import("./pages/AdminMarketplace"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const MyPurchasedProducts = lazy(() => import("./pages/MyPurchasedProducts"));
const MyOfferPurchases = lazy(() => import("./pages/MyOfferPurchases"));
const AdminOfferPurchases = lazy(() => import("./pages/AdminOfferPurchases"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function AppContent() {
  useDailyLogin();
  
  return (
    <>
      <DecorativeFrame />
      <AnnouncementBar />
      <Header />
      <main>
        <Suspense fallback={<PageLoader />}>
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
            <Route path={`${ADMIN_BASE_PATH}/marketplace`} element={<AdminRoute><AdminMarketplace /></AdminRoute>} />
            <Route path={`${ADMIN_BASE_PATH}/offer-purchases`} element={<AdminRoute><AdminOfferPurchases /></AdminRoute>} />
            
            {/* Block old /admin paths - redirect to 404 to prevent enumeration */}
            <Route path="/admin/*" element={<NotFound />} />
            <Route path="/admin" element={<NotFound />} />
            
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:listingId" element={<Marketplace />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/my-points" element={<MyPoints />} />
            <Route path="/competitions" element={<Competitions />} />
            <Route path="/competitions/history" element={<CompetitionHistory />} />
            <Route path="/shop" element={<ProductShop />} />
            <Route path="/products-gifts" element={<ProductsWithGifts />} />
            <Route path="/my-products" element={<MyPurchasedProducts />} />
            <Route path="/my-offer-purchases" element={<MyOfferPurchases />} />
            <Route path="/product-offers" element={<ProductOffersPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
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
          <AuthProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
