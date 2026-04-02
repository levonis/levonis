import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import StackScene from "./StackScene";
import * as THREE from "three";

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
  onScoreUpdate?: (score: number, combo: number, perfectCount: number) => void;
  speedMultiplier?: number;
  autoPlay?: boolean;
}

export default function StackGameCanvas({ onGameOver, onScoreUpdate, speedMultiplier, autoPlay }: Props) {
  return (
    <Canvas
      shadows
      orthographic
      camera={{
        position: [2, 5, 2],
        zoom: 40,
        near: -100,
        far: 200,
      }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#000000"]} />
      <Suspense fallback={null}>
        <StackScene
          onGameOver={onGameOver}
          onScoreUpdate={onScoreUpdate}
          speedMultiplier={speedMultiplier}
          autoPlay={autoPlay}
        />
      </Suspense>
    </Canvas>
  );
}
