# Release Publishing

Mission Control publishes desktop release artifacts from GitHub Actions when a version tag is pushed.

Current launch scope is Windows-first. Public tag pushes publish the Windows installer and updater metadata. macOS and Linux builds remain available through manual workflow runs while those platforms are still finishing launch prep.

## Prerequisites

- `package.json` version matches the release you want to publish
- `MC_LICENSE_SECRET` is configured in GitHub repository secrets
- GitHub Actions has permission to create releases and upload assets
- your release commit is already pushed to GitHub before you push the tag

## Publish a Release

1. Update `package.json` to the new version.
2. Commit the version bump to the release branch or `main`.
3. Push the release commit to GitHub.
4. Create and push a version tag in the format `vX.Y.Z`.

Example:

```powershell
git push origin HEAD
git tag v1.0.1
git push origin v1.0.1
```

If the tag reaches GitHub before the matching commit, the workflow will build the wrong tree or fail the version check.

## What the Workflow Does

When a `v*` tag is pushed, `.github/workflows/desktop-builds.yml` will:

- build Windows desktop artifacts
- upload the generated installers and update metadata as workflow artifacts
- verify the tag matches the `package.json` version
- create a GitHub Release
- attach the Windows artifacts, blockmaps, and updater metadata files

macOS and Linux builds can still be run manually with `workflow_dispatch` while those platforms are being prepared for a later release.

## Updater Behavior

The desktop updater relies on the GitHub Release assets plus the generated metadata files:

- `latest.yml`
- `latest-mac.yml`
- `latest-linux.yml`

If those files are not published yet, the desktop app will report that no public release has been published.

## First Public Release

The updater will not find anything until the first tagged GitHub Release exists. That is expected. After the first release is published, `Check for Updates` should resolve against the GitHub release feed instead of returning a missing-release message.

## Verification After Publish

After the workflow completes:

1. Open the GitHub Release and confirm it contains:
   - Windows installer and blockmap
   - `latest.yml`
2. In the desktop app, run `Check for Updates`.
3. Confirm the app no longer reports "no public release yet".
4. If this is your first public release, run one live-mode Stripe checkout and webhook pass before announcing launch.
