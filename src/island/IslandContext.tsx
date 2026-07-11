import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";

export type IslandState = "promo" | "search" | "category" | "product";

export interface PromoSettings {
  speed: number;
  direction: "left" | "right";
  gap: number;
  color: string;
  autoRotate: boolean;
  displayDuration: number;
  alwaysMove: boolean;
}

interface IslandContextValue {
  state: IslandState;
  title?: string;
  setContext: (ctx: { state: IslandState; title?: string } | null) => void;
  promoMessages: string[];
  promoSettings: PromoSettings;
  visible: boolean;
}

const IslandContext = createContext<IslandContextValue | null>(null);

export const useIsland = () => {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error("useIsland must be used inside IslandProvider");
  return ctx;
};

const DEFAULT_SETTINGS: PromoSettings = {
  speed: 20,
  direction: "right",
  gap: 16,
  color: "#3b82f6",
  autoRotate: true,
  displayDuration: 5,
  alwaysMove: false,
};

/**
 * Routes where the Dynamic Island must be HIDDEN.
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
  
  "/printer-protection",
  "/store",
  "/community/store",
  "/community/merchant/store",
  "/s/",
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

  // Active announcement texts (only the message content matters now)
  const { data: announcements } = useQuery({
    queryKey: ["island-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("message, message_ar, message_en, message_ku")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
    gcTime: 600_000,
  });

  // Global, single-row settings shared by ALL announcements
  const { data: settingsRow } = useQuery({
    queryKey: ["island-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcement_settings")
        .select("speed, direction, gap, color, auto_rotate, display_duration, always_move")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
    gcTime: 600_000,
  });

  const promoMessages = useMemo<string[]>(() => {
    if (!announcements?.length) return [];
    return announcements
      .map((a: any) => {
        const localized =
          language === 'en' ? (a.message_en || a.message || a.message_ar) :
          language === 'ku' ? (a.message_ku || a.message_ar) :
          (a.message_ar || a.message);
        return (localized || "").trim();
      })
      .filter(Boolean);
  }, [announcements, language]);

  const promoSettings = useMemo<PromoSettings>(() => {
    if (!settingsRow) return DEFAULT_SETTINGS;
    const s: any = settingsRow;
    return {
      speed: typeof s.speed === "number" && s.speed > 0 ? s.speed : DEFAULT_SETTINGS.speed,
      direction: s.direction === "left" ? "left" : "right",
      gap: typeof s.gap === "number" && s.gap >= 0 ? s.gap : DEFAULT_SETTINGS.gap,
      color: s.color || DEFAULT_SETTINGS.color,
      autoRotate: s.auto_rotate ?? DEFAULT_SETTINGS.autoRotate,
      displayDuration:
        typeof s.display_duration === "number" && s.display_duration > 0
          ? s.display_duration
          : DEFAULT_SETTINGS.displayDuration,
      alwaysMove: s.always_move ?? DEFAULT_SETTINGS.alwaysMove,
    };
  }, [settingsRow]);

  const routeDefault = useMemo<{ state: IslandState; title?: string }>(() => {
    const p = location.pathname;
    if (p.startsWith("/product/")) return { state: "search" };
    if (p.startsWith("/category/")) return { state: "search" };
    const isHomeSurface = p === "/" || p === "/home" || p === "/index";
    const promoSurfaces =
      isHomeSurface ||
      p === "/bundles" ||
      p === "/favorites" ||
      p === "/community" ||
      p.startsWith("/community/merchants") ||
      p.startsWith("/community/requests") ||
      p.startsWith("/community/reels");
    if (promoSurfaces) {
      // Always switch to "search" once the user scrolls down. The
      // "alwaysMove" setting only controls whether the marquee keeps
      // animating continuously — it must NOT block the state change.
      const showPromo = promoMessages.length > 0 && !scrolled;
      return {
        state: showPromo ? "promo" : "search",
      };
    }
    return { state: "search" };
  }, [location.pathname, promoMessages.length, scrolled, promoSettings.alwaysMove]);

  useEffect(() => {
    setOverride(null);
  }, [location.pathname]);

  const visible = !isIslandHidden(location.pathname);
  const active = override ?? routeDefault;

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
        promoSettings,
        visible,
      }}
    >
      {children}
    </IslandContext.Provider>
  );
};
