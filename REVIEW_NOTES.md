# Reliability review — 2026-10-08

Changes: escape model/provider HTML and excerpt attributes; restrict source links
to HTTP(S); clamp scores and allowlist verdicts; fix login panel cleanup; remove
session payload logging and report storage failures; reliably consume/cancel SSE
streams with a 90-second request deadline; cap diagnostic history; safely pass
release inputs through environment variables.

Validation: `npm test` (7 cases), `npm run build`. Tests use the actual renderer,
login and background handlers in VM contexts and byte-fragmented streams. They
cover HTML injection, unsafe URLs, login preservation, storage errors, credential
logging, CRLF/UTF-8 chunk boundaries and terminal stream failures. A pre-existing
CommonJS-in-ESM build warning remains. No live browser flow was exercised.

Review follow-ups: background-owned single-flight refresh; refresh/OTP deadlines;
observer teardown and virtualized feed fixtures; uniform setting defaults;
diagnostic byte/retention limits; real browser tests and CI. The current tests
extract two functions from the large content script; extracting those components
into normal modules later will make tests less coupled to source boundaries.
Confirm the minimum supported Chrome version supports `AbortSignal.timeout`.

The complete cross-repository architecture and prioritized findings are in the
companion `verity-backend/docs/REPOSITORY_REVIEW.md`. No dependencies were added;
no release or deployment was performed.
