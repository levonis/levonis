/** Pixel Health Bar – uses real sprite sheet assets from BDragon1727 */
import PixelSprite from "./PixelSprite";
import { SPRITE_ICONS } from "./SpriteMap";

interface PixelHealthBarProps {
  value: number;
  max: number;
  color?: "primary" | "green" | "red";
}

const COLORS: Record<string, { fill: string; bg: string; glow: string }> = {
  primary: { fill: "hsl(var(--primary))", bg: "hsl(var(--card))", glow: "hsl(var(--primary) / 0.4)" },
  green: { fill: "hsl(142 70% 45%)", bg: "hsl(var(--card))", glow: "hsl(142 70% 45% / 0.3)" },
  red: { fill: "hsl(0 70% 50%)", bg: "hsl(var(--card))", glow: "hsl(0 70% 50% / 0.3)" },
};

export default function PixelHealthBar({ value, max, color = "primary" }: PixelHealthBarProps) {
  const segments = 10;
  const filled = Math.round((value / max) * segments);
  const c = COLORS[color] || COLORS.primary;

  return (
    <div className="flex items-center gap-2">
      {/* Heart icon from sprite sheet */}
      <PixelSprite sprite={SPRITE_ICONS.HEART_FULL} scale={1.5} />
      <div className="pixel-frame-inset p-[3px] flex-1">
        <div className="flex gap-[1px] h-3">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className="flex-1 transition-all duration-150"
              style={{
                background: i < filled ? c.fill : c.bg,
                boxShadow: i < filled
                  ? `inset 0 -2px 0 ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
