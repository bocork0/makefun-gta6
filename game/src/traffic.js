// Traffic, parked cars and the police: cars drive the street grid, turn at
// intersections, queue behind each other; police cars chase the player when the
// wanted level is up and ram them. All original arcade logic.
import * as THREE from 'three';
import { CAR, CITY_HALF, STREETS } from './config.js';
import { makeCarMesh } from './actors.js';
import { pick, range } from './rng.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c33b, 0x3bc25a, 0x7a3bc2, 0xe8e8e8, 0x2c2c2c, 0xd97a2b, 0x3bc2c9];

function laneOffset(axis, dir) {
  // Right-hand traffic: offset 3 m to the right of the direction of travel.
  return axis === 'x' ? 3 * dir : -3 * dir;
}

function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function newCar(scene, rng, kind, color, pos, heading) {
  const mesh = makeCarMesh(color, kind);
  const car = {
    kind, // 'traffic' | 'parked' | 'police'
    owner: kind === 'police' ? 'police' : 'npc',
    mesh,
    pos: new THREE.Vector3(pos.x, 0, pos.z),
    heading,
    speed: 0,
    axis: 'x',
    street: 0,
    dir: 1,
    driver: null, // a ped riding along (traffic) or null
    stolen: false,
    ramCooldown: 0,
    flash: 0,
  };
  mesh.group.traverse((o) => {
    o.userData.carRef = car;
  });
  mesh.group.position.copy(car.pos);
  mesh.group.rotation.y = heading;
  scene.add(mesh.group);
  return car;
}

export function spawnTrafficCar(scene, city, rng) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const street = pick(rng, STREETS);
  const dir = rng() < 0.5 ? 1 : -1;
  const along = range(rng, -150, 150);
  const off = laneOffset(axis, dir);
  const pos = axis === 'x' ? { x: along, z: street + off } : { x: street + off, z: along };
  const car = newCar(scene, rng, 'traffic', pick(rng, CAR_COLORS), pos, headingFor(axis, dir));
  car.axis = axis;
  car.street = street;
  car.dir = dir;
  car.speed = range(rng, 7, CAR.trafficSpeed);
  car.cruise = car.speed;
  return car;
}

export function spawnParkedCar(scene, city, rng, pos) {
  const p = pos ?? city.randomRoadPoint();
  // randomRoadPoint gives a point on a street: {x: street, z: along} (the street
  // runs along z) or {x: along, z: street} (it runs along x). Park parallel to
  // that street, 4.6 m off its centre line, so the car is on the road, never
  // inside a block.
  const streetRunsAlongZ = STREETS.some((s) => Math.abs(s - p.x) < 0.001);
  const street = streetRunsAlongZ ? p.x : p.z;
  const along = streetRunsAlongZ ? p.z : p.x;
  const axis = streetRunsAlongZ ? 'z' : 'x';
  const at = streetRunsAlongZ
    ? { x: street + 4.6, z: along }
    : { x: along, z: street + 4.6 };
  const car = newCar(scene, rng, 'parked', pick(rng, CAR_COLORS), at, headingFor(axis, rng() < 0.5 ? 1 : -1));
  car.axis = axis;
  car.street = street;
  return car;
}

export function spawnPoliceCar(scene, rng, nearPos) {
  const a = rng() * Math.PI * 2;
  const r = range(rng, 55, 75);
  const pos = {
    x: Math.max(-160, Math.min(160, nearPos.x + Math.sin(a) * r)),
    z: Math.max(-160, Math.min(160, nearPos.z + Math.cos(a) * r)),
  };
  const car = newCar(scene, rng, 'police', 0xf2f2f2, pos, 0);
  car.speed = 12;
  return car;
}

function nearestStreetCoord(v) {
  let best = STREETS[0];
  for (const s of STREETS) if (Math.abs(v - s) < Math.abs(v - best)) best = s;
  return best;
}

function updateTrafficCar(car, cars, dt, rng) {
  // Slow down for the car ahead on the same lane.
  let target = car.cruise ?? CAR.trafficSpeed;
  for (const other of cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const ahead = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
    const side = Math.cos(car.heading) * dx - Math.sin(car.heading) * dz;
    if (ahead > 0 && ahead < 11 && Math.abs(side) < 2.4) {
      target = Math.min(target, other.speed);
    }
  }
  car.speed += Math.max(-8 * dt, Math.min(6 * dt, target - car.speed));
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  const along = car.axis === 'x' ? car.pos.x : car.pos.z;
  // At an intersection, sometimes turn onto the crossing street.
  for (const s of STREETS) {
    if (Math.abs(along - s) < 1.0 && rng() < 0.012) {
      const newAxis = car.axis === 'x' ? 'z' : 'x';
      const newDir = rng() < 0.5 ? 1 : -1;
      car.axis = newAxis;
      car.street = s;
      car.dir = newDir;
      car.heading = headingFor(newAxis, newDir);
      if (newAxis === 'x') car.pos.z = s + laneOffset('x', newDir);
      else car.pos.x = s + laneOffset('z', newDir);
      break;
    }
  }
  // At the city edge, turn around.
  if (Math.abs(car.pos.x) > CITY_HALF - 6 || Math.abs(car.pos.z) > CITY_HALF - 6) {
    car.dir *= -1;
    car.heading = headingFor(car.axis, car.dir);
    const off = laneOffset(car.axis, car.dir);
    if (car.axis === 'x') car.pos.z = car.street + off;
    else car.pos.x = car.street + off;
  }
  car.mesh.group.position.copy(car.pos);
  car.mesh.group.rotation.y = car.heading;
  // Wheels spin with speed.
  for (const w of car.mesh.wheels) w.rotation.x += (car.speed * dt) / 0.36;
}

function turnToward(current, target, maxStep) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + Math.max(-maxStep, Math.min(maxStep, d));
}

export function updatePoliceCar(car, playerPos, playerCar, dt, world) {
  car.flash += dt;
  const flashOn = Math.floor(car.flash * 6) % 2 === 0;
  if (car.mesh.lightL) {
    car.mesh.lightL.material.emissive.setHex(flashOn ? 0xff0000 : 0x330000);
    car.mesh.lightR.material.emissive.setHex(flashOn ? 0x000033 : 0x0000ff);
  }
  const target = playerCar ? playerCar.pos : playerPos;
  const dx = target.x - car.pos.x;
  const dz = target.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const desired = Math.atan2(dx, dz);
  const maxTurn = (dist < 8 ? 3.4 : 2.2) * dt;
  car.heading = turnToward(car.heading, desired, maxTurn);
  // Cruisers chase cars and ram them. On foot, they close to 8 m and hold there —
  // the foot chase belongs to the cops on foot — so a wanted player on foot can
  // still lay low and cool the heat off instead of being run down forever.
  const onFoot = !playerCar;
  const want = onFoot ? (dist > 8 ? CAR.policeSpeed : 0) : dist > 10 ? CAR.policeSpeed : CAR.policeSpeed * 0.7;
  car.speed += Math.max(-14 * dt, Math.min(12 * dt, want - car.speed));
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  world.city.collideCircle(car.pos, 1.6);
  world.city.clampToCity(car.pos);
  car.mesh.group.position.copy(car.pos);
  car.mesh.group.rotation.y = car.heading;
  for (const w of car.mesh.wheels) w.rotation.x += (car.speed * dt) / 0.36;
  // Ram the player: damage + shove, with a per-car cooldown. Only against a
  // car — on foot, cruisers hold off and let the foot cops do the chasing.
  car.ramCooldown -= dt;
  if (playerCar && dist < 4.2 && car.ramCooldown <= 0) {
    car.ramCooldown = 0.9;
    playerCar.speed *= 0.55;
    world.damagePlayer(6, 'rammed by a police cruiser');
    world.audio.crash();
  }
}

export function updateTraffic(cars, dt, rng) {
  for (const car of cars) {
    if (car.kind === 'traffic') updateTrafficCar(car, cars, dt, rng);
  }
}

// Keep the traffic count topped up: remove cars that drove far away is unnecessary
// (they loop inside the city), so this only adds parked cars back after a theft.
export function ensureParked(scene, city, rng, cars, want) {
  const parked = cars.filter((c) => c.kind === 'parked').length;
  for (let i = parked; i < want; i += 1) cars.push(spawnParkedCar(scene, city, rng));
}

export { nearestStreetCoord };
