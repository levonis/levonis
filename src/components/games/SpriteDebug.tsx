/** Debug page: test sprite coordinates by rendering individual crops */
import PixelSprite from "./PixelSprite";
import {
  SPRITE_ICONS, SPRITE_BADGES, SPRITE_SPINNERS,
  SPRITE_HEALTH, SPRITE_PROGRESS, SPRITE_INDICATORS,
  SPRITE_FRAMES, SPRITE_SCROLLBARS,
  type SpriteCoords
} from "./SpriteMap";
const sheet00 = '';
const sheet01 = '';
const sheet03 = '';
import { useEffect, useState } from "react";

// Show raw sheet at 1x with hover coordinate display
function SheetViewer({ name, src }: { name: string; src: string }) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ color: "#0f0", fontFamily: "monospace" }}>
        {name} — {dims.w}×{dims.h}px — hover: ({pos.x}, {pos.y})
      </h3>
      <div
        style={{ display: "inline-block", border: "1px solid #444", position: "relative", cursor: "crosshair" }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const scale = 3;
          setPos({
            x: Math.floor((e.clientX - rect.left) / scale),
            y: Math.floor((e.clientY - rect.top) / scale),
          });
        }}
      >
        <img src={src} style={{ imageRendering: "pixelated", display: "block", width: dims.w * 3, height: dims.h * 3 }} />
      </div>
    </div>
  );
}

// Named sprite test
function SpriteTest({ label, sprite, scale = 3 }: { label: string; sprite: SpriteCoords; scale?: number }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 8, gap: 4 }}>
      <div style={{ border: "1px solid #555", background: "#222", padding: 4 }}>
        <PixelSprite sprite={sprite} scale={scale} />
      </div>
      <span style={{ color: "#aaa", fontFamily: "monospace", fontSize: 10 }}>{label}</span>
      <span style={{ color: "#666", fontFamily: "monospace", fontSize: 9 }}>
        {sprite.sheet}@{sprite.x},{sprite.y} {sprite.w}×{sprite.h}
      </span>
    </div>
  );
}

export default function SpriteDebug() {
  return (
    <div style={{ background: "#111", padding: 20, minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontFamily: "monospace", marginBottom: 20 }}>Sprite Coordinate Tester</h1>

      {/* Sheet viewers with hover coordinates */}
      <SheetViewer name="00.png" src={sheet00} />
      <SheetViewer name="01.png" src={sheet01} />
      <SheetViewer name="03.png" src={sheet03} />

      <hr style={{ borderColor: "#333", margin: "32px 0" }} />

      <h2 style={{ color: "#ff0", fontFamily: "monospace" }}>SPRITE_ICONS Tests</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Object.entries(SPRITE_ICONS).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
      </div>

      <h2 style={{ color: "#ff0", fontFamily: "monospace", marginTop: 24 }}>SPRITE_BADGES Tests</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Object.entries(SPRITE_BADGES).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
      </div>

      <h2 style={{ color: "#ff0", fontFamily: "monospace", marginTop: 24 }}>SPRITE_SPINNERS Tests</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Object.entries(SPRITE_SPINNERS).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
      </div>

      <h2 style={{ color: "#ff0", fontFamily: "monospace", marginTop: 24 }}>SPRITE_HEALTH Tests</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Object.entries(SPRITE_HEALTH).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
      </div>

      <h2 style={{ color: "#ff0", fontFamily: "monospace", marginTop: 24 }}>SPRITE_PROGRESS Tests</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Object.entries(SPRITE_PROGRESS).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
      </div>

      <h2 style={{ color: "#ff0", fontFamily: "monospace", marginTop: 24 }}>Other Tests</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Object.entries(SPRITE_INDICATORS).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
        {Object.entries(SPRITE_FRAMES).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
        {Object.entries(SPRITE_SCROLLBARS).map(([k, v]) => (
          <SpriteTest key={k} label={k} sprite={v} />
        ))}
      </div>
    </div>
  );
}
