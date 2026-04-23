/**
 * Pure visual interpolation for the Profile Orb ↔ Dynamic Island magnetic
 * fusion. Extracted so the behaviour can be tested / inspected at any
 * `mergeProgress` value without rendering the React component.
 *
 * `p` is the eased scroll progress (0 = orb fully visible at its origin,
 * 1 = edges in contact / orb fully dissolved into the island).
 */

export interface OrbMagnetVisual {
  /** Smoothstepped travel factor with a tiny overshoot near contact. */
  travel: number;
  /** Horizontal translation in px (toward the island). */
  translateX: number;
  /** Vertical translation in px (toward the island center line). */
  translateY: number;
  /** Horizontal scale — stretches into the seam, then snaps back. */
  scaleX: number;
  /** Vertical scale — slight squash near contact. */
  scaleY: number;
  /** Final CSS opacity (1 → 0 only in the last ~12% of the merge). */
  opacity: number;
  /** Gaussian blur in px applied during the dissolve phase. */
  blurPx: number;
  /** True once the orb is removed from layout / interaction. */
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

  const stretch =
    clamped < 0.92 ? clamped * 0.12 : Math.max(0, 0.12 - (clamped - 0.92) * 1.5);

  const scaleX = 1 + stretch;
  const scaleY = 1 - Math.max(0, clamped - 0.6) * 0.15;

  const opacity =
    clamped < 0.88 ? 1 : Math.max(0, 1 - (clamped - 0.88) / 0.1);
  const blurPx = clamped > 0.85 ? (clamped - 0.85) * 14 : 0;

  const fullyMerged = clamped >= 0.98;

  return {
    travel,
    translateX: fusion.dx * travel,
    translateY: fusion.dy * travel,
    scaleX,
    scaleY,
    opacity,
    blurPx,
    fullyMerged,
    pointerEventsAuto: !fullyMerged && clamped <= 0.6,
  };
};
