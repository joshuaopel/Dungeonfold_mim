# Levels

Each `.json` here is one level, exported from **Dungeonfolk Forge** (the Export button).
They are the source-of-truth designs. To edit one, open Forge and **Import** the file;
to add it to a build, import it in Forge (or bake it into the game's roster).

## Suggested structure
```
levels/
  tutorial/    01-first-steps.json, 02-..., teach one mechanic each
  act1/        the first set of "real" levels
  act2/
  bonus/       optional / challenge levels
```
Naming: `NN-short-slug.json` (zero-padded number first) so they sort in play order.

## Level JSON format (high level)
A level object includes:
- `name`, `author`, `blurb`, `goal` (treasures needed), `mode` ('heist' | 'plunder')
- `cols`, `rows`, `tiles` (length = cols*rows; 1 = floor, 0 = wall)
- `spawn` {x,y} (the Mimic start), `portal` {x,y} (the EXIT staircase)
- `treasures[]`, `props[]`, `heroes[]` (with patrol `path[]`), `inter[]`, `decals[]`, `links[]`
- `gb` {on, scheme, px, player, colors} — the Game Boy filter + player pop
- per-entity `gbPop`: `'full'` | a scheme name | `'custom'`, optional `*` suffix = pixelate

`01-first-steps.json` is a working example you can import into Forge as a starting point.
Coordinates are in world pixels (tile size = 64).
