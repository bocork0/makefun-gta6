// Solmar Bay — traffic and police.
// Traffic cars cruise the avenue grid, turning at intersections. Police cars
// spawn with the wanted level and chase the player down.

import * as THREE from 'three';
import { ROAD_LINES } from './city.js';
import { CAR, TRAFFIC, WANTED } from './config.js';
import { makeCarMesh } from './actors.js';
import { pick, range } from './rng.js';

function laneOffset(heading) {
  // Right-hand traffic: 3.5 m to the right of the road centre.
  return { x: Math.cos(heading) * 3.5, z: -Math.sin(heading) * 3.5 };
}

function nearestLine(v) {
  let best = ROAD_LINES[0];
  let bd = Infinity;
  for (const line of ROAD_LINES) {
    const d = Math.abs(v - line);
    if (d < bd) {
      bd = d;
      best = line;
    }
  }
  return best;
}

export class TrafficCar {
  constructor(rng, scene) {
    this.rng = rng;
    this.mesh = makeCarMesh(pick(rng, CAR.colors));
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.targetSpeed = TRAFFIC.speed;
    // Start on a random intersection, heading along a random road.
    const ix = pick(rng, ROAD_LINES);
    const iz = pick(rng, ROAD_LINES);
    this.node = { x: ix, z: iz };
    this.nextNode = this.randomNeighbour(this.node);
    this.pos.set(ix, 0, iz);
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  randomNeighbour(node) {
    const options = [];
    const xi = ROAD_LINES.indexOf(node.x);
    const zi = ROAD_LINES.indexOf(node.z);
    if (xi > 0) options.push({ x: ROAD_LINES[xi - 1], z: node.z });
    if (xi < ROAD_LINES.length - 1) options.push({ x: ROAD_LINES[xi + 1], z: node.z });
    if (zi > 0) options.push({ x: node.x, z: ROAD_LINES[zi - 1] });
    if (zi < ROAD_LINES.length - 1) options.push({ x: node.x, z: ROAD_LINES[zi + 1] });
    return pick(this.rng, options);
  }

  update(dt, playerPos, others) {
    // Drive toward the next intersection.
    const dx = this.nextNode.x - this.node.x;
    const dz = this.nextNode.z - this.node.z;
    const leg = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));

    // Slow for the car ahead.
    let blocked = false;
    const aheadX = this.pos.x + Math.sin(this.heading) * 9;
    const aheadZ = this.pos.z + Math.cos(this.heading) * 9;
    for (const o of others) {
      if (o === this) continue;
      if (Math.hypot(o.pos.x - aheadX, o.pos.z - aheadZ) < 5) {
        blocked = true;
        break;
      }
    }
    if (playerPos && Math.hypot(playerPos.x - aheadX, playerPos.z - aheadZ) < 5) blocked = true;
    this.targetSpeed = blocked ? 0 : TRAFFIC.speed;
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 2);

    const off = laneOffset(this.heading);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    // Arrived at the next node?
    const rx = this.nextNode.x + off.x - this.pos.x;
    const rz = this.nextNode.z + off.z - this.pos.z;
    if (Math.hypot(rx, rz) < 4) {
      this.node = this.nextNode;
      this.nextNode = this.randomNeighbour(this.node);
    }
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    for (const w of this.mesh.userData.wheels) w.rotation.x += (this.speed * dt) / 0.36;
  }

  respawnNear(playerPos) {
    const ix = nearestLine(playerPos.x + range(this.rng, -120, 120));
    const iz = nearestLine(playerPos.z + range(this.rng, -120, 120));
    this.node = { x: ix, z: iz };
    this.nextNode = this.randomNeighbour(this.node);
    this.pos.set(ix, 0, iz);
    this.speed = 0;
  }
}

function nearestNode(x, z) {
  return { x: nearestLine(x), z: nearestLine(z) };
}

function neighboursOf(node) {
  const options = [];
  const xi = ROAD_LINES.indexOf(node.x);
  const zi = ROAD_LINES.indexOf(node.z);
  if (xi > 0) options.push({ x: ROAD_LINES[xi - 1], z: node.z });
  if (xi < ROAD_LINES.length - 1) options.push({ x: ROAD_LINES[xi + 1], z: node.z });
  if (zi > 0) options.push({ x: node.x, z: ROAD_LINES[zi - 1] });
  if (zi < ROAD_LINES.length - 1) options.push({ x: node.x, z: ROAD_LINES[zi + 1] });
  return options;
}

// The neighbour that gets closest to the target intersection (greedy
// descent on the uniform road grid always reaches the target).
function bestNeighbour(node, target) {
  let best = null;
  let bd = Infinity;
  for (const n of neighboursOf(node)) {
    const d = Math.hypot(n.x - target.x, n.z - target.z);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

export class PoliceCar {
  constructor(rng, scene) {
    this.rng = rng;
    this.mesh = makeCarMesh(0xf2f2f2, true);
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.flashTimer = 0;
    this.flashOn = false;
    this.active = false;
    // Pursuit runs on the road graph: the cruiser drives intersection to
    // intersection toward the player, and only cuts across open ground when
    // it is close. A beeline through the blocks gets stuck on buildings.
    this.mode = 'road';
    this.node = { x: 0, z: 0 };
    this.nextNode = { x: 0, z: 0 };
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    scene.add(this.mesh);
  }

  deploy(nearPos, heading) {
    this.pos.set(nearPos.x, 0, nearPos.z);
    this.heading = heading;
    this.speed = 6;
    this.active = true;
    this.mesh.visible = true;
    this.mode = 'road';
    this.node = nearestNode(nearPos.x, nearPos.z);
    this.nextNode = this.node;
    this.stuckTimer = 0;
    this.lastPos.copy(this.pos);
  }

  standDown() {
    this.active = false;
    this.mesh.visible = false;
    this.speed = 0;
  }

  driveToward(dt, tx, tz, targetSpeed) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 0.8);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
  }

  pushOutOfBuildings(colliders) {
    for (const c of colliders) {
      if (this.pos.x > c.minX - 1.2 && this.pos.x < c.maxX + 1.2 && this.pos.z > c.minZ - 1.2 && this.pos.z < c.maxZ + 1.2) {
        const pushL = this.pos.x - (c.minX - 1.2);
        const pushR = c.maxX + 1.2 - this.pos.x;
        const pushU = this.pos.z - (c.minZ - 1.2);
        const pushD = c.maxZ + 1.2 - this.pos.z;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) this.pos.x = c.minX - 1.2;
        else if (m === pushR) this.pos.x = c.maxX + 1.2;
        else if (m === pushU) this.pos.z = c.minZ - 1.2;
        else this.pos.z = c.maxZ + 1.2;
        this.speed *= 0.5;
      }
    }
  }

  update(dt, playerPos, playerSpeed, stars, colliders) {
    if (!this.active) return;
    const targetSpeed = Math.min(WANTED.policeSpeed + stars * 1.5, 32);
    const distToPlayer = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);

    if (this.mode === 'road') {
      if (distToPlayer < 25) {
        this.mode = 'direct';
      } else {
        // Arrived at the next intersection? Pick the next leg.
        const rx = this.nextNode.x - this.pos.x;
        const rz = this.nextNode.z - this.pos.z;
        if (Math.hypot(rx, rz) < 5) {
          this.node = this.nextNode;
          this.nextNode = bestNeighbour(this.node, nearestNode(playerPos.x, playerPos.z)) || this.node;
        }
        const off = laneOffset(this.heading);
        this.driveToward(dt, this.nextNode.x + off.x, this.nextNode.z + off.z, targetSpeed);
      }
    }
    if (this.mode === 'direct') {
      if (distToPlayer > 45) {
        this.mode = 'road';
        this.node = nearestNode(this.pos.x, this.pos.z);
        this.nextNode = this.node;
      } else {
        // Close in slowly enough to actually pull up beside the player
        // instead of orbiting past them at full speed.
        const closeSpeed = Math.max(4, distToPlayer * 0.9);
        const directTarget = Math.min(targetSpeed, closeSpeed);
        const wantHeading = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z) + Math.sin(performance.now() / 700) * 0.08;
        let dh = wantHeading - this.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
        this.speed += (directTarget - this.speed) * Math.min(1, dt * 0.8);
        this.pos.x += Math.sin(this.heading) * this.speed * dt;
        this.pos.z += Math.cos(this.heading) * this.speed * dt;
      }
    }
    this.pushOutOfBuildings(colliders);

    // Stuck in direct mode (pinned against a building)? Fall back to roads.
    if (this.mode === 'direct') {
      if (Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) < 0.5) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 2) {
          this.stuckTimer = 0;
          this.mode = 'road';
          this.node = nearestNode(this.pos.x, this.pos.z);
          this.nextNode = this.node;
        }
      } else {
        this.stuckTimer = 0;
      }
      this.lastPos.copy(this.pos);
    }

    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    for (const w of this.mesh.userData.wheels) w.rotation.x += (this.speed * dt) / 0.36;
    // Flash the light bar.
    this.flashTimer += dt;
    if (this.flashTimer > 0.28) {
      this.flashTimer = 0;
      this.flashOn = !this.flashOn;
      const bar = this.mesh.userData.lightBar;
      if (bar) {
        bar.red.material.emissiveIntensity = this.flashOn ? 2.2 : 0.25;
        bar.blue.material.emissiveIntensity = this.flashOn ? 0.25 : 2.2;
      }
    }
  }

  distanceTo(p) {
    return Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
  }
}
