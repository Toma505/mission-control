# Mission Control Payment + License Fulfillment

Mission Control now has a Stripe-ready checkout and webhook fulfillment path that issues the existing offline HMAC licenses automatically.

## Why Stripe

- Fits the current offline HMAC activation model without changing the desktop app
- Test mode is free, so the full flow can be built before paying
- Hosted Checkout removes most PCI scope and form UX work

## Flow

1. Customer clicks a pricing CTA on the website.
2. Website links to `/purchase/checkout?plan=...`.
3. The checkout page calls `POST /api/commerce/checkout` with the selected plan id.
4. Server creates a Stripe Checkout Session.
5. Stripe redirects back to `/purchase/success?session_id=...`.
6. Stripe webhook calls `POST /api/commerce/webhook`.
7. Webhook issues an offline Mission Control license key.
8. Fulfilled order is persisted to `data/license-orders.json`.
9. If SMTP is configured, the webhook also emails the fulfilled license key.
10. Success page reads the order by `session_id` and shows the key + delivery status.

## Launch Decisions Locked In

- Pricing: `Personal $9.99`, `Pro $29.99`, `Team $79.99`
- All plans include `1 year of updates`
- Refund policy: `14-day manual refund window`
- Launch scope: `Windows first`, `macOS shortly after`

## Required Environment Variables

These can all be configured without paying for production yet by using Stripe test mode.

```bash
MC_LICENSE_SECRET=replace-with-real-secret

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PERSONAL=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...

# Optional SMTP email delivery
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=licenses@example.com
SMTP_FROM_NAME=Mission Control
SMTP_REPLY_TO=support@example.com
MISSION_CONTROL_SUPPORT_EMAIL=support@example.com

MISSION_CONTROL_SITE_URL=https://missioncontrol.openclaw.dev
MISSION_CONTROL_DOWNLOAD_URL=https://github.com/Toma505/mission-control/releases/latest
NEXT_PUBLIC_MISSION_CONTROL_PRICING_URL=https://missioncontrol.openclaw.dev/pricing/
```

## Local Testing

1. Create Stripe test-mode prices for Personal / Pro / Team.
2. Point the env vars above at those test prices.
3. Start the app/server:

```bash
npm run dev
```

4. Open `/purchase/checkout?plan=pro` or create a checkout session directly:

```bash
curl -X POST http://127.0.0.1:3000/api/commerce/checkout ^
  -H "Content-Type: application/json" ^
  -d "{\"planId\":\"pro\",\"email\":\"you@example.com\"}"
```

5. Forward Stripe webhooks to the local route with Stripe CLI and complete a test purchase.
6. Confirm fulfillment in:

- `data/license-orders.json`
- `/purchase/success?session_id=...`
- `POST /api/commerce/order` with `action: "lookup"` plus `x-mc-token` for support recovery

### Verified locally

The end-to-end Stripe sandbox flow has now been verified on this branch:

- hosted checkout session created successfully
- Stripe CLI forwarded webhook events to `/api/commerce/webhook`
- fulfilled order was written to `data/license-orders.json`
- `/purchase/success` displayed the generated offline license key

SMTP delivery was implemented after that verification pass and still needs one real configured send test.

## Support Recovery

The support-side order lookup route is:

- `POST /api/commerce/order`
- requires `x-mc-token`
- supports `action: "lookup"` with one of:
  - `sessionId`
  - `email`
  - `licenseKey`
- supports `action: "resend"` with:
  - `sessionId`, or
  - `licenseKey`, or
  - `email` when exactly one order matches
- supports `action: "mark_refunded"` with:
  - `sessionId`, or
  - `licenseKey`, or
  - `email` when exactly one order matches
  - optional `reason`
  - optional `notes`

This is enough for manual recovery today, resend workflows once SMTP is configured, and internal refund-state tracking for support.

## Still Needed Before Launch

- Configure real SMTP credentials and verify one live resend flow
- Replace test-mode Stripe credentials and prices with live launch values when pricing is final
