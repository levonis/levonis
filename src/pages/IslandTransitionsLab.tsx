import { useEffect, useMemo, useRef, useState } from "react";
import { useIsland, type IslandState } from "@/island/IslandContext";

/**
 * Diagnostics page for the Dynamic Island.
 *
 * Cycles the island through every state (promo → category → product → search)
 * while sampling FPS via rAF and measuring the actual time each morph takes
 * (from state change → shell width settles within 0.5px for 6 frames).
 *
 * Open at /diagnostics/island-transitions
 */

type Sample = {
  from: IslandState;
  to: IslandState;
  durationMs: number;
  avgFps: number;
  minFps: number;
};

const SEQUENCE: Array<{ state: IslandState; title?: string; label: string }> = [
  { state: "promo", label: "promo (marquee)" },
  { state: "category", title: "اختبار قسم طويل جداً للجزيرة", label: "category (long title)" },
  { state: "product", title: "Dyson V15 Detect Absolute", label: "product (title)" },
  { state: "search", label: "search (idle)" },
  { state: "category", title: "كاميرا", label: "category (short)" },
  { state: "promo", label: "promo (return)" },
];

const MORPH_BUDGET_MS = 1200;
const STABLE_FRAMES = 6;
const STABLE_EPS = 0.5;

export default function IslandTransitionsLab() {
  const { setContext } = useIsland();
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(-1);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [liveFps, setLiveFps] = useState(0);

  // Live FPS meter (always on while page is open).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      acc += dt;
      frames++;
      if (acc >= 500) {
        setLiveFps(Math.round((frames * 1000) / acc));
        acc = 0;
        frames = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reset to default when leaving the page.
  useEffect(() => () => setContext(null), [setContext]);

  const findIslandShell = (): HTMLElement | null => {
    // The island shell is the framer-motion div with [data-island-shell].
    // Falls back to the first element under the fixed island container.
    return document.querySelector<HTMLElement>("[data-dynamic-island]");
  };

  const measureMorph = (from: IslandState, to: IslandState) =>
    new Promise<Sample>((resolve) => {
      const shell = findIslandShell();
      const start = performance.now();
      let lastWidth = shell?.getBoundingClientRect().width ?? 0;
      let stable = 0;
      let frames = 0;
      let minDelta = Infinity;
      let raf = 0;

      const finish = (durationMs: number) => {
        cancelAnimationFrame(raf);
        const elapsed = performance.now() - start;
        const fps = (frames * 1000) / Math.max(1, elapsed);
        // We can't truly capture min-FPS without full frame log; approximate
        // worst frame from the longest gap recorded.
        const minFps = minDelta > 0 && minDelta < Infinity ? Math.round(1000 / minDelta) : Math.round(fps);
        resolve({
          from,
          to,
          durationMs: Math.round(durationMs),
          avgFps: Math.round(fps),
          minFps,
        });
      };

      let prevT = start;
      const step = (t: number) => {
        frames++;
        const delta = t - prevT;
        prevT = t;
        if (delta > minDelta || delta > 0) minDelta = Math.max(minDelta === Infinity ? 0 : minDelta, delta);

        const w = shell?.getBoundingClientRect().width ?? lastWidth;
        if (Math.abs(w - lastWidth) < STABLE_EPS) {
          stable++;
        } else {
          stable = 0;
        }
        lastWidth = w;

        if (stable >= STABLE_FRAMES) {
          finish(t - start);
          return;
        }
        if (t - start > MORPH_BUDGET_MS) {
          finish(t - start);
          return;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });

  const runOnce = async () => {
    if (running) return;
    setRunning(true);
    setSamples([]);
    setIndex(-1);

    // Prime to first state.
    setContext({ state: SEQUENCE[0].state, title: SEQUENCE[0].title });
    setIndex(0);
    await new Promise((r) => setTimeout(r, 400));

    const collected: Sample[] = [];
    for (let i = 1; i < SEQUENCE.length; i++) {
      const from = SEQUENCE[i - 1].state;
      const to = SEQUENCE[i].state;
      setIndex(i);
      setContext({ state: to, title: SEQUENCE[i].title });
      // Start measuring on the next frame so the shell has applied the new
      // target shape.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const s = await measureMorph(from, to);
      collected.push(s);
      setSamples([...collected]);
      // Pause between transitions to make the run easy to follow visually.
      await new Promise((r) => setTimeout(r, 350));
    }
    setRunning(false);
  };

  const summary = useMemo(() => {
    if (!samples.length) return null;
    const dur = samples.map((s) => s.durationMs);
    const fps = samples.map((s) => s.avgFps);
    return {
      avgDuration: Math.round(dur.reduce((a, b) => a + b, 0) / dur.length),
      maxDuration: Math.max(...dur),
      avgFps: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length),
      minFps: Math.min(...samples.map((s) => s.minFps)),
    };
  }, [samples]);

  const exportJson = () => {
    const payload = { generatedAt: new Date().toISOString(), liveFps, samples, summary };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `island-transitions-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pt-32 max-w-3xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-2">مختبر انتقالات الجزيرة العائمة</h1>
      <p className="text-sm text-muted-foreground mb-6">
        يقوم هذا المختبر بدورة كاملة عبر حالات الجزيرة (promo ↔ category ↔ product ↔ search)
        مع قياس زمن كل انتقال ومتوسط FPS أثناء الحركة، للتأكد من سلاسة وتجانس الأنميشن.
      </p>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={runOnce}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
        >
          {running ? "جاري التشغيل…" : "ابدأ الاختبار"}
        </button>
        <button
          onClick={exportJson}
          disabled={!samples.length}
          className="px-4 py-2 rounded-lg border border-border disabled:opacity-50"
        >
          تصدير JSON
        </button>
        <div className="ml-auto text-sm tabular-nums">
          FPS الحي: <span className="font-bold">{liveFps}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 mb-6 bg-card">
        <div className="text-xs text-muted-foreground mb-1">الحالة الحالية</div>
        <div className="font-mono text-sm">
          {index >= 0 ? `${index + 1}/${SEQUENCE.length} → ${SEQUENCE[index].label}` : "—"}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="متوسط الزمن" value={`${summary.avgDuration} ms`} />
          <Stat label="أطول انتقال" value={`${summary.maxDuration} ms`} />
          <Stat label="متوسط FPS" value={`${summary.avgFps}`} />
          <Stat label="أقل FPS" value={`${summary.minFps}`} />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-right p-2">#</th>
              <th className="text-right p-2">الانتقال</th>
              <th className="text-right p-2">الزمن</th>
              <th className="text-right p-2">متوسط FPS</th>
              <th className="text-right p-2">أقل FPS</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-2 tabular-nums">{i + 1}</td>
                <td className="p-2 font-mono">{s.from} → {s.to}</td>
                <td className="p-2 tabular-nums">{s.durationMs} ms</td>
                <td className="p-2 tabular-nums">{s.avgFps}</td>
                <td className={`p-2 tabular-nums ${s.minFps < 50 ? "text-destructive" : ""}`}>{s.minFps}</td>
              </tr>
            ))}
            {!samples.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  لا توجد نتائج بعد — اضغط "ابدأ الاختبار".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        ملاحظة: الانتقال "ينتهي" عندما يستقر عرض الجزيرة لمدة 6 إطارات متتالية ضمن 0.5px،
        وبحد أقصى {MORPH_BUDGET_MS}ms. هدف الجودة: زمن &lt; 500ms ومتوسط FPS ≥ 55.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
