# Public Checkout Deployment

The public launch uses two hosts:

- `https://orqpilot.com` for the static marketing site
- `https://app.orqpilot.com` for the Next.js purchase app and commerce API routes

## Why Not Vercel

The current commerce flow persists orders to `data/license-orders.json` through
[`billing.ts`](C:/Users/tomas/mission-control/src/lib/billing.ts). That means the
public checkout host needs a writable persistent filesystem.

Until billing storage moves to a database or managed key-value store, a serverless
deploy that assumes a read-only or ephemeral filesystem is the wrong fit.

## Recommended Host

Use Railway with:

- the `Dockerfile.web` image
- a persistent volume mounted at `/data`
- custom domain `app.orqpilot.com`

## Required Environment Variables

Set these on the public checkout host:

```bash
MC_DATA_DIR=/data
MC_LICENSE_SECRET=replace-with-real-secret

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PERSONAL=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...

SMTP_HOST=smtppro.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=support@orqpilot.com
SMTP_PASS=replace-with-zoho-app-password
SMTP_FROM_EMAIL=support@orqpilot.com
SMTP_FROM_NAME=OrqPilot
SMTP_REPLY_TO=support@orqpilot.com
MISSION_CONTROL_SUPPORT_EMAIL=support@orqpilot.com

MISSION_CONTROL_SITE_URL=https://app.orqpilot.com
MISSION_CONTROL_DOWNLOAD_URL=https://github.com/Toma505/mission-control/releases/latest
NEXT_PUBLIC_MISSION_CONTROL_PRICING_URL=https://orqpilot.com/pricing/
```

## Railway Setup

1. Create a new Railway project from this repo.
2. Deploy using `railway.json` / `Dockerfile.web`.
3. Add a volume and mount it at `/data`.
4. Add the environment variables above.
5. Attach the custom domain `app.orqpilot.com`.
6. In Stripe live mode, create a webhook endpoint:
   - `https://app.orqpilot.com/api/commerce/webhook`
7. Subscribe the webhook to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
8. Copy the live `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

## Verification

Before switching the marketing site live:

1. Visit:
   - `https://app.orqpilot.com/purchase/checkout/?plan=personal`
2. Confirm checkout loads.
3. Run one live checkout end to end.
4. Confirm:
   - `/purchase/success?session_id=...` shows the license
   - `data/license-orders.json` on the host volume contains the fulfilled order
   - license email is delivered through `support@orqpilot.com`

## Final Marketing Site Step

Once `app.orqpilot.com` is live, re-upload the static site bundle so the pricing
buttons on `orqpilot.com` point to the hosted checkout app.
