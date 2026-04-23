import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useProfileTransition } from "./ProfileTransitionProvider";

interface Props {
  children: ReactNode;
}

const expandSpring: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 28,
  mass: 0.9,
};

const collapseSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.85,
};

/**
 * Wraps the /profile page so it appears via a circular reveal that grows from
 * the ProfileOrb's screen position. On unmount (route change), it plays the
 * inverse animation collapsing back into the orb.
 */
const ProfileExpansionShell = ({ children }: Props) => {
  const { origin, phase, setPhase } = useProfileTransition();
  const reducedMotion = useReducedMotion();
  const mountedRef = useRef(false);

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

  // Fallback origin: top of the screen (where the orb lives).
  // Uses the document direction so the fallback flips with RTL.
  const o = useMemo(() => {
    if (origin) return origin;
    const isRtl =
      typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const edgeOffset = 28; // 12px (left-3) + 20px (half of 40px orb)
    return {
      x: isRtl ? vp.w - edgeOffset : edgeOffset,
      y: 28,
      size: 40,
    };
  }, [origin, vp.w]);

  // Diagonal in px → ensures the circle fully covers the viewport at peak.
  const maxRadius = useMemo(() => {
    const dx = Math.max(o.x, vp.w - o.x);
    const dy = Math.max(o.y, vp.h - o.y);
    return Math.ceil(Math.sqrt(dx * dx + dy * dy)) + 40;
  }, [o, vp]);

  const initialRadius = (o.size || 40) / 2;

  // Drives clip-path animation
  const [animateState, setAnimateState] = useState<"in" | "out">("in");

  useEffect(() => {
    mountedRef.current = true;
    setPhase("expanding");
    // After the spring settles, mark as open
    const t = window.setTimeout(() => setPhase("open"), 700);
    return () => {
      window.clearTimeout(t);
      mountedRef.current = false;
      setPhase("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reducedMotion) {
    return <div className="animate-fade-in">{children}</div>;
  }

  const initialClip = `circle(${initialRadius}px at ${o.x}px ${o.y}px)`;
  const openClip = `circle(${maxRadius}px at ${o.x}px ${o.y}px)`;

  return (
    <>
      {/* Soft backdrop dim that fades in with the expansion */}
      <motion.div
        aria-hidden
        className="fixed inset-0 z-[35] pointer-events-none bg-background/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: animateState === "in" ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* The circular reveal layer */}
      <motion.div
        className="relative z-[36] min-h-screen will-change-[clip-path]"
        style={{
          background: "hsl(var(--background))",
          // Premium edge: subtle inner ring at the leading edge of the circle
          boxShadow: "inset 0 0 0 1px hsl(var(--primary) / 0.15)",
        }}
        initial={{ clipPath: initialClip, WebkitClipPath: initialClip, opacity: 0.85 } as any}
        animate={
          animateState === "in"
            ? ({ clipPath: openClip, WebkitClipPath: openClip, opacity: 1 } as any)
            : ({ clipPath: initialClip, WebkitClipPath: initialClip, opacity: 0.6 } as any)
        }
        exit={{ clipPath: initialClip, WebkitClipPath: initialClip, opacity: 0.6 } as any}
        transition={animateState === "in" ? expandSpring : collapseSpring}
        onAnimationStart={() => {
          if (animateState === "out") setPhase("collapsing");
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </motion.div>
    </>
  );
};

export default ProfileExpansionShell;
