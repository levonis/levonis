import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/i18n";
import { useProfileTransition } from "./ProfileTransitionProvider";
import { computeOrbMagnet } from "./profileOrbMagnet";
import { cn } from "@/lib/utils";

/**
 * Profile Orb
 * -----------
 * A small circular avatar button that lives at the top edge next to the
 * Dynamic Island. As the user scrolls, the orb is magnetically pulled toward
 * the island and visually disappears INTO it (no extra overlay layer).
 *
 * Important: there is intentionally no separate "bridge" / SVG goo layer.
 * Stacking two translucent glass surfaces on top of each other is what made
 * the previous version look like a second skin floating above the island.
 * Instead, the orb here is rendered as ONE element using the same `.island-surface`
 * material as the island itself, so when it slides into the island the two
 * shapes read as one continuous body of glass.
 */
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

  useEffect(() => {
    remeasureOrigin();
  }, [isRtl, remeasureOrigin]);

  const [mergeProgress, setMergeProgress] = useState(0);
  const [fusion, setFusion] = useState<{ dx: number; dy: number; islandH: number }>({
    dx: 0,
    dy: 0,
    islandH: 52,
  });

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
        // Aim slightly INTO the island (overlap by ~30% of orb width) so the
        // orb truly sinks under the pill rather than parking next to it.
        const overlap = o.width * 0.3;
        const gap = isRtl ? o.left - i.right : i.left - o.right;
        const travel = Math.max(0, gap) + overlap;
        const dx = isRtl ? -travel : travel;
        const ocy = o.top + o.height / 2;
        const icy = i.top + i.height / 2;
        const dy = icy - ocy;
        setFusion({ dx, dy, islandH });
      } else {
        setFusion((prev) => ({ ...prev, islandH }));
      }

      // Slower, more controlled curve — no exaggerated goo.
      const start = Math.max(8, ISLAND_THRESHOLD - 12);
      const end = ISLAND_THRESHOLD + Math.round(islandH * 1.6);
      const y = window.scrollY;
      const t = Math.min(1, Math.max(0, (y - start) / (end - start)));
      // Soft easeInOutCubic — feels like absorption, not a snap.
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

  if (location.pathname !== "/") return null;

  const handleClick = () => {
    const el = btnRef.current;
    if (!el) {
      navigate(user ? "/profile" : "/auth");
      return;
    }
    remeasureOrigin();
    const r = el.getBoundingClientRect();
    beginExpand({
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      size: r.width,
    });
    navigate(user ? "/profile" : "/auth");
  };

  const sideClass = isRtl ? "right-3" : "left-3";

  const visual = computeOrbMagnet(mergeProgress, { dx: fusion.dx, dy: fusion.dy });
  const { translateX, translateY, scaleX, scaleY, contentOpacity, fullyMerged } = visual;

  // Origin on the contact edge so the squash happens on the seam side.
  const originX = isRtl ? "0% 50%" : "100% 50%";
  // Once the orb has overlapped the island, fade the orb shell itself so the
  // island reads as the single remaining surface (no double glass).
  const shellOpacity = mergeProgress < 0.7 ? 1 : Math.max(0, 1 - (mergeProgress - 0.7) / 0.25);
  const tuckTransform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;

  return (
    <button
      ref={setRef}
      onClick={handleClick}
      aria-label="Profile"
      className={cn(
        // z-[49] — placed BELOW the island (z-50) so it slides UNDER the
        // island as it merges, instead of sitting on top of it.
        "fixed top-3 z-[49] w-10 h-10 rounded-full overflow-hidden",
        "island-surface",
        "flex items-center justify-center",
        "hover:scale-105 active:scale-95",
        sideClass,
      )}
      style={{
        WebkitTapHighlightColor: "transparent",
        transformOrigin: originX,
        transform: tuckTransform,
        opacity: shellOpacity,
        // Soft, single transition — no blur stacking.
        transition: "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        pointerEvents: visual.pointerEventsAuto ? "auto" : "none",
        borderRadius: "9999px",
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover rounded-full"
          style={{
            opacity: contentOpacity,
            transition: "opacity 160ms linear",
          }}
          draggable={false}
        />
      ) : (
        <User
          className="relative z-[1] w-5 h-5 text-foreground/85"
          strokeWidth={2.2}
          style={{ opacity: contentOpacity, transition: "opacity 160ms linear" }}
        />
      )}
      {fullyMerged ? null : null}
    </button>
  );
});

ProfileOrb.displayName = "ProfileOrb";

export default ProfileOrb;
