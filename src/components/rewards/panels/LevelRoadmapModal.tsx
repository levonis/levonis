import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Lock, Gift, Star, Crown, Trophy, CreditCard, Zap } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useNumberFormat } from "@/lib/i18n/numberFormat";

interface LevelPrize {
  id: string;
  level_id: string;
  title_ar: string;
  description_ar?: string | null;
  prize_type: string;
  prize_value?: number | null;
  image_url?: string | null;
}

interface LevelRoadmapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: any[];
  levelPrizes: LevelPrize[];
  currentLevelIndex: number;
  totalXp: number;
  activeCardLevelId?: string;
}

const getLevelIcon = (index: number) => {
  const icons = [Star, CreditCard, Crown, Trophy, Zap];
  const Icon = icons[index % icons.length];
  return Icon;
};

export default function LevelRoadmapModal({
  open,
  onOpenChange,
  levels,
  levelPrizes,
  currentLevelIndex,
  totalXp,
  activeCardLevelId,
}: LevelRoadmapModalProps) {
  const { t } = useLanguage();
  const { fmt } = useNumberFormat();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {t('lr_title')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[70vh]">
          <div className="p-4 pt-6 pb-8">
            {/* Zigzag Roadmap */}
            <div className="relative">
              {levels.map((level, index) => {
                const xpReq = (level as any).xp_required || 0;
                const isUnlocked = totalXp >= xpReq;
                const isCurrent = index === currentLevelIndex;
                const hasCard = activeCardLevelId === level.id;
                const prizes = levelPrizes.filter(p => p.level_id === level.id);
                const isEven = index % 2 === 0;
                const Icon = getLevelIcon(index);

                return (
                  <div key={level.id} className="relative">
                    {/* Connecting path line */}
                    {index < levels.length - 1 && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-8 z-0">
                        <div
                          className="w-full h-full rounded-full"
                          style={{
                            backgroundColor: isUnlocked ? level.color : 'hsl(var(--border))',
                            opacity: isUnlocked ? 0.6 : 0.3,
                          }}
                        />
                      </div>
                    )}

                    {/* Level Node */}
                    <div
                      className={`relative z-10 flex items-start gap-3 mb-8 ${
                        isEven ? 'flex-row' : 'flex-row-reverse'
                      }`}
                    >
                      {/* Circle Node */}
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center border-[3px] transition-all ${
                            isCurrent
                              ? 'scale-110 shadow-lg'
                              : isUnlocked
                              ? 'opacity-90'
                              : 'opacity-50'
                          }`}
                          style={{
                            borderColor: level.color,
                            backgroundColor: isUnlocked ? level.color + '20' : 'hsl(var(--muted))',
                            boxShadow: isCurrent ? `0 0 20px ${level.color}40` : undefined,
                          }}
                        >
                          {isUnlocked ? (
                            <Icon className="h-6 w-6" style={{ color: level.color }} />
                          ) : (
                            <Lock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        {isCurrent && (
                          <div
                            className="mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: level.color }}
                          >
                            {t('lr_you_are_here')}
                          </div>
                        )}
                      </div>

                      {/* Level Info Card */}
                      <div
                        className={`flex-1 p-3 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-card shadow-md'
                            : isUnlocked
                            ? 'bg-card/60 border-border/50'
                            : 'bg-muted/30 border-border/30'
                        }`}
                        style={{
                          borderColor: isCurrent ? level.color + '50' : undefined,
                        }}
                      >
                        {/* Level Header */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-base shadow-sm"
                              style={{
                                backgroundColor: level.color + '20',
                                color: level.color,
                                border: `2px solid ${level.color}60`,
                              }}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-bold text-sm" style={{ color: level.color }}>
                                {t('lr_level_n', { n: index + 1 })}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {xpReq > 0 ? fmt(`${xpReq)} XP` : t('lr_base_level')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {hasCard && (
                              <Badge className="text-[9px] bg-green-500/15 text-green-600 border-0 px-1.5">
                                <CheckCircle2 className="h-3 w-3 ml-0.5" />
                                {t('lr_owned')}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Prizes section temporarily hidden — to be re-added later */}

                        {/* XP Progress for locked */}
                        {!isUnlocked && xpReq > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                              <span>{fmt(totalXp)}} XP</span>
                              <span>{fmt(xpReq)}} XP</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min((totalXp / xpReq) * 100, 100)}%`,
                                  backgroundColor: level.color,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
