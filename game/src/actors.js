// People and cars: original low-poly meshes built from boxes, plus pedestrian AI.
// A "person" is a small group whose legs swing while it walks; a "car" is a box
// body with a cabin, four wheels and lights. Nothing here copies any other game.
import * as THREE from 'three';
import { CITY_HALF, STREETS } from './config.js';
import { pick, range } from './rng.js';

const SHIRT_COLORS = [0xd95f4b, 0x4b7fd9, 0x4bd97a, 0xd9b84b, 0x9a4bd9, 0xd94b9a, 0x4bd9c9, 0xe8e8e8];
const PANTS_COLORS = [0x2c3540, 0x3a3f45, 0x5a4a3a, 0x2c3a2c];
const SKIN_COLORS = [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf2c9a8];

export function makePersonMesh(opts = {}, rng = null) {
  const pickFrom = (list) => (rng ? list[Math.floor(rng() * list.length)] : pickColor(list));
  const shirt = opts.shirt ?? pickFrom(SHIRT_COLORS);
  const pants = opts.pants ?? pickFrom(PANTS_COLORS);
  const skin = opts.skin ?? pickFrom(SKIN_COLORS);
  const group = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.24), mat(pants));
  legL.position.set(-0.13, 0.28, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.3), mat(shirt));
  torso.position.y = 0.86;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), mat(skin));
  head.position.y = 1.34;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), mat(shirt));
  armL.position.set(-0.37, 0.86, 0);
  const armR = armL.clone();
  armR.position.x = 0.37;
  group.add(legL, legR, torso, head, armL, armR);
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), mat(0x1d2f4a));
    cap.position.y = 1.54;
    group.add(cap);
  }
  // Soft blob shadow so people read on the ground without shadow maps.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  return { group, legL, legR, armL, armR, head };
}

function pickColor(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function makeCarMesh(color, kind = 'traffic') {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1d2126 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.3), paint);
  body.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), kind === 'police' ? paint : glass);
  cabin.position.set(0, 1.18, -0.25);
  group.add(body, cabin);
  // Bumpers.
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.25), dark);
  bumperF.position.set(0, 0.42, 2.2);
  const bumperR = bumperF.clone();
  bumperR.position.z = -2.2;
  group.add(bumperF, bumperR);
  // Headlights and taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xccaa55 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd92b2b, emissive: 0x7a1010 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headMat);
    h.position.set(x, 0.62, 2.16);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), tailMat);
    t.position.set(x, 0.62, -2.16);
    group.add(t);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    group.add(w);
    wheels.push(w);
  }
  let lightL = null;
  let lightR = null;
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), dark);
    bar.position.set(0, 1.55, -0.25);
    group.add(bar);
    lightL = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }),
    );
    lightL.position.set(-0.28, 1.56, -0.25);
    lightR = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }),
    );
    lightR.position.set(0.28, 1.56, -0.25);
    group.add(lightL, lightR);
    // Black doors stripe.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 2.2), dark);
    stripe.position.set(0, 0.62, 0);
    group.add(stripe);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, 2.1, 1);
  shadow.position.y = 0.02;
  group.add(shadow);
  return { group, wheels, lightL, lightR };
}

// --- Pedestrians -----------------------------------------------------------

export function spawnPed(scene, city, rng, pos) {
  const mesh = makePersonMesh({}, rng);
  mesh.group.traverse((o) => {
    o.userData.pedRef = null; // filled below
  });
  const p = pos ?? city.randomSidewalkPoint();
  const ped = {
    kind: 'ped',
    mesh,
    pos: new THREE.Vector3(p.x, 0, p.z),
    heading: rng() * Math.PI * 2,
    speed: range(rng, 1.1, 2.0),
    walkPhase: rng() * 6,
    state: 'walk', // walk | flee | down
    hp: 50,
    stateTimer: 0,
    axis: rng() < 0.5 ? 'x' : 'z',
    street: pick(rng, STREETS),
    dir: rng() < 0.5 ? 1 : -1,
    fleeFrom: null,
  };
  mesh.group.traverse((o) => {
    o.userData.pedRef = ped;
  });
  scene.add(mesh.group);
  return ped;
}

function pedTurnAtIntersection(ped, rng) {
  // Near a crossing street: sometimes switch axis and pick a new street/dir.
  const along = ped.axis === 'x' ? ped.pos.x : ped.pos.z;
  for (const s of STREETS) {
    if (Math.abs(along - s) < 1.2 && rng() < 0.35) {
      ped.axis = ped.axis === 'x' ? 'z' : 'x';
      ped.street = s;
      ped.dir = rng() < 0.5 ? 1 : -1;
      return;
    }
  }
}

export function updatePeds(peds, city, dt, rng, threat) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.stateTimer -= dt;
      ped.mesh.group.rotation.x = Math.min(1.5, ped.mesh.group.rotation.x + dt * 3);
      continue;
    }
    ped.mesh.group.rotation.x = 0;
    let speed = ped.speed;
    if (ped.state === 'flee' && ped.fleeFrom) {
      speed = 4.6;
      ped.stateTimer -= dt;
      const dx = ped.pos.x - ped.fleeFrom.x;
      const dz = ped.pos.z - ped.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(dx / d, dz / d);
      if (ped.stateTimer <= 0) ped.state = 'walk';
    } else {
      pedTurnAtIntersection(ped, rng);
      const off = 8.5;
      if (ped.axis === 'x') {
        ped.pos.z += (ped.street + (ped.dir > 0 ? off : -off) - ped.pos.z) * Math.min(1, dt * 4);
        ped.pos.x += ped.dir * speed * dt;
        ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.pos.x += (ped.street + (ped.dir > 0 ? -off : off) - ped.pos.x) * Math.min(1, dt * 4);
        ped.pos.z += ped.dir * speed * dt;
        ped.heading = ped.dir > 0 ? 0 : Math.PI;
      }
      if (Math.abs(ped.pos.x) > CITY_HALF - 4 || Math.abs(ped.pos.z) > CITY_HALF - 4) ped.dir *= -1;
    }
    if (ped.state === 'flee') {
      ped.pos.x += Math.sin(ped.heading) * speed * dt;
      ped.pos.z += Math.cos(ped.heading) * speed * dt;
    }
    city.collideCircle(ped.pos, 0.5);
    city.clampToCity(ped.pos);
    ped.walkPhase += dt * speed * 2.2;
    const swing = Math.sin(ped.walkPhase) * 0.55;
    ped.mesh.legL.rotation.x = swing;
    ped.mesh.legR.rotation.x = -swing;
    ped.mesh.armL.rotation.x = -swing * 0.7;
    ped.mesh.armR.rotation.x = swing * 0.7;
    ped.mesh.group.position.copy(ped.pos);
    ped.mesh.group.rotation.y = ped.heading;
    // A nearby threat (gunfire) makes peds run.
    if (threat && ped.state !== 'flee') {
      const d = Math.hypot(ped.pos.x - threat.x, ped.pos.z - threat.z);
      if (d < 14) {
        ped.state = 'flee';
        ped.fleeFrom = { x: threat.x, z: threat.z };
        ped.stateTimer = 4;
      }
    }
  }
}

export function animatePerson(mesh, phase, speed) {
  const swing = Math.sin(phase) * 0.55 * Math.min(1, speed / 3);
  mesh.legL.rotation.x = swing;
  mesh.legR.rotation.x = -swing;
  mesh.armL.rotation.x = -swing * 0.7;
  mesh.armR.rotation.x = swing * 0.7;
}
