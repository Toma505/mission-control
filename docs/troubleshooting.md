# Mission Control Troubleshooting

## Activation Problems

### Invalid license key

- Re-copy the key exactly as shown on the purchase success page
- Make sure there are no extra spaces before or after the key
- Confirm you are using a Mission Control key, not a Stripe order id

### Activation page does not proceed

- Close and reopen the app
- Retry the key entry
- If it still fails, capture the exact on-screen error and your license email

## Setup Problems

### Could not reach server

- Confirm the OpenClaw URL is correct
- Confirm the OpenClaw server is reachable from your machine
- Confirm the server is listening on the expected port

### Invalid password

- Re-enter the `OPENCLAW_SETUP_PASSWORD`
- Confirm the password matches the value currently configured on the server

## Runtime Problems

### Dashboard says OpenClaw is disconnected

- Open `Preferences` or `Setup` and confirm the saved URL
- Check whether OpenClaw itself is reachable in the browser
- Reload the app after restoring the server

### Budget or mode changes do not apply

- Confirm the app still shows the instance as connected
- Retry from the `Costs` page
- If the change fails, capture the message and copy diagnostics

### Updater says no public release has been published

- This means Mission Control has not published a tagged desktop release yet
- It is not a local app failure

## Support Bundle

Before contacting support:

1. Open `About & Diagnostics`
2. Use `Copy Diagnostics`
3. Include the copied report, platform, and exact error text
