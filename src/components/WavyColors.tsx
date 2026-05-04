import { useEffect, useMemo, useRef } from "react";

interface WavyColorsProps {
  className?: string;
  colors?: string[];
  speed?: number;
  /** Stable seed (e.g. offer id) — same seed = same look; different seed = different palette/motion. */
  seed?: string;
}

/* ---------- deterministic helpers ---------- */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hsl(h: number, s: number, l: number) {
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
}
function paletteFromSeed(rand: () => number): string[] {
  const baseHue = Math.floor(rand() * 360);
  const spread = 30 + rand() * 90; // narrow → harmonized, wide → vivid mix
  const count = 5 + Math.floor(rand() * 2); // 5 or 6 blobs
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (baseHue + (i * spread) / count + rand() * 12) % 360;
    const sat = 70 + rand() * 25;
    const lig = 55 + rand() * 15;
    out.push(hsl(hue, sat, lig));
  }
  return out;
}

/**
 * Animated mixed-colors square: layered conic/radial blobs that drift like a wavy
 * fluid. Pure canvas — works as a fallback "image" for random filament offers.
 * When `seed` is provided, the palette and motion are deterministic per seed,
 * so different offers render visibly different waves.
 */
export default function WavyColors({
  className = "",
  colors,
  speed = 1,
  seed,
}: WavyColorsProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  // Resolve a stable palette + motion params from the seed (or fall back to defaults).
  const { palette, motion } = useMemo(() => {
    const rand = mulberry32(hashSeed(seed ?? "default-wave"));
    const fallback = ["#ff5e7e", "#ffb547", "#7cffb1", "#5eb4ff", "#c47dff", "#ff7df0"];
    const pal = colors && colors.length ? colors : seed ? paletteFromSeed(rand) : fallback;
    const m = pal.map((_, i) => ({
      phase: i * 1.7 + rand() * Math.PI * 2,
      ax: 0.22 + rand() * 0.5,
      ay: 0.22 + rand() * 0.5,
      fx: 0.4 + rand() * 0.7,
      fy: 0.35 + rand() * 0.7,
      r: 0.5 + rand() * 0.3,
    }));
    return { palette: pal, motion: m };
  }, [seed, colors]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const blobs = palette.map((c, i) => ({ color: c, ...motion[i % motion.length] }));

    const start = performance.now();
    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const tt = ((t - start) / 1000) * speed;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      blobs.forEach((b) => {
        const cx = w * (0.5 + b.ax * Math.sin(tt * b.fx + b.phase));
        const cy = h * (0.5 + b.ay * Math.cos(tt * b.fy + b.phase * 1.3));
        const radius = Math.max(w, h) * b.r;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        // Convert hsl(H S% L%) -> hsla() with alpha falloff so blobs blend softly.
        const toAlpha = (col: string, a: number) => {
          if (col.startsWith("hsl(") && !col.startsWith("hsla(")) {
            return col.replace("hsl(", "hsla(").replace(")", ` / ${a})`);
          }
          // hex/rgb fallback: rely on globalAlpha at fill time
          return col;
        };
        g.addColorStop(0, toAlpha(b.color, 0.85));
        g.addColorStop(0.5, toAlpha(b.color, 0.35));
        g.addColorStop(1, toAlpha(b.color, 0));
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      });

      ctx.globalCompositeOperation = "overlay";
      const grd = ctx.createLinearGradient(
        0,
        h * (0.5 + 0.25 * Math.sin(tt * 0.6)),
        w,
        h * (0.5 + 0.25 * Math.cos(tt * 0.7))
      );
      grd.addColorStop(0, "rgba(255,255,255,0.08)");
      grd.addColorStop(0.5, "rgba(255,255,255,0)");
      grd.addColorStop(1, "rgba(255,255,255,0.08)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [palette, motion, speed]);

  return (
    <canvas
      ref={ref}
      className={`block w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
}
