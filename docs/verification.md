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

In the [initial CI run](https://github.com/Beratcan-Polat/HookDesk/actions/runs/39452794206), the backend, frontend and container-build jobs passed. The browser job stopped during service-container initialization, before its test steps ran.

Current results are available in [GitHub Actions](https://github.com/Beratcan-Polat/HookDesk/actions). Commands and environment setup are documented in the [testing guide](runbooks/testing.md).

## Release checks

Production validation includes live email delivery, HTTPS, host egress rules, worker recovery, off-site backups, restore tests and monitoring. These checks are tracked in the [release checklist](runbooks/smoke-check.md) and [deployment guide](runbooks/deployment.md).

Load testing and failure tests on the target server are separate from the local application tests. The project does not currently publish production availability or throughput figures.
