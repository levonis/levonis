import type { CSSProperties } from "react";

export type StoreBackgroundType = "glass" | "color" | "gradient" | "image";

export interface StoreBackgroundConfig {
  type: StoreBackgroundType;
  /** hex color, CSS gradient string, or image URL */
  value?: string | null;
  /** Foreground glass blur intensity in px (0-60). */
  blur?: number | null;
}

/**
 * Renders a fixed full-viewport background for the merchant store page.
 * The page content above this layer should sit on top of `glass-tile`/`glass-panel`
 * surfaces so the chosen wallpaper bleeds through (Glassmorphism Professional).
 */
export default function StoreBackgroundLayer({
  type = "glass",
  value,
  blur = 20,
}: StoreBackgroundConfig) {
  const safeBlur = Math.max(0, Math.min(60, blur ?? 20));

  let bgStyle: CSSProperties = {};
  if (type === "color" && value) {
    bgStyle.background = value;
  } else if (type === "gradient" && value) {
    bgStyle.background = value;
  } else if (type === "image" && value) {
    bgStyle.backgroundImage = `url("${value}")`;
    bgStyle.backgroundSize = "cover";
    bgStyle.backgroundPosition = "center";
    bgStyle.backgroundRepeat = "no-repeat";
  } else {
    // glass default — soft tinted radial that uses the app primary color.
    bgStyle.background =
      "radial-gradient(ellipse at 20% 0%, hsl(var(--primary) / 0.18), transparent 55%)," +
      "radial-gradient(ellipse at 100% 100%, hsl(var(--primary) / 0.12), transparent 55%)," +
      "hsl(var(--background))";
  }

  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* Wallpaper layer */}
      <div className="absolute inset-0" style={bgStyle} />
      {/* Glass veil — softens busy backgrounds & guarantees text contrast */}
      <div
        className="absolute inset-0 bg-background/40"
        style={{ backdropFilter: `blur(${safeBlur}px) saturate(140%)`, WebkitBackdropFilter: `blur(${safeBlur}px) saturate(140%)` }}
      />
      {/* Subtle vignette for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background)/0.5)_100%)]" />
    </div>
  );
}
