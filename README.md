# Dungeonfolk: Mim's Adventure

A 2D stealth game: you are a **Mimic** disguising as dungeon objects while heroic
invaders raid the hoard. Built as single-file HTML5 canvas apps, wrapped in
Electron for the Steam release.

- **Play:** open `index.html` (or serve the repo over HTTP to get the campaign list)
- **Level editor / playtester:** open `forge.html` (Dungeonfolk Forge)
- **Live:** `https://joshuaopel.github.io/Dungeonfold_mim/`

## Repository layout
```
index.html                     the game (self-contained)
forge.html                     the level editor + playtester
engine.js                      SINGLE SOURCE OF TRUTH for shared sim/render code
build_engine.py                inlines engine.js into index.html + forge.html
levels/                        level designs (exported from Forge as JSON)
  manifest.json                which levels form the campaign, in order
  tutorial/01-first-steps.json a valid starter level (template)
electron/                      desktop wrapper (window, Steamworks, level IPC)
steam/                         SteamPipe upload scripts + shipping guide
package.json                   Electron/electron-builder config + build scripts
steam_appid.txt                dev-only Steamworks App ID (480 = test app; never shipped)
.nojekyll                      tell GitHub Pages to serve files as-is
.github/workflows/
  deploy-pages.yml             auto-publishes the game to GitHub Pages on push
  desktop-build.yml            builds Steam depot folders + Windows installer on v* tags
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
python3 build_engine.py
```
Both files resync to the identical engine, so the game and editor never drift apart.

## Organizing levels
Levels are JSON, authored in **Forge** and exported with its Export button. Keep them
under `levels/`, grouped however you like (by act, by difficulty, by theme), and list
them in `levels/manifest.json` to put them in the campaign. See `levels/README.md`
for the format and a recommended naming convention.

## Desktop & Steam builds
```bash
npm install          # once
npm start            # run the game in Electron (Steam integration active if Steam runs)
npm run build:win          # NSIS installer for direct distribution → dist/
npm run build:steam-win    # raw depot folder for Steam            → dist/win-unpacked/
npm run build:steam-linux  # raw depot folder for Steam            → dist/linux-unpacked/
```
Tagging `v*` (or a manual workflow dispatch) makes CI build all three and attach
them as artifacts. The full shipping walkthrough — Steamworks setup, depot
configuration, steamcmd upload — lives in **[steam/README.md](steam/README.md)**.
