# LeadLine docs

LeadLine is a live lead board for cosmetic dental clinics. Ad platforms (Meta Lead Ads, Google lead forms) post each enquiry to a signed webhook. LeadLine stores it once even when the platform retries, and pushes it to every open browser tab within milliseconds. A speed-to-lead timer then shows how long the patient has waited for a call. The sales team drags each lead from New to Contacted, Consult booked and Treatment accepted, and records the treatment plan value. Every webhook request is logged and can be traced step by step. One API serves many clinics, and each query is scoped to one clinic. It is a two-day demo for a Dentology job application: a Fastify API, a Next 16 UI and Postgres, running locally.

**Status.** Built: webhook ingestion, idempotency, the delivery log, the live board over SSE, drag-and-drop stages, the speed timer, the lead drawer with treatment value, tenant scoping and request tracing. **Planned, not built:** AI triage with Gemini, the attribution page, the 20-item triage eval, the fake Meta ad form at `/demo/form`. The docs label these "planned" everywhere.

## Read in this order

| # | File | What it gives you |
|---|---|---|
| 1 | [01-problem.md](01-problem.md) | The business problem: who uses it, lead leakage, speed-to-lead, retries, attribution, multi-clinic data, and which feature answers which problem |
| 2 | [02-architecture.md](02-architecture.md) | Services, the 5-table ERD, one webhook from POST to card-on-screen, a drag, the stage state machine, tenancy, the connection budget |
| 3 | [03-decisions.md](03-decisions.md) | Every design decision as an ADR, with trade-offs, failure modes and likely interview questions |
| 4 | [04-integrations.md](04-integrations.md) | What real Meta and Google webhooks need, what's implemented and what production still needs, with sources |
| 5 | [05-ui-ux-audit.md](05-ui-ux-audit.md) | The UI audit with screenshots, the proposed route structure, the UI state for each endpoint, the rendering strategy and a P0/P1/P2 checklist |
| – | [testing.md](testing.md) | How the system is tested (another agent writes this file) |

## Ten-second map

```mermaid
flowchart LR
  AD["Ad platform or simulator"] -- "signed POST /webhooks/leads" --> API["Fastify API :4000"]
  API -- "INSERT ... ON CONFLICT DO NOTHING" --> PG[("Postgres :5433")]
  API -- "pg_notify lead_events" --> PG
  PG -- "LISTEN, one connection per process" --> API
  API -- "SSE /practices/:slug/stream" --> BR["Browser tab"]
  WEB["Next 16 web :3000"] -- "first paint: GET /board" --> API
  BR -- "PATCH stage / PUT value" --> API
```

## Conventions in these docs

- Every claim about code cites `path:line` from the repo root.
- "Planned" means the code does not exist yet. Nothing planned is described as working.
- Diagrams are mermaid. They render on GitHub and were checked with `mmdc`.
- Source of truth for decisions: `AGENTS.md`. These docs explain those decisions. Where the docs and the code disagree, the code wins, and `03-decisions.md` lists the drift.
