import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Coins, Filter, Lock, Trophy, Zap, Users, Gamepad2, Flame, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import PixelBackground from "@/components/games/PixelBackground";
import PixelLoadingScreen from "@/components/games/PixelLoadingScreen";
import PixelMusicRadio from "@/components/games/PixelMusicRadio";
import { useGameSounds } from "@/components/games/useGameSounds";

const RockPaperScissorsGame = lazy(() => import("@/components/games/RockPaperScissorsGame"));

type FilterType = 'all' | 'popular' | 'new' | 'strategy' | 'luck';
type GameStatus = 'live' | 'coming_soon';

interface GameInfo {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: GameStatus;
  category: FilterType;
  reward: string;
  players: string;
  difficulty: 'easy' | 'medium' | 'hard';
  popular?: boolean;
  isNew?: boolean;
}

const GAMES: GameInfo[] = [
  { id: 'rps', title: 'حجرة ورقة مقص', description: 'تحدى الكمبيوتر في 3 جولات واربح حتى 30 نقطة!', icon: '✊', status: 'live', category: 'luck', reward: '+10 / -5', players: '1 لاعب', difficulty: 'easy', popular: true, isNew: true },
  { id: 'quiz', title: 'تحدي المعرفة', description: 'أجب على أسئلة متنوعة واختبر معلوماتك العامة.', icon: '🧠', status: 'coming_soon', category: 'strategy', reward: '+15 / -3', players: '1 لاعب', difficulty: 'medium' },
  { id: 'spin', title: 'عجلة الحظ', description: 'أدر العجلة واحصل على جوائز عشوائية ومفاجآت!', icon: '🎰', status: 'coming_soon', category: 'luck', reward: '0 ~ +50', players: '1 لاعب', difficulty: 'easy' },
  { id: 'memory', title: 'لعبة الذاكرة', description: 'اكتشف الأزواج المتطابقة قبل نفاد الوقت.', icon: '🃏', status: 'coming_soon', category: 'strategy', reward: '+20', players: '1 لاعب', difficulty: 'medium' },
  { id: 'dice', title: 'رمي النرد', description: 'ارمِ النرد وتوقع النتيجة لكسب نقاط إضافية.', icon: '🎲', status: 'coming_soon', category: 'luck', reward: '+5 ~ +25', players: '1 لاعب', difficulty: 'easy' },
  { id: 'puzzle', title: 'ألغاز يومية', description: 'حل لغز جديد كل يوم واحصل على مكافآت حصرية.', icon: '🧩', status: 'coming_soon', category: 'strategy', reward: '+30', players: '1 لاعب', difficulty: 'hard' },
];

const FILTERS: { id: FilterType; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'الكل', icon: <Filter className="h-3.5 w-3.5" /> },
  { id: 'popular', label: 'الأكثر لعباً', icon: <Flame className="h-3.5 w-3.5" /> },
  { id: 'new', label: 'جديد', icon: <Clock className="h-3.5 w-3.5" /> },
  { id: 'strategy', label: 'استراتيجية', icon: <Star className="h-3.5 w-3.5" /> },
  { id: 'luck', label: 'حظ', icon: <Zap className="h-3.5 w-3.5" /> },
];

/* ── Pixel UI helper: stepped box-shadow border (like the asset pack) ── */
const pixelBorder = (color: string) =>
  `2px 0 0 ${color}, -2px 0 0 ${color}, 0 2px 0 ${color}, 0 -2px 0 ${color}`;

const pixelBorderOuter = (color: string, shadow: string) =>
  `${pixelBorder(color)}, 4px 4px 0 ${shadow}`;

/* ── Pixel Health Bar (inspired by BDragon1727 asset) ── */
function PixelHealthBar({ value, max, color = "primary" }: { value: number; max: number; color?: string }) {
  const segments = 10;
  const filled = Math.round((value / max) * segments);
  const colors: Record<string, { fill: string; bg: string; glow: string }> = {
    primary: { fill: "hsl(var(--primary))", bg: "hsl(var(--card))", glow: "hsl(var(--primary) / 0.4)" },
    green: { fill: "hsl(142 70% 45%)", bg: "hsl(var(--card))", glow: "hsl(142 70% 45% / 0.3)" },
    red: { fill: "hsl(0 70% 50%)", bg: "hsl(var(--card))", glow: "hsl(0 70% 50% / 0.3)" },
  };
  const c = colors[color] || colors.primary;
  return (
    <div className="pixel-frame-inset p-[3px]">
      <div className="flex gap-[1px] h-3">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="flex-1 transition-all duration-150"
            style={{
              background: i < filled ? c.fill : c.bg,
              boxShadow: i < filled ? `inset 0 -2px 0 ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.15)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DifficultyBadge({ level }: { level: 'easy' | 'medium' | 'hard' }) {
  const config = {
    easy: { label: 'سهل', segments: 3, filled: 1, color: "hsl(142 70% 45%)" },
    medium: { label: 'متوسط', segments: 3, filled: 2, color: "hsl(45 90% 50%)" },
    hard: { label: 'صعب', segments: 3, filled: 3, color: "hsl(0 70% 50%)" },
  };
  const c = config[level];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono font-bold text-muted-foreground">{c.label}</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: c.segments }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2"
            style={{
              background: i < c.filled ? c.color : "hsl(var(--card))",
              boxShadow: i < c.filled ? `inset 0 -1px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)` : pixelBorder("hsl(var(--border) / 0.3)"),
            }}
          />
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, onPlay, onClickSound }: { game: GameInfo; onPlay: () => void; onClickSound: () => void }) {
  const isLive = game.status === 'live';
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
        {game.isNew && isLive && (
          <span className="pixel-badge-new text-[9px] font-mono font-bold px-2 py-0.5">★ جديد</span>
        )}
        <DifficultyBadge level={game.difficulty} />
      </div>

      {/* Icon - pixel frame */}
      <div className={cn(
        "w-14 h-14 flex items-center justify-center text-3xl mb-3 transition-transform duration-300",
        isLive ? "pixel-frame-inset group-hover:scale-110 group-hover:rotate-2" : "pixel-frame-inset opacity-40"
      )}>
        {isLive ? game.icon : <Lock className="h-6 w-6 text-muted-foreground/50" />}
      </div>

      <h3 className={cn("font-bold text-sm mb-1 line-clamp-1 font-mono", isLive ? "text-foreground" : "text-muted-foreground")}>{game.title}</h3>
      <p className={cn("text-[11px] leading-relaxed mb-3 line-clamp-2", isLive ? "text-muted-foreground" : "text-muted-foreground/50")}>{game.description}</p>

      {/* Reward bar - pixel health bar style */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-primary font-bold font-mono">
          <Trophy className="h-3 w-3" /> {game.reward}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <Users className="h-3 w-3" /> {game.players}
        </span>
      </div>

      {/* Play button - pixel style */}
      {isLive && (
        <div className="mt-2 pixel-btn-play py-1.5 text-center group-hover:brightness-110 transition-all">
          <span className="text-xs font-bold font-mono tracking-wider">▶ PLAY</span>
        </div>
      )}
    </button>
  );
}

export default function MiniGames() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
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

  const filteredGames = useMemo(() => {
    if (filter === 'all') return GAMES;
    if (filter === 'popular') return GAMES.filter(g => g.popular);
    if (filter === 'new') return GAMES.filter(g => g.isNew);
    return GAMES.filter(g => g.category === filter);
  }, [filter]);

  const handleLoadComplete = useCallback(() => setLoading(false), []);

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

      {/* Header - pixel bar style */}
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

          {/* Points display - pixel health bar style */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="pixel-frame-inset px-3 py-1.5 flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-primary font-bold text-sm font-mono">{(userPoints?.available_points || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8 relative z-10">
        {/* Hero */}
        <div className="text-center py-8">
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
        </div>

        {/* Filters - pixel button bar */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { playClick(); setFilter(f.id); }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all shrink-0 font-mono",
                filter === f.id ? "pixel-btn-active" : "pixel-btn"
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredGames.map((game, i) => (
            <div key={game.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <GameCard game={game} onPlay={() => game.status === 'live' && setActiveGame(game.id)} onClickSound={playClick} />
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
