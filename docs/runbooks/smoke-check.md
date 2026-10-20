# Release smoke check

1. GET /up and /api/ready return 200.
2. Register a new account, receive the real verification email and complete verification.
3. Create workspace/project and a success sandbox destination; publish a test event and inspect the 2xx attempt.
4. Switch the sandbox to fail_twice and observe timed retries leading to success.
5. Repeat an API event with the same idempotency key and body; confirm the same event ID.
6. Create a capture-only source, POST JSON, then switch to forwarding and verify subscriptions.
7. Invite a Viewer, verify that reads work and server-side mutation requests return 403.
8. Sign in as a 2FA administrator, step up with a fresh code, read payload with a reason and verify the audit.
9. Start support scoped to one workspace, make a permitted edit, inspect actor/effective-user attribution and end support.
10. Confirm that /receive paths are inaccessible through the public gateway.
11. Restart worker/Redis, verify queued work recovers, inspect readiness and heartbeat/oldest-pending metrics.
12. Perform an isolated encrypted backup restoration before relying on scheduled off-site copies.

Infrastructure-dependent checks are release tasks; passing local application tests does not substitute for SMTP, host firewall, DNS/TLS or off-site backup verification.
