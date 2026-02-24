/** Pixel-style difficulty indicator using sprite sheet diamonds */
import PixelSprite from "./PixelSprite";
import { SPRITE_ICONS } from "./SpriteMap";
import type { Difficulty } from "./GamesData";

const CONFIG: Record<Difficulty, { label: string; filled: number; sprite: typeof SPRITE_ICONS.DIAMOND_GREEN }> = {
  easy: { label: "سهل", filled: 1, sprite: SPRITE_ICONS.DIAMOND_GREEN },
  medium: { label: "متوسط", filled: 2, sprite: SPRITE_ICONS.DIAMOND_YELLOW },
  hard: { label: "صعب", filled: 3, sprite: SPRITE_ICONS.DIAMOND_RED },
};

export default function DifficultyBadge({ level }: { level: Difficulty }) {
  const c = CONFIG[level];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono font-bold text-muted-foreground">{c.label}</span>
      <div className="flex gap-[1px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <PixelSprite
            key={i}
            sprite={i < c.filled ? c.sprite : SPRITE_ICONS.DIAMOND_GRAY}
            scale={1}
            style={{ opacity: i < c.filled ? 1 : 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}
