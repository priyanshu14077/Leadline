import type { LeadPayload, Trace } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub, subscribe } from "../src/events";
import { ingestLead } from "../src/ingest";
import { PRACTICE_HEADER, SIGNATURE_HEADER, sign } from "../src/signature";

const SECRET = "whsec_ingest_test";
let practice: { id: string; slug: string };
let other: { id: string; slug: string };
let app: FastifyInstance;

const payload = (sourceLeadId: string, campaign = "invisalign_test"): LeadPayload => ({
  source: "META_LEAD_ADS",
  sourceLeadId,
  name: "Amelia Hart",
  email: "amelia@example.com",
  message: "How much is Invisalign?",
  utm: { source: "facebook", campaign },
});

function post(body: string, signature = sign(SECRET, body), slug = practice.slug, headers: Record<string, string> = {}) {
  return app.inject({
    method: "POST",
    url: "/webhooks/leads",
    headers: { [PRACTICE_HEADER]: slug, [SIGNATURE_HEADER]: signature, "content-type": "application/json", ...headers },
    payload: body,
  });
}

beforeAll(async () => {
  app = await buildApp();
  practice = await prisma.practice.create({ data: { slug: "ingest-test", name: "Ingest Clinic", webhookSecret: SECRET } });
  other = await prisma.practice.create({ data: { slug: "ingest-other", name: "Other Clinic", webhookSecret: "whsec_other" } });
});

afterAll(async () => {
  await prisma.practice.deleteMany({ where: { id: { in: [practice.id, other.id] } } });
  await app.close();
  await closeHub();
  await prisma.$disconnect();
});

describe("ingestLead", () => {
  it("three concurrent retries of one lead create exactly one row and log three deliveries", async () => {
    const results = await Promise.all([1, 2, 3].map(() => ingestLead(practice.id, payload("retry-1"))));

    expect(results.filter((r) => r.outcome === "CREATED")).toHaveLength(1);
    expect(new Set(results.map((r) => r.leadId)).size).toBe(1);
    expect(await prisma.lead.count({ where: { practiceId: practice.id, sourceLeadId: "retry-1" } })).toBe(1);
    const outcomes = await prisma.webhookDelivery.groupBy({
      by: ["outcome"],
      where: { practiceId: practice.id, sourceLeadId: "retry-1" },
      _count: true,
    });
    expect(Object.fromEntries(outcomes.map((o) => [o.outcome, o._count]))).toEqual({ CREATED: 1, DUPLICATE: 2 });
  });

  it("a retry with changed fields never overwrites the stored lead", async () => {
    await ingestLead(practice.id, payload("retry-2"));
    await ingestLead(practice.id, { ...payload("retry-2"), name: "Someone Else" });
    const lead = await prisma.lead.findFirstOrThrow({ where: { practiceId: practice.id, sourceLeadId: "retry-2" } });
    expect(lead.name).toBe("Amelia Hart");
  });

  it("an unseen utm_campaign creates one £0 campaign, even under concurrency", async () => {
    await Promise.all(["n-1", "n-2", "n-3"].map((id) => ingestLead(practice.id, payload(id, "brand_new_campaign"))));
    const campaigns = await prisma.campaign.findMany({ where: { practiceId: practice.id, utmCampaign: "brand_new_campaign" } });
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]).toMatchObject({ spendPence: 0, platform: "META" });
    expect(await prisma.lead.count({ where: { campaignId: campaigns[0].id } })).toBe(3);
  });
});

describe("POST /webhooks/leads", () => {
  it("accepts a signed lead, then answers a duplicate with 200 and duplicate: true", async () => {
    const body = JSON.stringify(payload("route-1"));
    const first = await post(body);
    const second = await post(body);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ duplicate: false });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ duplicate: true });
  });

  it("rejects a bad signature, an unknown practice and a tampered body with 401, writing nothing", async () => {
    const body = JSON.stringify(payload("route-2"));
    expect((await post(body, "sha256=deadbeef")).statusCode).toBe(401);
    expect((await post(body, sign(SECRET, body), "no-such-clinic")).statusCode).toBe(401);
    const tampered = body.replace("Amelia", "Mallory");
    expect((await post(tampered, sign(SECRET, body))).statusCode).toBe(401);
    expect(await prisma.webhookDelivery.count({ where: { sourceLeadId: "route-2" } })).toBe(0);
  });

  it("logs a signed but invalid payload as REJECTED with 400", async () => {
    const body = JSON.stringify({ source: "META_LEAD_ADS", sourceLeadId: "route-3", name: "" });
    const res = await post(body);
    expect(res.statusCode).toBe(400);
    const delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { sourceLeadId: "route-3" } });
    expect(delivery.outcome).toBe("REJECTED");
  });
});

describe("tracing", () => {
  it("reuses the caller's x-request-id as the trace id across response, delivery row and spans", async () => {
    const traceId = "test-trace-0001";
    // An open stream for this practice, so the NOTIFY hop does the load-and-push path.
    const received: string[] = [];
    const unsubscribe = await subscribe(practice.id, (msg) => received.push(msg.type));

    const res = await post(JSON.stringify(payload("trace-1")), undefined, undefined, { "x-request-id": traceId });
    expect(res.headers["x-request-id"]).toBe(traceId);
    expect(res.json()).toMatchObject({ traceId });
    expect((await prisma.webhookDelivery.findFirstOrThrow({ where: { sourceLeadId: "trace-1" } })).traceId).toBe(traceId);

    // Spans from the LISTEN hub are written asynchronously after NOTIFY; wait for the push span.
    let trace: Trace | undefined;
    for (let i = 0; i < 50 && !trace?.spans.some((s) => s.name.startsWith("SSE push · lead.created")); i++) {
      await new Promise((r) => setTimeout(r, 50));
      const res = await app.inject({ url: `/practices/${practice.slug}/traces/${traceId}` });
      trace = res.statusCode === 200 ? res.json<Trace>() : undefined;
    }
    unsubscribe();

    const names = trace!.spans.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "request received",
        "signature verified",
        "lead insert · ON CONFLICT DO NOTHING",
        "NOTIFY lead_events (sent at commit)",
        "transaction committed",
        "response sent",
        "NOTIFY received · lead.created",
        "SSE push · lead.created",
      ]),
    );
    expect(trace!.delivery).toMatchObject({ outcome: "CREATED", leadName: "Amelia Hart" });
    expect(received).toEqual(expect.arrayContaining(["lead.created", "delivery.logged"]));
  });

  it("does not show one clinic's trace to another", async () => {
    const res = await app.inject({ url: `/practices/${other.slug}/traces/test-trace-0001` });
    expect(res.statusCode).toBe(404);
  });
});
