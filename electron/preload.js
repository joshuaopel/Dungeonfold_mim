'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Expose the native bridge to the renderer under window.mimicNative.
// This is the exact interface the game checks for (see bootLevels / loadNativeLevels).
// The renderer never gets raw Node / IPC access — only what's listed here.
contextBridge.exposeInMainWorld('mimicNative', {

  // ── Level loading ──────────────────────────────────────────────────────
  // loadNativeLevels() in index.html calls both of these on startup.
  loadCampaign:   () => ipcRenderer.invoke('loadCampaign'),
  loadUserLevels: () => ipcRenderer.invoke('loadUserLevels'),

  // ── Steam extras ───────────────────────────────────────────────────────
  // Optional: check window.mimicNative.steam before calling these so the
  // game stays compatible with the browser build where steam is absent.
  steam: {
    getPlayerName:     ()  => ipcRenderer.invoke('steam:getPlayerName'),
    unlockAchievement: (n) => ipcRenderer.invoke('steam:unlockAchievement', n),
  },
});
