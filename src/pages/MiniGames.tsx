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

function DifficultyBadge({ level }: { level: 'easy' | 'medium' | 'hard' }) {
  const config = {
    easy: { label: 'سهل', cls: 'bg-green-500/15 text-green-400 border-green-500/20' },
    medium: { label: 'متوسط', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    hard: { label: 'صعب', cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
  };
  const c = config[level];
  return <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", c.cls)}>{c.label}</span>;
}

function GameCard({ game, onPlay, onClickSound }: { game: GameInfo; onPlay: () => void; onClickSound: () => void }) {
  const isLive = game.status === 'live';
  return (
    <button
      onClick={() => { onClickSound(); onPlay(); }}
      disabled={!isLive}
      className={cn(
        "group text-right border-2 p-4 transition-all duration-300 relative overflow-hidden w-full",
        isLive
          ? "bg-card border-primary/20 hover:border-primary/50 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.15)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          : "bg-card/50 border-border/30 opacity-50 cursor-not-allowed"
      )}
      style={{ imageRendering: "auto" }}
    >
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {isLive && <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-[10px] font-bold border border-green-500/20 uppercase tracking-wider">Live</span>}
        {!isLive && <span className="px-2 py-0.5 bg-muted/30 text-muted-foreground text-[10px] font-bold border border-border uppercase tracking-wider">قريباً</span>}
        {game.isNew && isLive && <span className="px-2 py-0.5 bg-primary/15 text-primary text-[10px] font-bold border border-primary/20">جديد</span>}
        <DifficultyBadge level={game.difficulty} />
      </div>
      <div className={cn(
        "w-14 h-14 flex items-center justify-center text-3xl mb-3 border transition-transform duration-300",
        isLive ? "bg-primary/10 border-primary/20 group-hover:scale-110 group-hover:rotate-3" : "bg-muted/20 border-border/50"
      )}>
        {isLive ? game.icon : <Lock className="h-6 w-6 text-muted-foreground/50" />}
      </div>
      <h3 className={cn("font-bold text-sm mb-1 line-clamp-1", isLive ? "text-foreground" : "text-muted-foreground")}>{game.title}</h3>
      <p className={cn("text-[11px] leading-relaxed mb-3 line-clamp-2", isLive ? "text-muted-foreground" : "text-muted-foreground/50")}>{game.description}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-primary font-bold"><Trophy className="h-3 w-3" /> {game.reward}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users className="h-3 w-3" /> {game.players}</span>
      </div>
      {isLive && (
        <div className="mt-3 bg-primary/10 border border-primary/20 py-2 text-center group-hover:bg-primary/20 transition-colors">
          <span className="text-primary font-bold text-xs font-mono">▶ PLAY</span>
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

  if (loading) return <PixelLoadingScreen onComplete={handleLoadComplete} />;

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
      <PixelBackground />
      <PixelMusicRadio />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { playClick(); navigate('/rewards?tab=points&sub=games'); }}
            className="gap-1 text-muted-foreground hover:text-foreground font-mono"
          >
            <ArrowRight className="h-4 w-4" />
            BACK
          </Button>
          {user && (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5"
              style={{ boxShadow: "2px 2px 0 hsl(var(--accent) / 0.2)" }}>
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-primary font-bold text-sm font-mono">{(userPoints?.available_points || 0).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8 relative z-10">
        {/* Hero */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 border-2 border-primary/20 px-5 py-2 mb-4"
            style={{ boxShadow: "3px 3px 0 hsl(var(--accent) / 0.3)", imageRendering: "pixelated" }}>
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

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { playClick(); setFilter(f.id); }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap border transition-all shrink-0 font-mono",
                filter === f.id
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
              )}
              style={{ imageRendering: "auto" }}
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
