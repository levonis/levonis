/** Individual Game Card – pixel frame style */
import { Lock, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { GameResource, GameStatus } from "./GamesData";
import DifficultyBadge from "./DifficultyBadge";

interface GameCardProps {
  game: GameResource;
  onPlay: () => void;
  onClickSound: () => void;
}

export default function GameCard({ game, onPlay, onClickSound }: GameCardProps) {
  const isLive = game.status === GameStatus.LIVE;

  return (
    <button
      onClick={() => { onClickSound(); onPlay(); }}
      disabled={!isLive}
      className={cn(
        "group text-right p-4 transition-all duration-200 relative overflow-hidden w-full",
        isLive
          ? "pixel-frame hover:pixel-frame-active cursor-pointer active:scale-[0.98]"
          : "pixel-frame-disabled cursor-not-allowed opacity-60"
      )}
    >
      {/* Status badges */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {isLive ? (
          <span className="pixel-badge-live text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider">● LIVE</span>
        ) : (
          <span className="pixel-badge-locked text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider">قريباً</span>
        )}
        {game.is_new && isLive && (
          <span className="pixel-badge-new text-[9px] font-mono font-bold px-2 py-0.5">★ جديد</span>
        )}
        <DifficultyBadge level={game.difficulty} />
      </div>

      {/* Icon */}
      <div className={cn(
        "w-14 h-14 flex items-center justify-center text-3xl mb-3 transition-transform duration-300",
        isLive ? "pixel-frame-inset group-hover:scale-110 group-hover:rotate-2" : "pixel-frame-inset opacity-40"
      )}>
        {isLive ? game.icon : <Lock className="h-6 w-6 text-muted-foreground/50" />}
      </div>

      <h3 className={cn("font-bold text-sm mb-1 line-clamp-1 font-mono", isLive ? "text-foreground" : "text-muted-foreground")}>{game.title}</h3>
      <p className={cn("text-[11px] leading-relaxed mb-3 line-clamp-2", isLive ? "text-muted-foreground" : "text-muted-foreground/50")}>{game.description}</p>

      {/* Reward info */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-primary font-bold font-mono">
          <Trophy className="h-3 w-3" /> {game.reward}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <Users className="h-3 w-3" /> {game.players}
        </span>
      </div>

      {/* Play button */}
      {isLive && (
        <div className="mt-2 pixel-btn-play py-1.5 text-center group-hover:brightness-110 transition-all">
          <span className="text-xs font-bold font-mono tracking-wider">▶ PLAY</span>
        </div>
      )}
    </button>
  );
}
