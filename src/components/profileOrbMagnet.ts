/**
 * Pure visual interpolation for the Profile Orb ↔ Dynamic Island liquid
 * fusion. Extracted so the behaviour can be tested / inspected at any
 * `mergeProgress` value without rendering the React component.
 *
 * `p` is the eased scroll progress (0 = orb fully visible at its origin,
 * 1 = edges in contact / orb fully absorbed by the island).
 *
 * Unlike the previous version, the orb is NEVER faded out or blurred — the
 * gooey SVG filter on `LiquidIslandBridge` provides the visual absorption.
 * Only the *content* of the orb (avatar / icon) fades in the very last
 * window so the remaining glass shell can blend with the island under the
 * filter.
 */

export interface OrbMagnetVisual {
  /** Smoothstepped travel factor with a tiny overshoot near contact. */
  travel: number;
  /** Horizontal translation in px (toward the island). */
  translateX: number;
  /** Vertical translation in px (toward the island center line). */
  translateY: number;
  /** Horizontal scale — a small stretch toward the seam. */
  scaleX: number;
  /** Vertical scale — slight squash near contact. */
  scaleY: number;
  /** Fade applied to the orb's *inner content* (avatar/icon) only. */
  contentOpacity: number;
  /** True once the orb is fully absorbed (no longer interactive). */
  fullyMerged: boolean;
  /** Whether the button should accept clicks. */
  pointerEventsAuto: boolean;
}

export interface FusionGeometry {
  /** Horizontal distance from orb center → island near-edge contact point. */
  dx: number;
  /** Vertical alignment offset (orb center → island center). */
  dy: number;
}

export const computeOrbMagnet = (
  p: number,
  fusion: FusionGeometry = { dx: 0, dy: 0 },
): OrbMagnetVisual => {
  const clamped = Math.min(1, Math.max(0, p));

  const smoothstep = clamped * clamped * (3 - 2 * clamped);
  const travel =
    clamped < 0.92
      ? smoothstep
      : Math.min(1.02, smoothstep + (clamped - 0.92) * 0.25);

  // Capped soft stretch — the gooey filter handles the organic deformation,
  // we only nudge the silhouette so the seam feels alive.
  const stretch =
    clamped < 0.92 ? clamped * 0.08 : Math.max(0, 0.08 - (clamped - 0.92) * 1.0);

  const scaleX = 1 + Math.min(0.08, stretch);
  const scaleY = Math.max(0.92, 1 - Math.max(0, clamped - 0.6) * 0.1);

  // Inner content (avatar/icon) softly clears in the last 18% so the
  // remaining glass shell can blend into the island without a hard pop.
  const contentOpacity =
    clamped < 0.82 ? 1 : Math.max(0, 1 - (clamped - 0.82) / 0.16);

  const fullyMerged = clamped >= 0.985;

  return {
    travel,
    translateX: fusion.dx * travel,
    translateY: fusion.dy * travel,
    scaleX,
    scaleY,
    contentOpacity,
    fullyMerged,
    pointerEventsAuto: !fullyMerged && clamped <= 0.6,
  };
};
