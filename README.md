# LeadLine

A live lead board for cosmetic dental clinics.

Ad platforms (Meta Lead Ads, Google lead forms) post each enquiry to a signed webhook. LeadLine stores it once, even when the platform retries, and pushes it to every open browser tab straight away. A speed-to-lead timer shows how long each patient has waited for a call and turns red at 5 minutes. The team drags leads from New to Contacted, Consult booked and Treatment accepted, and records the value of the treatment plan. Every webhook request is logged and can be traced step by step.

It's a two-day demo built for a Dentology job application. It runs locally only.

## Features

- **Signed webhook ingestion** (HMAC-SHA256), idempotent: 3 retries of one lead make 1 lead and 3 logged deliveries.
- **Live board** over SSE, fed by Postgres LISTEN/NOTIFY, with drag-and-drop and keyboard stage moves.
- **Speed-to-lead timer** that turns red at 5 minutes.
- **AI triage with Gemini**: after the webhook has answered, the model reads the enquiry and suggests the treatment, urgency, the patient's concerns and an opening line for the call. Scored against 20 hand-labelled enquiries (`bun run triage:eval`).
- **Campaign attribution**: cost per booked consult and treatment value back per £1 of ad spend.
- **Delivery log and per-request traces**, from the webhook through the LISTEN hub to the Gemini call.
- **Per-clinic data scoping** (multi-tenant).
- **Traffic simulator** and a **try-it ad form** at `/demo/form`.

## Architecture

```mermaid
flowchart LR
  AD["Ad platform or simulator"] -- "signed POST /webhooks/leads" --> API["Fastify API :4000"]
  API -- "INSERT ... ON CONFLICT DO NOTHING + pg_notify (one transaction)" --> PG[("Postgres :5433")]
  PG -- "LISTEN, one connection per process" --> API
  API -- "SSE /practices/:slug/stream" --> BR["Browser tab"]
  API -- "after the 200: structured triage call" --> GEM["Gemini"]
  WEB["Next 16 web :3000"] -- "first paint: GET /board" --> API
  BR -- "PATCH stage / PUT value" --> API
```

| Part | Path | Stack |
|---|---|---|
| API | `apps/api` | Node 24, Fastify 5, Prisma 7 (`PrismaPg` adapter), pino |
| Web | `apps/web` | Next 16 (Cache Components), React 19, Tailwind 4, shadcn/ui, dnd-kit |
| Shared | `packages/shared` | zod payloads and DTO types used by both apps |
| Database | `docker-compose.yml` | Postgres 16 |

The web app has no database access and holds no secrets. The browser talks to the API directly for the SSE stream and stage moves.

## Run it

You need [Bun](https://bun.sh) 1.4+, Node 24 and Docker.

```bash
bun install
cp .env.example .env                    # add a GEMINI_API_KEY for triage
cp apps/web/.env.example apps/web/.env
bun run db:up                           # Postgres 16 on localhost:5433
bun run db:migrate
bun run db:seed                         # 2 clinics, 6 campaigns, 95 leads
bun run dev                             # API on :4000, web on :3000
bun run triage:sweep                    # triage the seeded leads (paced for the free tier)
```

Open http://localhost:3000. Send a lead yourself at http://localhost:3000/demo/form, or send traffic from another terminal:

```bash
bun run simulate --one               # one new lead
bun run simulate --burst-dupes       # one lead delivered 3 times → 1 card, 3 deliveries
bun run simulate                    # steady stream with occasional retries
```

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Start the API and the web app |
| `bun run test` | API tests (Vitest, against the `leadline_test` database) |
| `bun run typecheck` | Type-check every workspace |
| `bun run lint` | Lint the web app |
| `bun run demo:reset` | Reset the demo database and seed it again |
| `bun run triage:sweep` | Triage leads still pending (or failed, up to 3 attempts) |
| `bun run triage:eval` | Score the triage model on 20 labelled enquiries |
| `bun run db:studio` | Open Prisma Studio |

The Postman collection in `postman/` covers every endpoint, including signed webhooks.

## Docs

Start at [`docs/README.md`](docs/README.md): the problem, the architecture (with mermaid diagrams), the design decisions, the ad-platform integrations, the UI audit and the testing strategy.

## Known gaps

This is a local demo. The Gemini free tier may use prompts for training, which is fine for synthetic data; real patient enquiries need the paid tier or Vertex AI. There's no auth on `/practices/*`, no webhook replay protection and webhook secrets are stored in plaintext. In production: session auth with practice membership, signed timestamps with a 5-minute window, and secrets in a secret manager.

Demo data is synthetic. Phone numbers use Ofcom's drama range (`07700 900xxx`) and emails use `@example.com`.
