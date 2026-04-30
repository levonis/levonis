import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

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
 * Decodes a remote image off the main thread (when supported) so applying it
 * as a CSS background-image doesn't trigger a long paint. Returns the URL
 * once it's safe to render, or `null` while loading / when input is empty.
 *
 * Cleans up the in-flight Image on unmount or URL change to prevent leaking
 * decoded bitmaps when the user toggles backgrounds rapidly from settings.
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
    img.loading = "lazy";
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
      // Drop the bitmap reference so the GC can reclaim it immediately.
      img.src = "";
    };
  }, [url]);

  return resolved;
}

/**
 * Renders a fixed full-viewport background for the merchant store page.
 *
 * Performance:
 * - `React.memo` short-circuits when parent re-renders with identical props.
 * - Inline style objects are memoised so referential equality is preserved.
 * - Image backgrounds are decoded off-thread before being applied.
 * - The blur veil hints `will-change: backdrop-filter` so the compositor
 *   uploads it to its own layer once.
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

  // Only feed the decoder when in image mode — saves work in other modes.
  const imageUrl = type === "image" && value ? value : null;
  const decodedUrl = useDecodedImage(imageUrl);

  const bgStyle = useMemo<CSSProperties>(() => {
    if (type === "color" && value) return { background: value };
    if (type === "gradient" && value) return { background: value };
    if (type === "image") {
      if (!decodedUrl) return { background: GLASS_DEFAULT_BG };
      return {
        backgroundImage: `url("${decodedUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    return { background: GLASS_DEFAULT_BG };
  }, [type, value, decodedUrl]);

  const veilStyle = useMemo<CSSProperties>(() => {
    const filter = `blur(${safeBlur}px) saturate(140%)`;
    return {
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
      willChange: "backdrop-filter",
    };
  }, [safeBlur]);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* Wallpaper layer */}
      <div className="absolute inset-0" style={bgStyle} />
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
