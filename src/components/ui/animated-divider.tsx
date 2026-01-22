import { memo, useEffect, useState } from "react";

type AnimatedDividerProps = {
  className?: string;
  /** Height of the decorative area (not the line thickness) */
  height?: number;
};

/**
 * AnimatedDivider
 * A lightweight SVG shimmer divider that respects prefers-reduced-motion.
 */
function AnimatedDividerBase({ className, height = 22 }: AnimatedDividerProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const update = () => setReduceMotion(!!mq.matches);
    update();

    // Safari fallback
    // eslint-disable-next-line deprecation/deprecation
    mq.addEventListener?.("change", update) ?? mq.addListener?.(update);
    return () => {
      // eslint-disable-next-line deprecation/deprecation
      mq.removeEventListener?.("change", update) ?? mq.removeListener?.(update);
    };
  }, []);

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{ color: "hsl(var(--primary))" }}
    >
      <svg
        width="100%"
        height={height}
        viewBox="0 0 520 22"
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <linearGradient id="levo-divider" x1="0" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.42" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="0.5" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="0.58" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="levo-divider-glow" x1="0" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.5" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* soft glow */}
        <rect x="0" y="10" width="520" height="6" fill="url(#levo-divider-glow)" opacity="0.55" />

        {/* main line */}
        <rect x="0" y="12" width="520" height="2" fill="url(#levo-divider)" />

        {/* small end dots */}
        <circle cx="10" cy="13" r="2" fill="currentColor" opacity="0.25" />
        <circle cx="510" cy="13" r="2" fill="currentColor" opacity="0.25" />

        {!reduceMotion && (
          <rect x="-260" y="12" width="260" height="2" fill="url(#levo-divider)">
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="780 0"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </rect>
        )}
      </svg>
    </div>
  );
}

const AnimatedDivider = memo(AnimatedDividerBase);
AnimatedDivider.displayName = "AnimatedDivider";

export default AnimatedDivider;
