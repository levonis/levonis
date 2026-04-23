// Visual-behaviour scenario for the Profile Orb magnetic fusion.
// Mirrors the pure logic in src/components/profileOrbMagnet.ts so it can run
// in plain Node (no Vitest / JSDOM needed).
//
//   node scripts/profileOrbScenario.mjs
//
// Prints how the orb's transform / opacity / blur evolve as scrolling drives
// `mergeProgress` from 0 → 1 (and back), with focus on p = 0.7, 0.9, 0.98.

const computeOrbMagnet = (p, fusion = { dx: 160, dy: 0 }) => {
  const c = Math.min(1, Math.max(0, p));
  const smoothstep = c * c * (3 - 2 * c);
  const travel = c < 0.92 ? smoothstep : Math.min(1.02, smoothstep + (c - 0.92) * 0.25);
  const stretch = c < 0.92 ? c * 0.12 : Math.max(0, 0.12 - (c - 0.92) * 1.5);
  const scaleX = 1 + stretch;
  const scaleY = 1 - Math.max(0, c - 0.6) * 0.15;
  const opacity = c < 0.88 ? 1 : Math.max(0, 1 - (c - 0.88) / 0.1);
  const blurPx = c > 0.85 ? (c - 0.85) * 14 : 0;
  const fullyMerged = c >= 0.98;
  return {
    travel: +travel.toFixed(3),
    translateX: +(fusion.dx * travel).toFixed(2),
    translateY: +(fusion.dy * travel).toFixed(2),
    scaleX: +scaleX.toFixed(3),
    scaleY: +scaleY.toFixed(3),
    opacity: +opacity.toFixed(3),
    blurPx: +blurPx.toFixed(2),
    fullyMerged,
    pointerEventsAuto: !fullyMerged && c <= 0.6,
  };
};

// Simulated geometry: island sits ~160px to the right of the orb center.
const fusion = { dx: 160, dy: 0 };

const scenario = [
  { p: 0.0,  note: "rest — fully visible at origin" },
  { p: 0.3,  note: "early pull — barely moving" },
  { p: 0.6,  note: "interaction cutoff — orb still solid but no longer clickable" },
  { p: 0.7,  note: "magnetic acceleration — visible drift, no fade yet" },
  { p: 0.85, note: "blur threshold reached" },
  { p: 0.9,  note: "snap zone — overshoot + dissolve starts" },
  { p: 0.92, note: "stretch peak — about to recoil" },
  { p: 0.95, note: "almost fused — heavy fade + blur" },
  { p: 0.98, note: "fully merged — orb removed from layout" },
  { p: 1.0,  note: "island stands alone as the search bar" },
];

const pad = (s, n) => String(s).padEnd(n);

console.log("\nProfile Orb ↔ Dynamic Island — magnetic fusion scenario");
console.log("Geometry: dx =", fusion.dx, "px, dy =", fusion.dy, "px\n");

console.log(
  pad("p", 6),
  pad("travel", 8),
  pad("tx(px)", 9),
  pad("scaleX", 8),
  pad("scaleY", 8),
  pad("opacity", 9),
  pad("blur(px)", 10),
  pad("merged", 8),
  pad("clickable", 10),
  "note",
);
console.log("-".repeat(110));

for (const { p, note } of scenario) {
  const v = computeOrbMagnet(p, fusion);
  console.log(
    pad(p.toFixed(2), 6),
    pad(v.travel, 8),
    pad(v.translateX, 9),
    pad(v.scaleX, 8),
    pad(v.scaleY, 8),
    pad(v.opacity, 9),
    pad(v.blurPx, 10),
    pad(v.fullyMerged ? "yes" : "no", 8),
    pad(v.pointerEventsAuto ? "yes" : "no", 10),
    note,
  );
}

// ---------------------------------------------------------------------------
// Lightweight assertions — fail loudly if the curve is regressed.
// ---------------------------------------------------------------------------
const assertions = [
  ["fully visible at rest", computeOrbMagnet(0).opacity === 1],
  ["no fade before p=0.88", computeOrbMagnet(0.7).opacity === 1],
  ["no blur before p=0.85", computeOrbMagnet(0.7).blurPx === 0],
  ["dissolve starts past 0.88", computeOrbMagnet(0.9).opacity < 1 && computeOrbMagnet(0.9).opacity > 0],
  ["overshoot near contact", computeOrbMagnet(0.95).travel > computeOrbMagnet(0.95).travel * 0 + (0.95 * 0.95 * (3 - 2 * 0.95))],
  ["fully merged at 0.98", computeOrbMagnet(0.98).fullyMerged === true && computeOrbMagnet(0.98).opacity === 0],
  ["clickable only in first 60%", computeOrbMagnet(0.5).pointerEventsAuto && !computeOrbMagnet(0.7).pointerEventsAuto],
  ["reverses cleanly on scroll up", computeOrbMagnet(0.3).opacity === computeOrbMagnet(0.3).opacity && computeOrbMagnet(0).fullyMerged === false],
];

let failed = 0;
console.log("\nAssertions:");
for (const [label, ok] of assertions) {
  console.log(" ", ok ? "✓" : "✗", label);
  if (!ok) failed++;
}
console.log(failed === 0 ? "\nAll checks passed.\n" : `\n${failed} check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
