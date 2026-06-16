import { useLocation } from "react-router-dom";
import {
  CartPageSkeleton,
  OrderListSkeleton,
  NotificationsSkeleton,
  FormSkeleton,
  ProfilePageSkeleton,
  ChatSkeleton,
  DetailPageSkeleton,
  ProductGridSkeleton,
  AdminPageSkeleton,
  CompetitionGridSkeleton,
  HeaderSkeleton,
  HomePageSkeleton,
  CategoryPageSkeleton,
} from "@/components/ui/PageSkeletons";

/**
 * Returns a skeleton whose layout matches the real page. Each entry below
 * mirrors the actual final markup (sections, paddings, grid columns, aspect
 * ratios) so when the real content swaps in there is no layout shift and the
 * transition feels instantaneous.
 */
function pickSkeleton(pathname: string) {
  const p = pathname.toLowerCase();

  // Home
  if (p === "/" || p === "/home") return <HomePageSkeleton />;

  // Cart
  if (p === "/cart" || p === "/community-cart") return <CartPageSkeleton />;

  // Orders
  if (
    p.startsWith("/orders") ||
    p.startsWith("/my-orders") ||
    p.startsWith("/order-")
  )
    return (
      <div className="container mx-auto px-4 py-6 space-y-4">
        <HeaderSkeleton />
        <OrderListSkeleton count={5} />
      </div>
    );

  // Notifications
  if (p === "/notifications")
    return (
      <div className="container mx-auto px-4 py-6 space-y-4">
        <HeaderSkeleton />
        <NotificationsSkeleton count={6} />
      </div>
    );

  // Forms / settings
  if (
    p === "/notification-settings" ||
    p === "/settings" ||
    p === "/user-info" ||
    p === "/profile-settings" ||
    p.startsWith("/address") ||
    p === "/telegram-settings"
  )
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <FormSkeleton fields={6} />
      </div>
    );

  // Profile
  if (p.startsWith("/profile")) return <ProfilePageSkeleton />;

  // Chat / messages
  if (
    p.startsWith("/chat") ||
    p.startsWith("/messages") ||
    p.includes("maintenance-chat") ||
    p.startsWith("/conversations")
  )
    return <ChatSkeleton />;

  // Category detail (precise layout)
  if (p.startsWith("/category/")) return <CategoryPageSkeleton />;

  // Other detail pages
  if (
    p.startsWith("/product/") ||
    p.startsWith("/bundles/") ||
    p.startsWith("/bundle/") ||
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
    return (
      <div className="container mx-auto px-4 py-6 space-y-4">
        <HeaderSkeleton />
        <ProductGridSkeleton count={10} />
      </div>
    );

  // Admin / management
  if (
    p.startsWith("/admin") ||
    p.startsWith("/inventory") ||
    p.startsWith("/financial") ||
    p === "/games-settings" ||
    p === "/printer-protection" ||
    p === "/price-match"
  )
    return (
      <div className="container mx-auto px-4 py-6">
        <AdminPageSkeleton />
      </div>
    );

  // Competitions / rewards
  if (
    p === "/competitions" ||
    p === "/rewards" ||
    p === "/community" ||
    p === "/community/print-requests"
  )
    return (
      <div className="container mx-auto px-4 py-6 space-y-4">
        <HeaderSkeleton />
        <CompetitionGridSkeleton count={4} />
      </div>
    );

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

  // Auth (login / signup) — match the real Auth page background so there is
  // no flash of a different layout on first paint.
  if (p === "/auth" || p.startsWith("/auth")) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="h-8 w-40 mx-auto rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-56 mx-auto rounded bg-muted/40 animate-pulse" />
          </div>
          <div className="rounded-3xl border border-border/50 bg-card/80 backdrop-blur-xl p-8 space-y-4 shadow-2xl shadow-primary/5">
            <div className="h-12 w-full rounded-xl bg-muted/60 animate-pulse" />
            <div className="h-12 w-full rounded-xl bg-muted/60 animate-pulse" />
            <div className="h-12 w-full rounded-xl bg-primary/20 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Default — generic shell
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        <HeaderSkeleton />
        <div className="rounded-2xl border border-border/30 bg-card p-4 space-y-3">
          <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted/70 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted/60 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Route-aware Suspense fallback.
 *
 * Renders a precisely-sized skeleton immediately (no flicker delay) so the
 * user sees a structural outline of the final page from the very first paint.
 * The skeleton fades out smoothly once the real content takes over (handled
 * by the routes' own animation wrappers).
 */
export default function RouteAwareSkeleton() {
  const location = useLocation();
  return <>{pickSkeleton(location.pathname)}</>;
}
