import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const RARITY_COLORS: Record<string, string> = {
  common: "hsl(215 14% 60%)",
  rare: "hsl(217 91% 60%)",
  epic: "hsl(271 91% 65%)",
  legendary: "hsl(38 92% 50%)",
  mythic: "hsl(0 84% 60%)",
};

const RARITY_LABELS: Record<string, string> = {
  common: "عادي",
  rare: "نادر",
  epic: "أسطوري",
  legendary: "خرافي",
  mythic: "أسطورة",
};

const RARITY_ORDER = ["mythic", "legendary", "epic", "rare", "common"];

interface Prize {
  id: string;
  name_ar: string;
  image_url: string | null;
  rarity: string;
  display_chance?: string | null;
}

export default function PrizeShowcase({ prizes }: { prizes: Prize[] }) {
  const [expanded, setExpanded] = useState(false);

  if (prizes.length === 0) return null;

  const sorted = [...prizes].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-right mb-2"
      >
        <span className="text-xs font-mono text-muted-foreground">🏆 الجوائز المتاحة ({prizes.length})</span>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-fade-in">
          {sorted.map((prize) => {
            const color = RARITY_COLORS[prize.rarity] || RARITY_COLORS.common;
            return (
              <div
                key={prize.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg border pixel-frame"
                style={{ borderColor: color + "44" }}
              >
                {prize.image_url ? (
                  <img
                    src={prize.image_url}
                    alt={prize.name_ar}
                    className="w-9 h-9 object-contain shrink-0"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded bg-muted/20 flex items-center justify-center text-base shrink-0">🎁</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono truncate leading-tight">{prize.name_ar}</p>
                  <p className="text-[9px] font-mono" style={{ color }}>
                    {RARITY_LABELS[prize.rarity] || prize.rarity}
                  </p>
                  {prize.display_chance && (
                    <p className="text-[9px] font-mono text-muted-foreground">{prize.display_chance}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
