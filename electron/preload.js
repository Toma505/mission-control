const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // License
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (data) => ipcRenderer.invoke('activate-license', data),

  // Platform info
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Auto-launch (start on login)
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
})
