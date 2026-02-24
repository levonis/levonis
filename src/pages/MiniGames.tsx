import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/i18n";
import { ArrowRight, Gamepad2, Lock, Sparkles, Coins, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import RockPaperScissorsGame from "@/components/games/RockPaperScissorsGame";

export default function MiniGames() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const { data: userPoints } = useQuery({
    queryKey: ['user-points-full', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_points')
        .select('available_points')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  if (activeGame === 'rps') {
    return <RockPaperScissorsGame onBack={() => setActiveGame(null)} />;
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white" dir="rtl">
      {/* Pixel art background pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px),
                            repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px)`,
        }}
      />

      {/* Header */}
      <div className="relative z-10">
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/rewards?tab=points&sub=games')}
              className="text-white/70 hover:text-white hover:bg-white/10 gap-1"
            >
              <ArrowRight className="h-4 w-4" />
              {t('games_back')}
            </Button>

            {/* Points display */}
            {user && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-xl px-3 py-1.5">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300 font-bold text-sm font-mono">
                  {(userPoints?.available_points || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl px-5 py-2 mb-3">
              <Gamepad2 className="h-5 w-5 text-purple-400" />
              <span className="text-purple-300 font-bold text-sm tracking-wider uppercase" style={{ fontFamily: "'Courier New', monospace" }}>
                Mini Games
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: "'Courier New', monospace", textShadow: '2px 2px 0 #6b21a8' }}>
              {t('games_section_title')}
            </h1>
            <p className="text-white/40 text-sm">العب واربح نقاط!</p>
          </div>
        </div>

        {/* Games Grid */}
        <div className="px-4 space-y-4 pb-8">
          {/* Rock Paper Scissors Card */}
          <button
            onClick={() => setActiveGame('rps')}
            className="w-full text-right"
          >
            <div className="relative bg-gradient-to-br from-[#16213e] to-[#0f3460] border-2 border-cyan-500/30 rounded-2xl p-5 overflow-hidden group hover:border-cyan-400/60 transition-all duration-300 active:scale-[0.98]">
              {/* Decorative pixels */}
              <div className="absolute top-2 left-2 w-2 h-2 bg-cyan-400/40 rounded-sm" />
              <div className="absolute top-2 left-6 w-2 h-2 bg-cyan-400/20 rounded-sm" />
              <div className="absolute bottom-2 right-2 w-2 h-2 bg-cyan-400/40 rounded-sm" />
              <div className="absolute bottom-2 right-6 w-2 h-2 bg-cyan-400/20 rounded-sm" />

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform duration-300 group-hover:rotate-6">
                  ✊
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base text-white" style={{ fontFamily: "'Courier New', monospace" }}>
                      {t('games_rps_title')}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-widest border border-green-500/30"
                      style={{ fontFamily: "'Courier New', monospace" }}>
                      LIVE
                    </span>
                  </div>
                  <p className="text-sm text-white/50 mb-3">{t('games_rps_desc')}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> +10
                    </span>
                    <span className="text-xs text-red-400 font-mono flex items-center gap-1">
                      💔 -5
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl py-2.5 text-center">
                <span className="text-cyan-300 font-bold text-sm tracking-wider" style={{ fontFamily: "'Courier New', monospace" }}>
                  ▶ {t('games_play_now')}
                </span>
              </div>
            </div>
          </button>

          {/* Coming Soon Card */}
          <div className="relative bg-[#16213e]/50 border-2 border-white/10 rounded-2xl p-5 overflow-hidden opacity-50">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)]" />
            <div className="relative flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Lock className="h-6 w-6 text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-base text-white/40" style={{ fontFamily: "'Courier New', monospace" }}>
                    ???
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 text-white/30 text-[10px] font-bold uppercase tracking-widest border border-white/10"
                    style={{ fontFamily: "'Courier New', monospace" }}>
                    {t('games_coming_soon')}
                  </span>
                </div>
                <p className="text-sm text-white/25">{t('games_coming_soon_desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
