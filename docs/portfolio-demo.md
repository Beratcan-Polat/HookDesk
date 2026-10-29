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

## Reservation integration

I also use a real reservation flow from my Java vehicle rental project to demonstrate HookDesk between a producer and a Python email service. The integration is on [feature/hookdesk-integration](https://github.com/Beratcan-Polat/arac-kiralama/tree/feature/hookdesk-integration); the rental project's `main` branch remains separate.

1. Follow the [integration setup guide](https://github.com/Beratcan-Polat/arac-kiralama/blob/feature/hookdesk-integration/docs/hookdesk-integration.md). The isolated demo provides HookDesk on `127.0.0.1:8090`, the rental application on `127.0.0.1:8091` and Mailpit on `127.0.0.1:8095`. It preserves the normal HookDesk stack on `localhost:8080`.
2. Use the generated local credentials in the rental checkout's `.runtime/hookdesk/giris-bilgileri.txt` file. No passwords or API keys are published in the repository.
3. Sign in as the demo customer, select the Renault Clio, choose available dates and submit a reservation with payment at the office.
4. In the demo HookDesk panel, open the **Araç Kiralama Demosu** workspace and **Rezervasyon bildirimleri** project. Inspect the `rental.created` event and its successful delivery, then open the confirmation email in Mailpit.
5. Run `node infra/hookdesk/demo.mjs smoke` from the rental checkout to reproduce normal delivery, receiver outage recovery and durable producer outbox recovery. It creates three reservations and checks for three additional emails.

The Java outbox's `SENT` status means HookDesk accepted and routed the event; the delivery record shows the receiver's result. This local demo uses a fixed, system-managed receiver inside its isolated network. Public HTTPS delivery and live SMTP remain deployment checks. The [validation notes](verification.md#vehicle-rental-integration--29-october-2026) record the results and CI run.
