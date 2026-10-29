# Authentication and API boundaries

OpenAPI describes the versioned application routes and JSON ingestion. Fortify owns the unversioned account endpoints.

Browser flow: GET /sanctum/csrf-cookie, then POST /login with email/password. Axios sends credentials and the X-XSRF-TOKEN header. Super Admin accounts sign in with email/password even when an authenticator was previously configured. For regular accounts that opted into 2FA, a two_factor=true login response requires POST /two-factor-challenge with code or recovery_code before the authenticated session is established.

Local Docker sessions support both `http://localhost:8080` and `http://127.0.0.1:8080`. Both host/port pairs must be listed in `SANCTUM_STATEFUL_DOMAINS`; otherwise password authentication can succeed while subsequent API requests return 401. Cookies belong to the chosen hostname, so switching between these addresses requires a separate sign-in. After changing the Docker `.env`, recreate the app container to apply its environment: `docker compose up -d --no-build --no-deps app`. The `local-origins.spec.ts` browser tests cover sign-in, page reload and sign-out on both hostnames.

Other account endpoints: POST /register, POST /logout, POST /forgot-password, POST /reset-password, POST /email/verification-notification and the signed verification link in the email.

Account security: POST /user/confirm-password, PUT /user/password, POST /user/two-factor-authentication, GET /user/two-factor-qr-code, POST /user/confirmed-two-factor-authentication, GET/POST /user/two-factor-recovery-codes and DELETE /user/two-factor-authentication. The optional authenticator setup is shown only for regular users. Existing authenticator secrets are not exposed or erased when an administrator signs in.

Dashboard and administration use sessions, not project keys. Confirm the password again at POST /api/admin/v1/step-up before sensitive admin changes. These changes require a reason. Support sessions have no expiry deadline and remain subject to explicit revocation and current workspace permissions.

Project APIs accept a project-scoped bearer key. Key abilities do not grant user/session privileges. Incoming source URLs use high-entropy source tokens and support only JSON POST bodies.

Liveness: GET /up. Dependency readiness: GET /api/ready, returning 200 or 503 without internal connection details.
