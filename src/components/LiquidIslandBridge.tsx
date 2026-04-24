/**
 * LiquidIslandBridge
 * ------------------
 * SVG metaball / "gooey filter" overlay that visually fuses the Profile Orb
 * with the Dynamic Island as the user scrolls.
 *
 * How the merge works:
 *   1. We render two filled rounded rectangles inside an SVG <g> that has
 *      an `feGaussianBlur` + alpha-threshold filter applied to it. Any two
 *      blurred shapes that come close enough merge into one organic blob
 *      with smooth, continuous curvature — the classic "metaball" trick.
 *   2. A third "neck" ellipse sits between the two shapes and grows with
 *      `progress` so the bridge forms reliably even when the live gap is
 *      large (the orb starts a ~60-90px away from the island).
 *
 * The layer is purely decorative: pointer-events: none, aria-hidden, and
 * sits between the island (z-50) and the orb (z-55) so it composites
 * cleanly with both.
 *
 * Honors `prefers-reduced-motion` — when the user opts out, the filter is
 * disabled (no blur / threshold). The orb still translates magnetically
 * but no goo bridge is drawn.
 */
import { memo, useEffect, useRef, useState } from "react";
import { useLiquidFusion } from "@/island/useLiquidFusion";

const LiquidIslandBridge = memo(() => {
  const { progress, orb, island, isRtl } = useLiquidFusion();
  const [reducedMotion, setReducedMotion] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Nothing to draw until the orb has measured itself.
  if (!orb || !island) return null;
  if (reducedMotion) return null;
  // Below the merge start, drawing the bridge wastes paint and can produce
  // a faint colored halo around the orb. Skip it entirely.
  if (progress <= 0.001) return null;

  // --- Geometry ------------------------------------------------------------
  // The SVG covers the top strip of the viewport. We position blobs in
  // viewport coordinates which maps 1:1 to the SVG's userSpaceOnUse since
  // we set width/height to viewport dimensions.
  const STRIP_HEIGHT = Math.max(96, island.top + island.height + 40);
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;

  // Live target: orb center should travel from its origin to the island's
  // near edge as `progress` goes 0 → 1.
  const orbCx0 = orb.left + orb.width / 2;
  const orbCy0 = orb.top + orb.height / 2;
  const islandCy = island.top + island.height / 2;
  const contactX = isRtl ? rightOf(island) : leftEdgeOf(island);
  // We compute the merged orb position the same way the orb itself does so
  // both stay perfectly aligned (orb translates, blob follows).
  const orbCx = lerp(orbCx0, contactX, easeOutQuint(progress));
  const orbCy = lerp(orbCy0, islandCy, easeOutQuint(progress));
  const orbR = orb.width / 2;

  // Neck reinforcement: a horizontal ellipse spanning the gap between the
  // current orb edge and the island edge. Its thickness grows with progress
  // so two distant shapes still merge smoothly.
  const orbInnerEdgeX = isRtl ? orbCx - orbR : orbCx + orbR;
  const islandEdgeX = isRtl ? rightOf(island) : leftEdgeOf(island);
  const neckCx = (orbInnerEdgeX + islandEdgeX) / 2;
  const neckCy = islandCy;
  // Width covers the gap with a tiny overlap on each side so the metaballs
  // are guaranteed to fuse.
  const rawGap = Math.max(0, Math.abs(islandEdgeX - orbInnerEdgeX));
  const neckRx = Math.max(8, rawGap / 2 + 8);
  // Height ramps from a thin strand to almost full island height.
  const neckRy = lerp(2, island.height * 0.42, easeInOutCubic(progress));

  // Filter intensity: heavier blur near contact gives the syrupy pull, then
  // eases off once the shapes are unified so edges sharpen on the final pill.
  const blurStd = lerp(7, 12, smoothBell(progress));

  // Island rectangle approximation (rounded). We mirror the island's pill
  // shape so the merged silhouette tracks the real island corners.
  const islandRx = island.height / 2;
  const orbFillOpacity = 1; // shapes are full opacity; threshold filter shapes the alpha

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="liquid-goo-svg pointer-events-none fixed inset-x-0 top-0 z-[54] will-change-transform"
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
          {/* High-contrast alpha threshold: turns soft blobs into a single
              organic shape with smooth curvature at the join. */}
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
          {/* Composite the original on top so we keep crisp inner edges
              everywhere except the merged seam. */}
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
        {/* Orb silhouette (follows the magnetic translation) */}
        <circle
          cx={orbCx}
          cy={orbCy}
          r={orbR}
          fill="hsl(var(--card) / 0.55)"
          fillOpacity={orbFillOpacity}
        />
        {/* Neck reinforcement — only drawn while there's something to bridge */}
        {progress > 0.05 && rawGap > 1 ? (
          <ellipse
            cx={neckCx}
            cy={neckCy}
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

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------
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
/** Bell curve peaking at 0.5 — used to ramp filter blur in then back out. */
function smoothBell(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.abs(c - 0.5) * 2;
}

function leftEdgeOf(r: { left: number }) {
  return r.left;
}
function rightOf(r: { left: number; width: number }) {
  return r.left + r.width;
}
