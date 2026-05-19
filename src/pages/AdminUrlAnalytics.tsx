import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { Loader2, Link2, TrendingUp, Database, Clock } from "lucide-react";

export default function AdminUrlAnalytics() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const [days, setDays] = useState("30");
  const [platform, setPlatform] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["url-analytics-summary", days, platform],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_url_analytics_summary" as any, {
        _days: Number(days),
        _platform: platform === "all" ? null : platform,
      });
      if (error) throw error;
      return data as any;
    },
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6 text-primary" />
          {t("تحليلات استخراج الروابط", "URL Extraction Analytics")}
        </h1>
        <div className="flex gap-2">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("كل المنصات", "All platforms")}</SelectItem>
              <SelectItem value="makerworld">MakerWorld</SelectItem>
              <SelectItem value="printables">Printables</SelectItem>
              <SelectItem value="thingiverse">Thingiverse</SelectItem>
              <SelectItem value="cults3d">Cults3D</SelectItem>
              <SelectItem value="other">{t("أخرى", "Other")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("7 أيام", "7 days")}</SelectItem>
              <SelectItem value="30">{t("30 يوم", "30 days")}</SelectItem>
              <SelectItem value="90">{t("90 يوم", "90 days")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label={t("إجمالي التحليلات", "Total analyses")} value={data?.total ?? 0} />
            <Kpi icon={<Database className="h-4 w-4" />} label={t("نسبة الكاش", "Cache hit rate")} value={`${data?.cache_hit_rate ?? 0}%`} />
            <Kpi icon={<Clock className="h-4 w-4" />} label={t("متوسط المدة", "Avg duration")} value={`${data?.avg_duration_ms ?? 0} ms`} />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label={t("نسبة التحويل", "Conversion rate")} value={`${data?.conversion_rate ?? 0}%`} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">{t("توزيع المنصات", "Platform distribution")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(data?.by_platform ?? []).map((p: any) => (
                  <Row key={p.platform} label={p.platform} value={p.count} total={data?.total ?? 1} />
                ))}
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">{t("مستوى الثقة", "Confidence breakdown")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(data?.by_confidence ?? []).map((c: any) => (
                  <Row key={c.confidence} label={c.confidence} value={c.count} total={data?.total ?? 1} />
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-panel">
            <CardHeader><CardTitle className="text-base">{t("أكثر النماذج تحليلاً", "Most analyzed models")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data?.top_models ?? []).slice(0, 15).map((m: any) => (
                  <div key={m.url_hash} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 pb-2">
                    <a href={m.source_url} target="_blank" rel="noreferrer" className="truncate flex-1 text-primary hover:underline" dir="ltr">
                      {m.source_url}
                    </a>
                    <Badge variant="secondary">{m.platform || "other"}</Badge>
                    <span className="font-medium tabular-nums">{m.count}</span>
                  </div>
                ))}
                {(!data?.top_models || data.top_models.length === 0) && (
                  <div className="text-muted-foreground text-sm text-center py-6">{t("لا توجد بيانات بعد", "No data yet")}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="glass-panel">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="capitalize">{label}</span>
        <span className="text-muted-foreground">{value} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
