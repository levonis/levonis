/** Individual Game Card – pixel frame style with sprite sheet assets */
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GameResource, GameStatus } from "./GamesData";
import DifficultyBadge from "./DifficultyBadge";
import PixelSprite from "./PixelSprite";
import { SPRITE_ICONS } from "./SpriteMap";

interface GameCardProps {
  game: GameResource;
  onPlay: () => void;
  onClickSound: () => void;
  disabled?: boolean;
}

export default function GameCard({ game, onPlay, onClickSound }: GameCardProps) {
  const isLive = game.status === GameStatus.LIVE;

  // Locked / Coming Soon card – minimal placeholder
  if (!isLive) {
    return (
      <div className="pixel-frame-disabled opacity-60 p-4 flex flex-col items-center justify-center min-h-[180px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <span className="pixel-badge-locked text-[11px] font-mono font-bold px-3 py-1 uppercase tracking-wider">
          قريباً
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={() => { onClickSound(); onPlay(); }}
      className={cn(
        "group text-right p-4 transition-all duration-200 relative overflow-hidden w-full",
        "pixel-frame hover:pixel-frame-active cursor-pointer active:scale-[0.98]"
      )}
    >
      {/* Status badges */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="pixel-badge-live text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
          <PixelSprite sprite={SPRITE_ICONS.DIAMOND_GREEN} scale={0.8} />
          LIVE
        </span>
        {game.is_new && (
          <span className="pixel-badge-new text-[9px] font-mono font-bold px-2 py-0.5 flex items-center gap-1">
            <PixelSprite sprite={SPRITE_ICONS.STAR_FULL} scale={0.8} />
            جديد
          </span>
        )}
        <DifficultyBadge level={game.difficulty} />
      </div>

      {/* Game Image */}
      <div className="w-16 h-16 flex items-center justify-center mb-3 transition-transform duration-300 pixel-frame-inset group-hover:scale-110 group-hover:rotate-2 overflow-hidden rounded">
        {game.image ? (
          <img src={game.image} alt={game.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">{game.icon}</span>
        )}
      </div>

      <h3 className="font-bold text-sm mb-1 line-clamp-1 font-mono text-foreground">{game.title}</h3>
      <p className="text-[11px] leading-relaxed mb-3 line-clamp-2 text-muted-foreground">{game.description}</p>

      {/* Reward info with sprite icons */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-primary font-bold font-mono">
          <PixelSprite sprite={SPRITE_ICONS.TROPHY} scale={1} /> {game.reward}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <PixelSprite sprite={SPRITE_ICONS.COIN} scale={1} /> {game.players}
        </span>
      </div>

      {/* Play button */}
      <div className="mt-2 pixel-btn-play py-1.5 text-center group-hover:brightness-110 transition-all">
        <span className="text-xs font-bold font-mono tracking-wider">▶ PLAY</span>
      </div>
    </button>
  );
}
