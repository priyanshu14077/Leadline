import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { forPractice } from "../src/tenant";
import { createPractice, deletePractices, type TestPractice } from "./helpers";

// The operations tenancy.test.ts doesn't cover: delete, upsert, findFirst, aggregate, and the
// models other than Lead.
let a: TestPractice;
let b: TestPractice;

const lead = (practiceId: string, sourceLeadId: string) => ({
  practiceId,
  source: "WEBSITE" as const,
  sourceLeadId,
  name: "Test Patient",
  message: "Whitening?",
  treatmentValuePence: 1000,
});

beforeAll(async () => {
  a = await createPractice("tenancy-ops-a");
  b = await createPractice("tenancy-ops-b");
});

afterAll(async () => {
  await deletePractices(a, b);
  await prisma.$disconnect();
});

describe("forPractice, remaining operations", () => {
  it("delete by another clinic's id fails as not found and deletes nothing", async () => {
    const foreign = await prisma.lead.create({ data: lead(b.id, "del-1") });
    await expect(forPractice(a.id).lead.delete({ where: { id: foreign.id } })).rejects.toMatchObject({ code: "P2025" });
    expect(await prisma.lead.findUnique({ where: { id: foreign.id } })).not.toBeNull();
  });

  it("upsert on another clinic's unique key creates in the scoped clinic and leaves the other alone", async () => {
    const key = { practiceId: b.id, source: "WEBSITE" as const, sourceLeadId: "ups-1" };
    await prisma.lead.create({ data: lead(b.id, "ups-1") });
    const row = await forPractice(a.id).lead.upsert({
      where: { practiceId_source_sourceLeadId: key },
      create: lead(b.id, "ups-1"),
      update: { name: "Hijacked" },
    });
    expect(row.practiceId).toBe(a.id);
    expect((await prisma.lead.findFirstOrThrow({ where: key })).name).toBe("Test Patient");
  });

  it("findFirst and aggregate only see the scoped clinic", async () => {
    await prisma.lead.create({ data: lead(b.id, "agg-b") });
    expect(await forPractice(a.id).lead.findFirst({ where: { sourceLeadId: "agg-b" } })).toBeNull();
    const before = await forPractice(a.id).lead.aggregate({ _sum: { treatmentValuePence: true } });
    await prisma.lead.create({ data: lead(b.id, "agg-b2") });
    const after = await forPractice(a.id).lead.aggregate({ _sum: { treatmentValuePence: true } });
    expect(after._sum.treatmentValuePence).toBe(before._sum.treatmentValuePence);
  });

  it("scopes Campaign, WebhookDelivery and TraceSpan too", async () => {
    await prisma.campaign.create({ data: { practiceId: b.id, utmCampaign: "b_only", name: "B", platform: "META" } });
    await prisma.webhookDelivery.create({ data: { practiceId: b.id, source: "WEBSITE", outcome: "REJECTED", traceId: "b-trace" } });
    await prisma.traceSpan.create({ data: { practiceId: b.id, traceId: "b-trace", name: "x", offsetMs: 0 } });
    const db = forPractice(a.id);
    expect(await db.campaign.findMany({ where: { utmCampaign: "b_only" } })).toEqual([]);
    expect(await db.webhookDelivery.findMany({ where: { traceId: "b-trace" } })).toEqual([]);
    expect(await db.traceSpan.findMany({ where: { traceId: "b-trace" } })).toEqual([]);
  });

  it("leaves Practice itself unscoped (it is the tenant, not tenant data)", async () => {
    const slugs = (await forPractice(a.id).practice.findMany({ where: { id: { in: [a.id, b.id] } } })).map((p) => p.slug);
    expect(slugs.sort()).toEqual([a.slug, b.slug].sort());
  });
});
