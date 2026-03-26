# Mission Control Security Audit

Date: 2026-03-26
Branch audited: `main`
Auditor: Codex

## Executive Summary

The public Railway host appears materially safer than before: live probes to `https://app.orqpilot.com/api/auth/token`, `https://app.orqpilot.com/api/key-vault`, and `https://app.orqpilot.com/api/connection` all returned `404`, and a simple `x-forwarded-host: localhost` spoof also returned `404`.

The biggest remaining issues are not public-host token leakage. They are mostly desktop-local and at-rest security problems:

1. The API Key Vault currently stores raw provider keys on disk in plaintext while the UI claims Windows DPAPI encryption.
2. Connection secrets and instance passwords silently fall back to plaintext at rest whenever the Electron-provided encryption key is unavailable.
3. The embedded localhost API still treats many read endpoints as unauthenticated and exposes the session token on a localhost GET endpoint, which weakens the desktop trust boundary for any local process that can access loopback.
4. The production CSP still allows `'unsafe-inline'`, reducing XSS defense in depth.
5. Dependency posture is behind current security advisories, most notably `next@16.1.6`.

## Method

- Reviewed Next.js/React security posture against current local guidance.
- Inspected auth, middleware, key storage, connection storage, instance storage, webhook delivery, and public route exposure.
- Ran live HTTP probes against the public host for high-risk endpoints.
- Ran `npm.cmd audit --omit=dev`.
- Ran `npm run build`.

## What Passed

- `npm run build` completed successfully.
- Public host probes returned the expected block behavior:
  - `GET /api/auth/token` => `404`
  - `GET /api/key-vault` => `404`
  - `GET /api/connection` => `404`
  - `GET /api/auth/token` with `x-forwarded-host: localhost` => `404`
- Middleware currently narrows public API exposure to:
  - `/api/commerce/checkout`
  - `/api/commerce/webhook`
  - `/api/license-control/activate`
  - `/api/license-control/validate`

## Findings

### Critical

No currently reproducible public-host critical finding was confirmed in this pass.

### High

#### MC-001: API Key Vault stores raw secrets in plaintext despite the UI claiming DPAPI encryption

Impact: Any local user/process with access to the app data directory can recover all stored provider keys directly from disk.

Evidence:

- The vault schema persists the raw secret as `_key` in [src/app/api/key-vault/route.ts:9](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:9) through [src/app/api/key-vault/route.ts:20](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:20).
- `writeVault()` writes the raw `_key` field back to `key-vault.json` in [src/app/api/key-vault/route.ts:92](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:92) through [src/app/api/key-vault/route.ts:101](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:101).
- New keys are stored as `_key: key` in [src/app/api/key-vault/route.ts:140](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:140) through [src/app/api/key-vault/route.ts:151](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:151).
- The UI tells users “Keys are stored locally and encrypted at rest via Windows DPAPI” in [src/components/settings/key-vault.tsx:138](C:\Users\tomas\mission-control\src\components\settings\key-vault.tsx:138) through [src/components/settings/key-vault.tsx:144](C:\Users\tomas\mission-control\src\components\settings\key-vault.tsx:144).
- The only DPAPI/safeStorage code visible in the repo is for the config-encryption key state in [electron/security-context.js:12](C:\Users\tomas\mission-control\electron\security-context.js:12) through [electron/security-context.js:38](C:\Users\tomas\mission-control\electron\security-context.js:38), not for vault secrets themselves.

Fix:

- Encrypt vault secrets at rest before writing `key-vault.json`.
- Either use `safeStorage.encryptString()` directly for each stored key, or encrypt with a locally protected key derived from the DPAPI-protected config key.
- Do not claim DPAPI encryption in the UI until the vault implementation actually uses it.

Mitigation:

- If a full vault migration is not immediate, update the UI copy to accurately describe current storage and treat the feature as “masked in UI, not OS-encrypted at rest.”

### Medium

#### MC-002: Connection secrets and instance passwords silently downgrade to plaintext when the encryption key is unavailable

Impact: In any environment where `MC_CONFIG_ENCRYPTION_KEY` is missing or safeStorage initialization fails, sensitive credentials are written to disk unencrypted.

Evidence:

- `writeConnectionConfig()` writes plaintext `setupPassword`, `openrouterApiKey`, and `openrouterMgmtKey` when `encryptSecrets()` returns null in [src/lib/connection-config.ts:151](C:\Users\tomas\mission-control\src\lib\connection-config.ts:151) through [src/lib/connection-config.ts:174](C:\Users\tomas\mission-control\src\lib\connection-config.ts:174), specifically [src/lib/connection-config.ts:166](C:\Users\tomas\mission-control\src\lib\connection-config.ts:166) through [src/lib/connection-config.ts:172](C:\Users\tomas\mission-control\src\lib\connection-config.ts:172).
- `encryptPassword()` in the instances API returns the original password unchanged when no encryption key is available in [src/app/api/instances/route.ts:17](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:17) through [src/app/api/instances/route.ts:25](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:25), especially [src/app/api/instances/route.ts:19](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:19).
- The `Instance` comment says “Encrypted at rest” in [src/app/api/instances/route.ts:41](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:41) through [src/app/api/instances/route.ts:47](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:47), but the fallback contradicts that guarantee.

Fix:

- Refuse to persist sensitive credentials when the encryption key is unavailable, or explicitly gate these features behind a “desktop secure storage available” check.
- If plaintext fallback must exist for development, make it opt-in and visibly marked as insecure.

Mitigation:

- Log a strong warning and surface a UI banner when running without at-rest encryption.

#### MC-003: The localhost trust model leaves sensitive read APIs unauthenticated and exposes the session token on a localhost GET endpoint

Impact: Any local process with loopback access can read sensitive data, and the unauthenticated token endpoint weakens the mutating-route boundary for same-machine attackers.

Evidence:

- The auth design explicitly states “Read endpoints (GET) are unprotected” in [src/lib/api-auth.ts:1](C:\Users\tomas\mission-control\src\lib\api-auth.ts:1) through [src/lib/api-auth.ts:10](C:\Users\tomas\mission-control\src\lib\api-auth.ts:10).
- The session token is returned on an unauthenticated localhost-only GET in [src/app/api/auth/token/route.ts:12](C:\Users\tomas\mission-control\src\app\api\auth\token\route.ts:12) through [src/app/api/auth/token/route.ts:17](C:\Users\tomas\mission-control\src\app\api\auth\token\route.ts:17).
- Example sensitive read surface:
  - team/audit data in [src/app/api/team/route.ts:141](C:\Users\tomas\mission-control\src\app\api\team\route.ts:141) through [src/app/api/team/route.ts:190](C:\Users\tomas\mission-control\src\app\api\team\route.ts:190)
  - webhook destinations in [src/app/api/webhooks/route.ts:121](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:121) through [src/app/api/webhooks/route.ts:125](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:125)
  - connection status/details in [src/app/api/connection/route.ts:7](C:\Users\tomas\mission-control\src\app\api\connection\route.ts:7) through [src/app/api/connection/route.ts:34](C:\Users\tomas\mission-control\src\app\api\connection\route.ts:34)

Notes:

- The public host is currently blocking these routes correctly in live probes. This is a localhost/desktop boundary issue, not a reintroduced public-host leak.

Fix:

- Consider requiring the session token for all sensitive read endpoints, not just writes.
- Remove or harden `/api/auth/token`; Electron already has a preload bridge and does not need an unauthenticated localhost JSON token endpoint in production desktop mode.

Mitigation:

- If the current model is retained, document that it trusts the local machine and does not defend against hostile local software.

#### MC-004: Production CSP still allows `'unsafe-inline'`

Impact: Any XSS sink that slips into the app becomes materially easier to exploit because the CSP does not block inline script execution.

Evidence:

- Production `script-src` includes `'unsafe-inline'` in [src/middleware.ts:22](C:\Users\tomas\mission-control\src\middleware.ts:22) through [src/middleware.ts:43](C:\Users\tomas\mission-control\src\middleware.ts:43), specifically [src/middleware.ts:35](C:\Users\tomas\mission-control\src\middleware.ts:35) through [src/middleware.ts:38](C:\Users\tomas\mission-control\src\middleware.ts:38).

Fix:

- Move to a nonce- or hash-based CSP for the scripts that still require inline execution.
- Reduce the current policy to `script-src 'self' <nonce-or-hashes>` once the remaining bootstrap/runtime requirements are understood.

Mitigation:

- Keep the current `frame-ancestors`, `object-src`, and `base-uri` protections, but treat CSP as only partial defense in depth until inline script allowance is removed.

#### MC-005: Dependency posture is behind current security advisories

Impact: Known framework/runtime vulnerabilities remain in the shipped dependency tree, including the application framework itself.

Evidence:

- `next` is pinned at `16.1.6` in [package.json:154](C:\Users\tomas\mission-control\package.json:154).
- `prisma` is included in runtime dependencies in [package.json:156](C:\Users\tomas\mission-control\package.json:156), which pulls in additional audited packages that are not needed at runtime.
- `npm.cmd audit --omit=dev` reported:
  - multiple `next` advisories affecting `16.1.6`
  - `hono` and `@hono/node-server` advisories through Prisma tooling
  - `effect` advisories through Prisma tooling
  - `picomatch` advisories

Fix:

- Upgrade `next` to a patched 16.x release.
- Move `prisma` CLI tooling out of runtime `dependencies` if possible.
- Re-run audit after the upgrade and determine which residual advisories are real production exposure versus build-time tooling.

Mitigation:

- If immediate upgrades are risky, document the currently accepted advisories and whether the affected code paths are runtime-reachable in this app.

### Low

#### MC-006: Webhook destinations are not validated, allowing arbitrary outbound targets from a local authorized session

Impact: A user or local attacker with access to an authorized session can configure webhook delivery to internal or unexpected destinations, turning the app into a local SSRF-style request origin.

Evidence:

- Webhook URLs are accepted without validation in [src/app/api/webhooks/route.ts:136](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:136) through [src/app/api/webhooks/route.ts:153](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:153).
- Mission Control later POSTs to those arbitrary URLs in [src/app/api/webhooks/route.ts:102](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:102) through [src/app/api/webhooks/route.ts:107](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:107) and [src/app/api/webhooks/route.ts:190](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:190) through [src/app/api/webhooks/route.ts:195](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:195).

Fix:

- Validate webhook URLs similarly to other external URL entry points.
- At minimum, reject non-HTTP(S) schemes and cloud metadata endpoints; optionally allowlist common webhook hosts.

Mitigation:

- If arbitrary URLs are a deliberate power-user feature, make the risk explicit and require a stronger confirmation flow before saving/testing them.

## Runtime Verification Notes

- Public-host protection was re-checked live:
  - `GET https://app.orqpilot.com/api/auth/token` => `404`
  - `GET https://app.orqpilot.com/api/key-vault` => `404`
  - `GET https://app.orqpilot.com/api/connection` => `404`
  - `GET https://app.orqpilot.com/api/auth/token` with `x-forwarded-host: localhost` => `404`
- This means the previous public-host API exposure appears remediated at runtime.

## Recommended Next Order

1. Fix the Key Vault so its at-rest encryption matches the UI claim.
2. Remove plaintext fallback for connection secrets and instance passwords, or gate it behind an explicit insecure-dev mode.
3. Revisit the localhost auth model:
   - remove or harden `/api/auth/token`
   - require auth on sensitive read APIs
4. Tighten CSP to remove `'unsafe-inline'`.
5. Upgrade `next` and prune unnecessary runtime dependencies, then rerun `npm audit`.
