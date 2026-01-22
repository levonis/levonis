import { useMemo } from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserPrintReputation } from "@/hooks/useUserPrintReputation";

function clampPercent(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export default function PrintReputationSummary({ userId }: { userId: string }) {
  const { data } = useUserPrintReputation(userId);

  const summary = useMemo(() => {
    if (!data) {
      return {
        avgStarsText: "0.0",
        ratingsCount: 0,
        customerReceive: 0,
        merchantCompletion: 0,
      };
    }

    return {
      avgStarsText: Number(data.avg_stars ?? 0).toFixed(1),
      ratingsCount: data.ratings_count ?? 0,
      customerReceive: clampPercent(data.customer_receive_rate_percent ?? 0),
      merchantCompletion: clampPercent(data.merchant_completion_percent ?? 0),
    };
  }, [data]);

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          التقييم في مجتمع الطباعة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            <span className="font-bold">{summary.avgStarsText}</span>
            <span className="text-muted-foreground">/ 5</span>
          </Badge>
          <span className="text-xs text-muted-foreground">
            ({summary.ratingsCount} تقييم)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">الزبون</p>
            <p className="text-sm font-semibold text-foreground">
              نسبة الاستلام: {summary.customerReceive}%
            </p>
            {data && (
              <p className="text-xs text-muted-foreground mt-1">
                طلبات مقدّمة: {data.customer_requests_made} • مستلمة: {data.customer_requests_received}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">التاجر</p>
            <p className="text-sm font-semibold text-foreground">
              نسبة الإكمال: {summary.merchantCompletion}%
            </p>
            {data && (
              <p className="text-xs text-muted-foreground mt-1">
                مكتملة: {data.merchant_completed_jobs} • مقبولة: {data.merchant_accepted_jobs}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
