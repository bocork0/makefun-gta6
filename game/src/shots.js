// The four screenshot scenes behind ?shot=title|driving|mission|wanted (with &seed=N).
// Each one stages the real world — real cars, peds, police, missions and HUD —
// from a fixed seed, steps it forward a short while, and returns; main.js then
// paints it twice and sets window.__shotReady.
import { STEP } from './config.js';

function settle(world, steps) {
  for (let i = 0; i < steps; i += 1) world.step(STEP, 0);
}

function playerCarNear(world, x, z, heading, speed) {
  // Take the nearest parked car and put the player in it at the given spot.
  const car = world.cars.find((c) => c.kind === 'parked') ?? world.cars[0];
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = speed;
  car.mesh.group.position.copy(car.pos);
  car.mesh.group.rotation.y = heading;
  world.debug.putPlayerInCar(car);
  return car;
}

export function stageShot(name, world, hud) {
  const d = world.debug;
  if (name === 'title') {
    world.screen = 'title';
    world.time = 12; // fixed orbit angle for a repeatable frame
    d.setPlayer(10, 14, Math.PI * 0.75);
    hud.showTitle(false);
    settle(world, 90);
    return;
  }

  hud.hideOverlays();
  if (name === 'driving') {
    world.startNew();
    d.setMoney(500);
    playerCarNear(world, 17, 40, Math.PI, 16);
    d.setCamera(0, 0.3);
    d.stageTraffic(4, 20, -24, 18);
    d.spawnPolice(1);
    d.placePoliceAt(0, 23, 8, Math.PI); // a cruiser ahead in the right lane
    d.setWanted(2);
    settle(world, 80);
    return;
  }

  if (name === 'mission') {
    world.startNew();
    d.setMoney(1700);
    d.setMission(1, 2); // The Package — deliver to The Gull Bar
    world.missions.packageHeld = true;
    playerCarNear(world, 60, 140, -Math.PI / 2, 18);
    d.setCamera(Math.PI / 2, 0.32);
    d.spawnPolice(2);
    d.placePoliceNear(16);
    d.setWanted(1);
    settle(world, 70);
    return;
  }

  if (name === 'wanted') {
    world.startNew();
    d.setMoney(2200);
    d.setHp(55);
    d.setMission(1, 0); // The Package — get to the docks
    d.setPlayer(20, 24, Math.PI);
    d.setCamera(0, 0.34);
    d.spawnPolice(3);
    d.placePoliceNear(12);
    d.spawnCops(2);
    d.setWanted(4);
    settle(world, 24);
    return;
  }

  // Unknown scene name: fall back to the title.
  return stageShot('title', world, hud);
}
