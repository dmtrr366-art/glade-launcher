/**
 * Glade Launcher — Electron Preload Script
 * Предоставляет безопасный мост между интерфейсом лаунчера и системным окном.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  launchGame: (options) => ipcRenderer.invoke('launch-game', options),
  openFolder: (type) => ipcRenderer.invoke('open-folder', type),
  getPaths: () => ipcRenderer.invoke('get-paths'),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
