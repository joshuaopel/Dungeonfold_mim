# Dungeonfolk: Mim's Adventure (DF_Puzzle)

A 2D stealth game: you are a **Mimic** disguising as dungeon objects while heroic
invaders raid the hoard. Built as single-file HTML5 canvas apps (also ship to Steam
via Electron).

- **Play:** open `index.html`
- **Level editor / playtester:** open `forge.html` (Dungeonfolk Forge)
- **Live (after enabling Pages):** `https://joshuaopel.github.io/Dungeonfold_mim/`

## Repository layout
```
DF_Puzzle/
  index.html                     the game (self-contained)
  forge.html                     the level editor + playtester
  engine.js                      SINGLE SOURCE OF TRUTH for shared sim/render code
  build_engine.py                inlines engine.js into index.html + forge.html
  .nojekyll                      tell GitHub Pages to serve files as-is
  .github/workflows/
    deploy-pages.yml             auto-publishes the game to GitHub Pages on push
  levels/                        your level designs (exported from Forge as JSON)
    tutorial/
      01-first-steps.json        a valid starter level (template)
    act1/
```

## The shared engine (important)
`index.html` and `forge.html` each contain an **inlined copy** of the engine, between
markers:
```
/* ===== SHARED ENGINE (generated from engine.js ...) ===== */
   ... engine ...
/* ===== END SHARED ENGINE ===== */
```
Never edit code inside those markers. Edit `engine.js`, then run:
```bash
python3 build_engine.py index.html forge.html
```
Both files resync to the identical engine, so the game and editor never drift apart.

## Organizing levels
Levels are JSON, authored in **Forge** and exported with its Export button. Keep them
under `levels/`, grouped however you like (by act, by difficulty, by theme). See
`levels/README.md` for the format and a recommended naming convention.
