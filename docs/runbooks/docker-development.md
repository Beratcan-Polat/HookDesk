# Docker development

The development stack runs PHP 8.4, PostgreSQL 18, Redis 8, Caddy, the React development server and Mailpit. The API, worker, scheduler and test receiver use the same backend image.

## Start and stop

On Windows, start Docker Desktop with Linux containers, then run from the project root:

```powershell
.\infra\scripts\setup.ps1
```

The script detects both Docker Desktop installation locations, checks the engine, builds the application image, installs locked PHP dependencies and runs migrations before starting the worker. It creates `APP_KEY` only when the root `.env` value is empty. Existing data and the application key are preserved on subsequent runs.

The first run downloads images and dependencies. Setup waits for the frontend, API and Mailpit before reporting success.

- Application: [localhost:8080](http://localhost:8080)
- Development mail: [localhost:8025](http://localhost:8025)

After setup, routine starts and stops use:

```sh
docker compose up -d --wait --wait-timeout 600
docker compose stop
```

Source code is mounted from the checkout. PHP dependencies, Laravel bootstrap cache and Node dependencies use named volumes so Windows and Linux installations do not share generated files. PostgreSQL and Redis also persist in named volumes; stopping containers keeps this data.

The Docker stack reads the root `.env`. A native PHP process reads `backend/.env`; these can use different databases and do not share accounts or sessions. The sandbox receiver uses `--no-reload` so Laravel's development server preserves the container environment when a native `.env` file is present.

## Verify the complete flow

With the stack running, use Node.js 24 or newer:

```sh
node infra/scripts/smoke.mjs
```

I use this check to exercise the running application through Caddy:

1. Probe API readiness and confirm that the private receiver route is blocked.
2. Register a unique account with a CSRF-protected session.
3. Read its verification email from Mailpit and follow the signed link.
4. Create a workspace, project, sandbox endpoint and API key through the dashboard API.
5. Submit an event through the public API; check duplicate acceptance and reject a conflicting idempotency body.
6. Wait for actual signed HTTP deliveries with `500`, `500`, then `200` responses, using the configured retry delays.
7. Replay the delivery and verify that the receiver recognizes the unchanged event ID as a duplicate.
8. Check capture-only and capture-and-forward sources.

The script uses unique test data and does not print passwords, API keys or source tokens. After the run it revokes its API key, archives its workspace and requests deletion of the verified test account through the normal 30-day deletion flow. Event history remains available for inspection until retention removes it. If setup fails before email verification, an unverified test account can remain.

For a dedicated development stack, include the recovery check:

```sh
node infra/scripts/smoke.mjs --recovery
```

This temporarily stops the worker, accepts an event, restarts Redis and starts the worker again. The check passes only after the accepted event is delivered. Other deliveries in that stack wait while the worker is stopped. CI runs this mode in its isolated stack.

`SMOKE_URL` and `MAILPIT_URL` can override the default loopback addresses. Recovery mode verifies the gateway port against this checkout's Compose stack before changing services. `DOCKER_BIN` can select a Docker executable outside `PATH`.

## Diagnose startup failures

```sh
docker compose ps --all
docker compose logs --tail 100 frontend-dev
docker compose logs --tail 100 app worker scheduler receiver gateway
```

An exited frontend container usually needs its first npm error inspected. `npm ci` requires the committed lock file to match `package.json`; running `npm install` with a different npm version can rewrite bundled optional dependency records. Keep lock-file changes intentional and verify a clean install before committing them.

If an image or locked dependency changes, rerun setup to rebuild the image and refresh the dependency volume. Do not remove database volumes to resolve a dependency installation problem.
