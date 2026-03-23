# Security Audit - 2026-03-23

## Scope

- Desktop app runtime and licensing flow
- Public app host on `app.orqpilot.com`
- Marketing site on `orqpilot.com`
- Checkout, fulfillment, download, and support recovery paths
- Build, dependency, and security-header posture

## Follow-Up Status

The top hardening items from this audit were addressed in the working tree after the initial review:

- raw public `session_id` order disclosure was removed from the unauthenticated success path
- server-side throttling was added to the most sensitive public routes
- CSP generation was moved into middleware so production can use a nonce-based script policy instead of static `'unsafe-inline'`

The findings below remain the original audit snapshot and the recommended fix order still applies for the items not yet addressed.

## Audit Method

- Read targeted production paths and security-sensitive routes
- Ran `npm run build`
- Ran `npm.cmd audit --omit=dev`
- Ran a targeted static link sanity check over the marketing site
- Reviewed current licensing authority changes and public deployment shape

## Findings

### 1. Public order lookup discloses full order records to anyone holding a Stripe session id

**Severity:** Medium

**Files:**
- `src/app/api/commerce/order/route.ts`
- `src/app/purchase/success/page.tsx`

**Details:**
- `GET /api/commerce/order?session_id=...` returns the full order object without authentication.
- The purchase success page also treats `session_id` as a bearer token for loading the fulfilled order and rendering the license key.
- Stripe checkout session ids are high-entropy, but once exposed they become sufficient to recover a license-bearing order.

**Code references:**
- `src/app/api/commerce/order/route.ts:17-29`
- `src/app/purchase/success/page.tsx:8-15`
- `src/app/purchase/success/page.tsx:41-75`

**Why it matters:**
- A leaked success URL or session id can disclose license details and purchase metadata.

**Recommended fix:**
- Replace raw session-id lookup with a short-lived signed recovery token, or require a second factor such as checkout email confirmation before returning the order payload or rendering the license.

### 2. High-value public endpoints have no request throttling or abuse controls

**Severity:** Medium

**Files:**
- `src/app/api/commerce/checkout/route.ts`
- `src/app/api/license-control/activate/route.ts`
- `src/app/api/license-control/validate/route.ts`
- `src/app/download/windows/route.ts`

**Details:**
- Checkout session creation, license activation, lease renewal, and installer download are all publicly reachable and currently have no in-app rate limiting or request throttling.
- Cloudflare can absorb some abuse, but the app itself does not enforce budgets or caller-level protection.

**Code references:**
- `src/app/api/commerce/checkout/route.ts:34-88`
- `src/app/api/license-control/activate/route.ts:6-57`
- `src/app/api/license-control/validate/route.ts:6-47`
- `src/app/download/windows/route.ts:171-186`

**Why it matters:**
- These routes are the highest-value targets for scripted abuse, brute-force attempts, and bandwidth/compute exhaustion.

**Recommended fix:**
- Add Cloudflare rate limits immediately for these routes.
- Add server-side throttling keyed by IP and route class for defense in depth.
- Exempt the Stripe webhook route from challenge/rate-limit rules that would interfere with delivery.

### 3. Production CSP still allows inline scripts

**Severity:** Medium

**File:**
- `next.config.ts`

**Details:**
- The production CSP includes `script-src 'self' 'unsafe-inline'`.
- That weakens CSP as an XSS mitigation and reduces the value of the rest of the header set.

**Code references:**
- `next.config.ts:15-23`
- `next.config.ts:37-50`

**Why it matters:**
- If a DOM injection or reflected HTML issue appears later, the CSP will not block inline-script execution.

**Recommended fix:**
- Remove `'unsafe-inline'` from production `script-src`.
- If specific inline scripts are required, move them to external files or use nonces/hashes.

### 4. Runtime dependency posture is not fully current, and npm audit flags real Next.js advisories

**Severity:** Medium

**File:**
- `package.json`

**Details:**
- `npm.cmd audit --omit=dev` flagged multiple advisories.
- The most important runtime one is `next@16.1.6`, which falls inside npm's current advisory range and has a fix available in `16.2.1`.
- Additional advisories exist in transitive Prisma/Hono-related packages. Those look more tooling-oriented than the Next runtime issue, but they still deserve review.

**Code references:**
- `package.json:152`
- `package.json:170`

**Why it matters:**
- The main production exposure here is the stale Next runtime, not the presence of development tooling advisories by itself.

**Recommended fix:**
- Upgrade `next` and `eslint-config-next` together to the current patched release.
- Re-run `npm audit --omit=dev` after the upgrade.
- Then evaluate whether any remaining Prisma/Hono findings actually affect your deployed runtime.

### 5. Lint/security gate is noisy because generated artifacts are included in the scan

**Severity:** Low

**File:**
- `package.json`

**Details:**
- `npm.cmd run lint` currently scans broadly via `eslint` and gets polluted by generated/built output, including release artifacts and Electron packaging output.
- That lowers the signal of lint as a pre-release quality gate.

**Code references:**
- `package.json:26`

**Why it matters:**
- When the lint gate is noisy, real regressions become easier to miss.

**Recommended fix:**
- Restrict lint targets to source directories or add the relevant generated/output directories to the ESLint ignore configuration.

## Residual Risks

These are not top findings for launch, but they are still real limitations:

- Licensing authority is still file-backed rather than DB-backed.
- Machine identity is still soft and not hardware-grade.
- Revocation is near-real-time, not instant, because a valid offline lease remains usable until expiry.
- Seat transfer is support-driven, not self-serve.
- Licensing is enforced per desktop activation, not per OpenClaw deployment.

## What Looks Good

- Live checkout, webhook fulfillment, success-page delivery, and email delivery have all been verified.
- Public app hosting split is correct: static marketing site on `orqpilot.com`, dynamic purchase/app host on `app.orqpilot.com`.
- DMARC, SPF, DKIM, privacy page, and terms page are in place.
- The latest licensing hardening removed the old client-side minting path and moved activation control server-side.
- The white-label Windows download path is now mediated through your app host instead of intentionally dropping users into GitHub UI.

## Recommended Fix Order

1. Replace session-id bearer disclosure for order/license retrieval.
2. Add Cloudflare and server-side throttling for checkout, activation, validation, and download routes.
3. Tighten CSP by removing production `'unsafe-inline'`.
4. Upgrade Next.js to the latest patched version and re-run audit.
5. Clean up the lint gate so release checks stay high-signal.
6. Later: move license authority state from flat file to a real database.

## Overall Assessment

The product is in materially better shape than a typical first commercial launch. The current risk profile is not "broken," but it is also not "finished." The biggest remaining issues are:

- bearer-style order/license disclosure via session id
- missing abuse/rate-limit controls on public high-value routes
- a CSP that still permits inline scripts
- stale Next.js runtime dependencies

Those are fixable without a major rewrite and should be addressed before calling the surface fully hardened.
