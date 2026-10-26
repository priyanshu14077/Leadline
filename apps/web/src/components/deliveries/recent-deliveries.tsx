"use client";

import type { DeliveryRow } from "@leadline/shared";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DeliveryGroups } from "@/components/deliveries/delivery-groups";
import { groupDeliveries } from "@/components/deliveries/group";
import { TraceSheet } from "@/components/trace/trace-sheet";

const SHOWN = 10;

/** The pipeline's side panel: the latest deliveries, grouped, each opening its trace in a sheet. */
export function RecentDeliveries({ practiceSlug, deliveries, freshIds }: { practiceSlug: string; deliveries: DeliveryRow[]; freshIds: Set<string> }) {
  const [traceId, setTraceId] = useState<string | null>(null);
  const groups = useMemo(() => groupDeliveries(deliveries).slice(0, SHOWN), [deliveries]);
  const duplicates = deliveries.filter((d) => d.outcome === "DUPLICATE").length;
  return (
    <aside aria-labelledby="recent-deliveries" className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="perforated border-b-0 px-4 pt-3 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="recent-deliveries" className="type-label text-[0.8rem]">
            Webhook deliveries
          </h2>
          <Link href={`/app/${practiceSlug}/deliveries`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            All deliveries <ArrowRightIcon className="size-3" aria-hidden />
          </Link>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every request, retries included. {duplicates} duplicate{duplicates === 1 ? "" : "s"} caught in the last {deliveries.length}.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            No deliveries yet. Send one from the repo root:
            <code className="mt-2 block rounded bg-muted px-2 py-1 font-mono text-foreground">bun run simulate --one</code>
          </div>
        ) : (
          <DeliveryGroups groups={groups} freshIds={freshIds} dense action={{ kind: "button", onOpen: (r) => setTraceId(r.traceId) }} />
        )}
      </div>
      <TraceSheet practiceSlug={practiceSlug} traceId={traceId} onClose={() => setTraceId(null)} />
    </aside>
  );
}
