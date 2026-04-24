/**
 * LiquidIslandBridge
 * ------------------
 * SVG metaball / "gooey filter" overlay that visually fuses the Profile Orb
 * with the Dynamic Island as the user scrolls.
 *
 * How the merge works:
 *   1. Two filled shapes (an island pill and the orb circle) live inside an
 *      SVG <g> with a `feGaussianBlur` + alpha-threshold filter applied.
 *      Two blurred shapes that come close enough merge into a single organic
 *      blob with smooth, continuous curvature — the classic metaball trick.
 *   2. A third "neck" ellipse sits between them and grows with `progress`
 *      so the bridge forms reliably even when the live gap is large.
 *
 * The layer is purely decorative: pointer-events: none, aria-hidden, and
 * sits between the island (z-50) and the orb (z-55) so it composites
 * cleanly with both.
 *
 * Honors `prefers-reduced-motion`: when set, the bridge is not rendered at
 * all (the orb still translates magnetically — it just doesn't goo).
 */
import { memo, useEffect, useState } from "react";
import { useLiquidFusion } from "@/island/useLiquidFusion";

const LiquidIslandBridge = memo(() => {
  const { progress, orb, island, isRtl } = useLiquidFusion();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  if (!orb || !island) return null;
  if (reducedMotion) return null;
  if (progress <= 0.001) return null;

  // ---- Geometry ---------------------------------------------------------
  const STRIP_HEIGHT = Math.max(96, orb.top + orb.height + 40, island.top + island.height + 40);
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;

  const islandLeft = island.left;
  const islandRight = island.left + island.width;
  const islandCy = island.top + island.height / 2;
  const islandRx = island.height / 2;

  const orbR = orb.width / 2;
  const orbCx0 = orb.left + orb.width / 2;
  const orbCy0 = orb.top + orb.height / 2;

  // Orb visual center after the magnetic pull. Mirrors the math used in
  // ProfileOrb so the SVG circle tracks the DOM button exactly.
  const contactX = isRtl ? islandRight + orbR : islandLeft - orbR;
  const tEase = easeOutQuint(progress);
  const orbCx = lerp(orbCx0, contactX, tEase);
  const orbCy = lerp(orbCy0, islandCy, tEase);

  // Neck reinforcement — fills any remaining gap with a soft ellipse so the
  // metaball threshold reliably welds the two shapes together.
  const orbInnerEdgeX = isRtl ? orbCx - orbR : orbCx + orbR;
  const islandEdgeX = isRtl ? islandRight : islandLeft;
  const rawGap = Math.abs(islandEdgeX - orbInnerEdgeX);
  const neckCx = (orbInnerEdgeX + islandEdgeX) / 2;
  const neckRx = Math.max(8, rawGap / 2 + 8);
  const neckRy = lerp(2, island.height * 0.42, easeInOutCubic(progress));

  // Filter intensity — blur peaks mid-merge for a syrupy pull, then eases
  // off so the unified pill regains crisp edges at the end.
  const blurStd = lerp(7, 12, smoothBell(progress));

  return (
    <svg
      aria-hidden
      className="liquid-goo-svg pointer-events-none fixed inset-x-0 top-0 z-[54]"
      style={{ width: "100vw", height: STRIP_HEIGHT }}
      viewBox={`0 0 ${vw} ${STRIP_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter
          id="liquid-island-goo"
          x="-20%"
          y="-50%"
          width="140%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={blurStd} result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 22 -11"
            result="goo"
          />
          {/* Keep the original on top so non-merging edges stay crisp. */}
          <feBlend in="SourceGraphic" in2="goo" mode="normal" />
        </filter>
      </defs>

      <g filter="url(#liquid-island-goo)">
        {/* Island silhouette */}
        <rect
          x={island.left}
          y={island.top}
          width={island.width}
          height={island.height}
          rx={islandRx}
          ry={islandRx}
          fill="hsl(var(--card) / 0.55)"
        />
        {/* Orb silhouette — follows the magnetic translation */}
        <circle
          cx={orbCx}
          cy={orbCy}
          r={orbR}
          fill="hsl(var(--card) / 0.55)"
        />
        {/* Neck — only when there's a real gap to bridge */}
        {progress > 0.05 && rawGap > 1 ? (
          <ellipse
            cx={neckCx}
            cy={islandCy}
            rx={neckRx}
            ry={neckRy}
            fill="hsl(var(--card) / 0.55)"
          />
        ) : null}
      </g>
    </svg>
  );
});

LiquidIslandBridge.displayName = "LiquidIslandBridge";

export default LiquidIslandBridge;

// ---- helpers ------------------------------------------------------------
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeOutQuint(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 5);
}
function easeInOutCubic(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}
/** Bell peaking at 0.5 — used to ramp filter blur in then back out. */
function smoothBell(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.abs(c - 0.5) * 2;
}
