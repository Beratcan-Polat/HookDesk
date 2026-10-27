# Performance tests

I measure API acceptance separately from queued webhook delivery. The harness sends real HTTP requests through Caddy, writes events to PostgreSQL, dispatches through Redis and delivers to an internal receiver that verifies the HMAC signature.

## Run

Requirements: Docker Engine with Linux containers, Docker Compose, Node.js 24 and Git. Run from the repository root:

```sh
node infra/performance/run.mjs
```

The harness builds the existing backend Dockerfile's `base` target, starts its own stack, runs migrations, generates temporary keys and runs the baseline. It removes its containers, networks and database/cache volumes afterward, including after a failed assertion. It does not start, stop or reset the regular `hookdesk` development stack.

The temporary project is always `hookdesk-load`, with a separate `hookdesk_load` database, separate Redis and loopback-only API port `8081`. PostgreSQL, Redis and the receiver have no published ports. The normal application remains on `8080`.

Useful options:

- `--smoke`: a small correctness run for CI, using the same HTTP and delivery path.
- `--no-build`: reuse the load-test image after building it with the current source.
- `--keep`: retain the isolated stack for inspection. Its fixture keys expire after one hour.

Generated JSON and standalone HTML reports are saved to `.runtime/performance/load-<uuid>/`. They contain aggregate measurements, environment details and a source fingerprint; they do not contain API keys, signing secrets or event bodies. Fixture credentials remain in memory. The CLI fixture helper refuses normal development and production database configurations.

## Baseline workload

The request data contains 1,024 bytes of padding plus its JSON fields. Each routed event matches one endpoint.

1. Fill 25 of the default 30 acceptance slots, then send 10 concurrent requests. Expect 30 accepted events, five `429` responses with `Retry-After`, and a successful event read after the write limit is exhausted. These events intentionally have no matching endpoint.
2. Warm the API and delivery path with 20 events.
3. Send 16 concurrent duplicate requests using one idempotency key and the same body. Expect one event, one delivery, one receiver request and one usage increment.
4. Send 40 new events at concurrency 1, then 100 each at concurrency 5 and 10, using one worker.
5. Offer 300 events over approximately 60 seconds at five requests per second, with at most ten requests in flight. Record any generator-side drops rather than hiding them.
6. Scale only the isolated worker service to three replicas and repeat the 100-event, concurrency-10 case.

Capacity stages use workspace-specific overrides: 100,000 daily events, 60,000 acceptance requests/minute and 1,000 delivery attempts/second for the workspace and endpoint. Global settings and normal workspace limits are not changed. The policy stage retains defaults.

The full run makes 711 event POST requests: 676 in capacity/idempotency stages and 35 in the default-policy check. It expects 661 distinct routed events plus 30 unrouted policy events. Warmup and idempotent replay rates are not new-event capacity figures.

## Interpretation

- API latency uses the load generator's monotonic clock and includes receipt and parsing of the JSON response. Percentiles use nearest rank.
- Burst request rates are observed closed-loop rates at the stated concurrency. They are not a maximum-throughput certification. The sustained case deliberately offers only five requests/second.
- Queue delay is first attempt creation minus delivery creation. Total delivery time is completion minus creation. These application database timestamps have **one-second resolution**; a reported zero means below that resolution, not instantaneous delivery.
- The outbound HTTP duration is measured separately by the transport in milliseconds.
- Final assertions compare event, delivery, attempt, quota and receiver receipt counts. Successful HTTP acceptance alone does not pass a phase.
- Delivery completion is observed by polling the database. The reported overall completion rate and drain time include polling/CLI overhead. The pending maximum is sampled **after** the request phase, not a continuous queue high-water mark.
- Docker CPU and memory are sampled at a five-second target cadence. Aggregate memory is the largest observed sum for load-test containers, not the physical host's peak. Docker's 100% CPU represents one logical CPU.
- Each phase must finish with no unexpected responses, no generator drops, exact delivery counts, acceptance p95 at most 5,000 ms and a completed drain within 180 seconds. These are regression budgets, not production service guarantees.

The API and receiver use PHP-FPM with the image's default pool settings. The receiver's HTTP requests pass through an internal Caddy listener; it is not the single-process development `artisan serve` receiver. `APP_DEBUG=false`, application source is copied into the image, and the normal frontend is excluded from the load stack. Container memory limits are declared in the dedicated Compose file.

Results record Docker VM CPU/memory, PHP/Node/Docker versions, source revision, image ID and whether the regular development stack was running. Other workloads, image changes and machine resources affect comparisons. A one-minute sustained run is a baseline; it does not substitute for a multi-hour soak or measurements on the intended Linux server.

## CI and cleanup

The `performance` GitHub Actions job runs the smoke profile and uploads the sanitized reports. The frontend job also checks the percentile, Docker-unit and delivery-accounting helpers with Node's test runner. CI validates correctness and a loose latency budget; local and hosted-runner throughput figures should not be compared as equivalent hardware.

For an intentionally retained or forcibly interrupted test stack:

```sh
docker compose -p hookdesk-load -f infra/performance/compose.yaml ps
docker compose -p hookdesk-load -f infra/performance/compose.yaml down --volumes --remove-orphans
```

The runner holds `.runtime/performance.lock` to prevent overlapping runs. Normal interruption releases it. If the process was forcibly killed, confirm that no load run is active before removing that lock file. These cleanup commands target only the temporary load project.
