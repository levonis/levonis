import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Bounds,
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  PerspectiveCamera,
  useBounds,
} from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import { loadModelFromFile, computeBoundsMM, fetchModelAsFile } from "./loaders";
import ViewerToolbar from "./ViewerToolbar";
import BuildPlate from "./BuildPlate";
import { applyOverhangColors, applyExploded, autoOrient, applyDecimation } from "./analysisHelpers";

interface Props {
  file?: File | null;
  /** Optional direct URL to a .stl/.3mf/.obj/.glb/.gltf — fetched via proxy edge function. */
  url?: string | null;
  className?: string;
  language?: "ar" | "en" | "ku";
}

/** Imperatively expose Canvas gl for screenshots */
function GLBridge({ onReady }: { onReady: (gl: THREE.WebGLRenderer) => void }) {
  const { gl } = useThree();
  useEffect(() => { onReady(gl); }, [gl, onReady]);
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
  overhang,
  explode,
  clippingPlane,
}: {
  group: THREE.Group;
  wireframe: boolean;
  showBBox: boolean;
  overhang: boolean;
  explode: number;
  clippingPlane: THREE.Plane | null;
}) {
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    group.traverse((c: any) => {
      if (c.isMesh) {
        if (!c.userData._mat) {
          c.userData._mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#9ec5ff"),
            metalness: 0.1,
            roughness: 0.55,
            flatShading: false,
            side: THREE.DoubleSide,
          });
        }
        const m: THREE.MeshStandardMaterial = c.userData._mat;
        m.wireframe = wireframe;
        m.clippingPlanes = clippingPlane ? [clippingPlane] : [];
        m.clipShadows = true;
        m.needsUpdate = true;
        c.material = m;
      }
    });
  }, [group, wireframe, clippingPlane]);

  useEffect(() => { applyOverhangColors(group, overhang); }, [group, overhang]);
  useEffect(() => { applyExploded(group, explode); }, [group, explode]);

  return (
    <group ref={ref}>
      <primitive object={group} />
      {showBBox && <BBoxHelper object={group} dep={`${overhang}-${explode}`} />}
    </group>
  );
}

function BBoxHelper({ object, dep }: { object: THREE.Object3D; dep: string }) {
  const helper = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    const h = new THREE.Box3Helper(box, new THREE.Color("#22d3ee"));
    (h.material as THREE.LineBasicMaterial).transparent = true;
    (h.material as THREE.LineBasicMaterial).opacity = 0.8;
    return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, dep]);
  return <primitive object={helper} />;
}

export default function Model3DViewer({ file, url, className, language = "en" }: Props) {
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
  const [overhang, setOverhang] = useState(false);
  const [explode, setExplode] = useState(0);
  const [layerCut, setLayerCut] = useState(0); // 0..100 (% from top to hide)
  const [decimate, setDecimate] = useState(false);
  const [decimating, setDecimating] = useState(false);

  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const sourceName = file?.name || url?.split("/").pop() || "model";

  // Single clipping plane that cuts horizontally at layerCut % of model height.
  const clippingPlane = useMemo(() => {
    if (!dims || layerCut <= 0) return null;
    const topY = dims.y * (1 - layerCut / 100);
    // Plane equation: normal · p + constant >= 0 keeps fragments. Normal (0,-1,0) keeps y <= topY.
    return new THREE.Plane(new THREE.Vector3(0, -1, 0), topY);
  }, [dims, layerCut]);

  // Re-apply decimation toggle.
  useEffect(() => {
    if (!group) return;
    setDecimating(true);
    applyDecimation(group, decimate, 0.4)
      .finally(() => setDecimating(false));
  }, [group, decimate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    setGroup(null);

    const loadIt = async (): Promise<File | null> => {
      if (file) return file;
      if (url) {
        const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
        return await fetchModelAsFile(url, supabaseUrl);
      }
      return null;
    };

    loadIt()
      .then(async (f) => {
        if (!f) { if (!cancelled) { setLoading(false); setLoadErr(t("لا يوجد ملف", "No file")); } return; }
        const g = await loadModelFromFile(f);
        if (cancelled) return;
        const ext = f.name.toLowerCase().match(/\.(stl|3mf|obj|glb|gltf)$/)?.[1];
        if (ext === "stl" || ext === "3mf") g.rotation.x = -Math.PI / 2;
        g.updateMatrixWorld(true);
        const { size, center, box } = computeBoundsMM(g);
        g.position.x -= center.x;
        g.position.z -= center.z;
        g.position.y -= box.min.y;
        setDims({ x: size.x, y: size.y, z: size.z });
        setGroup(g);
        setFitTrigger((tg) => tg + 1);
      })
      .catch((e) => !cancelled && setLoadErr(e?.message || "Load failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [file, url]);

  const onScreenshot = () => {
    const gl = glRef.current;
    if (!gl) return;
    const u = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = u;
    a.download = `${sourceName.replace(/\.[^.]+$/, "")}-preview.png`;
    a.click();
  };

  const onResetView = () => setFitTrigger((tg) => tg + 1);

  const onAutoOrient = () => {
    if (!group) return;
    const best = autoOrient(group);
    group.rotation.copy(best);
    group.updateMatrixWorld(true);
    // Reseat on plate
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3(); box.getCenter(center);
    group.position.x -= center.x - group.position.x;
    group.position.z -= center.z - group.position.z;
    group.position.y -= box.min.y;
    if (overhang) applyOverhangColors(group, true);
    setFitTrigger((tg) => tg + 1);
  };

  const dimsLabel = dims
    ? `${dims.x.toFixed(1)} × ${dims.y.toFixed(1)} × ${dims.z.toFixed(1)} mm`
    : "—";

  return (
    <div className={`relative w-full h-full bg-[#05070d] ${className || ""}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true, localClippingEnabled: true }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
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
            <ModelMesh
              group={group}
              wireframe={wireframe}
              showBBox={showBBox}
              overhang={overhang}
              explode={explode}
              clippingPlane={clippingPlane}
            />
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
          overhang={overhang}
          explode={explode}
          layerCut={layerCut}
          decimate={decimate}
          decimating={decimating}
          onWireframe={setWireframe}
          onAutoRotate={setAutoRotate}
          onBBox={setShowBBox}
          onPlate={setShowPlate}
          onOverhang={setOverhang}
          onExplode={setExplode}
          onLayerCut={setLayerCut}
          onDecimate={setDecimate}
          onAutoOrient={onAutoOrient}
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
