import * as THREE from "three";
import { STLLoader } from "three-stdlib";
import { OBJLoader } from "three-stdlib";
import { ThreeMFLoader } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";

export type SupportedExt = "stl" | "obj" | "3mf" | "glb" | "gltf";

export function getExt(name: string): SupportedExt | null {
  const m = name.toLowerCase().match(/\.(stl|obj|3mf|glb|gltf)$/);
  return (m?.[1] as SupportedExt) ?? null;
}

/** Load a File into a THREE.Group; consumer disposes. */
export async function loadModelFromFile(file: File): Promise<THREE.Group> {
  const ext = getExt(file.name);
  if (!ext) throw new Error("Unsupported file extension");
  const buf = await file.arrayBuffer();
  const group = new THREE.Group();

  if (ext === "stl") {
    const geom = new STLLoader().parse(buf);
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  } else if (ext === "obj") {
    const text = new TextDecoder().decode(buf);
    const obj = new OBJLoader().parse(text);
    obj.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        if (c.geometry && !c.geometry.attributes.normal) c.geometry.computeVertexNormals();
      }
    });
    group.add(obj);
  } else if (ext === "3mf") {
    const parsed = new ThreeMFLoader().parse(buf);
    parsed.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    group.add(parsed);
  } else {
    // glb / gltf
    const loader = new GLTFLoader();
    const gltf: any = await new Promise((resolve, reject) =>
      loader.parse(buf, "", resolve as any, reject as any),
    );
    gltf.scene.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    group.add(gltf.scene);
  }

  return group;
}

/** Compute bounding box dimensions in mm assuming the file unit is mm (true for STL/3MF). */
export function computeBoundsMM(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return { box, size, center };
}
