import { useMemo } from "react";
import { Info, Star } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Metric = {
  key: string;
  label: string;
  percent: number | null;
  hint?: string;
  rightText?: string; // e.g. "(12/15)"
};

function clampPercent(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function formatCompactCount(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
}

export default function ReputationBar({
  title,
  overallStars,
  basisCount,
  basisLabel,
  metrics,
  className,
}: {
  title?: string;
  overallStars: number | null;
  basisCount: number | null;
  basisLabel?: string; // e.g. "تقييم" أو "طلب"
  metrics: Metric[];
  className?: string;
}) {
  const header = useMemo(() => {
    const stars = overallStars == null ? null : Math.max(0, Math.min(5, overallStars));
    const starsText = stars == null ? "—" : stars.toFixed(1);
    const countText = basisCount == null ? "—" : formatCompactCount(basisCount);
    const basis = basisLabel?.trim() || "تقييم";
    const basisText = basisCount == null ? "" : `بناءً على ${countText} ${basis}`;
    return { starsText, basisText };
  }, [overallStars, basisCount, basisLabel]);

  return (
    <Card className={cn("glass-effect border-border/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <div className="text-sm font-black text-foreground truncate">{title}</div>}
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 rounded-xl">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="font-black tabular-nums">{header.starsText}</span>
                <span className="text-muted-foreground">/ 5</span>
              </Badge>
              {header.basisText && <span className="text-[11px] text-muted-foreground">{header.basisText}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Star className="h-4 w-4 text-primary" />
            <span>سمعة مجتمع الطباعة</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-2">
          {metrics.map((m) => {
            const percent = m.percent == null ? null : clampPercent(m.percent);

            return (
              <div key={m.key} className="rounded-2xl border border-border bg-card/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">{m.label}</span>
                    {m.hint && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground hover:text-foreground"
                            aria-label={`معلومة: ${m.label}`}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                          {m.hint}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    </div>

                    {m.rightText && <div className="mt-0.5 text-[11px] text-muted-foreground">{m.rightText}</div>}
                  </div>

                  <div className="shrink-0 text-base font-black tabular-nums text-foreground">
                    {percent == null ? "—" : `${Math.round(percent)}%`}
                  </div>
                </div>

                <div className="mt-2">
                  <Progress value={percent ?? 0} className={cn("h-2", percent == null && "opacity-40")} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
