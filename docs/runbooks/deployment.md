# Linux deployment

## Provision

Use a Linux host with Docker Engine, Compose v2, DNS for your chosen domain and ports 80/443 reachable. Install jq, age and rclone for the optional host egress and off-site backup scripts.

Copy .env.example to .env and set production values: APP_ENV=production, APP_DEBUG=false, APP_URL and FRONTEND_URL=https://your-domain, DOMAIN, APP_KEY, a unique DB_PASSWORD, real MAIL_HOST/PORT/USERNAME/PASSWORD, MAIL_FROM_ADDRESS and SESSION_SECURE_COOKIE=true. Set SANCTUM_STATEFUL_DOMAINS to the exact hostname, without the URL scheme.

Keep RECEIVER_URL=http://receiver:8080. DB_HOST=postgres and REDIS_HOST=redis remain internal service names. Do not change APP_KEY between deployments; existing encrypted signing secrets depend on it.

## Release

Set HOOKDESK_APP_IMAGE and HOOKDESK_GATEWAY_IMAGE to commit-tagged local or registry image names.

```sh
docker compose -f compose.production.yaml build
docker compose -f compose.production.yaml up -d postgres redis
docker compose -f compose.production.yaml run --rm app php artisan migrate --force
docker compose -f compose.production.yaml up -d
sudo sh infra/security/egress.sh
```

The firewall helper must be rerun after worker replacement. It is intended for a Linux Docker host with the iptables backend and IPv6-disabled project networks. Validate it on the actual host; nftables-only hosts need equivalent native rules. PHP-level URL/DNS/IP protections remain mandatory independently.

Check /up, registration, verification mail, password-only administrator access, optional user 2FA, one successful sandbox event, a retry scenario, an incoming source and support start/end. The public gateway returns 404 for /receive paths.

## Monitoring

Administration/Health shows cache/database probes, scheduler/worker heartbeats, pending work, oldest pending time and failed job count. Configure external alerts for /api/ready failures, stale heartbeats and queue age.

## Backup

Set BACKUP_AGE_RECIPIENT to an age public key and BACKUP_REMOTE to a configured rclone remote directory. Set DB_USERNAME and DB_DATABASE in the shell.

```sh
sh infra/scripts/backup.sh
```

Schedule daily using the host's scheduler. The script checks pg_dump before encrypting and copying off-site. Protect APP_KEY, the private age identity and rclone credentials separately.

Restore into an empty destination database using RESTORE_AGE_IDENTITY and CONFIRM_RESTORE equal to DB_DATABASE, then sh infra/scripts/restore.sh backup.sql.age. The dump uses ON_ERROR_STOP through psql. Prove restoration on an isolated database before relying on backups.

## Rollback

Switch the application/gateway image tags to the previous release and recreate those services. Migrations must remain backward compatible; code rollback does not automatically undo schema changes. Use the latest verified backup for a separate data recovery procedure.

## Production configuration

Production requires a configured domain, SMTP service, backup destination and monitoring. Keep deployment credentials outside the repository and verify the application with the [release checklist](smoke-check.md) after each release.
