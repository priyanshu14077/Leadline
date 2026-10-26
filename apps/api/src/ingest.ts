import type { LeadPayload } from "@leadline/shared";
import type { LeadSource, Platform } from "./generated/prisma/client";
import { publish } from "./events";
import { forPractice, type TenantDb } from "./tenant";
import { NO_TRACE, type Tracer } from "./trace";

export type IngestResult = { outcome: "CREATED" | "DUPLICATE"; leadId: string };

function platformFor(source: LeadSource, utmSource?: string): Platform {
  if (utmSource === "tiktok") return "TIKTOK";
  if (source === "GOOGLE_LEAD_FORM" || utmSource === "google") return "GOOGLE";
  return "META";
}

// Unknown UTMs become a £0-spend campaign so new campaigns show up in attribution straight away.
async function ensureCampaign(db: TenantDb, practiceId: string, payload: LeadPayload) {
  const utmCampaign = payload.utm?.campaign;
  if (!utmCampaign) return null;
  // Concurrent first leads of a new campaign race here; skipDuplicates makes the loser a no-op.
  await db.campaign.createMany({
    data: [{ practiceId, utmCampaign, name: utmCampaign, platform: platformFor(payload.source, payload.utm?.source) }],
    skipDuplicates: true,
  });
  const campaign = await db.campaign.findFirstOrThrow({ where: { utmCampaign }, select: { id: true } });
  return campaign.id;
}

/**
 * Idempotent on (practiceId, source, sourceLeadId): the unique constraint decides, not app code,
 * so concurrent retries cannot both insert. First write wins; a duplicate never overwrites.
 */
export async function ingestLead(practiceId: string, payload: LeadPayload, trace: Tracer = NO_TRACE): Promise<IngestResult> {
  const db = forPractice(practiceId);
  const campaignId = await trace.time(
    "campaign resolved",
    () => ensureCampaign(db, practiceId, payload),
    () => payload.utm?.campaign ?? "no utm_campaign",
  );

  // One transaction for the lead, its delivery row and the NOTIFYs. Postgres delivers a NOTIFY only
  // at commit, so the board can never hear about a lead that isn't there, and a crash mid-way leaves
  // nothing behind: the platform's retry then lands as a fresh CREATED instead of a silent DUPLICATE.
  // A concurrent retry's insert waits on our row lock and sees our commit, so the unique key still decides.
  const { lead, outcome } = await db.$transaction(async (tx) => {
    const [created] = await trace.time(
      "lead insert · ON CONFLICT DO NOTHING",
      () =>
        tx.lead.createManyAndReturn({
          data: [
            {
              practiceId,
              source: payload.source,
              sourceLeadId: payload.sourceLeadId,
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              message: payload.message,
              utmSource: payload.utm?.source,
              utmCampaign: payload.utm?.campaign,
              campaignId,
            },
          ],
          skipDuplicates: true,
          select: { id: true },
        }),
      (rows) => (rows.length ? "inserted: new lead" : "0 rows: already have this sourceLeadId"),
    );

    const lead =
      created ??
      (await trace.time("existing lead looked up", () =>
        tx.lead.findUniqueOrThrow({
          where: {
            practiceId_source_sourceLeadId: { practiceId, source: payload.source, sourceLeadId: payload.sourceLeadId },
          },
          select: { id: true },
        }),
      ));
    const outcome = created ? ("CREATED" as const) : ("DUPLICATE" as const);

    const delivery = await trace.time("delivery logged", () =>
      tx.webhookDelivery.create({
        data: { practiceId, source: payload.source, sourceLeadId: payload.sourceLeadId, outcome, leadId: lead.id, traceId: trace.traceId },
        select: { id: true },
      }),
    );

    const ctx = { traceId: trace.traceId, startedAt: trace.startedAt };
    await trace.time(
      "NOTIFY lead_events (sent at commit)",
      async () => {
        if (created) await publish({ type: "lead.created", practiceId, leadId: lead.id, ...ctx }, tx);
        await publish({ type: "delivery.logged", practiceId, deliveryId: delivery.id, ...ctx }, tx);
      },
      () => (created ? "lead.created + delivery.logged" : "delivery.logged only"),
    );
    return { lead, outcome };
  });
  trace.mark("transaction committed", "lead, delivery and events are now visible together");

  return { outcome, leadId: lead.id };
}

/** Logs a request that authenticated but failed validation, so bad senders are visible. */
export async function logRejected(practiceId: string, source: string, sourceLeadId: string | undefined, trace: Tracer = NO_TRACE) {
  await forPractice(practiceId).$transaction(async (tx) => {
    const delivery = await tx.webhookDelivery.create({
      data: { practiceId, source, sourceLeadId, outcome: "REJECTED", traceId: trace.traceId },
      select: { id: true },
    });
    await publish({ type: "delivery.logged", practiceId, deliveryId: delivery.id, traceId: trace.traceId, startedAt: trace.startedAt }, tx);
  });
}
