import type { DemoLeadResult } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub } from "../src/events";
import { createPractice, deletePractices, type TestPractice } from "./helpers";

let practice: TestPractice;
let app: FastifyInstance;

const send = (body: object) => app.inject({ method: "POST", url: "/demo/leads", payload: { practice: practice.slug, ...body } });

beforeAll(async () => {
  app = await buildApp({ demo: true });
  practice = await createPractice("demo-test");
});

afterAll(async () => {
  await deletePractices(practice);
  await app.close();
  await closeHub();
});

describe("POST /demo/leads", () => {
  it("signs the form and sends it through the real webhook", async () => {
    const res = await send({ name: "Freya Lowe", email: "freya@example.com", message: "Do you do whitening?", campaign: "whitening_spring" });
    expect(res.statusCode).toBe(200);
    const { leadId, deliveries } = res.json<DemoLeadResult>();
    expect(deliveries).toHaveLength(1);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { campaign: true } });
    expect(lead).toMatchObject({ practiceId: practice.id, source: "META_LEAD_ADS", name: "Freya Lowe", utmCampaign: "whitening_spring" });
    expect(lead.sourceLeadId).toMatch(/^demo_/);
    // It went through the webhook route: a delivery row with a trace.
    const delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { leadId } });
    expect(delivery).toMatchObject({ outcome: "CREATED", traceId: deliveries[0].traceId });
  });

  it("plays a platform retrying: 3 deliveries of one signed lead make 1 lead", async () => {
    const { leadId, deliveries } = (await send({ name: "Leo Grant", message: "Chipped my tooth, can bonding fix it?", deliveries: 3 })).json<DemoLeadResult>();
    expect(deliveries.filter((d) => !d.duplicate)).toHaveLength(1);
    expect(new Set(deliveries.map((d) => d.traceId)).size).toBe(3);
    expect(await prisma.lead.count({ where: { practiceId: practice.id, name: "Leo Grant" } })).toBe(1);
    expect(await prisma.webhookDelivery.count({ where: { leadId } })).toBe(3);
  });

  it("rejects an unknown clinic and a bad form without writing anything", async () => {
    expect((await app.inject({ method: "POST", url: "/demo/leads", payload: { practice: "nope", name: "A", message: "B" } })).statusCode).toBe(404);
    expect((await send({ name: "", message: "B" })).statusCode).toBe(400);
    expect((await send({ name: "A", message: "B", deliveries: 50 })).statusCode).toBe(400);
    expect(await prisma.webhookDelivery.count({ where: { practiceId: practice.id, outcome: "REJECTED" } })).toBe(0);
  });

  it("doesn't exist when demo routes are off", async () => {
    const prod = await buildApp({ demo: false });
    expect((await prod.inject({ method: "POST", url: "/demo/leads", payload: {} })).statusCode).toBe(404);
    await prod.close();
  });
});
