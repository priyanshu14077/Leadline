import type { DeliveryRow } from "@leadline/shared";

/** All deliveries of one platform lead id: the retries that the unique key folded into one lead. */
export type DeliveryGroup = {
  key: string;
  name: string | null;
  sourceLeadId: string | null;
  /** Oldest first, so "Created" reads before its duplicates. */
  rows: DeliveryRow[];
  latestAt: string;
  created: number;
  duplicates: number;
  rejected: number;
};

/** Groups by (source, sourceLeadId), ordered by latest activity. Rows without a lead id stand alone. */
export function groupDeliveries(rows: DeliveryRow[]): DeliveryGroup[] {
  const groups = new Map<string, DeliveryGroup>();
  for (const row of rows) {
    const key = row.sourceLeadId ? `${row.source}:${row.sourceLeadId}` : `row:${row.id}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, name: null, sourceLeadId: row.sourceLeadId, rows: [], latestAt: row.receivedAt, created: 0, duplicates: 0, rejected: 0 };
      groups.set(key, g);
    }
    g.rows.push(row);
    g.name ??= row.leadName;
    if (row.receivedAt > g.latestAt) g.latestAt = row.receivedAt;
    if (row.outcome === "CREATED") g.created++;
    else if (row.outcome === "DUPLICATE") g.duplicates++;
    else g.rejected++;
  }
  for (const g of groups.values()) g.rows.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return [...groups.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

/** "3 deliveries → 1 lead", "2 retries → existing lead", "Rejected". */
export function groupSummary(g: DeliveryGroup) {
  const n = g.rows.length;
  if (g.rejected === n) return n === 1 ? "Rejected" : `${n} rejected`;
  if (n === 1) return g.created ? "1 delivery → 1 lead" : "Retry of an earlier lead";
  if (g.created) return `${n} deliveries → 1 lead`;
  return `${n} retries → existing lead`;
}
