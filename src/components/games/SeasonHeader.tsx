import { useEffect, useState } from "react";
import { Timer, Calendar, Trophy, Hourglass } from "lucide-react";

interface SeasonHeaderProps {
  seasonName?: string | null;
  seasonStartsAt?: string | null;
  seasonEndsAt?: string | null;
}

const formatCountdown = (ms: number) => {
  if (ms <= 0) return "";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d > 0 ? `${d}ي ` : ""}${h}س ${m}د ${s}ث`;
};

export default function SeasonHeader({ seasonName, seasonStartsAt, seasonEndsAt }: SeasonHeaderProps) {
  const [now, setNow] = useState(Date.now());

  // Tick every second whenever there's an upcoming start OR an active end.
  useEffect(() => {
    if (!seasonEndsAt && !seasonStartsAt) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [seasonEndsAt, seasonStartsAt]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ar-IQ", { year: "numeric", month: "short", day: "numeric" });
    } catch { return ""; }
  };

  // ----- Active season countdown (to end) -----
  let endCountdown: string | null = null;
  let ended = false;
  if (seasonEndsAt) {
    const diff = new Date(seasonEndsAt).getTime() - now;
    if (diff <= 0) ended = true;
    else endCountdown = formatCountdown(diff);
  }

  // ----- Upcoming season countdown (to start) -----
  const startMs = seasonStartsAt ? new Date(seasonStartsAt).getTime() : 0;
  const isUpcoming = !!seasonStartsAt && startMs > now;
  const startCountdown = isUpcoming ? formatCountdown(startMs - now) : null;

  const noActiveSeason = !seasonEndsAt && !seasonStartsAt;

  // No season at all → show the friendly "coming soon" card
  if (!seasonName && noActiveSeason) {
    return (
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-3 text-center">
        <Trophy className="h-5 w-5 text-primary mx-auto mb-1" />
        <div className="text-sm font-bold text-primary">الموسم القادم يبدأ قريباً 🏆</div>
        <div className="text-[10px] text-muted-foreground mt-1">تم تتويج الفائزين — ترقّب انطلاق الموسم الجديد</div>
      </div>
    );
  }

  // Upcoming season scheduled → show live countdown to start
  if (isUpcoming && !seasonEndsAt) {
    return (
      <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 rounded-lg p-3 space-y-2 font-mono text-center">
        <div className="flex items-center justify-center gap-2">
          <Hourglass className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-bold text-primary">
            {seasonName || "الموسم القادم"} يبدأ خلال
          </span>
        </div>
        <div className="text-base font-black text-primary tabular-nums bg-background/60 rounded-md py-1.5">
          {startCountdown}
        </div>
        <div className="text-[10px] text-muted-foreground">
          ينطلق: {formatDate(seasonStartsAt!)}
        </div>
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
        {seasonStartsAt && !isUpcoming && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>بدأ: {formatDate(seasonStartsAt)}</span>
          </div>
        )}
      </div>

      {/* Upcoming start (when an end is also scheduled) */}
      {isUpcoming && (
        <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Hourglass className="h-3 w-3 text-primary animate-pulse" />
            <span>يبدأ خلال:</span>
          </div>
          <span className="text-xs font-bold text-primary tabular-nums">{startCountdown}</span>
        </div>
      )}

      {seasonEndsAt ? (
        <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Timer className="h-3 w-3 text-primary" />
            <span>{ended ? "انتهى الموسم" : "ينتهي خلال:"}</span>
          </div>
          {!ended && endCountdown && (
            <span className="text-xs font-bold text-primary tabular-nums">{endCountdown}</span>
          )}
          {ended && <span className="text-xs font-bold text-primary">جاري التوزيع...</span>}
        </div>
      ) : (
        !isUpcoming && (
          <div className="text-[11px] text-primary font-bold text-center bg-background/50 rounded-md px-2 py-1.5">
            الموسم القادم يبدأ قريباً 🏆
          </div>
        )
      )}

      {seasonEndsAt && (
        <div className="text-[9px] text-muted-foreground text-center">
          ينتهي: {formatDate(seasonEndsAt)}
        </div>
      )}
    </div>
  );
}
