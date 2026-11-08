# PostgreSQL stack (M08)

Stateful PostgreSQL 16 running in Docker Compose on the production EC2 VM,
separate from the application stack in `deploy/docker-compose.yml`.

| Item | Value |
|---|---|
| Compose project | `gha-db` |
| Container | `gha-postgres` |
| Image | `postgres:16-alpine` |
| Data volume | `gha-db_pgdata` (named volume) |
| Database / user | `notes` / `app` |
| Port | `127.0.0.1:5432` only (loopback) |
| Location on VM | `/home/deploy/db` |

## Why a separate stack

- The app is redeployed and rolled back often; the database should not be touched by those deploys.
- The secret file lives outside the runner workspace, so `actions/checkout` (`git clean -ffdx`) cannot delete it.

## Access model

- The DB port is bound to `127.0.0.1` on the VM and is **not** allowed in the EC2 Security Group.
- Inbound rules: `22` (admin IP only), `80`, `443`. No rule for `5432`.
- Admin access goes through an SSH tunnel, which is only reachable from the allow-listed admin IP:

```bash
ssh -i ~/.ssh/gha-ci-lab-prod.pem -N -L 15432:127.0.0.1:5432 deploy@<VM_IP>
# then connect to 127.0.0.1:15432 (psql / DBeaver)
```

Note: Docker publishes ports via its own iptables rules and bypasses UFW, so binding to
`127.0.0.1` plus the Security Group are the two layers of protection.

## First-time setup (on the VM)

```bash
mkdir -p ~/db/secrets ~/db/backups
chmod 700 ~/db/secrets
cd ~/db
# copy docker-compose.yml from this folder
openssl rand -base64 32 | tr -d '/+=' > secrets/db_password.txt
chmod 644 secrets/db_password.txt   # readable by the postgres user inside the container
docker compose up -d
docker compose ps                   # should be (healthy)
```

`secrets/` and `backups/` are git-ignored. The password is never committed.

`POSTGRES_PASSWORD_FILE` is only applied when the volume is empty (first init).
To change the password later, use `ALTER USER app PASSWORD '...';`.

## Persistence

```bash
docker compose down      # container removed, volume kept
docker compose up -d     # new container, same data
```

> ⚠️ Never run `docker compose down -v` here. It deletes the volume and all data.

## Backup

```bash
cd ~/db
./backup.sh
# or manually:
docker compose exec -T postgres pg_dump -U app -d notes -Fc > backups/notes_$(date +%F_%H%M).dump
```

- `-Fc` is the custom format (compressed, supports selective restore).
- `-T` is required: without it Compose allocates a TTY and corrupts the binary dump.
- `backup.sh` keeps 7 days of dumps.
- A backup on the same VM dies with the VM. Copy dumps off-host:

```bash
scp -i ~/.ssh/gha-ci-lab-prod.pem "deploy@<VM_IP>:/home/deploy/db/backups/*.dump" ./
```

## Restore into a fresh container (test)

```bash
docker run -d --name pg-restore-test \
  -e POSTGRES_USER=app -e POSTGRES_DB=notes -e POSTGRES_PASSWORD=temp \
  postgres:16-alpine
until docker exec pg-restore-test pg_isready -U app -h 127.0.0.1; do sleep 1; done

docker exec -i pg-restore-test pg_restore -U app -d notes \
  --no-owner --exit-on-error -v < backups/<file>.dump

docker exec pg-restore-test psql -U app -d notes -c "
SELECT count(*), md5(string_agg(id || ':' || body, ',' ORDER BY id)) AS checksum FROM notes;"

docker rm -f -v pg-restore-test
```

## Verification (2026-11-08)

| Check | Result |
|---|---|
| Data after `docker compose down` / `up` (new container ID) | `count = 101`, same checksum |
| `ss -ltnp` on VM | `127.0.0.1:5432` |
| `Test-NetConnection <VM_IP> -Port 5432` from admin laptop | `TcpTestSucceeded : False` |
| psql via SSH tunnel | connected, `count = 101` |
| Restore of `notes_2026-11-08_1203.dump` into fresh container | `count = 101`, checksum `380d37ade1ec3337b1764f9f7e06e874` (matches source) |

## Trade-off

A single-VM database is a deliberate choice for a lab or dev environment: cheap, simple, full control.
Its limits:

- Single point of failure: no replica, no failover.
- RPO equals the time since the last dump; there is no point-in-time recovery.
- Upgrades, OS patches, monitoring and backup checks are manual.
- App and DB share the resources of one small instance.

Move to a managed database (e.g. Amazon RDS, see M13) when the data is real and valuable,
when PITR, Multi-AZ, automated backups or encryption are required, or when nobody owns DB operations.
