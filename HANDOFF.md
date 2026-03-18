# Mission Control — Handoff Document

## Project Goal
Package Mission Control (Next.js 16 + Electron desktop app) as a **consumer-grade downloadable product** for OpenClaw users. Double-click install, no terminal, no Node.js, no dev setup. Ship on Windows, macOS, and Linux.

## Current Owner
Claude (Opus) — handing off to Codex for parallel work.

## Repo Location
```
C:\Users\tomas\mission-control
```

## Git State
- **Branch:** `main`
- **Latest commit:** `b892804` — "Add AI mode switcher with benchmark-based model routing"
- **Note:** There are many uncommitted changes from this session (standalone packaging, splash screen, cross-platform fixes, onboarding flow, etc.)

## Status
The app works end-to-end in **dev mode**. The production packaging is architecturally complete but has **not been tested as a built installer yet**. Key infrastructure is in place:

- [x] Next.js `output: 'standalone'` (47MB self-contained server)
- [x] Electron `main.prod.js` runs standalone server via `fork()` (no npm/node needed)
- [x] Splash screen while server boots
- [x] Single-instance lock
- [x] System tray with "Start on Login" toggle (auto-launch)
- [x] First-run redirect to `/setup` via middleware
- [x] 2-step setup wizard (Welcome → Connect → Test → Launch)
- [x] License system (basic offline validation: `MC-XXXX-XXXX-XXXX`)
- [x] Cross-platform user data paths (AppData / Library / .config)
- [x] All data paths use `DATA_DIR` env var (works in both dev and packaged)
- [x] Light mode text contrast fixed
- [ ] **NOT YET TESTED:** `npm run dist:win` (building the actual installer)
- [ ] **NOT YET DONE:** Proper `.icns` icon for macOS, high-res `.png` for Linux
- [ ] **NOT YET DONE:** Server-side license validation
- [ ] **NOT YET DONE:** Auto-updater (electron-updater)
- [ ] **NOT YET DONE:** Code signing (Authenticode / Apple Developer ID)

## Files Changed (this session, uncommitted)

### Core Packaging
| File | Change |
|------|--------|
| `next.config.ts` | Added `output: 'standalone'` |
| `electron/main.prod.js` | Full rewrite — standalone server via fork(), splash screen, auto-launch, single-instance, cross-platform paths |
| `electron/main.js` | Cross-platform rewrite (user data paths, icons, npm.cmd vs npm, macOS titlebar) |
| `electron/preload.js` | Added `getPlatform`, `getAutoLaunch`, `setAutoLaunch` IPC |
| `package.json` | Slimmed build files (standalone only), added `asar: false`, Mac dmg arm64+x64, Linux deb target, `auto-launch` dependency |

### Data Layer
| File | Change |
|------|--------|
| `src/lib/connection-config.ts` | Exported `DATA_DIR` constant, uses `MC_DATA_DIR` env var |
| `src/app/api/budget/route.ts` | Uses `DATA_DIR` instead of `process.cwd()/data` |
| `src/app/api/costs/route.ts` | Uses `DATA_DIR` |
| `src/app/api/costs/upload/route.ts` | Uses `DATA_DIR` |
| `src/app/api/costs/subscriptions/route.ts` | Uses `DATA_DIR` |

### Onboarding & UX
| File | Change |
|------|--------|
| `src/middleware.ts` | Added first-run redirect to `/setup` if not configured |
| `src/app/setup/page.tsx` | Rewritten as 2-step wizard (Welcome → Configure) |

### Theme / Light Mode
| File | Change |
|------|--------|
| `src/contexts/settings-context.tsx` | Light theme: darker text-secondary (#334155), text-muted (#64748b), stronger borders |
| `src/app/globals.css` | Removed broken `text-white` override, improved light mode glass/sidebar styles |
| `src/app/(app)/skills/page.tsx` | SVG stroke uses `var(--glass-border)` instead of hardcoded rgba |

### Bug Fix
| File | Change |
|------|--------|
| `src/app/(app)/operations/page.tsx` | Fixed import path from `../api/operations/route` to `@/app/api/operations/route` |

## Key Architecture Decisions

1. **Standalone mode** — `output: 'standalone'` bundles server.js + minimal node_modules. Electron's built-in Node.js runs it via `fork()`. Users never see a terminal.

2. **Data separation** — App code lives in the Electron bundle. User data (connection.json, budget.json, etc.) lives in platform-specific appdata via `MC_DATA_DIR`. First run copies defaults from bundle.

3. **No asar** — `asar: false` in electron-builder config because the standalone server needs to be fork()'d from the filesystem. Could revisit with `asarUnpack` for just the server.

4. **Server on port 3847** — Non-standard port to avoid conflicts with other dev servers. Electron loads `http://127.0.0.1:3847`.

5. **Middleware dual-purpose** — Handles both setup redirect (unconfigured → /setup) and API security (localhost-only access).

## Verification
```bash
cd C:\Users\tomas\mission-control

# Dev mode (works)
npm run dev
# Visit http://localhost:3000 — dashboard loads with live OpenClaw data

# Build standalone (works)
npm run build
# Verify: .next/standalone/server.js exists (47MB bundle)

# Package installer (NOT YET TESTED)
npm run dist:win    # Windows .exe
npm run dist:mac    # macOS .dmg
npm run dist:linux  # Linux .AppImage + .deb
```

## Open Questions
1. Should we use `asarUnpack` for just the standalone server instead of `asar: false`? Would reduce app size.
2. License validation — keep offline-only or build a simple validation server?
3. Auto-updater — GitHub Releases + electron-updater, or custom update server?
4. Code signing — do we have Apple Developer ID / Windows Authenticode cert?
5. Distribution — GitHub Releases, own website, or marketplace (e.g., Gumroad)?

## Next Steps
1. **Run `npm run dist:win`** and test the actual installer end-to-end
2. Fix any issues that come up during the real build (missing files, path issues, etc.)
3. Generate proper icon files (`.icns` for Mac, high-res `.png` for Linux)
4. Test on macOS and Linux if possible
5. Set up auto-updater
6. Build a landing page for downloads
