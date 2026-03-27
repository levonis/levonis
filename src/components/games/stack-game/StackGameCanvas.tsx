import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import StackScene from "./StackScene";

interface Props {
  onGameOver: (score: number, perfects: number, maxCombo: number) => void;
}

export default function StackGameCanvas({ onGameOver }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [3.5, 7, 3.5], fov: 45 }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      gl={{ antialias: true, alpha: false, toneMapping: 3 }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={["#0f0a1e"]} />
      <Suspense fallback={null}>
        <StackScene onGameOver={onGameOver} />
      </Suspense>
    </Canvas>
  );
}
