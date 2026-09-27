# The Long Road

A story-driven Second World War first-person shooter that runs in the browser. It covers the **Prologue** and **Chapter One** of Pvt. Daniel Kessler's war, from the day Roosevelt asked Congress for a declaration of war on Japan to the first week of fighting in Normandy.

Everything is procedural: textures, models, weapons, animation and sound are generated in code. The only dependency is Three.js r128, loaded from cdnjs.

## Play

Open `index.html` in a desktop browser (Chrome, Edge or Firefox) with a keyboard and mouse. Click into the game to capture the mouse. Headphones help.

## Story

| # | Mission | When / where | What happens |
|---|---------|--------------|--------------|
| P1 | **Infamy** | Dec 8, 1941 — Kessler's Diner, Allentown, PA | Roosevelt's "date which will live in infamy" address plays on the diner radio. Danny's father, a veteran of the Argonne, gives him his Waltham trench watch. Danny and his best friend Frankie Russo walk through the snow to the recruiting station. |
| P2 | **Boot** | April 1942 — Camp Blanding, Florida | Training under Sgt. Hollis: rifle range at 50 and 100 yards, the Garand's clip "ping", reloading and inspecting, the obstacle course, the grenade court, and village fighting with the Thompson. |
| 1 | **Easy Red** | June 6, 1944 — Omaha Beach | The run in aboard a Higgins boat, the ramp drop, crossing the beach under MG42 fire, the Bangalore torpedo at the wire, a minefield under a smoke screen, the fight up the draw, and a satchel charge on the bunker. |
| 2 | **The Hedgerows** | June 12, 1944 — Norman bocage | A hedgerow ambush, the loss of Eli Weiss to an MG42, a flanking run through a sunken lane, a French farm girl with news of her brother, and a three-wave defense of the farmhouse at dusk. |
| 3 | **Sainte-Colombe** | June 14, 1944 — a ruined Norman town | Window-to-window street fighting, a sniper in the church tower, a Panzer IV destroyed with a satchel charge, holding the square until the Shermans arrive, and the watch that stopped at 6:31. |

The game ends at the close of Chapter One.

## Controls

| Key | Action |
|-----|--------|
| W A S D | Move |
| Mouse | Look |
| Left click | Fire |
| Right click (hold) | Aim down sights |
| R | Reload |
| F | Inspect weapon |
| Shift | Sprint |
| C / Ctrl | Crouch |
| Space | Jump / vault |
| E | Interact (hold where shown) |
| G | Throw grenade |
| V | Melee |
| Q | Use medkit |
| 1 / 2 / wheel | Switch weapon |
| T | Ask Russo for ammo |
| Esc | Pause |

## Features

- **Captured weapons:** fallen Germans drop Kar98k rifles (bolt-action, stripper-clip reloads) and MP 40s; press E to pick one up, swap it for your current gun, or take its ammo.
- **Weapons:** M1 Garand (en-bloc clip with ejection ping, locked-open bolt, partial-clip reloads), M1A1 Thompson (magazine drop and cocking handle), M1911 (slide lock), Mk 2 grenades. Each has fire, reload, empty reload, inspect, draw, melee and throw animations, with IK-driven arms, ejected casings and muzzle flash.
- **Navigation:** each level builds a walkability grid (walls, rubble, hedgerow banks, wire, deep water) and soldiers path around obstacles with A*.
- **Name tags:** look at a squadmate to see his rank and name.
- **Enemies:** cover-peeking riflemen, advancing squads, rushers, MG42 crews with limited arcs that can be flanked, a church-tower sniper with scope glint, grenade throwers, and a Panzer IV.
- **Squad:** Sgt. Mahoney, Frankie Russo, Ray Dupree, Eli Weiss and Doc Harlan move, take cover and fight alongside you.
- **Rendering:** HDR pipeline with ACES tone mapping, per-mission color grading, film grain, vignette, bloom, soft shadows, image-based lighting, GPU particles (smoke columns, fire, dust, sparks), bullet decals, tracers, wind-blown grass and foliage.
- **Audio:** synthesized gunfire with distance filtering and speed-of-sound delay, reverb, ambience beds, and a small orchestral score.
- **Structure:** checkpoints, four difficulty levels, mission select, settings (sensitivity, FOV, quality, volume, subtitles, optional browser text-to-speech).

## Files

```
index.html            page, HUD and menus
js/core.js            utilities, noise, settings, input
js/textures.js        procedural textures and materials
js/audio.js           procedural sound and music
js/render.js          renderer, post-processing, sky, particles, collision, terrain
js/nav.js             navigation grid, A* pathfinding, cover finding
js/models.js          characters (with arm IK), NPC weapons, vehicles
js/kit.js             level-building helpers (buildings, ruins, trees, hedgerows, wire)
js/viewmodel.js       first-person weapons and animations
js/hud.js             HUD
js/actors.js          enemy AI, squad, civilians, grenades, tanks
js/player.js          player movement, weapons and interaction
js/story.js           mission and dialogue engine
js/levels/*.js        prologue, beach, hedgerows, town
js/main.js            boot, menus and main loop
```
