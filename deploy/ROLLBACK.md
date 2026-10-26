# Rollback runbook

The production deploy workflow (`.github/workflows/deploy-prod.yml`)
accepts an `image_tag` input. Images are tagged on every push to `main`
(as `sha-<short-sha>`) and on every `git tag vX.Y.Z` push (as `vX.Y.Z`
and `latest`).

## To roll back to a previous version

1. Find the tag to roll back to:
   - GHCR package page (Packages → gha-ci-lab → Versions), or
   - `git tag --sort=-creatordate` for semantic version tags.
2. Go to **Actions → Deploy Production → Run workflow**.
3. Set `image_tag` to the desired tag (e.g. `v1.0.0` or `sha-abc1234`).
4. Run the workflow. It pulls that exact image and restarts the
   container; no rebuild happens.
5. Verify: `curl -I https://app.alina-test.pp.ua` and check the
   `version` field in the JSON response at `https://app.alina-test.pp.ua/`.

## To roll back further than available tags

Rebuild is required only if the target version predates tagging
discipline. Otherwise every deploy is just a tag swap — no SSH, no
manual steps on the VM.