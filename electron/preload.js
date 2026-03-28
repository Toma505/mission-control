const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  quit: () => ipcRenderer.invoke('quit-app'),

  // Platform info
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getSessionToken: () => ipcRenderer.invoke('get-session-token'),
  getDesktopDiagnostics: () => ipcRenderer.invoke('get-desktop-diagnostics'),
  openDataDirectory: () => ipcRenderer.invoke('open-data-directory'),
  openLogsDirectory: () => ipcRenderer.invoke('open-logs-directory'),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),

  // Auto-launch (start on login)
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  // Desktop behavior
  getCloseToTray: () => ipcRenderer.invoke('get-close-to-tray'),
  setCloseToTray: (enabled) => ipcRenderer.invoke('set-close-to-tray', enabled),

  // Notifications
  showNotification: (opts) => ipcRenderer.invoke('show-notification', opts),
  setNotificationBadge: (count) => ipcRenderer.invoke('set-notification-badge', count),

  // Backup & Restore
  createBackup: () => ipcRenderer.invoke('create-backup'),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),

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
