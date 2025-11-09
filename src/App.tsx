import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { useDailyLogin } from "@/hooks/useDailyLogin";
import Header from "@/components/Header";
import WhatsAppButton from "@/components/WhatsAppButton";
import AnnouncementBar from "@/components/AnnouncementBar";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Categories from "./pages/Categories";
import CategoryDetail from "./pages/CategoryDetail";
import Cart from "./pages/Cart";
import UserInfo from "./pages/UserInfo";
import Favorites from "./pages/Favorites";
import Notifications from "./pages/Notifications";
import MyCustomRequests from "./pages/MyCustomRequests";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import AdminNotifications from "./pages/AdminNotifications";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminCoupons from "./pages/AdminCoupons";
import MyOrders from "./pages/MyOrders";
import OrderDetail from "./pages/OrderDetail";
import AdminOrders from "./pages/AdminOrders";
import AdminPointsSettings from "./pages/AdminPointsSettings";
import AdminLoyaltyLevels from "./pages/AdminLoyaltyLevels";
import AdminDefaultSettings from "./pages/AdminDefaultSettings";
import AdminDailyTasks from "./pages/AdminDailyTasks";
import MyPoints from "./pages/MyPoints";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  useDailyLogin();
  
  return (
    <>
      <AnnouncementBar />
      <Header />
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
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/order/:orderId" element={<OrderDetail />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
        <Route path="/admin/coupons" element={<AdminCoupons />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/points-settings" element={<AdminPointsSettings />} />
        <Route path="/admin/loyalty-levels" element={<AdminLoyaltyLevels />} />
        <Route path="/admin/daily-tasks" element={<AdminDailyTasks />} />
        <Route path="/admin/default-settings" element={<AdminDefaultSettings />} />
        <Route path="/my-points" element={<MyPoints />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      <WhatsAppButton />
    </>
  );
}

export default function App() {
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
