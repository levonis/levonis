import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";

export type IslandState = "promo" | "search" | "category" | "product";

interface IslandContextValue {
  state: IslandState;
  title?: string;
  setContext: (ctx: { state: IslandState; title?: string } | null) => void;
  promoMessages: string[];
}

const IslandContext = createContext<IslandContextValue | null>(null);

export const useIsland = () => {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error("useIsland must be used inside IslandProvider");
  return ctx;
};

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
        .select("message_ar, message_en, message_ku")
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
      .map((a: any) =>
        language === "en"
          ? a.message_en || a.message_ar
          : language === "ku"
          ? a.message_ku || a.message_ar
          : a.message_ar || a.message_en
      )
      .filter(Boolean);
  }, [announcements, language]);

  const routeDefault = useMemo<{ state: IslandState; title?: string }>(() => {
    const p = location.pathname;
    if (p.startsWith("/product/")) return { state: "product" };
    if (p.startsWith("/category/")) return { state: "category" };
    if (p === "/" || p === "/home") return { state: scrolled ? "search" : "promo" };
    return { state: "search" };
  }, [location.pathname, scrolled]);

  // reset override when path changes
  useEffect(() => {
    setOverride(null);
  }, [location.pathname]);

  const active = override ?? routeDefault;

  return (
    <IslandContext.Provider
      value={{
        state: active.state,
        title: active.title,
        setContext: (ctx) => setOverride(ctx),
        promoMessages,
      }}
    >
      {children}
    </IslandContext.Provider>
  );
};
