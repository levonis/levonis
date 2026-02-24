import { useState, useEffect, useRef } from "react";

const TOTAL_BLOCKS = 20;
const LOAD_DURATION = 2000;

export default function PixelLoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("LOADING");
  const completedRef = useRef(false);

  useEffect(() => {
    const interval = LOAD_DURATION / TOTAL_BLOCKS;
    let count = 0;

    const timer = setInterval(() => {
      count++;
      setProgress(count);
      if (count >= TOTAL_BLOCKS) clearInterval(timer);
    }, interval);

    const dotTimer = setInterval(() => {
      setText((t) => {
        const dots = t.replace("LOADING", "");
        return dots.length >= 3 ? "LOADING" : t + ".";
      });
    }, 400);

    const safety = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, LOAD_DURATION + 600);

    return () => {
      clearInterval(timer);
      clearInterval(dotTimer);
      clearTimeout(safety);
    };
  }, [onComplete]);

  useEffect(() => {
    if (progress >= TOTAL_BLOCKS && !completedRef.current) {
      completedRef.current = true;
      const t = setTimeout(onComplete, 350);
      return () => clearTimeout(t);
    }
  }, [progress, onComplete]);

  const pct = Math.round((progress / TOTAL_BLOCKS) * 100);

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-6">
      {/* Pixel game icon */}
      <div className="text-6xl animate-[rps-float_1s_ease-in-out_infinite_alternate]">🎮</div>

      <h1 className="text-primary font-mono text-xl font-bold tracking-[0.3em]"
        style={{ textShadow: "2px 2px 0 hsl(var(--accent))" }}>
        PIXEL GAMES
      </h1>

      {/* Health bar style loading bar */}
      <div className="w-64 sm:w-80">
        {/* Outer pixel frame */}
        <div className="pixel-frame p-[4px]">
          {/* Inner inset */}
          <div className="pixel-frame-inset p-[3px]">
            <div className="flex gap-[1px] h-5">
              {Array.from({ length: TOTAL_BLOCKS }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 transition-all duration-100"
                  style={{
                    background: i < progress ? "hsl(var(--primary))" : "hsl(var(--card))",
                    boxShadow: i < progress
                      ? "inset 0 -2px 0 hsl(var(--accent)), inset 0 2px 0 rgba(255,255,255,0.15)"
                      : "inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="font-mono text-xs text-primary/70">{text}</span>
          <span className="font-mono text-xs text-primary/70">{pct}%</span>
        </div>
      </div>

      {/* Decorative pixel sprites */}
      <div className="flex gap-4 mt-4 opacity-50">
        {["⭐", "💎", "🏆"].map((e, i) => (
          <span key={i} className="text-2xl pixel-twinkle" style={{ animationDelay: `${i * 0.5}s` }}>
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}
