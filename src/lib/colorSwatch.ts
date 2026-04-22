// Utility to render a color swatch that can be either a single solid color
// or a multi-color gradient (e.g. Bambu Lab Silk Multi-Color variants).
//
// Accepted hex_code formats:
//   "#RRGGBB"                          → solid color
//   "#RRGGBB,#RRGGBB,#RRGGBB"          → linear gradient
//   "#RRGGBB/#RRGGBB" or " | " etc     → linear gradient
//   "linear-gradient(...)"             → passed through as-is
//
// Returns inline style suitable for a swatch element.

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

export interface SwatchStyleOptions {
  /** Gradient angle in degrees. Default: 135 (top-left → bottom-right). */
  angle?: number;
  /** When true, hard color stops (Bambu-style stripes). Default: false (smooth blend). */
  hardStops?: boolean;
}

export function parseHexColors(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];
  // Already a CSS gradient — caller will handle separately.
  if (/^(linear|radial|conic)-gradient\(/i.test(s)) return [];
  const matches = s.match(HEX_RE);
  if (!matches) {
    // Fallback: maybe a named CSS color
    return [];
  }
  // De-duplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const norm = m.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(m);
    }
  }
  return out;
}

export function getColorSwatchStyle(
  raw: string | null | undefined,
  opts: SwatchStyleOptions = {},
): React.CSSProperties {
  if (!raw) return {};
  const s = String(raw).trim();
  if (!s) return {};

  // Pass-through CSS gradients
  if (/^(linear|radial|conic)-gradient\(/i.test(s)) {
    return { background: s };
  }

  const colors = parseHexColors(s);
  if (colors.length === 0) {
    // Unknown format — let CSS attempt it (e.g. named color)
    return { backgroundColor: s };
  }
  if (colors.length === 1) {
    return { backgroundColor: colors[0] };
  }

  const angle = opts.angle ?? 135;
  if (opts.hardStops) {
    const step = 100 / colors.length;
    const stops = colors
      .map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`)
      .join(', ');
    return { background: `linear-gradient(${angle}deg, ${stops})` };
  }
  return { background: `linear-gradient(${angle}deg, ${colors.join(', ')})` };
}

/** True when the hex value represents a multi-color (gradient) swatch. */
export function isGradientHex(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const s = String(raw).trim();
  if (/^(linear|radial|conic)-gradient\(/i.test(s)) return true;
  return parseHexColors(s).length > 1;
}
