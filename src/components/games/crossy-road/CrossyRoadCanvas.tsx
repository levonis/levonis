import { useCallback, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ModelsProvider } from "./CrossyRoadModels";
import CrossyRoad3DScene from "./CrossyRoad3DScene";

interface Props {
  onGameOver: (score: number, steps: number, coins: number) => void;
  onScoreUpdate: (score: number, steps: number, coins: number) => void;
  scoreSettings?: { points_per_step: number; bonus_coin_points: number };
}

export default function CrossyRoadCanvas({ onGameOver, onScoreUpdate, scoreSettings }: Props) {
  const [loaded, setLoaded] = useState(false);
  const handleLoaded = useCallback(() => setLoaded(true), []);

  return (
    <div style={{ width: "100%", height: "100vh", position: "fixed", top: 0, left: 0, background: "#000" }}>
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
          zoom: 50,
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
