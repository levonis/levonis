import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import QualityReportPanel from "./QualityReportPanel";
import MaterialPicker from "./MaterialPicker";
import type { ModelMetrics, QualityReport } from "@/lib/modelAnalysis/types";

export interface QuoteResult {
  source: "scrape" | "ai" | "cached" | "file" | "geometry";
  sourceUrl?: string;
  sourceFileName?: string;
  model: {
    name: string;
    thumbnail: string | null;
    description: string | null;
    weight_g: number | null;
    print_minutes: number | null;
    dimensions_mm: { x: number; y: number; z: number } | null;
    recommended_printer: string | null;
    difficulty: "easy" | "medium" | "hard" | null;
  };
  breakdown: {
    filament_cost: number;
    machine_cost: number;
    complexity_fee: number;
    platform_fee: number;
    profit_margin: number;
    subtotal: number;
    final: number;
    price_min: number;
    price_max: number;
    inputs: { weight_g: number; print_minutes: number; difficulty: string };
  };
  // Only present for geometry-based quotes:
  metrics?: ModelMetrics;
  quality?: QualityReport;
  material?: { code: string; name_en: string; name_ar: string };
}

interface Props {
  result: QuoteResult;
  onCreate: () => void;
  creating: boolean;
  onUseFile: () => void;
  onMaterialChange?: (code: string) => void;
  materialChanging?: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function QuoteResultCard({ result, onCreate, creating, onUseFile, onMaterialChange, materialChanging }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showQuality, setShowQuality] = useState(true);

  const m = result.model;
  const b = result.breakdown;
  const minutes = m.print_minutes ?? b.inputs.print_minutes;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hasGeometry = !!result.metrics && !!result.quality;

  const difficultyColor =
    m.difficulty === "hard"
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : m.difficulty === "easy"
        ? "bg-green-500/15 text-green-600 dark:text-green-400"
        : "bg-amber-500/15 text-amber-600 dark:text-amber-400";

  const sourceLabel =
    result.source === "cached" ? t("نتيجة محفوظة", "Cached")
    : result.source === "ai" ? t("تقدير ذكي", "AI estimate")
    : result.source === "geometry" ? t("تحليل دقيق", "Geometry analysis")
    : result.source === "file" ? t("من الملف", "From file")
    : t("من الرابط", "From link");

  return (
    <Card className="glass-panel overflow-hidden">
      <div className="aspect-video w-full bg-muted relative">
        {m.thumbnail ? (
          <img src={m.thumbnail} alt={m.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Sparkles className="h-10 w-10" />
          </div>
        )}
        <Badge className="absolute top-2 end-2" variant="secondary">{sourceLabel}</Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg leading-tight">{m.name}</h3>
          {result.sourceUrl && (
            <a href={result.sourceUrl} target="_blank" rel="noreferrer"
              className="text-xs text-primary inline-flex items-center gap-1 mt-0.5">
              {t("الرابط الأصلي", "Original link")} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {hasGeometry && onMaterialChange && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <MaterialPicker value={result.material?.code ?? "pla"} onChange={onMaterialChange} />
            </div>
            {materialChanging && <Loader2 className="h-4 w-4 animate-spin mb-2" />}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t("الوزن", "Weight")} value={`${b.inputs.weight_g}g`} />
          <Stat label={t("الوقت", "Time")} value={`${hours}h ${mins}m`} />
          <div className="rounded-lg p-2 border border-border/40 bg-card/40">
            <div className="text-[10px] text-muted-foreground mb-1">{t("الصعوبة", "Difficulty")}</div>
            <Badge className={`${difficultyColor} border-0`}>
              {m.difficulty === "easy" ? t("سهل", "Easy") : m.difficulty === "hard" ? t("صعب", "Hard") : t("متوسط", "Medium")}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-4">
          <div className="text-xs text-muted-foreground mb-1">{t("نطاق السعر المقدّر", "Estimated price range")}</div>
          <div className="text-2xl font-bold text-primary">
            {fmt(b.price_min)} – {fmt(b.price_max)} <span className="text-sm font-normal">IQD</span>
          </div>
        </div>

        {hasGeometry && (
          <>
            <button onClick={() => setShowQuality((s) => !s)}
              className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition">
              <span className="font-medium">{t("تقرير جودة النموذج", "Model quality report")}</span>
              {showQuality ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showQuality && <QualityReportPanel metrics={result.metrics!} quality={result.quality!} />}
          </>
        )}

        <button onClick={() => setShowBreakdown((s) => !s)}
          className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition">
          <span className="font-medium">{t("شفافية السعر", "Price transparency")}</span>
          {showBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showBreakdown && (
          <div className="space-y-1.5 text-sm bg-muted/20 rounded-lg p-3 border border-border/40">
            <Row label={t("تكلفة الفلامنت", "Filament cost")} value={b.filament_cost} />
            <Row label={t("وقت الماكنة", "Machine time")} value={b.machine_cost} />
            <Row label={t("رسوم التعقيد", "Complexity fee")} value={b.complexity_fee} />
            <Row label={t("رسوم المنصة", "Platform fee")} value={b.platform_fee} />
            <Row label={t("هامش الربح", "Profit margin")} value={b.profit_margin} />
            <div className="border-t border-border/40 pt-1.5 mt-1.5">
              <Row label={t("الإجمالي", "Total")} value={b.final} bold />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={onCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("إنشاء طلب طباعة", "Create Print Request")}
          </Button>
          {!result.sourceFileName && (
            <Button variant="outline" onClick={onUseFile} title={t("استخدام ملف", "Use file")}>
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2 border border-border/40 bg-card/40">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{fmt(value)} IQD</span>
    </div>
  );
}
