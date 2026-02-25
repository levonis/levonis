import { useEffect, useState } from "react";
import healSheet from "@/assets/pixel-ui/03.png";

const TOTAL_FRAMES = 11;
const FRAME_WIDTH = 174;
const FRAME_HEIGHT = 174;
const DEFAULT_FPS = 5;

interface HealLoadingSpriteProps {
  scale?: number;
  fps?: number;
  className?: string;
}

export default function HealLoadingSprite({
  scale = 1,
  fps = DEFAULT_FPS,
  className = "",
}: HealLoadingSpriteProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const intervalMs = 1000 / fps;
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % TOTAL_FRAMES);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [fps]);

  return (
    <div
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: FRAME_WIDTH * scale,
        height: FRAME_HEIGHT * scale,
        imageRendering: "pixelated",
      }}
      aria-label="loading-animation"
    >
      <img
        src={healSheet}
        alt=""
        draggable={false}
        style={{
          imageRendering: "pixelated",
          width: FRAME_WIDTH * TOTAL_FRAMES * scale,
          height: FRAME_HEIGHT * scale,
          marginLeft: -(frame * FRAME_WIDTH * scale),
          marginTop: 0,
          maxWidth: "none",
          userSelect: "none",
          display: "block",
        }}
      />
    </div>
  );
}
