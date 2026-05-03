import { useEffect, useRef } from "react";

interface WavyColorsProps {
  className?: string;
  colors?: string[];
  speed?: number;
}

/**
 * Animated mixed-colors square: layered conic/radial blobs that drift like a wavy
 * fluid. Pure canvas — works as a fallback "image" for random filament offers.
 */
export default function WavyColors({
  className = "",
  colors = ["#ff5e7e", "#ffb547", "#7cffb1", "#5eb4ff", "#c47dff", "#ff7df0"],
  speed = 1,
}: WavyColorsProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

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

    const blobs = colors.map((c, i) => ({
      color: c,
      phase: i * 1.7,
      ax: 0.25 + Math.random() * 0.45,
      ay: 0.25 + Math.random() * 0.45,
      fx: 0.5 + Math.random() * 0.6,
      fy: 0.4 + Math.random() * 0.6,
      r: 0.55 + Math.random() * 0.25,
    }));

    const start = performance.now();
    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const tt = ((t - start) / 1000) * speed;

      // soft base wash so colors blend instead of stark black bg
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "screen";
      blobs.forEach((b) => {
        const cx = w * (0.5 + b.ax * Math.sin(tt * b.fx + b.phase));
        const cy = h * (0.5 + b.ay * Math.cos(tt * b.fy + b.phase * 1.3));
        const radius = Math.max(w, h) * b.r;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, b.color + "ff");
        g.addColorStop(0.5, b.color + "55");
        g.addColorStop(1, b.color + "00");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      // subtle wave overlay for "moving wave" feel
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
  }, [colors, speed]);

  return (
    <canvas
      ref={ref}
      className={`block w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
}
