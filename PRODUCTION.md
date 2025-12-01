# Production checklist and runtime configuration

This project requires a few runtime settings and practices to run reliably in production.

## Required environment variables
- EXPO_PUBLIC_OCR_API_KEY — API key for OCR.space. Must not be committed. On CI or build servers, set this in secrets.
- LOG_LEVEL — optional, default `info`, can be `debug`, `info`, `warn`, `error`, `silent`.

## Runtime concerns
- Do not rely on hard-coded fallback keys in code. Throw explicit configuration errors early.
- Use a centralized HTTP helper with timeouts and retries to avoid hanging requests.
- Cap concurrency for local image processing to avoid OOM on mobile devices.
- Offload heavy image preprocessing to native modules or a server-side worker when possible.

## Observability
- Integrate error tracking (Sentry or equivalent) for crash reporting.
- Emit request timings and counts for external service calls (OCR) for alerting.

## CI
- Run TypeScript checks (tsc --noEmit), lint, and unit tests on PRs.
- Run a security scan for published packages and dependencies.