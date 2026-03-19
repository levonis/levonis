import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Lock, Sparkles, Trophy, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const PREVIEW_GAMES = [
  { id: 'rps', title: 'حجرة ورقة مقص', icon: '✊', reward: '+10', live: false },
  { id: 'quiz', title: 'تحدي المعرفة', icon: '🧠', reward: '+15', live: false },
  { id: 'spin', title: 'عجلة الحظ', icon: '🎰', reward: '+50', live: false },
];

export default function GamesPanel() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Temporarily hidden for non-admin users
  if (!isAdmin) {
    return (
      <div className="space-y-4 opacity-60">
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-bold text-lg text-muted-foreground">{t('games_section_title')}</h3>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/50 p-6 text-center">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">قسم الألعاب قيد الصيانة</p>
          <p className="text-xs text-muted-foreground/70 mt-1">سيعود قريباً</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-lg">{t('games_section_title')}</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/games')}
          className="text-primary text-xs gap-1"
        >
          عرض الكل
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Quick preview cards */}
      <div className="grid grid-cols-3 gap-2">
        {PREVIEW_GAMES.map(game => (
          <button
            key={game.id}
            onClick={() => game.live && navigate('/games')}
            disabled={!game.live}
            className={cn(
              "rounded-xl border p-3 text-center transition-all",
              game.live
                ? "bg-card border-primary/20 hover:border-primary/40 hover:scale-[1.03] active:scale-95 cursor-pointer"
                : "bg-card/50 border-border/30 opacity-40 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "text-2xl mb-2 transition-transform",
              game.live && "group-hover:scale-110"
            )}>
              {game.live ? game.icon : <Lock className="h-5 w-5 mx-auto text-muted-foreground/50" />}
            </div>
            <p className="text-[11px] font-bold text-foreground line-clamp-1 mb-1">{game.title}</p>
            <span className="text-[10px] text-primary font-bold flex items-center justify-center gap-0.5">
              <Trophy className="h-2.5 w-2.5" /> {game.reward}
            </span>
          </button>
        ))}
      </div>

      {/* CTA */}
      <Button
        onClick={() => navigate('/games')}
        className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
        variant="ghost"
      >
        <Gamepad2 className="h-4 w-4 ml-2" />
        فتح صفحة الألعاب
      </Button>
    </div>
  );
}
