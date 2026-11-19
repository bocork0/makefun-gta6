// Solmar Bay — screenshot mode.
// ?shot=title|driving|mission|wanted&seed=N stages the game for a still:
// the title screen over the city, a drive down an avenue, the first mission
// at the marina, or a three-star chase. The game sets window.__shotReady
// once the staged scene has rendered.

function enterNearestCar(game) {
  const v = game.nearestVehicle(60);
  if (!v) return false;
  game.teleport(v.pos.x - Math.sin(v.heading) * 3, v.pos.z - Math.cos(v.heading) * 3, v.heading);
  game.tryEnterCar();
  return game.player.inCar;
}

function seedTrafficNear(game, count) {
  let placed = 0;
  for (const t of game.traffic) {
    if (placed >= count) break;
    t.respawnNear(game.player.pos);
    placed += 1;
  }
}

export function applyShot(game, params) {
  const shot = params.get('shot');
  if (!shot) return false;
  const seed = Number(params.get('seed') || '1');
  // The seed is accepted for future staged variation; the city layout itself
  // is fixed by design so every screenshot run stages the same streets.
  void seed;

  if (shot === 'title') {
    game.shotReadyAfter = 6;
    return true;
  }

  game.newGame();
  game.hud.hideMenu();

  if (shot === 'driving') {
    game.teleport(37, 40, 0);
    enterNearestCar(game);
    if (game.player.car) game.player.car.speed = 16;
    seedTrafficNear(game, 4);
    game.shotReadyAfter = 8;
    return true;
  }

  if (shot === 'mission') {
    game.teleport(-128, 138, Math.PI * 0.75);
    game.shotReadyAfter = 8;
    return true;
  }

  if (shot === 'wanted') {
    game.teleport(0, 100, 0);
    enterNearestCar(game);
    if (game.player.car) game.player.car.speed = 18;
    game.setWanted(3);
    game.shotReadyAfter = 45; // let the police cars arrive on screen
    return true;
  }

  game.shotReadyAfter = 6;
  return true;
}
