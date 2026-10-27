---
name: leadline-run
description: Start, reset, test, trace and verify LeadLine (Fastify API in apps/api, Next.js web in apps/web, Postgres in Docker). Use when running the app, seeding or resetting demo data, running tests, firing simulated leads or the demo form, triaging or evaluating with Gemini, following a request end to end, or checking DB state before a recording.
---

# Run LeadLine

Bun workspaces. Run everything from the repo root.

| Service | URL | Logs |
|---|---|---|
| API (Fastify on Node via tsx) | http://localhost:4000 | `[time] INFO: msg {"reqId":…}`, prefixed `@leadline/api dev:` |
| Web (Next.js) | http://localhost:3000 | prefixed `@leadline/web dev:` |
| Postgres `leadline-db` | localhost:5433, user/password/db `leadline` | `docker logs leadline-db` |

## Start

1. `docker info` must succeed. If it doesn't, run `open -a Docker` and wait.
2. `bun run db:up` starts Postgres and waits for the healthcheck.
3. `bun install` (the API's `postinstall` runs `prisma generate`).
4. `bun run db:migrate` (`migrate deploy`).
5. `bun run db:seed` loads 2 practices, 6 campaigns and 95 leads.
6. `bun run dev` starts the API and web together. `bun run dev:api` or `bun run dev:web` starts one.

Env files:
- Root `.env` (API, Prisma, simulator): `DATABASE_URL="postgresql://leadline:leadline@localhost:5433/leadline?schema=public"`, `GEMINI_API_KEY=...`. Optional: `API_PORT` (4000), `WEB_ORIGIN` (http://localhost:3000), `LOG_LEVEL`.
- `apps/web/.env`: `API_URL`, `NEXT_PUBLIC_API_URL` (both `http://localhost:4000`), `DEFAULT_PRACTICE="smile-studio-london"`.

## Send leads

- `bun run simulate --one` sends one lead. `--burst-dupes` sends the same lead 3× at once (expect 1 created, 2 duplicate). `--count 10 --every 3` sends steady traffic with ~25% retries. Add `--practice harley-dental-manchester` for the other clinic.
- Each line prints the request's trace id.

By hand (needs the HMAC signature):

```bash
BODY='{"source":"META_LEAD_ADS","sourceLeadId":"manual-1","name":"Olivia Bennett","message":"Invisalign on finance?","utm":{"source":"facebook","campaign":"invisalign_autumn_leadform"}}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac whsec_dev_smile_studio -hex | awk '{print $NF}')"
curl -si -X POST localhost:4000/webhooks/leads -H "content-type: application/json" \
  -H "x-leadline-practice: smile-studio-london" -H "x-leadline-signature: $SIG" -H "x-request-id: manual-trace-0001" -d "$BODY"
```

Dev secrets: `smile-studio-london` → `whsec_dev_smile_studio`, `harley-dental-manchester` → `whsec_dev_harley_dental`.

From the browser: http://localhost:3000/demo/form. "Fill with a sample", tick "Deliver it 3 times" for the retry beat, submit. The API (`POST /demo/leads`) signs it server-side and sends it through the real webhook.

## Triage (Gemini)

- New leads are triaged by the API after the webhook's 200, if `GEMINI_API_KEY` is set. Expect ~15-20 s on the free tier. The log line is `lead triaged {"outcome":"DONE"|"BUSY"|"FAILED"}`.
- `bun run triage:sweep` triages everything still PENDING (all seeded leads) or FAILED under 3 attempts, one at a time with backoff. ~95 seeded leads take a while on the free tier; run it after `demo:reset` and before recording, so the board's cards have triage chips. `--practice <slug>`, `--limit N`.
- `bun run triage:eval` scores the model on 20 hand-labelled enquiries (`apps/api/scripts/eval-set.ts`). It doesn't touch the DB.
- 429/503 from Gemini means busy: the lead stays PENDING and the sweeper picks it up.

## Follow one request end to end

1. Get the trace id: the `x-request-id` response header, the simulator output, or click a row in the board's "Webhook deliveries" panel.
2. Waterfall: click the delivery row, or `curl -s localhost:4000/practices/smile-studio-london/traces/<id> | jq`.
3. Log lines: grep the dev output for `<id>`. Every API log line carries `reqId`.
4. Rows: `select * from "WebhookDelivery" where "traceId"='<id>';` and `select name, "offsetMs", "durationMs", detail from "TraceSpan" where "traceId"='<id>' order by "offsetMs";`

## Reset before a recording take

Run `bun run demo:reset` yourself. Prisma refuses `migrate reset` from an AI agent without explicit user consent. It drops the DB, re-migrates and re-seeds. Seed timestamps are relative to now, so reset right before recording, then `bun run triage:sweep` so seeded cards carry triage.

## Verify

- `bun run test`: Vitest in `apps/api` against `leadline_test` (tenancy, idempotency, signatures, tracing, triage with a fake model, attribution, demo route). No test calls Gemini.
- `bun run typecheck` and `bun run lint`.
- `docker exec -it leadline-db psql -U leadline -d leadline`. Tables are quoted PascalCase (`"Lead"`, `"Campaign"`, `"WebhookDelivery"`, `"TraceSpan"`).
- Expected seed shape: on `/app/smile-studio-london/attribution`, Veneers returns the most per £1 and the £199 TikTok whitening campaign returns £0 despite the cheapest cost per consult.
