import { useEffect, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ExtractionStep = {
  key: string;
  label: string;
  status: "pending" | "active" | "done";
};

interface ExtractionProgressProps {
  active: boolean;
  steps: ExtractionStep[];
  filledFields: string[];
}

const FIELD_LABELS: Record<string, string> = {
  name_ar: "الاسم (عربي)",
  name: "الاسم (إنجليزي)",
  slug: "الرابط",
  description_ar: "الوصف (عربي)",
  description: "الوصف (إنجليزي)",
  price: "السعر الحالي",
  original_price: "السعر الأصلي",
  short_summary: "الملخص القصير (SEO)",
  searchable_tags: "كلمات البحث",
  ai_content: "محتوى لماذا هذا المنتج",
  options: "الخيارات / المقاسات",
  colors: "الألوان",
  images: "الصور",
  dimensions: "الأبعاد",
  weight_kg: "الوزن",
};

export function ExtractionProgress({ active, steps, filledFields }: ExtractionProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    const doneCount = steps.filter((s) => s.status === "done").length;
    const activeCount = steps.filter((s) => s.status === "active").length;
    const total = steps.length || 1;
    const target = Math.min(98, ((doneCount + activeCount * 0.5) / total) * 100);
    const id = setTimeout(() => setProgress(target), 50);
    return () => clearTimeout(id);
  }, [active, steps]);

  if (!active && filledFields.length === 0) return null;

  return (
    <div className="glass-panel rounded-lg p-4 space-y-3 border border-primary/20 animate-glass-expand">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {active ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Check className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-sm font-semibold">
            {active ? "جاري الاستخراج والتعبئة التلقائية..." : "اكتمل الاستخراج"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
      </div>

      <Progress value={active ? progress : 100} className="h-2" />

      {steps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {steps.map((step) => (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-2 text-xs rounded-md px-2 py-1 transition-colors",
                step.status === "done" && "text-emerald-600 dark:text-emerald-400",
                step.status === "active" && "text-primary bg-primary/5",
                step.status === "pending" && "text-muted-foreground"
              )}
            >
              {step.status === "done" ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : step.status === "active" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{step.label}</span>
            </div>
          ))}
        </div>
      )}

      {filledFields.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1.5">الحقول المعبأة:</p>
          <div className="flex flex-wrap gap-1.5">
            {filledFields.map((field) => (
              <span
                key={field}
                className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-fade-in"
              >
                <Check className="inline h-3 w-3 ml-1" />
                {FIELD_LABELS[field] || field}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
