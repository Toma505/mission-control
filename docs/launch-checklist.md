# Launch Checklist

## Product Readiness

- [x] Packaged app QA
- [x] Clean-machine Windows QA
- [x] Payment and license fulfillment
- [x] Release publishing workflow
- [x] Final pricing decision
- [x] All 33 pages verified working with data
- [x] Extensions page (merged Skills + Plugins)
- [x] Demo data populated for all pages
- [x] API fallbacks for all routes (works without live OpenClaw)

## Security

- [x] Independent security audit (Claude + Codex)
- [x] Reconciled audit report written
- [x] Key vault encryption at rest (AES-256-GCM)
- [x] Auth token endpoint hardened (disabled by default)
- [x] Plaintext fallback visibility (warnings in persisted files)
- [x] Instance URL validation (SSRF prevention)
- [x] False DPAPI claim removed from UI
- [x] CSP headers and security middleware reviewed
- [ ] Dependency upgrade pass (Next.js 16.1.6 — post-launch maintenance)

## Customer Support Readiness

- [x] Quick-start guide
- [x] Troubleshooting guide
- [x] Install and update guide
- [x] Support inbox configured
- [x] License email delivery verified
- [x] Support-side resend flow verified
- [x] Refund policy finalized

## Website / Trust Readiness

- [x] Privacy policy page
- [x] Terms of service page
- [x] FAQ page
- [x] Features page
- [x] Roadmap page (new)
- [x] Real app screenshots (not SVG mockups)
- [x] DMARC record configured for launch email deliverability
- [ ] Final website review on orqpilot.com
- [ ] Redeploy website to Cloudflare Pages (includes roadmap, updated screenshots, download metadata)

Suggested DMARC starter record:

```txt
Host: _dmarc
Type: TXT
Value: v=DMARC1; p=none; rua=mailto:support@orqpilot.com; adkim=s; aspf=s
```

## Paid Blockers

- [ ] Windows code signing (OV cert $212-420/yr)
- [ ] Apple notarization if Mac is included at launch

## Release Day

1. Confirm `package.json` version.
2. Push the release commit.
3. Push tag `vX.Y.Z`.
4. Verify GitHub Release assets.
5. Verify updater feed against the public release.
6. Deploy the public purchase app at `https://app.orqpilot.com`.
7. Repoint pricing CTAs to `https://app.orqpilot.com/purchase/checkout/` and redeploy the marketing site.
8. Run one live-mode Stripe checkout + webhook verification pass.

See [public-checkout-deploy.md](C:/Users/tomas/mission-control/docs/public-checkout-deploy.md) for the public purchase-app deployment steps.
