// @ts-nocheck
import { useCallback, useState, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ModelsProvider } from "./CrossyRoadModels";
import CrossyRoad3DScene from "./CrossyRoad3DScene";

interface Props {
  onGameOver: (score: number, steps: number, coins: number) => void;
  onScoreUpdate: (score: number, steps: number, coins: number) => void;
  scoreSettings?: { points_per_step: number; bonus_coin_points: number };
}

function useResponsiveZoom() {
  const [zoom, setZoom] = useState(() => computeZoom());

  useEffect(() => {
    const update = () => setZoom(computeZoom());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return zoom;
}

function computeZoom() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isMobile = w < h;

  if (isMobile) {
    // Mobile (Portrait): Scale off width so the 9 lanes fit exactly, with a slight margin.
    const zoomFromW = w / 11; 
    const zoomFromH = h / 16;
    // Bound the zoom so it never gets microscopic on small phones
    return Math.max(36, Math.min(65, Math.min(zoomFromW, zoomFromH)));
  }

  // Desktop / Tablet (Landscape): 
  // We DO NOT want to scale directly with screen width! If we do, a 4K or Ultrawide
  // monitor will blow the game up until the chicken is the size of a dinner plate.
  // Instead, we scale purely off height. Let's aim to comfortably fit ~14 units vertically.
  const z = h / 14; 
  
  // Bound the desktop zoom so it stays comfortable
  return Math.max(45, Math.min(100, z));
}

export default function CrossyRoadCanvas({ onGameOver, onScoreUpdate, scoreSettings }: Props) {
  const [loaded, setLoaded] = useState(false);
  const handleLoaded = useCallback(() => setLoaded(true), []);
  const zoom = useResponsiveZoom();

  return (
    <div style={{ width: "100vw", height: "100dvh", position: "fixed", top: 0, left: 0, background: "#000" }}>
      {!loaded && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#000",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🐔</div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem" }}>
              جاري تحميل اللعبة...
            </p>
          </div>
        </div>
      )}
      <Canvas
        orthographic
        camera={{
          zoom,
          position: [4.5, 12, 8],
          near: -100,
          far: 100,
        }}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ camera }) => {
          camera.lookAt(4.5, 0, -2);
        }}
      >
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow={false} />
        <directionalLight position={[-3, 8, -3]} intensity={0.3} />
        <Suspense fallback={null}>
          <ModelsProvider onLoaded={handleLoaded}>
            <CrossyRoad3DScene
              onGameOver={onGameOver}
              onScoreUpdate={onScoreUpdate}
            />
          </ModelsProvider>
        </Suspense>
      </Canvas>
    </div>
  );
}
