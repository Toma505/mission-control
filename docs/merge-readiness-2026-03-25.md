# Merge Readiness

## Current State

- Branch: `codex/payment-fulfillment`
- Ahead of local `main`: `49` commits
- Behind local `main`: `0` commits
- Latest branch head: `c2294f8`
- Latest release tag: `v1.0.5`

## Recommendation

Use a **squash merge into `main`** after one final smoke pass on the current live baseline.

## Why squash is the right strategy

- This branch is long-lived and contains many iterative hotfixes, release-prep commits, and emergency updater/licensing fixes.
- The branch history is useful for forensic debugging, but it is too noisy for `main`.
- Release tags such as `v1.0.2` through `v1.0.5` will still preserve the detailed historical checkpoints even if `main` gets a single clean squash commit.
- A squash merge gives `main` a clean launch narrative instead of dozens of operational/debugging commits.

## Suggested timing

Merge after:

1. one last desktop smoke pass on `v1.0.5`
2. confirmation that checkout, activation, and download all behave normally
3. confirmation that the current Cloudflare rule state only challenges `/api/commerce/checkout`

## Suggested squash commit title

Launch Mission Control public checkout, licensing, updater, and operations feature set

## Suggested squash commit body

- add live checkout and webhook fulfillment
- harden server-backed desktop licensing and updater flow
- publish Windows desktop release flow
- add analytics, webhooks, presets, snapshots, replay, vault, reports, benchmarks, onboarding, shortcuts, and audit log
- polish website metadata, download flow, and launch security posture

## What not to do

- Do not rebase away the release tags.
- Do not keep this branch open indefinitely after launch unless it becomes the ongoing release branch by design.
- Do not merge before verifying the `v1.0.5` baseline, because it is the first build that meaningfully cleans up the activation and updater issues.
