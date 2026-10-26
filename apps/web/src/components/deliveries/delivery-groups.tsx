"use client";

import type { DeliveryRow } from "@leadline/shared";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { groupSummary, type DeliveryGroup } from "@/components/deliveries/group";
import { OutcomeStamp } from "@/components/deliveries/outcome-stamp";
import { formatClock, sourceLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type RowAction = { kind: "link"; href: (traceId: string) => string } | { kind: "button"; onOpen: (row: DeliveryRow) => void };

/**
 * Deliveries as tracked items: one entry per platform lead, its attempts listed oldest first under a
 * line that says what the unique key did with them ("3 deliveries → 1 lead").
 */
export function DeliveryGroups({
  groups,
  freshIds,
  action,
  dense,
}: {
  groups: DeliveryGroup[];
  freshIds?: Set<string>;
  action: RowAction;
  dense?: boolean;
}) {
  return (
    <ol className="divide-y">
      {groups.map((g) => {
        const merged = g.rows.length > 1;
        const fresh = g.rows.some((r) => freshIds?.has(r.id));
        return (
          <li key={g.key} className={cn("px-4", dense ? "py-2.5" : "py-3.5", fresh && "motion-arrive bg-brand-soft/50")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold">
                {g.name ?? <span className="font-mono text-xs font-normal text-muted-foreground">{g.sourceLeadId ?? "No lead id"}</span>}
              </p>
              <p className={cn("shrink-0 text-xs", merged && g.created ? "font-medium text-foreground" : "text-muted-foreground")}>
                {groupSummary(g)}
              </p>
            </div>
            <ol className={cn("relative mt-1.5", merged && "before:absolute before:top-3 before:bottom-3 before:left-[4px] before:w-px before:bg-border")}>
              {g.rows.map((r) => (
                <li key={r.id} className="relative">
                  <DeliveryLine row={r} action={action} merged={merged} />
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

function DeliveryLine({ row, action, merged }: { row: DeliveryRow; action: RowAction; merged: boolean }) {
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "relative z-10 size-[9px] shrink-0 rounded-full border-[1.5px] bg-card",
          row.outcome === "CREATED" ? "border-brand bg-brand" : row.outcome === "DUPLICATE" ? "border-brand" : "border-foreground/50",
        )}
      />
      <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatClock(row.receivedAt)}</span>
      <OutcomeStamp outcome={row.outcome} />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{merged ? null : sourceLabel(row.source)}</span>
      {row.traceId && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const base = "-mx-2 flex min-h-8 w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 text-left";
  if (!row.traceId) {
    return (
      <span className={cn(base, "cursor-default")} title="No trace: this request was rejected before tracing started.">
        {content}
        <span className="sr-only">No trace recorded</span>
      </span>
    );
  }
  const label = `Trace the ${row.outcome.toLowerCase()} delivery at ${formatClock(row.receivedAt)}`;
  return action.kind === "link" ? (
    <Link href={action.href(row.traceId)} aria-label={label} className={cn(base, "hover:bg-muted")}>
      {content}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={() => action.onOpen(row)} className={cn(base, "hover:bg-muted")}>
      {content}
    </button>
  );
}
