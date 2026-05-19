import * as THREE from "three";
import { STLLoader } from "three-stdlib";
import { OBJLoader } from "three-stdlib";
import { ThreeMFLoader } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";

export type SupportedExt = "stl" | "obj" | "3mf" | "glb" | "gltf";

export function getExt(name: string): SupportedExt | null {
  const m = name.toLowerCase().match(/\.(stl|obj|3mf|glb|gltf)(\?.*)?$/);
  return (m?.[1] as SupportedExt) ?? null;
}

/** Load a File into a THREE.Group; consumer disposes. */
export async function loadModelFromFile(file: File): Promise<THREE.Group> {
  return loadModelFromBuffer(await file.arrayBuffer(), file.name);
}

/** Load directly from an ArrayBuffer + filename. */
export async function loadModelFromBuffer(buf: ArrayBuffer, name: string): Promise<THREE.Group> {
  const ext = getExt(name);
  if (!ext) throw new Error("Unsupported file extension");
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

/** Download a remote model file through the proxy edge function and turn it into a File. */
export async function fetchModelAsFile(url: string, supabaseUrl: string): Promise<File> {
  const ext = getExt(url);
  if (!ext) throw new Error("URL must end with .stl/.3mf/.obj/.glb/.gltf");
  const endpoint = `${supabaseUrl}/functions/v1/proxy-download?url=${encodeURIComponent(url)}`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const name = url.split("/").pop()?.split("?")[0] || `model.${ext}`;
  return new File([blob], name, { type: blob.type || "application/octet-stream" });
}
