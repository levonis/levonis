import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Gamepad2, Filter, Flame, Clock, Star, Zap, ShoppingBag, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import PixelBackground from "@/components/games/PixelBackground";

import { useGameSounds } from "@/components/games/useGameSounds";
import GameCard from "@/components/games/GameCard";
import PixelMusicRadio from "@/components/games/PixelMusicRadio";
import GameBalanceBar from "@/components/games/GameBalanceBar";
import { GAME_NODES, FILTER_NODES, filterGameNodes, GameCategory, GameResource, GameStatus } from "@/components/games/GamesData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SpaceBlasterGame = lazy(() => import("@/components/games/SpaceBlasterGame"));
const MysteryCase = lazy(() => import("@/components/games/mystery-case/MysteryCase"));
const StackGame = lazy(() => import("@/components/games/stack-game/StackGame"));
const KnifeRainGame = lazy(() => import("@/components/games/knife-rain/KnifeRainGame"));
const CrossyRoadGame = lazy(() => import("@/components/games/crossy-road/CrossyRoadGame"));
const GachaLanding = lazy(() => import("@/components/games/gacha/GachaLanding"));
const GameStore = lazy(() => import("@/components/games/GameStore"));
const MyGamePrizes = lazy(() => import("@/components/games/MyGamePrizes"));
import AdRewardSection from "@/components/games/AdRewardSection";
import WinnersTicker from "@/components/games/WinnersTicker";

const FILTER_ICONS = { Filter, Flame, Clock, Star, Zap } as const;

export default function MiniGames() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { playClick } = useGameSounds();

  const [activeFilter, setActiveFilter] = useState<GameCategory>(GameCategory.ALL);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [showStore, setShowStore] = useState(false);
  const [showPrizes, setShowPrizes] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    // Only lock body scroll when a game is active (fullscreen)
    if (activeGame || showStore || showPrizes) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.inset = '0';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
    };
  }, [activeGame, showStore, showPrizes]);


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

  const { data: knifeRainSettings } = useQuery({
    queryKey: ["knife-rain-enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("knife_rain_settings").select("game_enabled").limit(1).single();
      return data as any;
    },
  });

  const { data: crossyRoadSettings } = useQuery({
    queryKey: ["crossy-road-enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("crossy_road_settings").select("game_enabled, next_season_starts_at").limit(1).single();
      return data as any;
    },
  });

  // Active leaderboard prize counts per game
  const { data: prizeCounts } = useQuery({
    queryKey: ["game-prize-counts"],
    queryFn: async () => {
      const [cr, st, kr, crM, stM, krM] = await Promise.all([
        supabase.from("crossy_road_leaderboard_prizes").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("stack_game_leaderboard_prizes").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("knife_rain_leaderboard_prizes").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("crossy_road_milestones").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("stack_game_milestones").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("knife_rain_milestones").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return {
        crossy_road: (cr.count || 0) + (crM.count || 0),
        stack_tower: (st.count || 0) + (stM.count || 0),
        knife_rain: (kr.count || 0) + (krM.count || 0),
      } as Record<string, number>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mark disabled games instead of filtering them out
  // Gacha is fully disabled (hidden for everyone)
  const disabledGames = ["gacha"];
  const gamesWithStatus = GAME_NODES.map(game => {
    if (disabledGames.includes(game.node_name)) {
      return { ...game, _disabled: true, _hidden: true };
    }
    if (game.node_name === "stack_tower" && stackSettings && !stackSettings.game_enabled) {
      return { ...game, _disabled: true, _hidden: !isAdmin };
    }
    if (game.node_name === "space_blaster" && spaceSettings && !spaceSettings.game_enabled) {
      return { ...game, _disabled: true, _hidden: !isAdmin };
    }
    if (game.node_name === "mystery_case" && mysterySettings && !mysterySettings.game_enabled) {
      return { ...game, _disabled: true, _hidden: !isAdmin };
    }
    if (game.node_name === "knife_rain" && knifeRainSettings && !knifeRainSettings.game_enabled) {
      return { ...game, _disabled: true, _hidden: !isAdmin };
    }
    if (game.node_name === "crossy_road" && crossyRoadSettings && !crossyRoadSettings.game_enabled) {
      return { ...game, _disabled: true, _hidden: !isAdmin };
    }
    let startingSoon: string | undefined = undefined;
    if (game.node_name === "crossy_road" && crossyRoadSettings?.next_season_starts_at) {
      const startsAt = new Date(crossyRoadSettings.next_season_starts_at).getTime();
      const now = currentTime;
      if (startsAt > now) {
        const diff = startsAt - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (days > 0) startingSoon = `${days} يوم و${hours} ساعة`;
        else if (hours > 0) startingSoon = `${hours} ساعة و${mins} دقيقة`;
        else if (mins > 0) startingSoon = `${mins} دقيقة و${secs} ثانية`;
        else startingSoon = `${secs} ثانية`;
      }
    }

    return { ...game, _disabled: false, _starting_soon: startingSoon };
  });

  const filteredGames = filterGameNodes(gamesWithStatus, activeFilter)
    .filter((g: any) => !g._hidden)
    .sort((a, b) => {
      const aLive = !(a as any)._disabled && a.status !== GameStatus.COMING_SOON;
      const bLive = !(b as any)._disabled && b.status !== GameStatus.COMING_SOON;
      
      if (aLive === bLive) return ((a as any).display_order ?? 99) - ((b as any).display_order ?? 99);
      return aLive ? -1 : 1;
    });

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
        {activeGame !== 'crossy_road' && <PixelBackground />}
        <div className={`relative z-10 ${activeGame === 'crossy_road' ? 'fixed inset-0' : 'fixed inset-0 overflow-y-auto'}`}>
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
            {activeGame === 'knife_rain' && (
              <KnifeRainGame onBack={() => setActiveGame(null)} />
            )}
            {activeGame === 'crossy_road' && (
              <CrossyRoadGame onBack={() => setActiveGame(null)} />
            )}
            {activeGame === 'gacha' && (
              <GachaLanding onBack={() => setActiveGame(null)} />
            )}
          </Suspense>
        </div>
        {activeGame !== 'crossy_road' && <PixelMusicRadio />}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-background text-foreground overflow-y-auto" dir="rtl">
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

      {/* Winners Ticker */}
      <div className="max-w-2xl mx-auto px-4 pt-2 relative z-10">
        <WinnersTicker />
      </div>

      {/* Ad Reward Section */}
      <div className="max-w-2xl mx-auto px-4 pt-2 relative z-10">
        <AdRewardSection />
      </div>

      {/* Game Grid */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-[calc(8rem+env(safe-area-inset-bottom))] relative z-10">
        <div className="grid grid-cols-2 gap-3">
          {filteredGames.map(game => (
            <GameCard
              key={game.node_name}
              game={game}
              onPlay={() => handlePlay(game)}
              onClickSound={playClick}
              disabled={(game as any)._disabled}
              startingSoon={(game as any)._starting_soon}
              prizeCount={prizeCounts?.[game.node_name] ?? 0}
            />
          ))}
        </div>
      </div>

      <PixelMusicRadio />
    </div>
  );
}
