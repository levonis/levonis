import { useEffect, useState } from "react";
import { Timer, Calendar, Trophy } from "lucide-react";

interface SeasonHeaderProps {
  seasonName?: string | null;
  seasonStartsAt?: string | null;
  seasonEndsAt?: string | null;
}

export default function SeasonHeader({ seasonName, seasonStartsAt, seasonEndsAt }: SeasonHeaderProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!seasonEndsAt) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [seasonEndsAt]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ar-IQ", { year: "numeric", month: "short", day: "numeric" });
    } catch { return ""; }
  };

  let countdown: string | null = null;
  let ended = false;
  if (seasonEndsAt) {
    const diff = new Date(seasonEndsAt).getTime() - now;
    if (diff <= 0) ended = true;
    else {
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countdown = `${d > 0 ? `${d}ي ` : ""}${h}س ${m}د ${s}ث`;
    }
  }

  const noActiveSeason = !seasonEndsAt && !seasonStartsAt;

  if (!seasonName && noActiveSeason) {
    return (
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-3 text-center">
        <Trophy className="h-5 w-5 text-primary mx-auto mb-1" />
        <div className="text-sm font-bold text-primary">الموسم القادم يبدأ قريباً 🏆</div>
        <div className="text-[10px] text-muted-foreground mt-1">تم تتويج الفائزين — ترقّب انطلاق الموسم الجديد</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-3 space-y-2 font-mono">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">{seasonName || "الموسم الحالي"}</span>
        </div>
        {seasonStartsAt && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>بدأ: {formatDate(seasonStartsAt)}</span>
          </div>
        )}
      </div>
      {seasonEndsAt ? (
        <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Timer className="h-3 w-3 text-primary" />
            <span>{ended ? "انتهى الموسم" : "ينتهي خلال:"}</span>
          </div>
          {!ended && countdown && (
            <span className="text-xs font-bold text-primary">{countdown}</span>
          )}
          {ended && <span className="text-xs font-bold text-primary">جاري التوزيع...</span>}
        </div>
      ) : (
        <div className="text-[11px] text-primary font-bold text-center bg-background/50 rounded-md px-2 py-1.5">
          الموسم القادم يبدأ قريباً 🏆
        </div>
      )}
      {seasonEndsAt && (
        <div className="text-[9px] text-muted-foreground text-center">
          ينتهي: {formatDate(seasonEndsAt)}
        </div>
      )}
    </div>
  );
}
