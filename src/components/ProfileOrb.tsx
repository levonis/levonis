import { memo, useCallback, useEffect, useRef } from "react";
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

  return (
    <button
      ref={setRef}
      onClick={handleClick}
      aria-label="Profile"
      className={cn(
        "fixed top-3 z-[55] w-10 h-10 rounded-full overflow-hidden",
        "glass-panel !rounded-full pointer-events-auto",
        "flex items-center justify-center",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:scale-105 active:scale-95",
        "ring-1 ring-white/15 hover:ring-primary/40",
        "shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.35)]",
        sideClass,
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <User className="w-5 h-5 text-foreground/80" strokeWidth={2.2} />
      )}
    </button>
  );
});

ProfileOrb.displayName = "ProfileOrb";

export default ProfileOrb;
