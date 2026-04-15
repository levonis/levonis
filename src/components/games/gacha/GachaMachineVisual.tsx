import { motion } from "framer-motion";

interface Props {
  theme?: string;
  size?: "sm" | "md" | "lg";
  spinning?: boolean;
  onKnobClick?: () => void;
  className?: string;
}

const THEME_COLORS: Record<string, { body: string; bodyDark: string; accent: string; knob: string; topBtn: string }> = {
  default: { body: "#DC2626", bodyDark: "#B91C1C", accent: "#FDE68A", knob: "#FBBF24", topBtn: "#EF4444" },
  coupon: { body: "#16A34A", bodyDark: "#15803D", accent: "#BBF7D0", knob: "#FDE047", topBtn: "#22C55E" },
  doll: { body: "#EC4899", bodyDark: "#DB2777", accent: "#FBCFE8", knob: "#C084FC", topBtn: "#F472B6" },
  event: { body: "#EA580C", bodyDark: "#C2410C", accent: "#FED7AA", knob: "#FBBF24", topBtn: "#F97316" },
  premium: { body: "#D97706", bodyDark: "#B45309", accent: "#FDE68A", knob: "#F59E0B", topBtn: "#FBBF24" },
};

const CAPSULE_COLORS = ["#F9A8D4", "#93C5FD", "#FDE68A", "#A7F3D0", "#E9D5FF", "#FCA5A5", "#FDBA74", "#F0ABFC"];

const CAPSULE_POSITIONS = [
  { x: 10, y: 8 }, { x: 38, y: 5 }, { x: 66, y: 10 },
  { x: 5, y: 35 }, { x: 33, y: 30 }, { x: 60, y: 38 },
  { x: 15, y: 58 }, { x: 42, y: 55 }, { x: 68, y: 62 },
  { x: 8, y: 80 }, { x: 35, y: 78 }, { x: 62, y: 82 },
];

const SIZES = {
  sm: { w: 80, h: 130, capsule: 14, dotSize: 3, knobSize: 16 },
  md: { w: 150, h: 245, capsule: 22, dotSize: 5, knobSize: 28 },
  lg: { w: 210, h: 340, capsule: 30, dotSize: 7, knobSize: 38 },
};

export default function GachaMachineVisual({ theme = "default", size = "md", spinning = false, onKnobClick, className = "" }: Props) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.default;
  const s = SIZES[size];
  const capsuleCount = size === "sm" ? 6 : size === "md" ? 9 : 12;
  const dotCount = size === "sm" ? 8 : size === "md" ? 14 : 18;
  const border = size === "sm" ? 2 : 3;

  const windowW = s.w * 0.78;
  const windowH = s.h * 0.48;
  const bodyH = s.h * 0.3;
  const baseH = s.h * 0.045;
  const topBtnSize = size === "sm" ? 10 : size === "md" ? 18 : 24;

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`} style={{ width: s.w, height: s.h }}>

      {/* Top button */}
      <div
        className="relative z-10 rounded-full"
        style={{
          width: topBtnSize,
          height: topBtnSize,
          background: colors.topBtn,
          border: `${border}px solid ${colors.bodyDark}`,
          marginBottom: -topBtnSize * 0.35,
          boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)`,
        }}
      />

      {/* Main frame */}
      <div
        className="relative flex flex-col items-center overflow-hidden"
        style={{
          width: s.w,
          borderRadius: s.w * 0.06,
          background: colors.body,
          border: `${border}px solid ${colors.bodyDark}`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.25)`,
        }}
      >
        {/* Glass window area */}
        <div className="flex items-center justify-center" style={{ padding: s.w * 0.06, paddingBottom: 0 }}>
          <div
            className="relative overflow-hidden"
            style={{
              width: windowW,
              height: windowH,
              borderRadius: s.w * 0.05,
              background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,245,255,0.9) 100%)",
              border: `${border}px solid ${colors.bodyDark}`,
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            {/* Capsules */}
            {CAPSULE_POSITIONS.slice(0, capsuleCount).map((pos, i) => {
              const color = CAPSULE_COLORS[i % CAPSULE_COLORS.length];
              return (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    width: s.capsule,
                    height: s.capsule,
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    borderRadius: "50%",
                    background: color,
                    border: `${Math.max(1, border - 1)}px solid rgba(0,0,0,0.12)`,
                    boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.1)`,
                  }}
                  animate={spinning ? {
                    y: [0, 4, -3, 5, -2, 0],
                    x: [0, -3, 4, -2, 3, 0],
                    rotate: [0, 8, -5, 10, -3, 0],
                  } : {}}
                  transition={spinning ? { duration: 0.7, repeat: Infinity, delay: i * 0.06 } : {}}
                >
                  {/* Split line */}
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: "48%",
                      height: Math.max(1, border - 1),
                      background: "rgba(0,0,0,0.15)",
                    }}
                  />
                </motion.div>
              );
            })}

            {/* Glass reflection */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.1) 100%)",
                borderRadius: s.w * 0.05,
              }}
            />
          </div>
        </div>

        {/* Decorative dot strip */}
        <div
          className="flex items-center justify-center gap-0.5"
          style={{
            width: windowW,
            padding: `${s.h * 0.02}px 0`,
          }}
        >
          {Array.from({ length: dotCount }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: s.dotSize,
                height: s.dotSize,
                background: colors.accent,
                border: `1px solid ${colors.bodyDark}`,
                opacity: 0.9,
              }}
            />
          ))}
        </div>

        {/* Lower body — knob + slot */}
        <div
          className="flex items-center justify-between w-full px-3"
          style={{
            height: bodyH,
            paddingLeft: s.w * 0.08,
            paddingRight: s.w * 0.08,
          }}
        >
          {/* Dispensing slot (left side) */}
          <div className="flex flex-col items-center gap-1">
            <div
              style={{
                width: s.w * 0.3,
                height: bodyH * 0.5,
                background: "#1a1a1a",
                borderRadius: s.w * 0.03,
                border: `${border}px solid ${colors.bodyDark}`,
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: "radial-gradient(ellipse, #222, #111)",
                  borderRadius: s.w * 0.02,
                }}
              />
            </div>
          </div>

          {/* Knob (right side) */}
          <div className="flex flex-col items-center">
            {/* Knob arm */}
            <div
              style={{
                width: s.knobSize * 1.2,
                height: Math.max(3, border),
                background: colors.bodyDark,
                borderRadius: 2,
                marginBottom: -1,
              }}
            />
            <motion.button
              onClick={onKnobClick}
              className="relative cursor-pointer z-10"
              style={{
                width: s.knobSize,
                height: s.knobSize,
                borderRadius: "50%",
                background: `radial-gradient(circle at 40% 35%, ${colors.knob}, ${colors.knob}cc)`,
                border: `${border}px solid ${colors.bodyDark}`,
                boxShadow: `0 2px 6px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.35)`,
              }}
              animate={spinning ? { rotate: 360 } : {}}
              transition={spinning ? { duration: 0.8, ease: "easeInOut" } : {}}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
            >
              {/* Knob cross */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ width: "45%", height: Math.max(1, border - 1), background: "rgba(0,0,0,0.25)", borderRadius: 1 }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ width: Math.max(1, border - 1), height: "45%", background: "rgba(0,0,0,0.25)", borderRadius: 1 }} />
              </div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Golden base */}
      <div
        style={{
          width: s.w * 1.05,
          height: baseH,
          background: `linear-gradient(180deg, ${colors.accent}, ${colors.knob})`,
          borderRadius: `0 0 ${s.w * 0.04}px ${s.w * 0.04}px`,
          border: `${border}px solid ${colors.bodyDark}`,
          borderTop: "none",
          boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
        }}
      />

      {/* Spinning glow */}
      {spinning && (
        <motion.div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2"
          style={{
            width: s.w * 0.6,
            height: 8,
            borderRadius: "50%",
            background: colors.body,
            filter: "blur(10px)",
          }}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </div>
  );
}
