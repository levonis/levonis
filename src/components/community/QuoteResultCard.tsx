import { useState, useRef } from "react";
import { ChevronDown, ChevronUp, ExternalLink, FileDown, Loader2, Sparkles, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QualityReportPanel from "./QualityReportPanel";
import MaterialPicker from "./MaterialPicker";
import type { ModelMetrics, QualityReport } from "@/lib/modelAnalysis/types";

export interface BreakdownComponent { key: string; label_ar: string; label_en: string; value: number }
export interface RushOption { tier: "standard" | "fast" | "rush"; mult: number; days: number; preview_iqd: number }

export interface QuoteResult {
  source: "scrape" | "ai" | "cached" | "file" | "geometry";
  sourceUrl?: string;
  sourceFileName?: string;
  url_hash?: string;
  cacheHit?: boolean;
  unified?: {
    sourcePlatform?: string;
    creator?: { name: string | null; url: string | null };
    tags?: string[];
    stats?: { downloads: number; likes: number; prints: number };
    printProfiles?: Array<{ name: string; filament_g?: number | null; print_minutes?: number | null }>;
    confidenceLevel?: "high" | "medium" | "low";
    complexityScore?: number;
  };
  model: {
    name: string;
    thumbnail: string | null;
    description: string | null;
    weight_g: number | null;
    print_minutes: number | null;
    dimensions_mm: { x: number; y: number; z: number } | null;
    recommended_printer: string | null;
    difficulty: "easy" | "medium" | "hard" | null;
    difficulty_score?: number;
    color_count?: number;
    process?: "fdm" | "resin" | "sls";
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
    components?: BreakdownComponent[];
    multipliers?: Record<string, number>;
    rush_tier?: "standard" | "fast" | "rush";
    rush_days?: number;
    qty?: number;
    parts_count?: number;
    color_count?: number;
    rush_options?: RushOption[];
    bulk_preview?: Array<{ min_qty: number; discount_pct: number; preview_iqd_per_unit: number }>;
    inputs: { weight_g: number; print_minutes: number; difficulty: string };
  };
  metrics?: ModelMetrics;
  quality?: QualityReport;
  material?: { code: string; name_en: string; name_ar: string; process_type?: string };
}

interface Props {
  result: QuoteResult;
  onCreate: () => void;
  creating: boolean;
  onUseFile: () => void;
  onMaterialChange?: (code: string) => void;
  materialChanging?: boolean;
  onParamsChange?: (params: { qty: number; rush_tier: "standard" | "fast" | "rush" }) => void;
  paramsChanging?: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function QuoteResultCard({
  result, onCreate, creating, onUseFile,
  onMaterialChange, materialChanging,
  onParamsChange, paramsChanging,
}: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showQuality, setShowQuality] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  const m = result.model;
  const b = result.breakdown;
  const minutes = m.print_minutes ?? b.inputs.print_minutes;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hasGeometry = !!result.metrics && !!result.quality;
  const qty = b.qty ?? 1;
  const rushTier = b.rush_tier ?? "standard";
  const score = m.difficulty_score;
  const processBadge = m.process ?? "fdm";
  const colorCount = b.color_count ?? m.color_count ?? 1;

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

  const conf = result.unified?.confidenceLevel;
  const confColor = conf === "high"
    ? "bg-green-500/15 text-green-600 dark:text-green-400"
    : conf === "low"
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  const confLabel = conf === "high" ? t("ثقة عالية", "High confidence")
    : conf === "low" ? t("ثقة منخفضة", "Low confidence")
    : conf ? t("ثقة متوسطة", "Medium confidence") : null;

  const setQty = (next: number) => {
    const n = Math.max(1, Math.min(1000, Math.floor(next)));
    if (n !== qty) onParamsChange?.({ qty: n, rush_tier: rushTier });
  };
  const setRush = (next: "standard" | "fast" | "rush") => {
    if (next !== rushTier) onParamsChange?.({ qty, rush_tier: next });
  };

  const downloadPdf = async () => {
    try {
      setDownloading(true);
      // 1) Save quotation row
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("سجل دخول أولاً", "Please sign in")); return; }
      const res = await supabase.functions.invoke("generate-quotation-pdf", {
        body: {
          source: result.sourceFileName ? "file" : (result.sourceUrl ? "url" : "manual"),
          process_type: processBadge,
          material_code: result.material?.code,
          rush_tier: rushTier,
          qty,
          input_payload: {
            file_name: result.sourceFileName ?? result.sourceUrl ?? m.name,
            metrics: result.metrics,
            quality: result.quality,
          },
          breakdown: b,
          final_iqd: b.final,
          difficulty_score: score,
        },
      });
      if (res.error) throw res.error;

      // 2) Render printable HTML to PDF client-side
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const el = printableRef.current!;
      el.style.display = "block";
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      el.style.display = "none";
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
      const num = (res.data as any)?.quotation?.quote_number ?? "quotation";
      pdf.save(`${num}.pdf`);
      toast.success(t("تم تنزيل العرض", "Quotation downloaded"));
    } catch (e: any) {
      toast.error(e?.message ?? t("فشل تنزيل PDF", "PDF download failed"));
    } finally { setDownloading(false); }
  };

  const components = b.components ?? [
    { key: "filament", label_ar: "الفلامنت", label_en: "Filament", value: b.filament_cost },
    { key: "machine", label_ar: "الماكنة", label_en: "Machine", value: b.machine_cost },
    { key: "complexity", label_ar: "التعقيد", label_en: "Complexity", value: b.complexity_fee },
  ];

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
        <Badge className="absolute top-2 start-2 bg-primary/15 text-primary border-0" variant="secondary">
          {processBadge.toUpperCase()}
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg leading-tight">{m.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            {result.unified?.creator?.name && (
              <span>{t("بواسطة", "by")} <span className="font-medium text-foreground">{result.unified.creator.name}</span></span>
            )}
            {result.unified?.stats && (result.unified.stats.downloads > 0 || result.unified.stats.likes > 0) && (
              <>
                {result.unified.stats.downloads > 0 && <span>· ⬇ {result.unified.stats.downloads.toLocaleString()}</span>}
                {result.unified.stats.likes > 0 && <span>· ♥ {result.unified.stats.likes.toLocaleString()}</span>}
              </>
            )}
            {confLabel && <Badge className={`${confColor} border-0`} variant="secondary">{confLabel}</Badge>}
          </div>
          {result.sourceUrl && (
            <a href={result.sourceUrl} target="_blank" rel="noreferrer"
              className="text-xs text-primary inline-flex items-center gap-1 mt-1">
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

        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label={t("الوزن", "Weight")} value={`${b.inputs.weight_g}g`} />
          <Stat label={t("الوقت", "Time")} value={`${hours}h ${mins}m`} />
          <Stat label={t("الألوان", "Colors")} value={`${colorCount}`} />
          <div className="rounded-lg p-2 glass-panel">
            <div className="text-[10px] text-muted-foreground mb-1">{t("الصعوبة", "Difficulty")}</div>
            <Badge className={`${difficultyColor} border-0`}>
              {score ? `${score}/10` : (m.difficulty === "easy" ? t("سهل", "Easy") : m.difficulty === "hard" ? t("صعب", "Hard") : t("متوسط", "Medium"))}
            </Badge>
          </div>

        </div>

        {/* Rush + Qty controls */}
        {onParamsChange && (
          <div className="space-y-2 rounded-xl p-3 glass-panel">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{t("سرعة التسليم", "Delivery speed")}</span>
              {paramsChanging && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(b.rush_options ?? []).map((opt) => (
                <button key={opt.tier} onClick={() => setRush(opt.tier)} disabled={paramsChanging}
                  className={`glass-trigger rounded-lg px-2 py-1.5 text-[11px] transition ${rushTier === opt.tier
                    ? "ring-1 ring-primary/60 bg-primary/10 text-primary"
                    : ""}`}>
                  <div className="font-semibold flex items-center justify-center gap-1">
                    {opt.tier === "rush" && <Zap className="h-3 w-3" />}
                    {opt.tier === "standard" ? t("قياسي", "Standard") : opt.tier === "fast" ? t("سريع", "Fast") : t("عاجل", "Rush")}
                  </div>
                  <div className="text-muted-foreground">{opt.days} {t("يوم", "d")}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium">{t("الكمية", "Quantity")}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(qty - 1)} disabled={paramsChanging || qty <= 1}
                  className="h-7 w-7 rounded-full glass-trigger">-</button>
                <span className="w-10 text-center font-semibold text-sm">{qty}</span>
                <button onClick={() => setQty(qty + 1)} disabled={paramsChanging}
                  className="h-7 w-7 rounded-full glass-trigger">+</button>
              </div>
            </div>
            {(b.multipliers?.bulk_discount_pct ?? 0) > 0 && (
              <div className="text-[10px] text-green-600 dark:text-green-400 text-center">
                {t("خصم الجملة:", "Bulk discount:")} −{Math.round((b.multipliers?.bulk_discount_pct ?? 0) * 100)}%
              </div>
            )}
          </div>

        )}

        <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-4">
          <div className="text-xs text-muted-foreground mb-1">{t("نطاق السعر المقدّر", "Estimated price range")}</div>
          <div className="text-2xl font-bold text-primary">
            {fmt(b.price_min)} – {fmt(b.price_max)} <span className="text-sm font-normal">IQD</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("الموصى به:", "Recommended:")} <span className="font-semibold text-foreground">{fmt(b.final)} IQD</span>
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
            {components.map((c) => (
              <Row key={c.key} label={isAr ? c.label_ar : c.label_en} value={c.value} />
            ))}
            {b.multipliers && (
              <div className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/40 mt-1.5 flex flex-wrap gap-x-2">
                {Object.entries(b.multipliers).map(([k, v]) => (
                  <span key={k}>×{(v as number).toFixed(2)} {k}</span>
                ))}
              </div>
            )}
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
          <Button variant="outline" onClick={downloadPdf} disabled={downloading} title={t("تنزيل PDF", "Download PDF")}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          </Button>
          {!result.sourceFileName && (
            <Button variant="outline" onClick={onUseFile} title={t("استخدام ملف", "Use file")}>
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Hidden printable for PDF */}
        <div ref={printableRef} style={{ display: "none", width: 794, padding: 32, background: "#fff", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <h1 style={{ fontSize: 22, margin: 0, marginBottom: 4 }}>{t("عرض سعر طباعة 3D", "3D Print Quotation")}</h1>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>{new Date().toLocaleString()}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
            <tbody>
              <tr><td style={cellL}>{t("النموذج", "Model")}</td><td style={cellR}>{m.name}</td></tr>
              <tr><td style={cellL}>{t("التقنية", "Process")}</td><td style={cellR}>{processBadge.toUpperCase()}</td></tr>
              <tr><td style={cellL}>{t("المادة", "Material")}</td><td style={cellR}>{result.material?.name_en ?? "-"}</td></tr>
              <tr><td style={cellL}>{t("الوزن", "Weight")}</td><td style={cellR}>{b.inputs.weight_g} g</td></tr>
              <tr><td style={cellL}>{t("وقت الطباعة", "Print time")}</td><td style={cellR}>{hours}h {mins}m</td></tr>
              <tr><td style={cellL}>{t("الألوان", "Colors")}</td><td style={cellR}>{colorCount}</td></tr>
              <tr><td style={cellL}>{t("الكمية", "Quantity")}</td><td style={cellR}>{qty}</td></tr>
              <tr><td style={cellL}>{t("سرعة التسليم", "Delivery speed")}</td><td style={cellR}>{rushTier} ({b.rush_days} {t("يوم", "days")})</td></tr>
              <tr><td style={cellL}>{t("الصعوبة", "Difficulty")}</td><td style={cellR}>{score ?? m.difficulty}/10</td></tr>
            </tbody>
          </table>
          <h2 style={{ fontSize: 14, margin: "16px 0 6px" }}>{t("تفاصيل التكلفة", "Cost breakdown")}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {components.map((c) => (
                <tr key={c.key}><td style={cellL}>{isAr ? c.label_ar : c.label_en}</td><td style={cellR}>{fmt(c.value)} IQD</td></tr>
              ))}
              <tr><td style={cellL}>{t("رسوم المنصة", "Platform fee")}</td><td style={cellR}>{fmt(b.platform_fee)} IQD</td></tr>
              <tr><td style={cellL}>{t("هامش الربح", "Profit margin")}</td><td style={cellR}>{fmt(b.profit_margin)} IQD</td></tr>
              <tr style={{ background: "#f4f4f5" }}><td style={{ ...cellL, fontWeight: 700 }}>{t("الإجمالي", "Total")}</td><td style={{ ...cellR, fontWeight: 700 }}>{fmt(b.final)} IQD</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 10, color: "#777", marginTop: 24 }}>
            {t("نطاق السعر النهائي قد يختلف ±15% عن التقدير. صالح لمدة 7 أيام.", "Final price may vary ±15% from estimate. Valid for 7 days.")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const cellL = { padding: "6px 8px", borderBottom: "1px solid #eee", color: "#555" } as const;
const cellR = { padding: "6px 8px", borderBottom: "1px solid #eee", textAlign: "right" as const, fontWeight: 500 };

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
