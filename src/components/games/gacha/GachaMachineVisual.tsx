import { motion } from "framer-motion";

interface Props {
  theme?: string;
  size?: "sm" | "md" | "lg";
  spinning?: boolean;
  onKnobClick?: () => void;
  className?: string;
}

const THEME_COLORS: Record<string, { body: string; bodyDark: string; accent: string; knob: string }> = {
  default: { body: "#DC2626", bodyDark: "#991B1B", accent: "#FCA5A5", knob: "#FBBF24" },
  coupon: { body: "#16A34A", bodyDark: "#166534", accent: "#86EFAC", knob: "#FDE047" },
  doll: { body: "#EC4899", bodyDark: "#9D174D", accent: "#F9A8D4", knob: "#C084FC" },
  event: { body: "#EA580C", bodyDark: "#9A3412", accent: "#FDBA74", knob: "#FBBF24" },
  premium: { body: "#D97706", bodyDark: "#92400E", accent: "#FDE68A", knob: "#F59E0B" },
};

const CAPSULE_COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#A855F7", "#F59E0B", "#EC4899", "#06B6D4", "#F97316"];

const SIZES = {
  sm: { w: 80, h: 120, globe: 50, capsule: 8 },
  md: { w: 160, h: 240, globe: 100, capsule: 14 },
  lg: { w: 220, h: 330, globe: 140, capsule: 18 },
};

// Pre-generated capsule positions to avoid random on each render
const CAPSULE_POSITIONS = [
  { x: 15, y: 20 }, { x: 45, y: 15 }, { x: 70, y: 25 },
  { x: 25, y: 45 }, { x: 55, y: 40 }, { x: 80, y: 50 },
  { x: 10, y: 65 }, { x: 40, y: 70 }, { x: 65, y: 60 },
  { x: 30, y: 85 }, { x: 60, y: 80 }, { x: 50, y: 55 },
];

export default function GachaMachineVisual({ theme = "default", size = "md", spinning = false, onKnobClick, className = "" }: Props) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.default;
  const s = SIZES[size];
  const capsuleCount = size === "sm" ? 6 : size === "md" ? 9 : 12;

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`} style={{ width: s.w, height: s.h }}>
      {/* Top cap */}
      <div
        className="rounded-t-full relative z-10"
        style={{
          width: s.w * 0.7,
          height: s.h * 0.06,
          background: `linear-gradient(180deg, #555 0%, #333 100%)`,
        }}
      />

      {/* Glass globe */}
      <div
        className="relative overflow-hidden"
        style={{
          width: s.w * 0.65,
          height: s.globe,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.05))",
          border: "2px solid rgba(255,255,255,0.2)",
          boxShadow: "inset 0 -8px 20px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.2)",
        }}
      >
        {/* Capsules inside globe */}
        {CAPSULE_POSITIONS.slice(0, capsuleCount).map((pos, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: s.capsule,
              height: s.capsule,
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              background: `radial-gradient(circle at 35% 35%, ${CAPSULE_COLORS[i % CAPSULE_COLORS.length]}dd, ${CAPSULE_COLORS[i % CAPSULE_COLORS.length]}88)`,
              boxShadow: `inset -1px -1px 2px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)`,
            }}
            animate={spinning ? {
              y: [0, 3, -2, 4, -1, 0],
              x: [0, -2, 3, -1, 2, 0],
            } : {}}
            transition={spinning ? {
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.05,
            } : {}}
          />
        ))}

        {/* Glass reflection */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%)",
            borderRadius: "50%",
          }}
        />
      </div>

      {/* Machine body */}
      <div
        className="relative flex flex-col items-center"
        style={{
          width: s.w * 0.75,
          height: s.h * 0.45,
          background: `linear-gradient(180deg, ${colors.body} 0%, ${colors.bodyDark} 100%)`,
          borderRadius: `0 0 ${s.w * 0.08}px ${s.w * 0.08}px`,
          boxShadow: `inset 2px 0 6px rgba(255,255,255,0.15), inset -2px 0 6px rgba(0,0,0,0.2), 0 4px 15px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Decorative strip */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: s.h * 0.02,
            background: colors.accent,
            opacity: 0.6,
          }}
        />

        {/* Coin slot area */}
        <div className="flex items-center justify-center gap-1 mt-2" style={{ marginTop: s.h * 0.04 }}>
          {/* Coin slot */}
          <div
            style={{
              width: s.w * 0.15,
              height: s.h * 0.015,
              background: "#222",
              borderRadius: 2,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
            }}
          />
        </div>

        {/* Knob */}
        <motion.button
          onClick={onKnobClick}
          className="relative cursor-pointer z-10"
          style={{
            width: s.w * 0.22,
            height: s.w * 0.22,
            borderRadius: "50%",
            background: `radial-gradient(circle at 40% 35%, ${colors.knob}, ${colors.knob}cc)`,
            border: `2px solid rgba(0,0,0,0.3)`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)`,
            marginTop: s.h * 0.04,
          }}
          animate={spinning ? { rotate: 360 } : {}}
          transition={spinning ? { duration: 0.8, ease: "easeInOut" } : {}}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Knob cross mark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ width: "40%", height: 2, background: "rgba(0,0,0,0.3)", borderRadius: 1 }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ width: 2, height: "40%", background: "rgba(0,0,0,0.3)", borderRadius: 1 }} />
          </div>
        </motion.button>

        {/* Dispensing slot */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            width: s.w * 0.35,
            height: s.h * 0.12,
            background: "#111",
            borderRadius: `${s.w * 0.04}px ${s.w * 0.04}px 0 0`,
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
            marginBottom: s.h * 0.02,
            bottom: s.h * 0.02,
          }}
        >
          {/* Inner slot shadow */}
          <div
            className="absolute inset-1 rounded"
            style={{
              background: "radial-gradient(ellipse at center, #222, #0a0a0a)",
            }}
          />
        </div>
      </div>

      {/* Base */}
      <div
        style={{
          width: s.w * 0.85,
          height: s.h * 0.05,
          background: "linear-gradient(180deg, #444, #222)",
          borderRadius: `0 0 ${s.w * 0.06}px ${s.w * 0.06}px`,
          boxShadow: "0 3px 10px rgba(0,0,0,0.4)",
        }}
      />

      {/* Neon glow under machine when spinning */}
      {spinning && (
        <motion.div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2"
          style={{
            width: s.w * 0.6,
            height: 6,
            borderRadius: "50%",
            background: colors.body,
            filter: `blur(8px)`,
          }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </div>
  );
}
