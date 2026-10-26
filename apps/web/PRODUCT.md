# Product

<!-- impeccable:product-schema 1 -->

> Written by an agent without an interview: the user could not be reached. Every fact below is
> taken from `docs/01-problem.md`, `docs/05-ui-ux-audit.md` and the root `AGENTS.md`. Lines marked
> **(assumed)** are inferences, not confirmed answers. Correct them when the user is available.

## Platform

web

## Users

- **The agency's in-house sales team** (closers and setters at Dentology). They sit on a sales floor
  with the board open all day, often in several tabs, and decide who to ring next. Their job: ring
  the freshest uncontacted lead before it goes cold, never ring the same patient twice, then move
  the card through Contacted → Consult booked → Treatment accepted and record the plan value.
- **Clinic owner / principal dentist.** Not technical. Looks at the board to see that the leads they
  pay for are worked fast. Later: which campaigns make money.
- **Agency ops / engineer.** Needs proof that every webhook arrived and was stored once, and a way to
  debug a missing lead (delivery log + request trace).
- **An interviewer at Dentology** watching a ~2.5 min Loom and the live demo. **(assumed)** They
  judge both product sense and engineering seriousness from the same screens.

## Product Purpose

LeadLine is a live lead board for high-end UK cosmetic dental clinics. Leads from Meta, Google and
website forms land once, in under a second, and every minute until first contact is counted.
Success: no lead waits unseen, no patient is rung twice, and every inbound request can be accounted
for. Each lead is worth £3,000–£25,000 in treatment, so a lead nobody rings is ad spend wasted.

## Positioning

Built for speed-to-lead on a sales floor, with the plumbing visible: idempotent webhook ingestion
(three retries become one card), a delivery log of every attempt, and an end-to-end trace of each
request from webhook to SSE push in milliseconds. A generic CRM shows a list; LeadLine shows the
lead arriving and the clock running.

## Operating Context

- Sales floor, many tabs, all day. Board updates live over SSE; nobody refreshes.
- One agency runs many competing clinics. Clinic isolation is a commercial and legal line (UK GDPR,
  arguably health data). The clinic name on screen must never be ambiguous.
- Times are always Europe/London.
- Local demo only: no deploy, no auth. Recorded on camera for the interview.

## Capabilities and Constraints

Built:
- Signed (HMAC) webhook ingestion; idempotency on `(practiceId, source, sourceLeadId)`.
- Delivery log of every request, retries included (Created / Duplicate / Rejected).
- Request trace: spans from the webhook handler and the LISTEN hub, with offsets and durations.
- Live pipeline over SSE: New → Contacted → Consult booked → Treatment accepted, plus Lost.
- Speed timer: green < 3 min, amber < 5, red from 5 min; frozen at time-to-first-contact.
- Treatment plan value in GBP (stored as pence, max £250,000).
- Tenant scoping per clinic.

Not built (must never be shown as working): AI triage, attribution (cost per booked consult, value
per £1), the demo ad form, the triage eval. They may appear only as clearly labelled "Coming next",
with no numbers and no fake screenshots.

Technical: Next 16 with Cache Components; the browser talks to the API directly (CORS); the web app
holds no secrets and no DB access.

## Brand Commitments

- Name: **LeadLine**. No logo asset exists. **(assumed)** a wordmark is acceptable.
- Built for Dentology, but this is not Dentology's product: never use Dentology's logo, branding or
  domain.

## Evidence on Hand

- Seed data: 2 clinics (Smile Studio London, Harley Dental Manchester), 6 campaigns, ~95 synthetic
  leads. Phones are Ofcom drama range `07700 900xxx`, emails `@example.com`.
- Real traces with real span names and timings from the running API.
- No customers, testimonials, logos, benchmarks or prices exist. Do not invent any. The only numbers a
  marketing page may state are ones the product itself enforces (e.g. "red at 5 minutes",
  "max £250,000").

## Product Principles

1. **The clock is the product.** The most important fact on any screen is who has waited longest.
2. **Honest by construction.** Never show a capability, number or state that isn't real; connection
   state, partial traces and unbuilt features say exactly what they are.
3. **One lead, once.** Duplicates are caught by the database and made visible, not hidden.
4. **Every request accounted for.** Anything that came in can be found and traced.
5. **Calm under load.** A sales floor watches this all day: precision and scanability over flourish.

## Accessibility & Inclusion

WCAG 2.2 AA. Every stage change must be possible without dragging (2.5.7). Status never by colour
alone. Respect `prefers-reduced-motion`. Text ≥ 12 px with ≥ 4.5:1 contrast. Locale `en-GB`.
