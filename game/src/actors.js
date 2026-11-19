// Solmar Bay — people and cars.
// Low-poly figures and vehicles, built from boxes and cylinders. Every mesh
// faces +Z in local space; the world rotates them by heading.

import * as THREE from 'three';
import { BLOCK_CENTERS } from './city.js';
import { pick, range } from './rng.js';

const SKIN = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const SHIRTS = [0xd94f3d, 0x3d7bd9, 0x4fae5a, 0xe8c832, 0xb56fd9, 0xe8e8e8, 0x2e2e2e, 0xd97b2e];
const PANTS = [0x2e3a4a, 0x4a3a2e, 0x3a4a3a, 0x555555];

export function makePersonMesh(shirtColor, pantsColor, skinColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pants);
  legL.position.set(-0.15, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.36), shirt);
  torso.position.y = 1.18;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armL.position.set(-0.44, 1.18, 0);
  const armR = armL.clone();
  armR.position.x = 0.44;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.78;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
  hair.position.y = 1.98;

  g.add(legL, legR, torso, armL, armR, head, hair);
  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.walkPhase = Math.random() * 6;
  return g;
}

export function animateWalk(mesh, speed, dt) {
  const u = mesh.userData;
  u.walkPhase += dt * speed * 2.4;
  const s = Math.sin(u.walkPhase) * Math.min(1, speed / 4);
  u.limbs.legL.rotation.x = s * 0.7;
  u.limbs.legR.rotation.x = -s * 0.7;
  u.limbs.armL.rotation.x = -s * 0.6;
  u.limbs.armR.rotation.x = s * 0.6;
}

export function makeCarMesh(color, police = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf2f2f2 : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1), darkMat);
  cabin.position.set(0, 1.05, -0.25);
  g.add(body, cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0x555533 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    h.position.set(x, 0.62, 2.12);
    g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa2222, emissive: 0x550000 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t.position.set(x, 0.62, -2.12);
    g.add(t);
  }
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.18, 4.22), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
    stripe.position.y = 0.62;
    g.add(stripe);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    barBase.position.set(0, 1.38, -0.25);
    g.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.position.set(-0.28, 1.4, -0.25);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
    blue.position.set(0.28, 1.4, -0.25);
    g.add(red, blue);
    g.userData.lightBar = { red, blue };
  }
  g.userData.wheels = wheels;
  return g;
}

// A pedestrian: wanders the sidewalks, flees from gunfire and speeding cars.
export class Pedestrian {
  constructor(rng, scene) {
    this.rng = rng;
    this.mesh = makePersonMesh(pick(rng, SHIRTS), pick(rng, PANTS), pick(rng, SKIN));
    this.pos = new THREE.Vector3();
    this.heading = rng() * Math.PI * 2;
    this.speed = range(rng, 1.2, 2.0);
    this.state = 'walk'; // walk | flee | down
    this.target = this.randomCorner();
    this.pos.set(this.target.x, 0, this.target.z);
    this.fleeTimer = 0;
    this.downTimer = 0;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  randomCorner() {
    const bx = pick(this.rng, BLOCK_CENTERS);
    const bz = pick(this.rng, BLOCK_CENTERS);
    const ox = pick(this.rng, [-22, 22]);
    const oz = pick(this.rng, [-22, 22]);
    return { x: bx + ox, z: bz + oz };
  }

  scare(fromPos) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeTimer = 3;
    const dx = this.pos.x - fromPos.x;
    const dz = this.pos.z - fromPos.z;
    this.heading = Math.atan2(dx, dz);
  }

  knockDown() {
    this.state = 'down';
    this.downTimer = 25;
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.3;
  }

  update(dt, threats) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.state = 'walk';
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0;
        this.target = this.randomCorner();
      }
      return;
    }
    for (const t of threats) {
      const d = Math.hypot(this.pos.x - t.x, this.pos.z - t.z);
      if (d < t.radius) {
        this.scare(t);
        break;
      }
    }
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) this.state = 'walk';
    }
    const speed = this.state === 'flee' ? 4.5 : this.speed;
    if (this.state === 'walk') {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        this.target = this.randomCorner();
      } else {
        this.heading = Math.atan2(dx, dz);
      }
    }
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    this.pos.x = Math.max(-225, Math.min(225, this.pos.x));
    this.pos.z = Math.max(-225, Math.min(225, this.pos.z));
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    animateWalk(this.mesh, speed, dt);
  }
}
