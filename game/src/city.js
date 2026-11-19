// Solmar Bay — the city itself.
// A seeded 7x7 grid of blocks between two-way avenues, a beach and the sea
// to the south. Builds all static meshes and hands the collision boxes and
// the road network back to the world.

import * as THREE from 'three';
import { CITY } from './config.js';
import { range, intRange, pick } from './rng.js';

export const PITCH = 58; // block + road
export const ROAD_LINES = [-203, -145, -87, -29, 29, 87, 145, 203];
export const BLOCK_CENTERS = [-174, -116, -58, 0, 58, 116, 174];
export const BOUNDS = { minX: -232, maxX: 232, minZ: -232, maxZ: 296 };

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  // Window grid: dark glass, a few lit warm.
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 18) {
      const lit = Math.random() < 0.22;
      g.fillStyle = lit ? '#ffd98a' : '#2c3844';
      g.fillRect(x, y, 11, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const windowTex = makeWindowTexture();
  const buildingMats = CITY.buildingColors.map(
    (c) => new THREE.MeshLambertMaterial({ color: c, map: windowTex }),
  );
  const roofMats = CITY.roofColors.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  function addBuilding(cx, cz, w, d, h) {
    const mat = pick(rng, buildingMats);
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    // Repeat the window texture by the building's size.
    const tex = mat.map.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
    mesh.material = mat.clone();
    mesh.material.map = tex;
    scene.add(mesh);
    const roof = new THREE.Mesh(boxGeo, pick(rng, roofMats));
    roof.scale.set(w + 0.6, 0.8, d + 0.6);
    roof.position.set(cx, h + 0.4, cz);
    scene.add(roof);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }

  // --- ground: city slab, beach, sea ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x8f8a7c }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, CITY.coast),
    new THREE.MeshLambertMaterial({ color: CITY.sandColor }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, 210 + CITY.coast / 2);
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 300),
    new THREE.MeshLambertMaterial({ color: CITY.seaColor }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, 210 + CITY.coast + 150);
  scene.add(sea);

  // --- roads: dark strips along every avenue, plus centre dashes ---
  const roadMat = new THREE.MeshLambertMaterial({ color: CITY.roadColor });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2a8 });
  const roadLen = 440;
  for (const line of ROAD_LINES) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(14, roadLen), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(line, 0.02, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 14), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.02, line);
    scene.add(ew);
    for (let t = -200; t <= 200; t += 32) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 4), dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(line, 0.04, t);
      scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.7), dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.04, line);
      scene.add(d2);
    }
  }

  // --- sidewalks: pale squares on every block ---
  const walkMat = new THREE.MeshLambertMaterial({ color: CITY.sidewalkColor });
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.01, bz);
      scene.add(walk);
    }
  }

  // --- buildings: 1-4 per block, taller toward the centre ---
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const dist = Math.hypot(bx, bz);
      const maxH = dist < 70 ? 46 : dist < 130 ? 30 : 18;
      const n = intRange(rng, 1, 4);
      if (n === 1) {
        const w = range(rng, 24, 34);
        const d = range(rng, 24, 34);
        addBuilding(bx, bz, w, d, range(rng, 10, maxH));
      } else {
        const slots = [
          [-10, -10],
          [10, -10],
          [-10, 10],
          [10, 10],
        ];
        for (let i = 0; i < n; i++) {
          const [ox, oz] = slots[i];
          addBuilding(bx + ox, bz + oz, range(rng, 14, 19), range(rng, 14, 19), range(rng, 8, maxH));
        }
      }
    }
  }

  // --- Solmar National Bank: a gold-glass landmark tower near the bank marker ---
  const bankMat = new THREE.MeshLambertMaterial({ color: 0xc9a227, map: windowTex });
  const bank = new THREE.Mesh(boxGeo, bankMat);
  bank.scale.set(26, 34, 26);
  bank.position.set(0, 17, -58);
  scene.add(bank);
  colliders.push({ minX: -13, maxX: 13, minZ: -71, maxZ: -45 });

  // --- streetlights: instanced poles + heads along the avenues ---
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
  const headGeo = new THREE.BoxGeometry(1.4, 0.35, 0.5);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x8a6d2f });
  const lightSpots = [];
  for (const line of ROAD_LINES) {
    for (let t = -180; t <= 180; t += 58) {
      lightSpots.push([line + 8, t]);
      lightSpots.push([t, line + 8]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lightSpots.length);
  const m4 = new THREE.Matrix4();
  lightSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 2.7, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 5.5, z);
    heads.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(heads);

  // --- palm trees along the beach ---
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const frondGeo = new THREE.ConeGeometry(2.6, 3.2, 7);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const palmSpots = [];
  for (let x = -210; x <= 210; x += 24) {
    palmSpots.push([x + range(rng, -6, 6), 222 + range(rng, 0, 26)]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3, z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 7.2, z);
    fronds.setMatrixAt(i, m4);
  });
  scene.add(trunks);
  scene.add(fronds);

  return { colliders, roadLines: ROAD_LINES, bounds: BOUNDS };
}
