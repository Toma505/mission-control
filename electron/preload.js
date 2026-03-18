const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  quit: () => ipcRenderer.invoke('quit-app'),

  // License
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (data) => ipcRenderer.invoke('activate-license', data),

  // Platform info
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Auto-launch (start on login)
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  // Desktop behavior
  getCloseToTray: () => ipcRenderer.invoke('get-close-to-tray'),
  setCloseToTray: (enabled) => ipcRenderer.invoke('set-close-to-tray', enabled),

  // Auto-updater
  updaterCheck: () => ipcRenderer.invoke('updater-check'),
  updaterDownload: () => ipcRenderer.invoke('updater-download'),
  updaterInstall: () => ipcRenderer.invoke('updater-install'),
  updaterStatus: () => ipcRenderer.invoke('updater-status'),
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
})
