# Mission Control - Handoff Document

## Project Goal
Package Mission Control (Next.js 16 + Electron desktop app) as a consumer-grade downloadable product for OpenClaw users. Double-click install, no terminal, no Node.js, no dev setup. Ship on Windows, macOS, and Linux.

## Current Owner
Codex - Windows installer build and packaged runtime verification completed.

## Repo Location
`C:\Users\tomas\mission-control`

## Git State
- Branch: `mission-control-v2`
- Latest commit: `f6ff931`
- Note: `git status --short --untracked-files=all` returned clean at the end of this verification pass.

## Status
The Windows packaging path has now been tested end-to-end. `npm run dist:win` succeeds, the NSIS installer is produced, the installer can be run, and the installed app launches and serves the packaged Next.js app on `127.0.0.1:3847`.

- [x] Next.js `output: 'standalone'`
- [x] Electron production main process forks `.next/standalone/server.js`
- [x] First-run redirect to `/setup`
- [x] `npm run dist:win` builds `release/Mission Control Setup 1.0.0.exe`
- [x] Silent installer test completed to `C:\Users\tomas\AppData\Local\Programs\MissionControlTest`
- [x] Installed app launch verified: main window responds, packaged server binds `127.0.0.1:3847`, `/` returns `307` to `/setup`, `/setup` contains onboarding copy
- [ ] Visual splash confirmation was not possible from shell-only verification
- [ ] Proper `.icns` icon for macOS and high-res `.png` for Linux still need to be generated
- [ ] Server-side license validation still not implemented
- [ ] Auto-updater still not implemented
- [ ] Release signing still needs a proper Windows/macOS certificate setup

Windows-specific packaging fixes added during this pass:

- Updated the Electron Builder Linux desktop config to the current schema: `desktop.entry.StartupWMClass`
- Added `electron/prepare-standalone.js` to copy `public/` and `.next/static/` into `.next/standalone/` and replace standalone symlinks/junctions with real directories before packaging
- Updated `electron/generate-icon.js` to emit a valid `256x256` Windows `.ico`
- Updated dist scripts to regenerate the Windows icon automatically
- Set `win.signAndEditExecutable: false` so local Windows builds do not fail on this machine's broken `winCodeSign` extraction path

## Files Changed

### Core Packaging
| File | Change |
|------|--------|
| `package.json` | Added standalone prep to build flow, icon generation to dist scripts, fixed Linux desktop schema, temporary `win.signAndEditExecutable: false` for local unsigned Windows builds |
| `electron/prepare-standalone.js` | Copies `public/` and `.next/static/` into standalone output and dereferences standalone links/junctions for Windows packaging |
| `electron/generate-icon.js` | Generates a proper `256x256` Windows icon instead of a `64x64` icon |

### Existing Packaging Path Confirmed
| File | Role |
|------|------|
| `electron/main.prod.js` | Launches the packaged standalone server and the desktop shell |
| `next.config.ts` | Keeps Next in `output: 'standalone'` mode |
| `src/middleware.ts` | Redirects unconfigured users to `/setup` |
| `src/app/setup/page.tsx` | Provides the onboarding flow verified during packaged runtime tests |

## Verification
```bash
cd C:\Users\tomas\mission-control

# Standalone build
npm run build

# Verified after build:
# - .next/standalone/server.js exists
# - .next/standalone/public exists
# - .next/standalone/.next/static exists
# - standalone Prisma junctions were replaced with real directories

# Windows installer build
npm run dist:win

# Produced:
# - release/Mission Control Setup 1.0.0.exe
# - release/Mission Control Setup 1.0.0.exe.blockmap

# Silent installer test
release/Mission Control Setup 1.0.0.exe /S /D=%LOCALAPPDATA%\Programs\MissionControlTest

# Installed app runtime verification
# - Mission Control.exe launches and main window responds
# - packaged child process launches .next/standalone/server.js
# - port 3847 binds on 127.0.0.1
# - GET / returns HTTP 307 with Location: /setup
# - GET /setup contains "Welcome to Mission Control" and "Get Started"
```

## Open Questions
1. Should `win.signAndEditExecutable: false` remain only as a local-build workaround, or should Windows packaging move to a proper signing-capable setup immediately?
2. Should `asarUnpack` be used for just the standalone server instead of `asar: false`?
3. License validation: keep offline-only or build a simple validation server?
4. Auto-updater: GitHub Releases plus `electron-updater`, or a custom update server?
5. Do we already have Windows Authenticode and Apple Developer ID certificates?
6. Distribution: GitHub Releases, own website, or something like Gumroad?

## Next Steps
1. Decide whether to keep or replace the local Windows `signAndEditExecutable: false` workaround before release builds
2. Generate proper icon files for macOS and Linux
3. Test `npm run dist:mac` and `npm run dist:linux`
4. Revisit `asar` vs `asarUnpack` to reduce package size
5. Add real license validation and fulfillment
6. Add auto-updater and release/distribution plumbing
