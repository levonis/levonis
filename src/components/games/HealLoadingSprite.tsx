import { useEffect, useState, useCallback } from "react";
import healSheet from "@/assets/pixel-ui/03.png";

const TOTAL_FRAMES = 11;

interface HealLoadingSpriteProps {
  /** Display scale multiplier */
  scale?: number;
  /** Frames per second */
  fps?: number;
  className?: string;
}

/**
 * Sprite sheet animation using CSS background-position.
 * The sheet (03.png) is a single horizontal row of 11 frames.
 * Uses background-position stepping for pixel-perfect frame switching.
 */
export default function HealLoadingSprite({
  scale = 1,
  fps = 5,
  className = "",
}: HealLoadingSpriteProps) {
  const [frame, setFrame] = useState(0);
  const [dims, setDims] = useState<{ sheetW: number; sheetH: number } | null>(null);

  // Load sheet dimensions once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setDims({ sheetW: img.naturalWidth, sheetH: img.naturalHeight });
    };
    img.src = healSheet;
  }, []);

  // Frame ticker
  const tick = useCallback(() => {
    setFrame((f) => (f + 1) % TOTAL_FRAMES);
  }, []);

  useEffect(() => {
    const id = setInterval(tick, 1000 / fps);
    return () => clearInterval(id);
  }, [tick, fps]);

  if (!dims) {
    // Reserve space to prevent layout shift
    return (
      <div
        className={`inline-block shrink-0 ${className}`}
        style={{ width: 160, height: 160 }}
        role="img"
        aria-label="loading character animation"
      />
    );
  }

  const frameW = dims.sheetW / TOTAL_FRAMES;
  const frameH = dims.sheetH;
  const displayW = Math.round(frameW * scale);
  const displayH = Math.round(frameH * scale);

  return (
    <div
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: displayW,
        height: displayH,
        backgroundImage: `url(${healSheet})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${Math.round(dims.sheetW * scale)}px ${displayH}px`,
        backgroundPositionX: -Math.round(frame * frameW * scale),
        backgroundPositionY: 0,
        transition: "none",
        imageRendering: "pixelated",
      }}
      role="img"
      aria-label="loading character animation"
    />
  );
}
