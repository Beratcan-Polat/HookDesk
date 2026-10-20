# HookDesk

[Türkçe](README.tr.md) · [Architecture](docs/architecture/overview.md) · [API](docs/api/openapi.json) · [Testing](docs/runbooks/testing.md)

I built HookDesk to manage webhook delivery between applications and make each delivery traceable. The starting point was a common failure: a destination goes offline, an event cannot be delivered, and there is no clear record of what happened or a way to retry it.

I separated the Laravel 13 backend from the React 19 and TypeScript frontend. PostgreSQL stores events and delivery state; Redis handles queueing, caching and rate limits.

## Features

- Email verification, password recovery and two-factor authentication.
- Workspaces, projects, team invitations and role-based permissions.
- Project API keys and incoming webhook sources.
- Event-type subscriptions and outgoing requests signed with HMAC-SHA256.
- Automatic retries, manual replays and an attempt history for each delivery.
- Idempotency support to prevent duplicate events when a request is repeated.
- Usage limits, endpoint pausing and audit logs.
- Super Admin controls and scoped, writable support sessions that expire after 30 minutes.
- English and Turkish interfaces.

## Delivery flow

1. The API validates the key, project access and usage limits.
2. The event and its deliveries are saved in one PostgreSQL transaction.
3. A worker sends the signed HTTP request and records the result.
4. Transient failures are rescheduled. A scheduler recovers due or interrupted work from the database if queue messages are lost.

A `202` response means the event has been durably accepted. Delivery order is not guaranteed, and a destination may receive the same event more than once. I included event-ID deduplication in the example receiver for that reason.

## Stack

- **Backend:** PHP 8.4, Laravel 13, Eloquent, Sanctum and Fortify.
- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui and i18next.
- **Data and infrastructure:** PostgreSQL 18, Redis 8, Docker Compose, Caddy and Mailpit.
- **Testing and quality:** Pest, Larastan, Pint, Vitest, React Testing Library, Playwright and GitHub Actions.

## Getting started

Docker Engine and Docker Compose are required. On Windows, use Docker Desktop with Linux containers and WSL 2.

```sh
git clone https://github.com/Beratcan-Polat/HookDesk.git
cd HookDesk
```

### Windows

The setup script prepares the environment file, generates the application key, starts the services and runs migrations:

```powershell
.\infra\scripts\setup.ps1
```

### Linux

From a fresh clone:

```sh
cp .env.example .env
docker compose build app
docker compose run --rm --user root app composer install --no-interaction
docker compose run --rm --user root app sh -c 'chown -R www-data:www-data storage bootstrap/cache'
docker compose run --rm app php artisan key:generate --show
```

Set `APP_KEY` in the root `.env` file to the value printed by the last command, then run:

```sh
docker compose up -d
docker compose exec app php artisan migrate --force
```

- Application: [localhost:8080](http://localhost:8080)
- Development email: [localhost:8025](http://localhost:8025)

I also documented [development without Docker](docs/runbooks/native-development.md).

## Trying the application

Register through the application and open the verification email in Mailpit. To start with a sample workspace instead:

```sh
docker compose exec app php artisan hookdesk:demo
```

This creates a development account with a random password and a test destination. Credentials are printed in the command output. The destination returns `500` for its first two requests and `200` for the next one, making the retry history visible in the dashboard. This command is disabled in production.

To create the first Super Admin, verify an account's email and enable two-factor authentication, then run:

```sh
docker compose exec app php artisan hookdesk:admin admin@example.com
```

Sign in again to open the administration menu. Password and TOTP verification grants five minutes of access for sensitive operations, and administrative changes require a reason. Fortify rejects TOTP code reuse. Support sessions retain both the administrator and the user being assisted, and enforce that user's workspace permissions.

## API usage

Publish events through `POST /api/v1/events`, using a project API key in the `Authorization: Bearer ...` header and `Content-Type: application/json`:

```json
{
  "type": "order.created",
  "data": {
    "order_id": "ORD-1042",
    "amount": 1200
  }
}
```

The optional `Idempotency-Key` header maps an identical raw request body to the same event for 24 hours. I included an [example receiver](examples/receiver.php) for signature verification and deduplication, and an [OpenAPI contract](docs/api/openapi.json) for the API routes.

## Tests

```sh
cd backend
php vendor/bin/pest
php vendor/bin/pint --test
php vendor/bin/phpstan analyse --memory-limit=512M

cd ../frontend
npm run lint
npm run test
npm run build
```

PostgreSQL and Redis integration tests require isolated test databases. Playwright journeys require the application services to be running. Environment variables and commands are in the [testing guide](docs/runbooks/testing.md); recorded results are in the [validation notes](docs/verification.md).

## Documentation

- [Architecture and delivery model](docs/architecture/overview.md)
- [Technical decisions](docs/decisions)
- [API authentication](docs/api/authentication.md)
- [End-to-end demo](docs/portfolio-demo.md)
- [Linux deployment, backups and recovery](docs/runbooks/deployment.md)
- [Release checks](docs/runbooks/smoke-check.md)

The project is in development; a public demo has not been deployed yet. Production deployment requires domain, SMTP and server configuration.

## License

[MIT](LICENSE)
