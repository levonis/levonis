import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Phase = "idle" | "expanding" | "open" | "collapsing";

interface Origin {
  x: number;
  y: number;
  size: number;
}

interface Ctx {
  origin: Origin | null;
  phase: Phase;
  setOrigin: (o: Origin | null) => void;
  setPhase: (p: Phase) => void;
  beginExpand: (o: Origin) => void;
  /** Orb registers its DOM node so we can re-measure on resize / RTL flip. */
  registerOrb: (el: HTMLElement | null) => void;
  /** Force a re-measure now (e.g. after the orb moves). */
  remeasureOrigin: () => void;
}

const ProfileTransitionContext = createContext<Ctx | null>(null);

const measure = (el: HTMLElement): Origin => {
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    size: r.width,
  };
};

export const ProfileTransitionProvider = ({ children }: { children: ReactNode }) => {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const orbRef = useRef<HTMLElement | null>(null);

  const remeasureOrigin = useCallback(() => {
    const el = orbRef.current;
    if (!el) return;
    setOrigin((prev) => {
      const next = measure(el);
      if (
        prev &&
        Math.abs(prev.x - next.x) < 0.5 &&
        Math.abs(prev.y - next.y) < 0.5 &&
        Math.abs(prev.size - next.size) < 0.5
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const registerOrb = useCallback(
    (el: HTMLElement | null) => {
      orbRef.current = el;
      if (el) {
        // Initial measurement once mounted/laid out
        requestAnimationFrame(remeasureOrigin);
      }
    },
    [remeasureOrigin],
  );

  // Re-measure on resize, orientation change, or document direction flip.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onChange = () => remeasureOrigin();
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);

    // Watch <html dir="..."> changes (RTL/LTR toggle).
    const dirObserver = new MutationObserver(onChange);
    dirObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dir", "lang"],
    });

    // Track size changes of the orb itself (e.g. responsive class swaps).
    let resizeObs: ResizeObserver | null = null;
    if (orbRef.current && typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(onChange);
      resizeObs.observe(orbRef.current);
    }

    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      dirObserver.disconnect();
      resizeObs?.disconnect();
    };
  }, [remeasureOrigin]);

  const beginExpand = useCallback((o: Origin) => {
    setOrigin(o);
    setPhase("expanding");
  }, []);

  return (
    <ProfileTransitionContext.Provider
      value={{
        origin,
        phase,
        setOrigin,
        setPhase,
        beginExpand,
        registerOrb,
        remeasureOrigin,
      }}
    >
      {children}
    </ProfileTransitionContext.Provider>
  );
};

export const useProfileTransition = () => {
  const ctx = useContext(ProfileTransitionContext);
  if (!ctx) throw new Error("useProfileTransition must be used within ProfileTransitionProvider");
  return ctx;
};
