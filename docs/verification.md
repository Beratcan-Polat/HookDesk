# Validation notes

I use unit, integration and browser tests to check event delivery and authorization. This page records completed checks and separates them from the production release checklist.

## Local checks — 20 October 2026

- **Backend:** 49 tests passed with 135 assertions against PostgreSQL 18. The Redis-specific test was skipped in this run.
- **Concurrency:** four independent processes submitted the same idempotency key; another four raced to claim one delivery.
- **HTTP delivery:** signed requests, two transient failures followed by success, receiver deduplication and bounded response capture.
- **Frontend:** five Vitest tests, ESLint, TypeScript strict checks and the production build passed.
- **Browser:** all four Chromium journeys passed across the verification runs, including administrator TOTP, step-up, support edits and session termination.
- **Static analysis:** Pint and Larastan/PHPStan passed.
- **Configuration:** development/production Compose files, Caddy files and script syntax were validated.
- **API contract:** the documentation and frontend OpenAPI copies matched the 82 exported routes.
- **Recovery:** an encrypted PostgreSQL dump was restored into a separate database and its event count matched the source.

## CI

All four jobs passed in the [22 October CI run](https://github.com/Beratcan-Polat/HookDesk/actions/runs/39741115210): backend, frontend, container builds and browser journeys. This followed a fix to service health-check argument quoting, which had stopped the browser job during initialization in the initial run.

Current results are available in [GitHub Actions](https://github.com/Beratcan-Polat/HookDesk/actions). Commands and environment setup are documented in the [testing guide](runbooks/testing.md).

## Docker validation — 22 October 2026

I started the complete development stack with PHP 8.4, PostgreSQL 18, Redis 8, Caddy, the frontend and Mailpit. A repeated setup preserved the root environment file and application key.

- **Backend:** 51 tests passed with 149 assertions against a dedicated PostgreSQL database, including the real Redis queue test. Larastan and formatting checks passed.
- **Acceptance limits:** event and delivery reads remain available after the project's acceptance limit is exhausted and do not consume that limit.
- **Registration:** a unique account registered through Caddy, received its SMTP email in Mailpit and completed signed email verification with its CSRF-protected session.
- **Delivery:** an API event reached the internal HMAC-verifying receiver with actual `500`, `500`, then `200` responses at the configured retry intervals.
- **Idempotency:** the duplicate request returned the original event without increasing event usage; a conflicting body returned `409`.
- **Replay and sources:** replay retained the event identity and the receiver reported a duplicate. Capture-only and forwarding sources both passed.
- **Recovery:** an event accepted while the worker was stopped was delivered after restarting Redis and starting the worker again.

The [smoke script](../infra/scripts/smoke.mjs) reproduces these HTTP checks. The container CI job also runs it with `--recovery`, including a separate backend environment file to check that the receiver retains Docker configuration.

## Panel checks — 22 October 2026

- **Backend:** 56 tests passed with 179 assertions against the isolated PostgreSQL test database, including Redis and concurrency checks. Added cases cover mixed bulk-replay outcomes, the 100-record boundary, limit inheritance/reset authorization and ownership candidates whose status changes.
- **Frontend:** 15 Vitest tests passed. New cases cover English/Turkish replay results, selection across pages, the 100-record cap, typed limit input and verified ownership candidates.
- **Browser coverage:** the suite now includes two additional English/Turkish panel journeys against generated, isolated fixtures. Current run results remain available in GitHub Actions.

## Release checks

Production validation includes live email delivery, HTTPS, host egress rules, worker recovery, off-site backups, restore tests and monitoring. These checks are tracked in the [release checklist](runbooks/smoke-check.md) and [deployment guide](runbooks/deployment.md).

Load testing and failure tests on the target server are separate from the local application tests. The project does not currently publish production availability or throughput figures.
