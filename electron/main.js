'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Steam ──────────────────────────────────────────────────────────────────
// Before shipping, replace STEAM_APP_ID with the App ID assigned in your
// Steamworks Partner dashboard.  During development steam_appid.txt = 480
// (Valve's Spacewar test app) lets the SDK init without a real ID — overlay
// and achievements won't fire, but everything else works normally.
const STEAM_APP_ID = 480; // TODO: replace with real App ID

let steam = null;
try {
  steam = require('steamworks.js').init(STEAM_APP_ID);
  console.log('[steam] initialised — player:', steam.localplayer.getName());
  // steamworks.js needs periodic callback pumping for achievements etc. to flush.
  setInterval(() => { try { steam.runCallbacks(); } catch (_) {} }, 33);
} catch (e) {
  console.warn('[steam] not available (Steam not running or SDK missing) —', e.message);
}

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 540,
    title: "Dungeonfolk: Mim's Adventure",
    backgroundColor: '#0f0a16',
    // icon: path.join(__dirname, 'icon.ico'),  // add a 256×256 icon here
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer is fully isolated
      nodeIntegration: false,   // renderer cannot use Node APIs directly
      sandbox: false,           // preload needs require('electron')
    },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.setMenu(null); // no native menu bar in-game
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── IPC: levels ────────────────────────────────────────────────────────────

// Campaign levels: read levels/manifest.json, load each file in order.
// Mirrors the loadManifest() web path so level JSON is the single source of
// truth whether the game runs in a browser or in Electron.
ipcMain.handle('loadCampaign', async () => {
  const levelsDir = path.join(__dirname, '..', 'levels');
  const raw = JSON.parse(fs.readFileSync(path.join(levelsDir, 'manifest.json'), 'utf8'));
  const files = Array.isArray(raw) ? raw : (raw.levels || []);
  return files
    .map(f => path.join(levelsDir, ...String(f).split('/')))
    .filter(fp => fs.existsSync(fp))
    .map(fp => JSON.parse(fs.readFileSync(fp, 'utf8')));
});

// User / Workshop levels: JSON files placed in <userData>/user-levels/.
// On Windows this is %APPDATA%\Dungeonfolk Mim's Adventure\user-levels\.
// Steam Workshop downloads would be copied here by a Workshop sync handler
// (add that when Workshop is enabled in your Steamworks config).
ipcMain.handle('loadUserLevels', async () => {
  const userDir = path.join(app.getPath('userData'), 'user-levels');
  if (!fs.existsSync(userDir)) return [];
  return fs.readdirSync(userDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(userDir, f), 'utf8')); }
      catch (_) { return null; }
    })
    .filter(Boolean);
});

// ── IPC: Steam extras ──────────────────────────────────────────────────────

// Steam display name — useful for showing "Welcome back, <name>" in the UI.
ipcMain.handle('steam:getPlayerName', () =>
  steam ? steam.localplayer.getName() : null
);

// Unlock a Steam achievement by its API name as defined in the Steamworks
// dashboard (e.g. 'ACH_FIRST_ESCAPE').  Call from game JS via:
//   if (window.mimicNative?.steam) mimicNative.steam.unlockAchievement('ACH_...')
ipcMain.handle('steam:unlockAchievement', (_, apiName) => {
  if (!steam) return false;
  try { steam.achievement.activate(apiName); return true; }
  catch (e) { console.error('[steam] achievement unlock failed:', e); return false; }
});
