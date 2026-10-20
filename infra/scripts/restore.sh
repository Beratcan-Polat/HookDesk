#!/usr/bin/env sh
set -eu
: "${RESTORE_AGE_IDENTITY:?Set the age identity path}"
: "${DB_USERNAME:?Set DB_USERNAME}"
: "${DB_DATABASE:?Set DB_DATABASE}"
test "$#" -eq 1 || { echo 'Usage: restore.sh encrypted.sql.age'; exit 1; }
test "${CONFIRM_RESTORE:-}" = "$DB_DATABASE" || { echo 'Set CONFIRM_RESTORE to the destination database name.'; exit 1; }
plain=$(mktemp)
trap 'rm -f "$plain"' EXIT HUP INT TERM
age -d -i "$RESTORE_AGE_IDENTITY" -o "$plain" "$1"
docker compose -f compose.production.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USERNAME" "$DB_DATABASE" < "$plain"
