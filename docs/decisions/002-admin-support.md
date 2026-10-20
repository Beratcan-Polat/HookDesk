# ADR 002: Administrative support is an explicit server context

Status: accepted.

Do not replace the logged-in session user or add a universal Gate::before administrator bypass. Separate administrative routes expose platform operations. Support routes resolve an expiring session owned by the actual administrator and set an effective user/workspace context.

All support operations run the normal workspace policy. Credential creation, rotation, account security and ownership operations are excluded. Audits retain actor_id, effective_user_id, support_session_id and reason.

TOTP protects administrative entry. Recent password plus a fresh TOTP unlocks changes for five minutes. Existing secret values are never revealed through administration.
