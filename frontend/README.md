# HookDesk Web

I built the interface as a React 19 and TypeScript SPA, separate from the Laravel API. It includes the user dashboard, Super Admin screens and the support-session interface in English and Turkish.

## Development

```sh
npm ci
npm run dev
```

Vite forwards API and authentication requests to `http://127.0.0.1:8000`. `API_PROXY_TARGET` can override that address. The Docker setup routes both applications through Caddy.

## Structure

- `src/features`: authentication, projects, destinations, sources, API keys, events, team management and administration.
- `src/components`: application layout, shared forms and UI components.
- `src/lib/api.ts`: Axios client and session/CSRF handling.
- `src/lib/i18n.ts`: English and Turkish translations.
- `src/lib/types.ts`: API response types.
- `e2e`: Playwright journeys.

I use TanStack Query for server state and keep project and support context in query keys. Payloads and response bodies are loaded explicitly and held in component state rather than persistent browser storage.

## Checks

```sh
npm run lint
npm run test
npm run build
npm run test:e2e
```

Browser tests require running API/frontend services and test accounts. Details are in the [testing guide](../docs/runbooks/testing.en.md). See the [project README](../README.md) for Docker setup and the [OpenAPI contract](../docs/api/openapi.json) for API routes.
