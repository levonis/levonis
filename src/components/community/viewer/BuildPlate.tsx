import { Grid } from "@react-three/drei";

interface Props {
  sizeMM?: number;
}

/** 3D printer bed grid. Scene unit = 1mm. */
export default function BuildPlate({ sizeMM = 256 }: Props) {
  return (
    <group position={[0, -0.01, 0]}>
      <Grid
        args={[sizeMM, sizeMM]}
        cellSize={10}
        cellThickness={0.6}
        cellColor="#6b7280"
        sectionSize={50}
        sectionThickness={1.2}
        sectionColor="#3b82f6"
        fadeDistance={sizeMM * 2}
        fadeStrength={1.2}
        infiniteGrid={false}
        followCamera={false}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[sizeMM, sizeMM]} />
        <meshStandardMaterial color="#0b1220" roughness={0.95} metalness={0.05} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
