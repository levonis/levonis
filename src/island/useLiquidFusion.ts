/**
 * Tiny external store for the Profile Orb ↔ Dynamic Island liquid fusion.
 *
 * One producer (`ProfileOrb`) publishes the latest geometry + scroll-eased
 * progress on every rAF tick; one consumer (`LiquidIslandBridge`) reads it
 * via `useSyncExternalStore` to render the metaball SVG layer.
 *
 * Kept dependency-free so the orb can keep using its own local state and we
 * don't introduce any global state library for a single ephemeral UI signal.
 */
import { useSyncExternalStore } from "react";

export interface FusionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FusionSnapshot {
  /** 0 = orb at origin, 1 = fully merged into the island. */
  progress: number;
  orb: FusionRect | null;
  island: FusionRect | null;
  isRtl: boolean;
}

const EMPTY: FusionSnapshot = {
  progress: 0,
  orb: null,
  island: null,
  isRtl: false,
};

let snapshot: FusionSnapshot = EMPTY;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY;

export const setLiquidFusion = (next: FusionSnapshot) => {
  // Cheap shallow-equality bail-out to avoid useless re-renders.
  const prev = snapshot;
  if (
    prev.progress === next.progress &&
    prev.isRtl === next.isRtl &&
    sameRect(prev.orb, next.orb) &&
    sameRect(prev.island, next.island)
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((l) => l());
};

const sameRect = (a: FusionRect | null, b: FusionRect | null) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
};

export const useLiquidFusion = (): FusionSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const rectFromDOMRect = (r: DOMRect): FusionRect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});
