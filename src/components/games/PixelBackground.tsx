import { useMemo } from "react";

function randomParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 8,
    duration: 6 + Math.random() * 10,
    opacity: 0.15 + Math.random() * 0.25,
  }));
}

export default function PixelBackground() {
  const particles = useMemo(() => randomParticles(18), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, hsl(var(--primary)) 0px, transparent 1px, transparent 16px)," +
            "repeating-linear-gradient(90deg, hsl(var(--primary)) 0px, transparent 1px, transparent 16px)",
          imageRendering: "pixelated",
        }}
      />

      {/* Scanline */}
      <div className="absolute inset-0 pixel-scanline opacity-[0.03]" />

      {/* Floating pixel particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute pixel-float-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: `hsl(var(--primary) / ${p.opacity})`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            imageRendering: "pixelated",
          }}
        />
      ))}

      {/* Twinkling stars */}
      {particles.slice(0, 8).map((p) => (
        <div
          key={`star-${p.id}`}
          className="absolute pixel-twinkle"
          style={{
            left: `${(p.left + 30) % 100}%`,
            top: `${(p.top + 20) % 100}%`,
            width: 2,
            height: 2,
            background: "hsl(var(--primary))",
            animationDelay: `${p.delay + 2}s`,
            imageRendering: "pixelated",
          }}
        />
      ))}
    </div>
  );
}
