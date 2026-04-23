import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  CartSkeleton,
  OrderListSkeleton,
  NotificationsSkeleton,
  FormSkeleton,
  ProfileSkeleton,
  ChatSkeleton,
  DetailPageSkeleton,
  ProductGridSkeleton,
  AdminPageSkeleton,
  CompetitionGridSkeleton,
  GridCardsSkeleton,
  HeaderSkeleton,
} from "@/components/ui/PageSkeletons";

function pickSkeleton(pathname: string) {
  const p = pathname.toLowerCase();

  // Cart
  if (p === "/cart" || p === "/community-cart") return <CartSkeleton />;

  // Orders
  if (p.startsWith("/orders") || p.startsWith("/my-orders") || p.startsWith("/order-")) return <OrderListSkeleton />;

  // Notifications
  if (p === "/notifications") return <NotificationsSkeleton />;

  // Forms / settings
  if (
    p === "/notification-settings" ||
    p === "/settings" ||
    p === "/user-info" ||
    p === "/profile-settings" ||
    p.startsWith("/address") ||
    p === "/telegram-settings"
  )
    return <FormSkeleton />;

  // Profile
  if (p.startsWith("/profile")) return <ProfileSkeleton />;

  // Chat / messages
  if (p.startsWith("/chat") || p.startsWith("/messages") || p.includes("maintenance-chat") || p.startsWith("/conversations"))
    return <ChatSkeleton />;

  // Detail pages
  if (
    p.startsWith("/product/") ||
    p.startsWith("/bundles/") ||
    p.startsWith("/bundle/") ||
    p.startsWith("/category/") ||
    p.startsWith("/competitions/") ||
    p.startsWith("/offer/")
  )
    return <DetailPageSkeleton />;

  // Product grids
  if (
    p === "/products" ||
    p === "/shop" ||
    p === "/favorites" ||
    p === "/offers" ||
    p === "/products-gifts" ||
    p === "/bundles"
  )
    return <ProductGridSkeleton />;

  // Admin / management
  if (
    p.startsWith("/admin") ||
    p.startsWith("/inventory") ||
    p.startsWith("/financial") ||
    p === "/games-settings" ||
    p === "/printer-protection" ||
    p === "/price-match"
  )
    return <AdminPageSkeleton />;

  // Competitions / rewards
  if (p === "/competitions" || p === "/rewards" || p === "/community" || p === "/community/print-requests")
    return <CompetitionGridSkeleton />;

  // Categories landing removed — handled by Home skeleton

  // Download app — simple
  if (p === "/download-app") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md space-y-6">
        <HeaderSkeleton />
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
        <div className="h-12 rounded-xl bg-muted animate-pulse" />
        <div className="h-12 rounded-xl bg-muted/70 animate-pulse" />
      </div>
    );
  }

  // Default — generic
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        <HeaderSkeleton />
        <div className="rounded-2xl border border-border/30 bg-card p-4 space-y-3">
          <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted/70 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/30 bg-card p-3 space-y-2">
              <div className="aspect-square w-full rounded-lg bg-muted animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-muted/70 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted/60 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Route-aware Suspense fallback. Waits 80ms before showing any skeleton
 * to avoid flicker on instant (cached) loads.
 */
export default function RouteAwareSkeleton() {
  const location = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  return pickSkeleton(location.pathname);
}
