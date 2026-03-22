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
      camera={{ position: [4, 8, 4], fov: 50 }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#1a1a2e"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow shadow-mapSize={1024} />
      <Suspense fallback={null}>
        <StackScene onGameOver={onGameOver} />
      </Suspense>
    </Canvas>
  );
}
