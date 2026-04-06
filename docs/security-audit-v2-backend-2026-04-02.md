# Mission Control Security Audit V2 — Backend & Data Layer

Date: 2026-04-02
Auditor: Codex
Scope: Backend/API routes, `src/lib/*.ts`, Electron main/preload layer, `data/*.json`, middleware/auth.

## Executive Summary

I reviewed every `src/app/api/**/route.ts` file, the backend/data-facing `src/lib/*.ts` files, the Electron main/preload layer, and tracked JSON data under `data/`.

The most serious issue is no longer the runtime secret-encryption implementation itself; that part is materially better now. The biggest remaining problem is **sensitive runtime data committed directly into tracked JSON files**. In addition, the app still leans heavily on a soft "localhost is trusted" model for sensitive reads/downloads, and a few backend subsystems can be turned into SSRF or arbitrary file write/read gadgets after local compromise.

## Mutating Route Auth Coverage

I did not find an obviously accidental missing `isAuthorized()` check on mutating routes. The unauthenticated mutating routes I found are the clearly intended public endpoints:
- `src/app/api/commerce/checkout/route.ts`
- `src/app/api/commerce/webhook/route.ts`
- `src/app/api/license/activate/route.ts`
- `src/app/api/license-control/activate/route.ts`
- `src/app/api/license-control/validate/route.ts`

The main problems are instead:
- sensitive **GET/download** routes that do not require auth
- renderer/localhost trust assumptions
- committed secrets/PII in `data/`
- SSRF/path traversal/resource exhaustion edges

## Findings

### 1. CRITICAL — Real credentials and customer/license data are committed in tracked JSON files

**Files:**
- `data/connection.json:3-7`
- `data/license-orders.json:34-45`

**What is wrong**
- `data/connection.json` contains a live-looking OpenClaw URL plus plaintext `setupPassword` and `openrouterApiKey` fields.
- `data/license-orders.json` contains purchaser email, Stripe session/payment identifiers, and at least one fulfilled `licenseKey`.

**Exploit scenario**
Anyone with repository access, a leaked source archive, a misconfigured backup, or a workstation compromise can recover working credentials and customer/license data immediately, without attacking the running app at all.

**Recommended fix**
- Rotate the exposed OpenClaw/OpenRouter credentials immediately.
- Invalidate and reissue any committed license keys that are still valid.
- Purge these values from git history, not just the current tree.
- Replace tracked runtime files with redacted fixtures or `.example.json` files.
- Keep real runtime state under app data only, never in tracked `data/`.

### 2. HIGH — Sensitive read/download routes still trust any localhost caller

**Files:**
- `src/lib/api-auth.ts:9-10`
- `src/app/api/connection/route.ts:11-43`
- `src/app/api/webhooks/route.ts:121-124`
- `src/app/api/openclaw/route.ts:12-65`
- `src/app/api/replay/route.ts:4-17`
- `src/app/api/knowledge/route.ts:16-31`
- `src/app/api/reports/route.ts:14-38`
- `src/app/api/extensions/dev/route.ts:12-18`

**What is wrong**
The backend model still assumes that GET endpoints are safe because they are “only returning data to the localhost UI.” In practice, several unauthenticated GET/download routes expose:
- OpenClaw connection metadata
- webhook configs and secret-bearing webhook URLs
- replay session prompts/results
- knowledge-base file downloads
- saved report downloads
- extension developer filesystem paths/logs
- OpenClaw status/session/channel metadata

**Exploit scenario**
Any local process, hostile browser extension, local malware, or renderer compromise can read these endpoints directly. This does not need the write token. The app is no longer publicly leaking these routes on `app.orqpilot.com`, but the local trust boundary is still much softer than the product implies.

**Recommended fix**
- Require the session token for sensitive GET/download endpoints, not just mutating routes.
- Split APIs into “public-safe read” vs “sensitive read” classes explicitly.
- Prefer IPC-mediated reads for the highest-sensitivity data instead of generic HTTP routes.
- Mask webhook URLs/tokens before returning them to the renderer.

### 3. HIGH — The session token is long-lived and directly exposed to all renderer code

**Files:**
- `src/lib/api-auth.ts:23-63`
- `electron/preload.js:3-43`
- `src/app/api/auth/token/route.ts:17-25`

**What is wrong**
The HTTP bootstrap route is now disabled by default, which is good. But the renderer still gets the raw session bearer token through `window.electronAPI.getSessionToken()`. The token is generated once per server lifetime and does not rotate or expire.

**Exploit scenario**
If any renderer XSS, compromised package, or malicious injected script lands in the app, it can immediately call `getSessionToken()` and then fully drive every protected write endpoint with `x-mc-token`.

**Recommended fix**
- Stop exposing the raw token to arbitrary renderer code.
- Move authenticated request signing into preload/main and expose only narrow privileged methods, or a hardened fetch wrapper that never reveals the secret.
- Rotate the token on navigation/session boundaries if the current model must remain.
- Use `timingSafeEqual` for token comparison as a defense-in-depth cleanup.

### 4. MEDIUM — Host-header SSRF gadgets exist in middleware and self-fetching routes

**Files:**
- `src/middleware.ts:91-105`
- `src/app/api/analytics/route.ts:141-153`
- `src/app/api/export/route.ts:227-233`
- `src/app/api/chat/command/route.ts:255-263`

**What is wrong**
These handlers build internal fetch URLs from `request.nextUrl.origin` / `baseUrl`, which is derived from request host information. That creates SSRF-style behavior if the host/origin value can be influenced by a local attacker or an unexpected proxy path.

**Exploit scenario**
A hostile local caller can send requests with a manipulated Host header so the server-side code fetches attacker-controlled origins instead of its own local API routes. This is especially awkward in middleware because it happens in the request gatekeeping path.

**Recommended fix**
- Stop deriving internal API base URLs from request host headers.
- Use direct function calls where possible.
- Where HTTP self-fetch is unavoidable, pin to a trusted local origin from config/env.
- Reject unexpected Host values early.

### 5. MEDIUM — Electron backup restore allows path traversal, and backup export includes sensitive files in plaintext

**Files:**
- `electron/main.prod.js:941-960`
- `electron/main.prod.js:982-1005`

**What is wrong**
- Backup export includes `_desktop-settings.json` and `_license.json` in cleartext.
- Restore iterates `Object.entries(backup.files)` and writes `path.join(dataDir, name)` without sanitizing `name`.

**Exploit scenario**
A crafted backup JSON can include keys such as `..\\..\\somefile` and cause writes outside the intended data directory during restore. Even without traversal, exported backups currently package sensitive local license/runtime files unencrypted.

**Recommended fix**
- Allowlist restore filenames or enforce a normalized-path prefix check before every write.
- Reject path separators and dot segments in backup member names.
- Encrypt or at least integrity-protect backup bundles, or clearly label them as sensitive plaintext exports.
- Consider a manifest schema instead of arbitrary `backup.files` maps.

### 6. MEDIUM — Webhook and workflow outputs can fetch arbitrary destinations, and webhook URLs are disclosed on read

**Files:**
- `src/app/api/webhooks/route.ts:103-106`
- `src/app/api/webhooks/route.ts:121-124`
- `src/app/api/webhooks/route.ts:191-199`
- `src/lib/workflow-engine.ts:471-489`
- `src/lib/workflow-engine.ts:644-647`

**What is wrong**
- Webhook delivery/test uses user-supplied stored URLs without destination safety checks.
- Workflow output nodes can POST to arbitrary `http/https` URLs.
- The webhook GET route returns full stored webhook configs, including full URLs.

**Exploit scenario**
A local attacker with write access can pivot into SSRF against internal services, intranet apps, or metadata-adjacent endpoints. A local attacker without write access can still enumerate configured webhook URLs from the unauthenticated GET path.

**Recommended fix**
- Validate webhook/workflow destinations with a stricter URL validator.
- Block obviously dangerous destinations or make that a policy toggle.
- Mask secrets/tokens embedded in webhook URLs before returning them.
- Consider an outbound allowlist for webhook destinations.

### 7. MEDIUM — Knowledge uploads and portable-bundle preview/import can be used for memory/CPU exhaustion

**Files:**
- `src/app/api/knowledge/route.ts:59-75`
- `src/lib/knowledge-store.ts:188-204`
- `src/lib/knowledge-store.ts:218-257`
- `src/app/api/portable/route.ts:58-89`
- `src/lib/portable-bundle.ts:609-760`

**What is wrong**
- Knowledge uploads load every uploaded file fully into memory and then parse/chunk them, including PDFs.
- There is no per-file cap, aggregate request cap, or file-count cap in the knowledge route.
- Portable preview/import parses arbitrarily large nested JSON and computes conflict diffs over it without size/count limits.

**Exploit scenario**
A local attacker can upload a huge PDF, many files, or a giant `.mcbundle.json` and drive memory spikes, CPU churn, or UI hangs. This is a local DoS vector rather than a public internet issue.

**Recommended fix**
- Add strict per-file, total-upload, and file-count limits to knowledge uploads.
- Add chunk-count/text-size ceilings before indexing.
- Add maximum bundle size and per-category item-count limits for portable import.
- Fail fast before expensive diff generation.

### 8. MEDIUM — Reports trust metadata file paths, and report downloads do not require auth

**Files:**
- `src/app/api/reports/route.ts:16-29`
- `src/lib/reports-store.ts:734-762`
- `src/lib/reports-store.ts:774-796`
- `src/app/api/scheduled-reports/route.ts:76-99`

**What is wrong**
- `GET /api/reports?download=...` serves files without requiring the session token.
- Report metadata stores absolute `filePath` values and later uses them directly for read/delete.
- Scheduled report generation returns the absolute `filePath` to the client.

**Exploit scenario**
Any local caller can download saved reports. If `reports.json` is tampered with locally, later reads/deletes can be redirected to arbitrary files accessible to the process. Absolute filesystem paths are also being disclosed back to the renderer.

**Recommended fix**
- Require auth for report downloads.
- Store only logical IDs or filenames in metadata, not absolute paths.
- Before read/delete, resolve and verify that the target stays inside the reports directory.
- Stop returning absolute paths in API responses.

### 9. LOW — Many JSON stores use unlocked read-modify-write patterns and can lose updates

**Files:**
- `src/app/api/key-vault/route.ts:88-139`
- `src/lib/settings-store.ts:19-32`
- `src/lib/portable-bundle.ts:247-257`
- `src/app/api/team/route.ts` (reviewed; same pattern)
- `src/app/api/alerts/route.ts` (reviewed; same pattern)
- multiple additional JSON-backed stores follow the same design

**What is wrong**
Most stores read the whole JSON document, mutate it in memory, and write it back without file locks or write queues.

**Exploit scenario**
Concurrent writes from multiple tabs, background runners, scheduled tasks, or Electron IPC flows can clobber each other and lose state. This is more of an integrity/reliability issue than a direct privilege escalation.

**Recommended fix**
- Introduce per-store write queues or file locks.
- Prefer append-only/evented writes where possible.
- Keep the current `orchestrations` queue pattern as the model for other hot stores.

### 10. LOW — Rate limiting trusts proxy headers directly

**File:**
- `src/lib/request-rate-limit.ts:32-46`

**What is wrong**
The rate limiter trusts `cf-connecting-ip`, `x-forwarded-for`, and `x-real-ip` directly.

**Exploit scenario**
On deployments without strict trusted-proxy normalization, a caller can spoof IP-related headers and defeat per-IP rate limiting.

**Recommended fix**
- Only trust proxy headers when the deployment platform is known to set/strip them safely.
- Otherwise use platform-provided client IP APIs or a trusted reverse proxy boundary.

### 11. INFO — Seed/sample data still contains realistic personal and business information

**Files:**
- `data/team.json:5-50`
- `data/license-orders.json:9-45`

**What is wrong**
The repository ships demo/team/customer-like records with real-looking names, emails, purchase metadata, and usage history.

**Exploit scenario**
This is mostly a privacy/repo-hygiene issue, but it increases accidental disclosure risk in demos, screenshots, and repo sharing.

**Recommended fix**
- Replace with obviously fake fixtures.
- Keep test/demo data synthetic and non-identifying.
- Avoid shipping anything that looks production-derived.

## Notable Checked Areas With No Material Finding

### Secret encryption looks correct
**File:** `src/lib/secret-encryption.ts:20-49`
- AES-256-GCM is used correctly with random 12-byte IVs and per-record auth tags.
- I did not find IV reuse or an obvious crypto misuse in this helper.

### Stripe webhook freshness/signature verification looks solid
**File:** `src/lib/stripe-webhooks.ts:11-35`
- Signature verification uses HMAC SHA-256, timestamp freshness (5 minutes), and `timingSafeEqual`.
- I did not confirm a replay vulnerability in the current implementation.

### Electron window hardening remains good
**Files reviewed:** `electron/main.js`, `electron/main.prod.js`, `electron/preload.js`
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- external URL opening is constrained to `https:` / `mailto:` patterns

## Recommended Fix Order

1. Remove committed secrets and PII from tracked `data/` immediately, rotate anything live, and purge git history.
2. Require auth for sensitive GET/download routes; stop treating all localhost reads as harmless.
3. Stop exposing the raw session token to the renderer; move privileged backend access behind narrower IPC/fetch bridges.
4. Eliminate Host-header-based self-fetches in middleware and API routes.
5. Fix Electron backup restore path traversal and treat backups as sensitive secrets-containing artifacts.
6. Add size/count limits to knowledge uploads and portable import preview/apply.
7. Tighten webhook/workflow outbound URL policy and mask webhook URLs on reads.
8. Add write serialization for the busiest JSON stores.

## Suggested Cross-Check Targets For Claude

Areas where I would especially like frontend/client cross-check pressure:
- Whether any renderer path can reach `window.electronAPI.getSessionToken()` from untrusted content.
- Whether session sharing / replay HTML export introduces renderer-side XSS that would combine badly with the token model.
- Whether command palette/global search surfaces any of the unauthenticated sensitive GET routes in a way that increases exposure.
