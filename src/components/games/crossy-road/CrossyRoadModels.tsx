import { useEffect, useState, createContext, useContext } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

const BASE = "/games/crossy-road/models";

interface ModelAsset {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
}

export interface GameModels {
  chicken: ModelAsset;
  cars: ModelAsset[];
  trucks: ModelAsset[];
  train: { front: ModelAsset; middle: ModelAsset; back: ModelAsset };
  trees: ModelAsset[];
  logs: ModelAsset[];
  boulder: ModelAsset;
  lilyPad: ModelAsset;
  grass: { obj: ModelAsset; darkTex: THREE.Texture; lightTex: THREE.Texture };
  road: { obj: ModelAsset; blankTex: THREE.Texture; stripesTex: THREE.Texture };
  railroad: ModelAsset;
  river: ModelAsset;
}

const ModelsContext = createContext<GameModels | null>(null);

export function useGameModels() {
  return useContext(ModelsContext);
}

async function loadObjWithTexture(
  objLoader: OBJLoader,
  texLoader: THREE.TextureLoader,
  objPath: string,
  texPath: string
): Promise<ModelAsset> {
  const [group, texture] = await Promise.all([
    new Promise<THREE.Group>((res, rej) => objLoader.load(objPath, res, undefined, rej)),
    new Promise<THREE.Texture>((res, rej) => texLoader.load(texPath, res, undefined, rej)),
  ]);

  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  let geometry = new THREE.BufferGeometry();
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
    }
  });

  const material = new THREE.MeshLambertMaterial({ map: texture });
  return { geometry, material };
}

async function loadTexture(texLoader: THREE.TextureLoader, path: string): Promise<THREE.Texture> {
  return new Promise((res, rej) => {
    texLoader.load(path, (t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, rej);
  });
}

export function ModelsProvider({ children, onLoaded }: { children: React.ReactNode; onLoaded?: () => void }) {
  const [models, setModels] = useState<GameModels | null>(null);

  useEffect(() => {
    const objLoader = new OBJLoader();
    const texLoader = new THREE.TextureLoader();

    const load = async () => {
      const l = (obj: string, tex: string) => loadObjWithTexture(objLoader, texLoader, obj, tex);
      const t = (path: string) => loadTexture(texLoader, path);

      const [
        chicken,
        blueCar, greenCar, orangeCar, purpleCar, taxi, policeCar,
        blueTruck, redTruck,
        trainFront, trainMiddle, trainBack,
        tree0, tree1, tree2, tree3,
        log0, log1, log2, log3,
        boulder, lilyPad,
        grassObj, darkGrass, lightGrass,
        roadObj, blankTex, stripesTex,
        railroad, river,
      ] = await Promise.all([
        l(`${BASE}/characters/chicken/0.obj`, `${BASE}/characters/chicken/0.png`),
        l(`${BASE}/vehicles/blue_car/0.obj`, `${BASE}/vehicles/blue_car/0.png`),
        l(`${BASE}/vehicles/green_car/0.obj`, `${BASE}/vehicles/green_car/0.png`),
        l(`${BASE}/vehicles/orange_car/0.obj`, `${BASE}/vehicles/orange_car/0.png`),
        l(`${BASE}/vehicles/purple_car/0.obj`, `${BASE}/vehicles/purple_car/0.png`),
        l(`${BASE}/vehicles/taxi/0.obj`, `${BASE}/vehicles/taxi/0.png`),
        l(`${BASE}/vehicles/police_car/0.obj`, `${BASE}/vehicles/police_car/0.png`),
        l(`${BASE}/vehicles/blue_truck/0.obj`, `${BASE}/vehicles/blue_truck/0.png`),
        l(`${BASE}/vehicles/red_truck/0.obj`, `${BASE}/vehicles/red_truck/0.png`),
        l(`${BASE}/vehicles/train/front/0.obj`, `${BASE}/vehicles/train/front/0.png`),
        l(`${BASE}/vehicles/train/middle/0.obj`, `${BASE}/vehicles/train/middle/0.png`),
        l(`${BASE}/vehicles/train/back/0.obj`, `${BASE}/vehicles/train/back/0.png`),
        l(`${BASE}/environment/tree/0/0.obj`, `${BASE}/environment/tree/0/0.png`),
        l(`${BASE}/environment/tree/1/0.obj`, `${BASE}/environment/tree/1/0.png`),
        l(`${BASE}/environment/tree/2/0.obj`, `${BASE}/environment/tree/2/0.png`),
        l(`${BASE}/environment/tree/3/0.obj`, `${BASE}/environment/tree/3/0.png`),
        l(`${BASE}/environment/log/0/0.obj`, `${BASE}/environment/log/0/0.png`),
        l(`${BASE}/environment/log/1/0.obj`, `${BASE}/environment/log/1/0.png`),
        l(`${BASE}/environment/log/2/0.obj`, `${BASE}/environment/log/2/0.png`),
        l(`${BASE}/environment/log/3/0.obj`, `${BASE}/environment/log/3/0.png`),
        l(`${BASE}/environment/boulder/0.obj`, `${BASE}/environment/boulder/0.png`),
        l(`${BASE}/environment/lily_pad/0.obj`, `${BASE}/environment/lily_pad/0.png`),
        l(`${BASE}/environment/grass/model.obj`, `${BASE}/environment/grass/dark-grass.png`),
        t(`${BASE}/environment/grass/dark-grass.png`),
        t(`${BASE}/environment/grass/light-grass.png`),
        l(`${BASE}/environment/road/model.obj`, `${BASE}/environment/road/blank-texture.png`),
        t(`${BASE}/environment/road/blank-texture.png`),
        t(`${BASE}/environment/road/stripes-texture.png`),
        l(`${BASE}/environment/railroad/0.obj`, `${BASE}/environment/railroad/0.png`),
        l(`${BASE}/environment/river/0.obj`, `${BASE}/environment/river/0.png`),
      ]);

      const result: GameModels = {
        chicken,
        cars: [blueCar, greenCar, orangeCar, purpleCar, taxi, policeCar],
        trucks: [blueTruck, redTruck],
        train: { front: trainFront, middle: trainMiddle, back: trainBack },
        trees: [tree0, tree1, tree2, tree3],
        logs: [log0, log1, log2, log3],
        boulder,
        lilyPad,
        grass: { obj: grassObj, darkTex: darkGrass, lightTex: lightGrass },
        road: { obj: roadObj, blankTex: blankTex, stripesTex: stripesTex },
        railroad,
        river,
      };

      setModels(result);
      onLoaded?.();
    };

    load().catch(console.error);
  }, [onLoaded]);

  return (
    <ModelsContext.Provider value={models}>
      {children}
    </ModelsContext.Provider>
  );
}
