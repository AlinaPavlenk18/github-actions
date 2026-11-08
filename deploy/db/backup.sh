#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
file="backups/notes_$(date +%F_%H%M).dump"
docker compose exec -T postgres pg_dump -U app -d notes -Fc > "$file"
find backups/ -name '*.dump' -mtime +7 -delete
echo "OK: $file ($(du -h "$file" | cut -f1))"