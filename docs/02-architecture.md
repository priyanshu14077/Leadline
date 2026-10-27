# 2. Architecture

## 2.1 Services

```mermaid
flowchart TB
  subgraph Senders
    META["Meta Lead Ads (production, not wired)"]
    GOOG["Google lead form webhook (production, not wired)"]
    SIM["bun run simulate (apps/api/scripts/simulate.ts)"]
    FORM["Try-it form /demo/form, in the browser"]
  end

  subgraph Browser
    TAB["Board tab: React client components"]
  end

  subgraph WEB["apps/web: Next 16, port 3000"]
    SHELL["Static shell: layouts, Suspense fallbacks"]
    RSC["Async server components: serverApi.board, practice, practices"]
  end

  subgraph API["apps/api: Fastify on Node 24 via tsx, port 4000"]
    WH["POST /webhooks/leads"]
    DEMO["POST /demo/leads (off in production)"]
    PR["/practices/:slug/* routes"]
    HUB["LISTEN hub (events.ts)"]
    TEN["forPractice tenant client"]
  end

  subgraph DB["Postgres 16 in Docker, port 5433"]
    TABLES[("Practice, Campaign, Lead, WebhookDelivery, TraceSpan")]
    CH{{"NOTIFY channel lead_events"}}
  end

  GEM["Gemini API, free tier"]

  SIM -- "HMAC-signed JSON" --> WH
  FORM -- "unsigned form JSON (CORS)" --> DEMO
  DEMO -- "signs with the clinic secret, app.inject" --> WH
  META -. "would need an adapter, see 04-integrations" .-> WH
  GOOG -. "would need an adapter" .-> WH
  TAB -- "HTML + RSC" --- WEB
  RSC -- "server-to-server fetch, API_URL" --> PR
  TAB -- "EventSource GET /stream" --> PR
  TAB -- "PATCH stage, PUT value, GET trace (CORS)" --> PR
  WH --> TEN
  PR --> TEN
  TEN -- "pool, max 5 per process" --> TABLES
  WH -- "SELECT pg_notify" --> CH
  CH -- "1 dedicated pg.Client per process" --> HUB
  HUB -- "SSE frames" --> PR
  WH -- "onResponse: triage after the 200" --> GEM

  classDef planned stroke-dasharray:5 5
  class META,GOOG planned
```

| Part | Runs | Owns | Never does |
|---|---|---|---|
| `apps/api` | `tsx watch` on `src/server.ts` (`apps/api/package.json` `dev` script), Fastify built in `apps/api/src/app.ts:19-55` | Postgres, webhooks, tenancy, the LISTEN hub, SSE, traces, triage, attribution, the demo signing route | Render HTML |
| `apps/web` | `next dev`, Cache Components on (`apps/web/next.config.ts:5`) | Rendering only. Server components fetch the API (`apps/web/src/lib/api.ts:31-35`). The browser calls the API directly (`apps/web/src/lib/api.ts:38-45`) | Touch the DB, hold secrets. It only has `API_URL`, `NEXT_PUBLIC_API_URL`, `DEFAULT_PRACTICE` (`apps/web/.env`) |
| `packages/shared` | Imported as TypeScript source by both | zod payloads and DTO types: `leadPayload`, `LeadCard`, `StreamMessage`, `Trace` (`packages/shared/src/index.ts:25-95`) | Contain logic |
| Postgres | `docker-compose.yml`, port 5433 | Data, uniqueness, NOTIFY | – |

The shared package is the contract. The API's Prisma rows must be assignable to the shared types (`packages/shared/src/index.ts:1-2`). So a schema change that breaks the UI fails typecheck in the API, not at runtime.

## 2.2 Data model (5 tables)

```mermaid
erDiagram
  Practice ||--o{ Campaign : "runs"
  Practice ||--o{ Lead : "owns"
  Practice ||--o{ WebhookDelivery : "receives"
  Practice ||--o{ TraceSpan : "scopes"
  Campaign |o--o{ Lead : "attributed to"
  Lead |o..o{ WebhookDelivery : "leadId, no FK"
  WebhookDelivery |o..o{ TraceSpan : "traceId, no FK"

  Practice {
    string id PK "cuid"
    string slug UK "URL tenant key"
    string name
    string webhookSecret UK "HMAC key, plaintext"
  }
  Campaign {
    string id PK
    string practiceId FK
    enum platform "META GOOGLE TIKTOK"
    string utmCampaign "unique per practice"
    string name
    int spendPence "GBP pence"
  }
  Lead {
    string id PK
    string practiceId FK
    enum source "META_LEAD_ADS GOOGLE_LEAD_FORM WEBSITE"
    string sourceLeadId "platform id, idempotency"
    string name
    string email "nullable"
    string phone "nullable"
    string message
    string utmSource
    string utmCampaign
    string campaignId FK "nullable, SET NULL"
    enum stage "default NEW"
    datetime receivedAt
    datetime firstContactedAt "nullable"
    datetime consultBookedAt "nullable"
    datetime treatmentAcceptedAt "nullable"
    int treatmentValuePence "nullable"
    enum triageStatus "PENDING DONE FAILED"
    int triageAttempts "failed model calls, default 0"
    enum treatmentInterest "triage output, nullable"
    enum urgency "triage output, nullable"
    enum_array objections "triage output"
    string triageOpener "triage output, nullable"
  }
  WebhookDelivery {
    string id PK
    string practiceId FK
    string source "free text, may be unknown"
    string sourceLeadId "nullable"
    enum outcome "CREATED DUPLICATE REJECTED"
    string leadId "nullable, no FK"
    string traceId "x-request-id"
    datetime receivedAt
  }
  TraceSpan {
    string id PK
    string practiceId FK
    string traceId
    string name
    float offsetMs "since arrival"
    float durationMs "null for a point mark"
    string detail
    datetime createdAt
  }
```

Constraints and indexes that carry the design (`apps/api/prisma/schema.prisma`):

| Constraint | Line | Why |
|---|---|---|
| `Lead @@unique([practiceId, source, sourceLeadId])` | `:64` | The idempotency key. The database decides "already have it", not app code. |
| `Lead @@index([practiceId, stage, receivedAt])` | `:65` | The board query filters by practice and stage and sorts by `receivedAt` (`apps/api/src/leads.ts:45-62`). |
| `Campaign @@unique([practiceId, utmCampaign])` | `:32` | Lets `ensureCampaign` race safely with `skipDuplicates` (`apps/api/src/ingest.ts:20-24`). |
| `Practice.webhookSecret @unique` | `:15` | Rename of the old `webhookKey` (`apps/api/prisma/migrations/20261026120000_webhook_secret/migration.sql:2-3`). |
| `WebhookDelivery @@index([traceId])`, `TraceSpan @@index([practiceId, traceId])` | `:83`, `:100` | Trace lookups. |
| `onDelete: Cascade` from Practice; `SetNull` from Campaign to Lead | `:25`, `:38`, `:49` | Deleting a clinic deletes its data. Deleting a campaign keeps its leads. |

Not enforced: `WebhookDelivery.leadId` has no foreign key (`apps/api/prisma/schema.prisma:77`), and `TraceSpan.traceId` is a loose string. Both are logs: they must accept a write even when the related row is odd or missing.

Migrations: `20261026060938_init` (tables, enums, unique keys), `20261026120000_webhook_secret` (rename API key to HMAC secret), `20261026140000_trace_spans` (adds `WebhookDelivery.traceId` and the `TraceSpan` table), `20261027090000_triage_attempts` (adds `Lead.triageAttempts INT NOT NULL DEFAULT 0`).

The triage fields are written only by the model (`apps/api/src/triage.ts:98-107`). The seed leaves them null and `PENDING`; `bun run triage:sweep` fills them. `triageAttempts` counts real failures only: a rate limit or outage doesn't increment it (§2.4).

## 2.3 One webhook, POST to card-on-screen

Span names are the exact strings recorded by `apps/api/src/routes/webhooks.ts`, `apps/api/src/ingest.ts` and `apps/api/src/events.ts`. Timings come from a real trace captured during the audit (screenshot: `/private/tmp/claude-501/-Users-priyanshukumar-Documents-projects-dentology/91dc98e2-a37a-4500-a285-ef9cfdbbaaeb/scratchpad/shots/audit/09-trace.png`).

```mermaid
sequenceDiagram
  autonumber
  participant P as Ad platform / simulator
  participant F as Fastify webhook plugin
  participant I as ingestLead
  participant DB as Postgres pool
  participant CH as NOTIFY lead_events
  participant H as LISTEN hub, same or other process
  participant S as SSE stream(s)
  participant B as Browser board

  P->>F: POST /webhooks/leads, headers x-leadline-practice, x-leadline-signature, optional x-request-id
  Note over F: genReqId reuses a valid x-request-id or mints a UUID. It becomes req.id and the trace id
  F->>F: span "request received" (onRequest hook)
  F->>F: raw body kept as a string. span "body read" with byte count
  F->>DB: span "practice looked up" (findPractice by slug)
  F->>F: span "signature verified" (HMAC-SHA256 of raw bytes, timingSafeEqual)
  alt unknown practice or bad signature
    F-->>P: 401 invalid signature. No rows, no spans saved, one warn log line
  else body not JSON or fails zod
    F->>DB: WebhookDelivery outcome REJECTED + pg_notify delivery.logged
    F-->>P: 400
  else valid
    F->>F: span "payload validated"
    F->>I: ingestLead(practiceId, payload, trace)
    I->>DB: span "campaign resolved" (createMany skipDuplicates, then findFirstOrThrow)
    I->>DB: span "lead insert · ON CONFLICT DO NOTHING" (createManyAndReturn)
    opt 0 rows returned, so a duplicate
      I->>DB: span "existing lead looked up" (findUniqueOrThrow by the unique key)
    end
    I->>DB: span "delivery logged" (WebhookDelivery CREATED or DUPLICATE)
    I->>CH: span "NOTIFY lead_events" (lead.created if new, then delivery.logged)
    F-->>P: 200 with leadId, duplicate flag, traceId. Header x-request-id
    F->>DB: onResponse adds span "response sent", then saveSpans in one createMany
  end
  CH-->>H: notification, payload carries ids + traceId + startedAt only
  H->>H: span "NOTIFY received · lead.created" (queued in NOTIFY order)
  alt this process has open streams for the practice
    H->>DB: span "loaded once for lead.created" (one getLeadCard, shared by every tab)
    H->>S: span "SSE push · lead.created" (N open streams)
    S-->>B: event lead.created with the full LeadCard
    B->>B: upsert card into New, 4 s highlight, timer starts from receivedAt
  else nobody watching from this process
    H->>H: span "no open streams · lead.created"
  end
  H->>DB: saveSpans for the hub spans
```

Points to know when explaining it:

- **The 200 does not wait for tracing.** Spans are collected in memory (`apps/api/src/trace.ts:9-29`) and written in `onResponse` after the reply is sent (`apps/api/src/routes/webhooks.ts:31-36`). The same hook starts triage (§2.4).
- **NOTIFY happens before the 200.** `publish` is awaited inside `ingestLead` (`apps/api/src/ingest.ts:84-91`). The hub can receive the event before the response is on the wire. The real trace shows "NOTIFY received · lead.created" at 14 ms and "response sent" at 14 ms.
- **Each process writes its own spans.** The hub places its spans on the request's timeline with `Date.now() - startedAt` (`apps/api/src/events.ts:58`). `startedAt` travels in the NOTIFY payload (`apps/api/src/ingest.ts:83`). Within the request, offsets come from `performance.now()` (`apps/api/src/trace.ts:13`). Across processes they come from wall-clock time, so cross-host clock skew would show up in the waterfall.
- **One transaction (fixed 2026-10-26).** Lead insert, delivery insert and both `pg_notify` calls run in one `$transaction` (`apps/api/src/ingest.ts`). Postgres delivers a NOTIFY only at commit, so a board never hears about a lead that isn't there. A crash mid-way leaves nothing behind, so the platform's retry is a fresh `CREATED` whose event does go out. Proven by `tests/reliability.test.ts › a failure after the insert rolls back the lead, the delivery and the NOTIFY together`. Cost: each ingest holds a pool connection for the length of the transaction (a few ms). See ADR-03 in [03-decisions.md](03-decisions.md).
- **A duplicate sends only `delivery.logged`** (`apps/api/src/ingest.ts:87-88`). The board gets a new "Duplicate" row and no card change.

## 2.4 Triage after the 200

Triage is one structured Gemini call per new lead. It runs in the webhook plugin's `onResponse` hook, after the reply is on the wire, so the platform never waits for the model and a model failure can't cost a lead (`apps/api/src/routes/webhooks.ts:31-36`). The triage spans join the webhook's own trace: `runTriage` builds `new RequestTrace(traceId, startedAt)`, which keeps the request's clock (`webhooks.ts:41-51`, `apps/api/src/trace.ts:17-23`).

```mermaid
sequenceDiagram
  autonumber
  participant P as Ad platform or demo form
  participant F as Webhook plugin (webhooks.ts)
  participant T as triageLead (triage.ts)
  participant G as Gemini API
  participant DB as Postgres
  participant H as LISTEN hub
  participant B as Browser board

  P->>F: POST /webhooks/leads, signed
  F->>DB: ingestLead in one transaction: lead insert, delivery row, NOTIFY lead.created
  F-->>P: 200 with leadId, duplicate flag, traceId
  Note over F: onResponse hook: span "response sent", saveSpans. Triage only if the outcome was CREATED and a model is configured
  F->>T: runTriage with a continued RequestTrace, job tracked in inFlight
  T->>DB: findUnique, tenant-scoped. Missing or already DONE means SKIPPED
  T->>G: span "triage · Gemini call": generateContent, response schema, temperature 0, thinkingLevel LOW
  alt schema-valid answer
    G-->>T: treatmentInterest, urgency, objections, opener
    T->>DB: updateMany where triageStatus is not DONE, set DONE and the four fields
    alt 0 rows updated, another run finished first
      T-->>F: SKIPPED, nothing pushed
    else 1 row updated
      T->>DB: pg_notify lead.updated with traceId and startedAt
      T->>T: span "triage saved"
      DB-->>H: notification
      H-->>B: SSE lead.updated with the triaged LeadCard
      B->>B: triage chip on the card, opener in the drawer
    end
  else 429, 408, 5xx or network error, so TriageBusy
    T->>T: span "triage deferred". Lead stays PENDING, triageAttempts unchanged, nothing pushed
  else 400 or an answer that fails the zod schema
    T->>DB: updateMany to FAILED, triageAttempts + 1
    T->>DB: pg_notify lead.updated
    T->>T: span "triage failed"
    DB-->>H: notification
    H-->>B: SSE lead.updated, the drawer shows "Triage failed"
  end
  F->>DB: saveSpans for the triage spans under the same traceId
  Note over T,DB: bun run triage:sweep later retries PENDING leads, and FAILED ones under 3 attempts
```

Points to know when explaining it:

- **Outcomes.** `geminiClassifier` maps errors in `isRetryable` (`apps/api/src/triage.ts:46-49`): 408, 429, 5xx and anything that never reached the model become `TriageBusy`. A 400 or a reply that fails `triageResult` (`triage.ts:10-16`) is a real failure. `triageLead` returns `DONE`, `BUSY`, `FAILED` or `SKIPPED` and never throws (`triage.ts:85-125`).
- **Race.** The write is `updateMany where triageStatus != DONE` (`triage.ts:98-108`), so if the webhook and the sweeper triage the same lead, the first answer wins and only one `lead.updated` goes out. A FAILED write has the same guard (`triage.ts:117-120`), so it can't overwrite a DONE.
- **No model, no triage.** `apps/api/src/server.ts` passes `geminiClassifier()`, which is null without `GEMINI_API_KEY` (`triage.ts:52-53`). Leads then stay `PENDING` until `bun run triage:sweep`. Tests pass a fake through `buildApp({ classify })` (`apps/api/src/app.ts:12-17`).
- **Shutdown.** In-flight jobs are awaited in `onClose` (`webhooks.ts:53-55`). A crash still loses them; the lead stays `PENDING` and the sweep picks it up.
- **The sweeper** (`apps/api/scripts/triage-sweep.ts:34-54`) takes `PENDING` plus `FAILED` under `--max-attempts` (default 3), newest first, one at a time, `--every 4` seconds apart. On `BUSY` it waits 15 s, then doubles up to 120 s; a success resets the wait. It also backfills the seeded leads, which start `PENDING` on purpose.
- **Latency.** Free-tier calls took about 15–20 s each on 2026-10-26. The headless E2E saw the triage chip about 19 s after the card appeared.

## 2.5 Attribution

`GET /practices/:slug/attribution` (`apps/api/src/routes/practices.ts:47`) returns the shared `Attribution` type: one row per campaign, `totals`, and `unattributedLeads` (leads with no campaign).

```mermaid
flowchart LR
  WH["Webhook: new lead with utm_campaign"] --> L[("Lead: stage timestamps, treatmentValuePence")]
  DR["Drag or value edit: PATCH stage, PUT value"] --> L
  C[("Campaign: spendPence")] --> Q
  L --> Q["attribution(practiceId): one raw SQL query, Campaign LEFT JOIN Lead, practiceId passed explicitly"]
  Q --> API["GET /practices/:slug/attribution"]
  API -- "first paint: server fetch under Suspense" --> PG["/app/[practice]/attribution"]
  WH & DR -- "NOTIFY lead.*, then SSE" --> PG
  PG -- "refetch, debounced 600 ms" --> API
```

| Field | Counted from | Code |
|---|---|---|
| `leads` | every lead on the campaign | `apps/api/src/attribution.ts:40` |
| `contacted`, `consultsBooked`, `treatmentsAccepted` | `firstContactedAt`, `consultBookedAt`, `treatmentAcceptedAt` not null: the first time the stage was reached, so a lead booked and then lost still counts as booked | `attribution.ts:41-43` |
| `revenuePence` | sum of `treatmentValuePence` on accepted leads | `attribution.ts:44` |
| `acceptedWithoutValue` | accepted leads with no plan value yet, so revenue is understated | `attribution.ts:45` |
| `costPerLeadPence`, `costPerConsultPence`, `valuePerPound` | spend ÷ leads, spend ÷ consults, revenue ÷ spend. `null` when the divisor is 0 | `attribution.ts:20-29` |

- **Tenancy.** Raw SQL bypasses `forPractice`, so `practiceId` is a bound parameter in both queries and in the join (`attribution.ts:47-52`). `tests/attribution.test.ts › keeps each clinic's numbers apart` proves it with a same-named campaign in another clinic.
- **A campaign with no leads still shows**, with its spend (`LEFT JOIN`). Rows are sorted by revenue, then spend (`attribution.ts:50`).
- **Not cached.** The page is dynamic like the board (`apps/web/src/app/app/[practice]/attribution/page.tsx:10-20`). `AttributionView` refetches from the browser on any `lead.*` stream event, debounced 600 ms so a sweep or a burst of drags becomes one request (`apps/web/src/components/attribution/attribution-view.tsx:10`, `:134-146`). See ADR-21.
- **On the seed**, Veneers – Instagram Reels returns about £9.69 per £1. The £199 TikTok whitening campaign has the cheapest cost per booked consult (£112.50) and returns £0.

## 2.6 A drag: optimistic update, PATCH, NOTIFY, SSE confirm

```mermaid
sequenceDiagram
  autonumber
  participant U as Closer
  participant B as Board (board.tsx)
  participant A as PATCH /practices/:slug/leads/:id/stage
  participant DB as Postgres
  participant H as LISTEN hub
  participant T as Every open tab, this one included

  U->>B: drop card on Consult booked
  B->>B: before = leads, then upsert with the new stage (optimistic)
  B->>A: PATCH body stage CONSULT_BOOKED
  A->>A: preHandler resolves slug, req.db = forPractice(id)
  A->>DB: findUnique id (scoped), read current timestamps
  alt lead not found or other tenant
    A-->>B: 404 lead not found
    B->>B: setLeads(before), toast "Couldn't move NAME. Try again."
  else found
    A->>DB: update with stageTimestamps(lead, to)
    A->>DB: pg_notify lead.updated (no traceId)
    A-->>B: 200 LeadCard
    B->>B: upsert(saved) unless LOST
    DB-->>H: notification
    H->>DB: getLeadCard once
    H-->>T: SSE lead.updated with the full card
    T->>T: upsert, server copy wins
  end
```

Code: optimistic move and rollback `apps/web/src/components/board/board.tsx:104-124`; handler `apps/api/src/routes/practices.ts:72-84`.

The same card comes back twice, once in the PATCH response and once over SSE. `upsert` replaces by id (`apps/web/src/components/board/board.tsx:73-82`), so applying it twice is harmless. Rollback restores the whole `before` array (`board.tsx:110`, `:116`). Any SSE update that arrived during the request is overwritten until the next event or resync. That is a known edge.

Moving to **Lost** removes the card from the board and bumps the "lost" counter once per id (`board.tsx:54-56`, `:74-77`). The drop target only appears while dragging (`board.tsx:177-191`).

## 2.7 Lead stages and timestamp rules

`stageTimestamps` (`apps/api/src/leads.ts:73-84`) allows any move, including backwards. Each timestamp records the **first** time a stage was reached and is never cleared.

```mermaid
stateDiagram-v2
  [*] --> NEW: webhook CREATED, receivedAt = now
  NEW --> CONTACTED: stamps firstContactedAt if null
  NEW --> CONSULT_BOOKED: stamps firstContactedAt and consultBookedAt if null
  NEW --> TREATMENT_ACCEPTED: stamps all three if null
  CONTACTED --> CONSULT_BOOKED: stamps consultBookedAt if null
  CONSULT_BOOKED --> TREATMENT_ACCEPTED: stamps treatmentAcceptedAt if null
  NEW --> LOST: stamps nothing
  CONTACTED --> LOST
  CONSULT_BOOKED --> LOST
  LOST --> CONTACTED: stamps firstContactedAt if null
  CONTACTED --> NEW: backwards, nothing cleared
  TREATMENT_ACCEPTED --> CONSULT_BOOKED: backwards, nothing cleared
  note right of LOST
    Lost never stamps firstContactedAt.
    Binning spam unread is not contact (leads.ts:79-80).
  end note
  note left of NEW
    Moving back to NEW keeps firstContactedAt,
    so speed-to-lead cannot be reset by dragging.
  end note
```

The full rule set:

| Target stage | `firstContactedAt` | `consultBookedAt` | `treatmentAcceptedAt` |
|---|---|---|---|
| `NEW` | unchanged | unchanged | unchanged |
| `CONTACTED` | set if null | unchanged | unchanged |
| `CONSULT_BOOKED` | set if null | set if null | unchanged |
| `TREATMENT_ACCEPTED` | set if null | set if null | set if null |
| `LOST` | unchanged | unchanged | unchanged |

Board visibility (`apps/api/src/leads.ts:42-62`): every `NEW` and `CONTACTED` lead, plus `CONSULT_BOOKED` and `TREATMENT_ACCEPTED` leads reached in the last 7 days. `LOST` leads only appear as a count.

The speed timer (`apps/web/src/components/board/speed-timer.tsx:12-59`): once `firstContactedAt` is set, it freezes at the time to first contact (green under 5 minutes). Otherwise it ticks: green under 3 min, amber under 5, red with a pulse after 5. A `LOST` lead with no contact shows "Not contacted". One shared 1-second ticker drives every timer (`apps/web/src/hooks/use-now.ts:5-28`). The server snapshot is `null`, so no time is baked into server HTML (`use-now.ts:26-27`).

## 2.8 Tenancy

```mermaid
flowchart LR
  REQ["GET or PATCH /practices/:slug/..."] --> PH["preHandler: findPractice(slug)"]
  PH -- "not found" --> E404["404 practice not found"]
  PH -- "found" --> DBX["req.db = forPractice(practice.id)"]
  DBX --> H["Handler only sees req.db"]
  H --> Q["Prisma call, e.g. lead.update where id"]
  Q --> EXT["$extends query hook: $allModels.$allOperations"]
  EXT -- "model not in TENANT_MODELS" --> PASS["query(args) unchanged"]
  EXT -- "Campaign, Lead, WebhookDelivery, TraceSpan" --> SC["scope(): where gets practiceId, data gets practiceId"]
  SC --> SQL["SQL with AND practiceId = $1"]
```

How it works (`apps/api/src/tenant.ts`):

- `forPractice(practiceId)` returns `prisma.$extends(...)` with a query hook on every model and operation (`:50-64`). Only the four tenant models are touched (`:5`). `Practice` is the tenant itself.
- For read, update and delete operations (`:7-21`) plus `upsert`, it **spreads** `practiceId` into `where`: `{ ...args.where, practiceId }` (`:30-33`). It doesn't wrap in `AND`.
- **Why unique-where ops still work.** Since Prisma 5, `findUnique`, `update`, `delete` and `upsert` accept extra non-unique filters next to the unique field. So `where: { id, practiceId }` is still a valid unique-where. A cross-tenant `update` by id finds no row and throws P2025, the same error as a missing row. It never reveals that the row exists in another clinic.
- For creates (`:34-38`), it stamps `practiceId` onto `data`, including each row of `createMany`/`createManyAndReturn`.
- For updates (`:43-45`), it forces `data.practiceId` to the current tenant, so a row can never be moved to another clinic.
- The practice comes from the URL and is resolved once in a Fastify `preHandler` (`apps/api/src/routes/practices.ts:31-37`). Handlers never receive an unscoped client. In production it would come from the session (`practices.ts:23-27`).
- The webhook resolves the practice from `x-leadline-practice` and HMAC instead (`apps/api/src/routes/webhooks.ts:62-72`), then `ingestLead` builds its own scoped client (`apps/api/src/ingest.ts:33`).

**What is NOT scoped:**

| Path | Why it escapes | What the code does instead |
|---|---|---|
| Raw SQL (`$queryRaw`, `$executeRaw`) | Query extensions only see model operations | `publish` uses the base client for `pg_notify` (`apps/api/src/events.ts:24`); it carries no tenant data. `attribution()` passes `practiceId` as a bound parameter in its `WHERE` and join (`apps/api/src/attribution.ts:47-52`). Any new raw SQL must do the same |
| Nested reads from `Practice`, e.g. `practice.findUnique({ include: { leads: true } })` | The hook sees the operation on the parent model (`Practice`, not a tenant model). The nested relation query is not rewritten | No code does this. `leadCardSelect` includes `campaign` (`apps/api/src/leads.ts:14`), which is safe because the lead was already scoped and owns that campaign |
| The base `prisma` client | It is a plain import | Used only for `findPractice`/`listPractices` (`apps/api/src/practice.ts:3-9`) and `saveSpans`, which sets `practiceId` explicitly (`apps/api/src/trace.ts:43-46`) |
| Nested writes (`create: { campaign: { create: ... } }`) | The hook stamps only the top-level `data` | No code does nested writes |

Tests: `apps/api/tests/tenancy.test.ts` (see [testing.md](testing.md)).

## 2.9 Connection budget

```mermaid
flowchart LR
  subgraph "One API process"
    POOL["PrismaPg pool, max 5 (db.ts:8)"]
    LC["1 pg.Client running LISTEN lead_events (events.ts:79)"]
    SET["listeners: Map practiceId to Set of SSE writers"]
  end
  T1["Tab 1"] & T2["Tab 2"] & TN["Tab N"] -- "SSE" --> SET
  POOL --> PG[("Postgres")]
  LC --> PG
```

- **Per API process: at most 6 Postgres connections.** That's the Prisma pool's 5 (`apps/api/src/db.ts:5-9`) plus 1 dedicated LISTEN client (`apps/api/src/events.ts:77-105`). It doesn't matter how many tabs are open.
- A tab costs one HTTP connection to the API and one entry in an in-memory `Set` (`apps/api/src/events.ts:107-115`), not a DB connection.
- Each NOTIFY costs **one** query per process, no matter how many tabs watch. `resolve()` runs once and the message is written to every listener (`apps/api/src/events.ts:63-70`). The trace shows it: "loaded once for lead.created … 1 query, shared by every tab".
- If a process has no open streams for the practice, it skips the query (`apps/api/src/events.ts:64-65`).
- Both the client and the hub live on `globalThis`, so `tsx watch` reloads and test workers don't open new pools (`apps/api/src/db.ts:13-18`, `apps/api/src/events.ts:33-38`).
- Scaling formula: `instances × (5 + 1)` must stay under Postgres `max_connections` minus headroom. 10 instances = 60. Behind a transaction-mode pooler (PgBouncer, Supavisor), LISTEN needs a **session** connection, because LISTEN state lives on one backend.
- The browser side has a limit too: HTTP/1.1 browsers allow about 6 connections per origin. Each tab's EventSource uses one. Many tabs of the same origin on HTTP/1.1 can starve other requests. HTTP/2 in production removes this.

## 2.10 Reconnects and resync

```mermaid
sequenceDiagram
  participant B as Browser EventSource
  participant A as API /stream
  participant H as LISTEN hub
  B->>A: GET /practices/:slug/stream
  A-->>B: event ready (first connect, ignored)
  loop every 15 s
    A-->>B: ": ping" comment
  end
  Note over B,A: network drops or API restarts
  B->>A: EventSource auto-reconnects
  A-->>B: event ready (second time)
  B->>B: onResync, router.refresh(), server components refetch /board
  B->>B: Board adopts new props during render
  Note over H: If only the hub's LISTEN connection drops, it reconnects after 1 s. Browser streams stay open, so no ready event fires and events in the gap are missed until a reload.
```

Code: `ready` written on every connect (`apps/api/src/routes/practices.ts:62-63`), heartbeat (`:61`), client resync (`apps/web/src/hooks/use-lead-stream.ts:22-25`), adopting refreshed props (`apps/web/src/components/board/board.tsx:63-70`), hub reconnect (`apps/api/src/events.ts:80-89`).

## 2.11 Error handling and logging

- Zod errors anywhere become `400 { error: "invalid body", issues }` (`apps/api/src/app.ts:35-36`). Other errors keep their status. 5xx messages are replaced with "internal error" (`app.ts:37-40`).
- Every response carries `x-request-id` (`apps/api/src/app.ts:31-33`), and CORS exposes it (`app.ts:47`). The web client puts it on `ApiError` (`apps/web/src/lib/api.ts:23-26`).
- Logs are pino: pretty in dev, JSON in production for log-based metrics (`apps/api/src/server.ts:9-16`). Every line carries `reqId`.
- Without `GEMINI_API_KEY` the server logs one warning at startup and leads stay `PENDING` (`apps/api/src/server.ts:21`).
- Graceful shutdown closes Fastify, the hub and Prisma on SIGINT/SIGTERM (`apps/api/src/server.ts:23-30`). Fastify's `onClose` first waits for any triage still running (§2.4).

## 2.12 UML views

The sections above already hold most of the UML. This section adds the two structural views they don't cover: a class diagram and a deployment diagram.

| UML diagram | Where |
|---|---|
| Sequence | §2.3 webhook, §2.4 triage, §2.6 drag, §2.10 reconnect |
| State machine | §2.7 lead stages |
| Entity-relationship (data model) | §2.2 |
| Class | §2.12.1 below |
| Deployment | §2.12.2 below |

### 2.12.1 Class diagram: API modules and shared contracts

Most of the API is plain functions, not classes. A module is drawn as a `«module»` class whose methods are its exports. Only `RequestTrace` and `TriageBusy` are real classes. Types come from `apps/api/src/*.ts` and `packages/shared/src/index.ts`.

```mermaid
classDiagram
  direction LR

  class Tracer {
    <<interface>>
    +traceId? string
    +startedAt? number
    +mark(name, detail?)
    +time~T~(name, fn, detail?) Promise~T~
  }
  class RequestTrace {
    +traceId string
    +startedAt number
    +practiceId string?
    +spans TraceSpan[]
    -t0 number
    +RequestTrace(traceId, startedAt = now)
    +mark(name, detail?)
    +time~T~(name, fn, detail?) Promise~T~
  }
  class NO_TRACE {
    <<object>>
    +mark() no-op
    +time(name, fn) runs fn
  }
  Tracer <|.. RequestTrace
  Tracer <|.. NO_TRACE

  class Classify {
    <<function type>>
    +call(Enquiry) Promise~TriageResult~
  }
  class TriageBusy {
    <<exception>>
    +reason 429 408 5xx network
  }
  Error <|-- TriageBusy

  class triage {
    <<module>>
    +geminiClassifier(apiKey?, model?) Classify?
    +triageLead(practiceId, leadId, classify, trace) TriageOutcome
  }
  class ingest {
    <<module>>
    +ingestLead(practiceId, LeadPayload, trace) IngestResult
    +logRejected(practiceId, source, sourceLeadId?, trace)
  }
  class events {
    <<module>>
    +publish(LeadEvent, db = prisma)
    +subscribe(practiceId, Listener, onResync?)
    +streamCount(practiceId?) number
    +closeHub()
  }
  class tenant {
    <<module>>
    +forPractice(practiceId) TenantDb
  }
  class leads {
    <<module>>
    +boardLeads(TenantDb)
    +getLeadCard(TenantDb, id) LeadCard
    +toLeadCard(row) LeadCard
    +stageTimestamps(lead, stage)
  }
  class attribution {
    <<module>>
    +attribution(practiceId) Attribution
  }
  class app {
    <<module>>
    +buildApp(logger?, classify?, demo?) FastifyInstance
  }

  class LeadEvent {
    <<union>>
    +type created updated logged
    +practiceId string
    +traceId? string
    +startedAt? number
  }
  class StreamMessage {
    <<union>>
    +type string
    +lead LeadCard
    +delivery DeliveryRow
  }
  class LeadCard {
    <<shared DTO>>
    +id string
    +stage Stage
    +receivedAt string
    +firstContactedAt string?
    +triageStatus TriageStatus
    +urgency Urgency?
    +objections Objection[]
    +triageOpener string?
    +campaign name platform
  }
  class Attribution {
    <<shared DTO>>
    +campaigns CampaignAttribution[]
    +totals
    +unattributedLeads number
  }

  app ..> ingest : webhook route
  app ..> triage : onResponse
  app ..> leads : practice routes
  app ..> attribution : GET attribution
  app ..> events : SSE subscribe
  app ..> Classify : injected
  triage ..> Classify : calls
  triage ..> TriageBusy : catches
  triage ..> Tracer : continued trace
  triage ..> tenant
  triage ..> events : lead.updated
  ingest ..> Tracer
  ingest ..> tenant
  ingest ..> events : publish(tx)
  leads ..> tenant
  events ..> LeadEvent : NOTIFY payload
  events ..> StreamMessage : resolves once, fans out
  StreamMessage --> LeadCard
  attribution ..> Attribution
```

What to read off it:

- **`Tracer` is the seam for tracing.** `ingestLead` and `triageLead` take a `Tracer`, not a `RequestTrace`. The webhook passes a real trace; scripts and tests pass `NO_TRACE`. Triage after the 200 builds a second `RequestTrace` with the original `startedAt`, so its spans land on the same timeline (`apps/api/src/trace.ts:16-23`).
- **`Classify` is the seam for the model.** `buildApp({ classify })` takes it, so tests inject a fake and `server.ts` injects `geminiClassifier()`. `triageLead` never imports Gemini directly.
- **`LeadEvent` and `StreamMessage` are different shapes on purpose.** The NOTIFY payload carries ids only (8 KB limit). The hub turns it into a `StreamMessage` with a full `LeadCard`, once per process (§2.9).
- **Every database path goes through `tenant`,** except `attribution` and `publish`, which use raw SQL and pass `practiceId` themselves (§2.8).

### 2.12.2 Deployment diagram

Mermaid has no UML deployment diagram type, so this uses a flowchart with UML `«device»`, `«executionEnvironment»` and `«artifact»` stereotypes.

```mermaid
flowchart TB
  subgraph DEV["«device» Developer machine (macOS)"]
    subgraph BUN["«executionEnvironment» Bun 1.4 workspace: bun run dev"]
      subgraph NODE["«executionEnvironment» Node 24 via tsx watch"]
        API["«artifact» apps/api src/server.ts\nFastify :4000"]
      end
      subgraph NEXT["«executionEnvironment» next dev"]
        WEBA["«artifact» apps/web\nNext 16 :3000"]
      end
      SHARED["«artifact» packages/shared\nTypeScript source, no build"]
      SCRIPTS["«artifact» scripts: simulate, triage:sweep, triage:eval"]
    end
    subgraph DOCKER["«executionEnvironment» Docker: docker-compose.yml"]
      PG[("«artifact» postgres:16\nleadline-db :5433\nleadline + leadline_test")]
    end
    BROWSER["«executionEnvironment» Browser"]
  end
  GEMINI["«device» Google Gemini API\ngemini-3.5-flash-lite, free tier"]

  SHARED -. "imported by" .-> API
  SHARED -. "transpilePackages" .-> WEBA
  BROWSER -- "HTTP :3000 pages" --> WEBA
  BROWSER -- "HTTP :4000 SSE, PATCH, PUT, POST demo (CORS)" --> API
  WEBA -- "HTTP :4000 server-to-server" --> API
  API -- "TCP :5433 pool of 5 + 1 LISTEN" --> PG
  SCRIPTS -- "HTTP :4000 signed webhooks" --> API
  SCRIPTS -- "TCP :5433 (triage:sweep)" --> PG
  API -- "HTTPS, root .env GEMINI_API_KEY" --> GEMINI
  SCRIPTS -- "HTTPS (sweep, eval)" --> GEMINI
```

Where secrets live: the root `.env` (`DATABASE_URL`, `GEMINI_API_KEY`) is read only by the Node API, Prisma and the scripts. `apps/web/.env` has URLs and `DEFAULT_PRACTICE` only. Nothing reaches the browser except `NEXT_PUBLIC_API_URL`.

In production the shape stays the same, but the parts run separately: the API as a long-running container (not serverless, because it holds the LISTEN connection and does work after the response), the web app wherever Next runs, Postgres managed, and Gemini on the paid tier or Vertex AI (ADR-15 in [03-decisions.md](03-decisions.md)).
