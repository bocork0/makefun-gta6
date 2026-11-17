# Solmar Bay — gta6-01 entry — STATUS

## Status: BUILT AND VERIFIED LOCALLY — ready except bundle + repo + submit (parent/Dhoni)

Local git commit: see HEAD SHA below. No remote; nothing pushed.

Game: **Solmar Bay** — an original open-world crime game in the browser, three.js
0.187.0 (vendored, MIT). You are **Dario Venn**, a wheelman in the sun-soaked
bay city of Solmar Bay, doing three jobs for fixer **Lena Cross**.

- On foot (WASD + mouse drag / arrow keys, Shift run) and in cars (W/S throttle,
  A/D steer, Space handbrake, E enter/exit).
- Steal any parked or driven car — the cops notice (+1★, +2★ for a cruiser).
- Traffic (10 cars driving the grid, turning at intersections, queuing) and
  pedestrians (16, walking sidewalks, fleeing gunfire).
- Wanted level 1–5★: crime raises it, 25 s clean lowers it. Police cruisers
  chase and ram cars; at 2★+ cops chase on foot and punch; a cop touching you
  for 3 s = BUSTED. Cruisers hold off at 8 m from a player on foot (foot chase
  belongs to the cops), so laying low can actually cool the heat.
- Three chained story missions: 1 Hot Wheels (steal a car to Venn's Garage,
  +$500), 2 The Package (docks pickup → The Gull Bar, +$1,200), 3 The Vault Run
  (hold E at the bank vault, escape a 3★ manhunt to the safehouse, +$5,000),
  then free roam. Mission beacon + objective text with distance.
- Combat: click to shoot (hitscan + tracer), F to punch. Health, WASTED and
  BUSTED game-over screens, respawn for $100 at Solmar General.
- HUD (money, wanted stars, health bar, objective) + 2D canvas minimap (roads,
  traffic, police, mission marker, player arrow). Title / pause / game-over
  overlays. Save/load via localStorage (auto-save on missions, manual save in
  the pause menu, Continue on the title screen).
- Sound: everything synthesised with WebAudio — engine, sirens, gunshots,
  punches, pickups, mission jingle, bassline loop. No audio files.
- All characters, places, names, story, art and music are original works made
  for this game. Nothing from Rockstar/GTA or any commercial game. three.js
  0.187.0 is vendored under `game/vendor/three/` with its LICENSE.

## Files (all in ~/workspace/makefun-bounties/gta6-01/)

- `main.ts` — hand-in program (Node 22, stdlib only; copies game/ +
  screenshots/, writes dossier.json via vendor/makefun-game.ts)
- `serve.ts` — the kit starter's static server, copied unchanged (:8080)
- `vendor/makefun-game.ts` — the kit's copy, UNCHANGED (sha256
  dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129)
- `game/index.html`, `game/src/` — config, rng, audio, input, city, actors,
  traffic, missions, hud, world, shots, main (12 modules)
- `game/vendor/three/` — three.module.min.js + three.core.min.js + LICENSE
  (three.js 0.187.0, MIT; copied from the threejs-fps-02 entry's vendored copy)
- `screenshots/` — 4 real renders of the game's own code (1280x800 JPEG):
  - `1-title.jpg` (106,402 B) — title screen over an aerial city view
  - `2-driving.jpg` (124,883 B) — driving with traffic, police cruiser, minimap, 2★
  - `3-mission.jpg` (95,884 B) — Mission 2 delivery drive along the beach road
  - `4-wanted.jpg` (112,840 B) — on foot at 4★, cops closing in, cruisers around
- `LICENSE` — MIT (+ SPDX-License-Identifier: MIT line)
- `README.md`, `shots.json`
- `STATUS.md` — this file

## Verification done in this session

- `node --check` passes on all 12 game/src modules; `node
  --experimental-strip-types --check main.ts` passes. (`node --check` cannot
  parse the TypeScript annotations in serve.ts / vendor/makefun-game.ts in this
  Node build; serve.ts was verified by running it live: HTTP 200 on `/`,
  `/src/main.js`, `/vendor/three/three.module.min.js`.)
- `grep` over game/src/ + index.html: no `http:` / `https:` / `fetch(`. The
  vendored three.js library itself contains `fetch(` inside its FileLoader
  (never called by the game — the game loads no external files) and `https:`
  URLs inside code comments only. CDP Network monitoring during all play-tests
  showed zero requests.
- Play-tested in headless Chromium 157 driven over CDP (headed under Xvfb :99,
  file:// with --allow-file-access-from-files, WebGL2 via the Hatch policy
  file; plain `chrome --headless --screenshot` silently produces nothing on
  this machine, same as the earlier builders found).
  - Play-test 1 (CDP keyboard/mouse, 18 checks): **18/18 PASS** — boot to
    title, Space starts, WASD walks 5.3 m, E steals a car (wanted exactly 1★,
    crime log shows one `steal`), W drives 25.6 m at speed 21.2, police spawn,
    E exits, click shoot + F punch, P pauses and resumes, Mission 1 completes
    at the garage (+$500), damage to 0 → WASTED, Space respawns (hp 100,
    wanted 0). Zero page/console errors.
  - Play-test 2 (full story, 15 checks): **15/15 PASS** — Mission 2 docks
    pickup → delivery at The Gull (+$1,200), Mission 3 bank vault grab (hold
    E ~3 s game time) → wanted 3, 5 police cars, escape to the safehouse →
    story complete (+$5,000, money $6,200), wanted decays to 0 after 25 s
    clean, cop contact for 3 s → BUSTED, Continue restores the
    story-complete save. Zero page/console errors.
  - Real bugs found and fixed by these tests: (1) edge actions were repeated
    across a frame's catch-up steps, so E exited a car and instantly re-entered
    it; (2) actions could evaporate on a frame with no simulation step —
    actions now buffer until a step consumes them; (3) `spawnParkedCar`
    placed cars at random coordinates, sometimes inside building blocks (that
    also caused a phantom +2★ on the steal test); (4) police cruisers rammed
    on-foot players forever, making wanted decay and the vault grab
    unreachable — cruisers now hold at 8 m on foot and only ram cars.
  - Note: headless SwiftShader runs the game at ~half real-time speed (each
    frame advances at most 0.25 s of game time), so the play-test drivers hold
    keys / wait roughly twice the in-game durations.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` run TWICE: outputs byte-identical
  (deterministic). Dossier 690,838 bytes (cap 1.5 MiB), sha256
  dea4ef3503d03cb9bb0b738722348fe1e40d0f5359159e52c1c017fc6b2c3ec5.
  Output holds game/ (16 files, 2,234,218 bytes), screenshots/ (4 files) and
  dossier.json.
- Screenshots: 1280x800 JPEG, 95,884–124,883 bytes (cap 256 KiB each), all
  visually inspected (city, cars, HUD, minimap, police all render).

## Still missing / parent's + Dhoni's steps (NOT done, per the brief)

- Local git commit: DONE (HEAD SHA recorded below).
- Bundle with usage rows + `makefun check`: parent's step (this builder's
  session began after the sealed recording started, as required; do NOT seal
  the recording from here).
- GitHub repo creation under bocork0 (https://github.com/bocork0/makefun-gta6-01
  in README — parent to confirm the name when creating it), push, submission,
  and the wallet signature at submit time: Dhoni's steps — never done by this
  builder. Deadline: Mon 24 Nov 2026 15:00 UTC.
- The sealed recording (id 01a1ea0c-c79f-7061-8927-87910a056c34) was left
  running; nothing in ~/.makefun was touched.

## HEAD

- `aa24d08` — "Add Solmar Bay — Make GTA 6 (gta6-01) entry" (all game files,
  screenshots, LICENSE, README, main.ts, serve.ts, shots.json)
- `9a18474` — this STATUS.md (full SHA:
  9a184742413c398bc138e9bec8c90cf8edafed02)
- Working tree clean at HEAD; no remote; nothing pushed.
