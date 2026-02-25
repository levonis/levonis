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
  const [dims, setDims] = useState<{ sheetW: number; sheetH: number }>({ sheetW: 1920, sheetH: 174 });

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

  

  const frameW = dims.sheetW / TOTAL_FRAMES;
  const frameH = dims.sheetH;

  return (
    <div
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: frameW * scale,
        height: frameH * scale,
      }}
      role="img"
      aria-label="loading character animation"
    >
      <img
        src={healSheet}
        alt=""
        draggable={false}
        style={{
          width: dims.sheetW * scale,
          height: frameH * scale,
          transform: `translateX(-${frame * frameW * scale}px)`,
          imageRendering: "pixelated",
          display: "block",
          maxWidth: "none",
          userSelect: "none",
          pointerEvents: "none",
          transition: "none",
        }}
      />
    </div>
  );
}
