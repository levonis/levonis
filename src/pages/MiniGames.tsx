import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Filter, Flame, Clock, Star, Zap, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import PixelBackground from "@/components/games/PixelBackground";
import PixelLoadingScreen from "@/components/games/PixelLoadingScreen";
import PixelMusicRadio from "@/components/games/PixelMusicRadio";
import { useGameSounds } from "@/components/games/useGameSounds";
import GameCard from "@/components/games/GameCard";
import PixelSprite from "@/components/games/PixelSprite";
import { SPRITE_ICONS } from "@/components/games/SpriteMap";
import GameLevelBadge from "@/components/games/GameLevelBadge";
import GameEntryCharacter from "@/components/games/GameEntryCharacter";
import {
  GAME_NODES,
  FILTER_NODES,
  filterGameNodes,
  GameCategory,
  GameStatus,
} from "@/components/games/GamesData";

const RockPaperScissorsGame = lazy(() => import("@/components/games/RockPaperScissorsGame"));

const FILTER_ICONS: Record<string, React.ReactNode> = {
  Filter: <Filter className="h-3.5 w-3.5" />,
  Flame: <Flame className="h-3.5 w-3.5" />,
  Clock: <Clock className="h-3.5 w-3.5" />,
  Star: <Star className="h-3.5 w-3.5" />,
  Zap: <Zap className="h-3.5 w-3.5" />,
};

export default function MiniGames() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [filter, setFilter] = useState<GameCategory>(GameCategory.ALL);
  const [loading, setLoading] = useState(true);
  const { playClick } = useGameSounds();

  const { data: userPoints } = useQuery({
    queryKey: ['user-points-full', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('user_points').select('available_points').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const filteredGames = useMemo(() => filterGameNodes(GAME_NODES, filter), [filter]);
  const handleLoadComplete = useCallback(() => setLoading(false), []);

  // Calculate level from points (100 points per level)
  const POINTS_PER_LEVEL = 100;
  const totalPoints = userPoints?.available_points || 0;
  const playerLevel = Math.floor(totalPoints / POINTS_PER_LEVEL);
  const levelProgress = totalPoints % POINTS_PER_LEVEL;

  if (activeGame === 'rps') {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <Suspense fallback={<div className="flex items-center justify-center h-full text-primary font-mono">LOADING...</div>}>
          <RockPaperScissorsGame onBack={() => setActiveGame(null)} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative" dir="rtl">
      {loading && <PixelLoadingScreen onComplete={handleLoadComplete} />}
      <PixelBackground />
      <PixelMusicRadio />

      {/* Header */}
      <div className="sticky top-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { playClick(); navigate('/rewards?tab=points&sub=games'); }}
            className="gap-1 text-muted-foreground hover:text-foreground font-mono text-xs pixel-btn-ghost"
          >
            <ArrowRight className="h-4 w-4" />
            BACK
          </Button>

          {user && (
            <div className="flex items-center gap-2">
              <GameLevelBadge level={playerLevel} progressPercent={levelProgress} size="sm" />
              <div className="pixel-frame-inset px-3 py-1.5 flex items-center gap-2">
                <PixelSprite sprite={SPRITE_ICONS.COIN} scale={1.5} />
                <span className="text-primary font-bold text-sm font-mono">{totalPoints.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8 relative z-10">
        {/* Hero */}
        <div className="text-center py-8">
          {/* Animated entry character */}
          <div className="flex justify-center mb-4">
            <GameEntryCharacter scale={3} speed={120} loop />
          </div>
          <div className="inline-flex items-center gap-2 pixel-frame px-5 py-2 mb-4">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span className="text-primary font-bold text-sm font-mono tracking-wider">PIXEL GAMES</span>
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2 font-mono"
            style={{ textShadow: "3px 3px 0 hsl(var(--accent) / 0.4)" }}>
            العب واربح نقاط! 🎮
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            اختر لعبتك المفضلة وابدأ بجمع النقاط
          </p>
          {/* Decorative sprites */}
          <div className="flex justify-center gap-3 mt-3 opacity-50">
            <PixelSprite sprite={SPRITE_ICONS.STAR_FULL} scale={1.5} className="pixel-twinkle" />
            <PixelSprite sprite={SPRITE_ICONS.GEM_BLUE} scale={1.5} className="pixel-twinkle" style={{ animationDelay: "0.3s" }} />
            <PixelSprite sprite={SPRITE_ICONS.GEM_GREEN} scale={1.5} className="pixel-twinkle" style={{ animationDelay: "0.6s" }} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
          {FILTER_NODES.map(f => (
            <button
              key={f.id}
              onClick={() => { playClick(); setFilter(f.id); }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all shrink-0 font-mono",
                filter === f.id ? "pixel-btn-active" : "pixel-btn"
              )}
            >
              {FILTER_ICONS[f.icon_name]}
              {f.label}
            </button>
          ))}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredGames.map((game, i) => (
            <div key={game.node_name} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <GameCard
                game={game}
                onPlay={() => game.status === GameStatus.LIVE && setActiveGame(game.node_name)}
                onClickSound={playClick}
              />
            </div>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-mono">لا توجد ألعاب في هذه الفئة حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
