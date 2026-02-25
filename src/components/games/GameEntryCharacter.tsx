/** Animated character sprite for games hub entry – 11 horizontal frames */
import { useState, useEffect, useRef } from "react";
import healSprite from "@/assets/pixel-ui/heal-sprite.png";

interface Props {
  scale?: number;
  className?: string;
  /** Play once then hold last frame, or loop */
  loop?: boolean;
  speed?: number;
}

const TOTAL_FRAMES = 11;

export default function GameEntryCharacter({
  scale = 3,
  className = "",
  loop = true,
  speed = 120,
}: Props) {
  const [frame, setFrame] = useState(0);
  const [frameW, setFrameW] = useState(0);
  const [sheetW, setSheetW] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Load image to get dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setFrameW(Math.floor(img.naturalWidth / TOTAL_FRAMES));
      setSheetW(img.naturalWidth);
      setSheetH(img.naturalHeight);
    };
    img.src = healSprite;
  }, []);

  // Animate frames
  useEffect(() => {
    if (!frameW) return;
    intervalRef.current = setInterval(() => {
      setFrame((f) => {
        if (!loop && f >= TOTAL_FRAMES - 1) return f;
        return (f + 1) % TOTAL_FRAMES;
      });
    }, speed);
    return () => clearInterval(intervalRef.current);
  }, [frameW, loop, speed]);

  if (!frameW) return null;

  const displayW = frameW * scale;
  const displayH = sheetH * scale;

  return (
    <div
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: displayW,
        height: displayH,
        imageRendering: "pixelated",
      }}
    >
      <img
        src={healSprite}
        alt="Game character"
        draggable={false}
        style={{
          imageRendering: "pixelated",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          marginLeft: -(frame * frameW * scale),
          marginTop: 0,
          maxWidth: "none",
        }}
      />
    </div>
  );
}
