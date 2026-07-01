# Shipping to Steam

The game ships to Steam as an Electron app. The pipeline is:

```
engine.js ──build_engine.py──▶ index.html ──electron-builder──▶ dist/win-unpacked/
                                                                dist/linux-unpacked/
                                              │
                                   steamcmd + these .vdf scripts
                                              ▼
                                      Steam depot (build)
```

Steam does **not** take an installer — it takes a raw folder of files (a
"depot") and handles install/updates itself. That's why the Steam build
scripts use electron-builder's `dir` target, not the NSIS installer
(`npm run build:win` still makes the installer for itch.io / direct sales).

## One-time setup (Steamworks dashboard)

1. Pay the Steam Direct fee and create the app — you'll get an **App ID**.
2. Under **App Admin → SteamPipe → Depots**, create a Windows depot and
   (optionally) a Linux depot. Convention: depot IDs are AppID+1, AppID+2.
3. Under **Installation → General**, add launch options:
   - Windows: executable `Dungeonfolk Mim's Adventure.exe`
   - Linux: executable `dungeonfolk-mims-adventure`
4. Fill your IDs into the `TODO` placeholders in:
   - `steam/app_build.vdf` (AppID + depot list)
   - `steam/depot_windows.vdf`, `steam/depot_linux.vdf` (depot IDs)
   - `electron/main.js` (`STEAM_APP_ID`)
   - `steam_appid.txt` at the repo root (dev-only; never shipped)
5. Publish the changes (App Admin → Publish).

## Building the depot content

```bash
npm install                 # once; pulls Electron + steamworks.js
python3 build_engine.py     # make sure index.html has the latest engine
npm run build:steam-win     # → dist/win-unpacked/
npm run build:steam-linux   # → dist/linux-unpacked/
```

Sanity-check `dist/win-unpacked/` — it should contain the `.exe`,
`resources/app.asar` (your game), and Electron's support files.
`steam_appid.txt` must NOT be in there (the depot scripts also exclude it).

> Cross-building: the Windows `dir` target builds fine from Windows or CI;
> building Windows from Linux/macOS needs wine for exe metadata. The
> `desktop-build.yml` workflow builds each OS on its native runner.

## Uploading a build

Install [steamcmd](https://developer.valvesoftware.com/wiki/SteamCMD), then
from the `steam/` directory:

```bash
steamcmd +login <builder_account> +run_app_build "$(pwd)/app_build.vdf" +quit
```

- Use a dedicated builder account with *only* the "Edit App Metadata /
  Publish" permissions, protected by Steam Guard. The first login prompts
  for the Guard code; after that a sentry file caches the session.
- The build appears under **SteamPipe → Builds** in the dashboard. Nothing
  goes live until you press **"Set build live"** on a branch — uploads are
  always safe.
- For playtesting, set the build live on a private **beta branch** first
  (create one under SteamPipe → Builds), opt your own Steam client into it,
  and verify the game boots, the overlay works (Shift+Tab), and levels load.

## CI builds

`.github/workflows/desktop-build.yml` builds both depot folders on every
version tag (`v*`) or manual dispatch and uploads them as workflow
artifacts — download, spot-check, then run the steamcmd upload locally.

When you're ready to automate the upload itself, add the
[game-ci/steam-deploy](https://github.com/game-ci/steam-deploy) action to
that workflow with `STEAM_USERNAME` / `STEAM_CONFIG_VDF` repo secrets; the
docs there cover generating the config VDF from a Steam Guard login.

## Dev-mode testing (before you have an App ID)

`steam_appid.txt` at the repo root contains `480` (Valve's Spacewar test
app). With the Steam client running, `npm start` initialises the Steamworks
API against Spacewar so you can verify the integration plumbing — overlay
and achievements won't work until you use your real App ID.

## What the game already supports

- `electron/main.js` initialises Steamworks (gracefully skipped if Steam
  isn't running) and pumps its callbacks.
- Campaign levels ship inside the app (`levels/` + `manifest.json`).
- User levels: JSON dropped in `<userData>/user-levels/` appears in the
  level list — the natural hook for Steam Workshop later.
- `window.mimicNative.steam.unlockAchievement('ACH_...')` is wired through
  to the Steamworks API — define achievement API names in the dashboard,
  then call it from game code at the right moments.
