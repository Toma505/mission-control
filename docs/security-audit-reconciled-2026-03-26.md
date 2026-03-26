# Mission Control Security Audit (Reconciled)

Date: 2026-03-26
Reviewers: Codex + Claude
Base report: `docs/security-audit-2026-03-26.md`

## Reconciled Summary

After comparing both audits, the top risks are:

1. The API Key Vault stores raw keys in plaintext while the UI claims DPAPI encryption.
2. The localhost auth model is too permissive because the session token is exposed on an unauthenticated localhost GET endpoint and many read APIs are unauthenticated.
3. Secret storage for connection config and instance passwords silently downgrades to plaintext when the Electron encryption key is unavailable.
4. Production CSP still allows `'unsafe-inline'` and the generated nonce is not used.
5. Dependency posture is behind current framework/tooling advisories.

Two items from the second audit were re-ranked:

- Instance-management SSRF is a real chained risk, but lower priority than the token/vault issues because localhost/LAN targets are also valid product inputs.
- Stripe webhook replay is not a medium-severity fulfillment issue because signature freshness is enforced and license fulfillment is idempotent; the residual risk is duplicate email/state churn, not duplicate license issuance.

## Final Findings

### High

#### RC-001: API Key Vault secrets are stored in plaintext and the UI claim is false

Evidence:

- Raw `_key` is part of the persisted schema in [src/app/api/key-vault/route.ts:9](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:9) through [src/app/api/key-vault/route.ts:20](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:20).
- `writeVault()` persists `_key` unchanged in [src/app/api/key-vault/route.ts:92](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:92) through [src/app/api/key-vault/route.ts:101](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:101).
- New keys are written as `_key: key` in [src/app/api/key-vault/route.ts:141](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:141) through [src/app/api/key-vault/route.ts:151](C:\Users\tomas\mission-control\src\app\api\key-vault\route.ts:151).
- The UI promises DPAPI encryption in [src/components/settings/key-vault.tsx:142](C:\Users\tomas\mission-control\src\components\settings\key-vault.tsx:142) through [src/components/settings/key-vault.tsx:144](C:\Users\tomas\mission-control\src\components\settings\key-vault.tsx:144).

Conclusion:

- Both audits agree this is high severity.
- This is both a technical weakness and a trust/UX misrepresentation.

#### RC-002: The localhost token endpoint weakens the entire desktop auth boundary

Evidence:

- `GET /api/auth/token` returns the session token to any localhost request in [src/app/api/auth/token/route.ts:12](C:\Users\tomas\mission-control\src\app\api\auth\token\route.ts:12) through [src/app/api/auth/token/route.ts:17](C:\Users\tomas\mission-control\src\app\api\auth\token\route.ts:17).
- The auth model explicitly leaves GET endpoints unauthenticated in [src/lib/api-auth.ts:1](C:\Users\tomas\mission-control\src\lib\api-auth.ts:1) through [src/lib/api-auth.ts:10](C:\Users\tomas\mission-control\src\lib\api-auth.ts:10).
- Sensitive read APIs exist, for example team and audit data in [src/app/api/team/route.ts:141](C:\Users\tomas\mission-control\src\app\api\team\route.ts:141) through [src/app/api/team/route.ts:190](C:\Users\tomas\mission-control\src\app\api\team\route.ts:190).

Conclusion:

- Codex initially rated this Medium; Claude argued High.
- Final rating: High.
- Public-host leakage appears fixed, but the local desktop trust boundary is still too soft for a product that stores real credentials and secrets.

### Medium

#### RC-003: Secret-at-rest protection silently degrades to plaintext

Evidence:

- Connection config plaintext fallback in [src/lib/connection-config.ts:166](C:\Users\tomas\mission-control\src\lib\connection-config.ts:166) through [src/lib/connection-config.ts:172](C:\Users\tomas\mission-control\src\lib\connection-config.ts:172).
- Instance password plaintext fallback in [src/app/api/instances/route.ts:17](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:17) through [src/app/api/instances/route.ts:25](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:25).

Conclusion:

- Both audits agree on Medium.
- The encryption path exists, but the silent insecure fallback is the real issue.

#### RC-004: Production CSP still allows `'unsafe-inline'` and the nonce is unused

Evidence:

- `script-src` includes `'unsafe-inline'` in [src/middleware.ts:35](C:\Users\tomas\mission-control\src\middleware.ts:35) through [src/middleware.ts:42](C:\Users\tomas\mission-control\src\middleware.ts:42).
- A nonce is generated in [src/middleware.ts:11](C:\Users\tomas\mission-control\src\middleware.ts:11) through [src/middleware.ts:20](C:\Users\tomas\mission-control\src\middleware.ts:20), but never applied to `script-src`.

Conclusion:

- Both audits agree on Medium.
- Claude’s “nonce is wasted” note is correct.

#### RC-005: Dependency posture remains behind active advisories

Evidence:

- `next` is pinned to `16.1.6` in [package.json:154](C:\Users\tomas\mission-control\package.json:154).
- `prisma` remains in runtime dependencies in [package.json:156](C:\Users\tomas\mission-control\package.json:156).
- `npm.cmd audit --omit=dev` reported current advisories affecting Next and Prisma transitive chains.

Conclusion:

- Codex found this; Claude did not independently audit dependencies.
- Keep as Medium.

#### RC-006: Instance management can be used as an SSRF/credential-forwarding primitive once local auth is obtained

Evidence:

- New instance URLs are accepted with only slash trimming in [src/app/api/instances/route.ts:220](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:220) through [src/app/api/instances/route.ts:227](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:227).
- The server then POSTs Basic-authenticated requests to `${instanceUrl}/setup/api/console/run` in [src/app/api/instances/route.ts:91](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:91) through [src/app/api/instances/route.ts:110](C:\Users\tomas\mission-control\src\app\api\instances\route.ts:110).

Conclusion:

- Claude surfaced this; Codex missed it.
- Final rating: Medium, but as a chained/local-auth issue rather than a standalone public SSRF bug.
- Product reality matters here: localhost/LAN OpenClaw targets are legitimate. The fix needs to preserve that use case while still screening obviously dangerous endpoints.

### Low

#### RC-007: Webhook URLs are unvalidated and can target arbitrary destinations

Evidence:

- Webhook URLs are accepted without validation in [src/app/api/webhooks/route.ts:136](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:136) through [src/app/api/webhooks/route.ts:153](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:153).
- Mission Control later POSTs to them in [src/app/api/webhooks/route.ts:102](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:102) through [src/app/api/webhooks/route.ts:107](C:\Users\tomas\mission-control\src\app\api\webhooks\route.ts:107).

Conclusion:

- Keep as Low because it requires a local authorized actor and overlaps with the localhost auth issue.

#### RC-008: Stripe replay concern is lower than initially rated

Evidence:

- Signature verification already enforces timestamp freshness in [src/lib/stripe-webhooks.ts:20](C:\Users\tomas\mission-control\src\lib\stripe-webhooks.ts:20) through [src/lib/stripe-webhooks.ts:35](C:\Users\tomas\mission-control\src\lib\stripe-webhooks.ts:35).
- Fulfillment is idempotent because existing fulfilled orders short-circuit in [src/lib/billing.ts:503](C:\Users\tomas\mission-control\src\lib\billing.ts:503) through [src/lib/billing.ts:506](C:\Users\tomas\mission-control\src\lib\billing.ts:506).

Conclusion:

- Claude’s replay concern is directionally valid, but the current implementation prevents duplicate license issuance.
- Residual risk is duplicate email attempts or state churn, not duplicate fulfillment.

### Informational

#### RC-009: Electron hardening is in good shape

Conclusion:

- Claude’s positive callout is worth keeping.
- No major Electron-window hardening issue surfaced in this review compared to the more urgent app/backend findings.

## Final Fix Order

1. Real at-rest encryption for Key Vault secrets, and correct the UI claim.
2. Harden localhost auth:
   - remove or replace `/api/auth/token`
   - require auth on sensitive read endpoints
3. Eliminate silent plaintext fallback for connection/instance secrets.
4. Tighten CSP to remove `'unsafe-inline'` and use the generated nonce properly.
5. Upgrade Next/runtime dependencies and re-run the audit.
6. Add controlled validation for instance URLs and webhook URLs without breaking legitimate localhost/LAN workflows.
