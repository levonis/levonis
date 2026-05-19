/// <reference lib="webworker" />
// Real STL / 3MF / OBJ geometry analyzer running in a Web Worker.
// Computes volume, surface area, bounding box, triangle count, complexity,
// non-manifold edges, flipped normals %, overhang %, and min wall thickness
// (BVH-accelerated ray casting on a sampled set of triangles).

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  MeshBVH,
} from 'three-mesh-bvh';
import type { AnalyzeRequest, AnalyzeProgress, ModelMetrics, QualityReport } from '@/lib/modelAnalysis/types';

// Patch three to use BVH for raycasting.
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

const ctx: DedicatedWorkerGlobalScope = self as any;

const post = (msg: AnalyzeProgress) => ctx.postMessage(msg);
const progress = (stage: string, pct: number) => post({ type: 'progress', stage, pct });

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

function mergeGeometries(meshes: THREE.Mesh[]): THREE.BufferGeometry {
  // Bake world transforms into a single non-indexed BufferGeometry of triangles.
  const positions: number[] = [];
  const tmpPos = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true);
    const geom = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!posAttr) continue;
    const index = geom.getIndex();
    const matrix = mesh.matrixWorld;

    if (index) {
      for (let i = 0; i < index.count; i++) {
        const idx = index.getX(i);
        tmpPos.fromBufferAttribute(posAttr, idx).applyMatrix4(matrix);
        positions.push(tmpPos.x, tmpPos.y, tmpPos.z);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        tmpPos.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
        positions.push(tmpPos.x, tmpPos.y, tmpPos.z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

function loadGeometry(req: AnalyzeRequest): THREE.BufferGeometry {
  if (req.fileExt === 'stl') {
    const geom = new STLLoader().parse(req.buffer);
    return geom;
  }
  if (req.fileExt === 'obj') {
    const text = new TextDecoder().decode(req.buffer);
    const group = new OBJLoader().parse(text);
    const meshes = collectMeshes(group);
    if (!meshes.length) throw new Error('OBJ contains no mesh');
    return mergeGeometries(meshes);
  }
  // 3mf
  const group = new ThreeMFLoader().parse(req.buffer);
  const meshes = collectMeshes(group);
  if (!meshes.length) throw new Error('3MF contains no mesh');
  return mergeGeometries(meshes);
}

function ensureNonIndexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.getIndex()) return g.toNonIndexed();
  return g;
}

interface CoreStats {
  volume_mm3: number;
  surface_mm2: number;
  triangle_count: number;
  bbox: { x: number; y: number; z: number };
  overhang_pct: number;
  flipped_pct: number;
  non_manifold_edges: number;
  edge_total: number;
}

function computeCore(geom: THREE.BufferGeometry): CoreStats {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const triCount = pos.count / 3;

  let volume_mm3 = 0;
  let surface_mm2 = 0;
  let overhangs = 0;
  let flipped = 0;

  // Bounding box.
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  // Edge map for non-manifold detection.
  // Quantize coords slightly to avoid float jitter on shared verts.
  const Q = 1e4;
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x * Q)},${Math.round(y * Q)},${Math.round(z * Q)}`;

  const edgeUses = new Map<string, number>();
  const addEdge = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
  ) => {
    const a = key(ax, ay, az);
    const b = key(bx, by, bz);
    const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
    edgeUses.set(ek, (edgeUses.get(ek) ?? 0) + 1);
  };

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n  = new THREE.Vector3();
  const ctr = new THREE.Vector3();
  const outward = new THREE.Vector3();

  const SIN_45 = Math.sin((45 * Math.PI) / 180);

  for (let i = 0; i < triCount; i++) {
    v0.fromBufferAttribute(pos, i * 3 + 0);
    v1.fromBufferAttribute(pos, i * 3 + 1);
    v2.fromBufferAttribute(pos, i * 3 + 2);

    // Signed tetra volume (origin at world origin — bbox center could bias, origin is fine for signed sum).
    volume_mm3 += v0.dot(new THREE.Vector3().crossVectors(v1, v2)) / 6;

    e1.subVectors(v1, v0);
    e2.subVectors(v2, v0);
    n.crossVectors(e1, e2);
    const area = n.length() * 0.5;
    surface_mm2 += area;
    if (area > 0) {
      n.normalize();
      // Overhang: face normal points downward (z < -sin(45))
      if (n.z < -SIN_45) overhangs++;

      // Flipped normal heuristic: normal points toward the model center.
      ctr.set((v0.x + v1.x + v2.x) / 3, (v0.y + v1.y + v2.y) / 3, (v0.z + v1.z + v2.z) / 3);
      outward.subVectors(ctr, center);
      if (outward.lengthSq() > 1e-6) {
        outward.normalize();
        if (n.dot(outward) < -0.1) flipped++;
      }
    }

    addEdge(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z);
    addEdge(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    addEdge(v2.x, v2.y, v2.z, v0.x, v0.y, v0.z);

    if ((i & 8191) === 0) {
      progress('metrics', 20 + Math.floor((i / triCount) * 30));
    }
  }

  let nonManifold = 0;
  for (const c of edgeUses.values()) if (c !== 2) nonManifold++;

  return {
    volume_mm3: Math.abs(volume_mm3),
    surface_mm2,
    triangle_count: triCount,
    bbox: { x: size.x, y: size.y, z: size.z },
    overhang_pct: triCount > 0 ? overhangs / triCount : 0,
    flipped_pct: triCount > 0 ? flipped / triCount : 0,
    non_manifold_edges: nonManifold,
    edge_total: edgeUses.size,
  };
}

function computeMinWallThickness(geom: THREE.BufferGeometry): number | null {
  // BVH accelerated raycasting: from each sampled triangle centroid shoot a ray
  // along the inverse normal and pick the nearest hit. The minimum distance is
  // an approximation of the local wall thickness.
  try {
    const bvh = new MeshBVH(geom);
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const triCount = pos.count / 3;
    if (triCount === 0) return null;

    const SAMPLE = Math.min(500, triCount);
    const stride = Math.max(1, Math.floor(triCount / SAMPLE));

    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();

    let min = Infinity;
    const ray = new THREE.Ray();

    for (let s = 0; s < SAMPLE; s++) {
      const i = s * stride;
      if (i >= triCount) break;
      v0.fromBufferAttribute(pos, i * 3 + 0);
      v1.fromBufferAttribute(pos, i * 3 + 1);
      v2.fromBufferAttribute(pos, i * 3 + 2);
      e1.subVectors(v1, v0);
      e2.subVectors(v2, v0);
      normal.crossVectors(e1, e2);
      if (normal.lengthSq() < 1e-12) continue;
      normal.normalize();
      origin.set((v0.x + v1.x + v2.x) / 3, (v0.y + v1.y + v2.y) / 3, (v0.z + v1.z + v2.z) / 3);
      // Move slightly inside along -normal so we don't hit the same triangle.
      dir.copy(normal).multiplyScalar(-1);
      origin.addScaledVector(dir, 1e-4);
      ray.origin.copy(origin);
      ray.direction.copy(dir);

      const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.distance > 0.05 && hit.distance < min) min = hit.distance;

      if ((s & 31) === 0) progress('wall', 60 + Math.floor((s / SAMPLE) * 25));
    }
    bvh.geometry.disposeBoundsTree?.();
    return Number.isFinite(min) ? min : null;
  } catch (e) {
    console.warn('[wall] failed', e);
    return null;
  }
}

ctx.onmessage = async (ev: MessageEvent<AnalyzeRequest>) => {
  try {
    const req = ev.data;
    progress('hash', 2);
    const fileHash = await sha256Hex(req.buffer);

    progress('parse', 8);
    let geom = loadGeometry(req);
    geom = ensureNonIndexed(geom);

    progress('metrics', 20);
    const core = computeCore(geom);

    progress('wall', 55);
    const min_wall_mm = computeMinWallThickness(geom);

    progress('finalize', 92);

    const volume_cm3 = core.volume_mm3 / 1000;
    const surface_area_cm2 = core.surface_mm2 / 100;

    // Complexity: log-scale triangle count + surface/volume ratio + overhang share.
    const triScore = Math.min(1, Math.log10(Math.max(10, core.triangle_count)) / 6); // 1M tris ≈ 1
    const ratioScore = Math.min(1, surface_area_cm2 / Math.max(0.1, volume_cm3) / 50);
    const overhangScore = Math.min(1, core.overhang_pct * 2);
    const complexity = Math.round((0.5 * triScore + 0.25 * ratioScore + 0.25 * overhangScore) * 100);

    const metrics: ModelMetrics = {
      volume_cm3,
      surface_area_cm2,
      bbox_mm: core.bbox,
      triangle_count: core.triangle_count,
      complexity,
    };

    const quality: QualityReport = {
      non_manifold_edges: core.non_manifold_edges,
      non_manifold_pct: core.edge_total > 0 ? core.non_manifold_edges / core.edge_total : 0,
      flipped_normals_pct: core.flipped_pct,
      overhang_pct: core.overhang_pct,
      min_wall_mm,
      thin_wall_warning: min_wall_mm !== null && min_wall_mm < 0.8,
      support_required: core.overhang_pct > 0.05,
      watertight: core.non_manifold_edges === 0,
    };

    post({ type: 'done', metrics, quality, fileHash });
  } catch (err) {
    post({ type: 'error', message: (err as Error).message || 'Analysis failed' });
  }
};

export {};
