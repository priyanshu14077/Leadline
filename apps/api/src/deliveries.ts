import type { DeliveryRow } from "@leadline/shared";
import type { TenantDb } from "./tenant";

export async function recentDeliveries(db: TenantDb, opts: { take?: number; id?: string } = {}): Promise<DeliveryRow[]> {
  const rows = await db.webhookDelivery.findMany({
    where: opts.id ? { id: opts.id } : undefined,
    orderBy: { receivedAt: "desc" },
    take: opts.take ?? 30,
  });
  const leadIds = [...new Set(rows.map((r) => r.leadId).filter((id): id is string => !!id))];
  const leads = leadIds.length
    ? await db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(leads.map((l) => [l.id, l.name]));
  return rows.map((r) => ({
    id: r.id,
    traceId: r.traceId,
    source: r.source,
    sourceLeadId: r.sourceLeadId,
    outcome: r.outcome,
    receivedAt: r.receivedAt.toISOString(),
    leadName: r.leadId ? (names.get(r.leadId) ?? null) : null,
  }));
}
