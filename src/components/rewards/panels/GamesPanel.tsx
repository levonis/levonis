import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Lock, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function GamesPanel() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Gamepad2 className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-lg">{t('games_section_title')}</h3>
      </div>

      {/* Available Game - Rock Paper Scissors */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden relative group hover:border-primary/50 transition-all cursor-pointer"
            onClick={() => navigate('/games')}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform duration-300">
              ✊
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-base">{t('games_rps_title')}</h4>
                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                  Live
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('games_rps_desc')}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> +10 / -5
                </span>
              </div>
            </div>
          </div>
          <Button className="w-full mt-4 bg-gradient-to-r from-primary to-accent text-primary-foreground" size="sm">
            {t('games_play_now')}
          </Button>
        </CardContent>
      </Card>

      {/* Coming Soon Game */}
      <Card className="border-border/50 bg-muted/30 overflow-hidden opacity-60">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center text-3xl shrink-0">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-base text-muted-foreground">{t('games_coming_soon')}</h4>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                  {t('games_coming_soon')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground/70">{t('games_coming_soon_desc')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
