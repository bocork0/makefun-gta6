// Solmar Bay — boot and the one loop. The world advances in fixed 1/60 s steps;
// the renderer paints what is there. Screens: title, play, paused, game over.
//
// ?seed=N fixes the city. ?shot=title|driving|mission|wanted (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { STEP } from './config.js';
import { mulberry32 } from './rng.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createHud } from './hud.js';
import { createWorld, readSave } from './world.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;
const rng = mulberry32(shot ? seed : (Date.now() % 2147483647));

const canvasHost = document.getElementById('game');
const status = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc3e0);
scene.fog = new THREE.Fog(0xa8c4d4, 90, 280);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 26, 55);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(60, 100, 40);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1);
scene.add(hemi);

const audio = createAudio();
const hud = createHud();
const input = createInput(renderer.domElement);
const world = createWorld({ scene, camera, renderer, rng, audio, hud, input });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function announce(message) {
  status.textContent = message;
  hud.announce(message);
}

function runShot(name) {
  stageShot(name, world, hud);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  // Edge actions buffer here until a simulation step consumes them: at low
  // frame rates a keypress that lands on a frame with no step must not evaporate.
  let pendingActions = 0;

  function pauseGame() {
    world.screen = 'paused';
    hud.showPause();
    announce('Paused.');
  }

  function resumeGame() {
    world.screen = 'play';
    hud.hidePause();
    announce('Playing.');
  }

  function handleActions(actions) {
    if (world.screen === 'title') {
      if (actions & ACTION_CONFIRM) {
        world.startNew();
        pendingActions = 0;
      }
      return 0;
    }
    if (world.screen === 'play') {
      if (actions & ACTION_PAUSE) {
        pauseGame();
        pendingActions = 0;
        return 0;
      }
      return actions;
    }
    if (world.screen === 'paused') {
      if (actions & ACTION_PAUSE) resumeGame();
      else if (actions & ACTION_CONFIRM) resumeGame();
      else return 0;
      pendingActions = 0;
      return 0;
    }
    if (world.screen === 'over') {
      if (actions & ACTION_CONFIRM) {
        world.respawn();
        pendingActions = 0;
      }
      return 0;
    }
    return 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    pendingActions |= input.takeActions();
    const playActions = handleActions(pendingActions);
    if (world.screen === 'title' || world.screen === 'play') {
      // Edge actions (enter/exit car, punch, shoot) go to the first sub-step
      // only: repeating them across the frame's catch-up steps would make E
      // exit the car and immediately re-enter it.
      let first = true;
      while (accumulator >= STEP && (world.screen === 'title' || world.screen === 'play')) {
        world.step(STEP, first ? playActions : 0);
        first = false;
        accumulator -= STEP;
      }
      if (!first) pendingActions = 0; // a step ran: the buffered actions are spent
    } else {
      accumulator = 0;
      pendingActions = 0;
    }
    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.screen === 'play') pauseGame();
  });

  // Buttons.
  document.getElementById('btn-start').addEventListener('click', () => {
    audio.resume();
    world.startNew();
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    audio.resume();
    const save = readSave();
    if (save) world.startContinue(save);
    else world.startNew();
  });
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-save').addEventListener('click', () => {
    world.saveGame();
    hud.toast('Game saved.', 2.5);
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    audio.resume();
    world.startNew();
  });
  document.getElementById('btn-quit').addEventListener('click', () => world.toTitle());
  document.getElementById('btn-retry').addEventListener('click', () => world.respawn());
  document.getElementById('btn-title').addEventListener('click', () => world.toTitle());

  hud.showTitle(Boolean(readSave()));
  announce('Solmar Bay. Press Space or click New story to start.');
  requestAnimationFrame(frame);
}

// Test / automation hook: the play-test driver reads the live state through this.
window.__game = world.debug;
window.__world = world;

if (shot) runShot(shot);
else runGame();
