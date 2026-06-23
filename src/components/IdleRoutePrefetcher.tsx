import { useEffect } from "react";

/**
 * After the app is idle, warm up the JS chunks for the most-visited routes.
 * This makes the very first navigation to those pages feel instant — no
 * spinner, no chunk download. Safe: imports are dynamic and cached by the
 * browser/bundler. If a fetch fails we silently ignore it.
 */
export default function IdleRoutePrefetcher() {
  useEffect(() => {
    const idle: (cb: () => void) => number =
      (window as any).requestIdleCallback?.bind(window) ??
      ((cb: () => void) => window.setTimeout(cb, 1500));

    const id = idle(() => {
      const warm = (loader: () => Promise<unknown>) => {
        loader().catch(() => {});
      };

      // Top-level user routes accessible from the bottom nav
      warm(() => import("@/pages/Cart"));
      warm(() => import("@/pages/CommunityHome"));
      warm(() => import("@/pages/RewardsHub"));
      warm(() => import("@/pages/MiniGames"));
      warm(() => import("@/pages/SearchResults"));
      warm(() => import("@/pages/Notifications"));
      // Common navigation targets from home/product cards
      warm(() => import("@/pages/ProductDetail"));
      warm(() => import("@/pages/CategoryDetail"));
      warm(() => import("@/pages/ProductShop"));
      warm(() => import("@/pages/Favorites"));
      warm(() => import("@/pages/Profile"));
      warm(() => import("@/pages/Auth"));
      warm(() => import("@/pages/UserInfo"));
      warm(() => import("@/pages/MyOrders"));
    });


    return () => {
      (window as any).cancelIdleCallback?.(id);
    };
  }, []);

  return null;
}
