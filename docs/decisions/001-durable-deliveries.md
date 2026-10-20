# ADR 001: PostgreSQL deliveries are the durable work ledger

Status: accepted.

A Redis publish can fail after a database transaction commits. Dispatching after commit alone does not close that gap. Initial deliveries therefore exist inside the event transaction, with a recoverable enqueue lease.

The scheduler can publish duplicate jobs. Row-level claims and lease tokens make duplicate jobs harmless before network dispatch. A request already sent over HTTP may still be repeated after a crash; exactly-once side effects belong at the receiver.

Tradeoff: a five-second recovery scan and occasional duplicate queue messages in exchange for recoverable accepted events and a small operational model.
