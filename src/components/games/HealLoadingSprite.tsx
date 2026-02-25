import { useEffect, useState, useCallback } from "react";
import healSheet from "@/assets/pixel-ui/03.png";

const TOTAL_FRAMES = 11;
const SHEET_WIDTH = 1920;
const FRAME_WIDTH = SHEET_WIDTH / TOTAL_FRAMES;
const FRAME_HEIGHT = 174;

interface HealLoadingSpriteProps {
  scale?: number;
  fps?: number;
  className?: string;
}

export default function HealLoadingSprite({
  scale = 1,
  fps = 5,
  className = "",
}: HealLoadingSpriteProps) {
  const [frame, setFrame] = useState(0);

  const tick = useCallback(() => {
    setFrame((f) => (f + 1) % TOTAL_FRAMES);
  }, []);

  useEffect(() => {
    const id = setInterval(tick, 1000 / fps);
    return () => clearInterval(id);
  }, [tick, fps]);

  return (
    <div
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: FRAME_WIDTH * scale,
        height: FRAME_HEIGHT * scale,
      }}
      role="img"
      aria-label="loading character animation"
    >
      <img
        src={healSheet}
        alt=""
        draggable={false}
        style={{
          width: SHEET_WIDTH * scale,
          height: FRAME_HEIGHT * scale,
          transform: `translateX(-${frame * FRAME_WIDTH * scale}px)`,
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

