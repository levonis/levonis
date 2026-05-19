import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { ModelMetrics, QualityReport } from "@/lib/modelAnalysis/types";

interface Props {
  metrics: ModelMetrics;
  quality: QualityReport;
}

type Status = "pass" | "warn" | "fail";
const StatusIcon = ({ s }: { s: Status }) =>
  s === "pass" ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : s === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-500" />
    : <XCircle className="h-4 w-4 text-red-500" />;

export default function QualityReportPanel({ metrics, quality }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const watertightStatus: Status =
    quality.watertight ? "pass" : quality.non_manifold_pct < 0.02 ? "warn" : "fail";
  const overhangStatus: Status =
    quality.overhang_pct < 0.05 ? "pass" : quality.overhang_pct < 0.15 ? "warn" : "fail";
  const flippedStatus: Status =
    quality.flipped_normals_pct < 0.01 ? "pass" : quality.flipped_normals_pct < 0.05 ? "warn" : "fail";
  const wallStatus: Status =
    quality.min_wall_mm === null ? "warn"
    : quality.min_wall_mm >= 1.2 ? "pass"
    : quality.min_wall_mm >= 0.8 ? "warn" : "fail";

  const rows: Array<{ s: Status; label: string; value: string }> = [
    {
      s: watertightStatus,
      label: t("سلامة الشبكة (Watertight)", "Mesh integrity (watertight)"),
      value: quality.non_manifold_edges === 0
        ? t("سليمة", "Clean")
        : t(`${quality.non_manifold_edges} حافة معطوبة`, `${quality.non_manifold_edges} bad edges`),
    },
    {
      s: flippedStatus,
      label: t("اتجاه الأسطح (Normals)", "Surface normals"),
      value: `${(quality.flipped_normals_pct * 100).toFixed(1)}% ${t("معكوسة", "flipped")}`,
    },
    {
      s: overhangStatus,
      label: t("التدلّيات (Overhangs)", "Overhangs"),
      value: `${(quality.overhang_pct * 100).toFixed(1)}%`,
    },
    {
      s: wallStatus,
      label: t("أدنى سماكة جدار", "Min wall thickness"),
      value: quality.min_wall_mm === null
        ? t("غير محدد", "n/a")
        : `${quality.min_wall_mm.toFixed(2)} mm`,
    },
  ];

  return (
    <div className="space-y-3 bg-muted/20 rounded-lg p-3 border border-border/40">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label={t("الحجم", "Volume")} value={`${metrics.volume_cm3.toFixed(1)} cm³`} />
        <Stat label={t("المساحة", "Surface")} value={`${metrics.surface_area_cm2.toFixed(0)} cm²`} />
        <Stat label={t("المثلثات", "Triangles")} value={metrics.triangle_count.toLocaleString()} />
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <StatusIcon s={r.s} />
              <span className="text-muted-foreground">{r.label}</span>
            </span>
            <span className="font-medium">{r.value}</span>
          </div>
        ))}
      </div>
      {quality.support_required && (
        <div className="text-xs px-2 py-1.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          {t("⚠️ الطباعة تحتاج دعامات (Supports)", "⚠️ Print will require supports")}
        </div>
      )}
      {quality.thin_wall_warning && (
        <div className="text-xs px-2 py-1.5 rounded bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30">
          {t("⚠️ جدران رفيعة جدًا، قد تفشل الطباعة", "⚠️ Very thin walls — print may fail")}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2 border border-border/40 bg-card/40">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
