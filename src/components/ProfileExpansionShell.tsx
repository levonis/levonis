import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useProfileTransition } from "./ProfileTransitionProvider";

interface Props {
  children: ReactNode;
}

// Symmetric spring used for both expand and collapse so the inverse motion
// feels like the same balloon deflating. Tuned for premium softness.
const balloonSpring: Transition = {
  type: "spring",
  stiffness: 230,
  damping: 30,
  mass: 0.9,
};

const PROFILE_PATH = "/profile";

/**
 * Renders the profile content as a circular reveal overlay that grows from
 * the ProfileOrb's position on enter and collapses back into it on exit.
 *
 * Mounted once at the app shell level so AnimatePresence can play the exit
 * animation when the user navigates away (back button, nav links, etc.).
 */
const ProfileExpansionShell = ({ children }: Props) => {
  const { origin, setPhase } = useProfileTransition();
  const reducedMotion = useReducedMotion();
  const location = useLocation();
  const present = location.pathname === PROFILE_PATH;

  // Track viewport so the clip circle stays correctly sized after resize/rotate.
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Snapshot the origin used for THIS open cycle so resize/RTL during open
  // doesn't yank the collapse target away from the orb.
  const lockedOriginRef = useRef<{ x: number; y: number; size: number } | null>(null);
  useEffect(() => {
    if (present) {
      lockedOriginRef.current = origin
        ? { ...origin }
        : null; // computed below if still missing
    } else {
      // After collapse animation completes the shell unmounts; clear lock.
      lockedOriginRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);

  // Resolve effective origin: locked snapshot > live origin > RTL-aware fallback.
  const o = useMemo(() => {
    const src = lockedOriginRef.current ?? origin;
    if (src) return src;
    const isRtl =
      typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const edgeOffset = 28; // 12px (left-3) + 20px (half of 40px orb)
    return {
      x: isRtl ? vp.w - edgeOffset : edgeOffset,
      y: 28,
      size: 40,
    };
  }, [origin, vp.w, present]);

  // Diagonal in px → ensures the circle fully covers the viewport at peak.
  const maxRadius = useMemo(() => {
    const dx = Math.max(o.x, vp.w - o.x);
    const dy = Math.max(o.y, vp.h - o.y);
    return Math.ceil(Math.sqrt(dx * dx + dy * dy)) + 40;
  }, [o, vp]);

  const initialRadius = (o.size || 40) / 2;
  const initialClip = `circle(${initialRadius}px at ${o.x}px ${o.y}px)`;
  const openClip = `circle(${maxRadius}px at ${o.x}px ${o.y}px)`;

  // Reduced motion: just fade.
  if (reducedMotion) {
    return (
      <AnimatePresence>
        {present && (
          <motion.div
            key="profile-shell-rm"
            className="fixed inset-0 z-[36] overflow-y-auto"
            style={{ background: "hsl(var(--background))" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {present && (
        <>
          {/* Soft backdrop dim that fades with expand/collapse */}
          <motion.div
            key="profile-shell-backdrop"
            aria-hidden
            className="fixed inset-0 z-[35] pointer-events-none bg-background/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Circular reveal layer */}
          <motion.div
            key="profile-shell"
            className="fixed inset-0 z-[36] overflow-y-auto will-change-[clip-path]"
            style={{
              background: "hsl(var(--background))",
              boxShadow: "inset 0 0 0 1px hsl(var(--primary) / 0.15)",
            }}
            initial={
              {
                clipPath: initialClip,
                WebkitClipPath: initialClip,
                opacity: 0.85,
              } as any
            }
            animate={
              {
                clipPath: openClip,
                WebkitClipPath: openClip,
                opacity: 1,
              } as any
            }
            exit={
              {
                clipPath: initialClip,
                WebkitClipPath: initialClip,
                opacity: 0.6,
              } as any
            }
            transition={balloonSpring}
            onAnimationStart={() => setPhase("expanding")}
            onAnimationComplete={() => setPhase("open")}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileExpansionShell;
