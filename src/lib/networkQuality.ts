/**
 * Network/device awareness helpers — used to skip heavy media on
 * Data Saver and 2G/slow-2G connections (a noticeable share of users
 * in IQ on mobile networks).
 */

type Conn = {
  saveData?: boolean;
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
};

export function getConnection(): Conn | null {
  if (typeof navigator === 'undefined') return null;
  const c = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  return c || null;
}

/** True when the user is on Data Saver or a 2G connection — skip videos. */
export function shouldSkipHeavyMedia(): boolean {
  const c = getConnection();
  if (!c) return false;
  if (c.saveData) return true;
  if (c.effectiveType === '2g' || c.effectiveType === 'slow-2g') return true;
  return false;
}

/** True for low-memory devices (< 4GB) — skip videos and other GPU-heavy media. */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as any).deviceMemory as number | undefined;
  if (typeof mem === 'number' && mem > 0 && mem < 4) return true;
  const cores = (navigator as any).hardwareConcurrency as number | undefined;
  if (typeof cores === 'number' && cores > 0 && cores <= 4) return true;
  return false;
}

/** True when the device is a phone-sized viewport. Used to skip autoplay videos
 *  on the homepage cards — they are the single biggest TBT contributor on mobile. */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 768px)').matches ?? window.innerWidth < 768;
}
