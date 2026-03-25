# Cloudflare WAF And Rate Limit Rules

These rules complement the server-side throttling already in the app. They are not applied automatically from the repo and must be added in the Cloudflare dashboard.

## Rule Order

1. Allow verified bots
2. Exempt Stripe webhook from challenge rules
3. Block obvious exploit-path probes
4. Rate-limit sensitive public routes

## 1. Allow Verified Bots

**Action:** Skip custom WAF rules

**Expression:**

```txt
cf.client.bot
```

## 2. Exempt Stripe Webhook

**Action:** Skip rate limiting and challenge rules

**Expression:**

```txt
http.host eq "app.orqpilot.com" and http.request.uri.path eq "/api/commerce/webhook"
```

## 3. Block Obvious Exploit Paths

**Action:** Block

**Expression:**

```txt
http.request.uri.path in {
  "/wp-login.php"
  "/xmlrpc.php"
  "/wp-admin"
  "/.env"
  "/vendor/.env"
  "/cgi-bin"
  "/cgi-bin/"
  "/boaform/admin/formLogin"
}
```

## 4. Managed Challenge On Sensitive Public Routes

**Action:** Managed Challenge

**Expression:**

```txt
http.host eq "app.orqpilot.com" and (
  http.request.uri.path eq "/api/commerce/checkout" or
  http.request.uri.path eq "/api/license-control/activate" or
  http.request.uri.path eq "/api/license-control/validate" or
  http.request.uri.path eq "/download/windows"
)
```

## 5. Rate Limit: Checkout Session Creation

**Action:** Managed Challenge or Block

**Characteristics:**
- Host: `app.orqpilot.com`
- Path: `/api/commerce/checkout`
- Threshold: `10` requests per `10` minutes per IP

## 6. Rate Limit: License Activation

**Action:** Managed Challenge or Block

**Characteristics:**
- Host: `app.orqpilot.com`
- Path: `/api/license-control/activate`
- Threshold: `15` requests per `10` minutes per IP

## 7. Rate Limit: License Lease Validation

**Action:** Managed Challenge or Block

**Characteristics:**
- Host: `app.orqpilot.com`
- Path: `/api/license-control/validate`
- Threshold: `120` requests per `15` minutes per IP

## 8. Rate Limit: Windows Installer Download

**Action:** Managed Challenge

**Characteristics:**
- Host: `app.orqpilot.com`
- Path: `/download/windows`
- Threshold: `12` requests per `30` minutes per IP

## Notes

- Do not add country or ASN blocking until you have real user traffic data proving the need.
- Keep an eye on challenge solve rate before making the rules stricter.
- The webhook exemption must stay above the challenge and rate-limit rules.
