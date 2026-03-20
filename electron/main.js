/**
 * Development Electron main process.
 * Cross-platform: Windows, macOS, Linux.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, dialog, clipboard } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')
const fs = require('fs')
const os = require('os')
const AutoLaunch = require('auto-launch')
const { createSessionToken, loadOrCreateConfigEncryptionKey } = require('./security-context')

// ─── Cross-platform user data path ──────────────────────────
function getUserDataPath() {
  const appName = 'MissionControl'
  switch (process.platform) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Roaming', appName)
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName)
    default:
      return path.join(os.homedir(), '.config', appName.toLowerCase())
  }
}

const userDataPath = getUserDataPath()
try { fs.mkdirSync(userDataPath, { recursive: true }) } catch {}
app.setPath('userData', userDataPath)
const logsPath = path.join(userDataPath, 'logs')
try { fs.mkdirSync(logsPath, { recursive: true }) } catch {}
app.setAppLogsPath(logsPath)

let mainWindow = null
let tray = null
let nextProcess = null
const PORT = 3000
const APP_HOSTS = new Set(['127.0.0.1', 'localhost'])
const DESKTOP_SETTINGS_FILE = path.join(userDataPath, 'desktop-settings.json')
const DEFAULT_DESKTOP_SETTINGS = {
  closeToTray: true,
}
let sessionToken = ''
let configEncryptionKey = ''

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
    return
  }

  createWindow()
}

function readDesktopSettings() {
  try {
    return {
      ...DEFAULT_DESKTOP_SETTINGS,
      ...JSON.parse(fs.readFileSync(DESKTOP_SETTINGS_FILE, 'utf-8')),
    }
  } catch {
    return { ...DEFAULT_DESKTOP_SETTINGS }
  }
}

function writeDesktopSettings(nextSettings) {
  fs.writeFileSync(DESKTOP_SETTINGS_FILE, JSON.stringify(nextSettings, null, 2))
  return nextSettings
}

function isCloseToTrayEnabled() {
  return readDesktopSettings().closeToTray !== false
}

function getIconPath() {
  if (process.platform === 'win32') return path.join(__dirname, 'icon.ico')
  const pngPath = path.join(__dirname, 'icon.png')
  if (fs.existsSync(pngPath)) return pngPath
  return path.join(__dirname, 'icon.ico')
}

function getDataDir() {
  return path.join(userDataPath, 'data')
}

function getLogsPath() {
  return app.getPath('logs')
}

function isTrustedAppUrl(target) {
  try {
    const url = new URL(target)
    return url.protocol === 'http:' && APP_HOSTS.has(url.hostname) && url.port === String(PORT)
  } catch {
    return false
  }
}

function isAllowedExternalUrl(target) {
  try {
    const url = new URL(target)
    return url.protocol === 'https:' || url.protocol === 'mailto:'
  } catch {
    return false
  }
}

function openExternalSafely(target) {
  if (isAllowedExternalUrl(target)) {
    return shell.openExternal(target)
  }

  console.warn('[mc] Blocked external URL:', target)
  return Promise.resolve()
}

function hardenWindow(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedAppUrl(url)) {
      return { action: 'allow' }
    }

    void openExternalSafely(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url)) return

    event.preventDefault()
    void openExternalSafely(url)
  })

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Mission Control',
    backgroundColor: '#09090b',
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: true,
    icon: getIconPath(),
  })

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
  hardenWindow(mainWindow)

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription)
    setTimeout(() => mainWindow?.loadURL(`http://127.0.0.1:${PORT}`), 2000)
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting && isCloseToTrayEnabled()) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const autoLauncher = new AutoLaunch({
  name: 'Mission Control',
  isHidden: true,
})

async function createTray() {
  const iconPath = getIconPath()
  let trayIcon

  if (process.platform === 'darwin') {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
    trayIcon.setTemplateImage(true)
  } else {
    trayIcon = iconPath
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Mission Control')
  tray.on('double-click', () => showMainWindow())
  await refreshTrayMenu()
}

async function refreshTrayMenu() {
  if (!tray) return

  let autoLaunchEnabled = false
  try { autoLaunchEnabled = await autoLauncher.isEnabled() } catch {}

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Mission Control', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: 'Start on Login',
      type: 'checkbox',
      checked: autoLaunchEnabled,
      click: async (item) => {
        try {
          if (item.checked) await autoLauncher.enable()
          else await autoLauncher.disable()
        } catch {}
        refreshTrayMenu()
      },
    },
    {
      label: 'Close to Tray',
      type: 'checkbox',
      checked: isCloseToTrayEnabled(),
      click: (item) => {
        try {
          writeDesktopSettings({
            ...readDesktopSettings(),
            closeToTray: item.checked,
          })
        } catch {}
        refreshTrayMenu()
      },
    },
    {
      label: 'Check for Updates...',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Updates',
          message: 'Updates are disabled in development mode.',
        })
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
}

function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      socket.on('connect', () => { socket.destroy(); resolve() })
      socket.on('timeout', () => {
        socket.destroy()
        if (n > 0) setTimeout(() => attempt(n - 1), 1000)
        else reject(new Error('Server did not start'))
      })
      socket.on('error', () => {
        if (n > 0) setTimeout(() => attempt(n - 1), 1000)
        else reject(new Error('Server did not start'))
      })
      socket.connect(port, '127.0.0.1')
    }
    attempt(retries)
  })
}

function startNextServer() {
  const projectDir = path.join(__dirname, '..')
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const dataDir = getDataDir()

  nextProcess = spawn(npmCmd, ['run', 'dev', '--', '-H', '127.0.0.1'], {
    cwd: projectDir,
    stdio: 'pipe',
    env: {
      ...process.env,
      MC_DATA_DIR: dataDir,
      MC_SESSION_TOKEN: sessionToken,
      MC_CONFIG_ENCRYPTION_KEY: configEncryptionKey,
    },
  })

  nextProcess.stdout?.on('data', (data) => process.stdout.write(`[next] ${data}`))
  nextProcess.stderr?.on('data', (data) => process.stderr.write(`[next] ${data}`))
  nextProcess.on('error', (err) => console.error('Failed to start Next.js:', err))
}

async function checkServerRunning() {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(500)
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
    socket.on('error', () => { resolve(false) })
    socket.connect(PORT, '127.0.0.1')
  })
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.handle('get-platform', () => process.platform)
ipcMain.handle('get-session-token', () => sessionToken)
ipcMain.handle('get-desktop-diagnostics', async () => {
  let autoLaunchEnabled = false
  try { autoLaunchEnabled = await autoLauncher.isEnabled() } catch {}

  return {
    appName: app.getName(),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    port: PORT,
    paths: {
      appPath: app.getAppPath(),
      execPath: process.execPath,
      userData: userDataPath,
      data: getDataDir(),
      logs: getLogsPath(),
      settingsFile: DESKTOP_SETTINGS_FILE,
      licenseFile: path.join(userDataPath, 'license.json'),
    },
    features: {
      autoLaunchEnabled,
      closeToTrayEnabled: isCloseToTrayEnabled(),
    },
    updateStatus: { status: 'dev', info: null, error: 'Updates disabled in dev mode', progress: null },
  }
})
ipcMain.handle('open-data-directory', async () => {
  try { fs.mkdirSync(getDataDir(), { recursive: true }) } catch {}
  const result = await shell.openPath(getDataDir())
  return result ? { ok: false, error: result } : { ok: true }
})
ipcMain.handle('open-logs-directory', async () => {
  try { fs.mkdirSync(getLogsPath(), { recursive: true }) } catch {}
  const result = await shell.openPath(getLogsPath())
  return result ? { ok: false, error: result } : { ok: true }
})
ipcMain.handle('copy-text', (_, text) => {
  clipboard.writeText(String(text || ''))
  return { ok: true }
})
ipcMain.handle('quit-app', () => {
  app.isQuitting = true
  app.quit()
  return { ok: true }
})
ipcMain.handle('get-auto-launch', async () => {
  try { return await autoLauncher.isEnabled() }
  catch { return false }
})
ipcMain.handle('set-auto-launch', async (_, enabled) => {
  try {
    if (enabled) await autoLauncher.enable()
    else await autoLauncher.disable()
    refreshTrayMenu()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
ipcMain.handle('get-close-to-tray', () => isCloseToTrayEnabled())
ipcMain.handle('set-close-to-tray', (_, enabled) => {
  try {
    writeDesktopSettings({
      ...readDesktopSettings(),
      closeToTray: !!enabled,
    })
    refreshTrayMenu()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
ipcMain.handle('updater-check', () => ({ status: 'dev', info: null, error: 'Updates disabled in dev mode', progress: null }))
ipcMain.handle('updater-download', () => ({ status: 'dev', info: null, error: 'Updates disabled in dev mode', progress: null }))
ipcMain.handle('updater-install', () => ({ status: 'dev', info: null, error: 'Updates disabled in dev mode', progress: null }))
ipcMain.handle('updater-status', () => ({ status: 'dev', info: null, error: 'Updates disabled in dev mode', progress: null }))

app.on('ready', async () => {
  sessionToken = createSessionToken()
  configEncryptionKey = loadOrCreateConfigEncryptionKey(userDataPath)
  if (!configEncryptionKey) {
    console.warn('[mc] Secure credential storage is unavailable; development mode will fall back to plaintext connection storage.')
  }
  createTray()

  const running = await checkServerRunning()

  if (!running) {
    startNextServer()
    try {
      await waitForServer(PORT)
    } catch {
      console.error('Could not start Next.js server')
      app.quit()
      return
    }
  }

  createWindow()
})

app.on('window-all-closed', () => {
  if (app.isQuitting || !isCloseToTrayEnabled()) {
    app.quit()
  }
})

app.on('activate', () => {
  showMainWindow()
})

app.on('before-quit', () => {
  if (nextProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(nextProcess.pid), '/f', '/t'])
    } else {
      nextProcess.kill('SIGTERM')
    }
    nextProcess = null
  }
})
