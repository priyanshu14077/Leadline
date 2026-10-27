import type { Attribution, CampaignAttribution, Platform } from "@leadline/shared";
import { prisma } from "./db";

type Row = {
  campaignId: string;
  name: string;
  platform: Platform;
  utmCampaign: string;
  spendPence: number;
  leads: bigint;
  contacted: bigint;
  consultsBooked: bigint;
  treatmentsAccepted: bigint;
  revenuePence: bigint;
  acceptedWithoutValue: bigint;
};

type Counts = Omit<CampaignAttribution, "campaignId" | "name" | "platform" | "utmCampaign" | "costPerLeadPence" | "costPerConsultPence" | "valuePerPound">;

const ratio = (a: number, b: number) => (b ? a / b : null);

function withRatios<T extends Counts>(c: T) {
  return {
    ...c,
    costPerLeadPence: ratio(c.spendPence, c.leads),
    costPerConsultPence: ratio(c.spendPence, c.consultsBooked),
    valuePerPound: ratio(c.revenuePence, c.spendPence),
  };
}

/**
 * Each campaign's funnel, counted from the first-reached stage timestamps, so a lead that was
 * booked and later lost still counts as a booked consult. One query: a campaign with no leads
 * still shows, with its spend. Raw SQL isn't tenant-scoped by forPractice, so practiceId is explicit.
 */
export async function attribution(practiceId: string): Promise<Attribution> {
  const [rows, [{ unattributed }]] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT c.id AS "campaignId", c.name, c.platform::text AS platform, c."utmCampaign", c."spendPence",
        count(l.id) AS leads,
        count(l."firstContactedAt") AS contacted,
        count(l."consultBookedAt") AS "consultsBooked",
        count(l."treatmentAcceptedAt") AS "treatmentsAccepted",
        coalesce(sum(l."treatmentValuePence") FILTER (WHERE l."treatmentAcceptedAt" IS NOT NULL), 0) AS "revenuePence",
        count(l.id) FILTER (WHERE l."treatmentAcceptedAt" IS NOT NULL AND l."treatmentValuePence" IS NULL) AS "acceptedWithoutValue"
      FROM "Campaign" c
      LEFT JOIN "Lead" l ON l."campaignId" = c.id AND l."practiceId" = c."practiceId"
      WHERE c."practiceId" = ${practiceId}
      GROUP BY c.id
      ORDER BY "revenuePence" DESC, c."spendPence" DESC, c.name`,
    prisma.$queryRaw<[{ unattributed: bigint }]>`
      SELECT count(*) AS unattributed FROM "Lead" WHERE "practiceId" = ${practiceId} AND "campaignId" IS NULL`,
  ]);

  const campaigns = rows.map((r) =>
    withRatios({
      ...r,
      leads: Number(r.leads),
      contacted: Number(r.contacted),
      consultsBooked: Number(r.consultsBooked),
      treatmentsAccepted: Number(r.treatmentsAccepted),
      revenuePence: Number(r.revenuePence),
      acceptedWithoutValue: Number(r.acceptedWithoutValue),
    }),
  );
  const sum = (k: keyof Counts) => campaigns.reduce((n, c) => n + c[k], 0);
  const totals = withRatios({
    spendPence: sum("spendPence"),
    leads: sum("leads"),
    contacted: sum("contacted"),
    consultsBooked: sum("consultsBooked"),
    treatmentsAccepted: sum("treatmentsAccepted"),
    revenuePence: sum("revenuePence"),
    acceptedWithoutValue: sum("acceptedWithoutValue"),
  });
  return { campaigns, totals, unattributedLeads: Number(unattributed) };
}
