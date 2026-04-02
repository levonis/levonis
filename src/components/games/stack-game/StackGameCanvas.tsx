import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import StackScene, { GameScoreSettings } from "./StackScene";
import * as THREE from "three";

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
  onScoreUpdate?: (score: number, combo: number, perfectCount: number) => void;
  scoreSettings?: GameScoreSettings;
}

export default function StackGameCanvas({ onGameOver, onScoreUpdate, scoreSettings }: Props) {
  return (
    <Canvas
      shadows
      orthographic
      camera={{ position: [-2, 2, -2], zoom: 80, near: -500, far: 500 }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={["#000000"]} />
      <Suspense fallback={null}>
        <StackScene
          onGameOver={onGameOver}
          onScoreUpdate={onScoreUpdate}
          scoreSettings={scoreSettings}
        />
      </Suspense>
    </Canvas>
  );
}
