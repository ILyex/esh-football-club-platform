# Cap CAPTCHA for login

The login page uses Cap Core inside the application. Production enables the widget automatically; it does not need an external Cap account, site key, or Cap Standalone deployment. The challenge and verification API live at `/api/captcha/challenge` and `/api/captcha/redeem` on the same origin as the login form.

## Security flow

1. The widget requests a short-lived, login-scoped challenge from the application.
2. Cap verifies the proof of work on redeem. The login flow keeps the original Cap widget and omits the optional instrumentation stage, which was timing out in real browsers after the proof-of-work progress reached 99%.
3. The verified token is stored in the existing shared `RateLimitBucket` table with its expiry.
4. The credentials provider atomically consumes that token before processing any password. This also protects direct Auth.js credential requests and blocks token reuse.

Challenge nonces are inserted under a unique key, so parallel replays cannot pass. Challenge issuance is rate limited per hashed client address. Login uses 30 proof-of-work challenges at difficulty 3 to keep verification responsive on phones while preserving the proof and rate limits. Database or signing-secret failures reject login while the feature is enabled.

Cap derives its signing key from the required `AUTH_SECRET` using a separate HMAC purpose string. An optional dedicated `CAP_SECRET` can override it, but it must be at least 32 characters and consistent across all app instances.

## Local development

Production enables Cap by default. For local testing, set both flags and provide `AUTH_SECRET` (the project already requires it for stable Auth.js sessions):

```dotenv
CAPTCHA_ENABLED=true
NEXT_PUBLIC_CAPTCHA_ENABLED=true
AUTH_SECRET=<a stable random secret of at least 32 characters>
```

Rebuild after changing the public flag because Next.js embeds it in the client bundle. Set both flags to `false` for ordinary local development without CAPTCHA.
