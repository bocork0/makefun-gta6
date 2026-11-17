# Solmar Bay — an open-world crime story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bocork0/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bocork0/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** is an original open-world crime game that runs entirely in the
browser. You are **Dario Venn**, a wheelman trying to go straight — until fixer
**Lena Cross** offers him three jobs he cannot refuse. Walk the sun-soaked
streets of Solmar Bay, steal cars, outrun the Solmar Bay Police, and pull off
the Vault Run.

## Play

Serve it locally and open http://localhost:8080:

```sh
node serve.ts
```

Or open `game/index.html` directly in a browser — no build step, no network.

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Run |
| Mouse drag / ← → | Look |
| E | Enter / exit a car (steal it!) |
| Click | Shoot |
| F | Punch |
| Space | Handbrake (in a car) |
| P / Esc | Pause |

## The game

- **Open world**: a procedural bay city — 8×8 street grid, Marina Plaza, the
  docks, the beach, palms, billboards, traffic and pedestrians, all generated
  from a seed.
- **On foot and in cars**: steal any parked or driven car (the cops notice),
  drive arcade-style with handbrake turns.
- **Wanted level**: 1–5 stars. Crime raises it; laying low cools it down.
  Police cruisers chase and ram you; at 2★+ cops chase you on foot. Get
  caught standing next to one for 3 seconds and you are **BUSTED**.
- **Three story missions**: Hot Wheels (steal a car for the garage), The
  Package (a hot crate at the docks), The Vault Run (grab the cash, escape a
  3★ manhunt to the safehouse). Rewards $500 / $1,200 / $5,000.
- **HUD + minimap**: money, health, wanted stars, live objective with
  distance, and a 2D minimap with traffic, police and the mission marker.
- **Save / load**: progress saves to localStorage on every mission and from
  the pause menu; Continue on the title screen picks it up.
- **Sound**: everything is synthesised with WebAudio — engine, sirens,
  gunshots, punches, pickups and a bassline loop. No audio files.

## Originality

Every character, place, name, story beat, texture and sound in Solmar Bay was
made for this game. The city, its people and its cars are original low-poly
work; nothing is taken from any commercial game, film or brand. three.js
(0.187.0, MIT) is vendored under `game/vendor/three/` with its LICENSE.

## Entry

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` with the vendored make.fun library.
Screenshots in `screenshots/` are real renders of the game's own code
(`?shot=title|driving|mission|wanted&seed=1`).
