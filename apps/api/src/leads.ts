import type { LeadCard } from "@leadline/shared";
import type { Prisma, Stage } from "./generated/prisma/client";
import type { TenantDb } from "./tenant";

// Everything a card and the drawer render. Used by the board endpoint and the SSE stream so they can't drift.
export const leadCardSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  source: true,
  utmCampaign: true,
  campaign: { select: { name: true, platform: true } },
  stage: true,
  receivedAt: true,
  firstContactedAt: true,
  consultBookedAt: true,
  treatmentAcceptedAt: true,
  treatmentValuePence: true,
  triageStatus: true,
  treatmentInterest: true,
  urgency: true,
  objections: true,
  triageOpener: true,
} satisfies Prisma.LeadSelect;

type LeadCardRow = Prisma.LeadGetPayload<{ select: typeof leadCardSelect }>;

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toLeadCard(row: LeadCardRow): LeadCard {
  return {
    ...row,
    receivedAt: row.receivedAt.toISOString(),
    firstContactedAt: iso(row.firstContactedAt),
    consultBookedAt: iso(row.consultBookedAt),
    treatmentAcceptedAt: iso(row.treatmentAcceptedAt),
  };
}

const CLOSED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Work queue (New, Contacted) in full; booked and accepted only from the last 7 days. */
export async function boardLeads(db: TenantDb) {
  const since = new Date(Date.now() - CLOSED_WINDOW_MS);
  const [rows, lostCount] = await Promise.all([
    db.lead.findMany({
      where: {
        OR: [
          { stage: { in: ["NEW", "CONTACTED"] } },
          { stage: "CONSULT_BOOKED", consultBookedAt: { gte: since } },
          { stage: "TREATMENT_ACCEPTED", treatmentAcceptedAt: { gte: since } },
        ],
      },
      select: leadCardSelect,
      orderBy: { receivedAt: "desc" },
    }),
    db.lead.count({ where: { stage: "LOST" } }),
  ]);
  return { leads: rows.map(toLeadCard), lostCount };
}

export async function getLeadCard(db: TenantDb, id: string) {
  const row = await db.lead.findUnique({ where: { id }, select: leadCardSelect });
  return row && toLeadCard(row);
}

/**
 * Any move is allowed, including backwards. Each stage's timestamp records the first time it was
 * reached and is never cleared, so dragging back to New can't reset speed-to-lead.
 */
export function stageTimestamps(
  lead: { firstContactedAt: Date | null; consultBookedAt: Date | null; treatmentAcceptedAt: Date | null },
  to: Stage,
  now = new Date(),
): Prisma.LeadUpdateInput {
  const data: Prisma.LeadUpdateInput = { stage: to };
  // Lost is excluded: binning spam unread is not contact, and would flatter speed-to-lead.
  if (to !== "NEW" && to !== "LOST" && !lead.firstContactedAt) data.firstContactedAt = now;
  if ((to === "CONSULT_BOOKED" || to === "TREATMENT_ACCEPTED") && !lead.consultBookedAt) data.consultBookedAt = now;
  if (to === "TREATMENT_ACCEPTED" && !lead.treatmentAcceptedAt) data.treatmentAcceptedAt = now;
  return data;
}
