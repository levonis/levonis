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

  // Progressive fusion with the Dynamic Island as the user scrolls.
  // 0 = fully separate orb, 1 = edges fused with the island.
  // We measure the live gap between the orb's inner edge and the island's
  // near edge, then translate the orb by exactly that amount so the two
  // shapes meet seam-to-seam (no overshoot, no disappearing).
  const [mergeProgress, setMergeProgress] = useState(0);
  const [fusion, setFusion] = useState<{
    dx: number; // horizontal travel needed to touch the island edge
    dy: number; // vertical alignment offset (orb center → island center)
    gap: number; // live gap in px (for the bridge width)
    islandH: number;
  }>({ dx: 0, dy: 0, gap: 0, islandH: 52 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const ISLAND_THRESHOLD = 40;
    const compute = () => {
      const orbEl = btnRef.current;
      const islandEl = document.querySelector<HTMLElement>("[data-dynamic-island]");
      const islandH = islandEl?.getBoundingClientRect().height ?? 52;

      if (orbEl && islandEl) {
        const o = orbEl.getBoundingClientRect();
        const i = islandEl.getBoundingClientRect();
        // Horizontal gap between orb's inner edge and the island's near edge.
        // In LTR the orb sits on the left → its inner (right) edge approaches
        // the island's left edge. Mirror in RTL.
        const gap = isRtl ? o.left - i.right : i.left - o.right;
        const dx = isRtl ? -Math.max(0, gap) : Math.max(0, gap);
        // Vertical alignment so the seam is clean.
        const ocy = o.top + o.height / 2;
        const icy = i.top + i.height / 2;
        const dy = icy - ocy;
        setFusion({ dx, dy, gap: Math.max(0, gap), islandH });
      } else {
        setFusion((prev) => ({ ...prev, islandH }));
      }

      const start = Math.max(8, ISLAND_THRESHOLD - 12);
      const end = ISLAND_THRESHOLD + Math.round(islandH * 0.9);
      const y = window.scrollY;
      const t = Math.min(1, Math.max(0, (y - start) / (end - start)));
      const eased = 1 - Math.pow(1 - t, 3);
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
  }, [isRtl]);

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

  // Magnetic pull: as the user scrolls, the orb is dragged edge-to-edge
  // toward the island like a magnet, then disappears once contact is made
  // (the island stands alone as the search bar). On scroll up the orb
  // re-emerges from the island edge and slides back to its origin.
  const p = mergeProgress;

  // Smoothstep gives a slow start + accelerating pull near contact.
  const smoothstep = p * p * (3 - 2 * p);
  // Tiny overshoot (~2%) right before contact for the magnet snap feel.
  const travel = p < 0.92 ? smoothstep : Math.min(1.02, smoothstep + (p - 0.92) * 0.25);

  const translateX = fusion.dx * travel;
  const translateY = fusion.dy * travel;

  // Stretch toward the contact edge, then snap back.
  const stretch = p < 0.92 ? p * 0.12 : Math.max(0, 0.12 - (p - 0.92) * 1.5);
  const scaleX = 1 + stretch;
  const scaleY = 1 - Math.max(0, p - 0.6) * 0.15;

  // Dissolve into the island in the final 12% of the merge.
  const opacity = p < 0.88 ? 1 : Math.max(0, 1 - (p - 0.88) / 0.1);
  const blurPx = p > 0.85 ? (p - 0.85) * 14 : 0;

  // Origin on the contact edge so the stretch happens on the seam side.
  const originX = isRtl ? "0% 50%" : "100% 50%";
  const tuckTransform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;

  // Once fully merged, take the orb out of interaction entirely so the
  // island's search bar stands alone with no profile button.
  const fullyMerged = p >= 0.98;

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
        transformOrigin: originX,
        transform: tuckTransform,
        opacity,
        filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
        pointerEvents: fullyMerged || p > 0.6 ? "none" : "auto",
        visibility: fullyMerged ? "hidden" : "visible",
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
      </span>
    </button>
  );
});

ProfileOrb.displayName = "ProfileOrb";

export default ProfileOrb;
