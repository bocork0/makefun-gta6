// Solmar Bay itself: a sunny grid city on a bay, built procedurally from a seed.
// Ground plan painted on one canvas texture; buildings are boxes with shared
// window textures; palms, streetlights and billboards are original props.
// Exports the collision boxes and the road helpers the actors use.
import * as THREE from 'three';
import { CITY_HALF, STREETS, STREET_HALF } from './config.js';
import { pick, range } from './rng.js';

const FACADE_COLORS = [0xe8dcc3, 0xd9c9a8, 0xc9d6de, 0xe6b8a2, 0xf2e6c9, 0xb9c9b0, 0xd8b8c4, 0xc4b8d8];
const ROOF_COLORS = [0x8a7a63, 0x6e7f8a, 0x9a6b52, 0x7a6a58];

function makeWindowTexture(rng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 24) {
    for (let x = 10; x < 118; x += 22) {
      g.fillStyle = rng() < 0.18 ? lit : '#2c3540';
      g.fillRect(x, y, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture(rng) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + 200) / 400) * S;
  // Water all around the island, then the land mass.
  g.fillStyle = '#3f8fb5';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#e8d9a8';
  g.fillRect(toPx(-176), toPx(-176), toPx(176) - toPx(-176), toPx(176) - toPx(-176));
  // City base: warm pavement.
  g.fillStyle = '#cfc3a5';
  g.fillRect(toPx(-168), toPx(-168), toPx(168) - toPx(-168), toPx(168) - toPx(-168));
  // Blocks.
  for (let i = 0; i < STREETS.length - 1; i += 1) {
    for (let j = 0; j < STREETS.length - 1; j += 1) {
      const x0 = STREETS[i] + STREET_HALF;
      const x1 = STREETS[i + 1] - STREET_HALF;
      const z0 = STREETS[j] + STREET_HALF;
      const z1 = STREETS[j + 1] - STREET_HALF;
      g.fillStyle = rng() < 0.15 ? '#a8bf8f' : '#d8cdb2';
      g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    }
  }
  // Roads: asphalt strips along every street line, both directions.
  g.fillStyle = '#3a3f45';
  for (const s of STREETS) {
    g.fillRect(toPx(s - STREET_HALF), toPx(-168), toPx(s + STREET_HALF) - toPx(s - STREET_HALF), toPx(168) - toPx(-168));
    g.fillRect(toPx(-168), toPx(s - STREET_HALF), toPx(168) - toPx(-168), toPx(s + STREET_HALF) - toPx(s - STREET_HALF));
  }
  // Lane dashes.
  g.fillStyle = '#e8d44d';
  for (const s of STREETS) {
    for (let v = -160; v < 168; v += 12) {
      g.fillRect(toPx(s) - 1, toPx(v), 2, 5);
      g.fillRect(toPx(v), toPx(s) - 1, 5, 2);
    }
  }
  // Sidewalk edge lines.
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  for (const s of STREETS) {
    g.strokeRect(toPx(s - STREET_HALF), toPx(-168), toPx(s + STREET_HALF) - toPx(s - STREET_HALF), toPx(168) - toPx(-168));
    g.strokeRect(toPx(-168), toPx(s - STREET_HALF), toPx(168) - toPx(-168), toPx(s + STREET_HALF) - toPx(s - STREET_HALF));
  }
  // Beach on the south edge (z > 150) and a pier line.
  g.fillStyle = '#efe0b0';
  g.fillRect(toPx(-168), toPx(152), toPx(168) - toPx(-168), toPx(168) - toPx(152));
  g.fillStyle = '#8a6a4a';
  g.fillRect(toPx(-20), toPx(152), 14, toPx(176) - toPx(152));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeBillboardTexture(lines, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.font = 'bold 34px system-ui, sans-serif';
  g.fillText(lines[0], 128, 56);
  g.font = '20px system-ui, sans-serif';
  g.fillText(lines[1], 128, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.2, 6), trunkMat);
  trunk.position.y = 2.1;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  group.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), frondMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, 4.4, Math.sin(a) * 1.1);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    group.add(frond);
  }
  return group;
}

export function createCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Buildings, one or two per block; the plaza block and two park blocks stay open.
  const windowTexs = [
    makeWindowTexture(rng, '#e8dcc3', '#ffd98a'),
    makeWindowTexture(rng, '#c9d6de', '#ffe9b0'),
    makeWindowTexture(rng, '#e6b8a2', '#fff2c0'),
    makeWindowTexture(rng, '#d9c9a8', '#ffd98a'),
  ];
  windowTexs.forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a7a63 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const parkBlocks = new Set(['3,3', '1,5', '5,1']);
  for (let i = 0; i < STREETS.length - 1; i += 1) {
    for (let j = 0; j < STREETS.length - 1; j += 1) {
      const key = `${i},${j}`;
      const x0 = STREETS[i] + STREET_HALF + 1.5;
      const x1 = STREETS[i + 1] - STREET_HALF - 1.5;
      const z0 = STREETS[j] + STREET_HALF + 1.5;
      const z1 = STREETS[j + 1] - STREET_HALF - 1.5;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (key === '3,3') continue; // Marina Plaza stays open
      if (parkBlocks.has(key)) {
        // A park: a few palms and a bench block, no building.
        for (let p = 0; p < 5; p += 1) {
          const palm = makePalm(rng);
          palm.position.set(range(rng, x0 + 2, x1 - 2), 0, range(rng, z0 + 2, z1 - 2));
          group.add(palm);
        }
        continue;
      }
      const split = rng() < 0.4;
      const lots = split
        ? [
            { x0, x1: cx - 1, z0, z1 },
            { x0: cx + 1, x1, z0, z1 },
          ]
        : [{ x0, x1, z0, z1 }];
      for (const lot of lots) {
        const w = lot.x1 - lot.x0;
        const d = lot.z1 - lot.z0;
        const h = range(rng, 8, rng() < 0.25 ? 42 : 20);
        // Tile the window texture so windows stay a believable size on any building.
        const tex = pick(rng, windowTexs).clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 6)));
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set((lot.x0 + lot.x1) / 2, h / 2, (lot.z0 + lot.z1) / 2);
        group.add(b);
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, ROOF_COLORS) }));
        roof.scale.set(w + 0.4, 0.5, d + 0.4);
        roof.position.set((lot.x0 + lot.x1) / 2, h + 0.25, (lot.z0 + lot.z1) / 2);
        group.add(roof);
        // A rooftop box (AC unit / water tank) for skyline variety.
        if (rng() < 0.6) {
          const unit = new THREE.Mesh(boxGeo, roofMat);
          unit.scale.set(range(rng, 2, 4), range(rng, 1, 2), range(rng, 2, 4));
          unit.position.set((lot.x0 + lot.x1) / 2 + range(rng, -w / 4, w / 4), h + 1, (lot.z0 + lot.z1) / 2 + range(rng, -d / 4, d / 4));
          group.add(unit);
        }
        colliders.push({ x0: lot.x0, z0: lot.z0, x1: lot.x1, z1: lot.z1 });
      }
    }
  }

  // Palms along the sidewalks of the plaza and the beach road.
  for (let k = 0; k < 14; k += 1) {
    const palm = makePalm(rng);
    const along = -140 + k * 21;
    palm.position.set(along, 0, k % 2 === 0 ? -13 : 13);
    group.add(palm);
  }
  for (let k = 0; k < 8; k += 1) {
    const palm = makePalm(rng);
    palm.position.set(-140 + k * 40, 0, 147);
    group.add(palm);
  }

  // Streetlights at every other intersection corner.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xccaa55 });
  for (let i = 0; i < STREETS.length; i += 2) {
    for (let j = 0; j < STREETS.length; j += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat);
      pole.position.set(STREETS[i] + 7, 3, STREETS[j] + 7);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(STREETS[i] + 7, 6.1, STREETS[j] + 7);
      group.add(lamp);
    }
  }

  // Billboards with original slogans.
  const boards = [
    { pos: [-60, 26, -20], lines: ['SOLMAR BAY', 'sun, sea & second chances'], bg: '#1d5f7a', fg: '#ffe9a8' },
    { pos: [60, 26, 20], lines: ['THE GULL BAR', 'cold drinks, warm deals'], bg: '#7a2d2d', fg: '#ffe9a8' },
    { pos: [-20, -140, 60], lines: ["VENN'S GARAGE", 'we fix anything'], bg: '#2d5f3a', fg: '#e8f2d8' },
  ];
  for (const b of boards) {
    const tex = makeBillboardTexture(b.lines, b.bg, b.fg);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    board.position.set(b.pos[0], 7, b.pos[1]);
    board.rotation.y = b.pos[2] * Math.PI / 180;
    group.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), poleMat);
    post.position.set(b.pos[0], 3.5, b.pos[1]);
    group.add(post);
    colliders.push({ x0: b.pos[0] - 0.5, z0: b.pos[1] - 0.5, x1: b.pos[0] + 0.5, z1: b.pos[1] + 0.5 });
  }

  // Plaza fountain (visual anchor at the map centre).
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.5, 1, 16),
    new THREE.MeshLambertMaterial({ color: 0x9ab8c9 }),
  );
  fountain.position.set(0, 0.5, 0);
  group.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.3, 16),
    new THREE.MeshLambertMaterial({ color: 0x3f8fb5 }),
  );
  water.position.set(0, 1.05, 0);
  group.add(water);
  colliders.push({ x0: -4.5, z0: -4.5, x1: 4.5, z1: 4.5 });

  return {
    colliders,
    // Push a circle out of every building AABB it overlaps; returns true on a hit.
    collideCircle(pos, radius) {
      let hit = false;
      for (const c of colliders) {
        const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
        const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
        const dx = pos.x - nx;
        const dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * radius;
            pos.z = nz + (dz / d) * radius;
          } else {
            // Centre inside the box: push out along the smallest penetration.
            const pl = pos.x - c.x0 + radius;
            const pr = c.x1 - pos.x + radius;
            const pt = pos.z - c.z0 + radius;
            const pb = c.z1 - pos.z + radius;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = c.x0 - radius;
            else if (m === pr) pos.x = c.x1 + radius;
            else if (m === pt) pos.z = c.z0 - radius;
            else pos.z = c.z1 + radius;
          }
        }
      }
      return hit;
    },
    randomRoadPoint() {
      const street = pick(rng, STREETS);
      const along = range(rng, -150, 150);
      return rng() < 0.5 ? { x: street, z: along } : { x: along, z: street };
    },
    randomSidewalkPoint() {
      const street = pick(rng, STREETS);
      const along = range(rng, -150, 150);
      const off = pick(rng, [-8.5, 8.5]);
      return rng() < 0.5 ? { x: street + off, z: along } : { x: along, z: street + off };
    },
    clampToCity(pos) {
      pos.x = Math.max(-CITY_HALF, Math.min(CITY_HALF, pos.x));
      pos.z = Math.max(-CITY_HALF, Math.min(CITY_HALF, pos.z));
    },
  };
}
