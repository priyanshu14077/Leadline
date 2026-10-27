# Testing LeadLine

Two layers prove the API's decisions:

- **Vitest** (`apps/api/tests/`) runs against the `leadline_test` database. It proves each architectural decision in `AGENTS.md`, plus the ones that live only in the code.
- **Postman/newman** (`postman/`) runs against the live dev API on :4000. It walks the demo path end to end.

Web-only decisions (Cache Components, Europe/London times, optimistic drag) are not covered here. The API has no say in them.

## Run

```bash
# from the repo root; Postgres must be up (bun run db:up)
bun run test                                       # Vitest, 104 tests, ~10 s
bun run --filter @leadline/api test:coverage       # same run + v8 coverage
# or: cd apps/api && bun run test:coverage

# Postman collection against the running API (bun run dev)
bunx newman run postman/LeadLine.postman_collection.json -e postman/LeadLine.local.postman_environment.json
```

- Vitest runs `prisma migrate deploy` on `leadline_test` first (`tests/global-setup.ts`). Each test file creates its own clinics and deletes them afterwards. Deleting a clinic cascades to its rows.
- Files run one at a time (`fileParallelism: false`). They share one Postgres and the LISTEN channel.
- Coverage reports go to `coverage/api/` at the repo root (gitignored): `index.html`, `coverage-summary.json`, plus a text table in the terminal.
- newman writes real leads to the **dev** database (`postman-…` source ids, Olivia Bennett, `07700 900xxx`, `@example.com`). `bun run demo:reset` clears them.

## Test files

| File | What it covers |
|---|---|
| `tenancy.test.ts` | `forPractice` on findMany, findUnique, update, updateMany, deleteMany, create, count, groupBy |
| `tenancy-ops.test.ts` | `forPractice` on delete, upsert, findFirst, aggregate, and the Campaign, WebhookDelivery and TraceSpan models; Practice left unscoped |
| `ingest.test.ts` | idempotency under concurrency, first write wins, campaign auto-create race, 401/400 webhook paths, trace id reuse, hub spans, cross-tenant trace |
| `stages.test.ts` | `stageTimestamps` as a pure function |
| `routes.test.ts` | practices, board window, PATCH stage, PUT value, `x-request-id`, CORS, error handler, webhook body handling, platform mapping, campaign scoping, trace route |
| `stream.test.ts` | SSE over a real socket (`app.listen({ port: 0 })`): headers, `ready`, tenant isolation, disconnect cleanup, one LISTEN connection, the no-listener fast path, NOTIFY order |
| `stream-race.test.ts` | a tab that closes while `subscribe()` is still connecting (mocks `subscribe` to widen the window) |
| `fixtures.test.ts` | fake phone numbers stay in Ofcom's drama range |
| `reliability.test.ts` | ingest atomicity (a failure after the insert rolls back lead, delivery and NOTIFY), hub resync after the LISTEN backend is killed, half-penny rounding |
| `triage.test.ts` | `triageLead` outcomes (DONE, BUSY, FAILED, SKIPPED), the race guard, tenant scoping, triage after the webhook's 200 on the same trace, no triage for duplicates, `geminiClassifier` error mapping with a stubbed `fetch` |
| `attribution.test.ts` | the per-campaign funnel from first-reached timestamps, money ratios, divide-by-zero, ordering and totals, unvalued accepted plans, tenant isolation of the raw SQL |
| `demo.test.ts` | `POST /demo/leads`: server-side signing through the real webhook, 3 deliveries → 1 lead, 400/404 with nothing written, off when `demo: false` |

Helpers: `tests/helpers.ts` (clinic factory, signed webhook POST, `waitFor`) and `tests/sse.ts` (a small fetch-based SSE reader).

## Decision → test matrix

Line numbers are for the current `apps/api/src`. 56 of the 65 API decisions are tested. The other 9 are listed under "untested" with the reason.

### Ingestion and idempotency

| Decision | Code | Proved by |
|---|---|---|
| Idempotency key `(practiceId, source, sourceLeadId)`, enforced by `INSERT … ON CONFLICT DO NOTHING`, never check-then-insert | `ingest.ts:43-59`, `schema.prisma` `@@unique` | ingest › three concurrent retries … exactly one row; routes › same sourceLeadId from two sources is two leads; … in two clinics is two leads |
| A duplicate is still 200 (`duplicate: true`) so the platform stops retrying | `routes/webhooks.ts:105` | ingest › accepts a signed lead, then answers a duplicate with 200; newman › Same lead again |
| First write wins; a retry never overwrites | `ingest.ts:64-73` | ingest › a retry with changed fields never overwrites |
| Every request is logged in `WebhookDelivery`, including retries and rejects | `ingest.ts:76-81`, `ingest.ts:97-103` | ingest › … log three deliveries; ingest › logs a signed but invalid payload as REJECTED; routes › signed non-JSON body is 400 and logged as REJECTED |
| Unknown UTM → one £0 campaign, safe under concurrency | `ingest.ts:16-26` | ingest › an unseen utm_campaign creates one £0 campaign |
| Campaigns are per clinic; an existing campaign keeps its spend and platform | `ingest.ts:20-24` (scoped `createMany` + `findFirstOrThrow`) | routes › same utm_campaign in two clinics …; routes › an existing campaign keeps its spend and platform |
| Platform of an auto-created campaign: utm `tiktok` → TIKTOK, Google form or utm `google` → GOOGLE, else META | `ingest.ts:9-13` | routes › maps utm_source and lead source to a platform; routes › a lead with no utm_campaign gets no campaign |
| New leads start `triageStatus = PENDING` | `schema.prisma` default | routes › a webhook-created lead starts untriaged (PENDING) |

### Webhook authentication and body

| Decision | Code | Proved by |
|---|---|---|
| HMAC-SHA256 over the exact raw bytes: a scoped `*` parser keeps the body as a string | `routes/webhooks.ts:21-22`, `signature.ts:7-17` | routes › verifies a signed body sent with no content-type header; … as text/plain; … including whitespace a re-serialise would drop; ingest › tampered body → 401 |
| Same 401 for unknown practice and bad signature (slugs not confirmed); nothing written | `routes/webhooks.ts:66-71` | ingest › rejects a bad signature, an unknown practice and a tampered body; routes › a 401 leaves no delivery and no trace spans; routes › a missing signature or practice header is 401 |
| Constant-time compare, with the length checked first (`timingSafeEqual` throws on unequal lengths) | `signature.ts:16` | routes › a 401 leaves no delivery … (sends a short `sha256=00`) |
| Signed but invalid → 400 + REJECTED row keeping `source`/`sourceLeadId` when present | `routes/webhooks.ts:83-95` | ingest › logs a signed but invalid payload as REJECTED; routes › an invalid payload keeps its source …; routes › JSON null is rejected |
| Signed non-JSON → 400 + REJECTED with source `unknown` | `routes/webhooks.ts:74-81` | routes › a signed non-JSON body is 400 …; newman › Non-JSON body |

### Tenancy

| Decision | Code | Proved by |
|---|---|---|
| Every tenant-model query goes through `forPractice`, which adds `practiceId` to `where` and `data` | `tenant.ts:27-64` | all of `tenancy.test.ts` and `tenancy-ops.test.ts` |
| Cross-tenant update/delete by id throws P2025, the same as a missing row | `tenant.ts:30-33` | tenancy › update by another clinic's lead id …; tenancy-ops › delete by another clinic's id … |
| A row can't be moved to another clinic, and a forged `practiceId` on create is ignored | `tenant.ts:34-45` | tenancy › create ignores a forged practiceId; tenancy › update cannot move a lead |
| Practice is resolved once in a `preHandler`; an unknown slug is 404 `practice not found` on every practice route | `routes/practices.ts:31-37` | routes › an unknown slug is 404 … on every practice route; stream › an unknown clinic's stream is a plain 404; newman › Unknown practice → 404 |
| Routes answer 404 for another clinic's lead id (stage and value) | `routes/practices.ts:84-89`, `:98-103` | routes › another clinic's lead id is 404 (PATCH and PUT); newman › Other practice's slug → 404 |
| Traces are tenant-scoped | `routes/practices.ts:107-121` | ingest › does not show one clinic's trace to another; newman › Trace from the other practice |

### Leads and board

| Decision | Code | Proved by |
|---|---|---|
| Any move is allowed, and each stage's timestamp is the first time it was reached, never cleared | `leads.ts:69-84` | stages › moving back to NEW keeps every earlier timestamp; stages › re-reaching a stage never overwrites; routes › dragging back to NEW keeps the first-contact stamp |
| Lost doesn't stamp `firstContactedAt` | `leads.ts:80` | stages › LOST never stamps first contact |
| Skipping stages stamps every stage passed | `leads.ts:80-82` | stages › skipping NEW → CONSULT_BOOKED …; NEW → TREATMENT_ACCEPTED stamps all three |
| A move publishes `lead.updated` (the drag is optimistic; SSE confirms it) | `routes/practices.ts:91` | routes › moves the lead, stamps first contact, and publishes lead.updated |
| Money is integer pence: pounds × 100, rounded; `null` clears; 0 to £250,000 | `routes/practices.ts:96-106`, `shared` `treatmentValueBody` | routes › stores pounds as integer pence …; null clears …; out of range or non-numeric values are 400 |
| Board: New and Contacted in full; booked and accepted from the last 7 days only; Lost as a count; newest first | `leads.ts:42-62` | routes › shows open stages in full, closed stages from the last 7 days …; never includes another clinic's leads |
| zod errors → 400 `invalid body` with issues; other 4xx keep their message; 5xx hide it | `app.ts:35-41` | routes › invalid stage is a 400 from the zod error handler; malformed JSON body is a 400; error handler › hides the message …; passes through a 4xx … |

### Realtime (LISTEN/NOTIFY + SSE)

| Decision | Code | Proved by |
|---|---|---|
| One LISTEN connection per process, whatever the number of tabs | `events.ts:33-38`, `:77-105` | stream › serves many streams over one LISTEN connection (counts `pg_stat_activity`) |
| A process with nobody watching a clinic skips the query | `events.ts:63-73` | stream › skips the query and records a 'no open streams' span |
| Events resolve in NOTIFY order through a promise queue | `events.ts:90-95` | stream › delivers lead.updated events in NOTIFY order (weak, see gaps) |
| SSE uses `reply.hijack()`; CORS headers are copied into `writeHead`; `ready` first | `routes/practices.ts:46-81` | stream › opens an SSE stream with CORS headers copied into writeHead and sends ready first |
| A stream only gets its own clinic's events | `events.ts:63`, `routes/practices.ts:68` | stream › delivers a lead to its own clinic's stream and nothing to another clinic's |
| Closing a tab unsubscribes, even mid-connect | `routes/practices.ts:60-77` | stream › unsubscribes when the browser disconnects; stream-race › a tab closed while the stream is still subscribing … |

### Tracing, request ids, CORS

| Decision | Code | Proved by |
|---|---|---|
| `req.id` is the trace id: a well-formed `x-request-id` (`[\w-]{8,64}`) is reused, otherwise a UUID; echoed on every response | `app.ts:10-33` | routes › reuses a well-formed incoming id; replaces a malformed id (too short / spaces / too long / log injection); mints a UUID … on error responses too; newman › Custom x-request-id |
| The trace id is echoed on the SSE response too | `routes/practices.ts:54` | stream › opens an SSE stream … (`x-request-id`) |
| Webhook spans are held in memory and written in `onResponse`; NOTIFY carries `traceId` + `startedAt` so the hub adds its spans | `routes/webhooks.ts:26-36`, `trace.ts`, `events.ts:55-75` | ingest › reuses the caller's x-request-id as the trace id across response, delivery row and spans; newman › Trace of the first webhook |
| A trace with spans but no delivery row still renders (`delivery: null`) | `routes/practices.ts:118-120` | routes › returns spans with delivery null … |
| CORS allows only `WEB_ORIGIN` (GET, POST, PATCH, PUT) and exposes `x-request-id` | `app.ts:44-48` | routes › CORS › allows the web origin …; does not allow any other origin; answers the PATCH preflight |
| Fake data: phones `07700 900xxx` | `prisma/fixtures.ts:114` | fixtures › every generated phone is in Ofcom's drama range |

### Triage, attribution and the demo form (day 2)

No test calls Gemini. `triage.test.ts` builds the app with a fake model (`buildApp({ classify })`) and tests `geminiClassifier` by stubbing `fetch` with Gemini-shaped responses.

| Decision | Code | Proved by |
|---|---|---|
| Triage runs after the 200, for CREATED leads only, and its spans join the webhook's trace on the same clock | `routes/webhooks.ts:31-51`, `trace.ts:17-23` | triage › triages a new lead after the 200 and adds the model call to the webhook's trace (the model is held on a gate: the 200 arrives while the lead is still PENDING, and "triage · Gemini call" starts after "response sent"); triage › doesn't triage a duplicate delivery |
| A model failure never changes the webhook's answer | `routes/webhooks.ts:41-51`, `triage.ts:85-125` | triage › answers 200 even when the model blows up (the lead ends FAILED) |
| A good answer is stored, the lead is DONE, and `lead.updated` reaches open boards; only the first name goes to the model | `triage.ts:94-111` | triageLead › stores the model's answer, marks the lead DONE and pushes it to open boards |
| 429/408/5xx/network → `TriageBusy` → PENDING, attempts not counted | `triage.ts:46-49`, `:113-116` | triageLead › leaves the lead PENDING, without counting an attempt, when the model is busy; geminiClassifier › treats rate limits and outages as busy (429 and 503) |
| A 400 or an off-schema answer → FAILED, `triageAttempts + 1`; a later retry can still succeed | `triage.ts:46-49`, `:117-123` | triageLead › marks the lead FAILED and counts the attempt …; geminiClassifier › treats a bad request or an off-schema answer as a failure, not busy |
| First answer wins when webhook and sweeper race; a DONE lead is never sent to the model again | `triage.ts:88`, `:98-108` | triageLead › keeps the first answer when two runs race (`["DONE", "SKIPPED"]`); triageLead › never calls the model again for a lead that's already triaged |
| Triage is tenant-scoped | `triage.ts:86-88` | triageLead › can't triage another clinic's lead |
| No API key → no model, leads stay PENDING | `triage.ts:52-53` | geminiClassifier › is off without an API key |
| The schema-shaped reply is parsed with zod; repeated objection labels are stored once | `triage.ts:10-16`, `:74` | geminiClassifier › parses a schema-shaped answer |
| Attribution counts from first-reached timestamps: booked-then-lost still counts as booked | `attribution.ts:38-45` | attribution › counts each campaign's funnel from first-reached stages and works out the money |
| Ratios are `null` on a zero divisor; a campaign with no leads still shows | `attribution.ts:20-29`, `:47` | attribution › shows a campaign that books nothing, and one with no leads, without dividing by zero; newman › Attribution by campaign |
| Rows sorted by revenue; totals sum the rows; leads with no campaign counted apart | `attribution.ts:50-52`, `:66-76` | attribution › ranks campaigns by revenue and totals across them; newman › Attribution by campaign (`totals.spendPence`) |
| Accepted leads with no plan value are flagged | `attribution.ts:45` | attribution › flags accepted plans that have no value yet |
| The raw SQL passes `practiceId` explicitly (raw SQL isn't scoped by `forPractice`) | `attribution.ts:47-52` | attribution › keeps each clinic's numbers apart (same utm in another clinic with £9,999.99 revenue); newman › Attribution, unknown practice → 404 |
| The demo form is signed server-side and goes through the real webhook | `routes/demo.ts:19-43` | demo › signs the form and sends it through the real webhook (CREATED delivery row with the returned trace id); newman › Demo form, one delivery |
| `deliveries: 3` replays one signed body: 1 lead, 3 deliveries, 3 trace ids | `routes/demo.ts:31-43` | demo › plays a platform retrying: 3 deliveries of one signed lead make 1 lead; newman › Three deliveries |
| A bad form is 400 and an unknown clinic 404, with nothing written | `routes/demo.ts:15-17` | demo › rejects an unknown clinic and a bad form without writing anything; newman › Empty name → 400 |
| The demo route is off in production | `app.ts:53` | demo › doesn't exist when demo routes are off |

### Untested, and why

| Decision | Code | Why |
|---|---|---|
| `triage:sweep`: PENDING plus FAILED under the attempt cap, newest first, paced, doubling backoff on BUSY | `scripts/triage-sweep.ts:34-54` | A script around `triageLead`, which is tested. The selection query and the sleep/backoff loop aren't. Run it against the dev DB and read its tally line. |
| Triage quality (treatment, urgency, objections, the prompt-injection case) | `scripts/eval-triage.ts`, `scripts/eval-set.ts` | Needs the real model, so it's a measurement, not a test: `bun run triage:eval`. Results below. |
| In-flight triage is awaited on shutdown | `routes/webhooks.ts:53-55` | Each test's `app.close()` runs it, but nothing asserts that a slow job finishes before close returns. |
| Seeded leads are `PENDING`, triage never faked | `prisma/seed.ts` | The seed only runs against the demo DB. Webhook leads are tested to start `PENDING`; `bun run triage:sweep` fills the seeded ones with real model output. |
| API is a separate long-lived Node service | deployment | An architecture choice, not a behaviour a test can observe. |
| Hub reconnects 1 s after the LISTEN connection drops, if anyone still listens | `events.ts:89-118` | **Now tested** by `tests/reliability.test.ts:54`: it kills the hub's LISTEN backend with `pg_terminate_backend`, then asserts every open stream gets a resync and a new lead still arrives. Left in this table so the history stays readable. |
| 15 s heartbeat comment | `routes/practices.ts:71` | Timer-only. Would need fake timers around a real socket. |
| Spans are written *after* the 200 is sent | `routes/webhooks.ts:31-36` | The test proves the spans exist and include `response sent`, not that the response wasn't delayed. |
| Raw SQL and nested includes from Practice are not scoped | caveat in `AGENTS.md` | A rule for authors, not code. The raw SQL is `pg_notify` (`events.ts:24`), which touches no tenant table, and `attribution()`, which passes `practiceId` explicitly and is tested for isolation above. |

## Coverage

`bun run --filter @leadline/api test:coverage`. Includes `src/**`; excludes `src/generated/**` (Prisma client) and `src/server.ts` (listen + signal handlers).

Last run 2026-10-26, 104 tests:

| File | Stmts | Branch | Funcs | Lines | Uncovered |
|---|---|---|---|---|---|
| **All files** | **98.53** | **92.27** | **97.29** | **99.41** | |
| app.ts | 100 | 100 | 100 | 100 | |
| attribution.ts | 100 | 100 | 100 | 100 | |
| db.ts | 100 | 75 | 100 | 100 | 18 (production branch) |
| deliveries.ts | 100 | 81.81 | 100 | 100 | 22 (lead deleted after delivery) |
| events.ts | 98.64 | 83.33 | 94.11 | 100 | branches at 53, 61-68, 81, 99 |
| ingest.ts | 100 | 100 | 100 | 100 | |
| leads.ts | 100 | 100 | 100 | 100 | |
| practice.ts | 100 | 100 | 100 | 100 | |
| signature.ts | 100 | 100 | 100 | 100 | |
| tenant.ts | 100 | 100 | 100 | 100 | |
| trace.ts | 94.11 | 71.42 | 100 | 100 | 26, 51 |
| triage.ts | 97.56 | 83.33 | 100 | 97.22 | 48 (a non-`ApiError`, e.g. a network failure, counted as busy) |
| routes/demo.ts | 94.11 | 83.33 | 100 | 100 | 40 (the webhook answering non-200 to the demo route) |
| routes/practices.ts | 98.63 | 100 | 94.73 | 100 | heartbeat callback |
| routes/webhooks.ts | 98.3 | 96.96 | 92.3 | 98.07 | 48 (the "triage crashed" log; `triageLead` never throws) |

## Postman collection

`postman/LeadLine.postman_collection.json` (v2.1) and `postman/LeadLine.local.postman_environment.json`. The import and run notes are in the collection's own description.

Folders run in order: Health → Webhooks → Practices → Board → Leads → Traces → Attribution → Demo form → Stream. Webhooks creates the lead and trace id that the later folders use. Last run (2026-10-26): 27 requests, 39 assertions, 0 failures.

- Webhook requests are signed in their pre-request scripts. Each script builds the JSON once, stores the exact string in a variable used as the raw body, and signs that string with `CryptoJS.HmacSHA256`.
- The trace request re-runs itself (up to 10×, 300 ms apart) until the post-response spans exist.
- **Attribution** checks the shape: every campaign row has numeric counts and money, `totals.spendPence` is the sum of the rows, and every ratio is `null` or a number. An unknown slug is 404.
- **Demo form** posts to `/demo/leads`: one delivery (one non-duplicate, a `leadId`), three deliveries (exactly one non-duplicate, three distinct trace ids) and an empty name (400 with a `name` issue). The two good requests create two real leads, and the dev API makes one real Gemini call for each.
- The Stream request is skipped in runs (`pm.execution.skipRequest()` unless `openStream` is `true`), because an SSE response never ends. Its description shows how to watch it with `curl -N`.

## Triage eval

`bun run triage:eval` (`apps/api/scripts/eval-triage.ts`) sends 20 hand-labelled enquiries (`apps/api/scripts/eval-set.ts`) to the real model and scores treatment, urgency, objections (exact set) and latency. It doesn't touch the DB. One case (#13, `eval-set.ts:20`) is a prompt-injection attempt.

First run, `gemini-3.5-flash-lite`, 2026-10-26:

| Measure | Result |
|---|---|
| Treatment | 20/20 |
| Urgency | 17/20. All three misses rated a browsing enquiry MEDIUM instead of LOW: #4 George, #5 Isla, #8 Oscar |
| Objections, exact set | 18/20. #3 Amelia got `[TIME]` where none was expected (a wedding date read as a time concern). #12 Thomas got `[PRICE]` where `[PRICE, TRUST]` was expected |
| Errors | 0 |
| Latency | median 21 s, max 165 s (the max includes 429 backoff) |
| Prompt injection (#13) | classified correctly |

The prompt was deliberately not tuned to these misses: 20 items is too few, and fixing each one would overfit the set. Over-ranking urgency is also the cheaper error for a speed-to-lead tool: a browser rated MEDIUM costs one early call, an urgent patient rated LOW can cost the lead. See ADR-15.

## Bugs found by these tests

1. **A tab closed while the stream was subscribing leaked a listener and a heartbeat forever** (`stream-race › a tab closed while the stream is still subscribing does not leak a listener`). The `close` handler was registered after `await subscribe()`. Node holds `writeHead` until the first write (`ready`), so a tab closed during a slow LISTEN connect left a listener and a heartbeat behind. Each later event for that clinic was then resolved and written to a dead socket. Fix: listen for `close` before awaiting, and unsubscribe at once if it already fired.
2. **The SSE response had no `x-request-id`** (`stream › opens an SSE stream …`). The `onSend` hook doesn't run for a hijacked reply, so the stream's log lines had a `reqId` the browser never saw. Fix: put `req.id` into `writeHead`.

## Known gaps and notes

- **CORS sends the fixed origin to everyone.** With a string `origin`, `@fastify/cors` always returns `access-control-allow-origin: http://localhost:3000`, whatever origin asked. Browsers on other origins still block the response, so the effect is the same. The test asserts that the other origin is never echoed and that the value is never `*`. Passing a function or an array instead would omit the header for other origins.
- ~~Half-penny inputs round down~~ Fixed 2026-10-26: `Math.round(Number((pounds * 100).toFixed(4)))`; `reliability.test.ts › rounds half pennies up` asserts 10.005 → 1001.
- ~~4xx parser errors log at ERROR~~ Fixed 2026-10-26: 4xx log at WARN as `request rejected`; only 5xx log at ERROR as `unhandled error`, so error-rate alerts stay meaningful. Not asserted by a test (log level only).
- Added 2026-10-26 in `tests/reliability.test.ts` (82 tests total): ingest atomicity (rollback drops lead, delivery and NOTIFY together; the retry is a fresh CREATED) and resync after the LISTEN backend is killed.
- **The NOTIFY-order test is weak.** Each event re-reads the lead, so even out-of-order resolution would usually end on the latest stage. Proving the queue properly needs a delayed `resolve()` for one event, which means mocking a module-private function.
- **The heartbeat** is untested (see above). Hub reconnect is covered by `tests/reliability.test.ts:54`.
- **Triage** is tested with fake models only. `triage:sweep` has no test, and model quality is measured by the eval, not asserted.
- Added 2026-10-26 (day 2, 104 tests total): `triage.test.ts` (13), `attribution.test.ts` (5), `demo.test.ts` (4).
