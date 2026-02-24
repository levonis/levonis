/**
 * GameLevelBadge — Animated pixel-art level badge with tier progression.
 *
 * Tiers:
 *   Bronze   (0–10)   — copper/orange glow
 *   Platinum (11–25)  — silver/white glow
 *   Diamond  (26–30)  — cyan glow
 *   Emerald  (31+)    — green glow
 *
 * Animation sequence:
 *   1. Bar 1 slides in          (0ms)
 *   2. Bar 2 slides in          (300ms)
 *   3. Level number engraves    (600ms)
 *   4. At ≥50% progress: vertical bar + bar 3 merge, number gets engraved into bar 3
 */

import { useEffect, useRef, useState } from "react";
import PixelSprite from "./PixelSprite";
import { SPRITE_BADGES } from "./SpriteMap";
import "./levelBadgeStyles.css";

// ── Tier definitions ──────────────────────────────────────────

type TierKey = "bronze" | "platinum" | "diamond" | "emerald";

interface TierDef {
  key: TierKey;
  label: string;
  /** Primary colour (HSL string for CSS vars) */
  color: string;
  /** Glow colour */
  glow: string;
  /** Gradient stops for bars */
  barGradient: string;
  /** Shield sprite from SpriteMap */
  shield: typeof SPRITE_BADGES.SHIELD_GOLD;
}

const TIERS: TierDef[] = [
  {
    key: "bronze",
    label: "برونزي",
    color: "30 72% 50%",
    glow: "hsla(30, 80%, 50%, 0.5)",
    barGradient: "linear-gradient(90deg, #8B5E3C, #CD7F32, #E8A952)",
    shield: SPRITE_BADGES.SHIELD_BRONZE,
  },
  {
    key: "platinum",
    label: "بلاتيني",
    color: "40 5% 89%",
    glow: "hsla(0, 0%, 90%, 0.45)",
    barGradient: "linear-gradient(90deg, #A8A8AA, #E5E4E2, #F5F5F5)",
    shield: SPRITE_BADGES.SHIELD_SILVER,
  },
  {
    key: "diamond",
    label: "الماسي",
    color: "187 100% 86%",
    glow: "hsla(187, 100%, 75%, 0.5)",
    barGradient: "linear-gradient(90deg, #7ED4E6, #B9F2FF, #E0FBFF)",
    shield: SPRITE_BADGES.SHIELD_BLUE,
  },
  {
    key: "emerald",
    label: "زمردي",
    color: "146 50% 55%",
    glow: "hsla(146, 60%, 50%, 0.5)",
    barGradient: "linear-gradient(90deg, #2E8B57, #50C878, #7DEBA0)",
    shield: SPRITE_BADGES.SHIELD_GREEN,
  },
];

/** Determine tier from level number */
function getTier(level: number): TierDef {
  if (level <= 10) return TIERS[0]; // Bronze
  if (level <= 25) return TIERS[1]; // Platinum
  if (level <= 30) return TIERS[2]; // Diamond
  return TIERS[3];                  // Emerald
}

// ── Size presets ──────────────────────────────────────────────

const SIZE_MAP = {
  sm: { box: 36, shield: 1.2, barH: 3, barW: 18, fontSize: 8, gap: 2 },
  md: { box: 52, shield: 1.6, barH: 4, barW: 26, fontSize: 11, gap: 3 },
  lg: { box: 76, shield: 2.2, barH: 5, barW: 38, fontSize: 15, gap: 4 },
} as const;

// ── Component ─────────────────────────────────────────────────

export interface GameLevelBadgeProps {
  level: number;
  progressPercent: number;   // 0–100
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}

export default function GameLevelBadge({
  level,
  progressPercent,
  size = "md",
  animate = true,
  className = "",
}: GameLevelBadgeProps) {
  const tier = getTier(level);
  const s = SIZE_MAP[size];
  const showBar3 = progressPercent >= 50;

  // Track level changes for burst animation
  const prevLevel = useRef(level);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (prevLevel.current !== level) {
      setBurst(true);
      prevLevel.current = level;
      const t = setTimeout(() => setBurst(false), 550);
      return () => clearTimeout(t);
    }
  }, [level]);

  const barStyle = (delay: number): React.CSSProperties => ({
    width: s.barW,
    height: s.barH,
    borderRadius: 1,
    background: tier.barGradient,
    imageRendering: "pixelated" as const,
    ...(animate
      ? { animationDelay: `${delay}ms` }
      : { transform: "scaleX(1)", opacity: 1 }),
  });

  return (
    <div
      className={`badge-shield ${burst ? "badge-level-up" : ""} ${animate ? "badge-glow" : ""} ${className}`}
      style={{
        "--badge-glow": tier.glow,
        width: s.box,
        height: s.box,
        position: "relative",
        imageRendering: "pixelated",
      } as React.CSSProperties}
      title={`${tier.label} — Lv.${level} (${progressPercent}%)`}
    >
      {/* Shield background */}
      <PixelSprite sprite={tier.shield} scale={s.shield} />

      {/* Overlay: bars + level number */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: s.gap,
          pointerEvents: "none",
        }}
      >
        {/* Bar 1 */}
        <div className={animate ? "badge-bar badge-bar-1" : ""} style={barStyle(0)} />

        {/* Bar 2 */}
        <div className={animate ? "badge-bar badge-bar-2" : ""} style={barStyle(300)} />

        {/* Bar 3 + engraved level (appears at ≥50% progress) */}
        {showBar3 ? (
          <div style={{ position: "relative" }}>
            {/* Vertical bar merging into bar 3 */}
            <div
              className={animate ? "badge-vertical" : ""}
              style={{
                position: "absolute",
                left: "50%",
                top: -(s.barH * 2 + s.gap * 2),
                transform: "translateX(-50%)",
                width: s.barH,
                height: s.barH * 2 + s.gap * 2,
                background: tier.barGradient,
                borderRadius: 1,
                opacity: animate ? undefined : 1,
                imageRendering: "pixelated",
                animationDelay: animate ? "800ms" : undefined,
              }}
            />
            {/* Bar 3 */}
            <div
              className={animate ? "badge-bar-3" : ""}
              style={{
                ...barStyle(1000),
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: s.barH + 4,
                minWidth: s.barW,
              }}
            >
              {/* Engraved level number on bar 3 */}
              <span
                className="badge-engraved"
                style={{
                  fontSize: s.fontSize - 2,
                  lineHeight: 1,
                  fontFamily: "monospace",
                  fontWeight: 900,
                  color: "rgba(0,0,0,0.7)",
                }}
              >
                {level}
              </span>
            </div>
          </div>
        ) : (
          /* Level number (no bar 3 yet) */
          <span
            className={animate ? "badge-level-num" : ""}
            style={{
              fontSize: s.fontSize,
              lineHeight: 1,
              fontFamily: "monospace",
              fontWeight: 900,
              color: `hsl(${tier.color})`,
              textShadow: `0 1px 0 rgba(255,255,255,0.15), 0 -1px 1px rgba(0,0,0,0.6)`,
            }}
          >
            {level}
          </span>
        )}
      </div>
    </div>
  );
}
