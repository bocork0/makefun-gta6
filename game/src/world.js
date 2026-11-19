// Solmar Bay — the world: game state, loop, driving, wanted, combat, save.
// Owns the scene, the player, the vehicles, the police and the rules that
// tie the other modules together.

import * as THREE from 'three';
import { CITY, PLAYER, CAR, TRAFFIC, PEDESTRIANS, WANTED, PLACES, SAVE_KEY } from './config.js';
import { makeRng } from './rng.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { buildCity, BOUNDS, ROAD_LINES } from './city.js';
import { makePersonMesh, makeCarMesh, animateWalk, Pedestrian } from './actors.js';
import { TrafficCar, PoliceCar } from './traffic.js';
import { MissionDirector } from './missions.js';
import { HUD } from './hud.js';

// Parked cars sit at the edge of an avenue (road centre line +/- 6 m), clear
// of the traffic lanes (+/- 3.5 m) and clear of the building blocks.
const PARKED_SPOTS = [
  { id: 'veloce', color: 0xc23b2e, x: -139, z: 152, heading: Math.PI },
  { id: 'parked-1', color: 0x2e6fc2, x: 35, z: 60, heading: 0 },
  { id: 'parked-2', color: 0xe8c832, x: -81, z: -21, heading: 0 },
  { id: 'parked-3', color: 0x3aa655, x: 93, z: 120, heading: Math.PI },
  { id: 'parked-4', color: 0xe8e8e8, x: -23, z: -137, heading: Math.PI },
  { id: 'parked-5', color: 0xd97b2e, x: 151, z: -60, heading: 0 },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CITY.skyColor);
    this.scene.fog = new THREE.Fog(CITY.fogColor, 180, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5e, 0.9);
    const sun = new THREE.DirectionalLight(CITY.sunColor, 1.6);
    sun.position.set(120, 180, 60);
    this.scene.add(hemi, sun);

    this.rng = makeRng(20261117);
    this.audio = new SoundBank();
    this.input = new Input(canvas);
    this.input.onFirstGesture = () => this.audio.unlock();

    this.city = buildCity(this.scene, this.rng);
    this.colliders = this.city.colliders;

    this.state = 'title'; // title | playing | paused | wasted | busted | story
    this.money = 0;
    this.health = PLAYER.maxHealth;
    this.stars = 0;
    this.lastCrimeAt = -1e9;
    this.quietTimer = 0;
    this.lastDamageAt = -1e9;
    this.bustTimer = 0;
    this.ramCooldown = 0;
    this.vaultAlarmTripped = false;
    this.camYawOffset = 0;
    this.camPos = new THREE.Vector3(0, 120, 260);
    this.framesRendered = 0;
    this.shotReadyAfter = 0;
    this.now = 0;

    // Player on foot.
    this.player = {
      pos: new THREE.Vector3(PLACES.spawn.x, 0, PLACES.spawn.z),
      heading: Math.PI,
      speed: 0,
      inCar: false,
      car: null,
      mesh: makePersonMesh(0x2e8f8a, 0x2e3a4a, 0xe8b98a),
    };
    this.scene.add(this.player.mesh);

    // Parked cars the player can take.
    this.parked = PARKED_SPOTS.map((s) => {
      const mesh = makeCarMesh(s.color);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.heading;
      this.scene.add(mesh);
      return { id: s.id, mesh, pos: new THREE.Vector3(s.x, 0, s.z), heading: s.heading, speed: 0, driver: 'parked' };
    });

    this.traffic = [];
    for (let i = 0; i < TRAFFIC.count; i++) this.traffic.push(new TrafficCar(this.rng, this.scene));
    this.peds = [];
    for (let i = 0; i < PEDESTRIANS.count; i++) this.peds.push(new Pedestrian(this.rng, this.scene));
    this.police = [];
    for (let i = 0; i < 4; i++) {
      const car = new PoliceCar(this.rng, this.scene);
      car.standDown();
      this.police.push(car);
    }

    this.director = new MissionDirector(this.scene, (e) => this.onMissionEvent(e));
    this.hud = new HUD({
      new: () => this.newGame(),
      continue: () => this.continueGame(),
      resume: () => this.resumeGame(),
      save: () => { this.saveGame(); this.hud.message('Game saved.'); },
      restart: () => this.newGame(),
      quit: () => this.quitToTitle(),
      respawn: () => this.respawn(),
      freeroam: () => this.resumeGame(),
      howto: () => this.hud.showMenu('howto'),
      back: () => this.hud.showMenu('title', { hasSave: this.hasSave() }),
    });

    this.raycaster = new THREE.Raycaster();
    this.punchTimer = 0;
    this.shootTimer = 0;

    window.addEventListener('resize', () => this.onResize());
    this.hud.showMenu('title', { hasSave: this.hasSave() });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---- game flow ----

  newGame() {
    this.money = 0;
    this.health = PLAYER.maxHealth;
    this.setWanted(0);
    this.player.pos.set(PLACES.spawn.x, 0, PLACES.spawn.z);
    this.player.heading = Math.PI;
    this.player.inCar = false;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.vaultAlarmTripped = false;
    this.director.start();
    this.audio.unlock();
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.message('Welcome to Solmar Bay, Dario.');
  }

  hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        money: this.money,
        missionIndex: this.director.missionIndex,
        stepIndex: this.director.stepIndex,
        x: this.player.pos.x,
        z: this.player.pos.z,
        heading: this.player.heading,
        health: this.health,
      }));
    } catch { /* storage unavailable: play on without saving */ }
  }

  continueGame() {
    let save = null;
    try {
      save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    } catch { /* ignore */ }
    if (!save) {
      this.newGame();
      return;
    }
    this.money = save.money || 0;
    this.health = save.health ?? PLAYER.maxHealth;
    this.setWanted(0);
    this.player.pos.set(save.x ?? PLACES.spawn.x, 0, save.z ?? PLACES.spawn.z);
    this.player.heading = save.heading ?? Math.PI;
    this.player.inCar = false;
    this.player.car = null;
    this.player.mesh.visible = true;
    const mi = save.missionIndex ?? 0;
    if (mi >= 3) {
      this.director.state = 'story-complete';
      this.director.missionIndex = 3;
      this.director.hideMarker();
    } else {
      this.director.missionIndex = mi;
      this.director.stepIndex = save.stepIndex ?? 0;
      this.director.state = 'active';
      this.director.holdProgress = 0;
      this.director.applyStep();
    }
    this.audio.unlock();
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.message('Welcome back, Dario.');
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showMenu('pause');
  }

  resumeGame() {
    if (this.state !== 'playing') {
      this.state = 'playing';
      this.hud.hideMenu();
    }
  }

  quitToTitle() {
    this.saveGame();
    this.state = 'title';
    this.hud.showMenu('title', { hasSave: this.hasSave() });
  }

  respawn() {
    const fine = this.state === 'busted' ? WANTED.bustFine : WANTED.wastedFine;
    this.money = Math.max(0, this.money - fine);
    this.health = PLAYER.maxHealth;
    this.setWanted(0);
    if (this.player.inCar && this.player.car) {
      this.player.car.driver = 'parked';
      this.player.car.speed = 0;
      this.player.car = null;
    }
    this.player.inCar = false;
    this.player.pos.set(PLACES.spawn.x, 0, PLACES.spawn.z);
    this.player.heading = Math.PI;
    this.player.mesh.visible = true;
    this.bustTimer = 0;
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.message(fine > 0 ? `You lost $${fine}.` : 'Back on your feet.');
  }

  onMissionEvent(e) {
    if (e.type === 'intro') this.hud.message(e.text, 6000);
    else if (e.type === 'step') this.hud.message(e.text, 4000);
    else if (e.type === 'hint') this.hud.message(e.text, 3000);
    else if (e.type === 'complete') {
      this.money += e.payout;
      this.audio.missionDone();
      this.hud.message(`${e.title} complete — +$${e.payout.toLocaleString()}`, 5000);
      this.saveGame();
    } else if (e.type === 'story') {
      this.state = 'story';
      this.hud.showMenu('story', { money: this.money });
    }
  }

  // ---- wanted / crime ----

  setWanted(n) {
    this.stars = Math.max(0, Math.min(WANTED.maxStars, n));
    this.lastCrimeAt = this.now;
    this.quietTimer = 0;
    if (this.stars === 0) {
      for (const p of this.police) p.standDown();
    }
  }

  addCrime(n = 1) {
    this.setWanted(this.stars + n);
  }

  updateWanted(dt) {
    if (this.stars === 0) return;
    // The heat only fades when no cop is close: being chased keeps you hot.
    const chased = this.police.some((p) => p.active && p.distanceTo(this.player.pos) < 45);
    if (chased) {
      this.quietTimer = 0;
      return;
    }
    if (this.now - this.lastCrimeAt < WANTED.decayQuietSeconds) return;
    this.quietTimer += dt;
    if (this.quietTimer >= WANTED.decayStepSeconds) {
      this.quietTimer = 0;
      this.stars -= 1;
      if (this.stars === 0) {
        for (const p of this.police) p.standDown();
        this.hud.message('The heat is off. You are clean.');
      }
    }
  }

  updatePolice(dt) {
    const want = WANTED.policePerStar[this.stars];
    let active = this.police.filter((p) => p.active);
    if (active.length < want) {
      const idle = this.police.find((p) => !p.active);
      if (idle) {
        const angle = this.rng() * Math.PI * 2;
        const dist = 70 + this.rng() * 30;
        const px = this.player.pos.x + Math.sin(angle) * dist;
        const pz = this.player.pos.z + Math.cos(angle) * dist;
        // Snap the spawn point onto the nearest avenue, so the cruiser never
        // materialises inside a building block it cannot drive out of.
        const snapLine = (v) => {
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
        };
        const sx = snapLine(px);
        const sz = snapLine(pz);
        const onX = Math.abs(px - sx) <= Math.abs(pz - sz);
        const cx = Math.max(BOUNDS.minX + 10, Math.min(BOUNDS.maxX - 10, onX ? sx : px));
        const cz = Math.max(BOUNDS.minZ + 10, Math.min(BOUNDS.maxZ - 10, onX ? pz : sz));
        idle.deploy({ x: cx, z: cz }, Math.atan2(this.player.pos.x - cx, this.player.pos.z - cz));
        this.audio.blip(440, 0);
      }
    }
    for (const p of this.police) {
      if (!p.active) continue;
      p.update(dt, this.player.pos, this.player.speed, this.stars, this.colliders);
      if (p.distanceTo(this.player.pos) > 320) p.standDown();
    }
    // Busted: a cop on top of the player on foot.
    if (!this.player.inCar && this.stars > 0) {
      const near = this.police.find((p) => p.active && p.distanceTo(this.player.pos) < WANTED.bustDistance);
      if (near && this.player.speed < 1.5) {
        this.bustTimer += dt;
        this.hud.setHint(`BUSTED in ${Math.max(0, WANTED.bustSeconds - this.bustTimer).toFixed(1)}s — RUN!`);
        if (this.bustTimer >= WANTED.bustSeconds) {
          this.state = 'busted';
          this.audio.busted();
          this.hud.setHint('');
          this.hud.showMenu('busted');
          return;
        }
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
        this.hud.setHint('');
      }
    }
    // Ram damage: a police car hitting the player's car.
    this.ramCooldown -= dt;
    if (this.player.inCar && this.ramCooldown <= 0) {
      for (const p of this.police) {
        if (!p.active) continue;
        const d = p.distanceTo(this.player.pos);
        if (d < 3.6 && p.speed > 8) {
          this.damagePlayer(6);
          this.audio.thud();
          this.ramCooldown = 1;
          break;
        }
      }
    }
  }

  damagePlayer(amount) {
    this.health -= amount;
    this.lastDamageAt = this.now;
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'wasted';
      this.audio.busted();
      this.hud.showMenu('wasted');
    }
  }

  // ---- vehicles ----

  nearestVehicle(maxDist) {
    let best = null;
    let bestD = maxDist;
    const all = [...this.parked, ...this.traffic];
    for (const v of all) {
      const d = Math.hypot(v.pos.x - this.player.pos.x, v.pos.z - this.player.pos.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  tryEnterCar() {
    if (this.player.inCar) {
      this.exitCar();
      return;
    }
    const v = this.nearestVehicle(4.2);
    if (!v) {
      this.hud.setHint('No car close enough.');
      setTimeout(() => this.hud.setHint(''), 1500);
      return;
    }
    if (v.driver === 'traffic') {
      // Stealing an occupied car: the driver bails and runs.
      this.traffic = this.traffic.filter((t) => t !== v);
      const ped = new Pedestrian(this.rng, this.scene);
      ped.pos.set(v.pos.x + 2, 0, v.pos.z + 2);
      ped.scare(this.player.pos);
      this.peds.push(ped);
      this.addCrime(1);
      this.hud.message('You jacked a car! The cops are coming.');
      this.audio.thud();
    }
    if (v.driver === 'parked') this.parked = this.parked.filter((p) => p !== v);
    v.driver = 'player';
    v.speed = 0;
    this.player.car = v;
    this.player.inCar = true;
    this.player.mesh.visible = false;
    this.audio.pickup();
  }

  exitCar() {
    const v = this.player.car;
    if (!v) return;
    v.driver = 'parked';
    v.speed = 0;
    this.parked.push(v);
    this.player.car = null;
    this.player.inCar = false;
    this.player.pos.set(v.pos.x - Math.sin(v.heading) * 2.4, 0, v.pos.z - Math.cos(v.heading) * 2.4);
    this.player.heading = v.heading;
    this.player.mesh.visible = true;
    this.player.mesh.position.copy(this.player.pos);
  }

  // ---- combat ----

  shoot() {
    if (this.shootTimer > 0) return;
    this.shootTimer = PLAYER.pistolCooldown;
    this.audio.gunshot();
    this.camera.getWorldDirection(this.raycaster.ray.direction);
    this.raycaster.ray.origin.copy(this.camera.position);
    this.raycaster.far = PLAYER.shootRange;
    const targets = [
      ...this.peds.filter((p) => p.state !== 'down').map((p) => p.mesh),
      ...this.police.filter((p) => p.active).map((p) => p.mesh),
      ...this.traffic.map((t) => t.mesh),
    ];
    const hits = this.raycaster.intersectObjects(targets, true);
    let hitPed = null;
    let hitPolice = false;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== this.scene) obj = obj.parent;
      hitPed = this.peds.find((p) => p.mesh === obj);
      hitPolice = this.police.some((p) => p.active && p.mesh === obj);
    }
    // Gunfire scares nearby pedestrians.
    for (const p of this.peds) {
      if (Math.hypot(p.pos.x - this.player.pos.x, p.pos.z - this.player.pos.z) < 28) p.scare(this.player.pos);
    }
    if (hitPed) {
      hitPed.knockDown();
      this.addCrime(1);
      this.hud.message('You shot a pedestrian!');
    } else if (hitPolice) {
      this.addCrime(1);
      this.hud.message('You shot at the police!');
    } else {
      // A shot fired in the city still draws heat when cops are near.
      const nearCop = this.police.some((p) => p.active && p.distanceTo(this.player.pos) < 60);
      if (nearCop) this.addCrime(1);
    }
  }

  punch() {
    if (this.punchTimer > 0) return;
    this.punchTimer = PLAYER.punchCooldown;
    const fx = Math.sin(this.player.heading);
    const fz = Math.cos(this.player.heading);
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const dx = p.pos.x - this.player.pos.x;
      const dz = p.pos.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < PLAYER.punchRange && dx * fx + dz * fz > 0) {
        p.knockDown();
        this.addCrime(1);
        this.audio.thud();
        this.hud.message('You knocked someone down!');
        return;
      }
    }
    this.audio.thud();
  }

  // ---- collision helpers ----

  collideBuildings(pos, radius) {
    for (const c of this.colliders) {
      if (pos.x > c.minX - radius && pos.x < c.maxX + radius && pos.z > c.minZ - radius && pos.z < c.maxZ + radius) {
        const pushL = pos.x - (c.minX - radius);
        const pushR = c.maxX + radius - pos.x;
        const pushU = pos.z - (c.minZ - radius);
        const pushD = c.maxZ + radius - pos.z;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) pos.x = c.minX - radius;
        else if (m === pushR) pos.x = c.maxX + radius;
        else if (m === pushU) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
        return true;
      }
    }
    return false;
  }

  // ---- per-frame updates ----

  frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, this.now === 0 ? 0.016 : now - this.now);
    this.now = now;
    this.framesRendered += 1;

    if (this.state === 'playing') {
      this.update(dt);
    } else if (this.state === 'title') {
      // Slow orbit over the city behind the title screen.
      const t = now * 0.05;
      this.camera.position.set(Math.sin(t) * 240, 130, Math.cos(t) * 240);
      this.camera.lookAt(0, 0, 20);
      this.updateAmbient(dt);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.shotReadyAfter > 0 && this.framesRendered >= this.shotReadyAfter) {
      window.__shotReady = true;
    }
    this.input.endFrame();
  }

  updateAmbient(dt) {
    // Traffic and pedestrians keep the city alive behind menus.
    for (const t of this.traffic) t.update(dt, null, this.traffic);
    for (const p of this.peds) p.update(dt, []);
  }

  update(dt) {
    const input = this.input;
    if (input.wasPressed('KeyP', 'Escape')) {
      this.pauseGame();
      return;
    }
    if (input.wasPressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      this.hud.message(this.audio.muted ? 'Sound muted.' : 'Sound on.');
    }
    if (input.wasPressed('KeyE')) this.tryEnterCar();
    if (input.takeClick()) {
      if (this.player.inCar) this.audio.blip(220, 0);
      else {
        const near = this.peds.some((p) => p.state !== 'down' &&
          Math.hypot(p.pos.x - this.player.pos.x, p.pos.z - this.player.pos.z) < PLAYER.punchRange);
        if (near) this.punch();
        else this.shoot();
      }
    }
    const drag = input.takeDrag();
    if (drag.dx !== 0) this.camYawOffset = Math.max(-1.2, Math.min(1.2, this.camYawOffset + drag.dx * 0.005));
    if (!input.dragging) this.camYawOffset *= Math.max(0, 1 - dt * 0.8);

    this.punchTimer -= dt;
    this.shootTimer -= dt;

    if (this.player.inCar) this.updatePlayerCar(dt);
    else this.updatePlayerOnFoot(dt);

    // Vault alarm: the hold step trips the heat the moment it starts.
    const step = this.director.currentStep();
    if (step && step.kind === 'hold' && this.director.holdProgress > 0 && !this.vaultAlarmTripped) {
      this.vaultAlarmTripped = true;
      this.setWanted(3);
      this.hud.message('The vault alarm is tripped — lose the cops!', 5000);
    }
    this.director.update(dt, {
      pos: this.player.pos,
      inCar: this.player.inCar,
      carId: this.player.car ? this.player.car.id : null,
    });

    this.updateWanted(dt);
    this.updatePolice(dt);

    // Traffic: keep the count, respawn cars that wandered too far.
    for (const t of this.traffic) {
      t.update(dt, this.player.pos, this.traffic);
      if (Math.hypot(t.pos.x - this.player.pos.x, t.pos.z - this.player.pos.z) > TRAFFIC.despawnDistance) {
        t.respawnNear(this.player.pos);
      }
    }

    // Pedestrians: threats are gunfire, a speeding player car, and police.
    const threats = [];
    if (this.player.inCar && this.player.car && Math.abs(this.player.car.speed) > 5) {
      threats.push({ x: this.player.pos.x, z: this.player.pos.z, radius: 8 });
    }
    for (const p of this.peds) p.update(dt, threats);

    // Player car vs pedestrians.
    if (this.player.inCar && this.player.car) {
      for (const p of this.peds) {
        if (p.state === 'down') continue;
        if (Math.hypot(p.pos.x - this.player.pos.x, p.pos.z - this.player.pos.z) < 2.1) {
          p.knockDown();
          this.addCrime(1);
          this.audio.thud();
          this.hud.message('You hit a pedestrian!');
        }
      }
      // Player car vs traffic cars.
      for (const t of this.traffic) {
        if (Math.hypot(t.pos.x - this.player.pos.x, t.pos.z - this.player.pos.z) < 3.6) {
          this.player.car.speed *= 0.55;
          if (Math.abs(this.player.car.speed) > 6) this.audio.thud();
        }
      }
    }

    // Health regen after a quiet spell.
    if (this.now - this.lastDamageAt > 10 && this.health > 0 && this.health < PLAYER.maxHealth) {
      this.health = Math.min(PLAYER.maxHealth, this.health + 3 * dt);
    }

    this.audio.setEngine(this.player.inCar ? Math.abs(this.player.car.speed) / CAR.maxSpeed : 0, this.player.inCar);
    this.audio.setSiren(this.stars, dt);
    this.updateHUD();
  }

  updatePlayerOnFoot(dt) {
    const input = this.input;
    const axis = input.moveAxis();
    const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const camForward = this.cameraYaw();
    // Move relative to the camera: W walks away from the camera (the camera
    // sits behind the player), A/D strafe across the screen.
    let mx = 0;
    let mz = 0;
    if (axis.forward !== 0 || axis.strafe !== 0) {
      const fx = -Math.sin(camForward);
      const fz = -Math.cos(camForward);
      const rx = Math.cos(camForward);
      const rz = -Math.sin(camForward);
      mx = fx * axis.forward + rx * axis.strafe;
      mz = fz * axis.forward + rz * axis.strafe;
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      this.player.heading = Math.atan2(mx, mz);
      this.player.speed = speed;
    } else {
      this.player.speed = 0;
    }
    this.player.pos.x += mx * speed * dt;
    this.player.pos.z += mz * speed * dt;
    this.collideBuildings(this.player.pos, PLAYER.radius);
    this.player.pos.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, this.player.pos.x));
    this.player.pos.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, this.player.pos.z));
    this.player.mesh.position.copy(this.player.pos);
    this.player.mesh.rotation.y = this.player.heading;
    animateWalk(this.player.mesh, this.player.speed, dt);
  }

  updatePlayerCar(dt) {
    const car = this.player.car;
    const input = this.input;
    const axis = input.moveAxis();
    const forward = axis.forward;
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) {
      if (car.speed > 0.5) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * 0.45 * dt);
    }
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerInput = axis.strafe;
    const steerAuthority = Math.min(1, Math.abs(car.speed) / 8);
    car.heading += steerInput * CAR.steerRate * steerAuthority * dt * Math.sign(car.speed || 1) * -1;
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    const hitWall = this.collideBuildings(car.pos, 1.6);
    if (hitWall) {
      if (Math.abs(car.speed) > 10) {
        this.damagePlayer(4);
        this.audio.thud();
      }
      car.speed *= 0.4;
    }
    car.pos.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, car.pos.x));
    car.pos.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, car.pos.z));
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.36;
    this.player.pos.copy(car.pos);
    this.player.speed = Math.abs(car.speed);
  }

  cameraYaw() {
    const base = this.player.inCar && this.player.car ? this.player.car.heading : this.player.heading;
    return base + Math.PI + this.camYawOffset;
  }

  updateCamera(dt) {
    if (this.state === 'title') return;
    const target = new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z);
    const yaw = this.cameraYaw();
    const dist = this.player.inCar ? 13 : 9;
    const height = this.player.inCar ? 5.5 : 4;
    const desired = new THREE.Vector3(
      target.x + Math.sin(yaw) * dist,
      height,
      target.z + Math.cos(yaw) * dist,
    );
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.lerp(desired, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target.x, 1.6, target.z);
  }

  updateHUD() {
    this.hud.setMoney(this.money);
    this.hud.setWanted(this.stars);
    this.hud.setHealth(this.health);
    const obj = this.director.objective();
    let dist = null;
    if (obj && this.director.target) {
      dist = Math.hypot(this.player.pos.x - this.director.target.x, this.player.pos.z - this.director.target.z);
    }
    this.hud.setObjective(obj, dist);
    this.hud.setSpeed(this.player.inCar && this.player.car ? this.player.car.speed * 3.6 : 0, this.player.inCar);
    this.hud.drawMinimap({
      playerX: this.player.pos.x,
      playerZ: this.player.pos.z,
      heading: this.player.inCar && this.player.car ? this.player.car.heading : this.player.heading,
      missionTarget: this.director.target,
      police: this.police.filter((p) => p.active).map((p) => ({ x: p.pos.x, z: p.pos.z })),
    });
  }

  // ---- test / screenshot helpers ----

  teleport(x, z, heading = 0) {
    if (this.player.inCar && this.player.car) {
      this.player.car.pos.set(x, 0, z);
      this.player.car.heading = heading;
      this.player.car.speed = 0;
    }
    this.player.pos.set(x, 0, z);
    this.player.heading = heading;
    this.player.mesh.position.copy(this.player.pos);
    this.camPos.set(x + Math.sin(heading + Math.PI) * 10, 5, z + Math.cos(heading + Math.PI) * 10);
  }

  getState() {
    return {
      state: this.state,
      money: this.money,
      health: Math.round(this.health),
      stars: this.stars,
      inCar: this.player.inCar,
      carId: this.player.car ? this.player.car.id : null,
      carSpeed: this.player.car ? +this.player.car.speed.toFixed(2) : 0,
      mission: this.director.missionIndex,
      step: this.director.stepIndex,
      missionState: this.director.state,
      playerX: +this.player.pos.x.toFixed(1),
      playerZ: +this.player.pos.z.toFixed(1),
      policeActive: this.police.filter((p) => p.active).length,
      traffic: this.traffic.length,
      peds: this.peds.length,
    };
  }
}
