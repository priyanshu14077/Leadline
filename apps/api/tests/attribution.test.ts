import type { Attribution } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub } from "../src/events";
import { ingestLead } from "../src/ingest";
import { createPractice, deletePractices, payload, type TestPractice } from "./helpers";

let practice: TestPractice;
let other: TestPractice;
let app: FastifyInstance;

const move = (id: string, stage: string) =>
  app.inject({ method: "PATCH", url: `/practices/${practice.slug}/leads/${id}/stage`, payload: { stage } });
const value = (id: string, pounds: number) =>
  app.inject({ method: "PUT", url: `/practices/${practice.slug}/leads/${id}/value`, payload: { pounds } });
const get = (p = practice) => app.inject({ url: `/practices/${p.slug}/attribution` }).then((r) => r.json<Attribution>());

beforeAll(async () => {
  app = await buildApp();
  practice = await createPractice("attribution-test");
  other = await createPractice("attribution-other");

  // "good": £100 spend, 3 leads → 2 booked (one later lost) → 1 accepted at £2,500.
  // "bad": £300 spend, 2 leads, none booked. "empty": £50 spend, no leads yet.
  const lead = async (id: string, campaign?: string) =>
    (await ingestLead(practice.id, payload(id, { utm: campaign ? { source: "facebook", campaign } : undefined }))).leadId;
  const [g1, g2, g3] = [await lead("g1", "good"), await lead("g2", "good"), await lead("g3", "good")];
  await lead("b1", "bad");
  await lead("b2", "bad");
  await lead("none-1");
  await prisma.campaign.create({ data: { practiceId: practice.id, utmCampaign: "empty", name: "empty", platform: "META" } });
  await prisma.campaign.updateMany({ where: { practiceId: practice.id, utmCampaign: "good" }, data: { spendPence: 10_000 } });
  await prisma.campaign.updateMany({ where: { practiceId: practice.id, utmCampaign: "bad" }, data: { spendPence: 30_000 } });
  await prisma.campaign.updateMany({ where: { practiceId: practice.id, utmCampaign: "empty" }, data: { spendPence: 5_000 } });

  await move(g1, "TREATMENT_ACCEPTED");
  await value(g1, 2500);
  await move(g2, "CONSULT_BOOKED");
  await move(g2, "LOST");
  await move(g3, "CONTACTED");

  // Another clinic's accepted lead on a campaign with the same utm must not leak in.
  const { leadId } = await ingestLead(other.id, payload("o1", { utm: { campaign: "good" } }));
  await prisma.lead.update({ where: { id: leadId }, data: { stage: "TREATMENT_ACCEPTED", treatmentAcceptedAt: new Date(), treatmentValuePence: 999_999 } });
});

afterAll(async () => {
  await deletePractices(practice, other);
  await app.close();
  await closeHub();
});

describe("GET /practices/:slug/attribution", () => {
  it("counts each campaign's funnel from first-reached stages and works out the money", async () => {
    const { campaigns } = await get();
    const good = campaigns.find((c) => c.utmCampaign === "good");
    expect(good).toMatchObject({
      spendPence: 10_000,
      leads: 3,
      contacted: 3,
      consultsBooked: 2, // the booked-then-lost lead still counts: it did book
      treatmentsAccepted: 1,
      revenuePence: 250_000,
      acceptedWithoutValue: 0,
      costPerConsultPence: 5_000,
      valuePerPound: 25,
    });
    expect(good!.costPerLeadPence).toBeCloseTo(3333.33, 1);
  });

  it("shows a campaign that books nothing, and one with no leads, without dividing by zero", async () => {
    const { campaigns } = await get();
    expect(campaigns.find((c) => c.utmCampaign === "bad")).toMatchObject({
      leads: 2,
      consultsBooked: 0,
      revenuePence: 0,
      costPerLeadPence: 15_000,
      costPerConsultPence: null,
      valuePerPound: 0,
    });
    expect(campaigns.find((c) => c.utmCampaign === "empty")).toMatchObject({ leads: 0, costPerLeadPence: null, costPerConsultPence: null });
  });

  it("ranks campaigns by revenue and totals across them", async () => {
    const { campaigns, totals, unattributedLeads } = await get();
    expect(campaigns[0].utmCampaign).toBe("good");
    expect(totals).toMatchObject({ spendPence: 45_000, leads: 5, consultsBooked: 2, revenuePence: 250_000, costPerConsultPence: 22_500 });
    expect(totals.valuePerPound).toBeCloseTo(250_000 / 45_000);
    expect(unattributedLeads).toBe(1);
  });

  it("flags accepted plans that have no value yet", async () => {
    const { leadId } = await ingestLead(practice.id, payload("g4", { utm: { campaign: "good" } }));
    await move(leadId, "TREATMENT_ACCEPTED");
    const good = (await get()).campaigns.find((c) => c.utmCampaign === "good");
    expect(good).toMatchObject({ treatmentsAccepted: 2, acceptedWithoutValue: 1, revenuePence: 250_000 });
  });

  it("keeps each clinic's numbers apart", async () => {
    const { campaigns, totals } = await get(other);
    expect(campaigns).toHaveLength(1);
    expect(totals.revenuePence).toBe(999_999);
    expect((await get()).totals.revenuePence).toBe(250_000);
  });
});
