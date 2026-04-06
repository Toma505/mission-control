# Security Audit V2 — Deep Pass

Split between Claude (frontend/client/Electron) and Codex (backend/API/data).
After Phase 1, swap and cross-check each other's findings.

---

## Codex Prompt — Phase 1: Backend & Data Layer Audit

```
Run a deep security audit on the backend and data layer of Mission Control. This is an Electron + Next.js 16 App Router app. All data is stored in JSON files under data/. Secrets are encrypted with AES-256-GCM via src/lib/secret-encryption.ts using a key from Electron's safeStorage.

Audit EVERY file in these directories exhaustively:

1. **All API routes** (src/app/api/**/route.ts) — there are 20+ routes
   - Check every POST/PUT/DELETE for auth (isAuthorized check)
   - Check for path traversal in any file read/write (especially knowledge, portable, reports)
   - Check for injection in any user-controlled string used in file paths, commands, or queries
   - Check for missing input validation (type checks, length limits, required fields)
   - Check for information disclosure in error responses (stack traces, internal paths)
   - Check for race conditions in read-modify-write patterns on JSON files
   - Check for denial of service vectors (unbounded arrays, missing pagination, large uploads)

2. **All store/lib files** (src/lib/*.ts)
   - Check secret-encryption.ts for crypto correctness (IV reuse, key handling, timing attacks)
   - Check connection-config.ts for credential exposure (are passwords ever logged or returned?)
   - Check url-validator.ts for bypass vectors (DNS rebinding, IPv6, URL encoding tricks)
   - Check portable-bundle.ts for zip bomb / path traversal during import
   - Check knowledge-store.ts for file type validation and path traversal on upload
   - Check all store files for unsafe JSON.parse without try/catch
   - Check for prototype pollution in any object merge/spread from user input

3. **Electron layer** (electron/*.js)
   - Check IPC handlers for argument validation
   - Check preload.js for over-exposed APIs
   - Check that contextIsolation, sandbox, nodeIntegration settings are correct
   - Check for shell.openExternal with user-controlled URLs
   - Check for file:// or custom protocol handler vulnerabilities
   - Check safeStorage usage for proper error handling

4. **Data layer** (data/*.json)
   - Check file permissions assumptions
   - Check for sensitive data stored unencrypted that should be encrypted
   - Check for PII exposure in seed/sample data

5. **Middleware & Auth** (src/middleware.ts, src/lib/api-auth.ts)
   - CSP header completeness
   - Auth bypass vectors
   - Session token entropy and lifetime

For each finding, report:
- Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO
- File and line number
- Description of the vulnerability
- Proof of concept or exploit scenario
- Recommended fix

Do NOT skip files. Do NOT assume anything is safe without reading it. Read every route, every store, every handler.
```

---

## Claude Prompt — Phase 1: Frontend, Client & Transport Audit

I will audit:

1. **All page components** (src/app/(app)/**/page.tsx, src/components/**/*.tsx)
   - XSS via dangerouslySetInnerHTML, innerHTML, or unescaped user content
   - Reflected data in URLs or query params rendered without sanitization
   - Client-side secret exposure (API keys, tokens in React state, localStorage, or DOM)
   - Open redirect via user-controlled href or window.location
   - Sensitive data in console.log statements
   - Insecure postMessage usage

2. **Client-side auth & token handling** (src/lib/api-client.ts, src/contexts/*.tsx)
   - Token storage security (memory vs localStorage vs cookies)
   - Token leakage in requests to third parties
   - Auth state desync between client and server
   - HTTP fallback behavior in production builds

3. **Command palette & user input** (src/components/layout/command-palette.tsx)
   - Command injection via search input
   - Unsafe eval or Function() calls
   - Input that could trigger unintended actions

4. **Onboarding wizard** (src/components/onboarding/onboarding-wizard.tsx)
   - Credential handling during setup flow
   - Connection test URL validation (SSRF from client side)
   - Settings mutation without auth

5. **Chat components** (src/components/chat/*.tsx)
   - Message rendering XSS (markdown, code blocks, HTML in agent responses)
   - Agent-to-agent chat injection (can one agent inject prompts into another?)
   - File upload validation in knowledge base UI

6. **Replay & session sharing** (src/components/replay/*.tsx, src/lib/session-share.ts)
   - HTML export XSS (are shared sessions sanitized?)
   - Import validation (malicious replay files)

7. **Electron preload & IPC from renderer** (electron/preload.js)
   - What APIs are exposed to the renderer?
   - Can the renderer trigger privileged operations?

8. **Third-party dependencies**
   - Known CVEs in package.json dependencies
   - Supply chain risk assessment

---

## Phase 2: Cross-Check (after Phase 1)

### Codex Cross-Check Prompt
```
Claude completed a frontend/client security audit of Mission Control. Here are the findings:

[PASTE CLAUDE'S FINDINGS HERE]

Cross-check these findings:
1. Verify each finding is accurate — read the actual code referenced
2. Check if any finding was a false positive
3. Check if Claude MISSED anything in the frontend layer
4. Rate each finding's severity (agree or adjust)
5. Add any additional frontend findings you discover

Also review Claude's recommended fixes for correctness.
```

### Claude Cross-Check Prompt
I will receive Codex's backend findings and:
1. Verify each finding by reading the actual code
2. Flag false positives
3. Check for anything Codex missed in the backend
4. Validate severity ratings
5. Review recommended fixes

---

## Phase 3: Fix & Verify

After reconciliation, fix all CRITICAL and HIGH findings, then re-audit the fixed code.
