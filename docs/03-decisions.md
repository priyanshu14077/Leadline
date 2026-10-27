# 3. Decisions

ADR-style records for every decision in `AGENTS.md`, plus those found only in code. Each has the same sections, so you can rehearse any one in two minutes.

| # | Decision |
|---|---|
| [01](#adr-01-a-separate-node-api-instead-of-next-route-handlers) | Separate Node API, not Next route handlers |
| [02](#adr-02-fastify) | Fastify |
| [03](#adr-03-idempotency-via-a-unique-constraint-and-on-conflict-200-on-duplicates) | Idempotency: unique constraint + ON CONFLICT, 200 on duplicates |
| [04](#adr-04-log-every-delivery-in-webhookdelivery) | Log every delivery |
| [05](#adr-05-hmac-over-raw-bytes-timing-safe-compare-one-401-for-everything) | HMAC over raw bytes, timing-safe compare, one 401 |
| [06](#adr-06-listennotify-fan-out-loaded-once-per-process-in-notify-order) | LISTEN/NOTIFY fan-out, load once, NOTIFY order, 8 KB limit |
| [07](#adr-07-sse-not-websockets-with-resync-on-ready) | SSE, not WebSockets; resync on `ready` |
| [08](#adr-08-the-browser-calls-the-api-directly-with-cors) | Browser calls the API directly with CORS |
| [09](#adr-09-request-tracing-with-x-request-id-spans-written-after-the-response) | Tracing: `x-request-id` as trace id, spans after the response |
| [10](#adr-10-tenancy-through-a-prisma-extends-query-hook) | Tenancy via a Prisma `$extends` hook |
| [11](#adr-11-cache-components-static-shell-data-behind-suspense) | Cache Components: static shell, data behind Suspense |
| [12](#adr-12-money-in-integer-pence-times-in-europelondon) | Integer pence GBP, Europe/London times |
| [13](#adr-13-stage-timestamps-are-first-reach-and-lost-is-not-contact) | First-reach stage timestamps; Lost is not contact |
| [14](#adr-14-optimistic-drag-and-drop-confirmed-over-sse) | Optimistic drag confirmed over SSE |
| [15](#adr-15-ai-triage-with-the-gemini-free-tier-after-the-response) | Gemini free tier triage after the response, sweeper, eval |
| [16](#adr-16-fake-data-that-can-never-reach-a-real-person) | Fake-data safety |
| [17](#adr-17-unknown-utm-campaigns-auto-create-a-0-campaign) | Unknown UTM auto-creates a £0 campaign (code only) |
| [18](#adr-18-connection-budget-pool-of-5-plus-one-listen-client) | Connection budget (code only) |
| [19](#adr-19-validation-failures-are-logged-as-rejected-auth-failures-are-not) | Signed-but-invalid requests logged as REJECTED (code only) |
| [20](#adr-20-prisma-pinned-at-7101-and-hand-written-migrations) | Prisma 7.10.1 pinned, hand-written migrations |
| [21](#adr-21-attribution-counted-from-first-reached-timestamps-computed-live) | Attribution from first-reached timestamps, computed live |
| [22](#adr-22-the-demo-form-is-signed-server-side-through-the-real-webhook) | Demo form signed server-side through the real webhook |

---

## ADR-01: A separate Node API instead of Next route handlers

**Context.** Day 1 was a single Next app with server actions and route handlers. The workload is long-lived backend work: webhook ingestion, a process-wide LISTEN connection, SSE streams that stay open for hours, and model calls that run after the response (ADR-15).

**Options considered.**
1. Next route handlers + server actions. One deployable. On serverless hosts a function is frozen or killed after the response, which drops SSE streams, the LISTEN connection and post-response work.
2. Next with a custom Node server. Possible, but it fights the framework and loses most of what Next hosting gives you.
3. A separate Node service (`apps/api`) with Next as UI only.

**Decision.** Option 3 (`AGENTS.md` "API is a separate Node service", decided 2026-10-26). Bun workspaces: `apps/api`, `apps/web`, `packages/shared`.

**Consequences / trade-offs.**
- Two processes, two ports, CORS (ADR-08), a shared types package.
- The web app has no DB access and no secrets. It only has the API URLs (`apps/web/.env`). A compromised web server can do only what the API allows a browser to do.
- The API can run on a long-lived container (Cloud Run with min instances, Fly, ECS), and the web app anywhere.

**Nuances and failure modes.**
- The shared package exports `.ts` source. Next compiles it via `transpilePackages` (`apps/web/next.config.ts:7`), and the API runs it through `tsx`. There's no build step to forget, but the API runs TypeScript at runtime via `tsx`, not compiled JS.
- Server components call `API_URL` and browsers call `NEXT_PUBLIC_API_URL` (`apps/web/src/lib/api.ts:4-5`). In production the first can be a private network address.

**If an interviewer asks…**
- *"Why not just use Next API routes?"* SSE and LISTEN need a process that stays alive. Serverless kills it after the response. Splitting also keeps secrets and the DB out of the web tier.
- *"Isn't that more to deploy?"* Yes, one more service. In exchange each part runs on a host that suits it, and the API has one job.
- *"What would you change for scale?"* Run several API instances. The LISTEN hub already works across processes, because each instance LISTENs and serves its own tabs.

---

## ADR-02: Fastify

**Context.** The API needs request ids in every log line, a raw-body parser only on the webhook route, per-route-group hooks (tenant resolution, tracing) and low overhead.

**Options considered.** Express (no built-in logger, global body parsers, error handling by hand), Hono (fast, Web-standard, but the raw `ServerResponse` for SSE and the pino integration are less direct), Fastify.

**Decision.** Fastify (`AGENTS.md` "Fastify for built-in pino logs with a request id, scoped raw-body parsing and plugin-level hooks").

**Consequences / trade-offs.**
- pino logging with `reqId` on every line, and request ids generated by `genReqId` (`apps/api/src/app.ts:24-28`).
- Encapsulation: `removeAllContentTypeParsers` + a `*` string parser apply only inside the webhook plugin (`apps/api/src/routes/webhooks.ts:21-22`). Other routes still parse JSON normally.
- Hooks per plugin: tracing and triage hooks only on webhooks (`webhooks.ts:24-55`), the tenant `preHandler` only under `/practices/:slug` (`apps/api/src/routes/practices.ts:28-37`).

**Nuances and failure modes.**
- SSE needs `reply.hijack()` and writing to `reply.raw` (`apps/api/src/routes/practices.ts:49-58`). After a hijack, Fastify no longer applies reply headers, so the CORS headers from the cors hook are copied into `writeHead` by hand (`:51-52`). Without that, the browser blocks the stream (`AGENTS.md` "SSE in Fastify").
- `onSend` sets `x-request-id`, but hijacked SSE responses skip `onSend`, so the stream response has no `x-request-id` header.
- The default `bodyLimit` is 1 MiB. Bigger webhook bodies get a 413 before any auth check. Verified locally with a 1.1 MB body.

**If an interviewer asks…**
- *"Why Fastify over Express?"* Built-in structured logging with request ids, encapsulated plugins, so the raw-body parser applies only to the webhook. Schema-first if needed.
- *"How do you do SSE in Fastify?"* Hijack the reply, write headers to the raw response yourself (copying CORS), write `event:`/`data:` frames, clean up on `close`.

---

## ADR-03: Idempotency via a unique constraint and ON CONFLICT; 200 on duplicates

**Context.** Meta and Google deliver webhooks at least once and retry on timeout or error (see [04-integrations.md](04-integrations.md)). Retries can arrive concurrently. The demo fires the same lead three times at once (`apps/api/scripts/simulate.ts:69-72`).

**Options considered.**
1. Check-then-insert (`findFirst`, then `create` if missing). Two concurrent retries both see "missing" and both insert. Wrong.
2. A distributed lock or Redis `SETNX` per `sourceLeadId`. More infrastructure, and the lock and the insert can still disagree.
3. A unique constraint, plus `INSERT … ON CONFLICT DO NOTHING RETURNING`. The database is the arbiter.
4. Catch the unique-violation error (P2002) from a plain insert. Works, but uses an exception for a normal path and aborts the transaction in Postgres.

**Decision.** Option 3. `@@unique([practiceId, source, sourceLeadId])` (`apps/api/prisma/schema.prisma:64`). `createManyAndReturn({ skipDuplicates: true })` (`apps/api/src/ingest.ts:40-62`) compiles to `INSERT … ON CONFLICT DO NOTHING RETURNING`. An empty result means duplicate. The handler then looks up the existing id by the same unique key (`ingest.ts:64-73`). **A duplicate returns 200** with `duplicate: true` (`apps/api/src/routes/webhooks.ts:104-105`).

**Consequences / trade-offs.**
- Correct under any concurrency, with no locks. Tests cover 3 concurrent retries producing 1 lead and 3 deliveries (`AGENTS.md` Progress, step 3).
- **First write wins.** A retry with corrected data does not update the lead. That's fine for platforms that resend the same payload. A sender that "edits" leads would need an upsert policy.
- `source` is in the key because ids from different platforms could collide. `practiceId` is in the key because the same Meta lead could be routed to two clinics.

**Nuances and failure modes.**
- **Why 200 and not 409?** A non-2xx makes the platform retry. Google retries 5xx and drops 4xx (see 04). A 409 might stop Google, but would make Meta keep retrying for up to 36 hours. 200 says "we have it".
- **Insert, delivery log and NOTIFY share one transaction (fixed 2026-10-26).** Before, a failure after the lead insert left a stored lead whose `lead.created` was never sent: the retry came back `DUPLICATE` and boards never showed it live. Now `pg_notify` runs inside the same `$transaction`; NOTIFY is transactional and fires only on commit, so the three effects are all-or-nothing. A concurrent retry's `INSERT … ON CONFLICT` waits on the first transaction's row lock and then sees its commit, so the unique key still decides. Test: `tests/reliability.test.ts`. An outbox table would add durability across a LISTEN outage too; not needed at this scale.
- `ensureCampaign` uses the same pattern: `createMany skipDuplicates`, then read (`ingest.ts:20-24`).

**If an interviewer asks…**
- *"Two retries arrive in the same millisecond. What happens?"* Both run `INSERT … ON CONFLICT DO NOTHING`. Postgres's unique index serialises them: one inserts and returns a row, the other returns zero rows and is treated as a duplicate. Both get 200. Both are logged.
- *"Why not check first?"* Check-then-insert is a race: both checks pass before either insert commits.
- *"What if the second delivery has different data?"* First write wins by design. If a platform sends updates, I'd add an explicit update path keyed on the same constraint, with an `updated_time` check so out-of-order updates don't regress.

---

## ADR-04: Log every delivery in `WebhookDelivery`

**Context.** "Did we get that lead?" must have an answer, and the demo shows 3 deliveries becoming 1 lead.

**Options.** Logs only (hard for a clinic to see, rotate away); a counter on `Lead` (loses rejects and timing); a row per request.

**Decision.** One row per authenticated request, with outcome `CREATED`, `DUPLICATE` or `REJECTED` (`apps/api/prisma/schema.prisma:69-84`, `apps/api/src/ingest.ts:76-81`, `:97-103`). It carries `traceId` to link to spans and log lines.

**Consequences / trade-offs.** It grows forever. Production needs retention, such as dropping rows older than 90 days or partitioning by month. Unauthenticated requests are deliberately not logged as rows (ADR-05).

**Nuances.** `leadId` is a plain string with no FK (`schema.prisma:77`), so a log row never blocks a delete. The board shows the last 30 (`apps/api/src/deliveries.ts:4-9`). Lead names are joined in a second scoped query, not an `include`, because there is no relation (`deliveries.ts:10-14`).

**If an interviewer asks…** *"Why a table and not logs?"* The clinic and the sales team can see it in the product, and it's queryable by practice. Logs are for engineers. *"How big does it get?"* One row per webhook. Add retention.

---

## ADR-05: HMAC over raw bytes, timing-safe compare, one 401 for everything

**Context.** The webhook URL is public. Anyone who finds it could create fake leads in a clinic's pipeline.

**Options considered.** A static API key in a header (leaks in logs, and replaying it is trivial); IP allow-listing (platforms don't publish stable ranges for this); mTLS (not supported by lead platforms); HMAC-SHA256 over the body with a per-practice secret, the same scheme as Meta's `X-Hub-Signature-256`.

**Decision.** `sha256=` + hex HMAC-SHA256 of the **raw body** with the practice's `webhookSecret` (`apps/api/src/signature.ts:6-9`). The migration replaced a static key (`apps/api/prisma/migrations/20261026120000_webhook_secret/migration.sql:1-3`).
- Raw bytes: the webhook plugin keeps the body as the exact string received and never re-serialises it (`apps/api/src/routes/webhooks.ts:19-22`).
- Timing-safe: `crypto.timingSafeEqual`, after a length check, because it throws on unequal lengths (`signature.ts:11-17`).
- **The same 401 `{"error":"invalid signature"}` for an unknown practice and a bad signature** (`webhooks.ts:66-71`), so the endpoint doesn't confirm which slugs exist.
- **No rows written** for either. One `warn` log line with the reason (`webhooks.ts:69`). Spans are not saved, because `trace.practiceId` is set only after auth (`webhooks.ts:72`, `:33-34`).

**Consequences / trade-offs.**
- Unauthenticated callers can't fill the DB or the delivery log. The cost is that you can't see failed attempts in the product, only in logs.
- Each practice has its own secret, so one leaked secret affects one clinic.

**Nuances and failure modes.**
- **Re-serialising breaks the signature.** `JSON.stringify(JSON.parse(body))` can change key order, whitespace, unicode escaping (Meta signs an escaped-unicode form) and number formatting. Verify the bytes you received, then parse.
- The body is read as a UTF-8 string, not a `Buffer`. For valid UTF-8 JSON that is byte-identical. Invalid UTF-8 would be replaced during decoding and fail verification, which is the safe direction.
- **No replay protection.** A captured valid request can be replayed forever. Idempotency limits the damage, since the same lead isn't created twice, but the delivery log fills up. Fix: a signed timestamp (Stripe-style `t=`) with a 5-minute window. See [04](04-integrations.md#replay-protection).
- Timing: unknown practice skips the HMAC step, so its timing differs from a bad signature by about 0.1 ms. Both do the DB lookup, so in practice slugs are not enumerable this way.
- The secret is stored in plaintext (`apps/api/prisma/schema.prisma:15`). HMAC verification needs the plaintext, so production would encrypt it at rest (KMS) or keep it in a secret manager.
- `x-leadline-practice` is LeadLine's own header. Real Meta and Google webhooks don't send it (see 04).

**If an interviewer asks…**
- *"Why timing-safe compare?"* A normal `===` returns early at the first differing byte. Measuring response times could then reveal the signature byte by byte. `timingSafeEqual` always compares every byte.
- *"Why the same 401 for unknown practice?"* So the endpoint isn't an oracle for which clinics exist.
- *"What's missing?"* Replay protection (timestamp + window), secret rotation (accept two secrets during a rollover) and encryption of secrets at rest.

---

## ADR-06: LISTEN/NOTIFY fan-out, loaded once per process, in NOTIFY order

**Context.** A new lead or a stage change must reach every open tab of that clinic, on any API instance, without polling and without one DB connection per tab.

**Options considered.** Polling the DB from each tab (N tabs × rate queries, slow); Redis pub/sub (another service to run); an in-process EventEmitter (breaks with more than one instance); Postgres `LISTEN/NOTIFY` (already there, transactional, cross-process).

**Decision.** `publish` runs `SELECT pg_notify('lead_events', json)` (`apps/api/src/events.ts:22-25`). Each process keeps **one** dedicated `pg.Client` that LISTENs (`events.ts:77-105`), stored on `globalThis` (`events.ts:33-38`). On a notification:
1. **Load once per process.** `resolve()` turns the tiny event into a full `LeadCard` or `DeliveryRow` with one scoped query and writes it to every listener for that practice (`events.ts:45-53`, `:63-70`). Ten tabs means one query, not ten.
2. **Skip work nobody needs.** No listeners for the practice in this process means no query (`events.ts:64-65`).
3. **NOTIFY order.** Notifications are chained on a promise queue (`events.ts:90-95`). If they were handled in parallel, an older `lead.updated` query could finish after a newer one and overwrite it in the browser.
4. **Small payload.** The payload carries ids, `traceId` and `startedAt` only (`events.ts:13-18`). Postgres limits NOTIFY payloads to under 8000 bytes by default. Patient messages can be 5000 characters (`packages/shared/src/index.ts:31`) plus multibyte text, so the full card is never sent through NOTIFY.

**Consequences / trade-offs.**
- No new infrastructure. Works across instances: every instance receives every NOTIFY.
- Every instance does one query per event for practices it is serving. Fine for a clinic's volume (tens of leads a day).
- The queue serialises a slow query and delays later events.

**Nuances and failure modes.**
- **NOTIFY is not durable.** If the LISTEN connection is down, events are lost. The hub reconnects after 1 s if anyone is listening. Browser streams stay open during a hub-only reconnect, so (fixed 2026-10-26) the hub now sends a second `ready` down every open stream once LISTEN is back (`subscribe(..., onResync)` in `apps/api/src/events.ts`). The browser already treats any `ready` after the first as "refetch the board". Test: `tests/reliability.test.ts › tells every open stream to resync…`, which kills the LISTEN backend with `pg_terminate_backend`.
- If `connect()` fails on the retry, the error is logged and there is no further retry until a new tab subscribes (`events.ts:87`).
- Ordering across processes: each process sees notifications in commit order. Concurrent transactions commit in some order, and every listener sees the same order.
- The listener `Set` for a practice is never deleted from the map when empty. That's a tiny leak per practice ever viewed. Harmless at this scale.
- Behind a transaction-mode pooler, LISTEN doesn't work. It needs a direct or session-mode connection.
- `resolve()` reads with the scoped client using `event.practiceId` from the payload (`events.ts:46`). Anyone who can run `pg_notify` on the DB could aim a stream at another tenant. Only the API has DB credentials.

**If an interviewer asks…**
- *"Why not Redis pub/sub?"* Postgres already does it, with no new service and no new failure mode. At clinic volumes NOTIFY is plenty. I'd move to Redis or a queue if events needed durability or replay.
- *"How many DB connections for 50 tabs?"* Per process: the pool's 5 plus 1 LISTEN, regardless of tabs.
- *"Why the promise queue?"* Each event needs a query, and queries finish out of order. Without the queue a stale card could overwrite a fresh one.
- *"Why not put the card in the NOTIFY?"* The 8 KB limit, and the card would need tenant-safe serialisation in two places. Ids are small, and the hub loads the canonical card once.

---

## ADR-07: SSE, not WebSockets, with resync on `ready`

**Context.** Data flows one way, server to browser. Writes (drag, value) are ordinary HTTP requests.

**Options.** WebSockets (two-way, but you have to build reconnect, heartbeats and auth yourself, and some proxies need special config); long polling; SSE via `EventSource` (one-way, auto-reconnect, plain HTTP).

**Decision.** SSE at `GET /practices/:slug/stream` (`apps/api/src/routes/practices.ts:46-70`). Frames use named events (`event: lead.created`), `data:` JSON (`:59`), a `: ping` comment every 15 s to keep proxies from closing idle streams (`:16`, `:61`), and `x-accel-buffering: no` and `cache-control: no-transform` to stop proxy buffering (`:54-56`). On every (re)connect the server sends `event: ready` (`:63`). The client ignores the first and calls `router.refresh()` on later ones (`apps/web/src/hooks/use-lead-stream.ts:22-25`). The board adopts the refetched props (`apps/web/src/components/board/board.tsx:63-70`).

**Consequences / trade-offs.**
- Free reconnection. HTTP semantics, so CORS and cookies work as usual.
- No `id:`/`Last-Event-ID` replay. A reconnect does a full board refetch instead. That's simple and correct, and costs one `/board` query per reconnect.
- Writes need a separate request path, which is fine because they are rare.

**Nuances and failure modes.**
- `EventSource` gives up permanently on a non-200 response, such as a 404 for an unknown practice. A 404 from the API is final, so the UI must show an error, not "reconnecting".
- The UI's "Live" dot is static and does not reflect the stream state (`apps/web/src/components/practice-nav.tsx:36-38`). See the UI audit.
- `EventSource` cannot set headers. With real auth you'd use a cookie (same site) or a short-lived token in the query string.
- On HTTP/1.1 each tab holds one of about 6 connections per origin.

**If an interviewer asks…**
- *"Why not WebSockets?"* Nothing flows from browser to server on the stream. SSE gives reconnect and plain-HTTP behaviour for free.
- *"What if the connection drops for 30 seconds?"* EventSource reconnects. The server sends `ready`, the page refetches the board, and nothing is missed. The heartbeat stops proxies killing idle streams.
- *"Why not Last-Event-ID?"* It needs a durable event log to replay from. NOTIFY isn't durable. A refetch gives the same result at this scale.

---

## ADR-08: The browser calls the API directly, with CORS

**Context.** The browser needs the SSE stream and the write endpoints. The Next server needs the board for first paint.

**Options.** Proxy every call through Next (rewrites or route handlers): one origin, no CORS, but the proxy can buffer SSE and holds a long-lived connection in the web tier. Or call the API directly with a strict CORS origin.

**Decision.** Direct calls. CORS allows only `WEB_ORIGIN` (default `http://localhost:3000`) and only `GET`, `POST`, `PATCH`, `PUT` (`POST` since day 2, for the demo form's `/demo/leads`, ADR-22), and exposes `x-request-id` (`apps/api/src/app.ts:44-48`). Server components fetch server to server (`apps/web/src/lib/api.ts:31-35`). The browser uses `NEXT_PUBLIC_API_URL` (`api.ts:38-45`).

**Consequences / trade-offs.** No buffering proxy in the stream's path. The web tier stays stateless. Two origins to configure. Verified: a preflight from `http://evil.test` gets `access-control-allow-origin: http://localhost:3000`, so the browser blocks it.

**Nuances and failure modes.**
- **CORS is not authentication.** It stops other *websites* in a browser from reading responses. It doesn't stop `curl`. Today anyone who can reach port 4000 can PATCH any lead of any practice by slug. Production needs session auth, and the practice should come from the session (`apps/api/src/routes/practices.ts:23-27` says so).
- The webhook POST is not in the CORS methods list, which is correct because platforms aren't browsers.

**If an interviewer asks…** *"Why not proxy through Next?"* Proxies can buffer SSE, and a serverless proxy can't hold a stream open. Direct + CORS is simpler. *"Is CORS your security?"* No. It's a browser policy. Real auth is missing and is the first production item.

---

## ADR-09: Request tracing with `x-request-id`, spans written after the response

**Context.** "Where did this lead go?" needs a per-request story across the HTTP handler and the LISTEN hub, which may be another process.

**Options.** OpenTelemetry SDK + a collector (standard, but heavy for a 2-day demo, and needs a backend to view); logs only (no visual); a custom `TraceSpan` table with an in-app waterfall.

**Decision.**
- `req.id` is the trace id. A well-formed incoming `x-request-id` (`/^[\w-]{8,64}$/`) is reused, otherwise a UUID is minted (`apps/api/src/app.ts:10`, `:24-28`). It's echoed on every response (`app.ts:31-33`), stored on `WebhookDelivery.traceId` (`apps/api/src/ingest.ts:78`), and is on every pino line as `reqId`.
- `RequestTrace` collects spans in memory with `performance.now()` offsets (`apps/api/src/trace.ts:9-36`). `onResponse` writes them in one `createMany` **after** the response is sent (`apps/api/src/routes/webhooks.ts:31-36`). Triage continues the same trace with `new RequestTrace(traceId, startedAt)` (`trace.ts:17-23`), so the Gemini call appears on the webhook's waterfall.
- NOTIFY carries `traceId` + `startedAt`, so the hub process adds its own spans: received, loaded once, pushed to N streams (`apps/api/src/events.ts:55-75`).
- The UI shows a waterfall per delivery row (`apps/web/src/components/board/trace-sheet.tsx`).

**Consequences / trade-offs.** No extra dependency or backend, and it's visible in the product. Not standard (no W3C `traceparent`), no sampling, and the table grows with traffic.

**Nuances and failure modes.**
- Spans are written after the 200, so the trace can be incomplete when someone clicks a delivery row within milliseconds. The sheet fetches once and doesn't refetch (`trace-sheet.tsx:23-35`). Hub spans can land after the request spans.
- If `saveSpans` fails in `onResponse`, the error is logged and the 200 has already gone. That's correct: tracing must never fail a lead.
- Hub offsets use `Date.now() - startedAt`, which is sensitive to clock skew across hosts.
- Drags and value edits publish `lead.updated` without a `traceId` (`apps/api/src/routes/practices.ts:81`, `:94`), so only webhooks are traced.
- Trusting an incoming id lets a caller choose their trace id. The regex limits it to safe characters.

**If an interviewer asks…** *"Why not OpenTelemetry?"* For a demo, a table and a waterfall in the product tell the story with no collector. The span model maps 1:1 to OTel spans, so swapping is mechanical. In production I'd export OTel and use `traceparent`. *"Does tracing slow the webhook?"* No. Spans are in-memory until after the response.

---

## ADR-10: Tenancy through a Prisma `$extends` query hook

**Context.** One API serves many clinics. A forgotten `where practiceId` would leak patients across clinics.

**Options.** Pass `practiceId` by hand in every query (relies on memory); Postgres row-level security with `SET app.practice_id` per transaction (strongest, but needs a transaction per request and careful pooling); a schema per tenant (heavy migrations); a client-level extension that injects the filter.

**Decision.** `forPractice(practiceId)` wraps Prisma with a query hook that adds `practiceId` to every `where` and every `create` on tenant models (`apps/api/src/tenant.ts:27-64`). Fastify resolves the practice once per request and hands handlers only `req.db` (`apps/api/src/routes/practices.ts:31-37`). Full mechanics in [02 §2.8](02-architecture.md#28-tenancy).

**Consequences / trade-offs.** Enforced by construction for model queries. Not enforced for raw SQL or nested relation queries from `Practice` (stated in `AGENTS.md`). RLS would catch those too.

**Nuances and failure modes.**
- Spreading instead of `AND` keeps unique-where ops valid (`tenant.ts:31`). That relies on Prisma ≥ 5 accepting extra filters on unique-where.
- Cross-tenant access returns "not found" (P2025 or `null` → 404), never "forbidden", so existence isn't revealed.
- Updates force `practiceId` to the current tenant (`tenant.ts:42-45`), so a row can't be moved between tenants.
- `forPractice` creates a new extended client per request. That's cheap: it shares the one pool.
- **The tenant comes from the URL today.** Without auth, the URL *is* the authorisation. Production must derive it from the session and check membership.

**If an interviewer asks…**
- *"How do you stop one clinic seeing another's data?"* Every handler gets a client that can only query that clinic's rows. The filter is added by a Prisma extension, not by each developer. Cross-tenant ids look like missing rows.
- *"What escapes it?"* Raw SQL and nested includes from `Practice`. Neither is used, and AGENTS.md says to pass `practiceId` explicitly there. Next step: Postgres RLS as a second layer.
- *"Why not RLS now?"* It needs a session variable per transaction, which complicates pooling and the LISTEN hub. The extension gets 95% of the value in 60 lines. I'd add RLS before real patient data.

---

## ADR-11: Cache Components: static shell, data behind Suspense

**Context.** Next 16 with `cacheComponents: true` (`apps/web/next.config.ts:5`). Reading uncached data at the top of a page or layout errors with "uncached data during prerendering".

**Decision.** Layouts and pages are synchronous shells. Every API read sits in an async child under `<Suspense>`: the nav (`apps/web/src/app/[practice]/layout.tsx:9-11`, `:17-20`), the board (`apps/web/src/app/[practice]/page.tsx:7-11`, `:14-18`) and the root redirect (`apps/web/src/app/page.tsx:5-18`). `getPractice`/`listPractices` are `React.cache` wrapped, so layout and page share one fetch per render (`apps/web/src/lib/practice.ts:5-15`). Since the redesign, the one cached read is the clinic directory (`"use cache"` + `cacheTag("practices")` + `cacheLife("days")`, `apps/web/src/lib/practice.ts:15-18`). Every other read is dynamic, with `cache: "no-store"` in `apps/web/src/lib/api.ts`. The file paths cited above predate the move to `/app/[practice]/…`.

**Consequences / trade-offs.** The header placeholder and the board skeleton paint instantly from the static shell, and data streams in. Nothing is cached, which is right for the live board. See the [UI audit](05-ui-ux-audit.md#rendering-strategy-next-16-cache-components) for what could be cached.

**Nuances.** `params` is awaited inside the Suspense child, not in the layout, so the layout stays prerenderable. `partialPrefetching: true` (`next.config.ts:8`) prefetches route shells on link hover. The `[practice]` segment has no `generateStaticParams`, so every practice URL is resolved at request time.

**If an interviewer asks…** *"What's static and what's dynamic?"* The frame and skeleton are static. The practice name, practice list and board stream per request. *"Why not cache the board?"* It changes every few seconds and is pushed live. Caching it would only add a staleness bug.

---

## ADR-12: Money in integer pence; times in Europe/London

**Context.** Attribution divides money ("value per £1 spent"). Floats can't represent 0.1 exactly. The clinics are in the UK and the team may view from anywhere.

**Decision.** `spendPence` and `treatmentValuePence` are `Int` (`apps/api/prisma/schema.prisma:29`, `:55`). The API accepts pounds as a person types them and rounds once: `Math.round(pounds * 100)` (`apps/api/src/routes/practices.ts:91`), validated 0–250,000 (`packages/shared/src/index.ts:44`). Display uses `Intl.NumberFormat("en-GB", GBP)` with no decimals (`apps/web/src/lib/format.ts:38-39`). Times always render in `Europe/London` (`format.ts:51-59`), whatever the viewer's machine says. That also keeps server HTML and hydration identical.

**Consequences / trade-offs.** Exact sums. A single currency is assumed: there's no currency column. 32-bit `Int` caps at about £21.4m per value, which is fine.

**Nuances.** `formatGBP` drops pence (`maximumFractionDigits: 0`), so £4,500.50 displays as £4,501. Timestamps are stored as `TIMESTAMP(3)` without a time zone (`apps/api/prisma/migrations/20261026060938_init/migration.sql:61`). Prisma writes UTC, so this is fine as long as nothing writes local time by hand.

**If an interviewer asks…** *"Why pence?"* Integers add exactly. Attribution divides sums of money, and float drift would show up as £0.01 errors in reports. *"Why fix the time zone?"* The clinic is in London. A closer in Spain must see the same "08:52" the clinic sees, and fixing the zone keeps server and client HTML identical for hydration.

---

## ADR-13: Stage timestamps are first-reach, and Lost is not contact

**Context.** Speed-to-lead and the funnel are computed from stage timestamps. Closers drag cards back and forth.

**Decision.** `stageTimestamps` (`apps/api/src/leads.ts:69-84`): any move is allowed. Each timestamp is set the first time its stage (or a later one) is reached and is never cleared. **Lost does not stamp `firstContactedAt`** (`leads.ts:79-80`).

**Consequences / trade-offs.** Dragging back to New can't reset the timer or flatter the metric. Skipping straight to Consult booked stamps first contact too. The cost: a mis-drag to Contacted permanently records a contact time. There's no undo for timestamps.

**Nuances.** If Lost counted as contact, binning spam leads unread would make speed-to-lead look excellent. A Lost lead later moved to Contacted gets its `firstContactedAt` then. That is honest: the contact happened later.

**If an interviewer asks…** *"Why doesn't Lost count as contact?"* Binning a lead you never rang is not contact. Counting it would let a team improve its speed-to-lead by deleting leads. *"What if someone drags by mistake?"* The stage can be moved back, but the first-contact time stays. Correcting it would need an audit-logged admin edit.

---

## ADR-14: Optimistic drag-and-drop, confirmed over SSE

**Context.** Drags must feel instant. Other tabs must see the move.

**Decision.** dnd-kit with pointer and keyboard sensors (`apps/web/src/components/board/board.tsx:98-102`). A 6 px activation distance lets a click open the drawer instead (`:99-100`). On drop: optimistic `upsert`, then PATCH, then `upsert(saved)`. On error: restore the snapshot and show a toast (`:104-124`). The server's `lead.updated` SSE event confirms it everywhere. `DndContext id` comes from `useId` to avoid a hydration mismatch in dnd-kit's `aria-describedby` (`:51-52`).

**Consequences / trade-offs.** Instant feedback. Server state wins on every event. The rollback snapshot can clobber SSE updates that arrived while the PATCH was in flight.

**Nuances.** The keyboard sensor starts a drag on Enter/Space, so keyboard users can't open the drawer from a card. Screen-reader announcements read raw cuids. See the UI audit.

**If an interviewer asks…** *"What if the PATCH fails?"* The board restores the previous state and shows a toast. The SSE stream also re-sends the server's view on the next event or reconnect. *"Two closers drag the same card?"* Last write wins on stage. Timestamps are first-reach, so they don't regress. Every tab converges via SSE.

---

## ADR-15: AI triage with the Gemini free tier, after the response

**Status: built (day 2, 2026-10-26).** Code: `apps/api/src/triage.ts`, the trigger in `apps/api/src/routes/webhooks.ts:31-55`, `apps/api/scripts/triage-sweep.ts`, the eval in `apps/api/scripts/eval-triage.ts` + `eval-set.ts`. Migration `20261027090000_triage_attempts` adds `Lead.triageAttempts`. Tests: `apps/api/tests/triage.test.ts` (13). No test calls Gemini: they inject fake models through `buildApp({ classify })` or stub `fetch`.

**Context.** Closers want to know what the patient wants, how urgent it is, the likely objections and a call opener, before they ring. The webhook must still answer in milliseconds, and a model outage must never cost a lead.

**Options considered.**
1. ADK, an agent framework. Mainly Python, and overkill for one structured call.
2. Claude or OpenAI. Paid only; the demo has no budget.
3. Gemini free tier, one direct call via `@google/genai` with a response schema.
4. Triage inside the request, before the 200. Simple, but a 15–20 s model call would time out the platform and trigger retries.
5. A job queue (pg-boss, Cloud Tasks). Durable, but another moving part for a two-day demo.

**Decision.** Options 3 and in-process work after the response, with a sweeper as the safety net.
- **Model call.** `geminiClassifier()` (`triage.ts:52-76`): one `generateContent` with a system prompt, a response schema of enums (`triage.ts:33-43`), `temperature: 0` and `thinkingLevel: LOW`. The reply is validated again with zod (`triage.ts:10-16`). Model `gemini-3.5-flash-lite`, overridable with `GEMINI_MODEL` (`triage.ts:8`). Without `GEMINI_API_KEY` it returns null and leads stay `PENDING`.
- **Trigger.** The webhook plugin's `onResponse` hook, after the 200, for `CREATED` leads only (`webhooks.ts:31-36`, `:99`). Duplicates never trigger it. The job continues the webhook's trace (`new RequestTrace(traceId, startedAt)`), so "triage · Gemini call" and "triage saved", "triage deferred" or "triage failed" appear on the same waterfall. In-flight jobs are awaited in `onClose` (`webhooks.ts:53-55`).
- **Outcomes.** 429, 408, 5xx and network errors become `TriageBusy` (`triage.ts:46-49`): the lead stays `PENDING` and `triageAttempts` is not counted, because it's not the lead's fault. A 400 or an off-schema answer marks it `FAILED` and adds 1 to `triageAttempts` (`triage.ts:117-120`). `DONE` and `FAILED` both publish `lead.updated` with the webhook's `traceId`, so open boards update live.
- **Race.** The result is written with `updateMany where triageStatus != DONE` (`triage.ts:98-108`). When the webhook and the sweeper triage the same lead, the first answer wins and the second run returns `SKIPPED` without a second push.
- **Sweeper.** `bun run triage:sweep` takes `PENDING` plus `FAILED` under `--max-attempts` (default 3), newest first, one call every `--every 4` seconds, with backoff on `BUSY` that starts at 15 s and doubles to 120 s (`triage-sweep.ts:34-54`). It backfills the seeded leads, which are `PENDING` on purpose: triage fields are only ever written by the real model.
- **Eval.** `bun run triage:eval` runs 20 hand-labelled enquiries (`apps/api/scripts/eval-set.ts`), one of them a prompt-injection attempt, and scores treatment, urgency, objections (exact set) and latency. It doesn't touch the DB.

**Eval results.** First run, `gemini-3.5-flash-lite`, 2026-10-26 (rerun with `bun run triage:eval`):

| Measure | Result |
|---|---|
| Treatment | 20/20 |
| Urgency | 17/20. All three misses rated a browsing enquiry MEDIUM instead of LOW: #4 George, #5 Isla, #8 Oscar (`eval-set.ts:11`, `:12`, `:15`) |
| Objections, exact set | 18/20. #3 Amelia got `[TIME]` where none was expected: a wedding date read as a time concern (`eval-set.ts:10`). #12 Thomas got `[PRICE]` where `[PRICE, TRUST]` was expected (`eval-set.ts:19`) |
| Errors | 0 |
| Latency | median 21 s, max 165 s (the max includes 429 backoff) |
| Prompt injection (#13, `eval-set.ts:20`) | classified correctly: WHITENING, LOW, as labelled, not the HIGH-urgency implants the message asks for |

The prompt was deliberately not tuned to these misses: with 20 items, fixing each one would overfit the eval set. And the misses lean the safe way for a speed-to-lead tool: rating a browser MEDIUM costs a closer one early call, while rating an urgent patient LOW could cost the lead.

**Consequences / trade-offs.**
- A slow or failed model call never loses or delays a lead. The lead is stored, answered and pushed before triage starts.
- Free tier: low per-minute and per-day limits, per project (see [04](04-integrations.md#gemini-free-tier-and-patient-data)). On 2026-10-26 we saw many 429s, and `gemini-3.5-flash` returned 503 "high demand", which is why the default is `flash-lite`. Calls took about 15–20 s each.
- **Data use:** under the Gemini API terms, free-tier ("Unpaid Services") prompts and responses may be used to improve Google's products and reviewed by humans. That's fine for synthetic leads. Real patient enquiries need the paid tier or Vertex AI, plus a DPA.

**Nuances and failure modes.**
- Running in-process after the response means a crash loses in-flight triage. The lead stays `PENDING` and the sweep picks it up. A graceful shutdown waits for it.
- Only the first name and the message go to the model (`triage.ts:94`). No phone, email or surname.
- The prompt tells the model to treat the enquiry as text to classify, never as instructions (`triage.ts:26`). The response schema limits the damage anyway: an injection can only pick a different enum value or write an odd opener.
- Triage never overwrites a human's edits: closers don't edit triage fields, and the `!= DONE` guard means a late answer can't replace an earlier one.

**If an interviewer asks…**
- *"Is the AI working?"* Yes. A new lead gets its triage about 20 s after it appears, live on the card, and the Gemini call shows on the request's trace. 20/20 treatment and 17/20 urgency on the eval set.
- *"Why after the response?"* The platform needs a fast 200 or it retries. A 20 s model call in the request would turn every lead into three deliveries.
- *"What happens when Gemini is down or rate-limited?"* The lead is already saved and on screen. Triage stays `PENDING`, doesn't count as an attempt, and `triage:sweep` retries with backoff.
- *"Why not a queue?"* For one process and a demo, the hook plus a sweeper gives the same guarantee: every lead is eventually triaged or marked failed. In production I'd move it to a queue (Cloud Tasks or pg-boss) so retries survive restarts without a sweep.
- *"Would you send patient data to a free tier?"* No. Free-tier prompts can be used for training and seen by reviewers. Use the paid API or Vertex AI with a DPA, and minimise what's sent.
- *"Why didn't you fix the urgency misses?"* Twenty items is too few to tune against without overfitting, and over-ranking urgency is the cheaper error here.

---

## ADR-16: Fake data that can never reach a real person

**Context.** Demo data includes phone numbers and emails. A screen recording or a test might call or email them.

**Decision.** Phones in Ofcom's drama range `07700 900xxx` (`apps/api/prisma/fixtures.ts:113-116`). Emails `@example.com` (`apps/api/prisma/seed.ts:78`, `apps/api/scripts/simulate.ts:35`). Names come from a curated UK list (`fixtures.ts`). Dev webhook secrets are obviously fake (`fixtures.ts:68`, `:80`).

**Consequences.** Safe to record, demo and commit. `example.com` is reserved by RFC 2606, and the 07700 900000–900999 block is reserved by Ofcom for drama.

**If an interviewer asks…** *"Are these real patients?"* No. Every number is in Ofcom's drama range and every email is on a reserved domain.

---

## ADR-17: Unknown UTM campaigns auto-create a £0 campaign

*(Found in code; not in AGENTS.md decisions.)*

**Context.** Marketers launch campaigns without telling engineering. A lead with an unknown `utm_campaign` must still be attributed.

**Decision.** `ensureCampaign` creates `{ utmCampaign, name: utmCampaign, platform, spendPence: 0 }` with `skipDuplicates`, then reads it (`apps/api/src/ingest.ts:15-26`). The platform is inferred: `utm_source=tiktok` → TIKTOK; Google source or `utm_source=google` → GOOGLE; else META (`ingest.ts:9-13`).

**Consequences.** New campaigns show up immediately. Spend is £0 until someone enters it. The attribution page shows no value per £1 for it (`null`, not infinity) rather than an infinite return (ADR-21).

**Nuances.** Campaign names are raw UTM strings until renamed. A typo'd UTM creates a new campaign. The platform guess defaults to META.

---

## ADR-18: Connection budget: pool of 5 plus one LISTEN client

*(Code: `apps/api/src/db.ts:5-9`.)*

**Decision.** `PrismaPg` with `max: 5` per process, plus one `pg.Client` for LISTEN. Both are singletons on `globalThis`.

**Consequences.** 6 connections per instance, whatever the tab count. Postgres in Docker allows 100. Board loads run 3 queries in parallel (`apps/api/src/routes/practices.ts:42`, `apps/api/src/leads.ts:47`), so a burst of reloads queues on the pool. That's fine at this scale.

**If an interviewer asks…** *"What happens at 20 instances?"* 120 connections. Use a session-mode pooler for the pool, a direct connection for LISTEN, or one hub per region fanning out over Redis.

---

## ADR-19: Validation failures are logged as REJECTED; auth failures are not

*(Code: `apps/api/src/routes/webhooks.ts:74-95`.)*

**Decision.** A request that passes the signature but isn't JSON, or fails the zod schema (`packages/shared/src/index.ts:25-39`), gets a 400. It's logged as a `REJECTED` delivery and pushed to the delivery log live (`apps/api/src/ingest.ts:97-103`). Unsigned requests get a 401 with no row (ADR-05).

**Why.** A signed sender is a real integration with a bug, and the clinic should see it. An unsigned sender is noise or an attack and must not be able to write.

**Nuance.** A 400 makes Google stop retrying (4xx are not retried), and Meta keeps retrying for up to 36 hours. Either way the row tells you the integration is broken.

---

## ADR-20: Prisma pinned at 7.10.1 and hand-written migrations

*(AGENTS.md gotchas.)*

**Decision.** Prisma 7.10.1, because npm `latest` points at an 8.0 RC. The client is generated to `apps/api/src/generated/prisma` and uses the `PrismaPg` driver adapter (`apps/api/src/db.ts:1-11`). Migrations are hand-written or produced with `prisma migrate diff`, then applied with `migrate deploy`. `migrate dev` is interactive and fails here.

**Consequence.** Reproducible. Requires the discipline to run `migrate diff` and expect an empty result after each change.

---

## ADR-21: Attribution counted from first-reached timestamps, computed live

**Status: built (day 2, 2026-10-26).** `apps/api/src/attribution.ts`, `GET /practices/:slug/attribution` (`apps/api/src/routes/practices.ts:47`), the page `apps/web/src/app/app/[practice]/attribution/page.tsx`. Tests: `apps/api/tests/attribution.test.ts` (5).

**Context.** The owner and the marketers want to know which campaign makes money, not which gets cheap form fills: cost per booked consult and treatment value per £1 of spend. Leads move back and forth between stages, and some booked consults are later lost.

**Options considered.**
1. Count by current `stage`. A lead booked and then lost would vanish from "booked", so a campaign's numbers would shrink as the team works its leads.
2. Count from the first-reached timestamps (`firstContactedAt`, `consultBookedAt`, `treatmentAcceptedAt`), which are set once and never cleared (ADR-13).
3. Precompute into a summary table or a cached page (`use cache` + `revalidateTag`).
4. Compute on each request.

**Decision.** Options 2 and 4. One raw SQL query: `Campaign LEFT JOIN Lead`, grouped by campaign, with `count(...)` over the timestamp columns and revenue as the sum of plan values on accepted leads (`attribution.ts:36-53`). Ratios are worked out in TypeScript and are `null` when the divisor is 0 (`attribution.ts:20-29`). `practiceId` is passed explicitly in the `WHERE` and the join, because raw SQL isn't scoped by `forPractice`. The web page is dynamic, behind `<Suspense>`, and refetches from the browser on `lead.*` stream events, debounced 600 ms (`apps/web/src/components/attribution/attribution-view.tsx:10`, `:134-146`).

**Consequences / trade-offs.**
- A booked consult stays booked, whatever happens next. That matches the question "did this campaign produce consults?" and stops a lost lead from making a campaign look worse after the fact.
- Numbers update live: drag a card to Treatment accepted on one tab and the attribution tab moves within a second.
- `null` ratios instead of 0 or infinity: a campaign with no bookings shows "no cost per consult", and a £0-spend campaign (auto-created from an unknown UTM, ADR-17) shows no value per £1 instead of an infinite return.
- `acceptedWithoutValue` counts accepted leads with no plan value, so the page can say revenue is understated rather than silently show less.
- One query per refetch. At demo scale (about 100 leads per clinic) it takes a few milliseconds. At 100k leads it would want an index on `Lead(campaignId)` (already there, `apps/api/prisma/schema.prisma:66`) and maybe a nightly rollup for history.

**Nuances and failure modes.**
- No `use cache`. The page changes with every drag and value edit, and the SSE stream already says when to refetch. A cached copy plus `revalidateTag` would need the API to call into Next with a secret, to save a query that costs milliseconds. The [UI audit](05-ui-ux-audit.md) suggested caching before this was built; this ADR supersedes that.
- The debounce turns a burst (a sweep publishing many `lead.updated`, a run of drags) into one request. `delivery.logged` events are ignored: they don't change the numbers.
- Revenue counts plan values, not money collected. Spend is a single number per campaign with no date range, so the page answers "so far", not "this month".
- On the seed, Veneers – Instagram Reels returns about £9.69 per £1. The £199 TikTok whitening campaign has the cheapest cost per booked consult (£112.50) and returns £0.

**If an interviewer asks…**
- *"Why does a lost lead still count as booked?"* Because it did book. The campaign did its job; the clinic lost the patient later. Counting current stage would punish the campaign for the clinic's follow-up.
- *"Why not cache it?"* It changes every time someone drags a card, and the page already gets an event when that happens. Caching would only add staleness and a revalidation path.
- *"Is the raw SQL safe across tenants?"* `practiceId` is a bound parameter in the `WHERE` and in the join, and a test puts a same-named campaign with £9,999.99 revenue in another clinic to prove it doesn't leak.
- *"Which campaign would you cut?"* The TikTok whitening offer: the cheapest consults on the board and no revenue.

---

## ADR-22: The demo form is signed server-side, through the real webhook

**Status: built (day 2, 2026-10-26).** `POST /demo/leads` (`apps/api/src/routes/demo.ts:13-47`), registered in `apps/api/src/app.ts:53`. The page `apps/web/src/app/demo/form/page.tsx` with `apps/web/src/components/demo/demo-form.tsx`. Tests: `apps/api/tests/demo.test.ts` (4).

**Context.** The video needs a person to fill in an ad form and watch the card appear. The webhook requires an HMAC signature with the clinic's secret (ADR-05). The rule from ADR-01 is that the web app holds no secrets.

**Options considered.**
1. Put a webhook secret in the web tier (a server action that signs), for a dedicated "demo form" source. Breaks the no-secrets rule for one page.
2. An unsigned demo endpoint that writes the lead directly. Skips the signature check, idempotency, the delivery log and tracing, so the demo would prove less than the simulator.
3. A demo-only API endpoint that builds the platform payload, signs it with the clinic's secret, and sends it through `/webhooks/leads` with Fastify's `app.inject`.

**Decision.** Option 3, chosen with the user on 2026-10-26. The endpoint validates the shared `demoLeadBody` (`packages/shared/src/index.ts:126-135`), builds a `META_LEAD_ADS` payload with `sourceLeadId: demo_<uuid>`, signs it (`demo.ts:19-29`) and injects it (`demo.ts:32-43`). `deliveries: 3` replays the same signed body three times, like a platform retrying. Each delivery is its own request with its own trace id. It returns `{ leadId, deliveries: [{ duplicate, traceId }] }`. It is registered only when `NODE_ENV` isn't `production`, or with `buildApp({ demo: true })` (`app.ts:53`). CORS now allows `POST` so the browser can call it (`app.ts:46`).

**Consequences / trade-offs.**
- The secret never leaves the API. The web app still has only API URLs.
- The form exercises the real path: signature check, idempotent insert, delivery log, NOTIFY, SSE, tracing and triage. "Deliver it 3 times" shows 3 deliveries → 1 lead on camera, with three trace links.
- `app.inject` runs the full Fastify lifecycle in-process with no socket, so hooks such as `onResponse` (spans, triage) run as for a real request.
- The endpoint is an unauthenticated way to create leads in any clinic by slug. Acceptable for a local demo; that's why it's off in production.

**Nuances and failure modes.**
- The three deliveries run concurrently (`Promise.all`), so they race on the unique key exactly as real retries do; one returns `duplicate: false`.
- A bad form is a 400 from the zod error handler before anything is signed, so no `REJECTED` delivery row is written. An unknown clinic is a 404 (`demo.ts:17`).
- If the webhook ever answers non-200, the endpoint throws and returns 500 with "internal error".

**If an interviewer asks…**
- *"Doesn't the form need the webhook secret?"* The API signs on its behalf. The browser sends plain form fields to a demo endpoint, and the API plays the ad platform.
- *"Why not just insert the lead?"* Then the demo would skip the signature, idempotency and tracing it's meant to show. Going through the real route means the form proves the same path a Meta delivery takes.
- *"Could this ship?"* No. It's off when `NODE_ENV=production`, and a test proves the route doesn't exist with `demo: false`.

---

## Where the code and AGENTS.md disagree

| AGENTS.md says | The code does | Impact |
|---|---|---|
| ~~"Triage trigger (PLANNED, not built)"~~ (Decisions) | Built 2026-10-26: `onResponse` triages CREATED leads (`apps/api/src/routes/webhooks.ts:31-51`); `bun run triage:sweep` exists | Resolved. `AGENTS.md` now describes the built trigger, outcomes and sweeper |
| Hub comment: "browsers re-sync on their own reconnect (the `ready` event triggers a refresh)" (`apps/api/src/events.ts:84-85`) | A hub-only LISTEN reconnect leaves browser SSE streams open, so no `ready` fires | Fixed 2026-10-26: the hub sends `ready` on reconnect, so browsers resync |
| Progress: "`forPractice` in `src/lib/tenant.ts`" | `apps/api/src/tenant.ts` | Historical (pre-split); the path is stale |
| Progress step 3: "`POST /api/webhooks/leads`" | `POST /webhooks/leads` (`apps/api/src/routes/webhooks.ts:57`) | Historical (pre-split) |
| Tracing: "NOTIFY carries `traceId` + `startedAt`" | True for webhook events, including the triage `lead.updated` that follows them (`apps/api/src/triage.ts:90`, `:109`). Drag/value events carry neither (`apps/api/src/routes/practices.ts:100`, `:114`) | Drags have no trace; fine, but don't claim "every event is traced" |
| ~~Map: `V4 → C_ATT app/:practice/attribution` (todo)~~ | Built 2026-10-26: the tab opens the live attribution page (`apps/web/src/components/app/app-tabs.tsx:10`) | Resolved. No dead link |
