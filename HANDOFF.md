# Mission Control - Handoff Document

## Project Goal
Package Mission Control (Next.js 16 + Electron desktop app) as a consumer-grade downloadable product for OpenClaw users. Double-click install, no terminal, no Node.js, no dev setup. Ship on Windows, macOS, and Linux.

## Current Owner
Codex - macOS/Linux packaging prep completed; Windows-only host limitations isolated.

## Repo Location
`C:\Users\tomas\mission-control`

## Git State
- Branch: `mission-control-v2`
- Latest verified base commit: `0786c28`
- Note: `npm run dist:mac` and `npm run dist:linux` were re-run on this clean branch head after the cross-platform icon and auto-updater commits landed.

## Status
The Windows packaging path remains verified end-to-end. This pass completed the missing cross-platform icon assets and validated that the remaining macOS/Linux build failures on this Windows machine are host-environment limitations rather than missing repo configuration. The same outcomes were re-verified on top of commit `0786c28`.

- [x] Next.js `output: 'standalone'`
- [x] Electron production main process forks `.next/standalone/server.js`
- [x] First-run redirect to `/setup`
- [x] `npm run dist:win` builds `release/Mission Control Setup 1.0.0.exe`
- [x] Silent installer test completed to `C:\Users\tomas\AppData\Local\Programs\MissionControlTest`
- [x] Installed app launch verified: main window responds, packaged server binds `127.0.0.1:3847`, `/` returns `307` to `/setup`, `/setup` contains onboarding copy
- [ ] Visual splash confirmation was not possible from shell-only verification
- [x] Proper `.icns` icon for macOS is now generated at `electron/icon.icns`
- [x] High-res Linux icon is now generated at `electron/icon.png` (`1024x1024`)
- [x] `package.json` now points macOS packaging at `electron/icon.icns`
- [x] Linux packaging metadata now includes an author email for Debian packages
- [x] GitHub Actions workflow now exists to build Windows, macOS, and Linux artifacts on native runners
- [ ] `npm run dist:mac` still cannot complete on Windows because Electron Builder only supports macOS output on macOS
- [ ] `npm run dist:linux` still cannot complete the AppImage target on this Windows machine because AppImage creation requires symlink privileges not available in this environment
- [ ] Debian packaging now gets past metadata validation but still requires `fpm`, which is not available on this Windows host
- [x] HMAC-SHA256 license key validation implemented in `electron/main.prod.js` (offline, cryptographic, machine-fingerprinted)
- [x] Auto-updater implemented via `electron-updater` with GitHub Releases provider, native dialogs, and tray menu integration
- [ ] Release signing still needs a proper Windows/macOS certificate setup

Packaging fixes now in place:

- Updated the Electron Builder Linux desktop config to the current schema: `desktop.entry.StartupWMClass`
- Added `electron/prepare-standalone.js` to copy `public/` and `.next/static/` into `.next/standalone/` and replace standalone symlinks/junctions with real directories before packaging
- Updated `electron/generate-icon.js` to emit all required platform assets automatically: `256x256` Windows `.ico`, `1024x1024` Linux `.png`, and macOS `.icns`
- Updated dist scripts to regenerate the icon set automatically
- Updated top-level package metadata so Debian packaging has an author email
- Added `.github/workflows/desktop-builds.yml` so Windows, macOS, and Linux builds can run on native GitHub-hosted runners with Linux `fpm` installed
- Set `win.signAndEditExecutable: false` so local Windows builds do not fail on this machine's broken `winCodeSign` extraction path

## Files Changed

### Core Packaging
| File | Change |
|------|--------|
| `package.json` | Added standalone prep to build flow, icon generation to dist scripts, fixed Linux desktop schema, switched macOS packaging to `electron/icon.icns`, added Debian author email metadata, temporary `win.signAndEditExecutable: false` for local unsigned Windows builds |
| `electron/prepare-standalone.js` | Copies `public/` and `.next/static/` into standalone output and dereferences standalone links/junctions for Windows packaging |
| `electron/generate-icon.js` | Generates the full cross-platform icon set for Windows, macOS, and Linux |
| `electron/icon.icns` | Generated macOS application icon |
| `electron/icon.png` | Generated high-resolution Linux application icon |
| `.github/workflows/desktop-builds.yml` | Builds desktop artifacts on native GitHub Actions runners and uploads the generated installers/packages |

### License & Auto-Updater
| File | Change |
|------|--------|
| `electron/main.prod.js` | Added HMAC-SHA256 license validation, machine fingerprinting, `electron-updater` auto-update lifecycle, tray menu "Check for Updates" |
| `electron/preload.js` | Added updater IPC: `updaterCheck()`, `updaterDownload()`, `updaterInstall()`, `updaterStatus()`, `onUpdateStatus()` |
| `scripts/generate-license.js` | CLI tool for generating and validating HMAC-signed license keys |
| `src/app/activate/page.tsx` | Updated key format from 4-group to 5-group (`MC-XXXXX-XXXXX-XXXXX-XXXXX`) |

### Landing Page & SEO
| File | Change |
|------|--------|
| `website/index.html` | Full product landing page with premium dark theme, GEO optimization, structured data (SoftwareApplication, FAQPage, Organization), Open Graph, Twitter Cards |
| `website/robots.txt` | Allow all crawlers, sitemap reference |
| `website/sitemap.xml` | Single URL entry for landing page |

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

# Cross-platform icon generation
npm run prepare:icon

# Verified after icon generation:
# - electron/icon.ico exists (256x256)
# - electron/icon.png exists (1024x1024)
# - electron/icon.icns exists

# macOS packaging check on Windows host
npm run dist:mac

# Result:
# - prepare:icon succeeded
# - npm run build succeeded
# - electron-builder stopped with "Build for macOS is supported only on macOS"

# Linux packaging check on Windows host
npm run dist:linux

# Result:
# - prepare:icon succeeded
# - npm run build succeeded
# - AppImage target stopped on Windows symlink privilege error while creating icon links

# Debian packaging metadata check
.\node_modules\.bin\electron-builder.cmd --linux deb

# Result:
# - packaging progressed past the previous missing-author-email error
# - build then stopped because `fpm` is not installed on this Windows host

# Native-runner build automation
# - Added .github/workflows/desktop-builds.yml
# - Windows job builds NSIS artifacts on windows-latest
# - macOS job builds DMG artifacts on macos-latest
# - Linux job installs fpm and builds AppImage + deb on ubuntu-latest
# - Workflow uses `--publish never` so CI builds artifacts without requiring release publication
```

## Open Questions
1. Should `win.signAndEditExecutable: false` remain only as a local-build workaround, or should Windows packaging move to a proper signing-capable setup immediately?
2. Should `asarUnpack` be used for just the standalone server instead of `asar: false`?
3. Do we already have Windows Authenticode and Apple Developer ID certificates?
4. Distribution: GitHub Releases, own website, or something like Gumroad/LemonSqueezy?

## Completed Decisions
- **License validation**: Offline HMAC-SHA256 with machine fingerprinting. Keys are format `MC-XXXXX-XXXXX-XXXXX-XXXXX`, generated via `npm run generate:keys`. Secret is `MC_LICENSE_SECRET` env var. See `scripts/generate-license.js` and `electron/main.prod.js`.
- **Auto-updater**: `electron-updater` with GitHub Releases provider. Native dialogs for download/restart prompts. "Check for Updates" in tray menu. 5-second delayed check on app ready (packaged builds only).

## Next Steps
1. Run the `Desktop Builds` GitHub Actions workflow via `workflow_dispatch` or a release tag to produce native Windows/macOS/Linux artifacts
2. Decide whether to keep or replace the local Windows `signAndEditExecutable: false` workaround before release builds
3. Revisit `asar` vs `asarUnpack` to reduce package size
4. Create dashboard screenshot and OG image for the landing page
5. Set up payment integration (LemonSqueezy/Stripe) for license key fulfillment
6. Deploy landing page to production (Vercel/Netlify)
7. Change `MC_LICENSE_SECRET` from placeholder before shipping
