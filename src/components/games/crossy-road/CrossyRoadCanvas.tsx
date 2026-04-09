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
    <div className="w-full h-full relative bg-black">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="text-4xl mb-4">🐔</div>
            <p className="text-white/70 text-sm animate-pulse">جاري تحميل اللعبة...</p>
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
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ camera }) => {
          camera.lookAt(4.5, 0, -2);
        }}
      >
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={0.8}
          castShadow={false}
        />
        <directionalLight
          position={[-3, 8, -3]}
          intensity={0.3}
        />
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
