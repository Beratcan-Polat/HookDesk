# Architecture

## Runtime

React is an independent SPA. Caddy serves its production build and sends API/auth requests to Laravel PHP-FPM on the same origin. Browser sessions use Sanctum/Fortify cookies and CSRF. Project API keys use a separate middleware and never grant dashboard/admin access.

PostgreSQL owns events, delivery state, attempts, leases, quotas and audit records. Redis carries jobs and shared cache counters. A scheduler reconstructs due jobs from PostgreSQL, recovers expired worker leases and applies retention.

The receiver runs the same backend image with APP_ROLE=receiver, on an internal network without published ports. Arbitrary user endpoints cannot opt into its private-network exception.

## Event processing

Acceptance locks the workspace row, checks account/project state and quota, resolves idempotency, and persists the immutable envelope and initial deliveries atomically. The response is independent of destination availability.

Dispatch reserves queued_until for 60 seconds. A worker claims a due delivery with a row lock and a fresh lease token, persists a started attempt, then performs HTTP outside the transaction. Completion requires the same token and processing state.

A timeout or lost response can leave the destination having processed the event. Recovery records unknown, then follows the retry policy. This is at-least-once transport; receiver-side deduplication is necessary.

## Security boundaries

- Platform role and workspace role are separate.
- Workspace access always validates membership and resource ownership.
- Super Admin uses dedicated APIs, verified email, recent password confirmation and reasons. Support sessions remain active until explicitly ended or revoked; they have no automatic expiry.
- Support retains the actual actor and checks the target's current role for every operation.
- Secrets are hashed or encrypted according to whether they must be recovered for delivery.
- Privileged payloads are fetched separately with a reason and no-store response.
- Native cURL pins validated DNS results. Streaming-handler fallbacks cannot bypass CURLOPT_RESOLVE.
- Authentication cookies, authorization headers, source tokens and payloads are excluded from application audit metadata.

## Data and indexes

ULID primary keys, unique memberships, one owner per workspace, exact subscriptions, unique idempotency scope, unique delivery/attempt number and one active delivery per event/endpoint are enforced in migrations. Delivery scans index state and next_attempt_at. Event lists index project and creation time.

Immutable events are edited only for expiration of their idempotency lookup key; their body and data never change. Query-level retention removes whole event trees only after all deliveries become terminal.
