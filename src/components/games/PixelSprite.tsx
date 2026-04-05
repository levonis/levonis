/**
 * PixelSprite – renders a clipped region from a sprite sheet.
 * Uses overflow:hidden + negative margins on a scaled <img> for pixel-perfect clipping.
 * For animated sprites, cycles through horizontal frames via setInterval.
 */
import { useState, useEffect, useRef } from "react";
import type { SpriteCoords, AnimatedSpriteCoords } from "./SpriteMap";

const sheet00 = '';
const sheet01 = '';
const sheet02 = '';
const sheet03 = '';
const sheet04 = '';
const sheet05 = '';
const sheet06 = '';
const sheet07 = '';

const SHEETS: Record<string, string> = {
  "00": sheet00, "01": sheet01, "02": sheet02, "03": sheet03,
  "04": sheet04, "05": sheet05, "06": sheet06, "07": sheet07,
};

interface Props {
  sprite: SpriteCoords | AnimatedSpriteCoords;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

function isAnimated(s: SpriteCoords): s is AnimatedSpriteCoords {
  return "frames" in s && (s as AnimatedSpriteCoords).frames > 1;
}

export default function PixelSprite({ sprite, scale = 3, className = "", style }: Props) {
  const src = SHEETS[sprite.sheet];
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const animated = isAnimated(sprite);
  const frames = animated ? (sprite as AnimatedSpriteCoords).frames : 1;
  const speed = animated ? ((sprite as AnimatedSpriteCoords).speed || 100) : 0;

  useEffect(() => {
    if (!animated) return;
    intervalRef.current = setInterval(() => {
      setFrame(f => (f + 1) % frames);
    }, speed);
    return () => clearInterval(intervalRef.current);
  }, [animated, frames, speed]);

  const offsetX = (sprite.x + frame * sprite.w) * scale;
  const offsetY = sprite.y * scale;

  return (
    <div
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: sprite.w * scale,
        height: sprite.h * scale,
        imageRendering: "pixelated",
        ...style,
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          imageRendering: "pixelated",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          marginLeft: -offsetX,
          marginTop: -offsetY,
          maxWidth: "none",
        }}
      />
    </div>
  );
}
