# Launch Checklist

## Product Readiness

- [x] Packaged app QA
- [x] Clean-machine Windows QA
- [x] Payment and license fulfillment
- [x] Release publishing workflow
- [ ] Final website review after redeploy
- [x] Final pricing decision

## Customer Support Readiness

- [x] Quick-start guide
- [x] Troubleshooting guide
- [x] Install and update guide
- [x] Support inbox configured
- [x] License email delivery verified
- [x] Support-side resend flow verified
- [x] Refund policy finalized

## Website / Trust Readiness

- [ ] Redeploy the static website so `/privacy/` and `/terms/` are live on `orqpilot.com`
- [ ] Final website review on `orqpilot.com`
- [x] Privacy policy page
- [x] Terms of service page
- [ ] DMARC record configured for launch email deliverability

Suggested DMARC starter record:

```txt
Host: _dmarc
Type: TXT
Value: v=DMARC1; p=none; rua=mailto:support@orqpilot.com; adkim=s; aspf=s
```

## Paid Blockers

- [ ] Windows code signing
- [ ] Apple notarization if Mac is included at launch

## Release Day

1. Confirm `package.json` version.
2. Push the release commit.
3. Push tag `vX.Y.Z`.
4. Verify GitHub Release assets.
5. Verify updater feed against the public release.
6. Run one live-mode Stripe checkout + webhook verification pass.
7. Publish or redeploy the website if any static pages changed since the last upload.
