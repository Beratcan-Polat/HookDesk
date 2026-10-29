# ADR 002: Administrative support is an explicit server context

Status: accepted.

Do not replace the logged-in session user or add a universal Gate::before administrator bypass. Separate administrative routes expose platform operations. Support routes resolve a session with no automatic expiry owned by the actual administrator and set an effective user/workspace context.

All support operations run the normal workspace policy. Credential creation, rotation, account security and ownership operations are excluded. Audits retain actor_id, effective_user_id, support_session_id and reason.

As revised on 29 October 2026, active administrators with verified email sign in with their password; no authenticator code is required. Recent password confirmation unlocks sensitive changes for five minutes. Existing secret values are never revealed through administration. Regular users retain optional 2FA. Support ends explicitly, when replaced, or when account/permission changes revoke it. Migration revokes already-expired legacy support before removing the deadlines from still-active sessions.
