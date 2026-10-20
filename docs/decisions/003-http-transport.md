# ADR 003: Native cURL for pinned webhook destinations

Status: accepted.

Public endpoints must resolve only to routable IPs. Each delivery resolves again, validates all answers, and pins the chosen answer with CURLOPT_RESOLVE while preserving hostname verification.

The transport uses native cURL so a high-level HTTP client's streaming handler cannot silently ignore cURL pinning. Redirects and proxies are disabled. Responses are captured to 16 KiB and an intentional bounded-write abort is distinguished from network failure. HTTP 2xx with an interrupted transfer is not marked successful.

The controlled sandbox is an explicit endpoint kind with an exact system-generated URL, never a general user-configurable SSRF exception.
