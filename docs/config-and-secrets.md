# Configuration and secrets: where each value lives

This repo follows the Twelve-Factor rule of strict separation between code and config.
Nothing secret is committed; non-secret config may live in compose files and workflows.

## Classes of values

| Class | Examples in this repo | Where it lives | Who reads it | Secret? |
|---|---|---|---|---|
| Build-time config (build args) | `APP_VERSION` | `ARG` in `Dockerfile`, set by `docker-publish.yml` | Docker build; baked into the image as `ENV` | No: visible in `docker history` |
| Build-time secret | `npm_token` | GitHub secret → `--mount=type=secret` in `Dockerfile` | One `RUN` step only | Yes: never written to image layers |
| CI/CD secrets | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `GITHUB_TOKEN` (GHCR), `DEPLOY_TOKEN` (per environment) | GitHub repo / environment secrets | Workflows only; never reach the running app | Yes |
| Deploy-time config | `IMAGE_TAG`, `DB_SECRET_VERSION` | Workflow input / SSM metadata → `deploy/.env` (generated on the runner, git-ignored) | `docker compose` interpolation | No |
| Runtime config | `PORT`, `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` | `environment:` in `deploy/docker-compose.yml` (committed) | The app container | No |
| **Runtime secret** | `notes_app` DB password | **AWS SSM Parameter Store** `SecureString` `/gha-ci-lab/prod/db/app_password` (KMS `alias/aws/ssm`) | Deploy step on the self-hosted runner → `~/app-secrets/db_app_password` (0600, outside the workspace) → Compose secret → `PGPASSWORD_FILE` | **Yes** |
| DB bootstrap secret | Postgres superuser `app` password | `~/db/secrets/db_password.txt` on the VM (0644 in a 0700 dir, git-ignored) | Postgres image on first init only | Yes: candidate to move to SSM |
| Cloud credentials | AWS access for reading SSM | **None stored.** EC2 instance role `gha-ci-lab-ec2-ssm-read` via IMDSv2 | AWS CLI on the VM | n/a |
| Local development | `PGHOST`, `PGPASSWORD`, … | `.env` (git-ignored); `.env.example` committed with dummy values only | Local tests via `dotenv` | Dummy only |

## Runtime secret flow

```
CloudShell (admin) ──put-parameter──▶ SSM Parameter Store (SecureString, versioned)
                                            │  ssm:GetParameter (instance role, read-only, /gha-ci-lab/prod/*)
                                            ▼
deploy-prod.yml on self-hosted runner ──▶ ~/app-secrets/db_app_password (0600)
                                            │  Compose secret (bind mount)
                                            ▼
gha-ci-lab-app container ──reads PGPASSWORD_FILE once at boot──▶ Postgres (user notes_app, SELECT only)
```

- The value is never printed: the workflow masks it with `::add-mask::` and only logs the parameter version.
- `docker inspect` shows `PGPASSWORD_FILE`, not the password.
- The instance role cannot write to SSM, so a compromised VM cannot change the secret.

## Rotation procedure

1. **CloudShell:** `aws ssm put-parameter --name /gha-ci-lab/prod/db/app_password --type SecureString --overwrite --value "$(openssl rand -base64 32 | tr -d '/+=')"`
2. **VM:** read the new value from SSM and apply it with `ALTER ROLE notes_app PASSWORD ...`, piped via stdin (not passed as an argument).
3. **GitHub:** run *Deploy Production* (same image tag). The deploy step fetches the new version and recreates the container (`--force-recreate`).
4. **Verify:** `/health/db` reports the new `secret_version`; the previous version (`name:<n>`) fails with `password authentication failed`.

Known gap: between steps 2 and 3, new DB connections from the app fail. A zero-downtime rotation would use two DB users alternating, or a managed rotation (Secrets Manager + RDS).

## Rotation log

| Date | From → to version | Result |
|---|---|---|
| 2026-11-14 | 1 → 2 | `/health/db` ok with `secret_version: 2`; version 1 rejected (`28P01`); password not found in logs (`grep` → 0) |
