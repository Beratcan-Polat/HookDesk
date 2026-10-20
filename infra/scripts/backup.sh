#!/usr/bin/env sh
set -eu
: "${BACKUP_AGE_RECIPIENT:?Set an age public recipient}"
: "${BACKUP_REMOTE:?Set an rclone remote path}"
: "${DB_USERNAME:?Set DB_USERNAME}"
: "${DB_DATABASE:?Set DB_DATABASE}"
mkdir -p backups
archive="backups/hookdesk-$(date -u +%Y%m%dT%H%M%SZ).sql.age"
# pipefail is not portable: materialize the dump and check its command before encryption.
plain=$(mktemp)
trap 'rm -f "$plain"' EXIT HUP INT TERM
docker compose -f compose.production.yaml exec -T postgres pg_dump --no-owner --no-acl -U "$DB_USERNAME" "$DB_DATABASE" > "$plain"
age -r "$BACKUP_AGE_RECIPIENT" -o "$archive" "$plain"
rclone copyto "$archive" "$BACKUP_REMOTE/$(basename "$archive")"
printf '%s\n' "$archive"
