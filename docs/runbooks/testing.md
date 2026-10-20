# Testing

I focus the tests on workspace isolation, delivery recovery, duplicate requests and the boundary between administrator and support permissions.

## Unit and feature tests

From `backend`:

```sh
php vendor/bin/pest
php vendor/bin/pint --test
php vendor/bin/phpstan analyse --memory-limit=512M
```

The default test profile uses SQLite in memory. PostgreSQL-specific cases are skipped in that profile. Database tests run migrations and remove test tables; always use a dedicated test database when overriding the default connection, including when running tests inside containers.

## PostgreSQL integration

Configure `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE=hookdesk_test`, `DB_USERNAME` and `DB_PASSWORD` in the test process. PHP must have `pdo_pgsql` enabled.

The concurrency tests start four independent PHP processes with the same idempotency key, then check that only one event was accepted. A separate test races four workers to claim one delivery.

The HTTP integration test starts a receiver on an ephemeral loopback port. It checks real signed requests, transient failures, receiver deduplication and response-body truncation.

## Redis integration

Set `RUN_REDIS_TESTS=true` to enable the queue round-trip test. Configure an isolated Redis instance or database through `REDIS_HOST`, `REDIS_PORT` and `REDIS_DB`; do not share it with application data.

## Frontend

From `frontend`:

```sh
npm ci
npm run lint
npm run test
npm run build
```

## Browser journeys

Start the API, receiver, worker, scheduler and frontend against a development or browser-test database. Set `E2E_EMAIL` and `E2E_PASSWORD` for a verified test account. `hookdesk:demo` creates the sample user and workspace used by the test fixtures.

Create the administrator fixture from `backend`:

```sh
php tests/Support/seed-browser.php
```

Save its JSON output to a Git-ignored file and set `E2E_ADMIN_FILE` to that file's absolute path. The output contains generated credentials and a TOTP secret. The fixture helper is disabled in production.

From `frontend`:

```sh
npx playwright install chromium
npm run test:e2e
```

The journeys cover public navigation, English/Turkish text, mobile layout, login errors, password recovery, event publishing, administrator TOTP, step-up and writable support sessions. The administrator test waits for a new authenticator interval because Fortify rejects TOTP reuse.

Screenshots and failure traces are written to the ignored `test-results` and `playwright-report` directories.

## CI

[GitHub Actions](../../.github/workflows/ci.yml) runs backend checks with PostgreSQL and Redis, frontend checks, container builds and browser journeys. Run results are available in the repository's [Actions tab](https://github.com/Beratcan-Polat/HookDesk/actions).
