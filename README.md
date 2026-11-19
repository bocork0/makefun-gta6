[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/bocork0/makefun-gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/bocork0/makefun-gta6/reward.svg)](https://make.fun/c/gta6-01)

# Solmar Bay

An original open-world crime game for the make.fun **gta6-01** bounty — a
complete rendition of the genre, built from scratch in a desktop browser
from static files, with no network requests.

You are **Dario Venn**, fresh out of the joint in the sun-soaked coastal
city of Solmar Bay. Your contact **Lena Cross** has three jobs for you:

1. **Hot Wheels** ($500) — steal the cherry-red Veloce at the marina and
   deliver it to Lena's garage.
2. **The Package** ($1,200) — pick up a package at the docks and run it
   north. Do not open it.
3. **Vault Run** ($5,000) — crack the vault at Solmar National, lose the
   heat, and reach the safehouse.

## The city

- A 7×7 grid of blocks with avenues, sidewalks, streetlights, palms and a
  beach on the south coast — all original, low-poly three.js.
- Traffic cars cruise the avenues; pedestrians wander the sidewalks and
  flee from gunfire and speeding cars.
- Steal any car (E), drive it, and watch the wanted level: the Solmar Bay
  PD sends cruisers after you, and standing still near one gets you
  **BUSTED**. Lay low for 25 seconds and the heat fades.
- Combat on foot: punch up close, shoot with the mouse. Health, money,
  wanted stars, objective, speed and a live minimap are always on the HUD.
- Save and continue from the pause menu (localStorage); WASTED costs $100,
  BUSTED costs $200.
- Synthesized WebAudio sound only — engine, sirens, gunshots, pickups —
  no audio files.

## Controls

WASD walk / drive · Shift sprint · E enter / exit a car · Mouse click
punch or shoot (horn while driving) · Drag mouse to look around · P or
Esc pause · M mute.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` (three.js 0.187.0 vendored
under `game/vendor/`). Screenshots live in `screenshots/`.

## License

MIT — see [LICENSE](LICENSE).
