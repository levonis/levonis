import * as THREE from "three";

/** Highlight (or restore) overhang faces with vertex colors.
 *  Face is "overhang" when its world-space normal.y < -sin(thresholdDeg). */
export function applyOverhangColors(
  group: THREE.Object3D,
  enabled: boolean,
  thresholdDeg = 45,
) {
  const limit = -Math.sin((thresholdDeg * Math.PI) / 180);
  const safeColor = new THREE.Color("#9ec5ff");
  const hotColor = new THREE.Color("#ef4444");

  group.updateMatrixWorld(true);
  group.traverse((c: any) => {
    if (!c.isMesh) return;
    const geom: THREE.BufferGeometry = c.geometry;
    const mat: THREE.MeshStandardMaterial = c.material;
    if (!geom?.attributes?.position) return;

    if (!enabled) {
      if (geom.attributes.color) {
        geom.deleteAttribute("color");
      }
      mat.vertexColors = false;
      mat.needsUpdate = true;
      return;
    }

    const pos = geom.attributes.position as THREE.BufferAttribute;
    const vCount = pos.count;
    const colors = new Float32Array(vCount * 3);
    const tri = new THREE.Triangle();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const cc = new THREE.Vector3();
    const n = new THREE.Vector3();
    const worldM = c.matrixWorld;

    const writeTri = (i0: number, i1: number, i2: number) => {
      a.fromBufferAttribute(pos, i0).applyMatrix4(worldM);
      b.fromBufferAttribute(pos, i1).applyMatrix4(worldM);
      cc.fromBufferAttribute(pos, i2).applyMatrix4(worldM);
      tri.set(a, b, cc);
      tri.getNormal(n);
      const col = n.y < limit ? hotColor : safeColor;
      for (const idx of [i0, i1, i2]) {
        colors[idx * 3] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
      }
    };

    const index = geom.index;
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        writeTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
      }
    } else {
      for (let i = 0; i < vCount; i += 3) writeTri(i, i + 1, i + 2);
    }

    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mat.vertexColors = true;
    mat.needsUpdate = true;
  });
}

/** Exploded view: push every mesh child away from the group's center by `amount` mm. */
export function applyExploded(group: THREE.Object3D, amount: number) {
  const center = new THREE.Vector3();
  new THREE.Box3().setFromObject(group).getCenter(center);
  group.traverse((c: any) => {
    if (!c.isMesh) return;
    if (!c.userData._homePos) c.userData._homePos = c.position.clone();
    const home: THREE.Vector3 = c.userData._homePos;
    const meshCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(c).getCenter(meshCenter);
    const dir = meshCenter.sub(center);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();
    c.position.copy(home).addScaledVector(dir, amount);
  });
}

/** Try 6 axis-aligned orientations and pick the one with smallest overhang area. */
export function autoOrient(group: THREE.Object3D): THREE.Euler {
  const rotations: THREE.Euler[] = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(Math.PI, 0, 0),
    new THREE.Euler(Math.PI / 2, 0, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    new THREE.Euler(0, 0, Math.PI / 2),
    new THREE.Euler(0, 0, -Math.PI / 2),
  ];
  const origRot = group.rotation.clone();
  let best = origRot;
  let bestScore = Infinity;
  const limit = -Math.sin((45 * Math.PI) / 180);

  for (const r of rotations) {
    group.rotation.copy(r);
    group.updateMatrixWorld(true);
    let overhang = 0;
    let total = 0;
    group.traverse((c: any) => {
      if (!c.isMesh) return;
      const geom: THREE.BufferGeometry = c.geometry;
      const pos = geom.attributes.position as THREE.BufferAttribute;
      const idx = geom.index;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), n = new THREE.Vector3();
      const tri = new THREE.Triangle();
      const m = c.matrixWorld;
      const count = idx ? idx.count : pos.count;
      for (let i = 0; i < count; i += 3) {
        const i0 = idx ? idx.getX(i) : i;
        const i1 = idx ? idx.getX(i + 1) : i + 1;
        const i2 = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m);
        cc.fromBufferAttribute(pos, i2).applyMatrix4(m);
        tri.set(a, b, cc);
        const area = tri.getArea();
        tri.getNormal(n);
        total += area;
        if (n.y < limit) overhang += area;
      }
    });
    const score = total > 0 ? overhang / total : Infinity;
    if (score < bestScore) { bestScore = score; best = r.clone(); }
  }
  group.rotation.copy(origRot);
  return best;
}

/** Decimate every mesh geometry in-place to ~ratio (0..1) of original triangle count.
 *  Uses three-stdlib SimplifyModifier. Stores original geometry on userData for restore. */
export async function applyDecimation(group: THREE.Object3D, enabled: boolean, ratio = 0.5) {
  const { SimplifyModifier } = await import("three-stdlib");
  const mod = new SimplifyModifier();
  group.traverse((c: any) => {
    if (!c.isMesh) return;
    if (!c.userData._origGeom) c.userData._origGeom = c.geometry;
    const orig: THREE.BufferGeometry = c.userData._origGeom;
    if (!enabled) {
      if (c.geometry !== orig) c.geometry.dispose?.();
      c.geometry = orig;
      return;
    }
    try {
      const triCount = (orig.index ? orig.index.count : orig.attributes.position.count) / 3;
      const targetRemove = Math.max(0, Math.floor(triCount * (1 - ratio) * 3));
      if (targetRemove <= 0) return;
      const simplified = mod.modify(orig, targetRemove);
      simplified.computeVertexNormals();
      if (c.geometry !== orig) c.geometry.dispose?.();
      c.geometry = simplified;
    } catch (e) {
      // Skip meshes that can't be simplified.
      console.warn("[viewer] decimation failed for mesh", e);
    }
  });
}
