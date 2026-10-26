# Propellar Stumble

A fast side-view shooter for phones. You're a soldier with a propeller pack fighting gunships, drones and turrets. You run one way while shooting the other, hyper-jump over the fight, and tear a **Time Rift** that slows the world while you keep full speed.

This is a from-scratch rebuild of Rotorfall, written from its design notes with none of its code. Everything is drawn and synthesized in code, and the game builds to one HTML file of about 45 KB, with no image or sound files.

## Play

- **On this computer:** run `npm install` and then `npm run build`, and open `dist/index.html` in a browser.
- **On your phone over Wi-Fi:** run `npm run dev`, then open the "on your phone" address it prints. Turn the phone sideways.

### Touch controls (two thumbs)

| Thumb | Action |
|---|---|
| Left half, drag sideways | Run |
| Left half, quick flick up | Jump (keep the thumb up for full height) |
| Left half, hold down | Crouch, or tuck in mid-air |
| Left half, hold down then flick up | **Hyper-jump**, about 2.5x higher |
| Left half, quick flick down | Drop through a catwalk |
| Right half | Aim all the way round; push past the inner ring to fire |
| ⧗ button | Time Rift on or off |
| ⇄ button | Swap weapon |

### Keyboard and mouse

| Key | Action |
|---|---|
| A / D | Run |
| W or Space | Jump (hold for full height) |
| S | Crouch |
| Shift + jump | Hyper-jump |
| X | Drop through a catwalk |
| Mouse | Aim; click to fire |
| F or R | Time Rift |
| Q, E or the wheel | Swap weapon |
| P or Esc | Pause |

## What's in this build (first playable)

- **One stage:** Brine Yard. It has seven waves, catwalks and crates to climb, and ends with the Bullhorn heavy gunship.
- **Time Rift:** world time runs at 30% while you keep full speed. It costs 4 energy to start, needs at least 12, and drains 18 per second. Kills refill the energy, and a gunship kill triggers a short kill-cam.
- **3 weapons:**

  | Weapon | Type |
  |---|---|
  | Peashooter | Sidearm, unlimited ammo |
  | Rattler | Automatic rifle |
  | Bucketgun | 7-pellet scattergun |

- **4 enemies.** Every attack telegraphs first, with a dashed aim line that turns solid red when it locks.

  | Enemy | Type | Attack |
  |---|---|---|
  | Wasp | Gunship | 3-round burst; can't aim more than 25° upward |
  | Bullhorn | Heavy gunship | Twin 7-bullet fans, then a leading burst |
  | Gnat | Drone | Slow orbs |
  | Picket | Turret | Laser-sighted 3-round burst from a slow-turning barrel |

- **Scoring:** combo chains reach up to x5, close calls are worth +25, and you get stage bonuses (clear, time, health, accuracy, flawless) and 1 to 3 stars.
- **Drops:** health, Rift energy and ammo. The drop table leans toward whatever you're low on.

## Development

```bash
npm install
npm run check     # typecheck, unit tests, build, touch-control test
npm run e2e       # touch test plus a 150-second bot playthrough, with screenshots in shots/
```

The browser tests use Playwright. If it isn't installed locally, run `npm i -D playwright`, or point `NODE_PATH` at a global install.

### Layout

| Path | What |
|---|---|
| `src/core/clock.ts` | The four clocks (real, player, world, shot) and the Time Rift |
| `src/game/` | Player movement, weapons, enemies, stage data, scoring and effects |
| `src/input/` | Keyboard and mouse, and the two-thumb touch gestures, both feeding one `Intent` |
| `src/render/render.ts` | Canvas drawing: parallax backdrop, sprites, HUD and touch overlay |
| `src/audio/audio.ts` | Synthesized sound effects |
| `src/ui/menus.ts` | Title, pause and results screens |
| `build.mjs` | Bundles everything into `dist/index.html` |
