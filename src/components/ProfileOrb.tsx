import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/i18n";
import { useProfileTransition } from "./ProfileTransitionProvider";
import { cn } from "@/lib/utils";

const ProfileOrb = memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isRtl } = useLanguage();
  const { beginExpand, registerOrb, remeasureOrigin } = useProfileTransition();
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      btnRef.current = el;
      registerOrb(el);
    },
    [registerOrb],
  );

  // Re-measure when RTL flips so the side class change is reflected immediately.
  useEffect(() => {
    remeasureOrigin();
  }, [isRtl, remeasureOrigin]);

  // Progressive merge with the Dynamic Island as the user scrolls.
  // 0 = fully visible orb, 1 = fully merged into the island.
  // Also tracks the live island center so the orb visually travels toward
  // it (absorption) and back (detachment) instead of drifting off-edge.
  const [mergeProgress, setMergeProgress] = useState(0);
  const [islandTarget, setIslandTarget] = useState<{
    dx: number;
    dy: number;
    height: number;
  }>({ dx: 0, dy: 0, height: 52 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const ISLAND_THRESHOLD = 40; // matches IslandContext scroll threshold
    const compute = () => {
      const orbEl = btnRef.current;
      const islandEl = document.querySelector<HTMLElement>("[data-dynamic-island]");
      const islandH = islandEl?.getBoundingClientRect().height ?? 52;

      // Vector from orb center → island center (used to "fly into" it).
      if (orbEl && islandEl) {
        const o = orbEl.getBoundingClientRect();
        const i = islandEl.getBoundingClientRect();
        const ocx = o.left + o.width / 2;
        const ocy = o.top + o.height / 2;
        const icx = i.left + i.width / 2;
        const icy = i.top + i.height / 2;
        setIslandTarget({ dx: icx - ocx, dy: icy - ocy, height: islandH });
      } else {
        setIslandTarget((prev) => ({ ...prev, height: islandH }));
      }

      const start = Math.max(8, ISLAND_THRESHOLD - 12); // ≈ 28px
      const end = ISLAND_THRESHOLD + Math.round(islandH * 0.9); // ≈ 88–110px
      const y = window.scrollY;
      const t = Math.min(1, Math.max(0, (y - start) / (end - start)));
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setMergeProgress(eased);
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", compute);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // Re-measure origin when the orb settles at either extreme so clip-path
  // stays anchored on the visible position when the user clicks.
  const settled = mergeProgress === 0 || mergeProgress === 1;
  useEffect(() => {
    if (!settled) return;
    const t = window.setTimeout(remeasureOrigin, 120);
    return () => window.clearTimeout(t);
  }, [settled, remeasureOrigin]);

  const { data: avatarUrl } = useQuery({
    queryKey: ["orb-avatar", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return (data?.avatar_url as string | null) ?? null;
    },
  });

  // Hide on /profile (page is the orb expanded) and on chrome-less pages
  const onProfile = location.pathname === "/profile";
  const hideRoutes =
    location.pathname === "/games" || location.pathname.startsWith("/community/reels");
  if (onProfile || hideRoutes) return null;

  const handleClick = () => {
    const el = btnRef.current;
    if (!el) {
      navigate(user ? "/profile" : "/auth");
      return;
    }
    // Force a fresh measure right at click time so any pending layout
    // (sticky bars, RTL flip, viewport resize) is reflected in the origin.
    remeasureOrigin();
    const r = el.getBoundingClientRect();
    beginExpand({
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      size: r.width,
    });
    navigate(user ? "/profile" : "/auth");
  };

  // Position: top, opposite side of the screen edge based on RTL.
  // Island sits centered, so the orb hugs the start edge.
  const sideClass = isRtl ? "right-3" : "left-3";

  // Smoothly interpolate visual properties so the orb appears to dissolve
  // into the island instead of snapping out.
  const p = mergeProgress;
  const opacity = 1 - p;
  const scale = 1 - p * 0.45; // 1 → 0.55
  const translateX = (isRtl ? 1 : -1) * p * 6; // drift toward the screen edge
  const translateY = -p * 6; // and a touch up toward the island
  const blurPx = p * 2.5; // soft gaussian as it fades into the island
  const tuckTransform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

  return (
    <button
      ref={setRef}
      onClick={handleClick}
      aria-label="Profile"
      className={cn(
        "fixed top-3 z-[55] w-10 h-10 rounded-full overflow-hidden",
        "glass-panel !rounded-full",
        "flex items-center justify-center",
        "transition-[transform,opacity,filter] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:scale-105 active:scale-95",
        "ring-1 ring-white/20 hover:ring-primary/50",
        "shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.4)]",
        sideClass,
      )}
      style={{
        WebkitTapHighlightColor: "transparent",
        transform: tuckTransform,
        opacity,
        filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
        pointerEvents: p > 0.6 ? "none" : "auto",
      }}
    >
      {/* Avatar — softened with blur + lowered opacity for a frosted feel */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          style={{ filter: "blur(1.5px) saturate(1.1)" }}
          draggable={false}
        />
      ) : (
        <User
          className="relative z-[2] w-5 h-5 text-foreground/85"
          strokeWidth={2.2}
        />
      )}

      {/* Glass overlay above the avatar */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, hsl(0 0% 100% / 0.32) 0%, hsl(0 0% 100% / 0.06) 45%, hsl(0 0% 100% / 0.18) 100%)",
          backdropFilter: "blur(2px) saturate(1.15)",
          WebkitBackdropFilter: "blur(2px) saturate(1.15)",
          boxShadow:
            "inset 0 1px 0 hsl(0 0% 100% / 0.45), inset 0 -1px 0 hsl(0 0% 0% / 0.15)",
        }}
      />
      {/* Top sheen highlight */}
      <span
        aria-hidden
        className="absolute inset-x-1 top-0.5 h-1.5 rounded-full pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, hsl(0 0% 100% / 0.55) 0%, transparent 100%)",
          filter: "blur(0.5px)",
        }}
      />
    </button>
  );
});

ProfileOrb.displayName = "ProfileOrb";

export default ProfileOrb;
