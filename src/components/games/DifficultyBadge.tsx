/** Pixel-style difficulty indicator */
import type { Difficulty } from "./GamesData";

const pixelBorder = (color: string) =>
  `2px 0 0 ${color}, -2px 0 0 ${color}, 0 2px 0 ${color}, 0 -2px 0 ${color}`;

const CONFIG: Record<Difficulty, { label: string; filled: number; color: string }> = {
  easy: { label: "سهل", filled: 1, color: "hsl(142 70% 45%)" },
  medium: { label: "متوسط", filled: 2, color: "hsl(45 90% 50%)" },
  hard: { label: "صعب", filled: 3, color: "hsl(0 70% 50%)" },
};

export default function DifficultyBadge({ level }: { level: Difficulty }) {
  const c = CONFIG[level];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono font-bold text-muted-foreground">{c.label}</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2"
            style={{
              background: i < c.filled ? c.color : "hsl(var(--card))",
              boxShadow: i < c.filled
                ? "inset 0 -1px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)"
                : pixelBorder("hsl(var(--border) / 0.3)"),
            }}
          />
        ))}
      </div>
    </div>
  );
}
