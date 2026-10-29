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

Start the API, receiver, worker, scheduler and frontend against a dedicated browser-test database. Set `E2E_EMAIL` and `E2E_PASSWORD` for a verified test account. `hookdesk:demo` creates the sample user and workspace used by the test fixtures.

Create the administrator fixture from `backend`:

```sh
php tests/Support/seed-browser.php
```

Save its JSON output to a Git-ignored file and set `E2E_ADMIN_FILE` to that file's absolute path. The output contains generated credentials and a TOTP secret. The fixture helper is disabled in production.

The helper refreshes the test administrator's credentials and creates separate English and Turkish workspaces, verified/unverified members and synthetic terminal deliveries for panel tests. These workspaces are used for real ownership transfers and limit changes; keep this data in the browser-test database.

For invitation, enrollment and support-lifecycle tests, use `APP_ENV=testing` and a database named `hookdesk_browser` (or `hookdesk_browser_<suffix>`). Create the additional fixtures from `backend` and save the output privately:

```sh
php tests/Support/seed-lifecycle.php > ../.runtime/browser-lifecycle.json
```

Set `E2E_LIFECYCLE_FILE` to that JSON file's absolute path. Each language gets separate owners, invitees and users without 2FA. Configure the worker to send SMTP to Mailpit and set `E2E_MAILPIT_URL` to its HTTP API, defaulting to `http://localhost:8025`. Invitation tests follow the actual queued email link; they do not fabricate notification responses.

The CLI-only `control-browser.php` helper reads the enrollment secret and expires a support record belonging to these fixtures. Both environment and database-name checks run before access, and the record must match the private fixture file. No clock-control HTTP route is added to the application. Never run fixture setup against either development account database.

From `frontend`:

```sh
npx playwright install chromium
npm run test:e2e
```

The twelve journeys cover public navigation, English/Turkish text, mobile layout, login errors, password recovery, event publishing, password-only administrator login, password confirmation and writable support sessions. The panel journeys exercise bulk replay, limit overrides, restoration of inherited defaults and ownership transfer to a verified member. Administrator login and step-up helpers assert that no authenticator code is requested.

Six additional journeys run in English and Turkish:

- Team invitations: queued SMTP, translated email, mismatched email rejection, expired and reused invitation rejection, successful acceptance and viewer write restrictions.
- Two-factor authentication: QR enrollment, rejection of an invalid code, confirmation, recovery codes hidden after reload, authenticator login, recovery login, rejection of a consumed code and acceptance of a different code. These tests disable screenshots and traces for enrollment screens.
- Support lifecycle: the server returns no expiry, permitted writes succeed, advancing the browser clock by two days leaves the session active, explicit revocation removes product controls, stale reads/writes return `403` and the real administrator remains signed in.

The support tests advance the browser clock and revoke the matching isolated database record to verify both unlimited duration and server-side termination.

Screenshots and failure traces are written to the ignored `test-results` and `playwright-report` directories.

## Docker smoke test

After starting the development stack, run from the repository root with Node.js 24:

```sh
node infra/scripts/smoke.mjs
```

This verifies SMTP through Mailpit, signed email verification, cookie/CSRF authentication, API keys, idempotency, actual webhook retries, receiver deduplication and incoming sources. `--recovery` also stops the worker and restarts Redis before verifying a queued delivery. Run that mode on a dedicated development stack. See the [Docker development guide](docker-development.md) for setup, cleanup and diagnostics.

## Load tests

Run `node infra/performance/run.mjs` from the repository root for an isolated Docker baseline, or add `--smoke` for the smaller CI workload. It measures API latency, queue/delivery times, real signed receipt counts and Docker resource samples. The [performance guide](performance.md) documents workload sizes, limit overrides, cleanup and measurement precision.

## CI

[GitHub Actions](../../.github/workflows/ci.yml) runs backend checks with PostgreSQL and Redis, frontend checks, container builds, the complete Docker smoke/recovery flow, browser journeys and an isolated load-test smoke profile. Run results are available in the repository's [Actions tab](https://github.com/Beratcan-Polat/HookDesk/actions).
