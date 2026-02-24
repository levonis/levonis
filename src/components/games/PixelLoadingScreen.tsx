import { useState, useEffect } from "react";

const TOTAL_BLOCKS = 20;
const LOAD_DURATION = 2200; // ms

export default function PixelLoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("LOADING");

  useEffect(() => {
    const interval = LOAD_DURATION / TOTAL_BLOCKS;
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= TOTAL_BLOCKS) {
          clearInterval(timer);
          return p;
        }
        return p + 1;
      });
    }, interval);

    // Dots animation
    const dotTimer = setInterval(() => {
      setText((t) => {
        const dots = t.replace("LOADING", "");
        return dots.length >= 3 ? "LOADING" : t + ".";
      });
    }, 400);

    return () => {
      clearInterval(timer);
      clearInterval(dotTimer);
    };
  }, []);

  useEffect(() => {
    if (progress >= TOTAL_BLOCKS) {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
  }, [progress, onComplete]);

  const pct = Math.round((progress / TOTAL_BLOCKS) * 100);

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-6"
      style={{ imageRendering: "pixelated" }}>
      {/* Pixel art game icon */}
      <div className="text-6xl animate-[rps-float_1s_ease-in-out_infinite_alternate]">🎮</div>

      {/* Title */}
      <h1 className="text-primary font-mono text-xl font-bold tracking-[0.3em]"
        style={{ textShadow: "2px 2px 0 hsl(var(--accent))" }}>
        PIXEL GAMES
      </h1>

      {/* Progress bar */}
      <div className="w-64 sm:w-80">
        <div className="border-2 border-primary/40 p-[3px] bg-card/50" style={{ imageRendering: "pixelated" }}>
          <div className="flex gap-[2px] h-5">
            {Array.from({ length: TOTAL_BLOCKS }).map((_, i) => (
              <div
                key={i}
                className="flex-1 transition-all duration-100"
                style={{
                  background: i < progress ? "hsl(var(--primary))" : "hsl(var(--card))",
                  boxShadow: i < progress ? "inset 0 -2px 0 hsl(var(--accent))" : "none",
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="font-mono text-xs text-primary/70">{text}</span>
          <span className="font-mono text-xs text-primary/70">{pct}%</span>
        </div>
      </div>

      {/* Pixel sprites decorations */}
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
