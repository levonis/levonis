import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildBackgroundSrcSet, pickBackgroundUrl } from "@/lib/backgroundImage";

export type StoreBackgroundType = "glass" | "color" | "gradient" | "image";

export interface StoreBackgroundConfig {
  type: StoreBackgroundType;
  /** hex color, CSS gradient string, or image URL */
  value?: string | null;
  /** Foreground glass blur intensity in px (0-60). */
  blur?: number | null;
}

const GLASS_DEFAULT_BG =
  "radial-gradient(ellipse at 20% 0%, hsl(var(--primary) / 0.18), transparent 55%)," +
  "radial-gradient(ellipse at 100% 100%, hsl(var(--primary) / 0.12), transparent 55%)," +
  "hsl(var(--background))";

const VIGNETTE_BG =
  "radial-gradient(ellipse at center, transparent 55%, hsl(var(--background)/0.5) 100%)";

const VIGNETTE_STYLE: CSSProperties = { backgroundImage: VIGNETTE_BG };

/**
 * Tracks the current viewport width — coarsely bucketed — so we can pick the
 * right responsive variant without re-rendering on every resize pixel.
 */
function useViewportBucket(): number {
  const compute = () => {
    if (typeof window === "undefined") return 1280;
    return window.innerWidth;
  };
  const [w, setW] = useState<number>(compute);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return w;
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
      setResolved(null);
      return;
    }
    if (lastUrlRef.current === url) return;
    lastUrlRef.current = url;

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = url;

    const finalize = () => {
      if (!cancelled) setResolved(url);
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

/**
 * Renders a fixed full-viewport background for the merchant store page.
 *
 * Image mode now uses a real `<img>` element with `srcSet`/`sizes` so the
 * browser picks the smallest responsive variant for the current device — and
 * Supabase image transforms auto-negotiate WebP/AVIF based on Accept headers.
 */
function StoreBackgroundLayerImpl({
  type = "glass",
  value,
  blur = 20,
}: StoreBackgroundConfig) {
  const safeBlur = useMemo(
    () => Math.max(0, Math.min(60, blur ?? 20)),
    [blur],
  );

  const viewportWidth = useViewportBucket();

  // Pre-pick the URL for the current viewport so the decode-ahead hook keys
  // off the same string the <img> will request.
  const responsiveUrl = useMemo(
    () => (type === "image" ? pickBackgroundUrl(value, viewportWidth) : null),
    [type, value, viewportWidth],
  );
  const srcSet = useMemo(
    () => (type === "image" && value ? buildBackgroundSrcSet(value) : ""),
    [type, value],
  );

  const decodedUrl = useDecodedImage(responsiveUrl);

  const cssBgStyle = useMemo<CSSProperties>(() => {
    if (type === "color" && value) return { background: value };
    if (type === "gradient" && value) return { background: value };
    return { background: GLASS_DEFAULT_BG };
  }, [type, value]);

  const veilStyle = useMemo<CSSProperties>(() => {
    const filter = `blur(${safeBlur}px) saturate(140%)`;
    return {
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
      willChange: "backdrop-filter",
    };
  }, [safeBlur]);

  const showImage = type === "image" && !!decodedUrl;

  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* CSS wallpaper (color/gradient/glass fallback while image decodes). */}
      <div className="absolute inset-0" style={cssBgStyle} />

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
          className="absolute inset-0 w-full h-full object-cover select-none"
        />
      )}

      {/* Glass veil — softens busy backgrounds & guarantees text contrast */}
      <div className="absolute inset-0 bg-background/40" style={veilStyle} />
      {/* Subtle vignette for depth */}
      <div className="absolute inset-0" style={VIGNETTE_STYLE} />
    </div>
  );
}

const StoreBackgroundLayer = memo(StoreBackgroundLayerImpl);
StoreBackgroundLayer.displayName = "StoreBackgroundLayer";

export default StoreBackgroundLayer;
