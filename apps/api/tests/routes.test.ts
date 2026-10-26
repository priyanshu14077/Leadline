import type { Board, LeadCard, StreamMessage } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub, subscribe } from "../src/events";
import { ingestLead } from "../src/ingest";
import { PRACTICE_HEADER, SIGNATURE_HEADER, sign } from "../src/signature";
import { createPractice, deletePractices, payload, postWebhook, waitFor, type TestPractice } from "./helpers";

let app: FastifyInstance;
let practice: TestPractice;
let other: TestPractice;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

function seedLead(p: TestPractice, sourceLeadId: string, data: Record<string, unknown> = {}) {
  return prisma.lead.create({
    data: { practiceId: p.id, source: "WEBSITE", sourceLeadId, name: `Lead ${sourceLeadId}`, message: "Veneers price?", ...data },
    select: { id: true },
  });
}

beforeAll(async () => {
  app = await buildApp();
  // A route that throws, to exercise the error handler. Added before ready(), like any other route.
  app.get("/test/boom", async () => {
    throw new Error("secret connection string");
  });
  app.get("/test/teapot", async () => {
    throw Object.assign(new Error("short and stout"), { statusCode: 418 });
  });
  practice = await createPractice("routes-test");
  other = await createPractice("routes-other");
});

afterAll(async () => {
  await deletePractices(practice, other);
  await app.close();
  await closeHub();
  await prisma.$disconnect();
});

describe("practices", () => {
  it("GET /health is ok", async () => {
    const res = await app.inject({ url: "/health" });
    expect(res.json()).toEqual({ ok: true });
  });

  it("lists practices without their webhook secrets", async () => {
    const list = (await app.inject({ url: "/practices" })).json<Record<string, unknown>[]>();
    const mine = list.find((p) => p.slug === practice.slug);
    expect(mine).toEqual({ id: practice.id, slug: practice.slug, name: `Clinic ${practice.slug}` });
    expect(list.every((p) => !("webhookSecret" in p))).toBe(true);
  });

  it("GET /practices/:slug returns the practice without its secret", async () => {
    const res = await app.inject({ url: `/practices/${practice.slug}` });
    expect(res.json()).toEqual({ id: practice.id, slug: practice.slug, name: `Clinic ${practice.slug}` });
  });

  it("an unknown slug is 404 practice not found on every practice route", async () => {
    for (const [method, url, body] of [
      ["GET", "/practices/no-such-clinic"],
      ["GET", "/practices/no-such-clinic/board"],
      ["GET", "/practices/no-such-clinic/traces/abc"],
      ["PATCH", "/practices/no-such-clinic/leads/x/stage", { stage: "CONTACTED" }],
      ["PUT", "/practices/no-such-clinic/leads/x/value", { pounds: 1 }],
    ] as const) {
      const res = await app.inject({ method, url, payload: body });
      expect(res.statusCode, url).toBe(404);
      expect(res.json(), url).toEqual({ error: "practice not found" });
    }
  });
});

describe("GET /practices/:slug/board", () => {
  let ids: Record<string, string>;

  beforeAll(async () => {
    ids = {
      oldNew: (await seedLead(practice, "b-old-new", { receivedAt: daysAgo(30) })).id,
      oldContacted: (await seedLead(practice, "b-old-contacted", { stage: "CONTACTED", receivedAt: daysAgo(20), firstContactedAt: daysAgo(19) })).id,
      bookedRecent: (await seedLead(practice, "b-booked-recent", { stage: "CONSULT_BOOKED", receivedAt: daysAgo(3), consultBookedAt: daysAgo(2) })).id,
      bookedOld: (await seedLead(practice, "b-booked-old", { stage: "CONSULT_BOOKED", receivedAt: daysAgo(12), consultBookedAt: daysAgo(10) })).id,
      acceptedRecent: (await seedLead(practice, "b-accepted-recent", { stage: "TREATMENT_ACCEPTED", receivedAt: daysAgo(9), consultBookedAt: daysAgo(8), treatmentAcceptedAt: daysAgo(1) })).id,
      acceptedOld: (await seedLead(practice, "b-accepted-old", { stage: "TREATMENT_ACCEPTED", receivedAt: daysAgo(15), consultBookedAt: daysAgo(14), treatmentAcceptedAt: daysAgo(8) })).id,
      lost1: (await seedLead(practice, "b-lost-1", { stage: "LOST" })).id,
      lost2: (await seedLead(practice, "b-lost-2", { stage: "LOST", receivedAt: daysAgo(40) })).id,
      foreign: (await seedLead(other, "b-foreign")).id,
    };
  });

  it("shows open stages in full, closed stages from the last 7 days, newest first, and counts lost", async () => {
    const board = (await app.inject({ url: `/practices/${practice.slug}/board` })).json<Board>();
    expect(board.leads.map((l) => l.id)).toEqual([ids.bookedRecent, ids.acceptedRecent, ids.oldContacted, ids.oldNew]);
    expect(board.lostCount).toBe(2);
    expect(Array.isArray(board.deliveries)).toBe(true);
  });

  it("never includes another clinic's leads", async () => {
    const board = (await app.inject({ url: `/practices/${other.slug}/board` })).json<Board>();
    expect(board.leads.map((l) => l.id)).toEqual([ids.foreign]);
    expect(board.lostCount).toBe(0);
  });
});

describe("PATCH /practices/:slug/leads/:id/stage", () => {
  it("moves the lead, stamps first contact, and publishes lead.updated", async () => {
    const { id } = await seedLead(practice, "s-1");
    const received: StreamMessage[] = [];
    const unsubscribe = await subscribe(practice.id, (m) => received.push(m));

    const res = await app.inject({ method: "PATCH", url: `/practices/${practice.slug}/leads/${id}/stage`, payload: { stage: "CONTACTED" } });
    expect(res.statusCode).toBe(200);
    const card = res.json<LeadCard>();
    expect(card).toMatchObject({ id, stage: "CONTACTED" });
    expect(card.firstContactedAt).not.toBeNull();

    const pushed = await waitFor(() => received.find((m) => m.type === "lead.updated" && m.lead.id === id));
    unsubscribe();
    expect(pushed).toMatchObject({ type: "lead.updated", lead: { id, stage: "CONTACTED" } });
  });

  it("dragging back to NEW keeps the first-contact stamp", async () => {
    const { id } = await seedLead(practice, "s-2");
    const url = `/practices/${practice.slug}/leads/${id}/stage`;
    const contacted = (await app.inject({ method: "PATCH", url, payload: { stage: "CONTACTED" } })).json<LeadCard>();
    const back = (await app.inject({ method: "PATCH", url, payload: { stage: "NEW" } })).json<LeadCard>();
    expect(back.stage).toBe("NEW");
    expect(back.firstContactedAt).toBe(contacted.firstContactedAt);
  });

  it("an invalid stage is a 400 from the zod error handler and changes nothing", async () => {
    const { id } = await seedLead(practice, "s-3");
    const res = await app.inject({ method: "PATCH", url: `/practices/${practice.slug}/leads/${id}/stage`, payload: { stage: "WON" } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid body", issues: [expect.objectContaining({ path: ["stage"] })] });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id } })).stage).toBe("NEW");
  });

  it("a malformed JSON body is a 400, not a 500", async () => {
    const { id } = await seedLead(practice, "s-4");
    const res = await app.inject({
      method: "PATCH",
      url: `/practices/${practice.slug}/leads/${id}/stage`,
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
  });

  it("another clinic's lead id is 404 and the lead is untouched", async () => {
    const { id } = await seedLead(other, "s-foreign");
    const res = await app.inject({ method: "PATCH", url: `/practices/${practice.slug}/leads/${id}/stage`, payload: { stage: "LOST" } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "lead not found" });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id } })).stage).toBe("NEW");
  });
});

describe("PUT /practices/:slug/leads/:id/value", () => {
  const put = (slug: string, id: string, body: unknown) =>
    app.inject({ method: "PUT", url: `/practices/${slug}/leads/${id}/value`, payload: body as object });

  it("stores pounds as integer pence, rounding to the penny", async () => {
    const { id } = await seedLead(practice, "v-1");
    expect((await put(practice.slug, id, { pounds: 4250 })).json<LeadCard>().treatmentValuePence).toBe(425_000);
    expect((await put(practice.slug, id, { pounds: 19.99 })).json<LeadCard>().treatmentValuePence).toBe(1999);
    expect((await put(practice.slug, id, { pounds: 0.29 })).json<LeadCard>().treatmentValuePence).toBe(29);
    expect((await put(practice.slug, id, { pounds: 10.006 })).json<LeadCard>().treatmentValuePence).toBe(1001);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id } })).treatmentValuePence).toBe(1001);
  });

  it("null clears the value and publishes lead.updated", async () => {
    const { id } = await seedLead(practice, "v-2", { treatmentValuePence: 5000 });
    const received: StreamMessage[] = [];
    const unsubscribe = await subscribe(practice.id, (m) => received.push(m));
    const res = await put(practice.slug, id, { pounds: null });
    expect(res.statusCode).toBe(200);
    expect(res.json<LeadCard>().treatmentValuePence).toBeNull();
    const pushed = await waitFor(() => received.find((m) => m.type === "lead.updated" && m.lead.id === id));
    unsubscribe();
    expect(pushed).toMatchObject({ lead: { id, treatmentValuePence: null } });
  });

  it("out of range or non-numeric values are 400 and change nothing", async () => {
    const { id } = await seedLead(practice, "v-3", { treatmentValuePence: 5000 });
    for (const body of [{ pounds: -1 }, { pounds: 250_001 }, { pounds: "100" }, {}]) {
      const res = await put(practice.slug, id, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect((await prisma.lead.findUniqueOrThrow({ where: { id } })).treatmentValuePence).toBe(5000);
  });

  it("another clinic's lead id is 404 and the lead is untouched", async () => {
    const { id } = await seedLead(other, "v-foreign", { treatmentValuePence: 7000 });
    const res = await put(practice.slug, id, { pounds: 1 });
    expect(res.statusCode).toBe(404);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id } })).treatmentValuePence).toBe(7000);
  });
});

describe("x-request-id", () => {
  it("reuses a well-formed incoming id and echoes it", async () => {
    const res = await app.inject({ url: "/health", headers: { "x-request-id": "edge-proxy_1234" } });
    expect(res.headers["x-request-id"]).toBe("edge-proxy_1234");
  });

  it.each([
    ["too short", "abc"],
    ["contains spaces", "has spaces in it"],
    ["too long", "x".repeat(65)],
    ["log injection", "abcdefgh\\nINFO fake"],
  ])("replaces a malformed id (%s) with a UUID", async (_why, given) => {
    const res = await app.inject({ url: "/health", headers: { "x-request-id": given } });
    expect(res.headers["x-request-id"]).not.toBe(given);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("mints a UUID when none is sent, and echoes it on error responses too", async () => {
    const res = await app.inject({ url: "/practices/no-such-clinic" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("CORS", () => {
  it("allows the web origin and exposes x-request-id", async () => {
    const res = await app.inject({ url: "/practices", headers: { origin: "http://localhost:3000" } });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-expose-headers"]).toContain("x-request-id");
  });

  it("does not allow any other origin", async () => {
    // @fastify/cors with a fixed string origin always sends that string. A browser on another
    // origin compares it with its own and blocks the response, so the other origin is never allowed.
    const res = await app.inject({ url: "/practices", headers: { origin: "https://evil.example.com" } });
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("answers the PATCH preflight a drag sends", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: `/practices/${practice.slug}/leads/x/stage`,
      headers: { origin: "http://localhost:3000", "access-control-request-method": "PATCH" },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
  });
});

describe("error handler", () => {
  it("hides the message of an unexpected error behind a 500", async () => {
    const res = await app.inject({ url: "/test/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "internal error" });
  });

  it("passes through a 4xx error's own status and message", async () => {
    const res = await app.inject({ url: "/test/teapot" });
    expect(res.statusCode).toBe(418);
    expect(res.json()).toEqual({ error: "short and stout" });
  });
});

describe("webhook body handling", () => {
  it("verifies a signed body sent with no content-type header", async () => {
    const body = JSON.stringify(payload("ct-none"));
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/leads",
      headers: { [PRACTICE_HEADER]: practice.slug, [SIGNATURE_HEADER]: sign(practice.webhookSecret, body) },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ duplicate: false });
  });

  it("verifies a signed body sent as text/plain (the HMAC is over raw bytes, whatever the type)", async () => {
    const body = JSON.stringify(payload("ct-text"));
    const res = await postWebhook(app, practice, body, { "content-type": "text/plain" });
    expect(res.statusCode).toBe(200);
  });

  it("verifies against the exact bytes, including whitespace a re-serialise would drop", async () => {
    const body = JSON.stringify(payload("ct-pretty"), null, 2);
    expect((await postWebhook(app, practice, body)).statusCode).toBe(200);
  });

  it("a signed non-JSON body is 400 and logged as REJECTED with source unknown", async () => {
    const traceId = "nonjson-trace-0001";
    const res = await postWebhook(app, practice, "name=Amelia&message=hi", { "x-request-id": traceId });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "body is not JSON" });
    const delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { practiceId: practice.id, traceId } });
    expect(delivery).toMatchObject({ outcome: "REJECTED", source: "unknown", sourceLeadId: null, leadId: null });
  });

  it("a 401 leaves no delivery and no trace spans", async () => {
    const traceId = "unauth-trace-0001";
    const body = JSON.stringify(payload("unauth-1"));
    const res = await postWebhook(app, practice, body, { [SIGNATURE_HEADER]: "sha256=00", "x-request-id": traceId });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid signature" });
    expect(res.headers["x-request-id"]).toBe(traceId);
    expect(await prisma.webhookDelivery.count({ where: { traceId } })).toBe(0);
    expect(await prisma.traceSpan.count({ where: { traceId } })).toBe(0);
  });

  it("a missing signature or practice header is 401", async () => {
    const body = JSON.stringify(payload("unauth-2"));
    const noSig = await app.inject({ method: "POST", url: "/webhooks/leads", headers: { [PRACTICE_HEADER]: practice.slug }, payload: body });
    const noPractice = await app.inject({ method: "POST", url: "/webhooks/leads", headers: { [SIGNATURE_HEADER]: sign(practice.webhookSecret, body) }, payload: body });
    expect(noSig.statusCode).toBe(401);
    expect(noPractice.statusCode).toBe(401);
  });

  it("an invalid payload keeps its source and sourceLeadId on the REJECTED row", async () => {
    const res = await postWebhook(app, practice, JSON.stringify({ source: "GOOGLE_LEAD_FORM", sourceLeadId: "bad-1", name: "X" }));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid payload" });
    const delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { practiceId: practice.id, sourceLeadId: "bad-1" } });
    expect(delivery).toMatchObject({ outcome: "REJECTED", source: "GOOGLE_LEAD_FORM" });
  });

  it("JSON null is rejected as an invalid payload, not a crash", async () => {
    const res = await postWebhook(app, practice, "null");
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid payload" });
  });

  it("a webhook-created lead starts untriaged (PENDING) and stores contact details", async () => {
    const res = await postWebhook(app, practice, JSON.stringify(payload("pending-1")));
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: res.json<{ leadId: string }>().leadId } });
    expect(lead).toMatchObject({ triageStatus: "PENDING", stage: "NEW", phone: "07700 900123", email: "amelia@example.com", firstContactedAt: null });
  });
});

describe("auto-created campaigns", () => {
  const platformOf = async (sourceLeadId: string, p: Parameters<typeof payload>[1]) => {
    await ingestLead(practice.id, payload(sourceLeadId, p));
    const lead = await prisma.lead.findFirstOrThrow({ where: { practiceId: practice.id, sourceLeadId }, select: { campaign: true } });
    return lead.campaign?.platform;
  };

  it("maps utm_source and lead source to a platform", async () => {
    expect(await platformOf("pf-1", { utm: { source: "tiktok", campaign: "pf_tiktok" } })).toBe("TIKTOK");
    expect(await platformOf("pf-2", { source: "GOOGLE_LEAD_FORM", utm: { campaign: "pf_google_form" } })).toBe("GOOGLE");
    expect(await platformOf("pf-3", { source: "WEBSITE", utm: { source: "google", campaign: "pf_google_utm" } })).toBe("GOOGLE");
    expect(await platformOf("pf-4", { source: "WEBSITE", utm: { source: "instagram", campaign: "pf_other" } })).toBe("META");
    // utm_source wins over the lead source: a TikTok click that lands on a Google form is TikTok's lead.
    expect(await platformOf("pf-5", { source: "GOOGLE_LEAD_FORM", utm: { source: "tiktok", campaign: "pf_tiktok_on_google" } })).toBe("TIKTOK");
  });

  it("a lead with no utm_campaign gets no campaign", async () => {
    await ingestLead(practice.id, payload("pf-none", { utm: undefined }));
    const lead = await prisma.lead.findFirstOrThrow({ where: { practiceId: practice.id, sourceLeadId: "pf-none" } });
    expect(lead.campaignId).toBeNull();
  });

  it("the same utm_campaign in two clinics creates one campaign per clinic", async () => {
    await ingestLead(practice.id, payload("shared-a", { utm: { campaign: "shared_name" } }));
    await ingestLead(other.id, payload("shared-b", { utm: { campaign: "shared_name" } }));
    const campaigns = await prisma.campaign.findMany({ where: { utmCampaign: "shared_name", practiceId: { in: [practice.id, other.id] } } });
    expect(campaigns.map((c) => c.practiceId).sort()).toEqual([practice.id, other.id].sort());
    const leadB = await prisma.lead.findFirstOrThrow({ where: { practiceId: other.id, sourceLeadId: "shared-b" } });
    expect(campaigns.find((c) => c.id === leadB.campaignId)?.practiceId).toBe(other.id);
  });

  it("an existing campaign keeps its spend and platform", async () => {
    await prisma.campaign.create({ data: { practiceId: practice.id, utmCampaign: "paid_one", name: "Paid", platform: "GOOGLE", spendPence: 120_000 } });
    await ingestLead(practice.id, payload("paid-1", { utm: { source: "tiktok", campaign: "paid_one" } }));
    const campaign = await prisma.campaign.findFirstOrThrow({ where: { practiceId: practice.id, utmCampaign: "paid_one" } });
    expect(campaign).toMatchObject({ platform: "GOOGLE", spendPence: 120_000, name: "Paid" });
  });

  it("the same sourceLeadId from two different sources is two leads", async () => {
    const a = await ingestLead(practice.id, payload("cross-source", { source: "META_LEAD_ADS" }));
    const b = await ingestLead(practice.id, payload("cross-source", { source: "GOOGLE_LEAD_FORM" }));
    expect([a.outcome, b.outcome]).toEqual(["CREATED", "CREATED"]);
    expect(a.leadId).not.toBe(b.leadId);
  });

  it("the same sourceLeadId in two clinics is two leads", async () => {
    const a = await ingestLead(practice.id, payload("cross-clinic"));
    const b = await ingestLead(other.id, payload("cross-clinic"));
    expect([a.outcome, b.outcome]).toEqual(["CREATED", "CREATED"]);
  });
});

describe("GET /practices/:slug/traces/:traceId", () => {
  it("returns spans with delivery null when no delivery row carries the trace id", async () => {
    await prisma.traceSpan.create({ data: { practiceId: practice.id, traceId: "orphan-trace-0001", name: "SSE push · lead.updated", offsetMs: 1 } });
    const res = await app.inject({ url: `/practices/${practice.slug}/traces/orphan-trace-0001` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ traceId: "orphan-trace-0001", delivery: null, spans: [{ name: "SSE push · lead.updated" }] });
  });

  it("an unknown trace id is 404", async () => {
    const res = await app.inject({ url: `/practices/${practice.slug}/traces/never-seen-0001` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "trace not found" });
  });
});
