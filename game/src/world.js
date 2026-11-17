// Solmar Bay — the world: player, driving, crime, wanted level, police, combat,
// missions and the camera. Fixed 1/60 s steps; the renderer only paints.
import * as THREE from 'three';
import { CAR, CITY_HALF, MISSIONS, PLACES, PLAYER, SAVE_KEY, STEP, WANTED } from './config.js';
import { createCity } from './city.js';
import { animatePerson, makePersonMesh, spawnPed, updatePeds } from './actors.js';
import { ensureParked, spawnParkedCar, spawnPoliceCar, spawnTrafficCar, updatePoliceCar, updateTraffic } from './traffic.js';
import { createMissions, updateMissions } from './missions.js';

const SAVE_VERSION = 1;

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.version === SAVE_VERSION ? data : null;
  } catch {
    return null;
  }
}

export function createWorld(deps) {
  const { scene, camera, renderer, rng, audio, hud, input } = deps;
  const city = createCity(scene, rng);
  const raycaster = new THREE.Raycaster();
  raycaster.far = PLAYER.gunRange;

  // --- entities ------------------------------------------------------------
  const playerMesh = makePersonMesh(
    { shirt: 0x2e8f8a, pants: 0x2c3540, skin: 0xe8b98a },
    rng,
  );
  scene.add(playerMesh.group);
  const player = {
    pos: new THREE.Vector3(10, 0, 14),
    heading: Math.PI,
    speed: 0,
    hp: PLAYER.hp,
    walkPhase: 0,
    car: null, // the car the player is driving, or null
    punchCooldown: 0,
    shootCooldown: 0,
    crimeCooldown: {}, // crime type -> seconds left
    bustTimer: 0,
    invuln: 0,
  };

  const cars = [];
  for (let i = 0; i < 10; i += 1) cars.push(spawnTrafficCar(scene, city, rng));
  for (let i = 0; i < 8; i += 1) cars.push(spawnParkedCar(scene, city, rng));

  const peds = [];
  for (let i = 0; i < 16; i += 1) peds.push(spawnPed(scene, city, rng));

  const policeCars = [];
  const cops = [];

  const missions = createMissions();

  // Mission marker beacon: a glowing pillar + ring at the target place.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 12, 1, true), beaconMat);
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  scene.add(ring);

  // Gun tracer: one reusable line.
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);
  let tracerTimer = 0;

  const world = {
    city,
    screen: 'title', // title | play | paused | over
    time: 0,
    money: 0,
    wanted: 0,
    crimeTimer: 0,
    camYaw: Math.PI,
    camPitch: 0.32,
    missions,
    player,
    cars,
    peds,
    policeCars,
    cops,
    overKind: null,
    overDetail: '',
    debug: {},
  };

  // --- helpers ---------------------------------------------------------------
  function playerForward() {
    return { x: -Math.sin(world.camYaw), z: -Math.cos(world.camYaw) };
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function crime(type, stars, message) {
    if (player.crimeCooldown[type] > 0) return;
    player.crimeCooldown[type] = 5;
    const before = world.wanted;
    world.wanted = Math.min(WANTED.max, world.wanted + stars);
    world.crimeTimer = 0;
    if (typeof window !== 'undefined') {
      window.__crimeLog = window.__crimeLog ?? [];
      window.__crimeLog.push({ type, stars, before, after: world.wanted, t: Math.round(world.time * 10) / 10 });
    }
    if (world.wanted > before) {
      hud.toast(message ?? `Wanted level up: ${world.wanted}★`, 2.5);
      audio.wantedUp();
      hud.announce(`Wanted level ${world.wanted}.`);
    }
  }

  function damagePlayer(amount, reason) {
    if (player.invuln > 0 || world.screen !== 'play') return;
    player.hp -= amount;
    player.invuln = 0.4;
    hud.flashDamage();
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver('WASTED', reason ? `Dario went down — ${reason}.` : 'Dario went down.');
    }
  }

  function gameOver(kind, detail) {
    if (world.screen === 'over') return;
    world.screen = 'over';
    world.overKind = kind;
    world.overDetail = detail;
    audio.busted();
    audio.setEngine(0, false);
    audio.setSiren(false, 0);
    hud.showGameOver(kind, `${detail} The bay keeps your money where it fell — respawn costs $100.`);
    hud.announce(`${kind}. ${detail}`);
  }

  function respawn() {
    world.money = Math.max(0, world.money - 100);
    player.hp = PLAYER.hp;
    player.pos.set(PLACES.hospital.x, 0, PLACES.hospital.z);
    player.heading = Math.PI;
    player.car = null;
    world.wanted = 0;
    world.crimeTimer = 0;
    clearPolice();
    world.screen = 'play';
    hud.hideOverlays();
    hud.toast('Patched up at Solmar General. Stay out of trouble… or don’t.', 4);
    saveGame();
  }

  function clearPolice() {
    for (const car of policeCars) scene.remove(car.mesh.group);
    policeCars.length = 0;
    for (const cop of cops) scene.remove(cop.mesh.group);
    cops.length = 0;
  }

  function saveGame() {
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          version: SAVE_VERSION,
          money: world.money,
          hp: player.hp,
          wanted: world.wanted,
          missionIndex: missions.index,
          missionStage: missions.stage,
          x: player.pos.x,
          z: player.pos.z,
        }),
      );
    } catch {
      // Storage off: the save lasts this visit only.
    }
  }

  function loadSave(data) {
    world.money = data.money ?? 0;
    player.hp = data.hp ?? PLAYER.hp;
    world.wanted = data.wanted ?? 0;
    missions.index = Math.min(data.missionIndex ?? 0, MISSIONS.length);
    missions.stage = data.missionStage ?? 0;
    missions.done = missions.index >= MISSIONS.length;
    missions.packageHeld = false;
    missions.grabProgress = 0;
    player.pos.set(data.x ?? 10, 0, data.z ?? 14);
    player.car = null;
  }

  // --- entering / exiting cars ----------------------------------------------
  function enterCar(car) {
    // A grab stage has priority over entering a car.
    const stage = missions.stageDef();
    if (stage && stage.kind === 'grab') {
      const place = PLACES[stage.place];
      if (Math.hypot(player.pos.x - place.x, player.pos.z - place.z) < 5) return;
    }
    player.car = car;
    car.kind = 'player';
    if (car.owner === 'npc') {
      car.stolen = true;
      car.owner = 'player';
      crime('steal', car.kind === 'police' ? 2 : 1, car.kind === 'police' ? 'You stole a police cruiser! +2★' : 'Car stolen! +1★');
    } else if (car.owner === 'police') {
      crime('steal', 2, 'You stole a police cruiser! +2★');
    }
    playerMesh.group.visible = false;
    world.camYaw = car.heading + Math.PI;
    audio.carDoor();
    hud.announce('Driving.');
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    player.pos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
    city.collideCircle(player.pos, 0.6);
    player.heading = car.heading;
    player.car = null;
    playerMesh.group.visible = true;
    audio.carDoor();
    hud.announce('On foot.');
  }

  // --- combat ------------------------------------------------------------------
  function shootables() {
    const list = [];
    for (const p of peds) if (p.state !== 'down') list.push(p.mesh.group);
    for (const c of cops) if (c.state !== 'down') list.push(c.mesh.group);
    for (const car of cars) list.push(car.mesh.group);
    for (const car of policeCars) list.push(car.mesh.group);
    return list;
  }

  function shoot() {
    if (player.shootCooldown > 0) return;
    player.shootCooldown = PLAYER.shootCooldown;
    audio.gunshot();
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    raycaster.set(origin, dir);
    const hits = raycaster.intersectObjects(shootables(), true);
    let end = origin.clone().addScaledVector(dir, PLAYER.gunRange);
    for (const hit of hits) {
      let obj = hit.object;
      let entity = null;
      let entityKind = null;
      while (obj) {
        if (obj.userData.pedRef) {
          entity = obj.userData.pedRef;
          entityKind = 'ped';
          break;
        }
        if (obj.userData.carRef) {
          entity = obj.userData.carRef;
          entityKind = 'car';
          break;
        }
        obj = obj.parent;
      }
      if (!entity) continue;
      if (obj.userData.isShadow) continue;
      end = hit.point.clone();
      if (entityKind === 'ped') {
        entity.hp -= PLAYER.gunDamage;
        if (entity.hp <= 0) {
          entity.state = 'down';
          entity.stateTimer = 8;
          crime(entity.kind === 'cop' ? 'killCop' : 'killPed', 1, entity.kind === 'cop' ? 'You shot a cop! +1★' : 'You shot a pedestrian! +1★');
        } else if (entity.state !== 'flee') {
          entity.state = 'flee';
          entity.fleeFrom = { x: player.pos.x, z: player.pos.z };
          entity.stateTimer = 4;
        }
      } else {
        crime('shootCar', 1, 'Shots fired at a car! +1★');
      }
      break;
    }
    tracerGeo.setFromPoints([origin.clone().addScaledVector(dir, 1.2), end]);
    tracerMat.opacity = 0.9;
    tracerTimer = 0.09;
    // Nearby peds scatter at the sound.
    world._threat = { x: player.pos.x, z: player.pos.z };
    world._threatTimer = 0.1;
  }

  function punch() {
    if (player.punchCooldown > 0) return;
    player.punchCooldown = PLAYER.punchCooldown;
    audio.punch();
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const targets = [...peds, ...cops].filter((p) => p.state !== 'down');
    for (const t of targets) {
      const dx = t.pos.x - player.pos.x;
      const dz = t.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < PLAYER.punchRange && dx * fx + dz * fz > 0) {
        t.hp -= PLAYER.punchDamage;
        t.pos.x += (dx / (d || 1)) * 1.2;
        t.pos.z += (dz / (d || 1)) * 1.2;
        if (t.hp <= 0) {
          t.state = 'down';
          t.stateTimer = 8;
          crime(t.kind === 'cop' ? 'killCop' : 'killPed', 1, t.kind === 'cop' ? 'You knocked out a cop! +1★' : 'You knocked out a pedestrian! +1★');
        } else if (t.state !== 'flee') {
          t.state = 'flee';
          t.fleeFrom = { x: player.pos.x, z: player.pos.z };
          t.stateTimer = 4;
        }
        break;
      }
    }
  }

  // --- movement ----------------------------------------------------------------
  function stepOnFoot(dt) {
    const mv = input.move();
    const look = input.takeLook();
    world.camYaw -= look.dx * 0.005;
    world.camPitch = Math.max(0.05, Math.min(0.55, world.camPitch + look.dy * 0.003));
    world.camYaw -= input.cameraTurn() * dt * 2.4;
    const fwd = playerForward();
    const right = { x: -fwd.z, z: fwd.x };
    let mx = fwd.x * mv.f + right.x * mv.s;
    let mz = fwd.z * mv.f + right.z * mv.s;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      player.speed = speed;
      player.pos.x += mx * speed * dt;
      player.pos.z += mz * speed * dt;
      const targetHeading = Math.atan2(mx, mz);
      let dh = targetHeading - player.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      player.heading += dh * Math.min(1, dt * 12);
      player.walkPhase += dt * speed * 2.2;
    } else {
      player.speed = 0;
    }
    city.collideCircle(player.pos, PLAYER.radius);
    city.clampToCity(player.pos);
    playerMesh.group.position.copy(player.pos);
    playerMesh.group.rotation.y = player.heading;
    animatePerson(playerMesh, player.walkPhase, player.speed);
  }

  function stepDriving(dt) {
    const car = player.car;
    const mv = input.move();
    const look = input.takeLook();
    world.camYaw -= look.dx * 0.005;
    world.camPitch = Math.max(0.05, Math.min(0.55, world.camPitch + look.dy * 0.003));
    world.camYaw -= input.cameraTurn() * dt * 2.4;
    if (mv.f > 0) car.speed += CAR.accel * dt;
    else if (mv.f < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    const handbrake = input.held('Space');
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
    const steer = mv.s;
    car.heading -= steer * CAR.turnRate * dt * Math.max(-1, Math.min(1, car.speed / 8));
    const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    car.pos.x = nx;
    car.pos.z = nz;
    if (city.collideCircle(car.pos, 1.7)) {
      const hitSpeed = Math.abs(car.speed);
      if (hitSpeed > 8) {
        audio.crash();
        damagePlayer(Math.min(12, hitSpeed * 0.5), 'crashed the car');
      }
      car.speed *= 0.4;
    }
    city.clampToCity(car.pos);
    // Bumping other cars.
    for (const other of [...cars, ...policeCars]) {
      if (other === car) continue;
      const d = Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const ux = (car.pos.x - other.pos.x) / d;
        const uz = (car.pos.z - other.pos.z) / d;
        car.pos.x += ux * push;
        car.pos.z += uz * push;
        if (other.kind === 'traffic' || other.kind === 'parked') {
          other.pos.x -= ux * push;
          other.pos.z -= uz * push;
          other.mesh.group.position.copy(other.pos);
        }
        if (Math.abs(car.speed) > 6) {
          car.speed *= 0.6;
          audio.crash();
        }
      }
    }
    // Running over pedestrians.
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
      if (d < 1.8 && Math.abs(car.speed) > 4) {
        ped.state = 'down';
        ped.stateTimer = 8;
        ped.hp = 0;
        crime('hitPed', 1, 'You hit a pedestrian! +1★');
        audio.crash();
      }
    }
    car.mesh.group.position.copy(car.pos);
    car.mesh.group.rotation.y = car.heading;
    for (const w of car.mesh.wheels) w.rotation.x += (car.speed * dt) / 0.36;
    player.pos.copy(car.pos);
    player.heading = car.heading;
    // Ease the camera back behind the car as it turns (drag-look still works).
    const wantYaw = car.heading + Math.PI;
    let dyaw = wantYaw - world.camYaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    world.camYaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, dyaw));
  }

  // --- police ------------------------------------------------------------------
  function managePolice(dt) {
    const want = Math.min(world.wanted, 4);
    if (world.wanted > 0 && policeCars.length < want) {
      world._policeSpawnTimer = (world._policeSpawnTimer ?? 0) - dt;
      if (world._policeSpawnTimer <= 0) {
        world._policeSpawnTimer = 2;
        policeCars.push(spawnPoliceCar(scene, rng, player.pos));
      }
    }
    if (world.wanted === 0 && policeCars.length > 0) {
      clearPolice();
      hud.toast('You lost the cops.', 2.5);
    }
    // On-foot cops chase the player when wanted >= 2 and the player is on foot.
    const wantCops = world.wanted >= WANTED.copSpawnAt && !player.car ? Math.min(world.wanted - 1, 3) : 0;
    if (cops.length < wantCops) {
      world._copSpawnTimer = (world._copSpawnTimer ?? 0) - dt;
      if (world._copSpawnTimer <= 0) {
        world._copSpawnTimer = 1.5;
        const mesh = makePersonMesh({ shirt: 0x1d2f4a, pants: 0x1d2f4a, cap: true }, rng);
        const a = rng() * Math.PI * 2;
        const cop = {
          kind: 'cop',
          mesh,
          pos: new THREE.Vector3(
            Math.max(-160, Math.min(160, player.pos.x + Math.sin(a) * 28)),
            0,
            Math.max(-160, Math.min(160, player.pos.z + Math.cos(a) * 28)),
          ),
          heading: 0,
          speed: 5.6,
          walkPhase: rng() * 6,
          state: 'walk',
          hp: 100,
          stateTimer: 0,
          punchCooldown: 0,
        };
        mesh.group.traverse((o) => {
          o.userData.pedRef = cop;
        });
        scene.add(mesh.group);
        cops.push(cop);
      }
    }
    if (world.wanted < WANTED.copSpawnAt || player.car) {
      for (const cop of cops) scene.remove(cop.mesh.group);
      cops.length = 0;
    }
    // Update on-foot cops.
    let nearestCop = Infinity;
    for (const cop of cops) {
      if (cop.state === 'down') {
        cop.stateTimer -= dt;
        cop.mesh.group.rotation.x = Math.min(1.5, cop.mesh.group.rotation.x + dt * 3);
        if (cop.stateTimer <= 0) {
          scene.remove(cop.mesh.group);
          cops.splice(cops.indexOf(cop), 1);
        }
        continue;
      }
      cop.mesh.group.rotation.x = 0;
      const dx = player.pos.x - cop.pos.x;
      const dz = player.pos.z - cop.pos.z;
      const d = Math.hypot(dx, dz);
      nearestCop = Math.min(nearestCop, d);
      cop.heading = Math.atan2(dx, dz);
      if (d > 1.6) {
        cop.pos.x += (dx / d) * cop.speed * dt;
        cop.pos.z += (dz / d) * cop.speed * dt;
        cop.walkPhase += dt * cop.speed * 2.2;
      } else {
        cop.punchCooldown -= dt;
        if (cop.punchCooldown <= 0) {
          cop.punchCooldown = 1.1;
          damagePlayer(10, 'beaten by a cop');
          audio.punch();
        }
      }
      city.collideCircle(cop.pos, 0.5);
      cop.mesh.group.position.copy(cop.pos);
      cop.mesh.group.rotation.y = cop.heading;
      animatePerson(cop.mesh, cop.walkPhase, d > 1.6 ? cop.speed : 0);
    }
    // Busted: a cop stays touching you on foot.
    if (!player.car && nearestCop < 2.2) {
      player.bustTimer += dt;
      if (player.bustTimer >= WANTED.bustSeconds) {
        gameOver('BUSTED', 'The Solmar Bay Police took Dario in.');
      }
    } else {
      player.bustTimer = 0;
    }
  }

  // --- camera --------------------------------------------------------------------
  function updateCamera(dt) {
    const target = player.car ? player.car.pos : player.pos;
    const dist = player.car ? 10.5 : 7.5;
    const height = 3.4 + Math.sin(world.camPitch) * dist * 0.5;
    const cx = target.x + Math.sin(world.camYaw) * dist * Math.cos(world.camPitch);
    const cz = target.z + Math.cos(world.camYaw) * dist * Math.cos(world.camPitch);
    const desired = new THREE.Vector3(cx, height, cz);
    camera.position.lerp(desired, Math.min(1, dt * 8));
    camera.lookAt(target.x, target.y + 1.7, target.z);
    void dt;
  }

  // --- the step ------------------------------------------------------------------
  // `actions` come from main.js, which owns screen transitions (title/pause/over).
  function step(dt, actions = 0) {
    world.time += dt;
    // Cooldowns.
    player.punchCooldown = Math.max(0, player.punchCooldown - dt);
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    for (const k of Object.keys(player.crimeCooldown)) {
      player.crimeCooldown[k] = Math.max(0, player.crimeCooldown[k] - dt);
    }
    if (tracerTimer > 0) {
      tracerTimer -= dt;
      if (tracerTimer <= 0) tracerMat.opacity = 0;
    }
    if (world._threatTimer > 0) {
      world._threatTimer -= dt;
      if (world._threatTimer <= 0) world._threat = null;
    }

    if (world.screen === 'title') {
      // Attract mode: the city lives behind the title; the camera orbits high
      // above the rooftops so the grid, plaza and beach read at a glance.
      const a = world.time * 0.05;
      camera.position.set(Math.sin(a) * 95, 65, Math.cos(a) * 95);
      camera.lookAt(0, 0, 0);
      updatePeds(peds, city, dt, rng, null);
      updateTraffic(cars, dt, rng);
      // Keep the minimap alive behind the title overlay.
      hud.drawMinimap({
        time: world.time,
        missionMarker: missions.markerPlace(),
        police: [],
        traffic: cars.filter((c) => c.kind === 'traffic').map((c) => ({ x: c.pos.x, z: c.pos.z })),
        player: { x: player.pos.x, z: player.pos.z },
        playerHeading: player.heading,
      });
      return;
    }
    if (world.screen !== 'play') return;

    // Actions (edge-triggered; main.js passes them in).
    if (player.car) {
      if (actions & 4) exitCar();
    } else {
      if (actions & 4) {
        const car = nearestCar(4.5);
        if (car) enterCar(car);
      }
      if (actions & 8) punch();
      if (actions & 16) shoot();
      else if (input.shooting() && player.shootCooldown <= 0) shoot();
    }

    if (player.car) stepDriving(dt);
    else stepOnFoot(dt);

    updatePeds(peds, city, dt, rng, world._threat);
    // Downed peds get back up elsewhere after a while (fresh faces keep coming).
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      if (ped.state === 'down' && ped.stateTimer <= 0) {
        scene.remove(ped.mesh.group);
        peds.splice(i, 1);
        peds.push(spawnPed(scene, city, rng));
      }
    }
    updateTraffic(cars, dt, rng);
    ensureParked(scene, city, rng, cars, 8);
    managePolice(dt);
    for (const car of policeCars) updatePoliceCar(car, player.pos, player.car, dt, world);

    // Wanted decay: lay low and the heat drops.
    if (world.wanted > 0) {
      world.crimeTimer += dt;
      if (world.crimeTimer >= WANTED.decaySeconds) {
        world.wanted -= 1;
        world.crimeTimer = 0;
        hud.toast(`Heat cooling off — wanted ${world.wanted}★`, 2.5);
      }
    }

    // Missions.
    const ctx = {
      dt,
      playerPos: () => player.pos,
      playerCar: () => player.car,
      interactHeld: () => (input.held ? input.held('KeyE') : false),
      onVaultGrabbed: () => {
        world.wanted = 3;
        world.crimeTimer = 0;
        hud.toast('The whole bay is coming for you!', 4);
        audio.wantedUp();
        for (let i = 0; i < 3; i += 1) policeCars.push(spawnPoliceCar(scene, rng, player.pos));
      },
      onPackagePicked: () => {
        crime('hotPackage', 1, 'The package was hot — the cops are on you! +1★');
        audio.pickup();
      },
    };
    const missionEvent = updateMissions(missions, ctx);
    if (missionEvent === 'mission') {
      const finished = MISSIONS[missions.index - 1];
      world.money += finished.reward;
      hud.banner('MISSION COMPLETE', `${finished.title} — +$${finished.reward.toLocaleString('en-US')}`);
      audio.missionDone();
      saveGame();
    } else if (missionEvent === 'story') {
      world.money += MISSIONS[MISSIONS.length - 1].reward;
      hud.banner('STORY COMPLETE', `The Vault Run paid +$${MISSIONS[MISSIONS.length - 1].reward.toLocaleString('en-US')} — Solmar Bay is yours now.`);
      audio.missionDone();
      saveGame();
    }

    // Mission beacon.
    const marker = missions.markerPlace();
    if (marker && !missions.done) {
      beacon.visible = true;
      ring.visible = true;
      beacon.position.set(marker.x, 15, marker.z);
      beacon.material.opacity = 0.25 + Math.sin(world.time * 4) * 0.1;
      ring.position.set(marker.x, 0.06, marker.z);
      const s = 1 + Math.sin(world.time * 4) * 0.12;
      ring.scale.set(s, s, 1);
    } else {
      beacon.visible = false;
      ring.visible = false;
    }

    // Audio: engine + siren follow the game.
    audio.setEngine(player.car ? Math.abs(player.car.speed) / CAR.maxSpeed : 0, Boolean(player.car));
    audio.setSiren(world.wanted > 0, world.time);

    updateCamera(dt);

    // HUD state.
    const markerPlace = missions.markerPlace();
    hud.update(
      {
        time: world.time,
        money: world.money,
        hp: player.hp,
        wanted: world.wanted,
        playing: true,
        inCar: Boolean(player.car),
        missionTitle: missions.done ? 'Free Roam' : missions.current().title,
        objective: missions.objectiveText(),
        missionDist: missions.done ? null : missions.markerDistance(player.pos),
        missionMarker: missions.done ? null : markerPlace,
        player: { x: player.pos.x, z: player.pos.z },
        playerHeading: player.heading,
        police: policeCars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
        traffic: cars.filter((c) => c.kind === 'traffic').map((c) => ({ x: c.pos.x, z: c.pos.z })),
        prompt: currentPrompt(),
        grabProgress: missions.grabProgress,
      },
      dt,
    );
  }

  function currentPrompt() {
    if (world.screen !== 'play') return null;
    const stage = missions.stageDef();
    if (stage && stage.kind === 'grab' && !player.car) {
      const place = PLACES[stage.place];
      if (Math.hypot(player.pos.x - place.x, player.pos.z - place.z) < 5) {
        return missions.current().id === 'the-vault-run' ? 'Hold E — grab the cash' : 'Walk into the marker';
      }
    }
    if (!player.car) {
      const car = nearestCar(4.5);
      if (car) return car.owner === 'player' ? 'Press E — get in your car' : 'Press E — steal the car';
      const near = nearestCar(9);
      if (near) return 'Get closer to a car to steal it';
    } else {
      return 'E — get out · Space — handbrake';
    }
    return null;
  }

  // --- public API ------------------------------------------------------------------
  function startNew() {
    missions.reset();
    world.money = 0;
    player.hp = PLAYER.hp;
    player.pos.set(10, 0, 14);
    player.heading = Math.PI;
    player.car = null;
    playerMesh.group.visible = true;
    world.wanted = 0;
    world.crimeTimer = 0;
    clearPolice();
    world.screen = 'play';
    hud.hideOverlays();
    hud.announce('Playing. ' + missions.objectiveText());
    audio.resume();
    audio.startMusic();
    saveGame();
  }

  function startContinue(data) {
    loadSave(data);
    playerMesh.group.visible = true;
    world.screen = 'play';
    hud.hideOverlays();
    audio.resume();
    audio.startMusic();
  }

  function toTitle() {
    world.screen = 'title';
    player.car = null;
    playerMesh.group.visible = true;
    player.pos.set(10, 0, 14);
    clearPolice();
    hud.showTitle(Boolean(readSave()));
    audio.setEngine(0, false);
    audio.setSiren(false, 0);
  }

  // Debug / shot-staging hooks (also used by the play-test driver).
  world.debug = {
    setMoney(v) {
      world.money = v;
    },
    setHp(v) {
      player.hp = v;
    },
    setWanted(v) {
      world.wanted = v;
      world.crimeTimer = 0;
    },
    setMission(index, stage) {
      missions.index = index;
      missions.stage = stage;
      missions.done = index >= MISSIONS.length;
      missions.grabProgress = 0;
      missions.packageHeld = false;
    },
    setPlayer(x, z, heading) {
      player.pos.set(x, 0, z);
      player.heading = heading;
      player.car = null;
      playerMesh.group.visible = true;
      playerMesh.group.position.copy(player.pos);
      playerMesh.group.rotation.y = heading;
    },
    putPlayerInCar(car) {
      player.car = car;
      car.kind = 'player';
      car.owner = 'player';
      playerMesh.group.visible = false;
    },
    setCamera(yaw, pitch) {
      world.camYaw = yaw;
      world.camPitch = pitch;
    },
    stageTraffic(count, street, zStart, zStep) {
      // Line up the first `count` traffic cars on street x=`street`, heading north (-z).
      const traffic = cars.filter((c) => c.kind === 'traffic');
      for (let i = 0; i < Math.min(count, traffic.length); i += 1) {
        const car = traffic[i];
        car.axis = 'z';
        car.street = street;
        car.dir = -1;
        car.heading = Math.PI;
        car.pos.set(street + 3, 0, zStart + i * zStep);
        car.speed = 8;
        car.cruise = 8;
        car.mesh.group.position.copy(car.pos);
        car.mesh.group.rotation.y = car.heading;
      }
    },
    spawnPolice(n) {
      for (let i = 0; i < n; i += 1) policeCars.push(spawnPoliceCar(scene, rng, player.pos));
    },
    placePoliceNear(dist) {
      for (const car of policeCars) {
        const a = rng() * Math.PI * 2;
        car.pos.set(player.pos.x + Math.sin(a) * dist, 0, player.pos.z + Math.cos(a) * dist);
        car.heading = Math.atan2(player.pos.x - car.pos.x, player.pos.z - car.pos.z);
      }
    },
    placePoliceAt(index, x, z, heading) {
      const car = policeCars[index];
      if (!car) return;
      car.pos.set(x, 0, z);
      car.heading = heading;
      car.speed = 12;
      car.mesh.group.position.copy(car.pos);
      car.mesh.group.rotation.y = heading;
    },
    spawnCops(n) {
      for (let i = 0; i < n; i += 1) {
        const mesh = makePersonMesh({ shirt: 0x1d2f4a, pants: 0x1d2f4a, cap: true }, rng);
        const a = (i / n) * Math.PI * 2;
        const cop = {
          kind: 'cop',
          mesh,
          pos: new THREE.Vector3(player.pos.x + Math.sin(a) * 6, 0, player.pos.z + Math.cos(a) * 6),
          heading: 0,
          speed: 5.6,
          walkPhase: 0,
          state: 'walk',
          hp: 100,
          stateTimer: 0,
          punchCooldown: 0,
        };
        mesh.group.traverse((o) => {
          o.userData.pedRef = cop;
        });
        scene.add(mesh.group);
        cops.push(cop);
      }
    },
    state() {
      return {
        screen: world.screen,
        money: world.money,
        hp: Math.round(player.hp),
        wanted: world.wanted,
        missionIndex: missions.index,
        missionStage: missions.stage,
        missionDone: missions.done,
        inCar: Boolean(player.car),
        playerX: Math.round(player.pos.x * 10) / 10,
        playerZ: Math.round(player.pos.z * 10) / 10,
        playerHeading: Math.round(player.heading * 100) / 100,
        carSpeed: player.car ? Math.round(player.car.speed * 10) / 10 : 0,
        policeCars: policeCars.length,
        cops: cops.length,
        peds: peds.length,
        traffic: cars.filter((c) => c.kind === 'traffic').length,
        overKind: world.overKind,
      };
    },
  };

  world.step = step;
  world.startNew = startNew;
  world.startContinue = startContinue;
  world.toTitle = toTitle;
  world.respawn = respawn;
  world.saveGame = saveGame;
  world.damagePlayer = damagePlayer;
  world.crime = crime;
  world.audio = audio;
  world.camera = camera;
  world.renderer = renderer;
  world.scene = scene;
  return world;
}
