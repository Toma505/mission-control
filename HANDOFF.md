# Mission Control - Handoff Document

## Project Goal
Package Mission Control (Next.js 16 + Electron desktop app) as a consumer-grade downloadable product for OpenClaw users. Double-click install, no terminal, no Node.js, no dev setup. Ship on Windows, macOS, and Linux.

## Current Owner
Ready for final pre-merge review. Both lanes (Claude: app flows, Codex: desktop shell) completed and QA-verified on installed build.

## Repo Location
`C:\Users\tomas\mission-control`

## Git State
- Branch: `mission-control-v2`
- Latest commit: `8c8749b` (updater repo metadata fix)
- Previous: `95fa020` (budget race fix), `a319112` (release secret enforcement)
- Note: GitHub Actions run `23226926821` completed successfully for `mission-control-v2` after CI fixes in commits `6afd518` and `1a883fe`.

## Status
The Windows packaging path remains verified end-to-end. Cross-platform packaging is now also verified on native GitHub runners: Desktop Builds run `23226926821` passed on Windows, macOS, and Linux for commit `1a883fe`.

Round 4 is now in place on the current branch head: packaged builds require a real `MC_LICENSE_SECRET`, the packaged app hard-fails at startup if the embedded release secret is invalid, the GitHub updater metadata now points at the real repository (`Toma505/mission-control`), and the installed Windows app was exercised directly for activation, diagnostics copy, updater invocation, and close-to-tray/relaunch/quit behavior.

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
- [x] GitHub Actions `Desktop Builds` run `23226926821` passed on all 3 platforms for `mission-control-v2`
- [ ] `npm run dist:mac` still cannot complete on Windows because Electron Builder only supports macOS output on macOS
- [ ] `npm run dist:linux` still cannot complete the AppImage target on this Windows machine because AppImage creation requires symlink privileges not available in this environment
- [ ] Debian packaging now gets past metadata validation but still requires `fpm`, which is not available on this Windows host
- [x] HMAC-SHA256 license key validation implemented in `electron/main.prod.js` (offline, cryptographic, machine-fingerprinted)
- [x] Auto-updater implemented via `electron-updater` with GitHub Releases provider, native dialogs, and tray menu integration
- [x] Desktop support surface added behind the profile menu avatar: About, runtime diagnostics, local path access, and clipboard export
- [ ] Release signing still needs a proper Windows/macOS certificate setup

Packaging fixes now in place:

- Updated the Electron Builder Linux desktop config to the current schema: `desktop.entry.StartupWMClass`
- Added `electron/prepare-standalone.js` to copy `public/` and `.next/static/` into `.next/standalone/` and replace standalone symlinks/junctions with real directories before packaging
- Updated `electron/generate-icon.js` to emit all required platform assets automatically: `256x256` Windows `.ico`, `1024x1024` Linux `.png`, and macOS `.icns`
- Updated dist scripts to regenerate the icon set automatically
- Updated top-level package metadata so Debian packaging has an author email
- Added `.github/workflows/desktop-builds.yml` so Windows, macOS, and Linux builds can run on native GitHub-hosted runners with Linux `fpm` installed
- Excluded `prisma/seed.ts` from the app TypeScript project so packaging CI does not typecheck a dev-only seed script
- Added Prisma client generation to the normal install/build path so fresh CI runners can typecheck and package the app successfully
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
| `tsconfig.json` | Excludes `prisma/seed.ts` from the Next.js/TypeScript app build |
| `package.json` | Adds `db:generate` and `postinstall`, and runs Prisma client generation before packaging builds |
| `.github/workflows/desktop-builds.yml` | Builds desktop artifacts on native GitHub Actions runners and uploads the generated installers/packages |

### License & Auto-Updater
| File | Change |
|------|--------|
| `electron/license-secret.js` | Shared release-secret validation for packaged runtime and CLI tooling; rejects missing, placeholder, or too-short secrets |
| `electron/prepare-license-secret.js` | Build-time step that embeds a validated release secret into the packaged app and fails packaging if `MC_LICENSE_SECRET` is missing or still a placeholder |
| `electron/main.prod.js` | Added HMAC-SHA256 license validation, machine fingerprinting, `electron-updater` auto-update lifecycle, tray menu "Check for Updates" |
| `electron/preload.js` | Added updater IPC: `updaterCheck()`, `updaterDownload()`, `updaterInstall()`, `updaterStatus()`, `onUpdateStatus()` |
| `scripts/generate-license.js` | CLI tool for generating and validating HMAC-signed license keys; now refuses to run without a real release secret |
| `package.json` | Added `prepare:license`, enforced it in all desktop packaging scripts (`dist`, `dist:win`, `dist:mac`, `dist:linux`), and corrected GitHub publish metadata to the real repo owner |
| `.github/workflows/desktop-builds.yml` | Desktop CI now injects `MC_LICENSE_SECRET` and runs `prepare:license` before packaging |
| `.gitignore` | Ignores the generated embedded release-secret file used only during packaging |
| `src/app/activate/page.tsx` | Updated key format from 4-group to 5-group (`MC-XXXXX-XXXXX-XXXXX-XXXXX`) |

### Desktop Support & Diagnostics
| File | Change |
|------|--------|
| `src/components/layout/about-diagnostics-modal.tsx` | New desktop-only support modal with version/build details, runtime state, local paths, copy-to-clipboard diagnostics, and folder actions |
| `src/components/layout/profile-menu.tsx` | Added `About & Diagnostics` entry to the avatar menu and wired the support modal into the desktop shell |
| `electron/preload.js` | Exposed diagnostics and support IPC for runtime info, folder access, and clipboard copy |
| `electron/main.prod.js` | Added packaged-app diagnostics payload, stable logs path, and support actions for opening data/log folders and copying diagnostics |
| `electron/main.js` | Added dev-parity diagnostics/support IPC so the same profile-menu surface works outside packaged builds |

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

# Desktop diagnostics verification
# - `npm run build` passed after adding the support modal and new Electron IPC
# - `npm run dist:win` produced a fresh `Mission Control Setup 1.0.0.exe`
# - Silent install completed to `%LOCALAPPDATA%\Programs\MissionControlTest`
# - Installed `Mission Control.exe` launched successfully from the test install path
# - `netstat -ano | findstr 3847` confirmed the packaged app listening on `127.0.0.1:3847`
# - `curl.exe -I http://127.0.0.1:3847/` returned `HTTP/1.1 200 OK`
# - Desktop diagnostics are now reachable from the top-right profile menu via `About & Diagnostics`

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

# GitHub Actions verification
gh workflow run "Desktop Builds" --ref mission-control-v2
gh run watch 23226926821 --exit-status

# Result:
# - build-windows: passed
# - build-macos: passed
# - build-linux: passed
# - fixes needed before green run:
#   - 6afd518: exclude prisma/seed.ts from the app typecheck
#   - 1a883fe: generate Prisma client during install/build for fresh CI runners
# - artifact bundle sizes from GitHub:
#   - mission-control-windows: 257026521 bytes
#   - mission-control-macos: 595835993 bytes
#   - mission-control-linux: 608528439 bytes
# - downloaded artifact files:
#   - Mission Control Setup 1.0.0.exe: 258384684 bytes
#   - Mission Control Setup 1.0.0.exe.blockmap: 251015 bytes
#   - Mission Control-1.0.0.dmg: 300170462 bytes
#   - Mission Control-1.0.0.dmg.blockmap: 313379 bytes
#   - Mission Control-1.0.0-arm64.dmg: 296430729 bytes
#   - Mission Control-1.0.0-arm64.dmg.blockmap: 308633 bytes
#   - Mission Control-1.0.0.AppImage: 345236107 bytes
#   - mission-control_1.0.0_amd64.deb: 264607540 bytes
```

## Launch Hardening: Failure-State Fixes (Round 1)

### What was done
Audited every customer-facing failure flow and fixed the highest-risk ones — places where a paying user could get stuck, see a useless error, or hit a dead end with no recovery.

### Files touched
| File | Change |
|------|--------|
| `src/middleware.ts` | Connection check failure now redirects to `/setup` instead of letting unconfigured users through to broken dashboard |
| `src/app/setup/page.tsx` | Save failure now shows error message instead of silently swallowing; added `saveError` state and UI |
| `src/app/api/connection/test/route.ts` | Connection test errors now provide specific actionable messages (DNS, timeout, SSL, 401, 403, 404, 5xx) instead of generic "Could not reach server" |
| `src/app/activate/page.tsx` | License activation errors now show context-specific recovery guidance (invalid key, expired, wrong device) with support contact |
| `src/components/costs/budget-controls.tsx` | Fetch failure shows error state with Retry button instead of stuck "Loading budget..." forever; budget save failures show error message |
| `src/components/layout/preferences-modal.tsx` | Connection tab fetch failure shows error with Retry button instead of infinite spinner |
| `src/app/(app)/error.tsx` | Added "Go to Dashboard" escape hatch and recovery hint alongside "Try again" |
| `src/app/(app)/page.tsx` | Added disconnected banner with "Check Connection" link when OpenClaw is unreachable |
| `src/components/costs/mode-switcher.tsx` | Mode switch errors now include actionable guidance ("Check your connection in Settings") |

## Launch Hardening: Failure-State Fixes (Round 2)

### What was done
Second pass focused on deeper failure paths: IPC crashes, malformed request bodies, leaked internal errors, and startup timing issues.

### Files touched
| File | Change |
|------|--------|
| `src/app/activate/page.tsx` | `checkLicense()` IPC rejection now caught — user sees the activation form instead of an infinite spinner |
| `src/app/setup/page.tsx` | Initial `/api/connection` fetch failure now shows amber warning ("The app is still starting up…") instead of silent `catch(() => {})`. Added `initError` state and banner |
| `src/app/api/connection/test/route.ts` | `request.json()` parse failure now returns a structured error instead of crashing the route with an unhandled exception |
| `src/app/api/connection/route.ts` | POST handler guards against malformed request body; returns 400 with `{ error }` instead of crashing |
| `src/app/api/mode/route.ts` | POST error responses now sanitized — internal messages like "Config fetch failed (502): \<html\>…" replaced with user-facing guidance |
| `src/app/api/openclaw/route.ts` | Catch-all error now returns specific messages (ECONNREFUSED, ENOTFOUND, timeout) instead of raw `error.message` |
| `src/app/api/activities/route.ts` | Error status changed from "Error" to "Unreachable" with specific connection failure guidance; raw error messages no longer exposed |
| `src/components/layout/preferences-modal.tsx` | Connection tab now clears stale data on each load; checks `r.ok` before parsing JSON |

### What was verified
- `npx tsc --noEmit` passes with zero errors after all changes
- No files outside the owned module list were touched
- No changes to `electron/*`, `website/`, `public/`, header, profile-menu, command-palette, or notifications
- All error paths return structured `{ error: string }` responses, never raw stack traces or HTML

### What remains (failure-state hardening)
- ~~Operations page uses fragile direct-import pattern~~ → Fixed in Round 4
- ~~Settings via localStorage silently swallow quota-exceeded errors~~ → Fixed in Round 4
- ~~No global loading indicator for slow SSR pages~~ → Fixed in Round 4

## Launch Hardening: Reliability & UX (Round 3)

### What was done
Closed the three remaining launch blockers from the hardening backlog: offline detection, dashboard refresh, and CSV upload errors.

### Files touched
| File | Change |
|------|--------|
| `src/components/layout/offline-banner.tsx` | **New.** Persistent banner that detects browser offline events + periodic API health check (30s). Shows "You are offline" or "App server unreachable" with Reload button |
| `src/components/layout/app-shell.tsx` | Added `<OfflineBanner />` between Header and main content area |
| `src/components/dashboard/refresh-control.tsx` | **New.** Client-side refresh button with "Updated Xs ago" timestamp. Auto-refreshes on user's configured interval from settings. Uses `router.refresh()` + `useTransition` for non-blocking SSR re-fetch |
| `src/app/(app)/page.tsx` | Added `<RefreshControl />` to dashboard header row. Users can now refresh without browser reload |
| `src/app/api/costs/upload/route.ts` | Unrecognized CSV now returns specific diagnostic (provider not detected, no rows parsed, format changed). Catch block maps ENOSPC/EACCES/FormData errors to actionable messages |
| `src/components/costs/csv-upload.tsx` | Client-side file validation (empty file, >10MB). Network errors detect offline state. Error state now has "Try again" dismiss button |

### What was verified
- `npx tsc --noEmit` passes with zero errors
- No files outside owned module list touched
- Offline banner only appears when truly offline (uses both `navigator.onLine` and API probe)
- RefreshControl uses `useTransition` so UI stays interactive during refresh
- CSV error messages are specific enough to guide user recovery

## Pre-Release Polish: Desktop Shell & Recovery Surfaces (Round 3B)

### What was done
Focused on the packaged desktop feel: notifications now help users recover instead of just alerting, the command palette can reach real desktop/support actions, and the shell now exposes the same diagnostics and preferences entry points consistently.

### Files touched
| File | Change |
|------|--------|
| `src/components/layout/notifications.tsx` | Rebuilt notifications as action-oriented recovery cards with refresh, persistent read/dismiss state, deep links to connection/costs/workshop, and desktop update actions (`Download Update`, `Restart to Install`, `Open Diagnostics`) |
| `src/components/layout/command-palette.tsx` | Added desktop actions for connection settings, license, diagnostics, update checks, and quit; action failures now surface inline instead of failing silently |
| `src/components/layout/header.tsx` | Search shortcut is now platform-aware (`Ctrl+K` on Windows/Linux, `Cmd+K` on macOS) and uses a shared desktop event for preferences |
| `src/components/layout/profile-menu.tsx` | Added global listener so `About & Diagnostics` can be opened from notifications and the command palette, not only from the avatar menu |
| `src/components/layout/desktop-events.ts` | Added shared desktop-shell event names for preferences and diagnostics |

### What was verified
- `.\node_modules\.bin\tsc.cmd --noEmit` passes with zero errors
- `npm run build` passes
- `npm run dist:win` passes and produces `release/Mission Control Setup 1.0.0.exe`
- No files in `src/app/api/*`, `src/app/setup/*`, `src/app/activate/*`, `src/middleware.ts`, `src/components/costs/*`, `website/*`, or `public/*` were touched in this round

### What remains (desktop shell lane)
- The installed Windows app has now exercised notification diagnostics, clipboard export, updater invocation, and tray/relaunch/quit flows; command-palette-specific visual QA is still optional follow-up
- The shell still has no dedicated in-app release notes/update history surface beyond updater dialogs and diagnostics
- Desktop support no longer depends on a placeholder `MC_LICENSE_SECRET`; release builds now fail fast unless a real secret is provided and embedded during packaging

## Launch Hardening: Final App Polish (Round 4 — Claude's lane)

### What was done
Closed the remaining three app-polish items from the hardening backlog: loading skeleton, Operations page fragility, and localStorage quota guard.

### Files touched
| File | Change |
|------|--------|
| `src/app/(app)/loading.tsx` | Upgraded from plain spinner to a shimmer skeleton matching the dashboard layout (4 status cards, 2-column content area). Users see structure instead of a blank void during SSR loads |
| `src/app/(app)/operations/page.tsx` | Replaced direct `import('@/app/api/operations/route')` with proper `fetch(baseUrl + '/api/operations')` via `getAppBaseUrl()`. Removed 4 unused icon imports. This eliminates the fragile direct-import pattern that could break in the packaged Electron app |
| `src/contexts/settings-context.tsx` | localStorage writes now catch quota-exceeded/unavailable errors explicitly. Added `saveWarning` boolean to context so UI can inform users. Settings still apply for the current session even if persistence fails |
| `src/components/layout/preferences-modal.tsx` | Surfaces `saveWarning` as an amber banner inside the modal: "Settings apply for this session but could not be saved permanently. Storage may be full." |

### What was verified
- `npx tsc --noEmit` passes with zero errors
- No files outside owned module list touched
- Operations page now uses the same `getAppBaseUrl()` pattern as the dashboard page
- localStorage quota guard is exposed via context, not swallowed silently

### What remains (Claude's lane)
All three items from the backlog are now closed. Remaining work is:
- QA checklist items (setup flow, dashboard, refresh, mode switch, budget save, CSV upload, offline → recover, preferences round-trip)

## Final Pre-Merge: Release Secret Enforcement & Installed Windows QA (Round 4 — Codex's lane)

### What was done
Closed the last packaging/security gap in the offline HMAC path and exercised the installed Windows build directly on the current branch head.

- Added a shared release-secret validator so packaged builds reject a missing, placeholder, or too-short `MC_LICENSE_SECRET`
- Added `prepare:license` so desktop packaging embeds a validated release secret into the packaged app before `electron-builder` runs
- Updated all desktop dist scripts and the GitHub Actions desktop workflow so release builds fail fast unless the secret is present
- Added a packaged-app startup guard in `electron/main.prod.js` so a bad build shows a blocking error and quits instead of silently shipping broken license validation
- Corrected Electron Builder's GitHub publish metadata to the actual repo (`Toma505/mission-control`) so packaged updater checks target the right release feed
- Rebuilt `dist:win` on top of Claude's `95fa020` budget-fix commit and verified the installed app directly

### Files touched
| File | Change |
|------|--------|
| `electron/license-secret.js` | Centralized release-secret validation and resolution for runtime/build tooling |
| `electron/prepare-license-secret.js` | New packaging preflight that writes the embedded release-secret payload or exits with an error |
| `electron/main.prod.js` | Uses the shared secret resolver for HMAC validation and blocks packaged startup when the release secret is invalid |
| `scripts/generate-license.js` | Refuses license generation without a real non-placeholder secret |
| `package.json` | Runs `prepare:license` before all desktop packaging targets and points auto-update publishing at `Toma505/mission-control` |
| `.github/workflows/desktop-builds.yml` | Injects `MC_LICENSE_SECRET` into native desktop builds and runs the new preflight step |
| `.gitignore` | Ignores `electron/.generated-license-secret.json` |

### What was verified
- `.\node_modules\.bin\tsc.cmd --noEmit` passes
- `npm.cmd run prepare:license` fails immediately without `MC_LICENSE_SECRET`
- `$env:MC_LICENSE_SECRET='mission-control-release-secret-2026-03-18-qa-build-abcdef1234567890'; npm.cmd run dist:win` passes on the current branch head
- `release\win-unpacked\resources\app-update.yml` now points at `owner: Toma505`, `repo: mission-control`
- Installed `Mission Control.exe` from `%LOCALAPPDATA%\Programs\MissionControlTest` launches the packaged app and serves the current dashboard build
- Renderer-level QA via the packaged Electron window confirmed:
  - `window.electronAPI.activateLicense(...)` succeeds with a generated HMAC key and `checkLicense()` returns `{ valid: true }`
  - notification action `Open Diagnostics` opens the diagnostics modal
  - `Copy Diagnostics` writes the support snapshot to the Windows clipboard
  - `updaterCheck()` transitions to `checking` and back to `error` without breaking the app UI, and now reports `No published versions on GitHub` instead of a bad-repo `404`
  - `setCloseToTray(true)` + `close()` keeps the background app/server alive
  - relaunching the EXE restores the existing window
  - `quit()` shuts the app down and drops the local server listener
- Temporary QA-only license and tray-setting files were removed afterward so the pre-QA app-data state was restored

### What remains (Codex's lane)
- `Check for Updates` now reaches the correct GitHub repo, but there are still no published releases for the updater to consume, so the app correctly reports `No published versions on GitHub`
- Signing/notarization prep still needs the actual release certificates and CI secrets
- A true clean-machine pass on a machine without existing Mission Control app data is still worth doing before merge, even though the installed-build behaviors above were verified locally

## Installed-Build QA Results (Branch head: `8c8749b`)

Full QA pass was run against the packaged Windows app (`win-unpacked` from `dist:win` build), not `npm run dev`. The embedded Next.js server was confirmed running on `127.0.0.1:3847`.

### Claude's lane (app flows)
| Test | Result | Notes |
|------|--------|-------|
| Dashboard with live data | ✅ Pass | All cards render, data populates from OpenClaw |
| Refresh button | ✅ Pass | `RefreshControl` triggers `router.refresh()`, timestamp updates |
| Mode switch (Budget ↔ Standard) | ✅ Pass | Switches apply and persist |
| Budget save (edit form) | ✅ Pass | Fixed race condition in `95fa020` — auto-refresh no longer overwrites form inputs during edit |
| CSV upload (valid file) | ✅ Pass | Upload succeeds, data ingested |
| CSV upload (invalid file) | ✅ Pass | Specific error messages shown, "Try again" dismiss works |
| Setup reconfigure + connection tests | ✅ Pass | Connection test provides specific error guidance |
| Preferences (all tabs) | ✅ Pass | Theme, accent, font size, compact mode all apply; connection tab clears stale data |
| Loading skeleton | ✅ Pass | Shimmer skeleton shows during SSR transitions |

### Codex's lane (desktop shell)
| Test | Result | Notes |
|------|--------|-------|
| License activation IPC | ✅ Pass | `activateLicense()` succeeds with HMAC key, `checkLicense()` returns `{ valid: true }` |
| Notifications → Open Diagnostics | ✅ Pass | Diagnostics modal opens from notification action |
| Copy Diagnostics | ✅ Pass | Support snapshot written to Windows clipboard |
| Updater check | ✅ Pass | Transitions `checking` → `error` gracefully; now reports "No published versions on GitHub" (correct — no releases published yet) |
| Close-to-tray | ✅ Pass | `setCloseToTray(true)` + close keeps background server alive |
| Relaunch EXE | ✅ Pass | Restores existing window instead of spawning duplicate |
| Quit | ✅ Pass | Shuts down app and drops local server listener |
| Updater repo metadata | ✅ Pass | `app-update.yml` points at `Toma505/mission-control` (fixed in `8c8749b`) |

### Bugs found & fixed during QA
- **Budget edit race condition** (`95fa020`): 30-second auto-refresh interval was overwriting `dailyLimit`, `monthlyLimit`, `autoThrottle` form state while user was actively editing. Fixed by adding `updateForm` parameter to `fetchBudget()` and passing `!editing` from the interval.
- **Updater 404** (`8c8749b`): Updater was targeting wrong GitHub owner (`tomaslau` instead of `Toma505`). Fixed repo metadata in `package.json`.

## Open Questions
1. Should `win.signAndEditExecutable: false` remain only as a local-build workaround, or should Windows packaging move to a proper signing-capable setup immediately?
2. Should `asarUnpack` be used for just the standalone server instead of `asar: false`?
3. Do we already have Windows Authenticode and Apple Developer ID certificates?
4. Distribution: GitHub Releases, own website, or something like Gumroad/LemonSqueezy?

## Completed Decisions
- **License validation**: Offline HMAC-SHA256 with machine fingerprinting. Keys are format `MC-XXXXX-XXXXX-XXXXX-XXXXX`, generated via `npm run generate:keys`. Secret is `MC_LICENSE_SECRET` env var. See `scripts/generate-license.js` and `electron/main.prod.js`.
- **Auto-updater**: `electron-updater` with GitHub Releases provider. Native dialogs for download/restart prompts. "Check for Updates" in tray menu. 5-second delayed check on app ready (packaged builds only).

## Next Steps
1. Decide whether to keep or replace the local Windows `signAndEditExecutable: false` workaround before release builds
2. Revisit `asar` vs `asarUnpack` to reduce package size
3. Publish tagged GitHub release artifacts to `Toma505/mission-control` or disable the updater surface until public releases exist
4. Run the full clean-machine QA checklist on a machine without existing Mission Control app data
5. Create dashboard screenshot and OG image for the landing page
6. Set up payment integration (LemonSqueezy/Stripe) for license key fulfillment
7. Deploy landing page to production (Vercel/Netlify)
8. Provision Windows code signing and Apple notarization inputs for release CI
9. Consider updating GitHub Actions versions before the Node 20 runner deprecation date noted in CI annotations
