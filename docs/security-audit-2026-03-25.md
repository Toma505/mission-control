## Security Audit — 2026-03-25

Scope:
- Repo: `C:\Users\tomas\mission-control`
- Branch: `codex/payment-fulfillment`
- Checks run:
  - `npm run build`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd audit --omit=dev`
  - Browser smoke checks on `/plugins`, `/agents`, `/replay`, `/workshop`
  - Live endpoint probes against `https://app.orqpilot.com`

### Findings

#### 1. Critical — Public app host leaks the mutating session token

Files:
- `src/app/api/auth/token/route.ts`
- `src/middleware.ts`

Details:
- `GET /api/auth/token` returns `getSessionToken()` with no authentication or runtime gating.
- The route comment says this is "only accessible from localhost (enforced by middleware)," but the middleware only validates `Origin` when an `Origin` header is present. Direct requests without `Origin` are allowed.
- Live check confirmed that the public host returns the token:
  - `curl -i https://app.orqpilot.com/api/auth/token`
  - response: `200 OK` with `{"token":"..."}`

Impact:
- Any internet client can obtain the same token used to authorize desktop mutating API calls.
- That defeats the `isAuthorized()` protection model on the public Railway host.
- An attacker can then call any protected mutation route exposed on the public host with `x-mc-token`.

Recommended fix:
- Immediately block or remove `/api/auth/token` on the public host.
- Enforce that the route is only usable in the Electron desktop runtime or from localhost.
- In middleware, do not treat missing `Origin` as implicitly trusted for public API traffic.
- Longer term, split public-host routes from desktop-local management APIs.

#### 2. High — Token leak enables config mutation and SSRF-like probing on the public host

Files:
- `src/app/api/connection/route.ts`
- `src/app/api/connection/test/route.ts`
- `src/lib/url-validator.ts`

Details:
- `POST /api/connection` and `POST /api/connection/test` are token-protected, but the token is publicly exposed by Finding 1.
- `validateExternalUrl()` intentionally allows localhost and private IP space because the desktop app may connect to local/LAN OpenClaw instances.
- On the public Railway host, that same allowance becomes dangerous: a remote attacker with the leaked token can make the server probe arbitrary private/loopback targets reachable from the host and can overwrite persisted connection settings.

Impact:
- Remote config poisoning on the public app host.
- SSRF-style internal network probing from the deployed server.

Recommended fix:
- Resolve Finding 1 first.
- Additionally, hard-block localhost/private IP ranges when running on the public hosted app, even if they stay allowed in the packaged desktop runtime.
- Consider making connection-management APIs unavailable entirely on the public Railway deployment.

#### 3. High — API key vault metadata is publicly readable and keys are stored in plaintext on disk

File:
- `src/app/api/key-vault/route.ts`

Details:
- `GET /api/key-vault` is unauthenticated.
- Live check confirmed the public host serves it:
  - `curl -i https://app.orqpilot.com/api/key-vault`
  - response: `200 OK` with `{"keys":[]}`
- While the live server currently returned an empty vault, the route would disclose provider, prefix, notes, and masked suffixes if populated.
- The file comments claim "real encryption via safeStorage in Electron," but this route writes `_key` directly to JSON (`key-vault.json`) with no encryption.

Impact:
- Information disclosure on the public host if vault data ever exists there.
- Local desktop secrets at rest are weaker than the UI/comments imply.

Recommended fix:
- Require auth for `GET /api/key-vault`.
- Do not ship this route on the public host.
- Encrypt stored keys at rest using an actual desktop-only encryption mechanism or OS-bound key material, and do not advertise encryption unless it is actually happening.

#### 4. Medium — Public GET endpoints expose internal app/config metadata on the hosted app

Files:
- `src/app/api/connection/route.ts`
- `src/app/api/openclaw/route.ts`
- `src/app/api/activities/route.ts`
- multiple other `GET` routes under `src/app/api`

Details:
- The app’s auth model assumes read endpoints are safe because the desktop app talks to localhost.
- The Railway host runs the same Next server, so unauthenticated `GET` APIs are internet-accessible unless explicitly gated.
- `GET /api/connection` returns whether the app is configured, the source (`env` or `file`), the configured OpenClaw URL, whether an OpenRouter key exists, and configuration time.

Impact:
- Information disclosure from the hosted app.
- Increases attacker reconnaissance value even where direct mutation is not possible.

Recommended fix:
- Decide which API routes are truly public on `app.orqpilot.com`.
- Explicitly allowlist only purchase and license-authority endpoints on the hosted deployment.
- Gate or remove desktop-local read APIs from the public host.

#### 5. Medium — Production CSP still relies on `unsafe-inline`

File:
- `src/middleware.ts`

Details:
- The current CSP uses `script-src 'self' 'unsafe-inline'`.
- This was loosened to keep the Next runtime working, but it weakens XSS defense-in-depth.

Impact:
- A future HTML/script injection bug would be easier to exploit.

Recommended fix:
- Move to a nonce-based or hash-based CSP compatible with the current Next/Electron runtime, or isolate the public host from desktop runtime requirements so the hosted app can use a stricter policy.

#### 6. Medium — Runtime dependency posture is not current

File:
- `package.json`

Details:
- `npm audit --omit=dev` reported:
  - `next@16.1.6` with current advisories
  - `prisma` runtime dependency pulling in vulnerable `hono`, `@hono/node-server`, `effect`, `lodash`, and `picomatch` chains
- `prisma` is in `dependencies`, not `devDependencies`, which means Prisma CLI transitive packages are shipped into the runtime install surface.

Impact:
- Larger runtime attack surface than needed.
- Some advisories may be build-tooling only in practice, but they are still present in the deployed dependency tree.

Recommended fix:
- Upgrade Next to the patched current release.
- Move Prisma CLI to `devDependencies` if runtime code does not require the CLI package.
- Re-run `npm audit --omit=dev` after dependency cleanup.

### What passed

- `npm run build`
- `npx.cmd tsc --noEmit`
- Browser smoke checks for `/plugins`, `/agents`, `/replay`, and `/workshop`
- Live checkout/download/activate behavior was already working from previous verification

### Residual risks after fixes

- License authority is still file-backed, not DB-backed.
- Machine identity remains soft.
- Cloudflare only protects a narrow slice of public routes by custom rule.
- Path-level 404 analysis is still limited by available Cloudflare analytics.

### Follow-up patch prepared locally

After this audit, a local hardening patch was prepared to address Findings 1-4 in code:
- `src/app/api/auth/token/route.ts` now only serves localhost requests
- `src/app/api/key-vault/route.ts` is localhost-only and its `GET` now requires auth
- `src/components/settings/key-vault.tsx` now uses `apiFetch()` for vault reads
- `src/app/api/connection/route.ts` only exposes detailed config on localhost and blocks public writes
- `src/app/api/connection/test/route.ts` is localhost-only
- `src/middleware.ts` now blocks all non-allowlisted API routes on non-local hosts, allowing only:
  - `/api/commerce/checkout`
  - `/api/commerce/webhook`
  - `/api/license-control/activate`
  - `/api/license-control/validate`

That patch still needs to be committed, pushed, and deployed before the live host is considered remediated.
