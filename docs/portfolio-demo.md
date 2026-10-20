# End-to-end demo

I use an order event to demonstrate the delivery flow, including what happens when a destination is temporarily unavailable.

1. Create a project and a test destination with the `fail_twice` behavior.
2. Publish `order.created` with an `Idempotency-Key`. The API accepts the event before attempting delivery.
3. Inspect the delivery timeline: two `500` responses are followed by a successful attempt.
4. Repeat the original request with the same key and body. The event ID and usage counter remain unchanged.
5. Check the [example receiver](../examples/receiver.php) for signature verification and event-ID deduplication.
6. Invite a Viewer and check that read access works while write requests are rejected.
7. Sign in as a Super Admin, verify access with a current TOTP code, and inspect a payload with a reason.
8. Start support for one workspace, edit a destination and end the session. The audit entry retains both the administrator and the assisted user.

The [architecture guide](architecture/overview.md) explains the database locks, delivery leases and recovery behavior behind this flow.
