import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Box, Layers, Cpu, Palette, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractionLoaderProps {
  language: "ar" | "en";
  /** When true, the loader is in "fetching from link" mode (slower, server). */
  mode?: "link" | "file";
  /** Optional stage label from the file analyzer worker (e.g. "Reading file"). */
  stage?: string;
  /** Optional 0-100 progress from the worker (file mode only). */
  realProgress?: number;
}

/**
 * Engaging loader shown while extraction is running.
 * - Animated 3D-print themed scene (rotating cube + layer build-up).
 * - Auto-stepping checklist that simulates extraction stages.
 * - Rotating fun facts so the wait feels short.
 * - In file mode it follows the real progress from the worker; in link mode
 *   it eases towards 90% with a perceived-time curve.
 */
export default function ExtractionLoader({
  language,
  mode = "link",
  stage,
  realProgress,
}: ExtractionLoaderProps) {
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const STEPS = useMemo(
    () =>
      mode === "file"
        ? [
            { icon: Box, ar: "قراءة الملف", en: "Reading file" },
            { icon: Layers, ar: "تحليل الأبعاد والطبقات", en: "Analyzing geometry" },
            { icon: Cpu, ar: "حساب الوزن ووقت الطباعة", en: "Computing weight & time" },
            { icon: Palette, ar: "تقدير السعر النهائي", en: "Pricing the print" },
          ]
        : [
            { icon: Sparkles, ar: "الاتصال بمصدر النموذج", en: "Reaching the source" },
            { icon: Box, ar: "استخراج بيانات النموذج", en: "Extracting model data" },
            { icon: Layers, ar: "قراءة ملفات الطباعة", en: "Reading print profiles" },
            { icon: Cpu, ar: "تحليل الوزن والوقت", en: "Analyzing weight & time" },
            { icon: Palette, ar: "حساب السعر الفوري", en: "Computing instant price" },
          ],
    [mode],
  );

  const FACTS = useMemo(
    () => [
      t("نموذجك يُحلَّل طبقةً طبقة — تماماً كما ستُطبَع.", "Your model is analyzed layer by layer — just like it prints."),
      t("نقيس الحجم الفعلي وكثافة المادة لتقدير الوزن بدقة.", "We measure real volume × material density for accurate weight."),
      t("التعقيد يحدد وقت الطباعة أكثر من الحجم في الغالب.", "Geometry complexity drives print time more than raw size."),
      t("نختار أفضل آلة وملف طباعة لك تلقائياً.", "We pick the best machine & profile for you automatically."),
      t("متعدد الألوان؟ نضيف تكلفة التبديل والهدر تلقائياً.", "Multi-color? Tool changes and waste are added automatically."),
      t("التسعير يحدّث فوراً عند تغيير المادة أو الكمية.", "Pricing updates instantly when material or quantity change."),
    ],
    [language],
  );

  const [fakePct, setFakePct] = useState(8);
  const [stepIdx, setStepIdx] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const startRef = useRef(Date.now());

  // Perceived progress curve (link mode only): fast at start, slows near 92%.
  useEffect(() => {
    if (mode === "file") return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      // Asymptote near 92%
      const target = Math.min(92, 100 * (1 - Math.exp(-elapsed / 4)));
      setFakePct((p) => Math.max(p, Math.round(target)));
    }, 200);
    return () => clearInterval(id);
  }, [mode]);

  // Auto-advance steps every ~1.6s, capped at last step.
  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
    }, 1600);
    return () => clearInterval(id);
  }, [STEPS.length]);

  // Rotate fun facts
  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 3200);
    return () => clearInterval(id);
  }, [FACTS.length]);

  const pct = mode === "file" && typeof realProgress === "number" ? realProgress : fakePct;
  const activeStage =
    mode === "file" && stage
      ? stage
      : t(STEPS[stepIdx].ar, STEPS[stepIdx].en);

  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/15 shadow-2xl shadow-primary/10 overflow-hidden relative animate-glass-expand">
      {/* Animated aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-10 -start-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl animate-pulse" style={{ animationDuration: "3s" }} />
        <div className="absolute -bottom-10 -end-10 h-40 w-40 rounded-full bg-accent/30 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      </div>

      <div className="relative flex flex-col sm:flex-row items-center sm:items-stretch gap-4 sm:gap-6">
        {/* Left: 3D-print themed animation */}
        <div className="shrink-0 flex flex-col items-center justify-center w-32 h-32 sm:w-36 sm:h-36">
          <PrintScene pct={pct} />
        </div>

        {/* Right: status + steps */}
        <div className="flex-1 min-w-0 w-full space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold truncate">{activeStage}</span>
            <span className="ms-auto text-xs text-muted-foreground tabular-nums">{pct}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%`, backgroundSize: "200% 100%", animation: "shine 2.5s linear infinite" }}
            />
          </div>

          {/* Steps */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 transition-all",
                    done && "text-emerald-500",
                    active && "text-primary bg-primary/10 ring-1 ring-primary/20",
                    !done && !active && "text-muted-foreground/70",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{t(s.ar, s.en)}</span>
                </li>
              );
            })}
          </ul>

          {/* Fun fact */}
          <div className="relative h-9 overflow-hidden rounded-lg bg-foreground/[0.04] px-3 flex items-center">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 me-2" />
            <p key={factIdx} className="text-xs text-foreground/80 truncate animate-in fade-in slide-in-from-bottom-2 duration-500">
              {FACTS[factIdx]}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shine { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes layerRise { 0% { transform: translateY(40px); opacity: 0 } 60% { opacity: 1 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes nozzleSweep { 0%,100% { transform: translateX(-12px) } 50% { transform: translateX(12px) } }
        @keyframes cubeSpin { from { transform: rotateX(-20deg) rotateY(0deg) } to { transform: rotateX(-20deg) rotateY(360deg) } }
      `}</style>
    </div>
  );
}

/**
 * Small CSS-only "3D printer" scene: a build plate with rising layers and a
 * sweeping nozzle. Subtle, GPU-cheap, theme-aware via tokens.
 */
function PrintScene({ pct }: { pct: number }) {
  const layers = 8;
  const filled = Math.max(1, Math.min(layers, Math.round((pct / 100) * layers)));
  return (
    <div className="relative w-full h-full">
      {/* glow */}
      <div className="absolute inset-2 rounded-full bg-primary/15 blur-2xl" />

      {/* Build plate */}
      <div className="absolute inset-x-2 bottom-3 h-2 rounded-md bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30 shadow-[0_0_18px_hsl(var(--primary)/0.6)]" />

      {/* Rising layers (cube being printed) */}
      <div className="absolute inset-x-0 bottom-5 flex items-end justify-center gap-[2px] h-20">
        {Array.from({ length: layers }).map((_, i) => {
          const isOn = i < filled;
          return (
            <div
              key={i}
              className={cn(
                "w-8 rounded-[2px] transition-all duration-300",
                isOn ? "bg-gradient-to-t from-primary to-accent" : "bg-foreground/10",
              )}
              style={{
                height: `${8 + i * 1.5}px`,
                animation: isOn ? `layerRise .4s ease-out ${i * 60}ms both` : undefined,
                boxShadow: isOn ? "0 0 8px hsl(var(--primary)/0.5)" : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Nozzle */}
      <div
        className="absolute top-1 start-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ animation: "nozzleSweep 1.6s ease-in-out infinite" }}
      >
        <div className="w-6 h-3 rounded-sm bg-foreground/70" />
        <div className="w-1.5 h-2 bg-foreground/70" />
        <div className="w-0.5 h-3 bg-primary/80 shadow-[0_0_6px_hsl(var(--primary))]" />
      </div>
    </div>
  );
}
