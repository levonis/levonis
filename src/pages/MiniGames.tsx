import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Gamepad2, Filter, Flame, Clock, Star, Zap, ShoppingBag, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import PixelBackground from "@/components/games/PixelBackground";
import PixelLoadingScreen from "@/components/games/PixelLoadingScreen";
import { useGameSounds } from "@/components/games/useGameSounds";
import GameCard from "@/components/games/GameCard";
import PixelMusicRadio from "@/components/games/PixelMusicRadio";
import GameBalanceBar from "@/components/games/GameBalanceBar";
import { GAME_NODES, FILTER_NODES, filterGameNodes, GameCategory, GameResource } from "@/components/games/GamesData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SpaceBlasterGame = lazy(() => import("@/components/games/SpaceBlasterGame"));
const MysteryCase = lazy(() => import("@/components/games/mystery-case/MysteryCase"));
const StackGame = lazy(() => import("@/components/games/stack-game/StackGame"));
const GameStore = lazy(() => import("@/components/games/GameStore"));
const MyGamePrizes = lazy(() => import("@/components/games/MyGamePrizes"));
import AdRewardSection from "@/components/games/AdRewardSection";

const FILTER_ICONS = { Filter, Flame, Clock, Star, Zap } as const;

export default function MiniGames() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { playClick } = useGameSounds();

  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<GameCategory>(GameCategory.ALL);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [showStore, setShowStore] = useState(false);
  const [showPrizes, setShowPrizes] = useState(false);

  const handleLoadComplete = useCallback(() => setLoading(false), []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.inset = '0';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
    };
  }, []);


  // Fetch disabled game settings for all games
  const { data: stackSettings } = useQuery({
    queryKey: ["stack-game-enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("stack_game_settings").select("game_enabled").limit(1).single();
      return data as any;
    },
  });

  const { data: spaceSettings } = useQuery({
    queryKey: ["space-blaster-enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("space_blaster_settings").select("game_enabled").limit(1).single();
      return data as any;
    },
  });

  const { data: mysterySettings } = useQuery({
    queryKey: ["mystery-case-enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("mystery_case_settings").select("game_enabled").limit(1).single();
      return data as any;
    },
  });

  // Mark disabled games instead of filtering them out
  const gamesWithStatus = GAME_NODES.map(game => {
    if (game.node_name === "stack_tower" && stackSettings && !stackSettings.game_enabled) {
      return { ...game, _disabled: true };
    }
    if (game.node_name === "space_blaster" && spaceSettings && !spaceSettings.game_enabled) {
      return { ...game, _disabled: true };
    }
    if (game.node_name === "mystery_case" && mysterySettings && !mysterySettings.game_enabled) {
      return { ...game, _disabled: true };
    }
    return { ...game, _disabled: false };
  });

  const filteredGames = filterGameNodes(gamesWithStatus, activeFilter);

  const handlePlay = (game: GameResource) => {
    setActiveGame(game.node_name);
  };

  if (showPrizes) {
    return (
      <div className="fixed inset-0 z-30 bg-background text-foreground overflow-y-auto" dir="rtl">
        <PixelBackground />
        <div className="relative z-10 max-w-2xl mx-auto">
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-primary font-mono">Loading...</div>}>
            <MyGamePrizes onBack={() => setShowPrizes(false)} />
          </Suspense>
        </div>
        <PixelMusicRadio />
      </div>
    );
  }

  if (showStore) {
    return (
      <div className="fixed inset-0 z-30 bg-background text-foreground overflow-y-auto" dir="rtl">
        <PixelBackground />
        <div className="relative z-10 max-w-2xl mx-auto">
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-primary font-mono">Loading...</div>}>
            <GameStore onBack={() => setShowStore(false)} />
          </Suspense>
        </div>
        <PixelMusicRadio />
      </div>
    );
  }

  if (activeGame) {
    return (
      <div className="fixed inset-0 z-30 bg-background text-foreground overflow-y-auto" dir="rtl">
        <PixelBackground />
        <div className="relative z-10 max-w-2xl mx-auto">
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-primary font-mono">Loading...</div>}>
            {activeGame === 'space_blaster' && (
              <SpaceBlasterGame onBack={() => setActiveGame(null)} />
            )}
            {activeGame === 'mystery_case' && (
              <MysteryCase onBack={() => setActiveGame(null)} />
            )}
            {activeGame === 'stack_tower' && (
              <StackGame onBack={() => setActiveGame(null)} />
            )}
          </Suspense>
        </div>
        <PixelMusicRadio />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-background text-foreground overflow-y-auto" dir="rtl">
      {loading && <PixelLoadingScreen onComplete={handleLoadComplete} />}
      <PixelBackground />

      {/* Header */}
      <div className="sticky top-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost" size="sm"
            onClick={() => { playClick(); navigate('/rewards?tab=points&sub=games'); }}
            className="gap-1 text-muted-foreground hover:text-foreground font-mono text-xs pixel-btn-ghost"
          >
            <ArrowRight className="h-4 w-4" /> BACK
          </Button>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="text-primary font-bold text-xs font-mono tracking-wider">ARCADE</span>
          </div>
        </div>
      </div>

      {/* Balance Bar + Store Button */}
      <div className="max-w-2xl mx-auto px-4 py-2 relative z-10 flex items-center justify-between">
        <GameBalanceBar />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { playClick(); setShowPrizes(true); }}
            className="font-mono text-xs gap-1 pixel-frame"
          >
            <Gift className="h-3.5 w-3.5" /> جوائزي
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { playClick(); setShowStore(true); }}
            className="font-mono text-xs gap-1 pixel-frame"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> المتجر
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-2xl mx-auto px-4 py-2 relative z-10">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {FILTER_NODES.map(f => {
            const Icon = FILTER_ICONS[f.icon_name];
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { playClick(); setActiveFilter(f.id); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded font-mono text-[10px] whitespace-nowrap transition-all ${
                  isActive ? 'pixel-btn-active text-primary-foreground' : 'pixel-frame text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3 w-3" /> {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Game Grid */}
      <div className="max-w-2xl mx-auto px-4 py-4 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          {filteredGames.map(game => (
            <GameCard
              key={game.node_name}
              game={game}
              onPlay={() => handlePlay(game)}
              onClickSound={playClick}
              disabled={(game as any)._disabled}
            />
          ))}
        </div>
      </div>

      <PixelMusicRadio />
    </div>
  );
}
