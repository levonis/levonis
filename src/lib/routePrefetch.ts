// Route prefetch registry — matches a hovered pathname to the same dynamic
// import() factory used by App.tsx's React.lazy. Vite/browser dedupe the
// module fetch, so calling the factory early just warms the cache; when the
// user actually navigates, React.lazy resolves synchronously and the route
// renders without a Suspense fallback flash.
//
// Only the busiest routes are listed. Anything not in this map still gets
// HTML-level prefetch via PrefetchOnHover, so no route is worse off.

type Loader = () => Promise<unknown>;

const routes: Array<{ match: (path: string) => boolean; load: Loader }> = [
  // Top-level customer routes
  { match: (p) => p === "/" || p === "/home", load: () => import("@/pages/Home") },
  { match: (p) => p.startsWith("/search"), load: () => import("@/pages/SearchResults") },
  { match: (p) => p.startsWith("/product/") && !p.startsWith("/product-"), load: () => import("@/pages/ProductDetail") },
  { match: (p) => p.startsWith("/category/"), load: () => import("@/pages/CategoryDetail") },
  { match: (p) => p === "/cart", load: () => import("@/pages/Cart") },
  { match: (p) => p === "/favorites", load: () => import("@/pages/Favorites") },
  { match: (p) => p === "/notifications", load: () => import("@/pages/Notifications") },
  { match: (p) => p === "/user-info", load: () => import("@/pages/UserInfo") },
  { match: (p) => p === "/my-orders", load: () => import("@/pages/MyOrders") },
  { match: (p) => p.startsWith("/order/"), load: () => import("@/pages/OrderDetail") },
  { match: (p) => p === "/rewards" || p.startsWith("/rewards/"), load: () => import("@/pages/RewardsHub") },
  { match: (p) => p === "/reels" || p.startsWith("/reels/"), load: () => import("@/pages/ReelsPage") },
  { match: (p) => p === "/mini-games" || p.startsWith("/games/"), load: () => import("@/pages/MiniGames") },
  { match: (p) => p === "/product-shop", load: () => import("@/pages/ProductShop") },
  { match: (p) => p === "/products-with-gifts", load: () => import("@/pages/ProductsWithGifts") },
  { match: (p) => p === "/offers", load: () => import("@/pages/ProductOffersPage") },
  { match: (p) => p === "/bundles", load: () => import("@/pages/ProductBundles") },
  { match: (p) => p.startsWith("/bundle/"), load: () => import("@/pages/BundleDetail") },
  { match: (p) => p === "/auth" || p.startsWith("/auth/"), load: () => import("@/pages/Auth") },
  { match: (p) => p.startsWith("/profile"), load: () => import("@/pages/Profile") },

  // Community
  { match: (p) => p === "/community", load: () => import("@/pages/CommunityHome") },
  { match: (p) => p === "/community/messages", load: () => import("@/pages/CommunityMessages") },
  { match: (p) => p === "/community/cart", load: () => import("@/pages/CommunityCart") },
  { match: (p) => p.startsWith("/community/customer"), load: () => import("@/pages/CommunityCustomerDashboard") },
  { match: (p) => p.startsWith("/community/merchants"), load: () => import("@/pages/CommunityMerchantsPages") },
  { match: (p) => p.startsWith("/community/requests"), load: () => import("@/pages/CommunityRequestsBrowse") },

  // Admin (still lazy — heavy)
  { match: (p) => p.startsWith("/admin/orders"), load: () => import("@/pages/AdminOrders") },
  { match: (p) => p.startsWith("/admin/chats"), load: () => import("@/pages/AdminChats") },
  { match: (p) => p.startsWith("/admin/inventory"), load: () => import("@/pages/AdminInventory") },
  { match: (p) => p.startsWith("/admin/reviews"), load: () => import("@/pages/AdminReviews") },
  { match: (p) => p.startsWith("/admin"), load: () => import("@/pages/Admin") },
];

const warmed = new Set<string>();

export function warmRouteFor(pathname: string): void {
  if (!pathname || warmed.has(pathname)) return;
  warmed.add(pathname);
  for (const r of routes) {
    if (r.match(pathname)) {
      // Fire-and-forget; failures are silent (network/route may not exist).
      try {
        r.load().catch(() => {});
      } catch {}
      // Multiple prefixes may match (e.g. /admin/orders matches both admin-
      // orders and admin fallback). Warm all so nested chunks resolve too.
    }
  }
}
