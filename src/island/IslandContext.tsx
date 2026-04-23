import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";

export type IslandState = "promo" | "search" | "category" | "product";

interface IslandContextValue {
  state: IslandState;
  title?: string;
  setContext: (ctx: { state: IslandState; title?: string } | null) => void;
  promoMessages: string[];
  visible: boolean;
}

const IslandContext = createContext<IslandContextValue | null>(null);

export const useIsland = () => {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error("useIsland must be used inside IslandProvider");
  return ctx;
};

/**
 * Routes where the Dynamic Island must be HIDDEN.
 * Checked via `startsWith` so nested paths inherit the hidden state.
 */
const HIDDEN_PREFIXES: string[] = [
  "/cart",
  "/rewards",
  "/games",
  "/chats",
  "/community/messages",
  "/community/cart",
  "/community/checkout",
  "/community/customer/profile",
  "/community/customer/dashboard",
  "/community/merchant/dashboard",
  "/notifications",
  "/notification-settings",
  "/telegram-settings",
  "/profile/settings",
  "/user-info",
  "/addresses",
  "/my-orders",
  "/order/",
  "/my-requests",
  "/my-referral",
  "/my-purchased",
  "/my-offer-purchases",
  "/confirm-delivery",
  "/activate-printer",
  "/warranty-dashboard",
  "/download",
  "/printer-protection",
  "/financial-drafts",
  "/inventory",
  "/auth",
  "/admin",
  "/profile",
  ADMIN_BASE_PATH,
];

export const isIslandHidden = (path: string): boolean =>
  HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));

export const IslandProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { language } = useLanguage();
  const [override, setOverride] = useState<{ state: IslandState; title?: string } | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: announcements } = useQuery({
    queryKey: ["island-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("message, message_ar, color")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 120_000,
    gcTime: 600_000,
  });

  const promoMessages = useMemo<string[]>(() => {
    if (!announcements?.length) return [];
    return announcements
      .map((a: any) => a.message_ar || a.message || "")
      .filter(Boolean);
  }, [announcements]);

  const routeDefault = useMemo<{ state: IslandState; title?: string }>(() => {
    const p = location.pathname;
    // For product/category pages we intentionally do NOT preset state here.
    // The page itself will call setContext(state, title) once the real title
    // is loaded — until then the island stays in its neutral search state so
    // the user never sees a flash of the generic "Categories" / "Products"
    // label before the actual name appears.
    if (p.startsWith("/product/")) return { state: "search" };
    if (p.startsWith("/category/")) return { state: "search" };
    // Show promo marquee when not scrolled on the main shopping & community surfaces.
    const promoSurfaces =
      p === "/" ||
      p === "/home" ||
      
      p === "/bundles" ||
      p === "/favorites" ||
      p === "/community" ||
      p.startsWith("/community/merchants") ||
      p.startsWith("/community/requests") ||
      p.startsWith("/community/reels");
    if (promoSurfaces) {
      // Switch from promo (news ticker) to search when the user scrolls past
      // the threshold so the island stays useful while browsing the page.
      return {
        state: !scrolled && promoMessages.length > 0 ? "promo" : "search",
      };
    }
    return { state: "search" };
  }, [location.pathname, promoMessages.length, scrolled]);

  // reset override when path changes
  useEffect(() => {
    setOverride(null);
  }, [location.pathname]);

  const visible = !isIslandHidden(location.pathname);
  const active = override ?? routeDefault;

  // Stable reference so consumers' useEffect deps don't loop.
  const setContext = useCallback(
    (ctx: { state: IslandState; title?: string } | null) => setOverride(ctx),
    [],
  );

  return (
    <IslandContext.Provider
      value={{
        state: active.state,
        title: active.title,
        setContext,
        promoMessages,
        visible,
      }}
    >
      {children}
    </IslandContext.Provider>
  );
};
