# Authentication and API boundaries

OpenAPI describes the versioned application routes and JSON ingestion. Fortify owns the unversioned account endpoints.

Browser flow: GET /sanctum/csrf-cookie, then POST /login with email/password. Axios sends credentials and the X-XSRF-TOKEN header. A two_factor=true login response requires POST /two-factor-challenge with code or recovery_code before the authenticated session is established.

Other account endpoints: POST /register, POST /logout, POST /forgot-password, POST /reset-password, POST /email/verification-notification and the signed verification link in the email.

Account security: POST /user/confirm-password, PUT /user/password, POST /user/two-factor-authentication, GET /user/two-factor-qr-code, POST /user/confirmed-two-factor-authentication, GET/POST /user/two-factor-recovery-codes and DELETE /user/two-factor-authentication. Super Admin accounts cannot disable TOTP until their platform role is removed.

Dashboard and administration use sessions, not project keys. Prove password/TOTP again at POST /api/admin/v1/step-up before sensitive admin changes. These changes require reason.

Project APIs accept a project-scoped bearer key. Key abilities do not grant user/session privileges. Incoming source URLs use high-entropy source tokens and support only JSON POST bodies.

Liveness: GET /up. Dependency readiness: GET /api/ready, returning 200 or 503 without internal connection details.
