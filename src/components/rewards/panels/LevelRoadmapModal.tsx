import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Lock, Gift, Star, Crown, Trophy, Zap, Search, Ticket, Coins, Package, CreditCard, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useNumberFormat } from "@/lib/i18n/numberFormat";

interface LevelPrize {
  id: string;
  level_id: string;
  level_number?: number | null;
  title_ar: string;
  prize_type: string;
  prize_value?: number | null;
  image_url?: string | null;
  tickets_count?: number | null;
  coupon_code?: string | null;
  product_id?: string | null;
  is_random_product?: boolean | null;
  auto_grant?: boolean | null;
}

interface LevelRoadmapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: any[];
  levelPrizes: LevelPrize[];
  currentLevelIndex: number;
  totalXp: number;
  /** XP accumulated within the current level */
  currentLevelXp?: number;
  /** Current level number (1-based) from user_points */
  currentLevelNumber?: number;
  activeCardLevelId?: string;
}

const PRIZE_ICON: Record<string, any> = {
  points: Coins,
  coupon: Ticket,
  product: Package,
  card: CreditCard,
  tickets: Ticket,
  random_product: Sparkles,
  custom: Gift,
};

export default function LevelRoadmapModal({
  open,
  onOpenChange,
  levels,
  levelPrizes,
  currentLevelIndex,
  totalXp,
  currentLevelXp = 0,
  currentLevelNumber,
  activeCardLevelId,
}: LevelRoadmapModalProps) {
  const { t } = useLanguage();
  const { fmt } = useNumberFormat();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "prizes" | "current">("all");

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => (a.level_number ?? a.display_order) - (b.level_number ?? b.display_order)),
    [levels]
  );

  // Determine the active level number - prefer the one from user_points
  const activeLevelNumber = currentLevelNumber ?? (currentLevelIndex + 1);

  const filtered = useMemo(() => {
    return sortedLevels.filter((level) => {
      const ln = level.level_number ?? level.display_order;
      if (filter === "prizes" && ln % 5 !== 0) return false;
      if (filter === "current") {
        if (ln < activeLevelNumber - 2 || ln > activeLevelNumber + 5) return false;
      }
      if (search) {
        const q = search.trim();
        if (!q) return true;
        const numMatch = String(ln).includes(q);
        const nameMatch = (level.name_ar || "").includes(q) || (level.name_en || "").toLowerCase().includes(q.toLowerCase());
        return numMatch || nameMatch;
      }
      return true;
    });
  }, [sortedLevels, filter, search, activeLevelNumber]);

  const getLevelTierIcon = (n: number) => {
    if (n >= 76) return Crown;
    if (n >= 51) return Trophy;
    if (n >= 26) return Star;
    if (n >= 11) return Zap;
    return CheckCircle2;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {t('lr_title')}
          </DialogTitle>
          <div className="flex flex-col gap-2 pt-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم المستوى أو الاسم..."
                className="h-8 text-xs pr-9"
              />
            </div>
            <div className="flex gap-1.5 justify-center">
              <Button size="sm" variant={filter === "current" ? "default" : "outline"} className="h-7 text-[11px] px-2" onClick={() => setFilter("current")}>
                قريب من مستواي
              </Button>
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} className="h-7 text-[11px] px-2" onClick={() => setFilter("all")}>
                الكل ({sortedLevels.length})
              </Button>
              <Button size="sm" variant={filter === "prizes" ? "default" : "outline"} className="h-7 text-[11px] px-2" onClick={() => setFilter("prizes")}>
                <Gift className="h-3 w-3 ml-1" /> الجوائز
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh]">
          <div className="p-4 pt-4 pb-8">
            <div className="relative space-y-3">
              {filtered.map((level) => {
                const ln: number = level.level_number ?? level.display_order;
                const xpReq = Number(level.xp_required ?? level.min_points ?? 0);
                const isUnlocked = ln < activeLevelNumber;
                const isCurrent = ln === activeLevelNumber;
                const hasCard = activeCardLevelId === level.id;
                const prizes = levelPrizes.filter((p) => (p.level_number === ln) || p.level_id === level.id);
                const Icon = getLevelTierIcon(ln);
                const isMilestone = ln % 5 === 0;
                const progressPct = isCurrent && xpReq > 0 ? Math.min((currentLevelXp / xpReq) * 100, 100) : 0;

                return (
                  <div
                    key={level.id}
                    className={`relative rounded-xl border p-3 transition-all ${
                      isCurrent
                        ? 'bg-card shadow-lg ring-2'
                        : isUnlocked
                        ? 'bg-card/60 border-border/50'
                        : 'bg-muted/30 border-border/30'
                    }`}
                    style={{
                      ['--tw-ring-color' as any]: isCurrent ? level.color + '70' : undefined,
                      borderColor: isCurrent ? level.color + '60' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-base relative ${
                          isCurrent ? 'scale-110' : ''
                        }`}
                        style={{
                          backgroundColor: level.color + (isUnlocked || isCurrent ? '25' : '15'),
                          color: level.color,
                          border: `2px solid ${level.color}${isUnlocked || isCurrent ? '70' : '30'}`,
                          opacity: isUnlocked || isCurrent ? 1 : 0.55,
                        }}
                      >
                        {isUnlocked || isCurrent ? <span>{ln}</span> : <Lock className="h-4 w-4" />}
                        {isMilestone && (isUnlocked || isCurrent) && (
                          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow">
                            <Gift className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm" style={{ color: level.color }}>
                            {t('lr_level_n', { n: ln })}
                          </p>
                          <Icon className="h-3.5 w-3.5" style={{ color: level.color }} />
                          {isCurrent && (
                            <Badge className="text-[9px] px-1.5 text-white border-0" style={{ backgroundColor: level.color }}>
                              {t('lr_you_are_here')}
                            </Badge>
                          )}
                          {hasCard && (
                            <Badge className="text-[9px] bg-green-500/15 text-green-600 border-0 px-1.5">
                              <CheckCircle2 className="h-3 w-3 ml-0.5" />
                              {t('lr_owned')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {ln === 1 ? t('lr_base_level') : `يتطلب ${fmt(xpReq)} XP`}
                        </p>

                        {isCurrent && xpReq > 0 && (
                          <div className="mt-1.5">
                            <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                              <span>{fmt(currentLevelXp)} / {fmt(xpReq)} XP</span>
                              <span>{Math.round(progressPct)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${progressPct}%`, backgroundColor: level.color }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prizes preview */}
                    {prizes.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Gift className="h-3 w-3 text-amber-500" />
                          <span className="font-semibold">جوائز هذا المستوى ({prizes.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {prizes.map((p) => {
                            const PIcon = PRIZE_ICON[p.prize_type] || Gift;
                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              >
                                <PIcon className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{p.title_ar}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  لا توجد نتائج مطابقة
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
