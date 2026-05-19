import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Bounds,
  Center,
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  PerspectiveCamera,
  useBounds,
} from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import { loadModelFromFile, computeBoundsMM } from "./loaders";
import ViewerToolbar from "./ViewerToolbar";
import BuildPlate from "./BuildPlate";

interface Props {
  file: File;
  className?: string;
  language?: "ar" | "en" | "ku";
}

/** Imperatively expose Canvas gl for screenshots */
function GLBridge({ onReady }: { onReady: (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => { onReady(gl, scene, camera); }, [gl, scene, camera, onReady]);
  return null;
}

function FitOnLoad({ trigger }: { trigger: number }) {
  const api = useBounds();
  useEffect(() => {
    if (trigger > 0) api.refresh().clip().fit();
  }, [trigger, api]);
  return null;
}

function ModelMesh({
  group,
  wireframe,
  showBBox,
}: {
  group: THREE.Group;
  wireframe: boolean;
  showBBox: boolean;
}) {
  const ref = useRef<THREE.Group>(null);

  // Apply material/wireframe to all meshes
  useEffect(() => {
    group.traverse((c: any) => {
      if (c.isMesh) {
        if (!c.userData._origMat) c.userData._origMat = c.material;
        const base = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#9ec5ff"),
          metalness: 0.1,
          roughness: 0.55,
          wireframe,
          flatShading: false,
        });
        c.material = base;
      }
    });
  }, [group, wireframe]);

  return (
    <group ref={ref}>
      <primitive object={group} />
      {showBBox && <BBoxHelper object={group} />}
    </group>
  );
}

function BBoxHelper({ object }: { object: THREE.Object3D }) {
  const helper = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    const h = new THREE.Box3Helper(box, new THREE.Color("#22d3ee"));
    (h.material as THREE.LineBasicMaterial).transparent = true;
    (h.material as THREE.LineBasicMaterial).opacity = 0.8;
    return h;
  }, [object]);
  return <primitive object={helper} />;
}

export default function Model3DViewer({ file, className, language = "en" }: Props) {
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [dims, setDims] = useState<{ x: number; y: number; z: number } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);

  // Toolbar state
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showBBox, setShowBBox] = useState(true);
  const [showPlate, setShowPlate] = useState(true);

  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    loadModelFromFile(file)
      .then((g) => {
        if (cancelled) return;
        // Re-orient: model on bed (Z-up in slicer space, but THREE is Y-up; STL is usually Z-up).
        // Rotate so Z becomes Y for STL/3MF; OBJ/GLB typically already Y-up.
        const ext = file.name.toLowerCase().split(".").pop();
        if (ext === "stl" || ext === "3mf") {
          g.rotation.x = -Math.PI / 2;
        }
        g.updateMatrixWorld(true);
        const { size, center, box } = computeBoundsMM(g);
        // Recenter on XZ, sit on plate (min Y = 0)
        g.position.x -= center.x;
        g.position.z -= center.z;
        g.position.y -= box.min.y;
        setDims({ x: size.x, y: size.y, z: size.z });
        setGroup(g);
        setFitTrigger((t) => t + 1);
      })
      .catch((e) => !cancelled && setLoadErr(e?.message || "Load failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [file]);

  const onScreenshot = () => {
    const gl = glRef.current;
    if (!gl) return;
    const url = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name.replace(/\.[^.]+$/, "")}-preview.png`;
    a.click();
  };

  const onResetView = () => setFitTrigger((t) => t + 1);

  // Dimensions display: STL/3MF are in mm; for OBJ/GLB unit may differ, but we show as mm best-effort
  const dimsLabel = dims
    ? `${dims.x.toFixed(1)} × ${dims.y.toFixed(1)} × ${dims.z.toFixed(1)} mm`
    : "—";

  return (
    <div className={`relative w-full h-full bg-[#05070d] ${className || ""}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        style={{ background: "linear-gradient(180deg, #0b1220 0%, #05070d 100%)" }}
      >
        <PerspectiveCamera makeDefault position={[300, 250, 350]} fov={40} near={0.1} far={5000} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[200, 400, 200]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={1500}
          shadow-camera-left={-400}
          shadow-camera-right={400}
          shadow-camera-top={400}
          shadow-camera-bottom={-400}
        />

        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        {showPlate && <BuildPlate sizeMM={256} />}

        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.55}
          scale={400}
          blur={2.4}
          far={200}
          resolution={1024}
        />

        <Bounds margin={1.4}>
          <FitOnLoad trigger={fitTrigger} />
          {group && (
            <ModelMesh group={group} wireframe={wireframe} showBBox={showBBox} />
          )}
        </Bounds>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={20}
          maxDistance={2000}
          target={[0, 50, 0]}
        />

        <GLBridge onReady={(gl) => { glRef.current = gl; }} />

        {(loading || loadErr) && (
          <Html center>
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-foreground flex items-center gap-2">
              {loading && !loadErr && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{t("جاري تحميل النموذج…", "Loading model…")}</span>
                </>
              )}
              {loadErr && <span className="text-destructive">{loadErr}</span>}
            </div>
          </Html>
        )}
      </Canvas>

      {/* Top toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <ViewerToolbar
          wireframe={wireframe}
          autoRotate={autoRotate}
          showBBox={showBBox}
          showPlate={showPlate}
          onWireframe={setWireframe}
          onAutoRotate={setAutoRotate}
          onBBox={setShowBBox}
          onPlate={setShowPlate}
          onScreenshot={onScreenshot}
          onReset={onResetView}
          language={language}
        />
      </div>

      {/* Bottom dims footer */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <div className="glass-panel rounded-full px-4 py-1.5 text-xs font-mono text-foreground/90 shadow-lg">
          {dimsLabel}
        </div>
      </div>
    </div>
  );
}
