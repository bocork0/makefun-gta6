// Solmar Bay — boot.
// Creates the game on the page's canvas, stages a screenshot scene when the
// URL asks for one, and exposes a small debug hook for play-testing.

import { Game } from './world.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

const params = new URLSearchParams(window.location.search);
applyShot(game, params);

// Debug hook for automated play-tests: read-only state plus the few actions
// a test needs (teleport, wanted level, mission jump). Not part of the game.
window.__game = {
  state: () => game.getState(),
  teleport: (x, z, heading = 0) => game.teleport(x, z, heading),
  setWanted: (n) => game.setWanted(n),
  damage: (n) => game.damagePlayer(n),
  newGame: () => game.newGame(),
  enterCar: () => game.tryEnterCar(),
  director: game.director,
  player: game.player,
  version: 'solmar-bay/1.0.0',
};

window.addEventListener('error', (e) => {
  // Surface boot failures in the console for the screenshot driver.
  console.error('Solmar Bay error:', e.message);
});
