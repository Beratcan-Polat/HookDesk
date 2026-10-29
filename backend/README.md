# HookDesk API

I built the API with Laravel 13 and PHP 8.4. It handles accounts, workspace permissions, event ingestion, webhook delivery and platform administration. The React application lives in [`frontend`](../frontend).

## Structure

- `app/Actions`: event acceptance, delivery creation, replays and ownership transfer.
- `app/Services`: delivery processing, target validation, signatures, quotas and audit context.
- `app/Http`: controllers, request validation, API resources and authorization middleware.
- `app/Models` and `database/migrations`: event records, delivery state and database constraints.
- `tests`: feature tests, security checks, PostgreSQL concurrency tests and HTTP integration tests.

I keep HTTP requests outside database transactions. A worker claims a delivery with a lease token before sending it; completion is accepted only if the same worker still owns that delivery. PostgreSQL remains the source of delivery state when Redis jobs need to be recovered.

## Commands

```sh
php artisan hookdesk:admin admin@example.com
php artisan hookdesk:dispatch
php artisan hookdesk:prune
php artisan hookdesk:openapi
```

These commands assign the initial administrator role, recover due deliveries, apply retention rules and export the API contract. `hookdesk:demo` creates a sample account and receiver in development environments.

## Checks

```sh
php vendor/bin/pest
php vendor/bin/pint --test
php vendor/bin/phpstan analyse --memory-limit=512M
```

Database tests require an isolated database. Setup and integration-test configuration are covered in the [project README](../README.md) and [testing guide](../docs/runbooks/testing.en.md).
