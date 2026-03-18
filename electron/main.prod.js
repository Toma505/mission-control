/**
 * Production Electron main process.
 *
 * Consumer-grade: double-click → app opens. No terminal, no npm, no Node.js install.
 * Uses Next.js standalone output — the server is bundled inside the app.
 * Cross-platform: Windows, macOS, Linux.
 */

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage } = require('electron')
const { fork, spawn } = require('child_process')
const path = require('path')
const net = require('net')
const fs = require('fs')
const os = require('os')
const AutoLaunch = require('auto-launch')

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

let mainWindow = null
let splashWindow = null
let tray = null
let serverProcess = null
const PORT = 3847

// ─── Paths ──────────────────────────────────────────────────

function getAppRoot() {
  // In packaged app: resources/app/  In dev: project root
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app')
  }
  return path.join(__dirname, '..')
}

function getStandaloneServerPath() {
  const appRoot = getAppRoot()
  return path.join(appRoot, '.next', 'standalone', 'server.js')
}

function getIconPath() {
  if (process.platform === 'win32') return path.join(__dirname, 'icon.ico')
  const pngPath = path.join(__dirname, 'icon.png')
  if (fs.existsSync(pngPath)) return pngPath
  return path.join(__dirname, 'icon.ico')
}

// ─── Data directory ─────────────────────────────────────────
// Connection config and budget data persist in userData, not the app bundle
function getDataDir() {
  return path.join(userDataPath, 'data')
}

function ensureDataDir() {
  const dataDir = getDataDir()
  try { fs.mkdirSync(dataDir, { recursive: true }) } catch {}

  // Copy default data files on first run
  const appDataDir = path.join(getAppRoot(), 'data')
  if (fs.existsSync(appDataDir)) {
    for (const file of fs.readdirSync(appDataDir)) {
      const dest = path.join(dataDir, file)
      if (!fs.existsSync(dest)) {
        try { fs.copyFileSync(path.join(appDataDir, file), dest) } catch {}
      }
    }
  }
}

// ─── License ────────────────────────────────────────────────

const LICENSE_FILE = path.join(userDataPath, 'license.json')

function readLicense() {
  try { return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8')) }
  catch { return null }
}

function saveLicense(key, email) {
  fs.writeFileSync(LICENSE_FILE, JSON.stringify({ key, email, activatedAt: new Date().toISOString() }))
}

function validateLicenseKey(key) {
  if (!key || typeof key !== 'string') return false
  return /^MC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.toUpperCase())
}

ipcMain.handle('check-license', () => {
  const license = readLicense()
  return { valid: !!license, email: license?.email || null }
})

ipcMain.handle('activate-license', (_, { key, email }) => {
  if (!validateLicenseKey(key)) {
    return { ok: false, error: 'Invalid license key format. Expected: MC-XXXX-XXXX-XXXX' }
  }
  saveLicense(key.toUpperCase(), email)
  return { ok: true }
})

ipcMain.handle('get-platform', () => process.platform)

// ─── Auto Launch ────────────────────────────────────────────

const autoLauncher = new AutoLaunch({
  name: 'Mission Control',
  isHidden: true, // Start minimized to tray
})

ipcMain.handle('get-auto-launch', async () => {
  try { return await autoLauncher.isEnabled() }
  catch { return false }
})

ipcMain.handle('set-auto-launch', async (_, enabled) => {
  try {
    if (enabled) await autoLauncher.enable()
    else await autoLauncher.disable()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ─── Splash Screen ──────────────────────────────────────────

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    icon: getIconPath(),
  })

  // Inline HTML splash — no external file needed
  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
        background: rgba(9, 9, 11, 0.95);
        color: #ececef;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.06);
        -webkit-app-region: drag;
        overflow: hidden;
      }
      .logo {
        width: 64px; height: 64px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 16px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 20px;
        animation: pulse 2s ease-in-out infinite;
      }
      .logo svg { width: 32px; height: 32px; }
      h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 8px; }
      p { font-size: 13px; color: #87878f; margin-bottom: 24px; }
      .loader {
        width: 120px; height: 3px;
        background: rgba(255,255,255,0.06);
        border-radius: 3px;
        overflow: hidden;
      }
      .loader-bar {
        width: 40%;
        height: 100%;
        background: #3b82f6;
        border-radius: 3px;
        animation: slide 1.5s ease-in-out infinite;
      }
      @keyframes slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    </style></head>
    <body>
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <h1>Mission Control</h1>
      <p>Starting up...</p>
      <div class="loader"><div class="loader-bar"></div></div>
    </body>
    </html>
  `

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)
}

// ─── Main Window ────────────────────────────────────────────

function createWindow() {
  const iconPath = getIconPath()

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
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    icon: iconPath,
  })

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`)

  mainWindow.once('ready-to-show', () => {
    // Close splash and show main window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => mainWindow?.loadURL(`http://127.0.0.1:${PORT}`), 2000)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── System Tray ────────────────────────────────────────────

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

  // Check auto-launch state for the toggle
  let autoLaunchEnabled = false
  try { autoLaunchEnabled = await autoLauncher.isEnabled() } catch {}

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Mission Control', click: () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus() }
      else createWindow()
    }},
    { type: 'separator' },
    { label: 'Start on Login', type: 'checkbox', checked: autoLaunchEnabled, click: async (item) => {
      try {
        if (item.checked) await autoLauncher.enable()
        else await autoLauncher.disable()
      } catch {}
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() }},
  ])

  tray.setToolTip('Mission Control')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
  })
}

// ─── Server ─────────────────────────────────────────────────

function waitForServer(port, retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      socket.on('connect', () => { socket.destroy(); resolve() })
      socket.on('timeout', () => {
        socket.destroy()
        if (n > 0) setTimeout(() => attempt(n - 1), 500)
        else reject(new Error('Server did not start'))
      })
      socket.on('error', () => {
        if (n > 0) setTimeout(() => attempt(n - 1), 500)
        else reject(new Error('Server did not start'))
      })
      socket.connect(port, '127.0.0.1')
    }
    attempt(retries)
  })
}

function startServer() {
  const serverPath = getStandaloneServerPath()
  const appRoot = getAppRoot()
  const dataDir = getDataDir()

  if (app.isPackaged && fs.existsSync(serverPath)) {
    // ── Production: run the standalone Next.js server directly ──
    // Uses Electron's bundled Node.js — no system Node needed
    console.log('[mc] Starting standalone server:', serverPath)

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        // Point data directory to user's persistent storage
        MC_DATA_DIR: dataDir,
      },
      cwd: path.dirname(serverPath),
      stdio: 'pipe',
    })
  } else {
    // ── Development: fall back to npm run ──
    console.log('[mc] Dev mode — starting via npm')
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

    serverProcess = spawn(npmCmd, ['run', 'dev', '--', '-H', '127.0.0.1', '-p', String(PORT)], {
      cwd: appRoot,
      stdio: 'pipe',
      env: { ...process.env, PORT: String(PORT) },
    })
  }

  serverProcess.stdout?.on('data', (d) => process.stdout.write(`[next] ${d}`))
  serverProcess.stderr?.on('data', (d) => process.stderr.write(`[next] ${d}`))
  serverProcess.on('error', (err) => console.error('[mc] Server error:', err))
}

function killServer() {
  if (!serverProcess) return

  if (process.platform === 'win32') {
    // Windows: kill the entire process tree
    try { spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']) } catch {}
  } else {
    try { serverProcess.kill('SIGTERM') } catch {}
  }

  serverProcess = null
}

// ─── Window Controls ────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

// ─── App Lifecycle ──────────────────────────────────────────

// Prevent multiple instances — single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to open a second instance — focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.on('ready', async () => {
  ensureDataDir()
  createSplashWindow()
  createTray()

  startServer()

  try {
    await waitForServer(PORT)
  } catch {
    console.error('[mc] Could not start server')
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
    app.quit()
    return
  }

  createWindow()
})

app.on('window-all-closed', () => {
  // Keep running in system tray on all platforms
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

app.on('before-quit', () => {
  killServer()
})
