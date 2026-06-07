import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BACKGROUND_RESPONSIVE_WIDTHS,
  buildBackgroundSrcSet,
  pickBackgroundUrl,
} from "@/lib/backgroundImage";

export type StoreBackgroundType = "glass" | "color" | "gradient" | "image";

export interface StoreBackgroundConfig {
  type: StoreBackgroundType;
  /** hex color, CSS gradient string, or image URL */
  value?: string | null;
  /** Foreground glass blur intensity in px (0-60). */
  blur?: number | null;
}

// ─── Module-level constants ──────────────────────────────────────────────────
// Defined once per module load so referential equality is preserved across
// every render of every instance.

const GLASS_DEFAULT_BG =
  "radial-gradient(ellipse at 20% 0%, hsl(var(--primary) / 0.18), transparent 55%)," +
  "radial-gradient(ellipse at 100% 100%, hsl(var(--primary) / 0.12), transparent 55%)," +
  "hsl(var(--background))";

const VIGNETTE_BG =
  "radial-gradient(ellipse at center, transparent 55%, hsl(var(--background)/0.5) 100%)";

const ROOT_CLASS = "fixed inset-0 -z-10 pointer-events-none overflow-hidden";
const LAYER_CLASS = "absolute inset-0";
const VEIL_CLASS = "absolute inset-0 bg-background/40";
const IMG_CLASS = "absolute inset-0 w-full h-full object-cover select-none";

const VIGNETTE_STYLE: CSSProperties = Object.freeze({ backgroundImage: VIGNETTE_BG }) as CSSProperties;
const GLASS_STYLE: CSSProperties = Object.freeze({ background: GLASS_DEFAULT_BG }) as CSSProperties;

// Cache `{ background: <css> }` per unique color/gradient string so identical
// configs across renders (and even across instances) yield the same object ref.
const cssBackgroundCache = new Map<string, CSSProperties>();
function cssBackgroundStyle(css: string): CSSProperties {
  let s = cssBackgroundCache.get(css);
  if (!s) {
    s = Object.freeze({ background: css }) as CSSProperties;
    cssBackgroundCache.set(css, s);
    // Soft cap so a runaway theming UI can't grow this unbounded.
    if (cssBackgroundCache.size > 64) {
      const firstKey = cssBackgroundCache.keys().next().value;
      if (firstKey !== undefined) cssBackgroundCache.delete(firstKey);
    }
  }
  return s;
}

// Cache veil styles by the integer blur value (0-60). 61 possible keys max.
const veilStyleCache = new Map<number, CSSProperties>();
function veilStyleFor(blur: number): CSSProperties {
  let s = veilStyleCache.get(blur);
  if (!s) {
    const filter = `blur(${blur}px) saturate(140%)`;
    s = Object.freeze({
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
      willChange: "backdrop-filter",
    }) as CSSProperties;
    veilStyleCache.set(blur, s);
  }
  return s;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Snap a raw viewport width to the nearest responsive bucket. Resize events
 * within the same bucket do NOT trigger a re-render.
 */
function snapToBucket(width: number): number {
  for (const w of BACKGROUND_RESPONSIVE_WIDTHS) {
    if (w >= width) return w;
  }
  return BACKGROUND_RESPONSIVE_WIDTHS[BACKGROUND_RESPONSIVE_WIDTHS.length - 1];
}

function useViewportBucket(): number {
  const [bucket, setBucket] = useState<number>(() => {
    if (typeof window === "undefined") return 1280;
    return snapToBucket(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = snapToBucket(window.innerWidth);
        // Functional setter — React bails out if value is identical.
        setBucket((prev) => (prev === next ? prev : next));
      });
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return bucket;
}

/**
 * Decode-ahead an image so applying it doesn't trigger a long paint. Returns
 * the URL once decoded, or null while loading.
 */
function useDecodedImage(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      lastUrlRef.current = null;
      setResolved((prev) => (prev === null ? prev : null));
      return;
    }
    if (lastUrlRef.current === url) return;
    lastUrlRef.current = url;

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = url;

    const finalize = () => {
      if (cancelled) return;
      setResolved((prev) => (prev === url ? prev : url));
    };

    if (typeof img.decode === "function") {
      img.decode().then(finalize).catch(finalize);
    } else {
      img.onload = finalize;
      img.onerror = finalize;
    }

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [url]);

  return resolved;
}

// ─── Component ───────────────────────────────────────────────────────────────

function StoreBackgroundLayerImpl({
  type = "glass",
  value,
  blur = 20,
}: StoreBackgroundConfig) {
  // Round + clamp so identical visual blur shares the same cache key.
  const safeBlur = useMemo(
    () => Math.round(Math.max(0, Math.min(60, blur ?? 20))),
    [blur],
  );

  const viewportBucket = useViewportBucket();

  const responsiveUrl = useMemo(
    () => (type === "image" ? pickBackgroundUrl(value, viewportBucket) : null),
    [type, value, viewportBucket],
  );
  const srcSet = useMemo(
    () => (type === "image" && value ? buildBackgroundSrcSet(value) : ""),
    [type, value],
  );

  const decodedUrl = useDecodedImage(responsiveUrl);

  // Pull from module-level caches → stable references across renders.
  const cssBgStyle = useMemo<CSSProperties>(() => {
    if ((type === "color" || type === "gradient") && value) {
      return cssBackgroundStyle(value);
    }
    return GLASS_STYLE;
  }, [type, value]);

  const veilStyle = useMemo<CSSProperties>(() => veilStyleFor(safeBlur), [safeBlur]);

  const showImage = type === "image" && !!decodedUrl;

  // LQIP: tiny blurred preview for image backgrounds while the full image decodes
  const lqipUrl = useMemo(
    () => (type === "image" && value ? pickBackgroundUrl(value, 32) : null),
    [type, value],
  );

  return (
    <div aria-hidden className={ROOT_CLASS}>
      {/* CSS wallpaper (color/gradient/glass fallback while image decodes). */}
      <div className={LAYER_CLASS} style={cssBgStyle} />

      {/* LQIP blurred preview — shows instantly while full image decodes */}
      {type === "image" && lqipUrl && (
        <img
          src={lqipUrl}
          alt=""
          aria-hidden
          draggable={false}
          className={`${IMG_CLASS} lqip-blur ${decodedUrl ? "opacity-0" : "opacity-100"}`}
        />
      )}

      {/* Image wallpaper — responsive via srcSet, format-negotiated by Supabase. */}
      {showImage && (
        <img
          src={decodedUrl ?? undefined}
          srcSet={srcSet || undefined}
          sizes="100vw"
          alt=""
          decoding="async"
          loading="eager"
          // @ts-expect-error - fetchPriority is a valid HTML attribute, not yet typed in React 18
          fetchpriority="high"
          draggable={false}
          className={IMG_CLASS}
        />
      )}

      {/* Glass veil — softens busy backgrounds & guarantees text contrast */}
      <div className={VEIL_CLASS} style={veilStyle} />
      {/* Subtle vignette for depth */}
      <div className={LAYER_CLASS} style={VIGNETTE_STYLE} />
    </div>
  );
}

/**
 * Custom equality: treat null/undefined as the same, and bucket `blur` to its
 * clamped+rounded form so a slider passing 20.2 → 20.4 doesn't re-render.
 */
function arePropsEqual(prev: StoreBackgroundConfig, next: StoreBackgroundConfig) {
  if (prev.type !== next.type) return false;
  if ((prev.value ?? null) !== (next.value ?? null)) return false;
  const pb = Math.round(Math.max(0, Math.min(60, prev.blur ?? 20)));
  const nb = Math.round(Math.max(0, Math.min(60, next.blur ?? 20)));
  return pb === nb;
}

const StoreBackgroundLayer = memo(StoreBackgroundLayerImpl, arePropsEqual);
StoreBackgroundLayer.displayName = "StoreBackgroundLayer";

export default StoreBackgroundLayer;
